# 宝塔精简发布包：不含 node_modules / dist / uploads / material / .env
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$zipName = "renli0418_baota_lite_$ts.zip"
$temp = Join-Path (Get-Location).Path "_baota_lite_pack"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $temp | Out-Null

$dirs = @('lib', 'components', 'src', 'public', 'scripts', 'utils')
$files = @(
  'server.ts', 'db.js', 'db-hardcoded.js', 'package.json', 'package-lock.json',
  'App.tsx', 'index.tsx', 'index.html', 'index.css', 'types.ts', 'index.js',
  'vite.config.ts', 'tsconfig.json', 'tailwind.config.js', 'postcss.config.js',
  '.gitignore', '.env.example', 'nginx.conf', 'nginx-renliyesheng.conf'
)

foreach ($d in $dirs) {
  if (Test-Path $d) {
    Copy-Item $d (Join-Path $temp $d) -Recurse -Force
    Write-Host "  + $d/"
  }
}
foreach ($f in $files) {
  if (Test-Path $f) {
    Copy-Item $f (Join-Path $temp $f) -Force
    Write-Host "  + $f"
  }
}

$readme = @'
# renli0418 baota lite pack (no material/uploads/node_modules/dist)

Paths usually changed in a release:
- server.ts, lib/geoPipeline/, utils/, scripts/, package.json
- src/, components/, App.tsx, index.tsx, index.html, index.css, public/

On server:
  cd /www/wwwroot/YOUR_SITE
  npm ci && npm run build && npm start

Not in zip: node_modules, dist, .env, uploads/, material/
'@
Set-Content -Path (Join-Path $temp 'BAOTA_RELEASE_README.txt') -Value $readme -Encoding UTF8

$zipPath = Join-Path (Get-Location).Path $zipName
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$temp\*" -DestinationPath $zipPath -CompressionLevel Fastest
Remove-Item $temp -Recurse -Force

$mb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "完成: $zipPath ($mb MB)" -ForegroundColor Green
