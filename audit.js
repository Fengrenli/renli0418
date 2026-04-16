\import pool from './db.js';\
\const tables = ['materials', 'assembly_rules', 'rule_items'];\
\(async () => {\
\  for (const t of tables) {\
\    const res = await pool.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \\\ + t + \\\ ORDER BY ordinal_position');\
\    console.log('=== ' + t.toUpperCase() + ' ===');\
\    res.rows.forEach(r => console.log('  ' + r.column_name + ': ' + r.data_type));\
\  }\
\  const materials = await pool.query('SELECT code, name, price, unit, category FROM materials WHERE code IS NOT NULL AND code != \\'\\' ORDER BY code LIMIT 10');\
\  console.log('\\n=== SAMPLE MATERIALS ===');\
\  materials.rows.forEach(r => console.log(r.code + ' | ' + r.name + ' | ' + r.price + ' | ' + r.unit + ' | ' + r.category));\
\  const rules = await pool.query('SELECT * FROM assembly_rules LIMIT 10');\
\  console.log('\\n=== ASSEMBLY RULES ===');\
\  rules.rows.forEach(r => console.log(JSON.stringify(r)));\
\  const items = await pool.query('SELECT * FROM rule_items LIMIT 10');\
\  console.log('\\n=== RULE ITEMS ===');\
\  items.rows.forEach(r => console.log(JSON.stringify(r)));\
\  await pool.end();\
\})();\
