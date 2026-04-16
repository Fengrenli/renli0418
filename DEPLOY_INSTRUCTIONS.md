# 🚀 部署指南 - 修复数据读取问题

## 问题分析
服务器上没有 `node_modules` 和 `tsx`，说明之前可能使用的是编译后的代码或者其他方式运行。

## 解决方案

### 方案一：使用 npx tsx 运行（推荐）

在服务器上执行：

```bash
cd /www/wwwroot/renliyesheng.net

# 安装依赖（如果还没有安装）
npm install

# 使用 npx 运行 tsx
pm2 start "npx tsx server.ts" --name renliyesheng

# 或者使用 npm start
pm2 start npm --name renliyesheng -- start
```

### 方案二：编译 TypeScript 为 JavaScript

在本地执行：

```bash
# 安装 TypeScript 编译器
npm install -g typescript

# 编译 server.ts 为 JavaScript
tsc server.ts --outDir dist-server --esModuleInterop --target ES2020 --module commonjs

# 然后将 dist-server/server.js 上传到服务器
```

### 方案三：使用 ts-node（如果已安装）

```bash
pm2 start server.ts --name renliyesheng --interpreter npx --interpreter-args ts-node
```

## 部署步骤

1. **上传文件到服务器**
   - `server.ts` （已修复的版本）
   - `package.json`
   - `node_modules` （或者直接在服务器上运行 `npm install`）

2. **安装依赖**
   ```bash
   cd /www/wwwroot/renliyesheng.net
   npm install
   ```

3. **重启服务**
   ```bash
   pm2 delete renliyesheng
   pm2 start "npx tsx server.ts" --name renliyesheng
   pm2 save
   ```

4. **验证**
   ```bash
   pm2 logs renliyesheng --lines 50
   ```

   应该看到：
   ```
   [API /api/projects] 开始获取项目列表
   [API /api/projects] 查询到项目数: 56
   [API /api/projects] 项目 proj-1775203736057 digitalAssets 数量: 1
   ```

## 前端部署

前端文件已经构建到 `dist/` 目录，直接上传到服务器的 `dist/` 目录即可。

## 验证修复

1. 刷新网页
2. 打开浏览器控制台
3. 检查 `/api/projects` 返回的数据
4. 确认 `digitalAssets` 字段有数据
