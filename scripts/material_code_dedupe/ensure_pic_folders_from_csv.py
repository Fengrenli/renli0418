#!/usr/bin/env python3
"""
从 materials_cleaned.csv 读取 category 列唯一值，生成「规范品类」PIC 子文件夹（通常 10 个左右，多表会合并）。

若要与 material-excel 的 14 个分表文件夹名一致，请改用 ensure_pic_folders_from_excel_dir.py。

适用：PIC 子目录名 = 库内规范 category 时，把图片命名为「新码.png」放入对应子文件夹。

用法示例：
  python ensure_pic_folders_from_csv.py ../../materials_cleaned.csv --pic-root "C:/Users/Admin/Desktop/material/new/PIC" --emit ps1 -o ../../mkdir_pic_categories.ps1
  powershell -ExecutionPolicy Bypass -File ../../mkdir_pic_categories.ps1

  # 仅打印品类列表（不建目录）
  python ensure_pic_folders_from_csv.py ../../materials_cleaned.csv
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser(description="按 CSV 的 category 列生成 PIC 子目录创建脚本")
    ap.add_argument(
        "input_csv",
        type=Path,
        help="含 category 列，如 materials_cleaned.csv",
    )
    ap.add_argument(
        "--pic-root",
        type=Path,
        default=None,
        help="PIC 根目录（生成 ps1/sh 时建议填写）",
    )
    ap.add_argument(
        "--emit",
        choices=("none", "ps1", "sh"),
        default="none",
        help="none: 只打印品类；ps1/sh: 写入创建目录脚本",
    )
    ap.add_argument("-o", "--output", type=Path, default=None, help="脚本输出路径（emit 非 none 时必填）")
    args = ap.parse_args()

    if not args.input_csv.is_file():
        sys.exit(f"找不到: {args.input_csv}")

    df = pd.read_csv(args.input_csv, dtype=str, keep_default_na=False)
    df.columns = [str(c).strip().lower() for c in df.columns]
    if "category" not in df.columns:
        sys.exit("CSV 需包含 category 列")

    cats = sorted(
        {str(x).strip() for x in df["category"].tolist() if str(x).strip() and str(x).strip().lower() not in ("nan", "none")}
    )

    print(f"共 {len(cats)} 个规范品类子文件夹（与当前表 category 一致）：")
    for c in cats:
        print(f"  {c}")

    if args.emit == "none":
        print("\n配图规则：每行物料在 PIC/<category>/<code>.png（或 jpg/webp），code 用 materials_cleaned 的新码。")
        return

    if args.pic_root is None or args.output is None:
        sys.exit("emit 为 ps1/sh 时需同时指定 --pic-root 与 -o")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    root = args.pic_root.resolve()

    if args.emit == "ps1":
        lines = [
            "# UTF-8",
            "$ErrorActionPreference = 'Stop'",
            f'$PIC = "{str(root).replace("`", "``")}"',
            "New-Item -ItemType Directory -Path $PIC -Force | Out-Null",
        ]
        for c in cats:
            safe = c.replace("'", "''")
            lines.append(f"New-Item -ItemType Directory -Path (Join-Path $PIC '{safe}') -Force | Out-Null")
        lines.append('Write-Host "OK: PIC 子目录已创建（或已存在）"')
        args.output.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")
        print(f"\n已写入 PowerShell: {args.output.resolve()}")
        print(f'执行: powershell -ExecutionPolicy Bypass -File "{args.output}"')
        return

    # sh: Git Bash / WSL
    root_posix = root.as_posix()
    if len(root_posix) >= 3 and root_posix[1] == ":" and root_posix[0].isalpha():
        root_posix = f"/{root_posix[0].lower()}{root_posix[2:]}"
    lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        f'PIC="{root_posix}"',
        'mkdir -p "$PIC"',
    ]
    for c in cats:
        lines.append(f'mkdir -p "$PIC/{c.replace(chr(34), "")}"')
    args.output.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n已写入 bash: {args.output.resolve()}")
    print(f'执行: bash "{args.output}"')


if __name__ == "__main__":
    main()
