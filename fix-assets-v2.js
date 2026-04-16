// fix-assets-v2.js — 一次性数据清洗脚本
// 修复 digital_assets 中可能存在的畸形数据：
// 1. 嵌套的 {assetEntry: {...}} 结构
// 2. null/undefined 元素
// 3. 缺少 url 字段的元素

import pool from './db.js';

async function fixDigitalAssets() {
  console.log('🚀 开始扫描并修复 projects 表中的 digital_assets...');
  
  try {
    const res = await pool.query('SELECT id, digital_assets FROM projects WHERE digital_assets IS NOT NULL');
    console.log(`📋 找到 ${res.rows.length} 个项目有 digital_assets 数据`);
    
    let updatedCount = 0;

    for (const row of res.rows) {
      let assets = row.digital_assets;
      
      // 兼容字符串形式
      if (typeof assets === 'string') {
        try { assets = JSON.parse(assets); } catch (e) { assets = []; }
      }
      
      if (!Array.isArray(assets)) {
        console.log(`  ⚠️ 项目 ${row.id}: digital_assets 不是数组，跳过`);
        continue;
      }

      if (assets.length === 0) continue;

      let needsFix = false;
      const fixedAssets = [];

      for (const asset of assets) {
        if (!asset) {
          needsFix = true; // 跳过 null
          continue;
        }

        // 修复嵌套的 {assetEntry: {...}} 结构
        if (asset.assetEntry && typeof asset.assetEntry === 'object') {
          needsFix = true;
          if (asset.assetEntry.url) {
            fixedAssets.push(asset.assetEntry);
          }
          continue;
        }

        // 保留有 url 的正常条目
        if (asset.url) {
          fixedAssets.push(asset);
        } else {
          needsFix = true; // 跳过没有 url 的条目
        }
      }

      if (needsFix) {
        await pool.query(
          'UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2',
          [JSON.stringify(fixedAssets), row.id]
        );
        updatedCount++;
        console.log(`  ✅ 修复项目 ${row.id}: ${assets.length} → ${fixedAssets.length} 个资产`);
      } else {
        console.log(`  ✔️ 项目 ${row.id}: ${assets.length} 个资产，数据正常`);
      }
    }

    console.log(`\n🎉 完成！共修复 ${updatedCount} 个项目`);
  } catch (err) {
    console.error('❌ 脚本执行失败:', err);
  } finally {
    pool.end();
  }
}

fixDigitalAssets();
