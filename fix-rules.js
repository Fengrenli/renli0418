import pool from './db.js';

async function fixRules() {
  try {
    // 1. 先查出筒瓦瓦当的编码
    const wadang = await pool.query("SELECT code, name FROM materials WHERE name LIKE '%筒瓦瓦当%' OR (name LIKE '%瓦当%' AND name LIKE '%筒瓦%') LIMIT 5");
    console.log('=== 筒瓦瓦当 candidates ===');
    wadang.rows.forEach(r => console.log(`  ${r.code} | ${r.name}`));

    // 2. 查出挡沟和普通瓦当的 rule_items
    const toDelete = await pool.query("SELECT ri.id, ri.material_code, ri.label FROM rule_items ri WHERE ri.material_code IN ('BR99-GYHG-ABRAF-001', 'BR99-GYHG-X6BA-001')");
    console.log('\n=== 要删除的 rule_items ===');
    toDelete.rows.forEach(r => console.log(`  ID=${r.id} | ${r.material_code} | ${r.label}`));

    // 3. 删除挡沟(ABRAF-001)和普通瓦当(X6BA-001)
    await pool.query("DELETE FROM rule_items WHERE material_code IN ('BR99-GYHG-ABRAF-001', 'BR99-GYHG-X6BA-001')");
    console.log('\n✅ 已删除挡沟和普通瓦当');

    // 4. 查找筒瓦瓦当编码
    const allWadang = await pool.query("SELECT code, name FROM materials WHERE name LIKE '%瓦当%' ORDER BY code");
    console.log('\n=== 所有瓦当类材料 ===');
    allWadang.rows.forEach(r => console.log(`  ${r.code} | ${r.name}`));

    // 5. 查出 eaves_standard 的 ID
    const eavesRule = await pool.query("SELECT id FROM assembly_rules WHERE code = 'eaves_standard'");
    const eavesId = eavesRule.rows[0].id;

    // 找筒瓦瓦当
    let wadangCode = '';
    for (const r of allWadang.rows) {
      if (r.name.includes('筒瓦瓦当')) {
        wadangCode = r.code;
        break;
      }
    }

    if (!wadangCode) {
      // 没找到"筒瓦瓦当"，搜索更宽泛的
      const broader = await pool.query("SELECT code, name FROM materials WHERE code LIKE 'BR99-GYHG%' AND name LIKE '%瓦当%'");
      console.log('\n=== BR99 瓦当 ===');
      broader.rows.forEach(r => console.log(`  ${r.code} | ${r.name}`));
      if (broader.rows.length > 0) wadangCode = broader.rows[0].code;
    }

    if (wadangCode) {
      await pool.query(
        'INSERT INTO rule_items (assembly_rule_id, material_code, base_quantity_per_unit, label, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [eavesId, wadangCode, 1.5, '瓦当-筒瓦瓦当 片/延米', 6]
      );
      console.log(`\n✅ 已添加: ${wadangCode} → 瓦当-筒瓦瓦当 1.5片/延米`);
    } else {
      console.log('\n⚠️ 未找到筒瓦瓦当材料，请手动确认编码');
    }

    // 6. 验证最终结果
    const final = await pool.query(`
      SELECT ri.material_code, ri.label, ri.base_quantity_per_unit, ri.sort_order 
      FROM rule_items ri 
      JOIN assembly_rules ar ON ri.assembly_rule_id = ar.id 
      WHERE ar.code = 'eaves_standard' 
      ORDER BY ri.sort_order
    `);
    console.log('\n=== 最终屋檐规则 ===');
    final.rows.forEach(r => console.log(`  ${r.material_code} | ${r.label} | ${r.base_quantity_per_unit}`));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

fixRules();
