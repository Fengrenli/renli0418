/**
 * 将「喃妹砂锅法兰克福店」等已误配坐标的项目纠正为德国法兰克福城市中心附近。
 * 与 geocodeQueries 中「先城市、后店名」策略一致；同一城市多家门店可共用相近坐标。
 *
 *   npx tsx scripts/repair-nanmei-frankfurt-coords.ts           # 写库
 *   npx tsx scripts/repair-nanmei-frankfurt-coords.ts --dry-run # 仅打印将更新的行
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const dryRun = process.argv.includes('--dry-run');

/** 法兰克福市中心附近（与 Nominatim city 级结果一致，便于多店叠点） */
const FRANKFURT = { lat: 50.1109, lng: 8.6821 };

async function main() {
  const sel = await pool.query(
    `
    SELECT id, name, location, city, country, coordinates
    FROM projects
    WHERE name ILIKE '%喃妹%'
      AND (name ILIKE '%法兰克福%' OR COALESCE(location, '') ILIKE '%法兰克福%')
    `,
  );

  if (sel.rows.length === 0) {
    console.log('未找到匹配「喃妹」且含「法兰克福」的项目（可能库中名称不同，请在 Admin 中核对后改条件）。');
    await pool.end();
    process.exit(0);
  }

  console.log(`${dryRun ? '[DRY]' : ''} 将更新 ${sel.rows.length} 条：`);
  for (const r of sel.rows) {
    console.log(`  - ${r.id} | ${r.name}`);
  }

  if (dryRun) {
    await pool.end();
    process.exit(0);
  }

  const upd = await pool.query(
    `
    UPDATE projects SET
      coordinates = $1::jsonb,
      city = COALESCE(NULLIF(TRIM(city), ''), $2),
      country = COALESCE(NULLIF(TRIM(country), ''), $3)
    WHERE name ILIKE '%喃妹%'
      AND (name ILIKE '%法兰克福%' OR COALESCE(location, '') ILIKE '%法兰克福%')
    RETURNING id, name
    `,
    [JSON.stringify({ lat: FRANKFURT.lat, lng: FRANKFURT.lng }), 'Frankfurt', 'Germany'],
  );

  console.log(`已更新 ${upd.rowCount} 条。`);
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
