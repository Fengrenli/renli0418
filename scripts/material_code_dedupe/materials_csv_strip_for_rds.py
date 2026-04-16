#!/usr/bin/env python3
"""
从 materials_cleaned.csv 去掉 RDS materials 表不存在的列，供 DMS「导入到 materials」使用。

默认移除: code_before_cleanup（pic_folder 保留，导入前请在库中增加对应列）
可选 --only-known-columns：只保留与常见 production 表一致的列（若仍报错可打开）。

用法:
  python materials_csv_strip_for_rds.py
  python materials_csv_strip_for_rds.py -i ../../materials_cleaned.csv -o ../../materials_cleaned_for_rds.csv
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd

# 与 server.ts 初始化 + 常见迁移对齐；若你库多/少列，可改此集合或不用 --only-known-columns
# 注意：不包含 id。多品牌追加导入时用 INSERT，id 由库端 SERIAL/序列生成，避免与已有主键冲突。
KNOWN_MATERIALS_COLUMNS = (
    "code",
    "name",
    "description",
    "price",
    "unit",
    "category",
    "brand",
    "hs_code",
    "weight",
    "volume",
    "qty",
    "spec",
    "specs_l",
    "specs_w",
    "specs_h",
    "specification",
    "area",
    "location",
    "box_no",
    "material",
    "color",
    "image",
    "image_filename",
    "image_data",
    "pic_folder",
    "remarks",
    "tags",
    "create_time",
    "update_time",
    "restaurant_brand_id",
    "material_brand",
    "suggested_waste_rate",
)

DROP_ALWAYS = (
    "code_before_cleanup",
    # merge 侧写入，仅用于本地抠图对齐；materials 表无此列
    "excel_src_row",
)
NUMERIC_COLUMNS = ("price", "weight", "volume", "qty", "suggested_waste_rate")
INT_COLUMNS = ("restaurant_brand_id",)


def sanitize_numeric_text(s: pd.Series) -> tuple[pd.Series, int]:
    """保留纯数字（含小数/正负号），其余文本清空。"""
    t = s.astype(str).str.strip()
    ok = t.eq("") | t.str.match(r"^[-+]?\d+(\.\d+)?$")
    bad_n = int((~ok).sum())
    out = t.where(ok, "")
    return out, bad_n


def sanitize_int_text(s: pd.Series) -> tuple[pd.Series, int]:
    t = s.astype(str).str.strip()
    ok = t.eq("") | t.str.match(r"^[-+]?\d+$")
    bad_n = int((~ok).sum())
    out = t.where(ok, "")
    return out, bad_n


def fill_empty_name_for_rds(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """materials.name 多为 NOT NULL；空名用 description 等回填，避免 DMS 整批失败。"""
    if "name" not in df.columns or "code" not in df.columns:
        return df, 0
    name = df["name"].astype(str).str.strip()
    empty = name.eq("") | name.str.casefold().isin(("nan", "none"))
    if not bool(empty.any()):
        return df, 0
    n = int(empty.sum())

    def col(c: str) -> pd.Series:
        if c not in df.columns:
            return pd.Series([""] * len(df), index=df.index)
        return df[c].astype(str).str.strip()

    desc = col("description")
    spec = col("specification")
    cat = col("category")
    code = df["code"].astype(str).str.strip()
    merged = desc.where(desc.ne(""), spec.where(spec.ne(""), cat.where(cat.ne(""), code)))
    merged = merged.where(merged.ne(""), code)
    df = df.copy()
    df.loc[empty, "name"] = merged.loc[empty]
    return df, n


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser()
    ap.add_argument("-i", "--input", type=Path, default=root / "materials_cleaned.csv")
    ap.add_argument("-o", "--output", type=Path, default=root / "materials_cleaned_for_rds.csv")
    ap.add_argument(
        "--only-known-columns",
        action="store_true",
        help="仅输出 KNOWN_MATERIALS_COLUMNS 中存在的列（表里没有的列会从 CSV 去掉）",
    )
    args = ap.parse_args()

    df = pd.read_csv(args.input, dtype=str, keep_default_na=False)
    df.columns = [str(c).strip().lower() for c in df.columns]

    for c in DROP_ALWAYS:
        if c in df.columns:
            df = df.drop(columns=[c])

    if args.only_known_columns:
        keep = [c for c in KNOWN_MATERIALS_COLUMNS if c in df.columns]
        df = df[keep]

    # DMS 导入 numeric/int 字段时，文本会直接报错（如 "依据图纸确定"）。
    bad_summary: list[str] = []
    for c in NUMERIC_COLUMNS:
        if c in df.columns:
            df[c], n = sanitize_numeric_text(df[c])
            if n > 0:
                bad_summary.append(f"{c}:{n}")
    for c in INT_COLUMNS:
        if c in df.columns:
            df[c], n = sanitize_int_text(df[c])
            if n > 0:
                bad_summary.append(f"{c}:{n}")

    df, name_filled = fill_empty_name_for_rds(df)
    if name_filled > 0:
        bad_summary.append(f"name 空值已回填:{name_filled}")

    # DMS「写入 materials」多为 INSERT：不要带 Excel 行号等本地 id，否则会 duplicate key on materials_pkey。
    if "id" in df.columns:
        df = df.drop(columns=["id"])

    args.output.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"已写入 {len(df)} 行, {len(df.columns)} 列 -> {args.output.resolve()}")
    print("列名:", ", ".join(df.columns))
    if bad_summary:
        print("已清空非数值内容（避免 DMS numeric/int 报错）:", ", ".join(bad_summary))


if __name__ == "__main__":
    main()
