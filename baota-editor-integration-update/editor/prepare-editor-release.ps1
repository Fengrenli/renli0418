param(
  [string]$EditorRepo = "D:\Reditor-main",
  [string]$OutputDir = "D:\Reditor-main\release\editor-standalone"
)

$ErrorActionPreference = "Stop"

Write-Host "[prepare-editor-release] repo: $EditorRepo"
Write-Host "[prepare-editor-release] output: $OutputDir"

$standaloneRoot = Join-Path $EditorRepo "apps\editor\.next\standalone"
$staticSrc = Join-Path $EditorRepo "apps\editor\.next\static"
$publicSrc = Join-Path $EditorRepo "apps\editor\public"

if (!(Test-Path $standaloneRoot)) {
  throw "Missing standalone build output: $standaloneRoot. Run: npx turbo run build --filter=editor"
}

if (Test-Path $OutputDir) {
  Remove-Item -Path $OutputDir -Recurse -Force
}
New-Item -Path $OutputDir -ItemType Directory | Out-Null

Copy-Item -Path (Join-Path $standaloneRoot "*") -Destination $OutputDir -Recurse -Force

$staticDest = Join-Path $OutputDir "apps\editor\.next\static"
New-Item -Path $staticDest -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $staticSrc "*") -Destination $staticDest -Recurse -Force

$publicDest = Join-Path $OutputDir "apps\editor\public"
New-Item -Path $publicDest -ItemType Directory -Force | Out-Null
Copy-Item -Path (Join-Path $publicSrc "*") -Destination $publicDest -Recurse -Force

Write-Host "[prepare-editor-release] done."

