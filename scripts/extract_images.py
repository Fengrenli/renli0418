#!/usr/bin/env python3
"""
extract_images.py（项目约定版）

目标：给定某个分类工作簿（通常为 <分类>.bak_before_code.xlsx），把图片稳定输出到：
  PIC/<分类>/<code>.<ext>

优先级（与「前厅杂件成功方案」一致）：
1) WPS DISPIMG + cellimages.xml：按 ID 精准对齐（最可靠）
2) 若该本没有 DISPIMG 公式 / cellimages 结构不完整：按 cellimages 顺序 + 表内 code 行顺序兜底
3) 若仍不行：回退 openpyxl ws._images（真嵌入图），按锚点行 + excel_src_row / id 序 hybrid 对齐

用法（示例）：
  python scripts/extract_images.py --workbook ".../前厅杂件.bak_before_code.xlsx" --pic-dir ".../PIC/前厅杂件"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> int:
    p = subprocess.run(cmd)
    return int(p.returncode or 0)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workbook", "-w", type=Path, required=True)
    ap.add_argument("--pic-dir", "-o", type=Path, required=True)
    ap.add_argument("--naming", choices=("code", "code_and_name"), default="code")
    ap.add_argument(
        "--mapping",
        type=Path,
        default=ROOT / "materials_cleaned_houtang.csv",
        help="用于 legacy 回退时的 materials_cleaned_*.csv（需含 excel_src_row/pic_folder/code）",
    )
    ap.add_argument("--excel-dir", type=Path, default=None, help="legacy 回退时需要，用于定位同名 xlsx")
    ap.add_argument("--prefer-bak", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    wb = args.workbook.resolve()
    if not wb.is_file():
        raise SystemExit(f"workbook not found: {wb}")
    pic_dir = args.pic_dir.resolve()

    # 先走 WPS/cellimages 提取（最可靠）
    dispimg = ROOT / "scripts" / "material_code_dedupe" / "extract_wps_dispimg_to_pic.py"
    if not dispimg.is_file():
        raise SystemExit(f"not found: {dispimg}")

    cmd1 = [
        sys.executable,
        str(dispimg),
        "--workbook",
        str(wb),
        "--pic-dir",
        str(pic_dir),
        "--naming",
        args.naming,
        "--mapping-csv",
        str(args.mapping.resolve()),
        "--pic-folder",
        wb.stem.replace(".bak_before_code", ""),
    ]
    if args.dry_run:
        cmd1.append("--dry-run")
    rc = run(cmd1)
    if rc == 0:
        return
    if rc != 2:
        raise SystemExit(rc)

    # 回退：openpyxl 真嵌入图（ws._images），hybrid 对齐
    legacy = ROOT / "scripts" / "material_code_dedupe" / "extract_images_from_material_excel.py"
    if not legacy.is_file():
        raise SystemExit(f"not found: {legacy}")
    excel_dir = args.excel_dir.resolve() if args.excel_dir else wb.parent.resolve()
    folder_stem = wb.stem.replace(".bak_before_code", "")
    cmd2 = [
        sys.executable,
        str(legacy),
        "--excel-dir",
        str(excel_dir),
        "--mapping",
        str(args.mapping.resolve()),
        "--pic-root",
        str(pic_dir.parent.resolve()),
        "--match",
        "hybrid",
        "--only-stem",
        folder_stem,
    ]
    if args.prefer_bak:
        cmd2.append("--prefer-bak")
    if args.dry_run:
        cmd2.append("--dry-run")
    rc2 = run(cmd2)
    raise SystemExit(rc2)


if __name__ == "__main__":
    main()