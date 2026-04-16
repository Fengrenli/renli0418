param(
  [Parameter(Mandatory = $true)]
  [string]$BrandName,
  [Parameter(Mandatory = $true)]
  [string]$ExcelDir,
  [Parameter(Mandatory = $true)]
  [string]$PicDir,
  [string]$ProjectRoot = "",
  [string]$OutputSlug = "",
  [switch]$RunDb,
  [switch]$UseBakIfPresent,
  # all-rows：按分段规则整表重算 code（会覆盖 Excel 里手填的码）。
  # duplicates-only：保留合并 CSV 中的 code，仅对「重复码」行换新码（适合已在表里对齐好的最终码）。
  [ValidateSet("all-rows", "duplicates-only")]
  [string]$CleanMode = "all-rows"
)

$ErrorActionPreference = "Stop"

function Get-BrandSlug {
  param([string]$Name)
  $n = $Name.Trim()
  if ([string]::IsNullOrWhiteSpace($n)) { return 'brand' }
  $parts = New-Object System.Collections.ArrayList
  foreach ($ch in $n.ToCharArray()) {
    $u = [int][char]$ch
    $isAscii = ($ch -ge 'a' -and $ch -le 'z') -or ($ch -ge 'A' -and $ch -le 'Z') -or ($ch -ge '0' -and $ch -le '9')
    $isCjk = ($u -ge 0x4E00 -and $u -le 0x9FFF)
    if ($isAscii -or $isCjk) {
      [void]$parts.Add([string]$ch)
    } else {
      [void]$parts.Add('_')
    }
  }
  $s = (-join $parts) -replace '_+', '_'
  $s = $s.Trim('_').ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($s)) { return 'brand' }
  return $s
}

function SqlQuote {
  param([string]$Text)
  return "'" + $Text.Replace("'", "''") + "'"
}

function Detect-ImageExt {
  param([string]$PicRoot, [string]$Folder, [string]$Code)
  $exts = @('.png', '.jpg', '.jpeg', '.webp', '.gif')
  foreach ($ext in $exts) {
    $p = Join-Path (Join-Path $PicRoot $Folder) ($Code + $ext)
    if (Test-Path -LiteralPath $p) { return $ext }
  }
  return '.png'
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ExcelDir = (Resolve-Path -LiteralPath $ExcelDir).Path
$PicDir = (Resolve-Path -LiteralPath $PicDir).Path

if (-not (Test-Path -LiteralPath $ExcelDir)) { throw "ExcelDir not found: $ExcelDir" }
if (-not (Test-Path -LiteralPath $PicDir)) { throw "PicDir not found: $PicDir" }

if (-not [string]::IsNullOrWhiteSpace($OutputSlug)) {
  $slug = Get-BrandSlug $OutputSlug
} else {
  $slug = Get-BrandSlug $BrandName
}

function Assert-PythonStep {
  param([string]$StepName)
  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
    throw "[$StepName] Python 退出码 $LASTEXITCODE（请向上滚动查看报错）。合并/清洗失败时不要使用旧的 materials_cleaned CSV。"
  }
}

$scriptsDir = Join-Path $ProjectRoot 'scripts\material_code_dedupe'
$sqlDir = Join-Path $ProjectRoot 'sql'
if (-not (Test-Path -LiteralPath $sqlDir)) { New-Item -ItemType Directory -Path $sqlDir | Out-Null }

$mergedCsv = Join-Path $ProjectRoot ("materials_raw_from_excel_merged_{0}.csv" -f $slug)
$cleanedCsv = Join-Path $ProjectRoot ("materials_cleaned_{0}.csv" -f $slug)
$rdsCsv = Join-Path $ProjectRoot ("materials_cleaned_for_rds_{0}.csv" -f $slug)
$mapCsv = Join-Path $ProjectRoot ("code_mapping_{0}.csv" -f $slug)
$renameSh = Join-Path $ProjectRoot ("rename_pic_local_{0}.sh" -f $slug)
$dupReport = Join-Path $ProjectRoot ("materials_excel_code_duplicates_{0}.csv" -f $slug)
$skipReport = Join-Path $ProjectRoot ("materials_excel_skipped_{0}.csv" -f $slug)
$bindSql = Join-Path $sqlDir ("materials_bind_brand_{0}.sql" -f $slug)
$imageSql = Join-Path $sqlDir ("materials_image_update_{0}.sql" -f $slug)
$verifySql = Join-Path $sqlDir ("materials_verify_{0}.sql" -f $slug)

Write-Host '== Brand Rebuild ==' -ForegroundColor Cyan
Write-Host ("BrandName   : {0}" -f $BrandName)
Write-Host ("BrandSlug   : {0}" -f $slug)
Write-Host ("ProjectRoot : {0}" -f $ProjectRoot)
Write-Host ("ExcelDir    : {0}" -f $ExcelDir)
Write-Host ("PicDir      : {0}" -f $PicDir)
Write-Host ("CleanMode   : {0}" -f $CleanMode)
Write-Host ''

$mergeArgs = @(
  (Join-Path $scriptsDir 'merge_material_excel_folder.py'),
  $ExcelDir,
  '-o', $mergedCsv,
  '--dup-report', $dupReport,
  '--skip-invalid-sheets',
  '--skipped-report', $skipReport
)
if ($UseBakIfPresent) { $mergeArgs += '--use-bak-if-present' }
& python @mergeArgs
Assert-PythonStep -StepName 'merge_material_excel_folder.py'
& python (Join-Path $scriptsDir 'clean_material_codes.py') $mergedCsv --mode $CleanMode -o $cleanedCsv -m $mapCsv --shell-commands $renameSh
Assert-PythonStep -StepName 'clean_material_codes.py'

# Step: 将新码写回 Excel 的 code 列（为后续按行抠图/审计做准备）
$writeBack = Join-Path $scriptsDir 'write_codes_back_to_material_excel.py'
if (-not (Test-Path -LiteralPath $writeBack)) { throw "Not found: $writeBack" }
& python $writeBack --excel-dir $ExcelDir --mapping $cleanedCsv --match position --rewrite-local-serial
Assert-PythonStep -StepName 'write_codes_back_to_material_excel.py'

& python (Join-Path $scriptsDir 'materials_csv_strip_for_rds.py') -i $cleanedCsv -o $rdsCsv
Assert-PythonStep -StepName 'materials_csv_strip_for_rds.py'

$rows = Import-Csv -LiteralPath $cleanedCsv
$codes = @($rows | ForEach-Object { $_.code } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
if ($codes.Count -eq 0) { throw 'No valid code found in cleaned csv.' }

$brandQ = SqlQuote $BrandName
$valueRowList = New-Object System.Collections.ArrayList
foreach ($c in $codes) { [void]$valueRowList.Add("(" + (SqlQuote $c) + ")") }
$valueRows = [string]::Join(",`r`n  ", [string[]]$valueRowList)

$bindContent = @"
-- Generated by brand_rebuild.ps1
-- Brand: $BrandName

BEGIN;

WITH target_brand AS (
  SELECT id AS brand_id
  FROM brands
  WHERE name = $brandQ
  LIMIT 1
),
codes(code) AS (
  VALUES
  $valueRows
),
ranked_unbound AS (
  SELECT
    m.id,
    m.code,
    ROW_NUMBER() OVER (PARTITION BY m.code ORDER BY m.id DESC) AS rn
  FROM materials m
  JOIN codes c ON c.code = m.code
  WHERE m.restaurant_brand_id IS NULL
)
DELETE FROM materials m
USING ranked_unbound r
WHERE m.id = r.id
  AND r.rn > 1;

WITH target_brand AS (
  SELECT id AS brand_id
  FROM brands
  WHERE name = $brandQ
  LIMIT 1
),
codes(code) AS (
  VALUES
  $valueRows
)
DELETE FROM materials m
USING target_brand tb, codes c
WHERE m.code = c.code
  AND m.restaurant_brand_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM materials x
    WHERE x.code = m.code
      AND x.restaurant_brand_id = tb.brand_id
  );

WITH target_brand AS (
  SELECT id AS brand_id
  FROM brands
  WHERE name = $brandQ
  LIMIT 1
),
codes(code) AS (
  VALUES
  $valueRows
)
UPDATE materials m
SET restaurant_brand_id = tb.brand_id
FROM target_brand tb
JOIN codes c ON TRUE
WHERE c.code = m.code
  AND m.restaurant_brand_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM materials x
    WHERE x.code = m.code
      AND x.restaurant_brand_id = tb.brand_id
  );

COMMIT;
"@
Set-Content -LiteralPath $bindSql -Value $bindContent -Encoding UTF8

$ossBase = 'https://renli2026.oss-cn-chengdu.aliyuncs.com/materials'
$imageLines = New-Object System.Collections.ArrayList
[void]$imageLines.Add('-- Generated by brand_rebuild.ps1')
[void]$imageLines.Add('-- Brand: ' + $BrandName)
[void]$imageLines.Add('BEGIN;')
[void]$imageLines.Add('')

foreach ($r in $rows) {
  $code = [string]$r.code
  $folder = [string]$r.pic_folder
  if ([string]::IsNullOrWhiteSpace($code) -or [string]::IsNullOrWhiteSpace($folder)) { continue }
  $ext = Detect-ImageExt -PicRoot $PicDir -Folder $folder -Code $code
  $fileName = $code + $ext
  $url = $ossBase + '/' + [System.Uri]::EscapeDataString($slug) + '/' + [System.Uri]::EscapeDataString($folder) + '/' + [System.Uri]::EscapeDataString($fileName)
  $line = 'UPDATE materials m SET pic_folder = ' + (SqlQuote $folder) + ', image = ' + (SqlQuote $url) +
    ' WHERE m.code = ' + (SqlQuote $code) +
    ' AND m.restaurant_brand_id = (SELECT id FROM brands WHERE name = ' + $brandQ + ' LIMIT 1);'
  [void]$imageLines.Add($line)
}

[void]$imageLines.Add('')
[void]$imageLines.Add('COMMIT;')
Set-Content -LiteralPath $imageSql -Value ([string]::Join("`r`n", [string[]]$imageLines)) -Encoding UTF8

$verifyContent = @"
-- Generated by brand_rebuild.ps1
-- Brand verify: $BrandName

SELECT b.name AS brand_name, COUNT(*) AS cnt
FROM materials m
LEFT JOIN brands b ON b.id = m.restaurant_brand_id
WHERE b.name = $brandQ
GROUP BY b.name;

SELECT COUNT(DISTINCT m.category) AS category_cnt
FROM materials m
JOIN brands b ON b.id = m.restaurant_brand_id
WHERE b.name = $brandQ;

SELECT
  COUNT(*) AS total,
  COUNT(NULLIF(TRIM(COALESCE(m.pic_folder, '')), '')) AS has_pic_folder,
  COUNT(NULLIF(TRIM(COALESCE(m.image, '')), '')) AS has_image
FROM materials m
JOIN brands b ON b.id = m.restaurant_brand_id
WHERE b.name = $brandQ;

SELECT m.code, COUNT(*) AS dup_n
FROM materials m
JOIN brands b ON b.id = m.restaurant_brand_id
WHERE b.name = $brandQ
GROUP BY m.code
HAVING COUNT(*) > 1;
"@
Set-Content -LiteralPath $verifySql -Value $verifyContent -Encoding UTF8

Write-Host ''
Write-Host '== Done ==' -ForegroundColor Green
Write-Host ('CSV outputs: {0}, {1}, {2}, {3}' -f $mergedCsv, $cleanedCsv, $rdsCsv, $mapCsv)
Write-Host ('SQL outputs: {0}, {1}, {2}' -f $bindSql, $imageSql, $verifySql)
Write-Host ('DMS order: import {0} -> run bind sql -> run image sql -> run verify sql' -f $rdsCsv)

if ($RunDb) {
  Write-Host ""
  Write-Host "== RunDb enabled: execute bind/image/verify on DB ==" -ForegroundColor Yellow
  Write-Host "RunDb: please import rds CSV to materials first."
  $runnerPath = Join-Path $ProjectRoot "scripts\\run_brand_sql_bundle.mjs"
  & node $runnerPath $BrandName $bindSql $imageSql
  if ($LASTEXITCODE -ne 0) {
    throw "RunDb failed. Node runner exit code: $LASTEXITCODE"
  }
}
