import pool from './db.js';
import bcrypt from 'bcrypt';

async function checkPass() {
  const r = await pool.query('SELECT password FROM users WHERE username = $1', ['admin']);
  const hash = r.rows[0].password;
  console.log('Hash in DB:', hash);
  const match = await bcrypt.compare('Renli2026', hash);
  console.log('Match with "Renli2026":', match);
  await pool.end();
}
checkPass();
