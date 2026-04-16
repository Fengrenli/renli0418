import pool from './db.js';

async function checkRecentUpdates() {
  try {
    const result = await pool.query(`
      SELECT id, name, updated_at, digital_assets 
      FROM projects 
      ORDER BY updated_at DESC 
      LIMIT 5
    `);
    
    console.log('--- 5 Most Recently Updated Projects ---');
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}, Name: ${row.name}, UpdatedAt: ${row.updated_at}`);
      console.log('Digital Assets:', row.digital_assets);
      console.log('----------------------------------------');
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkRecentUpdates();
