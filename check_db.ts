import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function checkSchema() {
  try {
    // Check materials table schema
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'materials';
    `);
    console.log('Schema for materials table:');
    console.log(JSON.stringify(res.rows, null, 2));

    // Check projects table schema
    const projRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects';
    `);
    console.log('Schema for projects table:');
    console.log(JSON.stringify(projRes.rows, null, 2));

    // Check projects data
    const projDataRes = await pool.query(`SELECT * FROM projects LIMIT 10`);
    console.log('Projects data (first 10):');
    console.log(JSON.stringify(projDataRes.rows, null, 2));

    // Check users data
    const usersRes = await pool.query(`SELECT * FROM users`);
    console.log('Users data:');
    console.log(JSON.stringify(usersRes.rows, null, 2));
  } catch (err) {
    console.error('Error checking schema:', err);
  } finally {
    await pool.end();
  }
}

checkSchema();
