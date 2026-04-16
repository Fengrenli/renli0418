import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟服务器环境
console.log('=== 测试扫描逻辑 ===\n');

// 测试1: 使用 __dirname 的 uploads
const scriptDirUploads = path.join(__dirname, 'uploads');
console.log('1. 脚本目录下的 uploads:', scriptDirUploads);
console.log('   存在:', fs.existsSync(scriptDirUploads));

// 测试2: 使用 process.cwd() 的 uploads  
const cwdUploads = path.join(process.cwd(), 'uploads');
console.log('\n2. 工作目录下的 uploads:', cwdUploads);
console.log('   存在:', fs.existsSync(cwdUploads));

// 测试3: 列出 uploads 下的所有项目目录
const uploadsDir = fs.existsSync(cwdUploads) ? cwdUploads : scriptDirUploads;
console.log('\n3. 实际使用的 uploadsDir:', uploadsDir);

if (fs.existsSync(uploadsDir)) {
  const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  console.log('   目录列表:', dirs);
  
  // 测试4: 扫描特定项目目录
  const testProjectId = 'proj-1775203736057';
  console.log('\n4. 测试扫描项目:', testProjectId);
  
  const projectDir = path.join(uploadsDir, testProjectId);
  console.log('   项目目录路径:', projectDir);
  console.log('   目录存在:', fs.existsSync(projectDir));
  
  if (fs.existsSync(projectDir)) {
    const files = fs.readdirSync(projectDir);
    console.log('   文件列表:', files);
    
    // 生成 digitalAssets 格式
    const assets = files.map((fileName, idx) => ({
      id: `asset-fs-${testProjectId}-${idx}`,
      name: fileName,
      type: fileName.endsWith('.glb') ? 'model' : 'file',
      url: `/uploads/${testProjectId}/${encodeURIComponent(fileName)}`,
      size: 'unknown',
      uploadDate: new Date().toISOString().split('T')[0]
    }));
    
    console.log('\n5. 生成的 digitalAssets:');
    console.log(JSON.stringify(assets, null, 2));
  } else {
    console.log('   ❌ 项目目录不存在！');
  }
} else {
  console.log('   ❌ uploads 目录不存在！');
}

console.log('\n=== 测试完成 ===');
