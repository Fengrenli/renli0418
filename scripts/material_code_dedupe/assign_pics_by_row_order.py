#!/usr/bin/env python3
"""
按「Excel 合并顺序」给本地散图统一赋新码（PIC/<pic_folder>/<code>.ext）。

规则：
  1. 行按 materials_cleaned.csv 的 id 升序。
  2. code 为空的行跳过，不消耗图片。
  3. 源图按文件名自然排序；对每个有 code 的行依次取下一张。
  4. 图用完了后面还有行 → 不写；行用完了还剩图 → 告警。

模式：
  - flat：所有图在一个目录，按全局 id 顺序分发到各分类。
  - by-folder + 复制：--source-root/<分类>/ → --dest-root/<分类>/<code>.ext
  - by-folder + --in-place：图已在 --dest-root/<分类>/（如 image1.png），原地重命名为 <code>.ext

用法:
  python assign_pics_by_row_order.py \\
    --mapping "E:/renli0418/materials_cleaned_houtang.csv" \\
    --dest-root "C:/Users/Admin/Desktop/material/new/houtang/PIC" \\
    --source-mode by-folder --in-place

  python assign_pics_by_row_order.py ... --dry-run --only-folder 厨房设备
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

import pandas as pd

PIC_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".gif")
INVALID_FS = re.compile(r'[<>:"/\\|?*]')
IMAGE_N_STEM = re.compile(r"^image\d+$", re.IGNORECASE)


def natural_key(path: Path) -> list:
    s = path.name.lower()
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    out: list[Path] = []
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() in PIC_EXTENSIONS:
            out.append(p)
    return sorted(out, key=natural_key)


def pick_source_files_for_folder(folder_dir: Path, codes_in_folder: set[str]) -> list[Path]:
    all_im = list_images(folder_dir)
    if not all_im:
        return []
    image_n = [p for p in all_im if IMAGE_N_STEM.match(p.stem)]
    if image_n:
        return sorted(image_n, key=natural_key)
    loose = [p for p in all_im if p.stem not in codes_in_folder]
    return sorted(loose, key=natural_key)


def safe_code(code: str) -> str:
    t = (code or "").strip()
    t = INVALID_FS.sub("_", t)
    return t or "unnamed"


def rel_under(base: Path, p: Path) -> str:
    try:
        return str(p.resolve().relative_to(base.resolve()))
    except ValueError:
        return str(p)


def main() -> None:
    ap = argparse.ArgumentParser(description="按行序复制或原地重命名为 PIC/<pic_folder>/<code>.ext")
    ap.add_argument("--mapping", type=Path, required=True, help="materials_cleaned_*.csv")
    ap.add_argument(
        "--source-root",
        type=Path,
        default=None,
        help="源图片根目录（非 in-place 时必填）",
    )
    ap.add_argument("--dest-root", type=Path, required=True, help="品牌 PIC 根目录")
    ap.add_argument(
        "--source-mode",
        choices=("flat", "by-folder"),
        default="flat",
        help="flat 或 by-folder",
    )
    ap.add_argument(
        "--in-place",
        action="store_true",
        help="在 dest-root/<分类>/ 内原地重命名（需 by-folder）",
    )
    ap.add_argument("--only-folder", default="", help="只处理该 pic_folder")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-existing", action="store_true", help="目标 <code>.ext 已存在则跳过")
    args = ap.parse_args()

    if not args.mapping.is_file():
        sys.exit(f"找不到 mapping: {args.mapping}")

    if args.in_place:
        if args.source_mode != "by-folder":
            sys.exit("in-place 仅支持 --source-mode by-folder")
    else:
        if args.source_root is None or not args.source_root.is_dir():
            sys.exit("非 in-place 时请提供有效的 --source-root")

    df = pd.read_csv(args.mapping, dtype=str, keep_default_na=False)
    df.columns = [str(c).strip().lower() for c in df.columns]
    for col in ("id", "code", "pic_folder"):
        if col not in df.columns:
            sys.exit(f"{args.mapping} 缺少列: {col}")

    df["id"] = pd.to_numeric(df["id"], errors="coerce")
    if df["id"].isna().any():
        sys.exit("id 列存在无法解析为数字的行")
    df["id"] = df["id"].astype(int)

    dest_root = args.dest_root.resolve()
    source_root = args.source_root.resolve() if args.source_root else dest_root

    folders = sorted(df["pic_folder"].astype(str).str.strip().unique())
    if args.only_folder.strip():
        folders = [args.only_folder.strip()]
        if folders[0] not in set(df["pic_folder"].astype(str).str.strip()):
            sys.exit(f"CSV 中无 pic_folder={args.only_folder!r}")

    report: list[dict[str, str]] = []
    total_done = 0
    total_skip = 0

    def append_report(
        folder: str,
        row_id: int,
        code: str,
        status: str,
        rel_src: str = "",
        rel_dst: str = "",
    ) -> None:
        report.append(
            {
                "pic_folder": folder,
                "id": str(row_id),
                "code": code,
                "status": status,
                "src": rel_src,
                "dst": rel_dst,
            }
        )

    def handle_one(
        folder: str,
        row_id: int,
        code: str,
        src: Path | None,
        rel_base: Path,
    ) -> None:
        nonlocal total_done, total_skip
        if not code or code.lower() in ("nan", "none"):
            append_report(folder, row_id, code, "skip_empty_code")
            return
        if src is None:
            append_report(folder, row_id, code, "no_more_source_images")
            return

        ext = src.suffix.lower()
        if ext not in PIC_EXTENSIONS:
            ext = ".png"
        dst_dir = dest_root / folder
        dst = dst_dir / f"{safe_code(code)}{ext}"
        rel_src = rel_under(rel_base, src)
        rel_dst = rel_under(dest_root, dst)

        if src.resolve() == dst.resolve():
            append_report(folder, row_id, code, "skip_same_path", rel_src, rel_dst)
            return

        if args.skip_existing and dst.is_file():
            append_report(folder, row_id, code, "skip_existing_dst", rel_src, rel_dst)
            total_skip += 1
            return

        if dst.is_file():
            append_report(folder, row_id, code, "error_target_exists", rel_src, rel_dst)
            print(
                f"[ERR] {folder}: 目标已存在: {dst.name}（加 --skip-existing 或先移走）",
                file=sys.stderr,
            )
            total_skip += 1
            return

        if args.dry_run:
            append_report(
                folder,
                row_id,
                code,
                "dry_run_rename" if args.in_place else "dry_run_copy",
                rel_src,
                rel_dst,
            )
            total_done += 1
            return

        dst_dir.mkdir(parents=True, exist_ok=True)
        if args.in_place:
            src.rename(dst)
        else:
            shutil.copy2(src, dst)

        append_report(
            folder,
            row_id,
            code,
            "renamed" if args.in_place else "copied",
            rel_src,
            rel_dst,
        )
        total_done += 1

    if args.source_mode == "flat":
        rows = df[df["pic_folder"].astype(str).str.strip().isin(folders)].sort_values(
            "id", kind="mergesort"
        )
        files = list_images(source_root)
        if not files and len(rows) > 0:
            print(f"[WARN] flat 源目录无图片: {source_root}", file=sys.stderr)
        it = iter(files)
        for _, row in rows.iterrows():
            folder = str(row["pic_folder"]).strip()
            if not folder:
                continue
            code = str(row["code"]).strip()
            src = next(it, None) if code and code.lower() not in ("nan", "none") else None
            handle_one(folder, int(row["id"]), code, src, source_root)
        leftover = list(it)
        if leftover:
            print(
                f"[WARN] flat 还剩 {len(leftover)} 张未分配: "
                f"{', '.join(p.name for p in leftover[:8])}{'...' if len(leftover) > 8 else ''}",
                file=sys.stderr,
            )

    else:
        for folder in folders:
            folder = str(folder).strip()
            if not folder:
                continue
            sub = df[df["pic_folder"].astype(str).str.strip() == folder].sort_values(
                "id", kind="mergesort"
            )
            codes_set = {
                str(r["code"]).strip()
                for _, r in sub.iterrows()
                if str(r["code"]).strip()
                and str(r["code"]).strip().lower() not in ("nan", "none")
            }

            if args.in_place:
                folder_dir = dest_root / folder
                files = pick_source_files_for_folder(folder_dir, codes_set)
                rel_base = dest_root
            else:
                folder_dir = source_root / folder
                files = list_images(folder_dir)
                rel_base = source_root

            if not files and len(sub) > 0:
                print(f"[WARN] 无图片: {folder_dir}", file=sys.stderr)

            it = iter(files)
            for _, row in sub.iterrows():
                code = str(row["code"]).strip()
                src = None
                if code and code.lower() not in ("nan", "none"):
                    src = next(it, None)
                handle_one(folder, int(row["id"]), code, src, rel_base)

            leftover = list(it)
            if leftover:
                print(
                    f"[WARN] {folder}: 还剩 {len(leftover)} 张未分配: "
                    f"{', '.join(p.name for p in leftover[:8])}{'...' if len(leftover) > 8 else ''}",
                    file=sys.stderr,
                )

    rep_path = args.mapping.with_name(
        args.mapping.stem.replace("materials_cleaned", "pic_assign_by_order") + "_report.csv"
    )
    pd.DataFrame(report).to_csv(rep_path, index=False, encoding="utf-8-sig")
    print(f"已写入报告: {rep_path.resolve()}")
    print(f"完成: {total_done}，跳过/失败: {total_skip}，dry_run={args.dry_run}")


if __name__ == "__main__":
    main()
