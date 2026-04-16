#!/usr/bin/env node
// 数据库迁移脚本 - 在服务器上运行
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('🚀 开始执行数据库迁移...');
console.log('数据库主机:', process.env.DB_HOST);
console.log('数据库名:', process.env.DB_DATABASE || process.env.DB_NAME);

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD?.replace(/^"|"$/g, ''),
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

const migrationSQL = `
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

-- 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_projects_digital_assets ON projects USING GIN (digital_assets);
CREATE INDEX IF NOT EXISTS idx_projects_stages ON projects USING GIN (stages);
CREATE INDEX IF NOT EXISTS idx_projects_team_members ON projects USING GIN (team_members);
`;

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('📋 执行迁移 SQL...');
    await client.query(migrationSQL);
    console.log('✅ 迁移执行成功！');
    
    // 验证表结构
    console.log('\n📊 验证表结构:');
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      ORDER BY ordinal_position
    `);
    
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // 检查关键字段
    const requiredFields = ['digital_assets', 'stages', 'team_members', 'progress', 'updated_at'];
    const existingFields = result.rows.map(r => r.column_name);
    
    console.log('\n🔍 关键字段检查:');
    let allGood = true;
    requiredFields.forEach(field => {
      const exists = existingFields.includes(field);
      console.log(`  ${exists ? '✅' : '❌'} ${field}`);
      if (!exists) allGood = false;
    });
    
    if (allGood) {
      console.log('\n🎉 所有字段都已就绪！');
    } else {
      console.log('\n⚠️  部分字段缺失，请检查错误日志');
      process.exit(1);
    }
    
  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
