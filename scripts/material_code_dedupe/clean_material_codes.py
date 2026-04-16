#!/usr/bin/env python3
"""
materials 重码清洗：导出 CSV -> 生成 new_code -> materials_cleaned.csv + code_mapping.csv。

分段式编码（与《材料编码书写及命名规则》一致）：
    类别代码(4位) - 颜色工艺(4位) - 物料简写(3–5位) - 流水号(默认3位，同桶>999时自动扩为4位)

默认 duplicates-only：仅「code 重复」行换新码；all-rows：全表按本规则重算。
流水号在同「类别+颜色+简写」桶内按 id 升序递增，保证全表 new_code 唯一。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd

COLOR_COLUMNS = ("color", "colour", "material_color", "工艺", "颜色", "工艺颜色", "color_code")

PIC_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


def load_pic_folder_map(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    return {str(k): str(v) for k, v in raw.items() if not str(k).startswith("_")}


def load_pic_extra_sources(path: Path) -> dict[str, list[str]]:
    """无 pic_folder 列时的兜底：规范 category → 额外尝试的子文件夹名。"""
    if not path.is_file():
        return {}
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    out: dict[str, list[str]] = {}
    for k, v in raw.items():
        if str(k).startswith("_"):
            continue
        if isinstance(v, list):
            out[str(k)] = [str(x).strip() for x in v if str(x).strip()]
        elif isinstance(v, str) and v.strip():
            out[str(k)] = [v.strip()]
    return out


def resolve_pic_subfolder(row: pd.Series, folder_map: dict[str, str]) -> str:
    """PIC 根下的目标子文件夹名（新文件名落盘位置）。"""
    pf = normalize_text(row.get("pic_folder"))
    if pf:
        return pf
    cat = normalize_text(row.get("category"))
    area = normalize_text(row.get("area"))
    for key in (cat, area):
        if key and key in folder_map:
            return folder_map[key]
    if cat:
        return cat
    if area:
        return area
    return "未分类"


def pic_source_folder_candidates(
    row: pd.Series,
    folder_map: dict[str, str],
    extra_by_category: dict[str, list[str]] | None = None,
) -> list[str]:
    """找旧图顺序：有 pic_folder 时优先该分表文件夹；否则 extra（见 category_pic_extra_sources.json）→ category → dest。"""
    extra_by_category = extra_by_category or {}
    dest = resolve_pic_subfolder(row, folder_map)
    cat = normalize_text(row.get("category"))
    pf = normalize_text(row.get("pic_folder"))
    out: list[str] = []
    seen: set[str] = set()

    def add(x: str) -> None:
        t = normalize_text(x)
        if t and t not in seen:
            seen.add(t)
            out.append(t)

    if not pf:
        for x in extra_by_category.get(cat, []):
            add(x)
    if pf:
        add(pf)
    if cat and cat != dest:
        add(cat)
    if dest:
        add(dest)
    return out if out else ([dest] if dest else ["未分类"])


def find_pic_in_candidates(
    pic_root: Path, folders: list[str], code: str
) -> tuple[str | None, str, Path | None]:
    """返回 (所在子文件夹名, 扩展名含点, 完整路径)。"""
    for fold in folders:
        p, ext = find_pic_with_ext(pic_root, fold, code)
        if p is not None:
            return fold, ext, p
    return None, ".png", None


def find_pic_with_ext(pic_root: Path, subfolder: str, code: str) -> tuple[Path | None, str]:
    """在 pic_root/subfolder/{code}.ext 中查找首个存在的文件；subfolder 为空时表示 pic_root 下平铺。"""
    base = pic_root / subfolder if subfolder.strip() else pic_root
    for ext in PIC_EXTENSIONS:
        p = base / f"{code}{ext}"
        if p.is_file():
            return p, ext
    return None, ".png"


def load_json_kv(path: Path, *, skip_underscore: bool = True) -> dict[str, str]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    out: dict[str, str] = {}
    for k, v in raw.items():
        if skip_underscore and str(k).startswith("_"):
            continue
        out[str(k)] = str(v)
    return out


def load_color_process_map(path: Path) -> tuple[dict[str, str], str]:
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)
    default = raw.get("_default", "GYHG")
    m = {k: v for k, v in raw.items() if not str(k).startswith("_")}
    return m, segment_4(str(default))


def segment_4(s: str) -> str:
    t = re.sub(r"[^A-Z0-9]", "", str(s).upper())
    if len(t) < 4:
        t = (t + "XXXX")[:4]
    return t[:4]


def category_segment(row: pd.Series, category_map: dict[str, str]) -> str:
    cat = normalize_text(row.get("category"))
    v = category_map.get(cat, "MS99")
    return segment_4(v)


def normalize_text(x: object) -> str:
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return ""
    return str(x).strip()


def color_segment(row: pd.Series, color_map: dict[str, str], default_4: str) -> str:
    blob = ""
    for col in COLOR_COLUMNS:
        if col in row.index:
            blob += normalize_text(row.get(col)) + " "
    blob = blob.strip()
    if blob:
        for key in sorted(color_map.keys(), key=len, reverse=True):
            if key in blob:
                return segment_4(color_map[key])
    return segment_4(default_4)


def chinese_token_initials(name: str, max_parts: int = 4) -> str:
    parts = re.split(r"[^\u4e00-\u9fffA-Za-z0-9]+", name)
    parts = [p for p in parts if p][:max_parts]
    letters: list[str] = []
    for p in parts:
        if re.match(r"^[A-Za-z]", p):
            letters.append(p[0].upper())
        elif p:
            letters.append(chr(65 + (ord(p[0]) % 26)))
    return "".join(letters)


def material_abbr_segment(row: pd.Series, hints: dict[str, str]) -> str:
    name = normalize_text(row.get("name"))
    for key in sorted(hints.keys(), key=len, reverse=True):
        if key in name:
            return abbr_normalize(hints[key])
    tokens = re.findall(r"[A-Za-z]{2,}", name)
    if tokens:
        return abbr_normalize(max(tokens, key=len))
    ini = chinese_token_initials(name)
    if len(ini) >= 3:
        return abbr_normalize(ini)
    h = hashlib.md5(f"{name}|{row['id']}".encode("utf-8")).hexdigest().upper()
    return abbr_normalize("X" + h[:3])


def abbr_normalize(s: str) -> str:
    t = re.sub(r"[^A-Z0-9]", "", str(s).upper())
    if len(t) < 3:
        t = (t + "XXX")[:3]
    if len(t) > 5:
        t = t[:5]
    return t


def format_serial(n: int) -> str:
    if n <= 999:
        return f"{n:03d}"
    return f"{n:04d}"


def assign_segmented_codes(
    work: pd.DataFrame,
    category_map: dict[str, str],
    color_map: dict[str, str],
    default_color_4: str,
    abbr_hints: dict[str, str],
) -> pd.Series:
    """返回与 work 同索引的 new_code 序列。"""
    w = work.copy()
    w["_c4"] = w.apply(lambda r: category_segment(r, category_map), axis=1)
    w["_o4"] = w.apply(lambda r: color_segment(r, color_map, default_color_4), axis=1)
    w["_ab"] = w.apply(lambda r: material_abbr_segment(r, abbr_hints), axis=1)
    w = w.sort_values("id")
    w["_seq"] = w.groupby(["_c4", "_o4", "_ab"], sort=False).cumcount() + 1
    if (w["_seq"] > 999).any():
        print(
            "提示：部分「类别+颜色+简写」桶内流水号已超过 999，已自动使用 4 位流水（仍唯一）。",
            file=sys.stderr,
        )
    w["new_code"] = w.apply(lambda r: f"{r._c4}-{r._o4}-{r._ab}-{format_serial(int(r._seq))}", axis=1)
    return w["new_code"]


def ensure_unique_codes(series: pd.Series) -> None:
    dup = series[series.duplicated(keep=False)]
    if len(dup) > 0:
        bad = dup.unique().tolist()
        raise SystemExit(f"新生成的 code 仍存在重复，请检查逻辑。示例: {bad[:5]}")


def main() -> None:
    root = Path(__file__).resolve().parent
    default_cat = root / "category_prefix_map.json"
    default_color = root / "color_process_map.json"
    default_abbr = root / "material_abbr_hints.json"

    ap = argparse.ArgumentParser(description="清洗 materials 重码并生成映射表（分段式编码）")
    ap.add_argument("input_csv", type=Path, help="从 RDS 导出的 materials_raw.csv")
    ap.add_argument(
        "-o",
        "--output-cleaned",
        type=Path,
        default=Path("materials_cleaned.csv"),
        help="输出：带 new_code 的全表",
    )
    ap.add_argument(
        "-m",
        "--output-mapping",
        type=Path,
        default=Path("code_mapping.csv"),
        help="输出：id,old_code,new_code",
    )
    ap.add_argument(
        "--mode",
        choices=("duplicates-only", "all-rows"),
        default="duplicates-only",
        help="duplicates-only: 仅重码行换新码；all-rows: 全表按分段规则重算",
    )
    ap.add_argument("--category-map", type=Path, default=default_cat, help="类别四位码 JSON")
    ap.add_argument("--color-map", type=Path, default=default_color, help="颜色工艺四位码 JSON")
    ap.add_argument("--abbr-hints", type=Path, default=default_abbr, help="物料简写子串提示 JSON")
    ap.add_argument(
        "--default-color",
        type=str,
        default="",
        help="未匹配到颜色列/关键词时的四位颜色工艺码，默认取 color_map 的 _default（一般为 GYHG）",
    )
    ap.add_argument("--pic-dir", type=Path, default=None, help="PIC 根目录（其下为各分类子文件夹）；默认仓库 public/assets/PIC")
    ap.add_argument(
        "--pic-layout",
        choices=("nested", "flat"),
        default="nested",
        help="nested: PIC/分类文件夹/code.ext；flat: PIC/code.ext",
    )
    ap.add_argument(
        "--pic-folder-map",
        type=Path,
        default=Path(__file__).resolve().parent / "category_pic_folder_map.json",
        help="category/area → 磁盘子文件夹名（JSON）",
    )
    ap.add_argument(
        "--pic-extra-sources",
        type=Path,
        default=Path(__file__).resolve().parent / "category_pic_extra_sources.json",
        help="无 pic_folder 列时：规范 category → 额外尝试的子文件夹（JSON）；不存在则忽略",
    )
    ap.add_argument(
        "--apply-pic-rename",
        action="store_true",
        help="在磁盘上执行图片重命名",
    )
    ap.add_argument("--rename-dry-run", action="store_true", help="仅打印 mv，不改文件")
    ap.add_argument("--shell-commands", type=Path, default=None, help="写入 bash 重命名脚本")
    ap.add_argument(
        "--pic-manifest",
        type=Path,
        default=None,
        help="写出 pic 重命名清单 CSV（默认：与 code_mapping 同目录下的 pic_rename_manifest.csv，仅 nested 时）",
    )
    args = ap.parse_args()

    if not args.input_csv.is_file():
        sys.exit(f"找不到输入文件: {args.input_csv}")

    category_map = load_json_kv(args.category_map)
    color_lookup, default_from_file = load_color_process_map(args.color_map)
    default_color_4 = segment_4(args.default_color) if args.default_color.strip() else default_from_file
    abbr_hints = load_json_kv(args.abbr_hints)
    pic_folder_map = load_pic_folder_map(args.pic_folder_map)
    pic_extra_sources = load_pic_extra_sources(args.pic_extra_sources)

    df = pd.read_csv(args.input_csv, dtype=str, keep_default_na=False)
    df.columns = [c.strip().lower() for c in df.columns]

    if "id" not in df.columns:
        sys.exit("CSV 必须包含 id 列（主键）。")
    if "code" not in df.columns:
        sys.exit("CSV 必须包含 code 列。")
    if "name" not in df.columns:
        sys.exit("CSV 必须包含 name 列（用于物料简写推导）。")

    df["id"] = pd.to_numeric(df["id"], errors="coerce")
    if df["id"].isna().any():
        sys.exit("存在无法解析的 id，请先清洗导出数据。")
    df["id"] = df["id"].astype(int)

    dup_mask = df["code"].map(df["code"].value_counts()) > 1
    df["old_code"] = (
        df["code"].astype(str).str.strip().replace({"nan": "", "none": "", "None": ""})
    )
    df["new_code"] = ""

    if args.mode == "all-rows":
        df["new_code"] = assign_segmented_codes(df, category_map, color_lookup, default_color_4, abbr_hints)
    else:
        df["new_code"] = df["old_code"]
        if dup_mask.any():
            dup_idx = df.index[dup_mask]
            assigned = assign_segmented_codes(
                df.loc[dup_idx],
                category_map,
                color_lookup,
                default_color_4,
                abbr_hints,
            )
            df.loc[dup_idx, "new_code"] = assigned

    ensure_unique_codes(df["new_code"])

    mapping = df[["id", "old_code", "new_code"]].copy()
    mapping.to_csv(args.output_mapping, index=False, encoding="utf-8-sig")

    cleaned = df.copy()
    cleaned["code_before_cleanup"] = cleaned["old_code"]
    cleaned["code"] = cleaned["new_code"]
    cleaned = cleaned.drop(columns=["old_code", "new_code"])
    cleaned.to_csv(args.output_cleaned, index=False, encoding="utf-8-sig")

    dup_n = int(dup_mask.sum())
    print(f"编码规则: 类别(4)-颜色工艺(4)-简写(3–5)-流水(3/4)")
    print(f"模式: {args.mode}")
    print(f"总行数: {len(df)}，重码涉及行数: {dup_n}")
    print(f"已写入: {args.output_cleaned.resolve()}")
    print(f"已写入: {args.output_mapping.resolve()}")

    canon_rows = (
        df.sort_values("id")
        .groupby("old_code", as_index=False)
        .last()[["old_code", "new_code"]]
        .rename(columns={"new_code": "canonical_new_code"})
    )
    canon_path = args.output_mapping.with_name("code_mapping_canonical_by_old_code.csv")
    canon_rows.to_csv(canon_path, index=False, encoding="utf-8-sig")
    print(f"已写入（rule_items / 单图 PIC）: {canon_path.resolve()}")

    repo_pic = Path(__file__).resolve().parents[2] / "public" / "assets" / "PIC"
    pic_base = args.pic_dir if args.pic_dir is not None else repo_pic

    # 图片：目标文件夹 + 多路径找源（如植物盆栽 -> 软装物料目录）
    pic_ops_flat: list[tuple[str, str]] = []
    manifest_rows: list[dict[str, str]] = []
    nested_row_shell: list[
        tuple[str, str, str, list[str]]
    ] = []  # (old, new, dst_fold, source_folder_candidates)

    for _, r in df.iterrows():
        o, n = str(r["old_code"]), str(r["new_code"])
        if not o or o == n:
            continue
        if args.pic_layout == "nested":
            dst_fold = resolve_pic_subfolder(r, pic_folder_map)
            cands = pic_source_folder_candidates(r, pic_folder_map, pic_extra_sources)
            src_fold, ext, src_path = (
                find_pic_in_candidates(pic_base, cands, o) if pic_base.is_dir() else (None, ".png", None)
            )
            manifest_rows.append(
                {
                    "pic_destination_folder": dst_fold,
                    "pic_source_try_order": " | ".join(cands),
                    "category_db": normalize_text(r.get("category")),
                    "old_code": o,
                    "new_code": n,
                    "src_found_folder": src_fold or "",
                    "expected_src_rel": f"{src_fold}/{o}{ext}" if src_fold else f"{cands[0]}/{o}{ext}",
                    "dst_rel": f"{dst_fold}/{n}{ext}",
                    "src_found": "yes" if src_path is not None else "no",
                },
            )
            nested_row_shell.append((o, n, dst_fold, cands))
        else:
            pic_ops_flat.append((o, n))

    pic_ops_flat = sorted(set(pic_ops_flat), key=lambda x: x[0])

    sh_lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        f'PIC="{pic_base.as_posix()}"',
        "renamed=0",
        'echo "=== PIC 重命名开始 ==="',
        'echo "根目录: $PIC"',
        'if [ ! -d "$PIC" ]; then echo "错误: 根目录不存在，请修改脚本内 PIC= 路径"; exit 1; fi',
        "# nested: 源可能在 category 旧目录或目标目录，新码落在 pic_destination（见 category_pic_folder_map.json）",
    ]

    if args.pic_layout == "nested":
        for o, n, dst_fold, cands in nested_row_shell:
            sh_lines.append("for _ext in png jpg jpeg webp; do")
            sh_lines.append(f'  _dst="$PIC/{dst_fold}/{n}.$_ext"')
            for i, cf in enumerate(cands):
                kw = "if" if i == 0 else "elif"
                sh_lines.append(f'  {kw} [ -f "$PIC/{cf}/{o}.$_ext" ]; then')
                sh_lines.append('    if [ -f "$_dst" ]; then echo "  [跳过] 目标已存在: $_dst"')
                sh_lines.append("    else")
                sh_lines.append(f'      mv -n "$PIC/{cf}/{o}.$_ext" "$_dst"')
                sh_lines.append(f'      echo "  [OK] $PIC/{cf}/{o}.$_ext -> $_dst"')
                sh_lines.append("      renamed=$((renamed + 1))")
                sh_lines.append("    fi")
            sh_lines.append("  fi")
            sh_lines.append("done")
    else:
        sh_lines.append('cd "$PIC"')
        sh_lines.append('echo "已切换到: $(pwd)"')
        for o, n in pic_ops_flat:
            sh_lines.append("for _ext in png jpg jpeg webp; do")
            sh_lines.append(f'  _src="{o}.$_ext"')
            sh_lines.append(f'  _dst="{n}.$_ext"')
            sh_lines.append('  if [ -f "$_src" ]; then')
            sh_lines.append('    if [ -f "$_dst" ]; then')
            sh_lines.append('      echo "  [跳过] 目标已存在: $_dst"')
            sh_lines.append("    else")
            sh_lines.append('      mv -n "$_src" "$_dst"')
            sh_lines.append('      echo "  [OK] $_src -> $_dst"')
            sh_lines.append("      renamed=$((renamed + 1))")
            sh_lines.append("    fi")
            sh_lines.append("  fi")
            sh_lines.append("done")

    sh_lines.extend(
        [
            'echo "=== 结束: 成功重命名 $renamed 个文件 ==="',
            'if [ "$renamed" -eq 0 ]; then',
            '  echo "未重命名任何文件。请检查: 1) PIC 路径是否正确 2) 子文件夹名是否与 CSV/category 一致（见 category_pic_folder_map.json）"',
            '  echo "3) 源文件名是否为 旧编码.png 4) 调试可加: bash -x 本脚本路径"',
            "fi",
        ],
    )

    manifest_path = args.pic_manifest
    if manifest_path is None and args.pic_layout == "nested" and manifest_rows:
        manifest_path = args.output_mapping.with_name("pic_rename_manifest.csv")
    if manifest_path is not None and manifest_rows:
        pd.DataFrame(manifest_rows).to_csv(manifest_path, index=False, encoding="utf-8-sig")
        print(f"已写入 pic 清单: {manifest_path.resolve()}")

    if args.shell_commands:
        args.shell_commands.parent.mkdir(parents=True, exist_ok=True)
        args.shell_commands.write_text("\n".join(sh_lines) + "\n", encoding="utf-8")
        print(f"已写入 shell: {args.shell_commands.resolve()}")

    if args.apply_pic_rename or args.rename_dry_run:
        if not pic_base.is_dir():
            print(f"警告: PIC 目录不存在，跳过物理重命名: {pic_base}", file=sys.stderr)
        elif args.pic_layout == "nested":
            for o, n, dst_fold, cands in nested_row_shell:
                src_fold, ext, src_path = find_pic_in_candidates(pic_base, cands, o)
                if src_path is None:
                    if args.rename_dry_run:
                        print(f"  [dry-run] 未找到 {o} in {cands}")
                    continue
                dst = pic_base / dst_fold / f"{n}{ext}"
                if args.rename_dry_run:
                    print(f"  [dry-run] mv -n {src_path} -> {dst}")
                elif args.apply_pic_rename:
                    if dst.is_file():
                        print(f"跳过（目标已存在）: {dst}", file=sys.stderr)
                    else:
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        os.rename(src_path, dst)
        else:
            for o, n in pic_ops_flat:
                src, ext = find_pic_with_ext(pic_base, "", o)
                if src is None:
                    if args.rename_dry_run:
                        print(f"  [dry-run] 未找到: {pic_base / o}.(png|jpg|…)")
                    continue
                dst = pic_base / f"{n}{ext}"
                if args.rename_dry_run:
                    print(f"  [dry-run] mv -n {src} -> {dst}")
                elif args.apply_pic_rename:
                    if dst.is_file():
                        print(f"跳过（目标已存在）: {dst}", file=sys.stderr)
                    else:
                        os.rename(src, dst)


if __name__ == "__main__":
    main()
