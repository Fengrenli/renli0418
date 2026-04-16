#!/usr/bin/env python3
"""Scan material-excel/*.xlsx: headers, row counts, code column, dup/blank codes."""
from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

CODE_CANDIDATES = (
    "code",
    "编码",
    "材料编码",
    "物料编码",
    "产品编码",
    "货号",
    "编号",
)


def norm_col(c: object) -> str:
    s = str(c).strip().lower()
    s = re.sub(r"\s+", "", s)
    return s


def pick_code_column(cols: list) -> str | None:
    lowered = {norm_col(c): str(c).strip() for c in cols}
    for cand in CODE_CANDIDATES:
        k = norm_col(cand)
        if k in lowered:
            return lowered[k]
    for c in cols:
        cs = str(c).strip()
        if "编码" in cs and len(cs) <= 8:
            return cs
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "folder",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Admin\Desktop\material\new\material-excel"),
    )
    ap.add_argument("--sheet", type=int, default=0, help="0-based sheet index")
    args = ap.parse_args()

    if not args.folder.is_dir():
        print(f"目录不存在: {args.folder}", file=sys.stderr)
        sys.exit(1)

    files = sorted(args.folder.glob("*.xlsx"))
    if not files:
        print(f"未找到 .xlsx: {args.folder}", file=sys.stderr)
        sys.exit(1)

    print(f"共 {len(files)} 个 xlsx\n")

    code_to_locations: dict[str, list[str]] = defaultdict(list)
    per_file_summary: list[tuple[str, int, int, int, str | None]] = []

    for path in files:
        cat = path.stem
        try:
            xls = pd.ExcelFile(path, engine="openpyxl")
        except Exception as e:
            print(f"[ERR] {path.name}: 无法打开 — {e}")
            continue

        sheet_names = xls.sheet_names
        if args.sheet >= len(sheet_names):
            print(f"[ERR] {path.name}: sheet 索引越界，共 {len(sheet_names)} 个表")
            continue

        sh = sheet_names[args.sheet]
        try:
            peek = pd.read_excel(
                path, sheet_name=sh, nrows=5, dtype=str, engine="openpyxl"
            )
        except Exception as e:
            print(f"[ERR] {path.name}[{sh}]: 试读失败 — {e}")
            continue

        cols = [str(c) for c in peek.columns.tolist()]
        code_col = pick_code_column(cols)
        print(f"── {path.name} (sheet: {sh})")
        print(f"   列数: {len(cols)}  前几列: {cols[:12]}{' ...' if len(cols) > 12 else ''}")
        if not code_col:
            print("   [WARN] 未识别到编码列（需人工指定列名）")
            per_file_summary.append((path.name, 0, 0, 0, None))
            print()
            continue

        try:
            full = pd.read_excel(
                path, sheet_name=sh, dtype=str, engine="openpyxl", usecols=[code_col]
            )
        except ValueError:
            full = pd.read_excel(path, sheet_name=sh, dtype=str, engine="openpyxl")
            if code_col not in full.columns:
                print(f"   [WARN] 列 {code_col!r} 丢失")
                per_file_summary.append((path.name, 0, 0, 0, code_col))
                print()
                continue
            full = full[[code_col]]

        s = full[code_col].astype(str).str.strip()
        s = s.replace({"nan": "", "None": "", "<NA>": ""})
        n_total = len(s)
        blank = int((s == "").sum())
        non_empty = s[s != ""]
        n_dup_within = int(non_empty.duplicated().sum())
        uniq_non_empty = non_empty.nunique()

        for code in non_empty.unique():
            code_to_locations[str(code)].append(f"{cat} ({path.name})")

        print(f"   编码列: {code_col!r}  行数: {n_total}  空编码: {blank}  非空行: {len(non_empty)}")
        print(f"   非空唯一编码数: {uniq_non_empty}  表内重复行数(非空): {n_dup_within}")
        per_file_summary.append((path.name, n_total, blank, n_dup_within, code_col))
        print()

    # Cross-file duplicate codes
    multi = {c: locs for c, locs in code_to_locations.items() if len(locs) > 1}
    print("=" * 60)
    print(f"跨文件重复编码（同一字符串出现在多个品类表）: {len(multi)} 个")
    if multi:
        for c in sorted(multi.keys(), key=lambda x: (len(multi[x]), x))[:40]:
            print(f"  {c!r} -> {multi[c]}")
        if len(multi) > 40:
            print(f"  ... 另有 {len(multi) - 40} 个未列出")

    print("\n结论: 若无 [ERR] 且各表均识别到编码列，则格式可被 pandas+openpyxl 正常读取。")
    print("全表重赋码请使用 clean_material_codes.py --mode all-rows（先合并为一张 UTF-8 CSV）。")


if __name__ == "__main__":
    main()
