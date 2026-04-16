import pool from './db.js';

async function checkProjectsSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects'
      ORDER BY ordinal_position
    `);
    
    console.log('--- Schema for projects ---');
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkProjectsSchema();
