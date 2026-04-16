import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

async function fixAssetUrls() {
  try {
    const result = await pool.query('SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
    let fixCount = 0;

    for (const row of result.rows) {
      let assets = row.digital_assets;
      if (typeof assets === 'string') { try { assets = JSON.parse(assets); } catch(e) { continue; } }
      if (!Array.isArray(assets) || assets.length === 0) continue;

      let modified = false;
      const fixedAssets = [];

      for (const asset of assets) {
        let url = asset.url || '';
        let fixed = { ...asset };

        // 1. 移除 http://localhost:3800 前缀
        if (url.startsWith('http://localhost')) {
          url = url.replace(/^http:\/\/localhost:\d+/, '');
          fixed.url = url;
          modified = true;
        }

        // 2. 检查文件是否在正确的项目目录下
        const localPath = path.join(__dirname, url.startsWith('/') ? url.substring(1) : url);
        
        if (!fs.existsSync(localPath)) {
          // 尝试在所有位置搜索同名文件
          const fileName = path.basename(url);
          const searchPaths = [
            path.join(uploadsDir, fileName),                    // uploads/根目录
            path.join(uploadsDir, 'default', fileName),         // uploads/default/
            path.join(uploadsDir, row.id, fileName),            // uploads/项目ID/
          ];

          let found = null;
          for (const sp of searchPaths) {
            if (fs.existsSync(sp)) { found = sp; break; }
          }

          if (found) {
            // 确保项目目录存在
            const projDir = path.join(uploadsDir, row.id);
            if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });

            // 复制到正确位置
            const target = path.join(projDir, fileName);
            if (!fs.existsSync(target)) {
              fs.copyFileSync(found, target);
              console.log(`✅ 复制: ${fileName} → ${row.id}/`);
            }
            
            fixed.url = `/uploads/${row.id}/${fileName}`;
            modified = true;
          } else {
            // 文件确实不存在，标记为测试数据并移除
            console.log(`⚠️  移除不存在的资产引用: ${asset.name} (${row.name})`);
            continue; // 不加入 fixedAssets
          }
        }
        
        fixedAssets.push(fixed);
      }

      if (modified || fixedAssets.length !== assets.length) {
        await pool.query(
          'UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2',
          [JSON.stringify(fixedAssets), row.id]
        );
        fixCount++;
        console.log(`📝 更新项目 ${row.name} (${row.id}): ${assets.length} → ${fixedAssets.length} 条资产`);
      }
    }

    console.log(`\n✅ 修复完成，更新了 ${fixCount} 个项目的资产引用`);
    
    // 验证
    console.log('\n=== 验证结果 ===');
    const verify = await pool.query('SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
    for (const row of verify.rows) {
      let assets = row.digital_assets;
      if (typeof assets === 'string') { try { assets = JSON.parse(assets); } catch(e) { assets = []; } }
      if (!Array.isArray(assets) || assets.length === 0) continue;
      
      console.log(`\n📁 ${row.name} (${row.id}): ${assets.length} 条资产`);
      for (const a of assets) {
        const localPath = path.join(__dirname, a.url.startsWith('/') ? a.url.substring(1) : a.url);
        const exists = fs.existsSync(localPath);
        console.log(`   ${exists ? '✅' : '❌'} ${a.name} → ${a.url}`);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixAssetUrls();
