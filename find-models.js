import pool from './db.js';

async function findProjectsWithModels() {
  try {
    const result = await pool.query(`
      SELECT id, name, digital_assets 
      FROM projects 
      WHERE digital_assets IS NOT NULL 
        AND digital_assets::text != '[]' 
      LIMIT 10
    `);
    
    console.log('--- Projects with Assets ---');
    result.rows.forEach(row => {
      const assets = typeof row.digital_assets === 'string' ? JSON.parse(row.digital_assets) : row.digital_assets;
      const model = assets.find(a => a.type === 'model');
      if (model) {
        console.log(`ID: ${row.id}, Name: ${row.name}, Model: ${model.name}`);
      }
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

findProjectsWithModels();
