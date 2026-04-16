# 创建宝塔部署包
$ErrorActionPreference = "Stop"

$packageName = "deploy_$(Get-Date -Format 'yyyyMMdd_HHmmss').zip"
$excludePatterns = @(
    'node_modules',
    '.git',
    'uploads/*',
    '*.log',
    'dist.zip',
    'upload_bundle.zip',
    'check-db.js',
    'test-*.js',
    'create-deploy-package.ps1'
)

Write-Host "==> 创建部署包: $packageName" -ForegroundColor Green

# 创建临时目录
$tempDir = "temp_deploy_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# 复制文件
Write-Host "==> 复制项目文件..." -ForegroundColor Yellow
Copy-Item -Path ".\*" -Destination $tempDir -Recurse -Force

# 删除排除的文件
Write-Host "==> 清理不需要的文件..." -ForegroundColor Yellow
foreach ($pattern in $excludePatterns) {
    $items = Get-ChildItem -Path $tempDir -Recurse -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 压缩文件
Write-Host "==> 压缩文件..." -ForegroundColor Yellow
Compress-Archive -Path "$tempDir\*" -DestinationPath $packageName -Force

# 清理临时目录
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "==> 部署包创建完成: $packageName" -ForegroundColor Green
Write-Host "==> 文件大小: $([math]::Round((Get-Item $packageName).Length / 1MB, 2)) MB" -ForegroundColor Cyan
