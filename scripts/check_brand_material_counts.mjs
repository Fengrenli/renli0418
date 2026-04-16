import pool from '../db.js';

async function main() {
  const q1 = await pool.query(`
    SELECT b.id, b.name, COUNT(*)::int AS cnt
    FROM brands b
    LEFT JOIN materials m ON m.restaurant_brand_id = b.id
    GROUP BY b.id, b.name
    ORDER BY b.id
  `);
  console.log('brand_counts:', q1.rows);

  const q2 = await pool.query(`
    SELECT COUNT(*)::int AS cnt
    FROM materials
    WHERE restaurant_brand_id IS NULL
  `);
  console.log('null_brand_rows:', q2.rows[0]);

  const q3 = await pool.query(`
    SELECT restaurant_brand_id, COUNT(DISTINCT code)::int AS distinct_codes
    FROM materials
    GROUP BY restaurant_brand_id
    ORDER BY restaurant_brand_id NULLS FIRST
  `);
  console.log('distinct_codes_by_brand:', q3.rows);

  const q4 = await pool.query(`
    SELECT m.code, m.pic_folder, m.image
    FROM materials m
    JOIN brands b ON b.id = m.restaurant_brand_id
    WHERE b.name = '小龙坎'
    ORDER BY m.id DESC
    LIMIT 10
  `);
  console.log('xiaolongkan_sample_images:', q4.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
