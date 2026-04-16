import pool from './db.js';
import bcrypt from 'bcrypt';

async function checkAdmin() {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
    if (result.rowCount === 0) {
      console.log('Admin user missing. Creating default admin...');
      const hashed = await bcrypt.hash('Renli2026', 10);
      await pool.query(
        'INSERT INTO users (username, password, role, status) VALUES ($1, $2, $3, $4)',
        ['admin', hashed, 'admin', 'active']
      );
      console.log('✅ Admin user created: admin / Renli2026');
    } else {
      console.log('✅ Admin user exists.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkAdmin();
