import pool from '../db.js';

const [, , brandName, brandFolder] = process.argv;

if (!brandName || !brandFolder) {
  console.error('Usage: node scripts/fix_brand_image_shell.mjs <brandName> <brandFolder>');
  process.exit(1);
}

const OSS_BASE = 'https://renli2026.oss-cn-chengdu.aliyuncs.com/materials';

function detectExtFromImageUrl(url, fallback = '.png') {
  const s = String(url || '').trim().toLowerCase();
  for (const ext of ['.png', '.jpg', '.jpeg', '.webp', '.gif']) {
    if (s.endsWith(ext)) return ext;
  }
  return fallback;
}

async function main() {
  const rows = await pool.query(
    `
    SELECT m.id, m.code, m.pic_folder, m.image
    FROM materials m
    JOIN brands b ON b.id = m.restaurant_brand_id
    WHERE b.name = $1
      AND COALESCE(TRIM(m.code), '') <> ''
      AND COALESCE(TRIM(m.pic_folder), '') <> ''
    ORDER BY m.id
  `,
    [brandName],
  );

  let updated = 0;
  await pool.query('BEGIN');
  try {
    for (const r of rows.rows) {
      const code = String(r.code).trim();
      const folder = String(r.pic_folder).trim();
      const ext = detectExtFromImageUrl(r.image, '.png');
      const file = `${code}${ext}`;
      const newUrl = `${OSS_BASE}/${encodeURIComponent(brandFolder)}/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
      await pool.query('UPDATE materials SET image = $1 WHERE id = $2', [newUrl, r.id]);
      updated += 1;
    }
    await pool.query('COMMIT');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }

  const sample = await pool.query(
    `
    SELECT m.code, m.pic_folder, m.image
    FROM materials m
    JOIN brands b ON b.id = m.restaurant_brand_id
    WHERE b.name = $1
    ORDER BY m.id DESC
    LIMIT 5
  `,
    [brandName],
  );

  console.log('brand:', brandName);
  console.log('brandFolder:', brandFolder);
  console.log('updated_rows:', updated);
  console.log('sample:', sample.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
