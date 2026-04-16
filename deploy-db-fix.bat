@echo off
chcp 65001 >nul
echo ========================================
echo  数据库修复部署脚本
echo ========================================
echo.

REM 确保 dist-server 目录存在
if not exist dist-server mkdir dist-server

REM 复制 db.js 到 dist-server
echo [1/3] 复制 db.js 到 dist-server...
copy /Y db.js dist-server\db.js
if errorlevel 1 (
    echo 错误：复制 db.js 失败
    pause
    exit /b 1
)

REM 复制 .env 到 dist-server
echo [2/3] 复制 .env 到 dist-server...
copy /Y .env dist-server\.env
if errorlevel 1 (
    echo 警告：复制 .env 失败，继续...
)

REM 创建部署包（不包含 material 文件夹）
echo [3/3] 创建部署包 deploy-db-fix.zip...
if exist deploy-db-fix.zip del deploy-db-fix.zip

REM 使用 PowerShell 创建 zip 文件（排除 material 文件夹）
powershell -Command "Compress-Archive -Path 'dist-server','index.html','assets','.env' -DestinationPath 'deploy-db-fix.zip' -Force"

if errorlevel 1 (
    echo 错误：创建部署包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo  部署包创建成功！
echo  文件名: deploy-db-fix.zip
echo ========================================
echo.
echo 请将此文件上传到服务器并解压到网站目录
echo.
pause
