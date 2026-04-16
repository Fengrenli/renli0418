-- ============================================
-- 为 projects 表添加缺失的 JSONB 字段
-- 适用于阿里云 DMS 控制台执行
-- ============================================

-- 1. 添加 digital_assets 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS digital_assets JSONB DEFAULT '[]'::jsonb;

-- 2. 添加 stages 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS stages JSONB DEFAULT '[]'::jsonb;

-- 3. 添加 team_members 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]'::jsonb;

-- 4. 添加 progress 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;

-- 5. 添加 feishu_excluded_member_ids 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS feishu_excluded_member_ids JSONB DEFAULT '[]'::jsonb;

-- 6. 添加 updated_at 字段
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 7. 创建 GIN 索引（优化 JSONB 查询性能）
CREATE INDEX IF NOT EXISTS idx_projects_digital_assets ON projects USING GIN (digital_assets);
CREATE INDEX IF NOT EXISTS idx_projects_stages ON projects USING GIN (stages);
CREATE INDEX IF NOT EXISTS idx_projects_team_members ON projects USING GIN (team_members);

-- ============================================
-- 验证：查看表结构
-- ============================================
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;
