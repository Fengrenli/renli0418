import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

async function fixOrphanUploads() {
  try {
    console.log('=== 检查数据库中的资产引用 ===\n');

    // 1. 获取所有项目的 digital_assets
    const result = await pool.query('SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
    
    let totalAssets = 0;
    let brokenRefs = [];
    let goodRefs = [];

    for (const row of result.rows) {
      let assets = row.digital_assets;
      if (typeof assets === 'string') {
        try { assets = JSON.parse(assets); } catch(e) { assets = []; }
      }
      if (!Array.isArray(assets) || assets.length === 0) continue;

      console.log(`\n📁 项目: ${row.name} (${row.id})`);
      console.log(`   资产数: ${assets.length}`);
      
      for (const asset of assets) {
        totalAssets++;
        const url = asset.url || '';
        
        // 检查文件是否实际存在
        let filePath = '';
        if (url.startsWith('/uploads/')) {
          filePath = path.join(__dirname, url);
        } else if (url.startsWith('uploads/')) {
          filePath = path.join(__dirname, url);
        } else {
          filePath = path.join(uploadsDir, url);
        }

        const exists = fs.existsSync(filePath);
        const status = exists ? '✅' : '❌';
        console.log(`   ${status} ${asset.name} → ${url}`);
        
        if (!exists) {
          // 尝试在 uploads 根目录搜索同名文件
          const fileName = path.basename(url);
          const rootPath = path.join(uploadsDir, fileName);
          const defaultPath = path.join(uploadsDir, 'default', fileName);
          
          if (fs.existsSync(rootPath)) {
            console.log(`      🔍 找到在 uploads/ 根目录: ${fileName}`);
            brokenRefs.push({ projectId: row.id, projectName: row.name, asset, foundAt: rootPath, shouldBe: filePath });
          } else if (fs.existsSync(defaultPath)) {
            console.log(`      🔍 找到在 uploads/default/: ${fileName}`);
            brokenRefs.push({ projectId: row.id, projectName: row.name, asset, foundAt: defaultPath, shouldBe: filePath });
          } else {
            console.log(`      ⚠️  文件完全不存在`);
            brokenRefs.push({ projectId: row.id, projectName: row.name, asset, foundAt: null, shouldBe: filePath });
          }
        } else {
          goodRefs.push({ projectId: row.id, asset });
        }
      }
    }

    // 2. 检查 uploads 根目录的孤儿文件
    console.log('\n\n=== 检查 uploads 根目录孤儿文件 ===\n');
    const rootFiles = fs.readdirSync(uploadsDir).filter(f => {
      const stat = fs.statSync(path.join(uploadsDir, f));
      return stat.isFile();
    });
    
    console.log(`孤儿文件数: ${rootFiles.length}`);
    rootFiles.forEach(f => {
      const ext = path.extname(f).toLowerCase();
      const size = (fs.statSync(path.join(uploadsDir, f)).size / 1024).toFixed(0);
      console.log(`  📄 ${f} (${size} KB) [${ext}]`);
    });

    // 3. 检查 default 目录
    const defaultDir = path.join(uploadsDir, 'default');
    if (fs.existsSync(defaultDir)) {
      const defaultFiles = fs.readdirSync(defaultDir).filter(f => {
        const stat = fs.statSync(path.join(defaultDir, f));
        return stat.isFile();
      });
      console.log(`\nuploads/default/ 文件数: ${defaultFiles.length}`);
      defaultFiles.forEach(f => console.log(`  📄 ${f}`));
    }

    // 4. 汇总
    console.log('\n\n=== 汇总 ===');
    console.log(`总资产引用: ${totalAssets}`);
    console.log(`正常引用: ${goodRefs.length}`);
    console.log(`断裂引用: ${brokenRefs.length}`);
    console.log(`孤儿文件: ${rootFiles.length}`);

    // 5. 自动修复：移动文件到正确的项目目录
    if (brokenRefs.length > 0) {
      console.log('\n\n=== 自动修复 ===\n');
      for (const ref of brokenRefs) {
        if (!ref.foundAt) {
          console.log(`⏭️  跳过 ${ref.asset.name} (${ref.projectId}) - 文件不存在`);
          continue;
        }
        
        const targetDir = path.join(uploadsDir, ref.projectId);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`📁 创建目录: ${targetDir}`);
        }
        
        const targetFile = path.join(targetDir, path.basename(ref.foundAt));
        if (!fs.existsSync(targetFile)) {
          fs.copyFileSync(ref.foundAt, targetFile);
          console.log(`✅ 复制: ${path.basename(ref.foundAt)} → ${ref.projectId}/`);
        } else {
          console.log(`⏭️  已存在: ${path.basename(ref.foundAt)} in ${ref.projectId}/`);
        }

        // 更新数据库中的 URL 路径
        const correctUrl = `/uploads/${ref.projectId}/${path.basename(ref.foundAt)}`;
        if (ref.asset.url !== correctUrl) {
          console.log(`   📝 数据库 URL 需更新: ${ref.asset.url} → ${correctUrl}`);
        }
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixOrphanUploads();
