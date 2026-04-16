#!/usr/bin/env bash
set -Eeuo pipefail

# One-shot deploy script for Baota server.
# Features:
# - Auto backup
# - Fail-fast
# - Auto rollback on error
#
# Usage:
#   chmod +x deploy-editor-integration-once.sh
#   ./deploy-editor-integration-once.sh \
#     --site-root /www/wwwroot/renliyesheng \
#     --editor-root /www/wwwroot/rdesign-editor/current \
#     --update-zip /www/wwwroot/renliyesheng/baota-editor-integration-update.zip \
#     --vhost-conf /www/server/panel/vhost/nginx/renliyesheng.net.conf

SITE_ROOT="/www/wwwroot/renliyesheng"
EDITOR_ROOT="/www/wwwroot/rdesign-editor/current"
UPDATE_ZIP=""
VHOST_CONF=""
NGINX_TEMPLATE_REL="deploy-package/nginx-with-editor.conf"
EDITOR_PM2_NAME="rdesign-editor"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --site-root)
      SITE_ROOT="$2"
      shift 2
      ;;
    --editor-root)
      EDITOR_ROOT="$2"
      shift 2
      ;;
    --update-zip)
      UPDATE_ZIP="$2"
      shift 2
      ;;
    --vhost-conf)
      VHOST_CONF="$2"
      shift 2
      ;;
    *)
      echo "[ERROR] Unknown argument: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$UPDATE_ZIP" ]]; then
  UPDATE_ZIP="$SITE_ROOT/baota-editor-integration-update.zip"
fi

TS="$(date +%Y%m%d_%H%M%S)"
ROLLBACK_DIR="$SITE_ROOT/_rollback/editor_integration_$TS"
STAGE_DIR="$SITE_ROOT/_deploy_stage/editor_integration_$TS"
UPDATED_VHOST=0
UPDATED_COMPONENT=0
UPDATED_DEPLOY_FILES=0
REBUILT_FRONTEND=0
UPDATED_PM2=0

mkdir -p "$ROLLBACK_DIR" "$STAGE_DIR"

rollback() {
  local exit_code=$?
  echo "[ROLLBACK] Triggered (exit_code=$exit_code)"

  if [[ $UPDATED_COMPONENT -eq 1 ]]; then
    if [[ -f "$ROLLBACK_DIR/components/EngineeringDecisionCenter.tsx" ]]; then
      cp -f "$ROLLBACK_DIR/components/EngineeringDecisionCenter.tsx" "$SITE_ROOT/components/EngineeringDecisionCenter.tsx"
      echo "[ROLLBACK] Restored components/EngineeringDecisionCenter.tsx"
    fi
  fi

  if [[ $UPDATED_DEPLOY_FILES -eq 1 ]]; then
    if [[ -d "$ROLLBACK_DIR/deploy-package" ]]; then
      cp -rf "$ROLLBACK_DIR/deploy-package/." "$SITE_ROOT/deploy-package/"
      echo "[ROLLBACK] Restored deploy-package updates"
    fi
  fi

  if [[ $UPDATED_VHOST -eq 1 && -n "$VHOST_CONF" ]]; then
    if [[ -f "$ROLLBACK_DIR/nginx/vhost.conf.bak" ]]; then
      cp -f "$ROLLBACK_DIR/nginx/vhost.conf.bak" "$VHOST_CONF"
      echo "[ROLLBACK] Restored nginx vhost config"
      nginx -t && nginx -s reload || true
    fi
  fi

  if [[ $UPDATED_PM2 -eq 1 ]]; then
    pm2 stop "$EDITOR_PM2_NAME" >/dev/null 2>&1 || true
    pm2 delete "$EDITOR_PM2_NAME" >/dev/null 2>&1 || true
    echo "[ROLLBACK] Reverted PM2 process update for $EDITOR_PM2_NAME"
  fi

  echo "[ROLLBACK] Done. Backup kept at: $ROLLBACK_DIR"
  exit "$exit_code"
}

trap rollback ERR

echo "[INFO] SITE_ROOT=$SITE_ROOT"
echo "[INFO] EDITOR_ROOT=$EDITOR_ROOT"
echo "[INFO] UPDATE_ZIP=$UPDATE_ZIP"
echo "[INFO] VHOST_CONF=${VHOST_CONF:-<skip nginx overwrite>}"
echo "[INFO] ROLLBACK_DIR=$ROLLBACK_DIR"

[[ -d "$SITE_ROOT" ]] || { echo "[ERROR] site root not found: $SITE_ROOT"; exit 1; }
[[ -d "$EDITOR_ROOT" ]] || { echo "[ERROR] editor root not found: $EDITOR_ROOT"; exit 1; }
[[ -f "$UPDATE_ZIP" ]] || { echo "[ERROR] update zip not found: $UPDATE_ZIP"; exit 1; }
[[ -f "$EDITOR_ROOT/apps/editor/server.js" ]] || { echo "[ERROR] missing editor server.js under $EDITOR_ROOT"; exit 1; }

echo "[STEP] Unzip update package"
unzip -o "$UPDATE_ZIP" -d "$STAGE_DIR" >/dev/null

[[ -f "$STAGE_DIR/components/EngineeringDecisionCenter.tsx" ]] || { echo "[ERROR] package missing components/EngineeringDecisionCenter.tsx"; exit 1; }
[[ -f "$STAGE_DIR/nginx-with-editor.conf" ]] || { echo "[ERROR] package missing nginx-with-editor.conf"; exit 1; }
[[ -f "$STAGE_DIR/editor/ecosystem.editor.cjs" ]] || { echo "[ERROR] package missing editor/ecosystem.editor.cjs"; exit 1; }

echo "[STEP] Backup current files"
mkdir -p "$ROLLBACK_DIR/components" "$ROLLBACK_DIR/deploy-package/editor" "$ROLLBACK_DIR/nginx"
cp -f "$SITE_ROOT/components/EngineeringDecisionCenter.tsx" "$ROLLBACK_DIR/components/EngineeringDecisionCenter.tsx"
cp -f "$SITE_ROOT/deploy-package/nginx-with-editor.conf" "$ROLLBACK_DIR/deploy-package/nginx-with-editor.conf" 2>/dev/null || true
cp -f "$SITE_ROOT/deploy-package/DEPLOY.md" "$ROLLBACK_DIR/deploy-package/DEPLOY.md" 2>/dev/null || true
if [[ -d "$SITE_ROOT/deploy-package/editor" ]]; then
  cp -rf "$SITE_ROOT/deploy-package/editor/." "$ROLLBACK_DIR/deploy-package/editor/"
fi
if [[ -n "$VHOST_CONF" ]]; then
  cp -f "$VHOST_CONF" "$ROLLBACK_DIR/nginx/vhost.conf.bak"
fi

echo "[STEP] Apply files to project"
cp -f "$STAGE_DIR/components/EngineeringDecisionCenter.tsx" "$SITE_ROOT/components/EngineeringDecisionCenter.tsx"
UPDATED_COMPONENT=1

mkdir -p "$SITE_ROOT/deploy-package/editor"
cp -f "$STAGE_DIR/nginx-with-editor.conf" "$SITE_ROOT/deploy-package/nginx-with-editor.conf"
cp -f "$STAGE_DIR/DEPLOY.md" "$SITE_ROOT/deploy-package/DEPLOY.md"
cp -rf "$STAGE_DIR/editor/." "$SITE_ROOT/deploy-package/editor/"
UPDATED_DEPLOY_FILES=1

echo "[STEP] Install deps and build frontend"
cd "$SITE_ROOT"
npm install
npm run build
REBUILT_FRONTEND=1

echo "[STEP] Verify editor assets"
node "$SITE_ROOT/deploy-package/editor/verify-editor-assets.mjs" "$EDITOR_ROOT"

echo "[STEP] Restart or create PM2 editor process"
if pm2 describe "$EDITOR_PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$EDITOR_PM2_NAME"
else
  pm2 start "$SITE_ROOT/deploy-package/editor/ecosystem.editor.cjs"
fi
pm2 save
UPDATED_PM2=1

echo "[STEP] Health check editor process"
curl -fsS "http://127.0.0.1:4302/api/health" >/dev/null

if [[ -n "$VHOST_CONF" ]]; then
  echo "[STEP] Overwrite nginx vhost with integrated template"
  cp -f "$SITE_ROOT/deploy-package/nginx-with-editor.conf" "$VHOST_CONF"
  UPDATED_VHOST=1

  echo "[STEP] Validate and reload nginx"
  nginx -t
  nginx -s reload
fi

trap - ERR
echo "[SUCCESS] Deploy completed."
echo "[SUCCESS] Rollback snapshot: $ROLLBACK_DIR"
echo "[SUCCESS] Verify URL: https://renliyesheng.net/editor/"

