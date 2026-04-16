# deploy.ps1
$SERVER_IP = "47.109.22.219"
$SERVER_USER = "root"
$SERVER_DIR = "/www/wwwroot/renliyesheng"

# 前端打包
Write-Host "===== 1. 前端打包中 ====="
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "前端打包失败！"
  exit 1
}

# 清理服务器旧文件
Write-Host "===== 2. 清理服务器旧文件 ====="
ssh ${SERVER_USER}@${SERVER_IP} "rm -rf ${SERVER_DIR}/dist/assets/*"

# 上传前端文件（需安装 WinSCP/OpenSSH）
Write-Host "===== 3. 上传前端文件 ====="
scp -r dist/* ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/dist/

# 上传后端文件
Write-Host "===== 4. 上传后端文件 ====="
scp server.ts ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp db.js ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp .env ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp package.json ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp package-lock.json ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/

# 线上部署
Write-Host "===== 5. 线上部署 ====="
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_DIR}; npm install --production; pm2 stop renliyesheng; pm2 start server.ts --name renliyesheng; pm2 save"

Write-Host "===== 部署成功！====="