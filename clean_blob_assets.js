// Clean up blob URLs in digital assets
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'rm-cn-pj64od8bk00014zo.rwlb.rds.aliyuncs.com',
  user: process.env.DB_USER || 'renli_2026',
  password: process.env.DB_PASSWORD || 'Gd889988#',
  database: process.env.DB_DATABASE || 'renli_company',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function cleanBlobAssets() {
  try {
    console.log('开始清理数据库中的blob URL...');
    
    // 获取所有项目
    const projectsResult = await pool.query('SELECT id, digital_assets FROM projects');
    
    for (const project of projectsResult.rows) {
      if (project.digital_assets && Array.isArray(project.digital_assets)) {
        // 过滤掉blob URL的资产
        const filteredAssets = project.digital_assets.filter(asset => 
          asset.url && !asset.url.startsWith('blob:')
        );
        
        if (filteredAssets.length !== project.digital_assets.length) {
          // 更新项目的数字资产，确保传递正确的JSON字符串
          await pool.query(
            'UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2',
            [JSON.stringify(filteredAssets), project.id]
          );
          console.log(`清理项目 ${project.id} 的数字资产：${project.digital_assets.length} -> ${filteredAssets.length}`);
        }
      }
    }
    
    console.log('清理完成！');
  } catch (error) {
    console.error('清理过程中出错：', error);
  } finally {
    await pool.end();
  }
}

cleanBlobAssets();
