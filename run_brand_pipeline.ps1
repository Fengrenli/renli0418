#Requires -Version 5.1
<#
  Generic one-click brand pipeline:
  1) rebuild CSV/code via brand_rebuild.ps1
  2) extract images for all workbook stems via scripts/extract_images.py
  3) generate existing-only / missing-only image SQL (brand_id condition)

  Usage example:
    pwsh -File E:\renli0418\run_brand_pipeline.ps1 `
      -BrandName "新品牌" `
      -OutputSlug "newbrand" `
      -ExcelDir "C:\Users\Admin\Desktop\material\new\newbrand\material-excel" `
      -PicDir "C:\Users\Admin\Desktop\material\new\newbrand\PIC"
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$BrandName,
  [Parameter(Mandatory = $true)]
  [string]$OutputSlug,
  [Parameter(Mandatory = $true)]
  [string]$ExcelDir,
  [Parameter(Mandatory = $true)]
  [string]$PicDir,
  [string]$ProjectRoot = "",
  [ValidateSet("All", "Merge", "Extract", "Sql")]
  [string]$Step = "All",
  [ValidateSet("duplicates-only", "all-rows")]
  [string]$CleanMode = "all-rows",
  [switch]$PreferBak,
  [switch]$ClearLocalPic,
  [switch]$InjectWorkbookCodes
)

$ErrorActionPreference = "Stop"

function Assert-PythonStep {
  param([string]$StepName)
  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "[$StepName] python exit code: $LASTEXITCODE"
  }
}

function SqlQuote {
  param([string]$Text)
  return "'" + $Text.Replace("'", "''") + "'"
}

function Get-WorkbookFolderStems {
  param([string]$Dir)
  $set = New-Object 'System.Collections.Generic.HashSet[string]'
  if (-not (Test-Path -LiteralPath $Dir)) { return @() }
  Get-ChildItem -LiteralPath $Dir -Filter '*.xlsx' -File | ForEach-Object {
    $n = $_.Name
    if ($n -like '~$*') { return }
    if ($n -match '(?i)\.bak_before_code\.xlsx$') {
      $stem = $n -replace '(?i)\.bak_before_code\.xlsx$', ''
      if (-not [string]::IsNullOrWhiteSpace($stem)) { [void]$set.Add($stem) }
      return
    }
    $stem2 = $n -replace '(?i)\.xlsx$', ''
    if (-not [string]::IsNullOrWhiteSpace($stem2)) { [void]$set.Add($stem2) }
  }
  return @($set | Sort-Object)
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
$PicDir = (Resolve-Path -LiteralPath $PicDir).Path

$cleanedCsv = Join-Path $ProjectRoot ("materials_cleaned_{0}.csv" -f $OutputSlug)
$sqlDir = Join-Path $ProjectRoot "sql"
if (-not (Test-Path -LiteralPath $sqlDir)) { New-Item -ItemType Directory -Path $sqlDir | Out-Null }
$existingSql = Join-Path $sqlDir ("materials_image_update_{0}_existing_only.sql" -f $OutputSlug)
$missingSql = Join-Path $sqlDir ("materials_image_update_{0}_missing_only.sql" -f $OutputSlug)

Push-Location -LiteralPath $ProjectRoot
try {
  if ($ClearLocalPic) {
    Write-Host "Clearing local PIC images..." -ForegroundColor Yellow
    $exts = @("*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif", "*.bmp", "*.tif", "*.tiff")
    foreach ($ext in $exts) {
      Get-ChildItem -LiteralPath $PicDir -Recurse -File -Filter $ext -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    }
  }

  if ($Step -eq "All" -or $Step -eq "Merge") {
    $br = Join-Path $ProjectRoot "brand_rebuild.ps1"
    $brSplat = @{
      BrandName       = $BrandName
      OutputSlug      = $OutputSlug
      ExcelDir        = $ExcelDir
      PicDir          = $PicDir
      ProjectRoot     = $ProjectRoot
      CleanMode       = $CleanMode
      UseBakIfPresent = $true
    }
    & $br @brSplat
    if (-not (Test-Path -LiteralPath $cleanedCsv)) {
      throw "cleaned csv missing: $cleanedCsv"
    }
  }

  if ($Step -eq "All" -or $Step -eq "Extract") {
    if (-not (Test-Path -LiteralPath $cleanedCsv)) {
      throw "cleaned csv missing (run Merge first): $cleanedCsv"
    }
    $extractEntry = Join-Path $ProjectRoot "scripts\extract_images.py"
    if (-not (Test-Path -LiteralPath $extractEntry)) { throw "not found: $extractEntry" }

    $stems = Get-WorkbookFolderStems -Dir $ExcelDir
    if ($stems.Count -eq 0) { throw "no workbook stems found in: $ExcelDir" }

    foreach ($stem in $stems) {
      $wbMain = Join-Path $ExcelDir ($stem + ".xlsx")
      $wbBak = Join-Path $ExcelDir ($stem + ".bak_before_code.xlsx")
      $wbPick = $null
      if ($PreferBak -and (Test-Path -LiteralPath $wbBak)) { $wbPick = $wbBak }
      elseif (Test-Path -LiteralPath $wbMain) { $wbPick = $wbMain }
      elseif (Test-Path -LiteralPath $wbBak) { $wbPick = $wbBak }
      if ($null -eq $wbPick) {
        Write-Host "[SKIP] workbook not found for stem: $stem" -ForegroundColor Yellow
        continue
      }

      $picSub = Join-Path $PicDir $stem
      if (-not (Test-Path -LiteralPath $picSub)) { New-Item -ItemType Directory -Path $picSub | Out-Null }

      Write-Host ("Extracting: {0}" -f $stem) -ForegroundColor Cyan
      $args = @(
        $extractEntry,
        "--workbook", $wbPick,
        "--pic-dir", $picSub,
        "--naming", "code",
        "--mapping", $cleanedCsv,
        "--excel-dir", $ExcelDir
      )
      if ($PreferBak) { $args += "--prefer-bak" }
      & python @args
      Assert-PythonStep -StepName ("extract_images.py ({0})" -f $stem)
    }
  }

  if ($Step -eq "All" -or $Step -eq "Sql") {
    if (-not (Test-Path -LiteralPath $cleanedCsv)) {
      throw "cleaned csv missing (run Merge first): $cleanedCsv"
    }

    $rows = Import-Csv -LiteralPath $cleanedCsv
    $extRank = @{
      ".png" = 1; ".jpg" = 2; ".jpeg" = 3; ".webp" = 4; ".gif" = 5; ".bmp" = 6; ".tif" = 7; ".tiff" = 8
    }
    $codeRegex = '^[A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+-\d{3,4}$'
    $localMap = @{}
    Get-ChildItem -LiteralPath $PicDir -Directory | ForEach-Object {
      $folder = $_.Name
      Get-ChildItem -LiteralPath $_.FullName -File -ErrorAction SilentlyContinue | ForEach-Object {
        $ext = $_.Extension.ToLowerInvariant()
        if (-not $extRank.ContainsKey($ext)) { return }
        $stem = $_.BaseName.Trim()
        if ($stem -notmatch $codeRegex) { return }
        $k = $folder + "|" + $stem
        if (-not $localMap.ContainsKey($k)) {
          $localMap[$k] = $ext
        } else {
          $old = $localMap[$k]
          if ($extRank[$ext] -lt $extRank[$old]) { $localMap[$k] = $ext }
        }
      }
    }

    $items = @{}
    foreach ($r in $rows) {
      $code = [string]$r.code
      $name = [string]$r.name
      $folder = [string]$r.pic_folder
      if ([string]::IsNullOrWhiteSpace($code) -or [string]::IsNullOrWhiteSpace($folder)) { continue }
      $k = $folder + "|" + $code
      if (-not $items.ContainsKey($k)) { $items[$k] = $name }
    }

    # Robustness: if some workbook categories were skipped in merge/clean,
    # inject code/name from workbook itself so SQL output still includes them.
    if ($InjectWorkbookCodes -or $true) {
      $tmpIndex = Join-Path $ProjectRoot ".tmp_workbook_code_index.csv"
      $py = @"
from openpyxl import load_workbook
from pathlib import Path
import csv

excel_dir = Path(r'''$ExcelDir''')
out_csv = Path(r'''$tmpIndex''')
rows = []
for p in excel_dir.glob('*.xlsx'):
    n = p.name
    if n.startswith('~$'):
        continue
    stem = n
    if stem.lower().endswith('.bak_before_code.xlsx'):
        stem = stem[:-len('.bak_before_code.xlsx')]
    elif stem.lower().endswith('.xlsx'):
        stem = stem[:-len('.xlsx')]
    try:
        wb = load_workbook(p, data_only=False, read_only=True)
        ws = wb.active
        headers = []
        for c in range(1, ws.max_column + 1):
            v = ws.cell(1, c).value
            headers.append(str(v).strip().lower() if v is not None else '')
        code_col = headers.index('code') + 1 if 'code' in headers else None
        name_col = headers.index('name') + 1 if 'name' in headers else None
        if not code_col or not name_col:
            continue
        for r in range(2, ws.max_row + 1):
            name = ws.cell(r, name_col).value
            if name is None or str(name).strip() == '':
                continue
            code = ws.cell(r, code_col).value
            code = '' if code is None else str(code).strip()
            if not code:
                continue
            rows.append((stem, code, str(name).strip()))
    except Exception:
        continue

out_csv.parent.mkdir(parents=True, exist_ok=True)
with out_csv.open('w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['pic_folder', 'code', 'name'])
    w.writerows(rows)
print(len(rows))
"@
      & python -c $py | Out-Null
      Assert-PythonStep -StepName "workbook-code-index"
      if (Test-Path -LiteralPath $tmpIndex) {
        $wbRows = Import-Csv -LiteralPath $tmpIndex
        foreach ($wr in $wbRows) {
          $folder = [string]$wr.pic_folder
          $code = [string]$wr.code
          $name = [string]$wr.name
          if ([string]::IsNullOrWhiteSpace($folder) -or [string]::IsNullOrWhiteSpace($code)) { continue }
          $k = $folder + "|" + $code
          if ($localMap.ContainsKey($k) -and -not $items.ContainsKey($k)) { $items[$k] = $name }
        }
      }
    }

    $brandQ = SqlQuote $BrandName
    $existingLines = New-Object System.Collections.ArrayList
    [void]$existingLines.Add('-- Generated existing-only image SQL')
    [void]$existingLines.Add('BEGIN;')
    [void]$existingLines.Add('')

    $missingLines = New-Object System.Collections.ArrayList
    [void]$missingLines.Add('-- Generated missing-only image SQL')
    [void]$missingLines.Add('BEGIN;')
    [void]$missingLines.Add('')

    $ossBase = "https://renli2026.oss-cn-chengdu.aliyuncs.com/materials/$OutputSlug"
    $existingN = 0
    $missingN = 0
    foreach ($k in ($items.Keys | Sort-Object)) {
      $parts = $k.Split("|")
      $folder = $parts[0]
      $code = $parts[1]
      $name = [string]$items[$k]
      if ($localMap.ContainsKey($k)) {
        $ext = $localMap[$k]
        $filename = $code + $ext
        $url = $ossBase + "/" + [System.Uri]::EscapeDataString($folder) + "/" + [System.Uri]::EscapeDataString($filename)
        [void]$existingLines.Add("UPDATE materials")
        [void]$existingLines.Add(("SET image = {0}, pic_folder = {1}, image_filename = {2}" -f (SqlQuote $url), (SqlQuote $folder), (SqlQuote $filename)))
        [void]$existingLines.Add(("WHERE restaurant_brand_id = (SELECT id FROM brands WHERE name = {0} LIMIT 1) AND code = {1};" -f $brandQ, (SqlQuote $code)))
        [void]$existingLines.Add("")
        $existingN++
      } else {
        [void]$missingLines.Add(("-- MISSING: pic_folder={0}, code={1}, name={2}" -f $folder, $code, $name))
        $missingN++
      }
    }

    [void]$existingLines.Add('COMMIT;')
    [void]$missingLines.Add('')
    [void]$missingLines.Add('COMMIT;')
    Set-Content -LiteralPath $existingSql -Value ([string]::Join("`r`n", [string[]]$existingLines)) -Encoding UTF8
    Set-Content -LiteralPath $missingSql -Value ([string]::Join("`r`n", [string[]]$missingLines)) -Encoding UTF8

    Write-Host ("existing_only: {0} (rows={1})" -f $existingSql, $existingN) -ForegroundColor Green
    Write-Host ("missing_only : {0} (rows={1})" -f $missingSql, $missingN) -ForegroundColor Yellow
  }
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Next: upload PIC to OSS, then run existing_only SQL in DMS." -ForegroundColor Green
