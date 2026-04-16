import pool from './db.js';

async function testQuery() {
  try {
    const result = await pool.query('SELECT id, username, role, brand_id, status, created_at FROM users ORDER BY created_at DESC');
    console.log('✅ Query success:', result.rows.length, 'rows');
  } catch (err) {
    console.log('❌ Query failed:', err.message);
  } finally {
    await pool.end();
  }
}

testQuery();
