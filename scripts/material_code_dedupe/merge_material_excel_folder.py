#!/usr/bin/env python3
"""
将 material-excel/*.xlsx（Sheet1）合并为一张 UTF-8 BOM CSV，供 clean_material_codes.py 使用。

- category / area：由 excel_category_map.json 按「文件名不含扩展名」映射到规范品类名。
- pic_folder：与分表文件名一致（如 工程灯具），供 PIC 子目录与 rename_pic_local.sh 目标路径使用。
- id：合并后按出现顺序重新编号 1..n（保证流水稳定）。
- excel_src_row：每条数据对应 Excel 工作表行号（与 openpyxl 行号一致，表头为第 1 行），供 hybrid 抠图按锚点行对齐。
- 写出重复 code 报告（表内 + 跨文件），便于你修表或复制图片。
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]

RAW_COLUMNS = [
    "id",
    "code",
    "name",
    "description",
    "price",
    "unit",
    "category",
    "brand",
    "hs_code",
    "weight",
    "volume",
    "qty",
    "spec",
    "specs_l",
    "specs_w",
    "specs_h",
    "specification",
    "area",
    "location",
    "box_no",
    "material",
    "color",
    "image",
    "image_filename",
    "image_data",
    "remarks",
    "tags",
    "create_time",
    "update_time",
    "restaurant_brand_id",
    "material_brand",
    "suggested_waste_rate",
    "excel_src_row",
]


def load_map(path: Path) -> dict[str, str]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items() if not str(k).startswith("_")}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "folder",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Admin\Desktop\material\new\material-excel"),
    )
    ap.add_argument(
        "--map",
        type=Path,
        default=SCRIPT_DIR / "excel_category_map.json",
        help="文件名 stem → 规范 category",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=ROOT / "materials_raw_from_excel_merged.csv",
    )
    ap.add_argument(
        "--dup-report",
        type=Path,
        default=ROOT / "materials_excel_code_duplicates.csv",
    )
    ap.add_argument("--sheet", type=int, default=0, help="0-based sheet index")
    ap.add_argument(
        "--skip-invalid-sheets",
        action="store_true",
        help="跳过缺少 name 列或无法解析的表（写入 skipped-report），不中断整批合并",
    )
    ap.add_argument(
        "--skipped-report",
        type=Path,
        default=None,
        help="被跳过的文件清单 CSV（默认与 dup-report 同目录 materials_excel_skipped.csv）",
    )
    ap.add_argument(
        "--use-bak-if-present",
        action="store_true",
        help="若存在与主表同名的 xxx.bak_before_code.xlsx，则读取备份（pic_folder/category 仍按主文件名）",
    )
    args = ap.parse_args()

    if not args.folder.is_dir():
        sys.exit(f"目录不存在: {args.folder}")
    cat_map = load_map(args.map) if args.map.is_file() else {}

    def list_workbooks(folder: Path) -> list[Path]:
        """列出待合并工作簿。默认跳过 *.bak_before_code（由主表 + --use-bak-if-present 读备份）；
        若仅有备份、没有同名主文件 xxx.xlsx，则把该备份纳入列表，否则会丢整表（如只留 前厅杂件.bak_before_code）。"""
        out: list[Path] = []
        for pat in ("*.xlsx", "*.xls"):
            for p in folder.glob(pat):
                if ".bak_before_code" in p.name.lower():
                    continue
                # Excel/WPS 打开工作簿时的锁文件，无法读取，会 PermissionError
                if p.name.startswith("~$"):
                    continue
                out.append(p)
        # 孤儿备份：xxx.bak_before_code.xlsx 存在且 xxx.xlsx 不存在
        bak_suffix = ".bak_before_code"
        for p in folder.glob("*.bak_before_code.xlsx"):
            if p.name.startswith("~$"):
                continue
            stem_full = p.stem.strip().rstrip(".")
            if not stem_full.lower().endswith(bak_suffix.lower()):
                continue
            base = stem_full[: -len(bak_suffix)].rstrip(".")
            if not base:
                continue
            main_xlsx = folder / f"{base}.xlsx"
            if main_xlsx.is_file():
                continue
            out.append(p)
        return sorted(out, key=lambda x: x.name.lower())

    files = list_workbooks(args.folder)
    if not files:
        sys.exit(f"未找到 .xlsx / .xls: {args.folder}")

    skipped: list[dict[str, str]] = []
    skipped_path = args.skipped_report
    if skipped_path is None and args.skip_invalid_sheets:
        skipped_path = args.dup_report.with_name("materials_excel_skipped.csv")

    frames: list[pd.DataFrame] = []
    for path in files:
        stem = path.stem.strip()
        stem_key = stem.rstrip(".")
        if stem_key.lower().endswith(".bak_before_code"):
            stem_key = stem_key[: -len(".bak_before_code")].rstrip(".")
        # 孤儿备份时 stem 含 .bak_before_code，映射表键为 pic_folder 短名，优先 stem_key
        category = cat_map.get(stem_key) or cat_map.get(stem)
        if category is None:
            category = stem_key
            print(
                f"[WARN] 未在映射表中找到 {stem!r}（已尝试去掉尾部点），category 暂用 {stem_key!r}。请编辑 excel_category_map.json",
                file=sys.stderr,
            )

        read_path = path
        if args.use_bak_if_present or ".bak_before_code" in path.name.lower():
            bak = path.parent / f"{stem_key}.bak_before_code.xlsx"
            if bak.is_file():
                read_path = bak
                main_hint = path.name if ".bak_before_code" not in path.name.lower() else "(无主文件)"
                print(
                    f"[INFO] 使用备份表: {bak.name}（对应 {main_hint}，pic_folder={stem_key!r}）",
                    file=sys.stderr,
                )

        engine = "openpyxl" if read_path.suffix.lower() == ".xlsx" else "xlrd"
        try:
            xls = pd.ExcelFile(read_path, engine=engine)
        except ImportError as e:
            if engine == "xlrd":
                sys.exit(f"{read_path.name}: 读取 .xls 需要安装 xlrd（pip install xlrd）: {e}")
            raise
        if args.sheet >= len(xls.sheet_names):
            msg = f"{read_path.name}: sheet 索引越界"
            if args.skip_invalid_sheets:
                skipped.append({"file": path.name, "reason": msg})
                print(f"[SKIP] {msg}", file=sys.stderr)
                continue
            sys.exit(msg)
        sh = xls.sheet_names[args.sheet]
        df = pd.read_excel(read_path, sheet_name=sh, dtype=str, engine=engine)
        df.columns = [str(c).strip().lower() for c in df.columns]
        if "name" not in df.columns:
            msg = f"{read_path.name}: 缺少 name 列（请改为标准物料表，或本文件为报价单/明细单模板）"
            if args.skip_invalid_sheets:
                skipped.append({"file": path.name, "reason": msg})
                print(f"[SKIP] {msg}", file=sys.stderr)
                continue
            sys.exit(msg)
        # 与 openpyxl 行号一致：第 1 行为表头，首条数据为第 2 行（read_excel 无表头行号，index 0 -> 行 2）
        df["excel_src_row"] = (df.index + 2).astype(str)
        df = df[df["name"].astype(str).str.strip() != ""].copy()
        df["category"] = category
        if "area" not in df.columns or df["area"].astype(str).str.strip().eq("").all():
            df["area"] = category
        # 与 material-excel 分表文件夹同名，供 PIC 子目录 / rename_pic_local.sh 使用
        df["pic_folder"] = stem_key
        df["_source_xlsx"] = read_path.name
        frames.append(df)

    if skipped and skipped_path is not None:
        skipped_path.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(skipped).to_csv(skipped_path, index=False, encoding="utf-8-sig")
        print(f"已写入跳过清单: {skipped_path.resolve()} （{len(skipped)} 个文件）", file=sys.stderr)

    if not frames:
        sys.exit("没有可合并的工作表（可能全部被跳过）。请检查 Excel 是否为标准列（含 name）。")

    merged = pd.concat(frames, ignore_index=True)
    merged["id"] = range(1, len(merged) + 1)
    merged["id"] = merged["id"].astype(str)

    # 对齐 materials_raw 列
    for c in RAW_COLUMNS:
        if c not in merged.columns:
            merged[c] = ""

    # 重复 code 报告（非空 code）
    if "code" in merged.columns:
        s = merged["code"].astype(str).str.strip()
        s = s.mask(s.str.lower().isin(("nan", "none")))
        dup_mask = s.ne("") & s.duplicated(keep=False)
        if dup_mask.any():
            rep = merged.loc[dup_mask, ["id", "code", "name", "category", "_source_xlsx"]].copy()
            args.dup_report.parent.mkdir(parents=True, exist_ok=True)
            rep.to_csv(args.dup_report, index=False, encoding="utf-8-sig")
            print(
                f"发现重复或非空 code 多行，已写: {args.dup_report.resolve()} （{len(rep)} 行）",
                file=sys.stderr,
            )

    out = merged[RAW_COLUMNS].copy()
    if "pic_folder" in merged.columns:
        out["pic_folder"] = merged["pic_folder"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"已写入 {len(out)} 行: {args.output.resolve()}")
    print("下一步示例:")
    print(
        f'  python "{SCRIPT_DIR / "clean_material_codes.py"}" "{args.output}" '
        f'--mode all-rows -o "{ROOT / "materials_cleaned.csv"}" -m "{ROOT / "code_mapping.csv"}" '
        f'--pic-dir "C:/Users/Admin/Desktop/material/new/PIC" '
        f'--shell-commands "{ROOT / "rename_pic_local.sh"}"'
    )


if __name__ == "__main__":
    main()
