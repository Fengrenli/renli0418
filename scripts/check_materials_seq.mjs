import pool from '../db.js';

async function run() {
  const queries = [
    `SELECT current_schema() AS schema`,
    `SELECT column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'materials'
        AND column_name = 'id'`,
    `SELECT pg_get_serial_sequence('public.materials','id') AS seq`,
    `SELECT MAX(id) AS max_id, COUNT(*) AS total FROM public.materials`,
    `SELECT last_value, is_called FROM public.materials_id_seq`,
  ];

  for (const sql of queries) {
    const r = await pool.query(sql);
    console.log('\nSQL:', sql.replace(/\s+/g, ' ').trim());
    console.log(r.rows);
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
