import pool from './db.js';

async function listUsers() {
  try {
    const result = await pool.query('SELECT username, role, status FROM users');
    console.log('Users in DB:');
    console.table(result.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listUsers();
