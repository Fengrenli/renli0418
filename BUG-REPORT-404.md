# BUG 报告：`/api/project/:id` 持续返回 404

## 问题描述

在 Express 后端中，`GET /api/project/:id` 路由始终返回：
```json
{"code":404,"msg":"API endpoint not found"}
```

但同一服务器上的其他 API 路由完全正常：
- `GET /api/health` → ✅ 正常返回 `{"code":200,"msg":"server is running"}`
- `GET /api/projects` → ✅ 正常返回项目列表
- `POST /api/upload` → ✅ 文件上传成功
- `POST /api/save-project-detailed` → ✅ 项目保存成功

## 环境信息

| 项目 | 值 |
|---|---|
| Node.js | 18.18.0 |
| Express | 5.2.1（**注意：Express 5.x**） |
| TypeScript 运行时 | tsx |
| 进程管理 | PM2 (fork 模式) |
| 服务器 | 阿里云 Linux (BaoTa 面板) |
| 项目路径 | `/www/wwwroot/renliyesheng/` |
| 端口 | 3800 |
| 启动命令 | `cross-env NODE_ENV=production VITE_DEV=0 tsx server.ts` |

## 核心矛盾

### 1. 源码中存在该路由
`server.ts` 第 276 行明确定义了路由：

```typescript
// 第 276 行
app.get('/api/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, msg: '项目不存在' });
    }
    
    // ... 返回项目数据
    return res.json({ code: 200, success: true, data: project });
  } catch (err) {
    console.error('获取单个项目错误', err);
    return res.status(500).json({ success: false, msg: '服务器错误' });
  }
});
```

### 2. `"API endpoint not found"` 在源码中不存在
对 server.ts 和整个项目执行 `grep -rn "API endpoint not found"` **没有任何匹配**。

这说明返回 `{"code":404,"msg":"API endpoint not found"}` 的代码不在当前 server.ts 源码中。

### 3. `/api/health` 在源码中也不存在
本地 server.ts 中没有 `/api/health` endpoint 的定义（grep "health" 无结果），但线上 `/api/health` 返回了 `{"code":200,"msg":"server is running"}`。

**结论：服务器上 PM2 运行的可能不是当前 server.ts，或者 tsx 缓存了旧版本。**

## 路由注册顺序

server.ts 中的路由定义顺序（从 `grep` 提取）：

```
行  64: app.use(cors())
行  65: app.use(express.json({ limit: '50mb' }))
行 200: app.use(express.static(path.join(__dirname, 'dist')))   ← 静态文件中间件
行 203: app.use('/uploads', express.static(uploadsDir))
行 206: app.get('/api/test-uploads-dir', ...)
行 222: app.get('/api/projects', ...)                            ← ✅ 正常
行 276: app.get('/api/project/:id', ...)                         ← ❌ 404
行 329: app.post('/api/upload', ...)
行 394: app.post('/api/save-project-detailed', ...)
... 其余路由 ...
行 1480: app.listen(PORT)                                        ← 末尾，无 catch-all
```

**注意：第 200 行 `express.static` 在所有 API 路由之前。**在 Express 5.x 中，如果 `dist/` 目录里的 SPA 前端有某种 fallback，可能会拦截 `/api/project/xxx` 请求。但 `dist/` 中没有 `api/` 子目录。

## 已排除的原因

| 假设 | 排查结果 |
|---|---|
| nginx 拦截 | ❌ 排除。`curl http://127.0.0.1:3800/api/project/xxx` 直接打后端也返回 404 |
| 数据库无该项目 | ❌ 排除。数据库中项目存在（通过 `node -e` 查询确认） |
| 路由语法错误 | ❌ 排除。Express 5.x 仍支持 `:id` 参数语法 |
| catch-all 404 handler | ❌ 排除。server.ts 末尾只有 `app.listen()`，无 `app.use` 兜底 |
| sed 操作损坏源码 | ⚠️ 可能。之前多次用 sed 修改 server.ts，但重新上传了完整文件后仍 404 |

## 最可疑的根因

**PM2 运行的不是当前 server.ts 文件。** 证据：
1. 源码中没有 `"API endpoint not found"` 和 `/api/health`
2. 但线上两者都存在
3. `pm2 restart all` 后问题依旧

可能原因：
- PM2 使用 `tsx` 运行 TypeScript，tsx 可能有**编译缓存**
- PM2 的 `cwd` 可能指向错误目录
- 可能有另一个 server 进程也在监听 3800 端口

## 建议排查步骤

### 1. 确认 PM2 运行的脚本路径
```bash
pm2 show renliyesheng | grep -E "script path|exec cwd|exec mode|interpreter"
```

### 2. 检查是否有多个进程监听 3800
```bash
lsof -i :3800
# 或
ss -tlnp | grep 3800
```

### 3. 清除 tsx 缓存并重启
```bash
# 清除 tsx/node 缓存
rm -rf /tmp/tsx-*
rm -rf /root/.cache/tsx

# 彻底杀掉并重启
pm2 delete all
pm2 start "npx tsx server.ts" --name renliyesheng --cwd /www/wwwroot/renliyesheng
```

### 4. 在 server.ts 开头添加调试日志
在 `app.get('/api/project/:id', ...)` 路由前加一行：
```typescript
console.log('[ROUTES] /api/project/:id 路由已注册');
```
重启后查看 PM2 日志确认这行是否输出。

### 5. 添加全局请求日志
在所有路由之前加一个中间件：
```typescript
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});
```
然后 curl 测试，看日志是否记录到请求。

### 6. 如果以上都无效，换一种启动方式
不通过 PM2，直接在终端前台运行：
```bash
cd /www/wwwroot/renliyesheng
npx tsx server.ts
```
然后在另一个终端测试：
```bash
curl -s http://127.0.0.1:3800/api/project/proj-1775203993102
```
如果前台启动正常，说明问题在 PM2 配置。

## 相关文件

- `server.ts` — 主后端文件（1485 行）
- `package.json` — 启动命令：`cross-env NODE_ENV=production VITE_DEV=0 tsx server.ts`
- `db.js` — PostgreSQL 连接池
- `.env` / `.env.production` — 环境变量

## 额外问题：vite build 被 OOM Killed

服务器内存不足，`npm run build` 在 `transforming (3415)` 时被系统 Killed。
解决方案：在本地构建 `dist/` 目录后上传到服务器，跳过服务器端构建。
