/**
 * 列出数据库中仍缺有效坐标的项目（与批量补全同一判定：无坐标或占位 0,0）。
 *
 *   npx tsx scripts/list-projects-missing-geocode.ts
 *   npx tsx scripts/list-projects-missing-geocode.ts --json > missing.json
 *
 * 环境变量 BACKFILL_LIST_LIMIT：最多扫描行数（默认 5000，与库内 projects 总数比较见输出）
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { listProjectsMissingGeocode } from '../lib/geoPipeline/backfillDbProjects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const asJson = process.argv.includes('--json');
const fetchLimit = parseInt(process.env.BACKFILL_LIST_LIMIT || '5000', 10);

async function main() {
  const result = await listProjectsMissingGeocode(pool, { fetchLimit });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('— 数据库 projects 总数:', result.totalInDb);
    console.log('— 本次扫描行数（按创建时间倒序）:', result.scannedRows);
    if (result.scannedRows < result.totalInDb) {
      console.log(
        '⚠ 未扫描全表：可提高环境变量 BACKFILL_LIST_LIMIT 或改 SQL 做全表扫描。',
      );
    }
    console.log('— 仍缺有效坐标的项目数:', result.entries.length);
    console.log('');

    const noHint = result.entries.filter((e) => e.unsolvableByAutomation);
    const hasHint = result.entries.filter((e) => !e.unsolvableByAutomation);

    if (noHint.length > 0) {
      console.log('【无任何地名线索 · 自动化无法补全 · 建议删建或手填地址】');
      noHint.forEach((e) => {
        console.log(`  id=${e.id}  name=${e.name}`);
      });
      console.log('');
    }

    if (hasHint.length > 0) {
      console.log('【有地址线索但仍无坐标 · 可再跑 npm run backfill:geo 或人工核对】');
      hasHint.forEach((e) => {
        console.log(
          `  id=${e.id}\n    名称: ${e.name}\n    线索: ${e.geocodeHint}\n    location/city/country: ${e.location ?? '—'} | ${e.city ?? '—'} | ${e.country ?? '—'}`,
        );
      });
    }

    if (result.entries.length === 0) {
      console.log('✓ 当前扫描范围内没有缺坐标的项目。');
    }
  }

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
