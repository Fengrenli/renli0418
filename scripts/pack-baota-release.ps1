# 宝塔整包：源码 + 当前 dist（不含 node_modules / .env / uploads）
# 用法：在仓库根目录执行  powershell -ExecutionPolicy Bypass -File scripts/pack-baota-release.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ">>> npm run build" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "vite build failed" }

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "renliyesheng_net_release_$ts.zip"
$temp = Join-Path (Get-Location).Path "_baota_release_pack"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $temp | Out-Null

$dirs = @('lib', 'components', 'src', 'public', 'scripts', 'utils', 'dist')
$files = @(
  'server.ts', 'db.js', 'db-hardcoded.js', 'package.json', 'package-lock.json',
  'App.tsx', 'index.tsx', 'index.html', 'index.css', 'types.ts', 'vite-env.d.ts',
  'vite.config.ts', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js',
  '.gitignore', '.env.example',
  'nginx.conf', 'nginx-renliyesheng.conf', 'deploy_bt.sh', 'update_material_categories.cjs'
)

foreach ($d in $dirs) {
  if (Test-Path $d) {
    Copy-Item $d (Join-Path $temp $d) -Recurse -Force
    Write-Host "  + $d/"
  } else {
    Write-Warning "missing dir: $d"
  }
}
foreach ($f in $files) {
  if (Test-Path $f) {
    Copy-Item $f (Join-Path $temp $f) -Force
    Write-Host "  + $f"
  }
}

$readmeLines = @(
  '# renliyesheng.net release pack',
  '# Includes: server.ts, db-hardcoded.js, frontend sources, dist/, package-lock.json',
  '# Excludes: node_modules, .env (keep server copy), uploads (do not overwrite)',
  '# After unzip in site root, run commands from deploy instructions (chat / your runbook).'
)
Set-Content -Path (Join-Path $temp 'BAOTA_RELEASE_README.txt') -Value ($readmeLines -join "`n") -Encoding UTF8

$zipPath = Join-Path (Get-Location).Path $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item $temp -Recurse -Force

$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "完成: $zipPath ($mb MB)" -ForegroundColor Green
