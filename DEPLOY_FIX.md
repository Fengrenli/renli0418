# 🔧 数据持久化问题修复部署指南

## 问题根因
数据库表 `projects` 缺少存储复杂数据的 JSONB 字段，导致上传的文件、修改的成员和状态无法持久化。

## 修复步骤

### 第一步：执行数据库迁移（关键！）

登录到阿里云数据库，执行以下 SQL：

```bash
# 使用 psql 连接数据库
psql -h rm-cn-pj64od8bk00014zo.rwlb.rds.aliyuncs.com -U renli_2026 -d renli_company
```

然后执行 `migrations/005_add_projects_json_fields.sql` 中的 SQL：

```sql
-- 检查并添加 digital_assets 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'digital_assets'
    ) THEN
        ALTER TABLE projects ADD COLUMN digital_assets JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added column: digital_assets';
    END IF;
END $$;

-- 检查并添加 stages 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'stages'
    ) THEN
        ALTER TABLE projects ADD COLUMN stages JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 检查并添加 team_members 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'team_members'
    ) THEN
        ALTER TABLE projects ADD COLUMN team_members JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 检查并添加 progress 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'progress'
    ) THEN
        ALTER TABLE projects ADD COLUMN progress INTEGER DEFAULT 0;
    END IF;
END $$;

-- 检查并添加 feishu_excluded_member_ids 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'feishu_excluded_member_ids'
    ) THEN
        ALTER TABLE projects ADD COLUMN feishu_excluded_member_ids JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 检查并添加 updated_at 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_projects_digital_assets ON projects USING GIN (digital_assets);
CREATE INDEX IF NOT EXISTS idx_projects_stages ON projects USING GIN (stages);
CREATE INDEX IF NOT EXISTS idx_projects_team_members ON projects USING GIN (team_members);
```

### 第二步：部署更新后的代码

1. 将更新后的 `server.ts` 上传到服务器
2. 将更新后的 `ProjectDetailsView.tsx` 上传到服务器
3. 重新构建前端（如果需要）

### 第三步：重启服务

```bash
# 重启 PM2 服务
pm2 restart renliyesheng

# 查看日志
pm2 logs renliyesheng
```

### 第四步：验证修复

1. **打开浏览器控制台**（F12）
2. **上传一个模型文件**
3. **观察控制台输出**，应该看到：
   ```
   [Upload] 正在保存项目数据到数据库...
   [Upload] 保存接口响应: { success: true, msg: '保存成功' }
   ```

4. **刷新页面**，检查模型是否仍然显示

5. **在服务器日志中查看**：
   ```
   [API /api/save-project-detailed] 收到保存请求
   [API /api/save-project-detailed] 项目ID: proj-xxx
   [API /api/save-project-detailed] digitalAssets 数量: 1
   [API /api/save-project-detailed] 保存成功
   ```

### 第五步：数据库验证

```sql
-- 查询项目的 digital_assets 字段
SELECT id, name, digital_assets 
FROM projects 
WHERE id = '你的项目ID';

-- 应该返回包含模型数据的 JSONB
```

## 文件变更清单

1. ✅ `migrations/005_add_projects_json_fields.sql` - 数据库迁移文件
2. ✅ `server.ts` - 增强错误处理和调试日志
3. ✅ `components/ProjectDetailsView.tsx` - 增强错误处理
4. ✅ `test-db-connection.mjs` - 数据库连接测试脚本

## 常见问题

### Q: 如果数据库字段已经存在怎么办？
A: 迁移脚本使用了 `IF NOT EXISTS` 检查，可以安全地重复执行。

### Q: 如何确认字段已添加？
A: 执行以下 SQL 查询：
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects';
```

### Q: 如果保存仍然失败？
A: 检查服务器日志中的错误信息，可能是：
- 数据库连接问题
- 权限问题
- JSON 数据格式问题
