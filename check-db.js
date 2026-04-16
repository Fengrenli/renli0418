import pool from './db.js';

async function checkDatabase() {
  try {
    console.log('=== 检查数据库数据 ===\n');
    
    // 检查项目表
    console.log('1. 检查 projects 表:');
    const projectsResult = await pool.query('SELECT COUNT(*) as count FROM projects');
    console.log(`   项目总数: ${projectsResult.rows[0].count}`);
    
    if (projectsResult.rows[0].count > 0) {
      const projects = await pool.query('SELECT id, name, client_name, status, created_at FROM projects LIMIT 5');
      console.log('   最近5个项目:');
      projects.rows.forEach(p => {
        console.log(`     - ${p.name} (${p.client_name}) - ${p.status}`);
      });
    }
    
    // 检查材料表
    console.log('\n2. 检查 materials 表:');
    const materialsResult = await pool.query('SELECT COUNT(*) as count FROM materials');
    console.log(`   材料总数: ${materialsResult.rows[0].count}`);
    
    if (materialsResult.rows[0].count > 0) {
      const materials = await pool.query('SELECT code, name, category, price FROM materials LIMIT 5');
      console.log('   最近5个材料:');
      materials.rows.forEach(m => {
        console.log(`     - ${m.name} (${m.code}) - ${m.category || '无分类'}`);
      });
    }
    
    // 检查品牌表
    console.log('\n3. 检查 brands 表:');
    const brandsResult = await pool.query('SELECT COUNT(*) as count FROM brands');
    console.log(`   品牌总数: ${brandsResult.rows[0].count}`);
    
    if (brandsResult.rows[0].count > 0) {
      const brands = await pool.query('SELECT id, name FROM brands LIMIT 5');
      console.log('   品牌列表:');
      brands.rows.forEach(b => {
        console.log(`     - ${b.name}`);
      });
    }
    
    console.log('\n=== 检查完成 ===');
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();
