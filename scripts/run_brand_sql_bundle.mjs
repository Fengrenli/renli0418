import fs from 'node:fs';
import path from 'node:path';
import pool from '../db.js';

const [brandName, bindSqlPathArg, imageSqlPathArg] = process.argv.slice(2);

if (!brandName || !bindSqlPathArg || !imageSqlPathArg) {
  console.error('Usage: node scripts/run_brand_sql_bundle.mjs <brandName> <bindSqlPath> <imageSqlPath>');
  process.exit(1);
}

const bindSqlPath = path.resolve(bindSqlPathArg);
const imageSqlPath = path.resolve(imageSqlPathArg);

function normalizeSql(sqlText) {
  if (!sqlText) return '';
  // Remove UTF-8 BOM and zero-width chars that can break PostgreSQL parser at position 1.
  return sqlText.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\u2060]/g, '').trim();
}

try {
  const bindSql = normalizeSql(fs.readFileSync(bindSqlPath, 'utf8'));
  const imageSql = normalizeSql(fs.readFileSync(imageSqlPath, 'utf8'));

  if (!bindSql) {
    throw new Error(`Bind SQL is empty: ${bindSqlPath}`);
  }
  if (!imageSql) {
    throw new Error(`Image SQL is empty: ${imageSqlPath}`);
  }

  await pool.query(bindSql);
  await pool.query(imageSql);

  const stat = await pool.query(
    `SELECT b.name AS brand_name, COUNT(*)::int AS cnt
       FROM materials m
       JOIN brands b ON b.id = m.restaurant_brand_id
      WHERE b.name = $1
      GROUP BY b.name`,
    [brandName],
  );

  const cat = await pool.query(
    `SELECT COUNT(DISTINCT m.category)::int AS category_cnt
       FROM materials m
       JOIN brands b ON b.id = m.restaurant_brand_id
      WHERE b.name = $1`,
    [brandName],
  );

  const img = await pool.query(
    `SELECT
        COUNT(*)::int AS total,
        COUNT(NULLIF(TRIM(COALESCE(m.pic_folder, '')), ''))::int AS has_pic_folder,
        COUNT(NULLIF(TRIM(COALESCE(m.image, '')), ''))::int AS has_image
       FROM materials m
       JOIN brands b ON b.id = m.restaurant_brand_id
      WHERE b.name = $1`,
    [brandName],
  );

  const dup = await pool.query(
    `SELECT COUNT(*)::int AS dup_groups
       FROM (
         SELECT m.code
           FROM materials m
           JOIN brands b ON b.id = m.restaurant_brand_id
          WHERE b.name = $1
          GROUP BY m.code
         HAVING COUNT(*) > 1
       ) t`,
    [brandName],
  );

  console.log('brand_count:', stat.rows[0] ?? { brand_name: brandName, cnt: 0 });
  console.log('category_cnt:', cat.rows[0]?.category_cnt ?? 0);
  console.log('image_stat:', img.rows[0] ?? { total: 0, has_pic_folder: 0, has_image: 0 });
  console.log('dup_groups:', dup.rows[0]?.dup_groups ?? 0);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}

