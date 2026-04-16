#Requires -Version 5.1
<#
  吼堂一条龙：合并/清洗/SQL +（可选）全部分类抠图。
  可从任意当前目录执行；内部会切换到项目根目录。

  用法：
    pwsh -File E:\renli0418\run_houtang_pipeline.ps1
    pwsh -File E:\renli0418\run_houtang_pipeline.ps1 -Step Merge      # 只跑 CSV/SQL
    pwsh -File E:\renli0418\run_houtang_pipeline.ps1 -Step Dispimg   # 只抠图（需已有 materials_cleaned_houtang.csv）
    pwsh -File E:\renli0418\run_houtang_pipeline.ps1 -ClearLocalPic  # 先清空 PIC 子目录内图片再全流程
    pwsh -File E:\renli0418\run_houtang_pipeline.ps1 -CleanMode all-rows   # 全表重算码（慎用）

  路径按你本机修改 -ExcelDir / -PicDir；不要用未赋值的 $ExcelDir。
  duplicates-only 若报「code 仍存在重复」，先打开 materials_excel_code_duplicates_houtang.csv 修 Excel 重复行，或改用 -CleanMode all-rows。
#>
param(
  [string]$ProjectRoot = "",
  [string]$ExcelDir = "C:\Users\Admin\Desktop\material\new\houtang\material-excel",
  [string]$PicDir = "C:\Users\Admin\Desktop\material\new\houtang\PIC",
  [ValidateSet("All", "Merge", "Dispimg")]
  [string]$Step = "All",
  [ValidateSet("duplicates-only", "all-rows")]
  [string]$CleanMode = "all-rows",
  [switch]$ClearLocalPic
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
}
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
$PicDir = (Resolve-Path -LiteralPath $PicDir).Path

Push-Location -LiteralPath $ProjectRoot
try {
  if ($ClearLocalPic) {
    if ($Step -ne "All") {
      throw "-ClearLocalPic 仅支持与 -Step All 同用（内部调用 rebuild_houtang_full.ps1）。"
    }
    & (Join-Path $ProjectRoot "rebuild_houtang_full.ps1") `
      -ExcelDir $ExcelDir -PicDir $PicDir -ProjectRoot $ProjectRoot -ClearLocalPic
    return
  }

  if ($Step -eq "All" -or $Step -eq "Merge") {
    $brSplat = @{
      BrandName       = "吼堂"
      OutputSlug      = "houtang"
      ExcelDir        = $ExcelDir
      PicDir          = $PicDir
      ProjectRoot     = $ProjectRoot
      CleanMode       = $CleanMode
      UseBakIfPresent = $true
    }
    try {
      & (Join-Path $ProjectRoot "brand_rebuild.ps1") @brSplat
    } catch {
      # duplicates-only 常见失败原因：整表 code 仍重复（需要全表重算）。这里自动回退到 all-rows，
      # 以确保「赋码 + 产物」能稳定落地。
      if ($CleanMode -eq "duplicates-only") {
        Write-Host "[WARN] duplicates-only 清洗失败，自动改用 all-rows 重试（全表赋码）。" -ForegroundColor Yellow
        $brSplat["CleanMode"] = "all-rows"
        & (Join-Path $ProjectRoot "brand_rebuild.ps1") @brSplat
      } else {
        throw
      }
    }
    if (-not $?) { throw "brand_rebuild.ps1 执行失败（`$? = $false）。" }
  }

  if ($Step -eq "All" -or $Step -eq "Dispimg") {
    $batch = Join-Path $ProjectRoot "rebuild_houtang_dispimg_batch.ps1"
    & $batch `
      -ExcelDir $ExcelDir `
      -PicDir $PicDir `
      -ProjectRoot $ProjectRoot `
      -DiscoverFromExcelDir `
      -SkipCsvRebuild `
      -SkipMissingWorkbook `
      -PreferBak
    if (-not $?) { throw "rebuild_houtang_dispimg_batch.ps1 执行失败（`$? = $false）。" }
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "OK: 本机步骤完成。后续: OSS 上传 -> materials_delete_houtang.sql -> DMS 导入 materials_cleaned_for_rds_houtang.csv -> bind + image SQL。" -ForegroundColor Green
