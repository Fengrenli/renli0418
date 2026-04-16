# 网站全量更新部署指南

## 文件清单

### 根目录文件（19个）
| 文件 | 说明 |
|---|---|
| `server.ts` | 后端服务入口（Express + 所有 API） |
| `db.js` | 数据库连接配置 |
| `package.json` | 依赖和启动脚本 |
| `App.tsx` | 前端主组件 |
| `index.tsx` | React 入口 |
| `index.html` | HTML 模板 |
| `index.css` | 全局样式 |
| `types.ts` | TypeScript 类型定义 |
| `vite.config.ts` | Vite 构建配置 |
| `tsconfig.json` | TypeScript 配置 |
| `tailwind.config.js` | Tailwind CSS 配置 |
| `postcss.config.js` | PostCSS 配置 |
| `.env` | 环境变量（主） |
| `.env.production` | 生产环境变量 |
| `.env.development` | 开发环境变量 |
| `fix-db.js` | 数据库字段修复脚本 |
| `ensure-admin.js` | 管理员账户初始化脚本 |
| `fix-asset-urls.js` | 资产路径修复脚本 |
| `normalize-asset-paths.js` | 资产路径规范化脚本 |

### components/ 目录（21个组件）
| 文件 | 说明 |
|---|---|
| `Dashboard.tsx` | 项目主看板 |
| `ProjectDetailsView.tsx` | 项目详情页 |
| `ProjectTimeline.tsx` | 进度追踪时间线 |
| `BOMGenerator.tsx` | BOM 算量中心 |
| `EngineeringAssistantModal.tsx` | 工程助手弹窗 |
| `EngineeringDecisionCenter.tsx` | 3D 数字孪生决策中心 |
| `SceneParser.tsx` | R3F 3D 场景解析器 |
| `ArchitectureNode.tsx` | 3D 构件渲染组件 |
| `AdminPortal.tsx` | 管理后台 |
| `GlobeVisual.tsx` | 全球项目地图 |
| `GlobeThreeScene.tsx` | 3D 地球 |
| `ModelPreview.tsx` | 3D 模型预览 |
| `CampaignView.tsx` | 加盟申请页 |
| `ManualProjectModal.tsx` | 新建项目弹窗 |
| `CustomerSupportButton.tsx` | 客服按钮 |
| `ProjectManagerFAB.tsx` | 项目管理浮动按钮 |
| `MobileScrollCards.tsx` | 移动端卡片滚动 |
| `CyberLoadingCard.tsx` | 加载动画 |
| `ErrorBoundary.tsx` | 错误边界 |
| `Navbar.tsx` | 导航栏 |
| `AssetIcon.tsx` | 资产图标 |

### store/ 目录（1个）
| 文件 | 说明 |
|---|---|
| `useEngineeringStore.ts` | Zustand 全局状态管理 |

### migrations/ 目录（9个）
数据库迁移脚本，按需执行。

### dist/ 目录
已构建的前端静态资源，直接使用。

---

## 部署步骤

```bash
# 1. 备份当前网站
cd /www/wwwroot
cp -r renliyesheng renliyesheng_backup_$(date +%Y%m%d)

# 2. 清空旧文件（保留 uploads 和 node_modules）
cd /www/wwwroot/renliyesheng
find . -maxdepth 1 -not -name '.' -not -name 'uploads' -not -name 'node_modules' -not -name '.env*' | xargs rm -rf
rm -rf components/ store/ migrations/ dist/

# 3. 上传 deploy-package 内所有文件到 /www/wwwroot/renliyesheng/
#    保持目录结构：components/, store/, migrations/, dist/

# 4. 安装/更新依赖
npm install

# 5. 执行数据库修复脚本
node fix-db.js
node ensure-admin.js
node migrations/006_bom_rules_reseed_br99.js
node fix-asset-urls.js
node normalize-asset-paths.js

# 6. 重新构建前端（如果 dist 不是最新的）
npm run build

# 7. 重启服务
pm2 restart renliyesheng
```

---

## 编辑器融合（/editor）

主站通过同域路径 `/editor/` 反向代理到独立编辑器进程（Next standalone）。

### 1) 构建编辑器发布包（在 Windows 构建机）

```powershell
cd D:\Reditor-main
npm install
npx turbo run build --filter=editor
powershell -ExecutionPolicy Bypass -File E:\renli0418\deploy-package\editor\prepare-editor-release.ps1
```

### 2) 上传到宝塔服务器

- 上传构建结果到：`/www/wwwroot/rdesign-editor/current`
- 确保存在：`/www/wwwroot/rdesign-editor/current/apps/editor/server.js`

### 3) 进程管理（PM2）

```bash
pm2 start /www/wwwroot/renliyesheng/deploy-package/editor/ecosystem.editor.cjs
pm2 save
pm2 logs rdesign-editor
```

### 4) Nginx 生效

- 将 `deploy-package/nginx-with-editor.conf` 的 `/editor` 代理配置合并到线上站点 vhost。
- `nginx -t` 后重载。

### 5) 验证

```bash
curl "http://127.0.0.1:4302/api/health"
curl -I "https://renliyesheng.net/editor/"
node /www/wwwroot/renliyesheng/deploy-package/editor/verify-editor-assets.mjs /www/wwwroot/rdesign-editor/current
```

### 6) 桌面版下载发布

将 `D:\Reditor-main\apps\desktop\release-*` 产物上传到：

- `/www/wwwroot/renliyesheng/downloads/rdesign/latest/`

前端默认下载入口为 `/downloads/rdesign/latest/`，可用 `VITE_EDITOR_DESKTOP_URL` 覆盖。
