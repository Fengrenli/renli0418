# 长期方案：交换「砖瓦」下两块红砖图，使「文件名 = 编码 = OSS key」且内容与品名一致。
#   1) 关闭占用 PIC\砖瓦 的看图软件后执行本脚本 → 得到 XC59.png（标准）、X334.jpeg（预制）。
#   2) 在 OSS 删除旧对象 houtang/砖瓦/BR99-GYHG-XC59-001.jpeg 与 ...X334-001.png（若存在），再上传新两枚文件（同上路径）。
#   3) 数据库：执行 sql/patch_houtang_zhuanwa_redbrick_aligned.sql，或重跑 brand_rebuild.ps1 后执行整份 materials_image_update_houtang.sql。
# 背景：旧流程按 image1/image2 顺序赋码，与 DISPIMG 行错位。
#
#   .\scripts\swap_houtang_zhuanwa_red_brick_pic_files.ps1
#   .\scripts\swap_houtang_zhuanwa_red_brick_pic_files.ps1 -PicDir "D:\PIC" -Subfolder "砖瓦"

param(
  [string]$PicDir = "C:\Users\Admin\Desktop\material\new\houtang\PIC",
  [string]$Subfolder = "砖瓦"
)

$ErrorActionPreference = "Stop"
$dir = Join-Path (Resolve-Path -LiteralPath $PicDir).Path $Subfolder
if (-not (Test-Path -LiteralPath $dir)) { throw "Directory not found: $dir" }

$xc59Jpeg = Join-Path $dir "BR99-GYHG-XC59-001.jpeg"
$x334Png = Join-Path $dir "BR99-GYHG-X334-001.png"
$t1 = Join-Path $dir ".__swap_redbrick_1.tmp"
$t2 = Join-Path $dir ".__swap_redbrick_2.tmp"

if (-not (Test-Path -LiteralPath $xc59Jpeg)) { throw "Missing: $xc59Jpeg" }
if (-not (Test-Path -LiteralPath $x334Png)) { throw "Missing: $x334Png" }

# 目标：XC59 得到原 X334.png 的内容（细条切片）→ 保存为 XC59.png；X334 得到原 XC59.jpeg（堆叠）→ 保存为 X334.jpeg
if (Test-Path -LiteralPath $t1) { Remove-Item -LiteralPath $t1 -Force }
if (Test-Path -LiteralPath $t2) { Remove-Item -LiteralPath $t2 -Force }

Move-Item -LiteralPath $xc59Jpeg -Destination $t1
Move-Item -LiteralPath $x334Png -Destination (Join-Path $dir "BR99-GYHG-XC59-001.png")
Move-Item -LiteralPath $t1 -Destination (Join-Path $dir "BR99-GYHG-X334-001.jpeg")

Write-Host "OK: swapped to BR99-GYHG-XC59-001.png and BR99-GYHG-X334-001.jpeg under $dir" -ForegroundColor Green
Write-Host "Next: upload these two keys to OSS, then run brand_rebuild.ps1 to refresh sql/materials_image_update_houtang.sql" -ForegroundColor Cyan
