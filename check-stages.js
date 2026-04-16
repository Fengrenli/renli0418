import pool from './db.js';
async function check() {
  const r = await pool.query('SELECT stages FROM projects WHERE id = $1', ['proj-1775203993102']);
  console.log('Stages in DB:', JSON.stringify(r.rows[0].stages, null, 2));
  await pool.end();
}
check();
