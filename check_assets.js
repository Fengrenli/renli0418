import pool from './db.js';
(async () => {
  try {
    const res = await pool.query('SELECT digital_assets FROM projects WHERE id = $1', ['proj-1774851876525']);
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();