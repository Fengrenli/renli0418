# 对多个 pic_folder 依次执行 DISPIMG 抠图（与 rebuild_houtang_qianting.ps1 相同逻辑，仅批量 FolderStem）。
# 首次全量建议先跑一次不带 -SkipCsvRebuild 的 brand_rebuild；批量抠图时用 -SkipCsvRebuild 省时间。
#
#   .\rebuild_houtang_dispimg_batch.ps1
#   .\rebuild_houtang_dispimg_batch.ps1 -FolderStems @('砖瓦','桌椅','工程灯具')
#   .\rebuild_houtang_dispimg_batch.ps1 -SkipCsvRebuild
#   .\rebuild_houtang_dispimg_batch.ps1 -DiscoverFromExcelDir -SkipMissingWorkbook

param(
  [string]$ExcelDir = "C:\Users\Admin\Desktop\material\new\houtang\material-excel",
  [string]$PicDir = "C:\Users\Admin\Desktop\material\new\houtang\PIC",
  [string]$ProjectRoot = "E:\renli0418",
  [string[]]$FolderStems = @(
    '前厅杂件', '五金杂件', '工程灯具', '厨房设备', '灯笼', '玻璃钢', '桌椅', '不锈钢', '石材',
    '瓷砖', '古建木结构', '砖瓦', '窗帘', '花灯', '调料台', '金属隔断', '软装', '定制柜体', '锅具'
  ),
  [switch]$DiscoverFromExcelDir,
  [switch]$SkipMissingWorkbook,
  [switch]$NoAutoLegacyFallback,
  [switch]$PreferBak,
  [switch]$SkipCsvRebuild,
  [switch]$SkipUseBakMerge,
  [switch]$DryRunExtract,
  [switch]$LegacyOpenpyxlExtract,
  [ValidateSet("code", "code_and_name")]
  [string]$PicNaming = "code"
)

$ErrorActionPreference = "Stop"
$single = Join-Path $ProjectRoot "rebuild_houtang_qianting.ps1"
if (-not (Test-Path -LiteralPath $single)) { throw "Not found: $single" }

function Get-WorkbookFolderStems([string]$Dir) {
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  Get-ChildItem -LiteralPath $Dir -Filter '*.xlsx' -File | ForEach-Object {
    $n = $_.Name
    if ($n -like '~$*') { return }
    if ($n -match '(?i)\.bak_before_code\.xlsx$') {
      $stem = $n -replace '(?i)\.bak_before_code\.xlsx$', ''
      if (-not [string]::IsNullOrWhiteSpace($stem)) { [void]$set.Add($stem) }
    }
    elseif ($n -match '(?i)\.xlsx$') {
      $stem = $n -replace '(?i)\.xlsx$', ''
      if (-not [string]::IsNullOrWhiteSpace($stem)) { [void]$set.Add($stem) }
    }
  }
  return @($set | Sort-Object)
}

if ($DiscoverFromExcelDir) {
  $ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
  $FolderStems = @(Get-WorkbookFolderStems $ExcelDir)
  Write-Host ("Discovered {0} workbook stem(s): {1}" -f $FolderStems.Count, ($FolderStems -join ', ')) -ForegroundColor Cyan
  if ($FolderStems.Count -eq 0) {
    throw "DiscoverFromExcelDir: no .xlsx found under $ExcelDir"
  }
}

$first = $true
foreach ($stem in $FolderStems) {
  if ([string]::IsNullOrWhiteSpace($stem)) { continue }
  Write-Host "`n========== FolderStem: $stem ==========" -ForegroundColor Magenta
  $splat = @{
    ExcelDir              = $ExcelDir
    PicDir                = $PicDir
    ProjectRoot           = $ProjectRoot
    FolderStem            = $stem
    PreferBak             = $PreferBak
    SkipUseBakMerge       = $SkipUseBakMerge
    DryRunExtract         = $DryRunExtract
    LegacyOpenpyxlExtract = $LegacyOpenpyxlExtract
    PicNaming             = $PicNaming
  }
  if ($SkipMissingWorkbook) { $splat['SkipMissingWorkbook'] = $true }
  if ($NoAutoLegacyFallback) { $splat['NoAutoLegacyFallback'] = $true }
  # 仅第一个分类跑 brand_rebuild；其余只抠图（除非全程 -SkipCsvRebuild）
  if ($first) {
    if ($SkipCsvRebuild) { $splat['SkipCsvRebuild'] = $true }
    $first = $false
  }
  else {
    $splat['SkipCsvRebuild'] = $true
  }
  & $single @splat
}

Write-Host "`nBatch done. Upload PIC to OSS and run brand_rebuild image SQL as needed." -ForegroundColor Green
