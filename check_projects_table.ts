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

async function checkProjectsTable() {
  try {
    // 检查项目表的完整结构
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      ORDER BY ordinal_position;
    `);
    console.log('Projects table columns:');
    console.log(JSON.stringify(columnsRes.rows, null, 2));

    // 检查项目数据，看看是否有品牌相关信息
    const dataRes = await pool.query(`SELECT id, name, location, status FROM projects LIMIT 5`);
    console.log('\nProjects data sample:');
    console.log(JSON.stringify(dataRes.rows, null, 2));
  } catch (err) {
    console.error('Error checking projects table:', err);
  } finally {
    await pool.end();
  }
}

checkProjectsTable();
