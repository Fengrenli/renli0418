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

async function addBrandToProjects() {
  try {
    // 为项目表添加品牌ID字段
    await pool.query(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS brand_id INTEGER,
      ADD CONSTRAINT fk_brand 
      FOREIGN KEY (brand_id) 
      REFERENCES brands(id);
    `);
    console.log('项目表添加品牌字段成功');

    // 更新现有项目的品牌信息
    // 先获取品牌ID
    const brandRes = await pool.query('SELECT id, name FROM brands');
    const brandMap = new Map();
    brandRes.rows.forEach(brand => {
      brandMap.set(brand.name, brand.id);
    });

    // 获取所有项目
    const projectsRes = await pool.query('SELECT id, name FROM projects');
    
    for (const project of projectsRes.rows) {
      let brandId = null;
      
      // 根据项目名称判断品牌
      if (project.name.includes('小龙坎')) {
        brandId = brandMap.get('小龙坎');
      } else if (project.name.includes('吼堂')) {
        brandId = brandMap.get('吼堂');
      } else if (project.name.includes('镇堂子')) {
        brandId = brandMap.get('镇堂子');
      }
      
      if (brandId) {
        await pool.query(
          'UPDATE projects SET brand_id = $1 WHERE id = $2',
          [brandId, project.id]
        );
        const matchedBrand = Array.from(brandMap.entries()).find(([, id]) => id === brandId);
        console.log(`更新项目 ${project.name} 的品牌为 ${matchedBrand ? matchedBrand[0] : '未知品牌'}`);
      }
    }

    // 查看更新后的项目数据
    const updatedRes = await pool.query('SELECT p.id, p.name, b.name as brand_name FROM projects p LEFT JOIN brands b ON p.brand_id = b.id LIMIT 5');
    console.log('更新后的项目数据:', updatedRes.rows);

  } catch (err) {
    console.error('更新项目品牌字段失败:', err);
  } finally {
    await pool.end();
  }
}

addBrandToProjects();
