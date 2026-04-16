import pool from './db.js';

async function fix() {
  try {
    const r = await pool.query('SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
    let fixedCount = 0;
    for (const row of r.rows) {
      const raw = row.digital_assets;
      if (!Array.isArray(raw)) continue;
      
      const cleaned = raw.filter(i => i != null && typeof i === 'object' && !Array.isArray(i) && i.url);
      const diff = raw.length - cleaned.length;
      
      if (diff > 0) {
        fixedCount++;
        console.log(`Project ${row.id}: removed ${diff} malformed assets`);
        await pool.query('UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2', [JSON.stringify(cleaned), row.id]);
      }
    }
    console.log('Total projects fixed:', fixedCount);
  } catch (err) {
    console.error('Error during fix:', err);
  } finally {
    await pool.end();
  }
}

fix();
