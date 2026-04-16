import pool from './db.js';

async function listTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('--- Public Tables ---');
    result.rows.forEach(row => {
      console.log(row.table_name);
    });
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listTables();
