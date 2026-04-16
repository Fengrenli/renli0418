import pool from './db.js';

async function check() {
  try {
    // 1. assembly_rules
    const rules = await pool.query('SELECT * FROM assembly_rules ORDER BY sort_order');
    console.log('=== ASSEMBLY_RULES ===');
    rules.rows.forEach(r => console.log(JSON.stringify(r)));

    // 2. rule_items
    const items = await pool.query('SELECT ri.*, ar.code as rule_code FROM rule_items ri JOIN assembly_rules ar ON ri.assembly_rule_id = ar.id ORDER BY ri.sort_order');
    console.log('\n=== RULE_ITEMS ===');
    items.rows.forEach(r => console.log(JSON.stringify(r)));

    // 3. materials table columns
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'materials' ORDER BY ordinal_position");
    console.log('\n=== MATERIALS COLUMNS ===');
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));

    // 4. All tile/brick materials with BR99 prefix
    const mats = await pool.query("SELECT code, name, price, unit, category FROM materials WHERE code LIKE 'BR99-GYHG%' ORDER BY code");
    console.log('\n=== BR99-GYHG MATERIALS ===');
    mats.rows.forEach(r => console.log(`  ${r.code} | ${r.name} | ¥${r.price} | ${r.unit} | ${r.category}`));

    // 5. All materials count
    const cnt = await pool.query('SELECT COUNT(*) as total FROM materials');
    console.log('\n=== TOTAL MATERIALS:', cnt.rows[0].total, '===');

    // 6. Category breakdown
    const cats = await pool.query('SELECT category, COUNT(*) as cnt FROM materials GROUP BY category ORDER BY cnt DESC LIMIT 20');
    console.log('\n=== TOP CATEGORIES ===');
    cats.rows.forEach(r => console.log(`  ${r.category || '(null)'}: ${r.cnt}`));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
