const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 数据库配置
const dbConfig = {
  host: 'rm-cn-pj64od8bk00014zo.rwlb.rds.aliyuncs.com',
  user: 'renli_2026',
  password: 'Gd889988#',
  database: 'renli_company',
  port: 5432,
  ssl: false
};

// 材料文件夹路径
const materialsPath = 'C:\\Users\\Admin\\Desktop\\material\\materials';

async function updateMaterialCategories() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('开始更新材料分类...');
    
    // 读取文件夹结构
    const categories = fs.readdirSync(materialsPath);
    console.log('找到分类:', categories);
    
    let updatedCount = 0;
    
    // 遍历每个分类
    for (const category of categories) {
      const categoryPath = path.join(materialsPath, category);
      if (!fs.statSync(categoryPath).isDirectory()) continue;
      
      console.log(`处理分类: ${category}`);
      
      // 读取分类下的文件
      const files = fs.readdirSync(categoryPath);
      
      // 遍历每个文件
      for (const file of files) {
        if (!file.endsWith('.png')) continue;
        
        // 提取材料代码（文件名去掉扩展名）
        const materialCode = file.replace('.png', '');
        
        // 更新数据库中的分类
        try {
          const result = await pool.query(
            'UPDATE materials SET category = $1 WHERE code = $2',
            [category, materialCode]
          );
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`更新材料 ${materialCode} 分类为 ${category}`);
          }
        } catch (error) {
          console.error(`更新材料 ${materialCode} 时出错:`, error.message);
        }
      }
    }
    
    console.log(`更新完成，共更新 ${updatedCount} 个材料的分类`);
    
  } catch (error) {
    console.error('更新分类时出错:', error);
  } finally {
    await pool.end();
  }
}

// 执行更新
updateMaterialCategories();
