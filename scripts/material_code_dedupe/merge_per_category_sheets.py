#!/usr/bin/env python3
"""
读取「按文件名=品类」的 GBK CSV（搭建初期的分表），与 materials_raw.csv 按 code 合并：
  - 同 code：用分表所在文件名作为权威 category（可纠正库中笼统/错误分类）
  - 仅在分表出现、不在 raw：追加新行并分配新 id
  - 同一 code 出现在两个分表：报错退出（需人工拆表）

输出：materials_raw_from_sheets_merged.csv → 再交给 clean_material_codes.py 做分段编码与 PIC 脚本。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip().lower() for c in df.columns]
    drop = [c for c in df.columns if c.startswith("unnamed")]
    df = df.drop(columns=drop, errors="ignore")
    return df


def load_category_folder(folder: Path, conflict_report: Path | None = None) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []
    for f in sorted(folder.glob("*.csv")):
        cat = f.stem.strip()
        if not cat:
            continue
        try:
            part = pd.read_csv(f, encoding="gbk", dtype=str, keep_default_na=False)
        except UnicodeDecodeError:
            part = pd.read_csv(f, encoding="gb18030", dtype=str, keep_default_na=False)
        part = normalize_columns(part)
        part["category"] = cat
        part["_source_csv"] = f.name
        if "code" not in part.columns:
            print(f"跳过（无 code 列）: {f.name}", file=sys.stderr)
            continue
        part["code"] = part["code"].astype(str).str.strip()
        part = part[part["code"] != ""]
        # 单表内重复行（常见于搭建时复制粘贴）
        part = part.drop_duplicates(subset=["code"], keep="first")
        frames.append(part)
    if not frames:
        sys.exit(f"未在 {folder} 找到可用的 .csv")
    allp = pd.concat(frames, ignore_index=True)
    cat_n = allp.groupby("code")["category"].nunique()
    conflict_codes = cat_n[cat_n > 1].index
    if len(conflict_codes) > 0:
        sub = allp[allp["code"].isin(conflict_codes)].sort_values(["code", "category"])
        out_cols = sub[["code", "category", "_source_csv"]]
        if conflict_report is not None:
            conflict_report.parent.mkdir(parents=True, exist_ok=True)
            out_cols.to_csv(conflict_report, index=False, encoding="utf-8-sig")
            print(f"冲突详情已写入（UTF-8 BOM）: {conflict_report.resolve()}", file=sys.stderr)
        print("错误：以下 code 出现在「不同品类」的 CSV 中，请从其中一个 CSV 删除该行后重试：", file=sys.stderr)
        print(out_cols.to_string(index=False), file=sys.stderr)
        sys.exit(1)
    allp = allp.drop_duplicates(subset=["code"], keep="first")
    return allp


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--sheets-dir",
        type=Path,
        default=Path(r"C:\Users\Admin\Desktop\material\new\materials"),
        help="分品类 CSV 所在目录（文件名=品类中文名）",
    )
    ap.add_argument(
        "--raw",
        type=Path,
        default=root / "materials_raw.csv",
        help="当前导出的全表 materials_raw.csv",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=root / "materials_raw_from_sheets_merged.csv",
        help="合并后输出路径",
    )
    ap.add_argument(
        "--conflict-report",
        type=Path,
        default=root / "materials_sheet_conflicts.csv",
        help="跨品类冲突时写入的 UTF-8 BOM 报告（便于 Excel 打开）",
    )
    args = ap.parse_args()

    if not args.sheets_dir.is_dir():
        sys.exit(f"目录不存在: {args.sheets_dir}")
    if not args.raw.is_file():
        sys.exit(f"缺少 {args.raw}")

    sheets = load_category_folder(args.sheets_dir, conflict_report=args.conflict_report)
    cat_by_code = sheets[["code", "category", "_source_csv"]].drop_duplicates(subset=["code"], keep="first")

    raw = pd.read_csv(args.raw, dtype=str, keep_default_na=False)
    raw.columns = [str(c).strip().lower() for c in raw.columns]
    if "id" not in raw.columns or "code" not in raw.columns:
        sys.exit("materials_raw 需含 id, code")

    raw["code"] = raw["code"].astype(str).str.strip()
    merged = raw.merge(cat_by_code[["code", "category"]], on="code", how="left", suffixes=("", "_sheet"))
    # 权威分类：分表有则用分表
    has_sheet = merged["category_sheet"].notna() & (merged["category_sheet"] != "")
    merged.loc[has_sheet, "category"] = merged.loc[has_sheet, "category_sheet"]
    merged = merged.drop(columns=["category_sheet"])

    # 分表有、raw 无
    raw_codes = set(raw["code"].tolist())
    only_sheet = sheets[~sheets["code"].isin(raw_codes)].copy()
    next_id = int(pd.to_numeric(raw["id"], errors="coerce").max()) + 1

    new_rows: list[dict] = []
    for _, r in only_sheet.iterrows():
        row = {c: None for c in raw.columns}
        row["id"] = str(next_id)
        next_id += 1
        row["code"] = r["code"]
        row["name"] = r.get("name")
        row["category"] = r["category"]
        row["brand"] = r.get("brand")
        row["hs_code"] = r.get("hs_code")
        row["unit"] = r.get("unit")
        row["price"] = r.get("price")
        row["specs_l"] = r.get("specs_l")
        row["specs_w"] = r.get("specs_w")
        row["specs_h"] = r.get("specs_h")
        row["specification"] = r.get("specification")
        row["qty"] = r.get("qty")
        row["material"] = r.get("material")
        row["area"] = r["category"]
        new_rows.append(row)

    if new_rows:
        merged = pd.concat([merged, pd.DataFrame(new_rows)], ignore_index=True)

    merged.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"合并行数: {len(merged)}（raw {len(raw)}，分表仅多出的行: {len(new_rows)}）")
    print(f"已写入: {args.output.resolve()}")
    print("\n下一步示例（再跑分段清洗与 PIC 脚本）：")
    print(
        f'  cd scripts/material_code_dedupe\n'
        f'  python clean_material_codes.py "{args.output}" --mode all-rows -o ../../materials_cleaned.csv '
        f'-m ../../code_mapping.csv --pic-dir "C:/Users/Admin/Desktop/material/new/PIC" '
        f'--shell-commands ../../rename_pic_local.sh'
    )


if __name__ == "__main__":
    main()
