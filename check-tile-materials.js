import pool from './db.js';
async function check() {
  try {
    const tiles = await pool.query("SELECT code, name, price, unit, image, category FROM materials WHERE name LIKE '% 瑨 %' OR category LIKE '% 瑨 %' OR code LIKE '%ETH%' OR code LIKE '%DET%' OR code LIKE '%8D5%' ORDER BY code");
    console.log('=== TILES (擧) ===');
    tiles.rows.forEach(r => console.log(JSON.stringify(r)));
    
    const bricks = await pool.query("SELECT code, name, price, unit, image, category FROM materials WHERE name LIKE '% 磫 %' OR category LIKE '% 磫 %' OR code LIKE '%MRR%' OR code LIKE '%CEC%' ORDER BY code");
    console.log('=== BRICKS (纹) ===');
    bricks.rows.forEach(r => console.log(JSON.stringify(r)));
    
    const others = await pool.query("SELECT code, name, price, unit, image, category FROM materials WHERE name LIKE '%脂%' OR name LIKE '%滝水%' OR name LIKE '%挡沟%' OR code LIKE '%HRG%' OR code LIKE '%TIE%' OR code LIKE '%RAF%' ORDER BY code");
    console.log('=== OTHERS (蒤/滭水/挡沟) ===');
    others.rows.forEach(r => console.log(JSOn.stringify(r)));
  } catch (err) {
    console.error('Database query failed:', err);
  } finally {
    await pool.end();
  }
}
check();