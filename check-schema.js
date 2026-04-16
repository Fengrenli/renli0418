import pool from './db.js';

async function checkSchema(tableName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    
    console.log(`--- Schema for ${tableName} ---`);
    result.rows.forEach(row => {
      console.log(`${row.column_name}: ${row.data_type}`);
    });
    
  } catch (err) {
    console.error(err);
  }
}

async function run() {
  await checkSchema('campaign_application');
  await checkSchema('users');
  await checkSchema('brands');
  await pool.end();
}

run();
