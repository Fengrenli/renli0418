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

async function addRestaurantBrandToMaterials() {
  try {
    // 为物料表添加餐饮品牌ID字段
    await pool.query(`
      ALTER TABLE materials 
      ADD COLUMN IF NOT EXISTS restaurant_brand_id INTEGER,
      ADD CONSTRAINT fk_restaurant_brand 
      FOREIGN KEY (restaurant_brand_id) 
      REFERENCES brands(id);
    `);
    console.log('物料表添加餐饮品牌字段成功');

    // 为现有物料添加餐饮品牌关联
    // 这里可以根据实际情况设置默认关联，例如将所有物料关联到小龙坎
    await pool.query(`
      UPDATE materials 
      SET restaurant_brand_id = 1 
      WHERE restaurant_brand_id IS NULL;
    `);
    console.log('物料餐饮品牌关联更新成功');

    // 查看更新后的物料数据
    const materialsRes = await pool.query('SELECT id, name, brand, restaurant_brand_id FROM materials LIMIT 5');
    console.log('更新后的物料数据:', materialsRes.rows);

  } catch (err) {
    console.error('添加餐饮品牌字段失败:', err);
  } finally {
    await pool.end();
  }
}

addRestaurantBrandToMaterials();
