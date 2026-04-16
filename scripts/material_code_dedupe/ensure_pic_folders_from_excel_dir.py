#!/usr/bin/env python3
"""
按 material-excel 目录下每个表格文件名（不含扩展名）在 PIC 下建同名子文件夹，与分表一致。

说明：
  - 仅创建目录，不读取表内容、不删除或修改任何 Excel（流水线其它脚本也不会删你的 xlsx/xls）。
  - 支持 .xlsx / .xls；自动跳过 Excel 锁文件 ~$*。
  - materials_cleaned 里 pic_folder 与「文件名（不含扩展名）」一致时，把图放进对应 PIC 子文件夹即可。

用法：
  # 直接创建文件夹（推荐）
  python ensure_pic_folders_from_excel_dir.py "C:/.../houtang/material-excel" \\
    --pic-root "C:/.../houtang/PIC" --apply

  # 或生成 ps1 再执行
  python ensure_pic_folders_from_excel_dir.py "..." --pic-root "..." --emit ps1 -o mkdir_pic.ps1
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def excel_stems(excel_dir: Path) -> list[str]:
    paths: list[Path] = []
    for pat in ("*.xlsx", "*.xls"):
        paths.extend(excel_dir.glob(pat))
    paths = [p for p in paths if not p.name.startswith("~$")]
    paths.sort(key=lambda p: p.name.lower())
    if not paths:
        sys.exit(f"目录下没有 .xlsx / .xls: {excel_dir}")
    seen: set[str] = set()
    out: list[str] = []
    for p in paths:
        stem = p.stem.strip().rstrip(".")
        if not stem or stem in seen:
            continue
        seen.add(stem)
        out.append(stem)
    return out


def write_ps1(cats: list[str], root: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    root = root.resolve()
    lines = [
        "# UTF-8",
        "$ErrorActionPreference = 'Stop'",
        f'$PIC = "{str(root).replace("`", "``")}"',
        "New-Item -ItemType Directory -Path $PIC -Force | Out-Null",
    ]
    for c in cats:
        safe = c.replace("'", "''")
        lines.append(f"New-Item -ItemType Directory -Path (Join-Path $PIC '{safe}') -Force | Out-Null")
    lines.append('Write-Host "OK: 已按 material-excel 文件名创建 PIC 子目录（或已存在）"')
    output.write_text("\n".join(lines) + "\n", encoding="utf-8-sig")


def write_sh(cats: list[str], root: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    root_posix = root.resolve().as_posix()
    if len(root_posix) >= 3 and root_posix[1] == ":" and root_posix[0].isalpha():
        root_posix = f"/{root_posix[0].lower()}{root_posix[2:]}"
    lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        f'PIC="{root_posix}"',
        'mkdir -p "$PIC"',
    ]
    for c in cats:
        lines.append(f'mkdir -p "$PIC/{c}"')
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="按 material-excel 表格文件名创建 PIC 子目录")
    ap.add_argument(
        "excel_dir",
        type=Path,
        nargs="?",
        default=Path(r"C:\Users\Admin\Desktop\material\new\material-excel"),
    )
    ap.add_argument(
        "--pic-root",
        type=Path,
        default=Path(r"C:\Users\Admin\Desktop\material\new\PIC"),
        help="PIC 根目录",
    )
    ap.add_argument(
        "--apply",
        action="store_true",
        help="直接在 pic-root 下创建子目录（不存在则新建，已存在则跳过）",
    )
    ap.add_argument("--emit", choices=("none", "ps1", "sh"), default="none")
    ap.add_argument("-o", "--output", type=Path, default=None)
    args = ap.parse_args()

    if not args.excel_dir.is_dir():
        sys.exit(f"目录不存在: {args.excel_dir}")

    cats = excel_stems(args.excel_dir)
    print(f"共 {len(cats)} 个分表文件夹名（来自 {args.excel_dir}）：")
    for c in cats:
        print(f"  {c}")

    if args.apply:
        root = args.pic_root.resolve()
        root.mkdir(parents=True, exist_ok=True)
        for c in cats:
            (root / c).mkdir(parents=True, exist_ok=True)
        print(f"\n已在 PIC 根下创建/确认目录: {root}")
        if args.emit == "none":
            return

    if args.emit == "none" and not args.apply:
        print("\n加 --apply 直接创建目录，或 --emit ps1 -o xxx.ps1 生成脚本。")
        return
    if args.output is None:
        sys.exit("emit 非 none 时请指定 -o")

    if args.emit == "ps1":
        write_ps1(cats, args.pic_root, args.output)
    else:
        write_sh(cats, args.pic_root, args.output)
    print(f"\n已写入: {args.output.resolve()}")
    if args.emit == "ps1":
        print(f'执行: powershell -ExecutionPolicy Bypass -File "{args.output}"')
    else:
        print(f'执行: bash "{args.output}"')


if __name__ == "__main__":
    main()
