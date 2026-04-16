#!/usr/bin/env python3
"""
核对 materials_raw + code_mapping 与本地 PIC/{分类}/ 下实际文件名是否一致。
输出 CSV：每行物料的旧码图、新码图是否存在，以及 category 与 code 首段是否可疑。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import pandas as pd

EXTS = (".png", ".jpg", ".jpeg", ".webp")

# category 首段期望（与 category_prefix_map 一致，用于粗检「类对码不对」）
EXPECTED_PREFIX = {
    "陶制烧制制品": ("CE",),
    "墙地瓷砖制品": ("TI",),
    "定制中式建筑结构": ("WD",),
    "定制石材制品": ("ST",),
    "定制金属制品": ("MT",),
    "五金杂件及工程灯具": ("HW", "MT", "CM"),  # CM/MT 历史混入
    "厨房电器及设备": ("KT", "MT"),
    "小型电器及设备": ("EL", "MT"),
    "灯笼": ("LN", "LE"),
    "植物盆栽": ("PT",),
    "定制玻璃钢雕塑": ("FG",),
    "定制活动家具及软装饰物料": ("FN",),
    "定制活动家具及软装物料": ("FN",),
    "定制活动家具及软装材料": ("FN",),
}


def load_folder_map(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    return {k: v for k, v in raw.items() if not str(k).startswith("_")}


def pic_destination_folder(row: pd.Series, folder_map: dict[str, str]) -> str:
    cat = str(row.get("category") or "").strip()
    area = str(row.get("area") or "").strip()
    for key in (cat, area):
        if key and key in folder_map:
            return folder_map[key]
    return cat or area or "未分类"


def pic_source_candidates(row: pd.Series, folder_map: dict[str, str]) -> list[str]:
    dest = pic_destination_folder(row, folder_map)
    cat = str(row.get("category") or "").strip()
    out: list[str] = []
    if cat and cat != dest:
        out.append(cat)
    if dest and dest not in out:
        out.append(dest)
    return out if out else [dest]


def find_image_any_folder(pic_root: Path, folders: list[str], code: str) -> tuple[str, str]:
    """返回 (find_image 风格结果, 命中的子文件夹名)。"""
    for sub in folders:
        st = find_image(pic_root, sub, code)
        if st.startswith("yes"):
            return st, sub
    if folders:
        st0 = find_image(pic_root, folders[0], code)
        if st0 == "folder_missing":
            return "folder_missing", folders[0]
    return "no", folders[0] if folders else ""


def first_segment(code: str) -> str:
    code = str(code).strip()
    if not code:
        return ""
    return code.split("-", 1)[0].upper()


def prefix_ok(category: str, code: str) -> str:
    seg = first_segment(code)
    exp = EXPECTED_PREFIX.get(category.strip())
    if not exp:
        return "未配置期望前缀"
    if any(seg.startswith(p) for p in exp):
        return "ok"
    return f"可疑:首段={seg} 期望以{'/'.join(exp)}开头"


def find_image(pic_root: Path, sub: str, code: str) -> str:
    d = pic_root / sub
    if not d.is_dir():
        return "folder_missing"
    for ext in EXTS:
        if (d / f"{code}{ext}").is_file():
            return f"yes{ext}"
    return "no"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", type=Path, default=Path("materials_raw.csv"))
    ap.add_argument("--mapping", type=Path, default=Path("code_mapping.csv"))
    ap.add_argument("--pic-root", type=Path, required=True)
    ap.add_argument("-o", "--output", type=Path, default=Path("materials_pic_audit_report.csv"))
    ap.add_argument(
        "--folder-map",
        type=Path,
        default=Path(__file__).resolve().parent / "category_pic_folder_map.json",
    )
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[2]
    raw_path = args.raw if args.raw.is_absolute() else root / args.raw
    map_path = args.mapping if args.mapping.is_absolute() else root / args.mapping
    out_path = args.output if args.output.is_absolute() else root / args.output

    if not raw_path.is_file():
        sys.exit(f"缺少 {raw_path}")
    if not map_path.is_file():
        sys.exit(f"缺少 {map_path}，请先运行 clean_material_codes.py")

    folder_map = load_folder_map(args.folder_map)
    raw = pd.read_csv(raw_path, dtype=str, keep_default_na=False)
    raw.columns = [c.strip().lower() for c in raw.columns]
    mp = pd.read_csv(map_path, dtype=str, keep_default_na=False)

    m = raw.merge(mp, left_on="id", right_on="id", suffixes=("", "_map"))
    if "old_code" not in m.columns:
        sys.exit("code_mapping 需含 old_code, new_code")

    rows: list[dict[str, str]] = []
    pic_root = args.pic_root

    for _, r in m.iterrows():
        old_c = str(r["old_code"]).strip()
        new_c = str(r["new_code"]).strip()
        dest = pic_destination_folder(r, folder_map)
        cands = pic_source_candidates(r, folder_map)
        st_old, old_hit = find_image_any_folder(pic_root, cands, old_c)
        st_new = find_image(pic_root, dest, new_c)

        if st_old.startswith("yes") and st_new.startswith("yes"):
            pic_align = "old_and_new_both_exist"
        elif st_new.startswith("yes"):
            pic_align = "ok_new_name"
        elif st_old.startswith("yes"):
            pic_align = "still_old_name"
        elif st_old == "folder_missing" or st_new == "folder_missing":
            pic_align = "folder_missing"
        else:
            pic_align = "no_image_found"

        rows.append(
            {
                "id": str(r["id"]),
                "category": str(r.get("category") or ""),
                "pic_destination_folder": dest,
                "pic_source_try": " | ".join(cands),
                "old_image_hit_folder": old_hit,
                "name": str(r.get("name") or "")[:80],
                "old_code": old_c,
                "new_code": new_c,
                "image_old_exists": st_old,
                "image_new_exists": st_new,
                "pic_file_status": pic_align,
                "prefix_vs_category": prefix_ok(str(r.get("category") or ""), old_c),
                "image_filename_csv": str(r.get("image_filename") or ""),
            },
        )

    out = pd.DataFrame(rows)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(out_path, index=False, encoding="utf-8-sig")

    # 摘要
    s = out["pic_file_status"].value_counts()
    print("=== PIC 文件名 vs 编码 ===")
    print(s.to_string())
    print("\n=== 首段与 category 粗检（旧码）===")
    print(out["prefix_vs_category"].value_counts().to_string())
    print(f"\n已写入: {out_path}")


if __name__ == "__main__":
    main()
