import http from 'http';
import fs from 'fs';

// 读取处理后的数据
const materialsPath = 'C:\\Users\\Admin\\Desktop\\material\\processed_materials.json';

// 读取JSON文件
const materialsData = JSON.parse(fs.readFileSync(materialsPath, 'utf8'));
const materials = materialsData.materials;

// 批量上传材料数据
async function uploadMaterials() {
  console.log(`准备上传 ${materials.length} 条材料数据`);
  
  // 分批次上传，每批10条
  const batchSize = 10;
  const totalBatches = Math.ceil(materials.length / batchSize);
  
  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, materials.length);
    const batchMaterials = materials.slice(start, end);
    
    console.log(`上传第 ${batch + 1} 批，共 ${batchMaterials.length} 条数据`);
    
    // 创建请求数据
    const postData = JSON.stringify({
      materials: batchMaterials
    });
    
    // 创建请求选项
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/seed-materials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    // 发送请求
    await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          console.log(`第 ${batch + 1} 批上传结果:`, data);
          resolve(data);
        });
      });
      
      req.on('error', (e) => {
        console.error(`请求错误: ${e.message}`);
        reject(e);
      });
      
      // 写入数据到请求体
      req.write(postData);
      req.end();
    });
    
    // 等待1秒，避免服务器过载
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('所有材料数据上传完成！');
}

// 运行上传函数
uploadMaterials().catch(console.error);