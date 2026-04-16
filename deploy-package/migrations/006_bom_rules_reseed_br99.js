import pool from '../db.js';

/**
 * 重新填充 rule_items，使用数据库中真实存在的 BR99-GYHG-* 编码
 */
async function reseed() {
  try {
    console.log('🔄 清空旧的 rule_items...');
    await pool.query('TRUNCATE TABLE rule_items RESTART IDENTITY CASCADE');

    // 获取 assembly_rules IDs
    const eavesRule = await pool.query("SELECT id FROM assembly_rules WHERE code = 'eaves_standard'");
    const wallRule = await pool.query("SELECT id FROM assembly_rules WHERE code = 'wall_hybrid'");

    if (eavesRule.rowCount === 0 || wallRule.rowCount === 0) {
      console.error('❌ assembly_rules 中缺少 eaves_standard 或 wall_hybrid，请先执行 003 迁移');
      return;
    }

    const eavesId = eavesRule.rows[0].id;
    const wallId = wallRule.rows[0].id;

    // === 屋檐组件 (eaves_standard) - 延米计算 ===
    const eavesItems = [
      { code: 'BR99-GYHG-ABETH-001', qty: 25,   label: '筒瓦 片/延米',         sort: 1 },
      { code: 'BR99-GYHG-X8D5-001',  qty: 35,   label: '板瓦(普通瓦片) 片/延米', sort: 2 },
      { code: 'BR99-GYHG-ABHRG-001', qty: 2,    label: '正脊(三星脊) 套/延米',   sort: 3 },
      { code: 'BR99-GYHG-ABTIE-001', qty: 1.5,  label: '滴水 片/延米',          sort: 4 },
      { code: 'BR99-GYHG-ABRAF-001', qty: 1.5,  label: '挡沟 片/延米',          sort: 5 },
      { code: 'BR99-GYHG-X6BA-001',  qty: 12,   label: '瓦当(普通瓦当) 片/延米', sort: 6 },
      { code: 'BR99-GYHG-ABMAO-001', qty: 12,   label: '猫头 片/延米',          sort: 7 },
    ];

    // === 墙面组件 (wall_hybrid) - 面积计算 ===
    const wallItems = [
      { code: 'BR99-GYHG-ABMRR-002', qty: (1/0.702)*0.95, label: '预制工字拼青砖墙板 块/㎡ (95%面积)', sort: 1 },
      { code: 'BR99-GYHG-ABMRR-001', qty: 80*0.05,        label: '旧青砖片 片/㎡ (5%收口)',          sort: 2 },
    ];

    console.log('📦 写入屋檐规则...');
    for (const item of eavesItems) {
      // 验证材料编码存在
      const mat = await pool.query('SELECT code FROM materials WHERE code = $1 LIMIT 1', [item.code]);
      if (mat.rowCount === 0) {
        console.warn(`  ⚠️  材料 ${item.code} 不存在，跳过`);
        continue;
      }
      await pool.query(
        'INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [eavesId, item.code, item.qty, item.label, item.sort]
      );
      console.log(`  ✅ ${item.code} → ${item.label} (${item.qty}/延米)`);
    }

    console.log('🧱 写入墙面规则...');
    for (const item of wallItems) {
      const mat = await pool.query('SELECT code FROM materials WHERE code = $1 LIMIT 1', [item.code]);
      if (mat.rowCount === 0) {
        console.warn(`  ⚠️  材料 ${item.code} 不存在，跳过`);
        continue;
      }
      await pool.query(
        'INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [wallId, item.code, item.qty, item.label, item.sort]
      );
      console.log(`  ✅ ${item.code} → ${item.label} (${item.qty.toFixed(2)}/㎡)`);
    }

    // 验证
    const verify = await pool.query('SELECT COUNT(*) as cnt FROM rule_items');
    console.log(`\n🎉 完成！rule_items 共 ${verify.rows[0].cnt} 条记录`);

  } catch (err) {
    console.error('❌ 错误:', err);
  } finally {
    await pool.end();
  }
}

reseed();
