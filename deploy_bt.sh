#!/usr/bin/env bash
set -euo pipefail

# 宝塔/阿里云生产发布脚本
# 用法：
#   bash deploy_bt.sh
# 可选环境变量：
#   APP_DIR=/www/wwwroot/renliyesheng
#   APP_NAME=renliyesheng
#   PORT=3800

APP_DIR="${APP_DIR:-/www/wwwroot/renliyesheng}"
APP_NAME="${APP_NAME:-renliyesheng}"
PORT="${PORT:-3800}"

echo "==> Deploying ${APP_NAME} at ${APP_DIR}"
cd "${APP_DIR}"

# 固定 PM2_HOME，避免出现 /etc/.pm2 与项目 .pm2 混用
export HOME="${APP_DIR}"
export PM2_HOME="${APP_DIR}/.pm2"

echo "==> Node / npm versions"
node -v
npm -v

echo "==> Install dependencies"
npm install

echo "==> Build frontend"
npm run build

echo "==> Restart PM2 process"
pm2 delete "${APP_NAME}" >/dev/null 2>&1 || true
NODE_ENV=production pm2 start "${APP_DIR}/server.ts" \
  --name "${APP_NAME}" \
  --interpreter "${APP_DIR}/node_modules/.bin/tsx" \
  --cwd "${APP_DIR}" \
  --update-env

pm2 save

echo "==> Health check"
curl -i --max-time 15 "http://127.0.0.1:${PORT}/api/health"

echo "==> Done"
