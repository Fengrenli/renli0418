import pool from './db.js';

async function debug() {
  // 直接查数据库
  const r = await pool.query('SELECT id, name, digital_assets FROM projects WHERE id = $1', ['proj-1774851876525']);
  const row = r.rows[0];
  console.log('=== RAW DB ROW ===');
  console.log('digital_assets type:', typeof row.digital_assets);
  console.log('digital_assets value:', JSON.stringify(row.digital_assets));
  
  // 检查所有有资产的项目
  const r2 = await pool.query("SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL AND digital_assets::text != '[]' AND digital_assets::text != 'null'");
  console.log('\n=== PROJECTS WITH ASSETS ===');
  r2.rows.forEach(row => {
    const assets = typeof row.digital_assets === 'string' ? JSON.parse(row.digital_assets) : row.digital_assets;
    console.log(`${row.id} | ${row.name} | ${Array.isArray(assets) ? assets.length : 0} assets`);
    if (Array.isArray(assets)) {
      assets.forEach(a => console.log(`  → ${a.name} | ${a.url}`));
    }
  });
  
  await pool.end();
}
debug();
