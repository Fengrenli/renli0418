import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

// 读取CSV文件并处理编码问题
function processMaterials() {
  const csvPath = 'C:\\Users\\Admin\\Desktop\\material\\material_img_urls.csv';
  const outputPath = 'C:\\Users\\Admin\\Desktop\\material\\processed_materials.json';
  
  try {
    // 读取CSV文件，使用二进制模式
    const binaryContent = fs.readFileSync(csvPath);
    // 使用iconv-lite将GBK编码转换为UTF8
    const utf8Content = iconv.decode(binaryContent, 'gbk');
    
    // 解析CSV文件
    const lines = utf8Content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const materials = [];
    
    // 处理每一行数据
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // 处理CSV中的逗号和引号
      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());
      
      // 创建材料对象
      const material = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          material[header] = values[index];
        }
      });
      
      // 提取需要的字段（根据列索引）
      const processedMaterial = {
        code: values[0] || '', // ITEM CODE
        name: values[1] || '', // 物料名称
        image: values[3] || '', // 图片URL
        area: '', // 默认为空
        price: 0, // 默认为0
        unit: '' // 默认为空
      };
      
      // 过滤掉无效数据
      if (processedMaterial.code) {
        materials.push(processedMaterial);
      }
    }
    
    // 生成JSON文件
    const outputData = {
      materials: materials
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    
    console.log(`成功处理 ${materials.length} 条材料数据`);
    console.log(`处理后的数据已保存到: ${outputPath}`);
    
  } catch (error) {
    console.error('处理材料数据时出错:', error);
  }
}

// 运行处理函数
processMaterials();