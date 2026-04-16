#!/usr/bin/env python3
"""
rename_images.py（项目约定版）

用途：
- OSS/数据库最终建议只用 <code>.<ext>
- 若你想在本地保留可读文件名（<code>_<name>.<ext>），可以先用 extract_images.py --naming code_and_name 导出，
  再用本脚本“压回”到 <code>.<ext>（保留原图扩展名）以便上传 OSS。
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


CODE_RE = re.compile(r"^(?P<code>[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-\d{3,4})(?:_.+)?$", re.I)
IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", type=Path, required=True, help="PIC/<分类> 目录")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--overwrite", action="store_true", help="若 code.ext 已存在则覆盖")
    args = ap.parse_args()

    d = args.dir.resolve()
    if not d.is_dir():
        raise SystemExit(f"not a dir: {d}")

    moved = 0
    skipped = 0
    for p in sorted(d.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in IMG_EXTS:
            continue
        m = CODE_RE.match(p.stem)
        if not m:
            continue
        code = m.group("code").upper()
        dst = d / f"{code}{p.suffix.lower()}"
        if dst.name == p.name:
            continue
        if dst.exists() and not args.overwrite:
            skipped += 1
            continue
        if args.dry_run:
            print(f"[dry-run] {p.name} -> {dst.name}")
            moved += 1
            continue
        if dst.exists() and args.overwrite:
            dst.unlink()
        p.rename(dst)
        moved += 1

    print(f"done: renamed={moved} skipped_existing={skipped} dir={d}")


if __name__ == "__main__":
    main()