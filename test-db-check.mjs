// 直接查询数据库检查
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD?.replace(/^"|"$/g, ''),
  database: process.env.DB_DATABASE || process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function checkDatabase() {
  try {
    console.log('🔍 直接查询数据库...');
    
    const result = await pool.query(
      'SELECT id, name, digital_assets FROM projects WHERE id = $1',
      ['proj-1775203736057']
    );
    
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('📋 数据库中的数据:');
      console.log('  ID:', row.id);
      console.log('  名称:', row.name);
      console.log('  digital_assets:', row.digital_assets);
      console.log('  digital_assets 类型:', typeof row.digital_assets);
      console.log('  digital_assets 是否为 null:', row.digital_assets === null);
      console.log('  digital_assets 是否为 undefined:', row.digital_assets === undefined);
      
      if (row.digital_assets) {
        console.log('  digital_assets 内容:', JSON.stringify(row.digital_assets));
      }
    } else {
      console.log('❌ 未找到项目');
    }
    
  } catch (err) {
    console.error('❌ 查询失败:', err.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
