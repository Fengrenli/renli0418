#!/usr/bin/env python3
"""根据 materials_cleaned.csv 中的 code / code_before_cleanup 刷新 image_filename 与 OSS image URL 文件名段。"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlparse, urlunparse

import pandas as pd


def swap_url_filename(url: str, old_code: str, new_code: str) -> str:
    s = (url or "").strip()
    if not s.startswith("http"):
        return s
    u = urlparse(s)
    path = unquote(u.path)
    if not path:
        return s

    def repl(m: re.Match[str]) -> str:
        return f"{new_code}.{m.group(1)}"

    path2, n = re.subn(
        re.escape(old_code) + r"\.(png|jpe?g|webp)$",
        repl,
        path,
        count=1,
        flags=re.I,
    )
    if n == 0:
        path2, n = re.subn(
            r"/([^/]+)\.(png|jpe?g|webp)$",
            lambda m: f"/{new_code}.{m.group(2)}",
            path,
            count=1,
            flags=re.I,
        )
    if n == 0:
        return s

    segs = [x for x in path2.split("/") if x]
    enc = "/" + "/".join(quote(unquote(x), safe="") for x in segs)
    return urlunparse((u.scheme, u.netloc, enc, u.params, u.query, u.fragment))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input_csv", type=Path, help="materials_cleaned.csv")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()
    df = pd.read_csv(args.input_csv, dtype=str, keep_default_na=False)
    if "code" not in df.columns or "code_before_cleanup" not in df.columns:
        sys.exit("需要列 code 与 code_before_cleanup")

    out = df.copy()
    for i in out.index:
        row = out.loc[i]
        new_c = str(row["code"]).strip()
        old_c = str(row["code_before_cleanup"]).strip()
        fn = str(row.get("image_filename") or "")
        if fn and old_c:
            fn2, n = re.subn(
                re.escape(old_c) + r"\.(png|jpe?g|webp)$",
                f"{new_c}.\\1",
                fn,
                count=1,
                flags=re.I,
            )
            fn = fn2 if n else f"{new_c}.png"
        else:
            fn = f"{new_c}.png"
        img = swap_url_filename(str(row.get("image") or ""), old_c, new_c)
        out.at[i, "image_filename"] = fn
        out.at[i, "image"] = img
    out.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"Wrote {args.output.resolve()}")


if __name__ == "__main__":
    main()
