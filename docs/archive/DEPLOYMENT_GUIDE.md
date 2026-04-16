# 部署配置指南

## 项目概述

本项目是一个国际贸易管理系统，包含全球项目看板、BOM清单制作、AI智能助理等功能。为了在中国大陆环境正常运行，我们已将Google AI功能替换为阿里云通义千问，Google Maps替换为高德地图。

## 环境要求

- Node.js 18.0+  
- npm 9.0+  
- PostgreSQL 14.0+  
- 阿里云账号（用于通义千问API）
- 高德地图开发者账号（用于地图服务）

## 依赖安装

1. 克隆项目到本地：

```bash
git clone <项目仓库地址>
cd <项目目录>
```

2. 安装依赖：

```bash
npm install
```

## API密钥配置

### 1. 通义千问API配置

1. 登录阿里云控制台：https://console.aliyun.com/
2. 搜索并进入"通义千问"服务
3. 创建API密钥（Access Key）
4. 将API密钥添加到 `.env` 文件：

```
TONGYI_API_KEY=your_tongyi_api_key
```

### 2. 高德地图API配置

1. 登录高德开放平台：https://console.amap.com/
2. 创建应用并获取API密钥
3. 将API密钥添加到 `.env` 文件：

```
AMAP_API_KEY=your_amap_api_key
```

### 3. 数据库配置

确保 `.env` 文件中的数据库配置正确：

```
DB_HOST=rm-cn-pj64od8bk00014zo.rwlb.rds.aliyuncs.com
DB_USER=renli_2026
DB_PASSWORD=Gd889988#
DB_DATABASE=renli_company
DB_PORT=5432
DB_SSL=false
```

## 部署步骤

### 开发环境

1. 启动开发服务器：

```bash
npm run dev
```

2. 访问 http://localhost:3000

### 生产环境

1. 构建项目：

```bash
npm run build
```

2. 启动生产服务器：

```bash
npm start
```

## 功能说明

### AI功能

系统使用阿里云通义千问API提供以下功能：

1. **项目智能创建**：在Dashboard和AdminPortal中，输入项目描述，AI会自动生成项目名称、位置、坐标等信息
2. **HS编码智能生成**：在BOMGenerator中，AI会根据材料名称自动生成HS编码

### 地图功能

系统使用高德地图API提供以下功能：

1. **全球项目地图**：在Dashboard中查看所有项目的地理位置
2. **项目定位**：点击项目标记查看详细信息

## 常见问题及解决方案

### 1. AI服务不可用

**问题**：AI功能提示"服务暂时不可用"

**解决方案**：
- 检查通义千问API密钥是否正确配置
- 确认API密钥是否有足够的调用配额
- 检查网络连接是否正常

### 2. 地图不显示

**问题**：地图区域显示空白或API密钥错误

**解决方案**：
- 检查高德地图API密钥是否正确配置
- 确认API密钥是否已启用地图服务
- 检查网络连接是否正常

### 3. 依赖安装失败

**问题**：npm install 命令失败

**解决方案**：
- 确保Node.js版本符合要求
- 尝试使用 `npm install --legacy-peer-deps` 命令
- 清除npm缓存后重试：`npm cache clean --force`

### 4. 数据库连接失败

**问题**：系统无法连接到数据库

**解决方案**：
- 检查数据库配置是否正确
- 确认数据库服务是否正常运行
- 检查网络连接是否允许访问数据库服务器

## 技术支持

如果遇到其他问题，请联系技术支持团队。

---

**版本**：1.0.0  
**更新日期**：2024-12-04  
**维护者**：成都仁力烨升国际贸易有限公司