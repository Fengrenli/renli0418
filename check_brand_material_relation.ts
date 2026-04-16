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

async function checkBrandMaterialRelation() {
  try {
    // 检查brands表结构
    const brandsColumnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'brands' 
      ORDER BY ordinal_position;
    `);
    console.log('Brands table columns:');
    console.log(JSON.stringify(brandsColumnsRes.rows, null, 2));

    // 检查materials表结构
    const materialsColumnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'materials' 
      ORDER BY ordinal_position;
    `);
    console.log('Materials table columns:');
    console.log(JSON.stringify(materialsColumnsRes.rows, null, 2));

    // 检查现有品牌数据
    const brandsRes = await pool.query('SELECT id, name FROM brands');
    console.log('Brands data:');
    console.log(JSON.stringify(brandsRes.rows, null, 2));

    // 检查物料数据中的品牌字段
    const materialsRes = await pool.query('SELECT id, name, brand FROM materials LIMIT 10');
    console.log('Materials data (first 10):');
    console.log(JSON.stringify(materialsRes.rows, null, 2));

  } catch (err) {
    console.error('检查品牌与物料关系失败:', err);
  } finally {
    await pool.end();
  }
}

checkBrandMaterialRelation();
