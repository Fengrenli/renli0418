import pool from './db.js';
async function checkSchema() {
  const matCols = await pool.query(\"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'materials'\");
  console.log('=== MATERIALS TABLE SCHEMA ===');
  matCols.rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type));
  const tables = await pool.query(\"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\");
  console.log('\n=== ALL PUBLIC TABLES ===');
  tables.rows.forEach(r => console.log('  ' + r.table_name));
  const samples = await pool.query(\"SELECT * FROM materials LIMIT 10\");
  console.log('\n=== SAMPLE MATERIALS ===');
  samples.rows.forEach(r => console.log(JSON.stringify(r)));
  await pool.end();
}
checkSchema();
