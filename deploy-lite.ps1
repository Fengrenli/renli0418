# 创建精简部署包（不包含material和uploads）
$ErrorActionPreference = "Stop"

$packageName = "deploy_lite_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"

Write-Host "==> 创建精简部署包: $packageName" -ForegroundColor Green
Write-Host "==> 排除: material, uploads, node_modules, .git, temp_*" -ForegroundColor Yellow

# 要包含的文件和文件夹
$includes = @(
    "dist",
    "components",
    "src",
    "public",
    "server.ts",
    "db.js",
    "types.ts",
    "index.html",
    "index.tsx",
    "index.js",
    "App.tsx",
    "index.css",
    "tailwind.config.js",
    "postcss.config.js",
    "tsconfig.json",
    "vite.config.ts",
    "package.json",
    "package-lock.json",
    ".env",
    "deploy_bt.sh",
    "nginx.conf"
)

# 创建临时目录
$tempDir = "temp_lite_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# 复制文件
Write-Host "==> 复制必要文件..." -ForegroundColor Yellow
foreach ($item in $includes) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination $tempDir -Recurse -Force
        Write-Host "   ✓ $item" -ForegroundColor Gray
    }
}

# 压缩文件
Write-Host "==> 压缩文件..." -ForegroundColor Yellow
Compress-Archive -Path "$tempDir\*" -DestinationPath $packageName -Force

# 清理临时目录
Remove-Item -Path $tempDir -Recurse -Force

$size = [math]::Round((Get-Item $packageName).Length / 1MB, 2)
Write-Host "==> 部署包创建完成: $packageName" -ForegroundColor Green
Write-Host "==> 文件大小: $size MB" -ForegroundColor Cyan
Write-Host ""
Write-Host "注意: 此包不包含 material 和 uploads 文件夹" -ForegroundColor Yellow
Write-Host "      这些静态资源应该使用OSS/CDN链接" -ForegroundColor Yellow
