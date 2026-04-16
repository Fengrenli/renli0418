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

async function checkBrandTable() {
  try {
    // 检查品牌表结构
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'brands' 
      ORDER BY ordinal_position;
    `);
    console.log('Brand table columns:');
    console.log(JSON.stringify(columnsRes.rows, null, 2));

    // 尝试插入简化的数据
    const brands = [
      { name: '小龙坎', description: '小龙坎火锅品牌' },
      { name: '吼堂', description: '吼堂火锅品牌' },
      { name: '镇堂子', description: '镇堂子火锅品牌' }
    ];

    for (const brand of brands) {
      await pool.query(
        'INSERT INTO brands (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
        [brand.name, brand.description]
      );
    }
    console.log('品牌数据插入成功');

    // 查看品牌表数据
    const dataRes = await pool.query('SELECT * FROM brands');
    console.log('品牌表数据:', dataRes.rows);

  } catch (err) {
    console.error('检查品牌表失败:', err);
  } finally {
    await pool.end();
  }
}

checkBrandTable();
