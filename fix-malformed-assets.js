/**
 * fix-malformed-assets.js
 * 
 * 修复数据库中 digital_assets 字段里的畸形条目
 * 问题原因：PostgreSQL jsonb || 操作符在拼接单个对象（非数组包裹）时，
 *          会将对象的 key/value 拍平为数组元素，产生 null、字符串等非法条目。
 *
 * 用法：node fix-malformed-assets.js
 */
import pool from './db.js';

async function fixMalformedAssets() {
  console.log('=== 修复畸形 digital_assets 条目 ===\n');

  const { rows } = await pool.query(
    `SELECT id, name, digital_assets FROM projects WHERE digital_assets IS NOT NULL`
  );

  let fixedCount = 0;

  for (const row of rows) {
    const raw = row.digital_assets;
    if (!Array.isArray(raw)) continue;

    // 只保留合法的资产对象：必须有 url 字段的非空对象
    const cleaned = raw.filter(
      (item) => item != null && typeof item === 'object' && !Array.isArray(item) && item.url
    );

    const removedCount = raw.length - cleaned.length;
    if (removedCount > 0) {
      console.log(`[${row.id}] ${row.name}: 移除 ${removedCount} 条畸形记录 (原 ${raw.length} → 现 ${cleaned.length})`);
      
      await pool.query(
        `UPDATE projects SET digital_assets = $1::jsonb WHERE id = $2`,
        [JSON.stringify(cleaned), row.id]
      );
      fixedCount++;
    }
  }

  if (fixedCount === 0) {
    console.log('✅ 所有项目的 digital_assets 字段均正常，无需修复。');
  } else {
    console.log(`\n✅ 已修复 ${fixedCount} 个项目的畸形资产数据。`);
  }

  await pool.end();
}

fixMalformedAssets().catch((err) => {
  console.error('❌ 修复失败:', err);
  process.exit(1);
});
