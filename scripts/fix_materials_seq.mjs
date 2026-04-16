import pool from '../db.js';

async function run() {
  const before = await pool.query(
    `SELECT
       (SELECT COALESCE(MAX(id), 0) FROM public.materials) AS max_id,
       (SELECT last_value FROM public.materials_id_seq) AS seq_last,
       (SELECT is_called FROM public.materials_id_seq) AS seq_called`,
  );
  console.log('before:', before.rows[0]);

  const fixed = await pool.query(
    `SELECT setval(
       'public.materials_id_seq',
       (SELECT COALESCE(MAX(id), 0) FROM public.materials),
       true
     ) AS seq_now`,
  );
  console.log('fix:', fixed.rows[0]);

  const after = await pool.query(
    `SELECT
       (SELECT COALESCE(MAX(id), 0) FROM public.materials) AS max_id,
       (SELECT last_value FROM public.materials_id_seq) AS seq_last,
       (SELECT is_called FROM public.materials_id_seq) AS seq_called`,
  );
  console.log('after:', after.rows[0]);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
