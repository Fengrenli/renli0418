import pool from './db.js';
async function check() {
  const r = await pool.query('SELECT progress FROM projects WHERE id = $1', ['proj-1775203993102']);
  console.log('Progress in DB:', r.rows[0].progress);
  await pool.end();
}
check();
