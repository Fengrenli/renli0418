-- Migration: 为 projects 表添加缺失的 JSONB 字段
-- 用于存储 digitalAssets、stages、team_members 等复杂数据

-- 检查并添加 digital_assets 字段
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'digital_assets'
    ) THEN
        ALTER TABLE projects ADD COLUMN digital_assets JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added column: digital_assets';
    ELSE
        RAISE NOTICE 'Column digital_assets already exists';
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
        RAISE NOTICE 'Added column: stages';
    ELSE
        RAISE NOTICE 'Column stages already exists';
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
        RAISE NOTICE 'Added column: team_members';
    ELSE
        RAISE NOTICE 'Column team_members already exists';
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
        RAISE NOTICE 'Added column: progress';
    ELSE
        RAISE NOTICE 'Column progress already exists';
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
        RAISE NOTICE 'Added column: feishu_excluded_member_ids';
    ELSE
        RAISE NOTICE 'Column feishu_excluded_member_ids already exists';
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
        RAISE NOTICE 'Added column: updated_at';
    ELSE
        RAISE NOTICE 'Column updated_at already exists';
    END IF;
END $$;

-- 创建 GIN 索引以优化 JSONB 查询性能
CREATE INDEX IF NOT EXISTS idx_projects_digital_assets ON projects USING GIN (digital_assets);
CREATE INDEX IF NOT EXISTS idx_projects_stages ON projects USING GIN (stages);
CREATE INDEX IF NOT EXISTS idx_projects_team_members ON projects USING GIN (team_members);

-- 验证表结构
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;
