#!/usr/bin/env bash
set -euo pipefail
PIC="E:/renli0418/public/assets/PIC"
renamed=0
echo "=== PIC 重命名开始 ==="
echo "根目录: $PIC"
if [ ! -d "$PIC" ]; then echo "错误: 根目录不存在，请修改脚本内 PIC= 路径"; exit 1; fi
# nested: 源可能在 category 旧目录或目标目录，新码落在 pic_destination（见 category_pic_folder_map.json）
for _ext in png jpg jpeg webp; do
  _dst="$PIC/前厅杂件/HW10-GYHG-X065-001.$_ext"
  if [ -f "$PIC/前厅杂件/HW10-GYHG-ISYH-001.$_ext" ]; then
    if [ -f "$_dst" ]; then echo "  [跳过] 目标已存在: $_dst"
    else
      mv -n "$PIC/前厅杂件/HW10-GYHG-ISYH-001.$_ext" "$_dst"
      echo "  [OK] $PIC/前厅杂件/HW10-GYHG-ISYH-001.$_ext -> $_dst"
      renamed=$((renamed + 1))
    fi
  elif [ -f "$PIC/五金杂件/HW10-GYHG-ISYH-001.$_ext" ]; then
    if [ -f "$_dst" ]; then echo "  [跳过] 目标已存在: $_dst"
    else
      mv -n "$PIC/五金杂件/HW10-GYHG-ISYH-001.$_ext" "$_dst"
      echo "  [OK] $PIC/五金杂件/HW10-GYHG-ISYH-001.$_ext -> $_dst"
      renamed=$((renamed + 1))
    fi
  fi
done
for _ext in png jpg jpeg webp; do
  _dst="$PIC/前厅杂件/HW10-GYHG-X222-001.$_ext"
  if [ -f "$PIC/前厅杂件/HW10-GYHG-ISIV-001.$_ext" ]; then
    if [ -f "$_dst" ]; then echo "  [跳过] 目标已存在: $_dst"
    else
      mv -n "$PIC/前厅杂件/HW10-GYHG-ISIV-001.$_ext" "$_dst"
      echo "  [OK] $PIC/前厅杂件/HW10-GYHG-ISIV-001.$_ext -> $_dst"
      renamed=$((renamed + 1))
    fi
  elif [ -f "$PIC/五金杂件/HW10-GYHG-ISIV-001.$_ext" ]; then
    if [ -f "$_dst" ]; then echo "  [跳过] 目标已存在: $_dst"
    else
      mv -n "$PIC/五金杂件/HW10-GYHG-ISIV-001.$_ext" "$_dst"
      echo "  [OK] $PIC/五金杂件/HW10-GYHG-ISIV-001.$_ext -> $_dst"
      renamed=$((renamed + 1))
    fi
  fi
done
echo "=== 结束: 成功重命名 $renamed 个文件 ==="
if [ "$renamed" -eq 0 ]; then
  echo "未重命名任何文件。请检查: 1) PIC 路径是否正确 2) 子文件夹名是否与 CSV/category 一致（见 category_pic_folder_map.json）"
  echo "3) 源文件名是否为 旧编码.png 4) 调试可加: bash -x 本脚本路径"
fi
