import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, 'uploads');

const ASSET_TYPE_MAP = {
  '.glb': 'model', '.gltf': 'model', '.fbx': 'model', '.obj': 'model',
  '.skp': 'model', '.dwg': 'model', '.rvt': 'rvt', '.ifc': 'model',
  '.pdf': 'pdf',
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image',
  '.mp4': 'video', '.mov': 'video',
  '.doc': 'contract', '.docx': 'contract', '.xls': 'contract', '.xlsx': 'contract',
};

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function rescan() {
  try {
    console.log('🔍 扫描 uploads 目录...\n');

    // 获取所有项目
    const projects = await pool.query('SELECT id, name, digital_assets FROM projects ORDER BY id');
    
    // 扫描 uploads 下所有项目子目录
    const entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'default') continue;
      
      const projId = entry.name;
      const projDir = path.join(uploadsDir, projId);
      const files = fs.readdirSync(projDir).filter(f => fs.statSync(path.join(projDir, f)).isFile());
      
      if (files.length === 0) continue;
      
      // 找到对应的项目
      const project = projects.rows.find(p => p.id === projId);
      if (!project) {
        console.log(`⚠️  目录 ${projId} 没有对应的项目记录`);
        continue;
      }

      // 构建资产列表
      const existingAssets = Array.isArray(project.digital_assets) ? project.digital_assets : [];
      const existingUrls = new Set(existingAssets.map(a => a.url));
      
      let newAssets = [...existingAssets];
      let addedCount = 0;

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const type = ASSET_TYPE_MAP[ext] || 'list';
        const url = `/uploads/${projId}/${file}`;
        
        if (existingUrls.has(url)) continue; // 已存在，跳过
        
        const stat = fs.statSync(path.join(projDir, file));
        
        newAssets.push({
          id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.replace(/^\d+-\d+-/, ''), // 移除时间戳前缀
          url: url,
          type: type,
          size: formatSize(stat.size),
          uploadDate: stat.mtime.toISOString().split('T')[0],
        });
        addedCount++;
      }

      if (addedCount > 0) {
        await pool.query(
          'UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2',
          [JSON.stringify(newAssets), projId]
        );
        console.log(`✅ ${project.name} (${projId}): 新增 ${addedCount} 个资产 (总计 ${newAssets.length})`);
        newAssets.forEach(a => console.log(`   📄 ${a.name} [${a.type}] ${a.size}`));
      } else {
        console.log(`⏭️  ${project.name} (${projId}): ${existingAssets.length} 个资产，无新增`);
      }
    }

    // 扫描 uploads 根目录的孤儿文件
    const rootFiles = entries.filter(e => e.isFile());
    if (rootFiles.length > 0) {
      console.log(`\n📁 uploads 根目录有 ${rootFiles.length} 个孤儿文件（需手动分配到项目）:`);
      rootFiles.forEach(f => console.log(`   ${f.name}`));
    }

    console.log('\n✅ 扫描完成');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

rescan();
