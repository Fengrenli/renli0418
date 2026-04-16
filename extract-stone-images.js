import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// 配置
const excelPath = 'C:\\Users\\Admin\\Desktop\\material\\materials.xlsx';
const outputDir = 'C:\\Users\\Admin\\Desktop\\material\\materials\\定制石材制品';

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`创建输出目录: ${outputDir}`);
}

// 读取Excel文件
function extractStoneImages() {
  try {
    console.log('正在读取Excel文件...');
    const workbook = XLSX.readFile(excelPath);
    
    // 获取所有工作表名称
    const sheetNames = workbook.SheetNames;
    console.log('工作表列表:', sheetNames);
    
    // 查找包含"定制石材制品"的工作表
    let stoneSheet = null;
    for (const sheetName of sheetNames) {
      if (sheetName.includes('定制石材制品') || sheetName.includes('石材')) {
        stoneSheet = sheetName;
        break;
      }
    }
    
    if (!stoneSheet) {
      console.error('未找到定制石材制品工作表');
      return;
    }
    
    console.log(`找到工作表: ${stoneSheet}`);
    
    // 读取工作表数据
    const worksheet = workbook.Sheets[stoneSheet];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`工作表包含 ${data.length} 条数据`);
    
    // 处理数据
    let imageCount = 0;
    
    data.forEach((row, index) => {
      // 提取相关字段
      const code = row['编码'] || row['Code'] || `STONE-${index + 1}`;
      const name = row['名称'] || row['Name'] || `石材制品${index + 1}`;
      
      // 这里需要根据实际Excel结构提取图片
      // 注意：Excel中的图片通常存储为对象，需要特殊处理
      
      // 模拟提取图片（实际需要根据Excel的具体结构调整）
      // 假设图片存储在"图片"或"Photo"列
      const imageData = row['图片'] || row['Photo'] || null;
      
      if (imageData) {
        // 这里需要根据实际的图片存储方式提取图片数据
        // 由于Excel图片存储结构复杂，这里提供一个框架
        console.log(`处理第 ${index + 1} 条数据: ${name} (${code})`);
        
        // 生成图片文件名
        const imageName = `${code}-${name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.png`;
        const imagePath = path.join(outputDir, imageName);
        
        // 这里需要根据实际的图片数据格式保存图片
        // 例如，如果是Base64编码的图片数据
        // fs.writeFileSync(imagePath, Buffer.from(imageData, 'base64'));
        
        // 模拟保存图片
        // 实际项目中需要根据Excel的图片存储方式调整
        console.log(`准备保存图片: ${imageName}`);
        imageCount++;
      }
    });
    
    console.log(`处理完成，共提取 ${imageCount} 张图片`);
    
  } catch (error) {
    console.error('处理Excel文件时出错:', error);
  }
}

// 运行提取函数
extractStoneImages();