#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/www/wwwroot/rdesign-editor/current"
SERVER_JS="$ROOT_DIR/apps/editor/server.js"

if [[ ! -f "$SERVER_JS" ]]; then
  echo "[start-editor] missing: $SERVER_JS"
  exit 1
fi

export NODE_ENV=production
export HOSTNAME=127.0.0.1
export PORT="${PORT:-4302}"

cd "$ROOT_DIR/apps/editor"
exec node "$SERVER_JS"

