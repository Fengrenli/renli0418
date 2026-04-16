#!/usr/bin/env python3
"""
将目录内每个 .xlsx（默认第一个工作表）导出为 UTF-8 BOM CSV，便于 Excel / 线上编码工具打开。

输出：默认在源目录下创建子文件夹 material-excel-csv，文件名与 xlsx  stem 相同。

用法：
  python xlsx_folder_to_utf8_csv.py "C:/Users/Admin/Desktop/material/new/material-excel"
  python xlsx_folder_to_utf8_csv.py "C:/.../material-excel" -o "C:/.../material-excel-csv"

终端仍显示乱码时（PowerShell）：可先执行 chcp 65001，或：
  $env:PYTHONIOENCODING='utf-8'
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser(description="xlsx 目录批量转 UTF-8-sig CSV")
    ap.add_argument(
        "excel_dir",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Admin\Desktop\material\new\material-excel"),
    )
    ap.add_argument(
        "-o",
        "--out-dir",
        type=Path,
        default=None,
        help="输出目录，默认: <excel_dir>/material-excel-csv",
    )
    ap.add_argument(
        "--sheet",
        type=int,
        default=0,
        help="工作表索引，默认 0（第一个）",
    )
    args = ap.parse_args()

    src = args.excel_dir
    if not src.is_dir():
        sys.exit(f"目录不存在: {src}")

    out = args.out_dir if args.out_dir is not None else src / "material-excel-csv"
    out.mkdir(parents=True, exist_ok=True)

    files = sorted(src.glob("*.xlsx"))
    if not files:
        sys.exit(f"未找到 .xlsx: {src}")

    for path in files:
        if path.name.startswith("~$"):
            continue
        stem = path.stem.strip().rstrip(".")
        try:
            xls = pd.ExcelFile(path, engine="openpyxl")
        except Exception as e:
            print(f"[ERR] 无法打开 {path.name}: {e}", file=sys.stderr)
            continue
        if args.sheet >= len(xls.sheet_names):
            print(f"[ERR] {path.name}: sheet 索引越界", file=sys.stderr)
            continue
        sh = xls.sheet_names[args.sheet]
        df = pd.read_excel(path, sheet_name=sh, dtype=str, engine="openpyxl")
        csv_path = out / f"{stem}.csv"
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
        print(f"[OK] {path.name} -> {csv_path.name} ({len(df)} 行)")

    print(f"\n已写入目录: {out.resolve()}")


if __name__ == "__main__":
    main()
