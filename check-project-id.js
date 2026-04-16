import pool from './db.js';

async function checkProjectId() {
  try {
    console.log('=== 检查项目 ID 格式 ===\n');
    
    // 查找朝鲜店项目
    const result = await pool.query(
      "SELECT id, name, digital_assets FROM projects WHERE name LIKE '%朝鲜%'"
    );
    
    if (result.rows.length === 0) {
      console.log('未找到朝鲜店项目');
      return;
    }
    
    const project = result.rows[0];
    console.log('项目信息:');
    console.log('  - 名称:', project.name);
    console.log('  - ID:', project.id);
    console.log('  - ID 长度:', project.id.length);
    console.log('  - ID 前缀:', project.id.substring(0, 10));
    console.log('  - digital_assets:', project.digital_assets);
    console.log('  - digital_assets 类型:', typeof project.digital_assets);
    
    // 检查 uploads 目录中的项目文件夹名称
    console.log('\n=== 对比 uploads 目录 ===');
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadsDir = '/www/wwwroot/renliyesheng/uploads';
    if (fs.existsSync(uploadsDir)) {
      const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      console.log('uploads 目录中的文件夹:');
      dirs.forEach(d => {
        console.log(`  - ${d}`);
        console.log(`    长度: ${d.length}`);
        console.log(`    前缀: ${d.substring(0, 10)}`);
        console.log(`    是否匹配: ${d === project.id}`);
      });
    }
    
    console.log('\n=== 检查完成 ===');
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkProjectId();
