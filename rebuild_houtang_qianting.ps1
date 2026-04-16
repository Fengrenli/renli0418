# UTF-8 BOM (line starts with U+FEFF) — Windows PowerShell 5.1 needs this for Chinese in this file.
# Houtang: rebuild CSV/SQL + 按 DISPIMG/cellimages 抠图到 PIC/<FolderStem>（默认 前厅杂件；其它分类用 -FolderStem）。
# Close WPS/Excel before run.
#
#   .\rebuild_houtang_qianting.ps1
#   .\rebuild_houtang_qianting.ps1 -PreferBak
#   .\rebuild_houtang_qianting.ps1 -SkipCsvRebuild
#   .\rebuild_houtang_qianting.ps1 -SkipUseBakMerge
#   .\rebuild_houtang_qianting.ps1 -DryRunExtract
#   .\rebuild_houtang_qianting.ps1 -LegacyOpenpyxlExtract   # 仍用 openpyxl ws._images（DISPIMG 表几乎导不出）
#   .\rebuild_houtang_qianting.ps1 -PicNaming code_and_name # 输出 HW10-xxx_名称.ext（可读，OSS 仍建议用纯 code）
#   .\rebuild_houtang_qianting.ps1 -FolderStem 砖瓦          # 其它分类：与 CSV pic_folder、PIC 子目录、Excel 文件名一致
#   .\rebuild_houtang_qianting.ps1 -FolderStem 桌椅
# 默认：先 DISPIMG；若 cellimages 不可用 (exit 2) 则自动换另一 xlsx/bak 再试，仍失败则回退 openpyxl --match cell（与早期前厅杂件一致）。
#   .\rebuild_houtang_qianting.ps1 -NoAutoLegacyFallback   # 禁止自动回退，便于排查

param(
  [string]$ExcelDir = "C:\Users\Admin\Desktop\material\new\houtang\material-excel",
  [string]$PicDir = "C:\Users\Admin\Desktop\material\new\houtang\PIC",
  [string]$ProjectRoot = "E:\renli0418",
  # 与 materials_cleaned 的 pic_folder 一致；工作簿为「{FolderStem}.xlsx」或「{FolderStem}.bak_before_code.xlsx」
  [string]$FolderStem = "前厅杂件",
  [switch]$PreferBak,
  [switch]$SkipCsvRebuild,
  [switch]$SkipUseBakMerge,
  [switch]$DryRunExtract,
  [switch]$LegacyOpenpyxlExtract,
  [ValidateSet("code", "code_and_name")]
  [string]$PicNaming = "code",
  # 批量跑时若某分类没有对应 xlsx，跳过而非中断（与 -FolderStem 配合）
  [switch]$SkipMissingWorkbook,
  # DISPIMG 失败 (cellimages 缺失) 时不自动尝试另一工作簿 / openpyxl 回退
  [switch]$NoAutoLegacyFallback
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
$PicDir = (Resolve-Path -LiteralPath $PicDir).Path

$scriptsDir = Join-Path $ProjectRoot "scripts\material_code_dedupe"
$cleanedCsv = Join-Path $ProjectRoot "materials_cleaned_houtang.csv"
$extractPy = Join-Path $scriptsDir "extract_images_from_material_excel.py"
$dispimgPy = Join-Path $ProjectRoot "scripts\\extract_images.py"
$auditPy = Join-Path $scriptsDir "audit_excel_embedded_images.py"

if (-not (Test-Path -LiteralPath $dispimgPy)) { throw "Not found: $dispimgPy" }
if (-not (Test-Path -LiteralPath $extractPy)) { throw "Not found: $extractPy" }

Write-Host "== Houtang DISPIMG extract (folder: $FolderStem) ==" -ForegroundColor Cyan
Write-Host "ExcelDir: $ExcelDir"
Write-Host "PicDir:   $PicDir"
Write-Host "PreferBak: $PreferBak  SkipCsv: $SkipCsvRebuild"
Write-Host ""

if (-not $SkipCsvRebuild) {
  # Hashtable splat is required: array splat @(" -Name", value, ...) does NOT bind to script params (PS 5.1).
  $brSplat = @{
    BrandName   = "吼堂"
    OutputSlug  = "houtang"
    ExcelDir    = $ExcelDir
    PicDir      = $PicDir
    ProjectRoot = $ProjectRoot
    CleanMode   = "duplicates-only"
  }
  if (-not $SkipUseBakMerge) {
    $brSplat["UseBakIfPresent"] = $true
  }
  $brandScript = Join-Path $ProjectRoot "brand_rebuild.ps1"
  & $brandScript @brSplat
  if (-not (Test-Path -LiteralPath $cleanedCsv)) {
    throw "Cleaned CSV was not created: $cleanedCsv"
  }
}
else {
  if (-not (Test-Path -LiteralPath $cleanedCsv)) {
    throw "Missing $cleanedCsv (do not use -SkipCsvRebuild until file exists)"
  }
  Write-Host "[SKIP] brand_rebuild (-SkipCsvRebuild)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "== Resolve workbook for $FolderStem ==" -ForegroundColor Cyan
$wbMain = Join-Path $ExcelDir ($FolderStem + ".xlsx")
$wbBak = Join-Path $ExcelDir ($FolderStem + ".bak_before_code.xlsx")
$wbPick = $null
if ($PreferBak -and (Test-Path -LiteralPath $wbBak)) {
  $wbPick = $wbBak
}
elseif (Test-Path -LiteralPath $wbMain) {
  $wbPick = $wbMain
}
elseif (Test-Path -LiteralPath $wbBak) {
  $wbPick = $wbBak
}

if ($null -eq $wbPick -or -not (Test-Path -LiteralPath $wbPick)) {
  if ($SkipMissingWorkbook) {
    Write-Host "[SKIP] No workbook for folder: $FolderStem ($wbMain / $wbBak)" -ForegroundColor Yellow
    return
  }
  throw "No workbook found: $wbMain or $wbBak"
}
Write-Host "Using: $wbPick"

$picSub = Join-Path $PicDir $FolderStem

# 注意：若用「$x = Invoke-Func; return $LASTEXITCODE」，$x 会吞掉 Python 的 stdout 且破坏退出码判断，故只读全局 $LASTEXITCODE。
function Invoke-LegacyOpenpyxlExtract {
  param(
    [ValidateSet("cell", "hybrid", "position")]
    [string]$MatchMode = "cell"
  )
  Write-Host ""
  Write-Host "== Step 2 (legacy): openpyxl extract_images --match $MatchMode ==" -ForegroundColor Yellow
  $extArgs = @(
    $extractPy,
    "--excel-dir", $ExcelDir,
    "--mapping", $cleanedCsv,
    "--pic-root", $PicDir,
    "--match", $MatchMode,
    "--only-stem", $FolderStem
  )
  if ($PreferBak) { $extArgs += "--prefer-bak" }
  if ($DryRunExtract) { $extArgs += "--dry-run" }
  & python @extArgs
}

function Invoke-DispImgExtract([string]$WbPath) {
  Write-Host ""
  Write-Host "== Step 2: extract_images.py -> PIC ==" -ForegroundColor Cyan
  Write-Host "Workbook: $WbPath"
  $dArgs = @(
    $dispimgPy,
    "--workbook", $WbPath,
    "--pic-dir", $picSub,
    "--naming", $PicNaming,
    "--mapping", $cleanedCsv,
    "--excel-dir", $ExcelDir
  )
  if ($DryRunExtract) { $dArgs += "--dry-run" }
  & python @dArgs
}

if ($LegacyOpenpyxlExtract) {
  Invoke-LegacyOpenpyxlExtract -MatchMode "cell"
  $leg = $LASTEXITCODE
  if ($null -ne $leg -and $leg -ne 0) {
    throw "extract_images_from_material_excel.py failed, exit code: $leg"
  }
}
else {
  Invoke-DispImgExtract $wbPick
  $dispExit = $LASTEXITCODE

  $wbAlt = $null
  if ((Test-Path -LiteralPath $wbMain) -and (Test-Path -LiteralPath $wbBak)) {
    if ($wbPick.Equals($wbBak, [System.StringComparison]::OrdinalIgnoreCase)) {
      $wbAlt = $wbMain
    }
    else {
      $wbAlt = $wbBak
    }
  }

  if (-not $NoAutoLegacyFallback -and $dispExit -eq 2 -and $null -ne $wbAlt -and -not $wbPick.Equals($wbAlt, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "[WARN] DISPIMG/cellimages 在当前工作簿失败 (exit 2)，改用另一副本重试: $wbAlt" -ForegroundColor Yellow
    Invoke-DispImgExtract $wbAlt
    $dispExit = $LASTEXITCODE
  }

  if (-not $NoAutoLegacyFallback -and $dispExit -eq 2) {
    Write-Host "[WARN] DISPIMG 仍无法建立 cellimages 映射；回退 openpyxl --match hybrid（优先 excel_src_row=锚点行；无该列时请重跑 brand_rebuild 以写入行号，否则仍可能按 id 序兜底）。" -ForegroundColor Yellow
    Invoke-LegacyOpenpyxlExtract -MatchMode "hybrid"
    $leg = $LASTEXITCODE
    if ($null -ne $leg -and $leg -ne 0) {
      throw "extract_images_from_material_excel.py failed after DISPIMG fallback, exit code: $leg"
    }
  }
  elseif ($null -ne $dispExit -and $dispExit -ne 0) {
    throw "extract_wps_dispimg_to_pic.py failed, exit code: $dispExit"
  }
}

Write-Host ""
Write-Host "== Step 3: audit embedded images (optional) ==" -ForegroundColor Cyan

if ($null -ne $wbPick -and (Test-Path -LiteralPath $wbPick)) {
  & python $auditPy -w $wbPick --mapping $cleanedCsv 2>&1 | ForEach-Object { Write-Host $_ }
}
else {
  Write-Host "[WARN] Workbook not found for audit. Tried main and bak." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Verify PIC vs Excel, then upload and run image SQL." -ForegroundColor Green
