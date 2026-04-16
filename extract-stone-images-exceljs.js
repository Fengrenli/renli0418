import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';

// 配置
const excelPath = 'C:\\Users\\Admin\\Desktop\\material\\materials.xlsx';
const outputDir = 'C:\\Users\\Admin\\Desktop\\material\\materials\\定制石材制品';

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`创建输出目录: ${outputDir}`);
}

// 读取Excel文件并提取图片
async function extractStoneImages() {
  try {
    console.log('正在读取Excel文件...');
    
    // 创建工作簿对象
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    
    // 获取所有工作表名称
    const sheetNames = workbook.worksheets.map(sheet => sheet.name);
    console.log('工作表列表:', sheetNames);
    
    // 查找包含"定制石材制品"的工作表
    let stoneSheet = null;
    for (const sheetName of sheetNames) {
      if (sheetName.includes('定制石材制品') || sheetName.includes('石材')) {
        stoneSheet = workbook.getWorksheet(sheetName);
        console.log(`找到工作表: ${sheetName}`);
        break;
      }
    }
    
    if (!stoneSheet) {
      console.error('未找到定制石材制品工作表');
      return;
    }
    
    // 读取工作表数据
    const rows = stoneSheet.getRows(1, stoneSheet.rowCount);
    console.log(`工作表包含 ${rows.length} 行数据`);
    
    // 处理数据
    let imageCount = 0;
    
    // 提取工作表中的所有图片
    const images = stoneSheet.getImages();
    console.log(`工作表包含 ${images.length} 张图片`);
    
    // 遍历图片
    images.forEach((image, index) => {
      try {
        // 检查图片对象的结构
        console.log(`图片 ${index + 1} 结构:`, Object.keys(image));
        
        // 尝试不同的属性获取图片数据
        let imageBuffer = null;
        
        // 尝试直接获取图片数据
        if (image.buffer) {
          imageBuffer = image.buffer;
        } else if (image.rId) {
          // 尝试通过rId获取图片
          console.log(`图片 ${index + 1} rId:`, image.rId);
        } else if (image.image) {
          imageBuffer = image.image;
        }
        
        if (imageBuffer) {
          // 生成图片文件名
          const imageName = `STONE-${index + 1}.png`;
          const imagePath = path.join(outputDir, imageName);
          
          // 保存图片
          fs.writeFileSync(imagePath, imageBuffer);
          console.log(`保存图片: ${imageName}`);
          imageCount++;
        } else {
          console.log(`图片 ${index + 1} 没有找到图片数据`);
        }
      } catch (error) {
        console.error(`处理图片 ${index + 1} 时出错:`, error);
      }
    });
    
    console.log(`处理完成，共提取 ${imageCount} 张图片`);
    
  } catch (error) {
    console.error('处理Excel文件时出错:', error);
  }
}

// 运行提取函数
extractStoneImages().catch(console.error);