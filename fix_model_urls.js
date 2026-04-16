// 修复数据库中硬编码的localhost:3000 URL
import pool from './db.js';

async function fixModelUrls() {
  try {
    console.log('开始修复模型URL...');
    
    // 连接数据库
    const client = await pool.connect();
    
    try {
      // 获取所有项目
      const projectsResult = await client.query('SELECT id, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
      
      for (const project of projectsResult.rows) {
        const { id, digital_assets } = project;
        
        if (digital_assets && Array.isArray(digital_assets)) {
          const updatedAssets = digital_assets.map(asset => {
            if (asset.url && asset.url.includes('http://localhost:3000')) {
              // 替换为相对路径
              const relativeUrl = asset.url.replace('http://localhost:3000', '');
              console.log(`更新项目 ${id} 的资产URL: ${asset.url} -> ${relativeUrl}`);
              return { ...asset, url: relativeUrl };
            }
            return asset;
          });
          
          // 检查是否有更新
          const hasChanges = digital_assets.some((asset, index) => 
            asset.url !== updatedAssets[index].url
          );
          
          if (hasChanges) {
            // 更新数据库
            await client.query(
              'UPDATE projects SET digital_assets = $1 WHERE id = $2',
              [JSON.stringify(updatedAssets), id]
            );
            console.log(`项目 ${id} 的URL已更新`);
          }
        }
      }
      
      console.log('模型URL修复完成！');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('修复模型URL时出错:', error);
  } finally {
    // 关闭连接池
    pool.end();
  }
}

// 运行修复脚本
fixModelUrls();
