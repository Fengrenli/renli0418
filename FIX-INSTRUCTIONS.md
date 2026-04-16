# 一键修复指南

## 需要上传到服务器的文件（通过宝塔文件管理器）

上传到 `/www/wwwroot/renliyesheng/` 目录，**覆盖**同名文件：

1. `server.ts` — 修复后的后端主文件
2. `fix-assets-v2.js` — 数据清洗脚本

## 在宝塔终端中执行（按顺序，逐条粘贴）

### 第1步：停掉所有进程，释放端口
```bash
cd /www/wwwroot/renliyesheng && pm2 delete all 2>/dev/null; fuser -k 3800/tcp 2>/dev/null; sleep 2
```

### 第2步：清理 tsx 缓存
```bash
rm -rf /tmp/tsx-* /root/.cache/tsx
```

### 第3步：运行数据清洗脚本
```bash
cd /www/wwwroot/renliyesheng && npx tsx fix-assets-v2.js
```

### 第4步：前台测试启动（验证是否正常）
```bash
cd /www/wwwroot/renliyesheng && TSX_DISABLE_CACHE=1 npx tsx server.ts
```

看到 `✅ 服务器已启动，监听端口: 3800` 后，**不要关窗口**。
打开第二个终端窗口测试：
```bash
curl -s http://127.0.0.1:3800/api/health
curl -s http://127.0.0.1:3800/api/project/proj-1775203993102 | head -c 500
```

如果两个都返回正常 JSON，按 Ctrl+C 停掉前台进程。

### 第5步：用 PM2 正式启动
```bash
cd /www/wwwroot/renliyesheng && pm2 delete all 2>/dev/null; TSX_DISABLE_CACHE=1 pm2 start server.ts --name renliyesheng --interpreter ./node_modules/.bin/tsx --cwd /www/wwwroot/renliyesheng && pm2 save
```

### 第6步：验证
```bash
curl -s http://127.0.0.1:3800/api/health
curl -s http://127.0.0.1:3800/api/project/proj-1775203993102 | head -c 500
pm2 logs renliyesheng --lines 20
```
