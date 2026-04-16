/**
 * 纠正地图上错位项目：
 * 1) 「镇堂子」+ 布拉格：坐标曾落在中国内蒙古一带，改为捷克布拉格市中心附近。
 * 2) 「达拉斯 Richardson 小龙坎」等：经度误为正值导致标点落在东亚，改为美国达拉斯附近（西经）。
 *
 *   npx tsx scripts/repair-prague-dallas-map-coords.ts
 *   npx tsx scripts/repair-prague-dallas-map-coords.ts --dry-run
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const dryRun = process.argv.includes('--dry-run');

const PRAGUE = { lat: 50.0755, lng: 14.4378 };
const DALLAS = { lat: 32.7767, lng: -96.797 };

async function main() {
  const pragueSel = await pool.query(
    `
    SELECT id, name, location, city, country, coordinates
    FROM projects
    WHERE name ILIKE '%镇堂子%'
      AND (
        COALESCE(location, '') ILIKE '%布拉格%'
        OR COALESCE(city, '') ILIKE '%布拉格%'
      )
    `,
  );

  const dallasSel = await pool.query(
    `
    SELECT id, name, location, city, country, coordinates
    FROM projects
    WHERE name ILIKE '%达拉斯%'
      AND name ILIKE '%Richardson%'
    `,
  );

  const combined = [...pragueSel.rows, ...dallasSel.rows];
  if (combined.length === 0) {
    console.log(
      '未匹配到需修复的行（条件：镇堂子+布拉格；或 名称同时含「达拉斯」「Richardson」）。可在 Admin 核对名称后调整脚本条件。',
    );
    await pool.end();
    process.exit(0);
  }

  console.log(`${dryRun ? '[DRY] ' : ''}将处理 ${combined.length} 条：`);
  for (const r of pragueSel.rows) {
    console.log(`  [布拉格] ${r.id} | ${r.name}`);
  }
  for (const r of dallasSel.rows) {
    console.log(`  [达拉斯] ${r.id} | ${r.name}`);
  }

  if (dryRun) {
    await pool.end();
    process.exit(0);
  }

  const upPrague = await pool.query(
    `
    UPDATE projects SET
      coordinates = $1::jsonb,
      city = COALESCE(NULLIF(TRIM(city), ''), $2),
      country = COALESCE(NULLIF(TRIM(country), ''), $3)
    WHERE name ILIKE '%镇堂子%'
      AND (
        COALESCE(location, '') ILIKE '%布拉格%'
        OR COALESCE(city, '') ILIKE '%布拉格%'
      )
    RETURNING id, name
    `,
    [JSON.stringify({ lat: PRAGUE.lat, lng: PRAGUE.lng }), 'Prague', 'Czech Republic'],
  );

  const upDallas = await pool.query(
    `
    UPDATE projects SET
      coordinates = $1::jsonb,
      city = COALESCE(NULLIF(TRIM(city), ''), $2),
      country = COALESCE(NULLIF(TRIM(country), ''), $3)
    WHERE name ILIKE '%达拉斯%'
      AND name ILIKE '%Richardson%'
    RETURNING id, name
    `,
    [JSON.stringify({ lat: DALLAS.lat, lng: DALLAS.lng }), 'Dallas', 'United States'],
  );

  console.log(`布拉格坐标已更新: ${upPrague.rowCount} 条`);
  console.log(`达拉斯坐标已更新: ${upDallas.rowCount} 条`);
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
