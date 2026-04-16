// 测试数据库连接和表结构
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

async function testDatabase() {
  try {
    console.log('🔌 测试数据库连接...');
    console.log('Host:', process.env.DB_HOST);
    console.log('Database:', process.env.DB_DATABASE || process.env.DB_NAME);
    
    const client = await pool.connect();
    
    try {
      // 1. 测试基本连接
      const testResult = await client.query('SELECT 1 as test');
      console.log('✅ 数据库连接成功:', testResult.rows[0]);
      
      // 2. 检查 projects 表是否存在
      const tableResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'projects'
        );
      `);
      console.log('📋 projects 表存在:', tableResult.rows[0].exists);
      
      if (tableResult.rows[0].exists) {
        // 3. 检查表结构
        const columnsResult = await client.query(`
          SELECT column_name, data_type, column_default
          FROM information_schema.columns
          WHERE table_name = 'projects'
          ORDER BY ordinal_position;
        `);
        console.log('\n📊 projects 表结构:');
        columnsResult.rows.forEach(col => {
          console.log(`  - ${col.column_name}: ${col.data_type} ${col.column_default ? `(default: ${col.column_default})` : ''}`);
        });
        
        // 4. 检查关键字段是否存在
        const requiredFields = ['digital_assets', 'stages', 'team_members', 'progress', 'updated_at'];
        const existingFields = columnsResult.rows.map(r => r.column_name);
        
        console.log('\n🔍 关键字段检查:');
        requiredFields.forEach(field => {
          const exists = existingFields.includes(field);
          console.log(`  ${exists ? '✅' : '❌'} ${field}: ${exists ? '存在' : '缺失'}`);
        });
        
        // 5. 测试更新操作
        console.log('\n📝 测试更新操作...');
        const testProjectId = 'proj-1775203736057'; // 朝鲜店
        
        try {
          await client.query('BEGIN');
          
          const updateResult = await client.query(`
            UPDATE projects
            SET digital_assets = $1::jsonb,
                stages = $2::jsonb,
                team_members = $3::jsonb,
                progress = $4,
                updated_at = NOW()
            WHERE id = $5
            RETURNING id, digital_assets, stages, team_members, progress
          `, [
            JSON.stringify([{ id: 'test', name: 'test.glb', type: 'model' }]),
            JSON.stringify([{ id: 'stage1', name: '测试阶段' }]),
            JSON.stringify([{ id: 'member1', name: '测试成员' }]),
            50,
            testProjectId
          ]);
          
          await client.query('ROLLBACK'); // 回滚测试数据
          
          if (updateResult.rowCount > 0) {
            console.log('✅ 更新操作成功!');
            console.log('  更新后的数据:', JSON.stringify(updateResult.rows[0], null, 2));
          } else {
            console.log('⚠️  未找到项目:', testProjectId);
          }
        } catch (updateErr) {
          await client.query('ROLLBACK');
          console.error('❌ 更新操作失败:', updateErr.message);
        }
        
        // 6. 查询一个实际项目的数据
        console.log('\n📖 查询实际项目数据...');
        const projectResult = await client.query(`
          SELECT id, name, digital_assets, stages, team_members, progress
          FROM projects
          WHERE id = $1
        `, [testProjectId]);
        
        if (projectResult.rows.length > 0) {
          const project = projectResult.rows[0];
          console.log('项目:', project.name);
          console.log('  digital_assets:', project.digital_assets ? '有数据' : '空');
          console.log('  stages:', project.stages ? '有数据' : '空');
          console.log('  team_members:', project.team_members ? '有数据' : '空');
          console.log('  progress:', project.progress);
        } else {
          console.log('未找到项目:', testProjectId);
        }
      }
      
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('❌ 数据库测试失败:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

testDatabase();
