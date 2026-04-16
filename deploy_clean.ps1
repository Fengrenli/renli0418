# deploy_clean.ps1
$SERVER_IP = "47.109.22.219"
$SERVER_USER = "root"
$SERVER_DIR = "/www/wwwroot/renliyesheng"

# 清理服务器旧文件
Write-Host "===== 清理服务器旧文件 ====="
ssh ${SERVER_USER}@${SERVER_IP} "rm -rf ${SERVER_DIR}/assets/*"

# 上传前端文件
Write-Host "===== 上传前端文件 ====="
scp -r dist/assets/* ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/assets/
scp dist/index.html ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp dist/favicon.ico ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/

# 上传后端文件
Write-Host "===== 上传后端文件 ====="
scp server.ts ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp db.js ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp .env ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp package.json ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/
scp package-lock.json ${SERVER_USER}@${SERVER_IP}:${SERVER_DIR}/

# 线上部署
Write-Host "===== 线上部署 ====="
ssh ${SERVER_USER}@${SERVER_IP} "cd ${SERVER_DIR}; npm install --production; pm2 stop renliyesheng; pm2 start server.ts --name renliyesheng; pm2 save"

Write-Host "===== 部署成功！====="