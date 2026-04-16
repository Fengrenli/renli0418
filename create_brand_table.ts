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

async function createBrandTable() {
  try {
    // 创建品牌表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        logo_url VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('品牌表创建成功');

    // 插入初始品牌数据
    const brands = [
      { name: '小龙坎', logo_url: null, description: '小龙坎火锅品牌' },
      { name: '吼堂', logo_url: null, description: '吼堂火锅品牌' },
      { name: '镇堂子', logo_url: null, description: '镇堂子火锅品牌' }
    ];

    for (const brand of brands) {
      await pool.query(
        'INSERT INTO brands (name, logo_url, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
        [brand.name, brand.logo_url, brand.description]
      );
    }
    console.log('初始品牌数据插入成功');

    // 查看品牌表数据
    const res = await pool.query('SELECT * FROM brands');
    console.log('品牌表数据:', res.rows);

  } catch (err) {
    console.error('创建品牌表失败:', err);
  } finally {
    await pool.end();
  }
}

createBrandTable();
