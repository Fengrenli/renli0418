# 吼堂「全流程」编排：可选清空本地 PIC → brand_rebuild（CSV + bind/image SQL）→ 按 DISPIMG 全部分类抠图。
# 图片输出与小龙坎一致：PIC/<pic_folder>/<code>.<ext>；brand_rebuild 生成 OSS URL = .../materials/houtang/<编码目录>/...
# DISPIMG 不可用时单分类会自动回退 openpyxl（与「前厅杂件」梳理办法一致），见 rebuild_houtang_qianting.ps1。
# 不包含：阿里云 OSS 删除/上传、RDS DMS 导入（需你在控制台操作）。
#
# 典型用法（路径按你本机改）：
#   cd E:\renli0418
#   .\rebuild_houtang_full.ps1 -ClearLocalPic
#
# 仅重跑合并与抠图（不删 PIC）：
#   .\rebuild_houtang_full.ps1
#
# 使用固定分类列表而非扫描 Excel 目录：
#   .\rebuild_houtang_full.ps1 -NoDiscoverFromExcelDir
#
# 关闭合并时使用 .bak 表：
#   .\rebuild_houtang_full.ps1 -NoUseBakIfPresent

param(
  [string]$ExcelDir = "C:\Users\Admin\Desktop\material\new\houtang\material-excel",
  [string]$PicDir = "C:\Users\Admin\Desktop\material\new\houtang\PIC",
  [string]$ProjectRoot = "E:\renli0418",
  [ValidateSet('all-rows', 'duplicates-only')]
  [string]$CleanMode = 'all-rows',
  # 合并 Excel 时优先纳入 *.bak_before_code.xlsx（默认开启；若加 -NoUseBakIfPresent 则关闭）
  [switch]$NoUseBakIfPresent,
  # 删除 PIC 下各子目录中的常见图片后缀（不动子目录本身）
  [switch]$ClearLocalPic,
  # 默认按 Excel 目录扫描 .xlsx 分类；若加 -NoDiscoverFromExcelDir 则改用脚本内固定列表
  [switch]$NoDiscoverFromExcelDir,
  [switch]$DryRunExtract,
  [switch]$PreferBak,
  [switch]$SkipUseBakMerge,
  [switch]$LegacyOpenpyxlExtract,
  [ValidateSet('code', 'code_and_name')]
  [string]$PicNaming = 'code',
  [switch]$NoAutoLegacyFallback
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
$PicDir = (Resolve-Path -LiteralPath $PicDir).Path

$brandScript = Join-Path $ProjectRoot 'brand_rebuild.ps1'
$batchScript = Join-Path $ProjectRoot 'rebuild_houtang_dispimg_batch.ps1'
$rdsCsv = Join-Path $ProjectRoot 'materials_cleaned_for_rds_houtang.csv'
$bindSql = Join-Path $ProjectRoot 'sql\materials_bind_brand_houtang.sql'
$imageSql = Join-Path $ProjectRoot 'sql\materials_image_update_houtang.sql'

if ($ClearLocalPic) {
  Write-Host '== Clear local PIC images (png/jpg/jpeg/webp/gif) under subfolders ==' -ForegroundColor Yellow
  if (-not (Test-Path -LiteralPath $PicDir)) {
    throw "PicDir not found: $PicDir"
  }
  $patterns = @('*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif')
  $script:picRemoved = 0
  foreach ($pat in $patterns) {
    Get-ChildItem -LiteralPath $PicDir -Filter $pat -File -ErrorAction SilentlyContinue | ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force
      $script:picRemoved++
    }
  }
  Get-ChildItem -LiteralPath $PicDir -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $sub = $_.FullName
    foreach ($pat in $patterns) {
      Get-ChildItem -LiteralPath $sub -Filter $pat -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
        $script:picRemoved++
      }
    }
  }
  Write-Host ("Removed {0} file(s)." -f $script:picRemoved) -ForegroundColor Green
}

Write-Host '== Step 1: brand_rebuild (merge / clean / rds csv / SQL) ==' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $brandScript)) { throw "Not found: $brandScript" }
$brSplat = @{
  BrandName   = '吼堂'
  OutputSlug  = 'houtang'
  ExcelDir    = $ExcelDir
  PicDir      = $PicDir
  ProjectRoot = $ProjectRoot
  CleanMode   = $CleanMode
}
if (-not $NoUseBakIfPresent) { $brSplat['UseBakIfPresent'] = $true }
& $brandScript @brSplat

Write-Host '== Step 2: DISPIMG extract (all workbooks) ==' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $batchScript)) { throw "Not found: $batchScript" }
$batchSplat = @{
  ExcelDir              = $ExcelDir
  PicDir                = $PicDir
  ProjectRoot           = $ProjectRoot
  SkipCsvRebuild        = $true
  SkipMissingWorkbook   = $true
  DryRunExtract         = $DryRunExtract
  PreferBak             = $PreferBak
  SkipUseBakMerge       = $SkipUseBakMerge
  LegacyOpenpyxlExtract = $LegacyOpenpyxlExtract
  PicNaming             = $PicNaming
}
if (-not $NoDiscoverFromExcelDir) { $batchSplat['DiscoverFromExcelDir'] = $true }
if ($NoAutoLegacyFallback) { $batchSplat['NoAutoLegacyFallback'] = $true }
& $batchScript @batchSplat

Write-Host ''
Write-Host '== 本地流水线已完成。接下来请按顺序做 OSS + 数据库 ==' -ForegroundColor Green
Write-Host ''
Write-Host '【OSS】清空 houtang 下旧图（示例，需已配置 ossutil；bucket/路径以你控制台为准）：' -ForegroundColor White
Write-Host '  ossutil rm oss://renli2026/materials/houtang/ -r -f' -ForegroundColor DarkGray
$picPosix = $PicDir -replace '\\', '/'
Write-Host ("  ossutil cp -r `"{0}`" oss://renli2026/materials/houtang/ -u" -f $picPosix) -ForegroundColor DarkGray
Write-Host '（若前缀是 materials/houtang 映射到 bucket 子目录，请按实际调整）' -ForegroundColor DarkGray
Write-Host ''
Write-Host '【RDS】全量重导吼堂物料：' -ForegroundColor White
Write-Host '  1) 执行 sql/materials_delete_houtang.sql（或仅清图：sql/materials_clear_images_houtang.sql）' -ForegroundColor DarkGray
Write-Host '  2) DMS 导入（INSERT）：' -ForegroundColor DarkGray
Write-Host ('     {0}' -f $rdsCsv) -ForegroundColor DarkGray
Write-Host '  3) 绑定品牌 + 图片 URL（本机有 DB 时可）：' -ForegroundColor DarkGray
Write-Host ('     node scripts/run_brand_sql_bundle.mjs 吼堂 "{0}" "{1}"' -f $bindSql, $imageSql) -ForegroundColor DarkGray
Write-Host '     或在控制台依次执行 sql/materials_bind_brand_houtang.sql 与 sql/materials_image_update_houtang.sql' -ForegroundColor DarkGray
Write-Host ''
Write-Host '验收：sql/materials_verify_houtang.sql' -ForegroundColor White
