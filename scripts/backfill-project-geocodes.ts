/**
 * 批量补全数据库 projects 的 coordinates / city / country（Nominatim）。
 *
 * 用法：
 *   npx tsx scripts/backfill-project-geocodes.ts           # 写库
 *   npx tsx scripts/backfill-project-geocodes.ts --dry-run  # 只演练不写库
 *
 * 可选环境变量：BACKFILL_FETCH_LIMIT（默认 800）、BACKFILL_MAX_ATTEMPTS（默认 40）
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db.js';
import { backfillProjectsMissingGeocode } from '../lib/geoPipeline/backfillDbProjects.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const dryRun = process.argv.includes('--dry-run');
const fetchLimit = parseInt(process.env.BACKFILL_FETCH_LIMIT || '800', 10);
const maxAttempts = parseInt(process.env.BACKFILL_MAX_ATTEMPTS || '40', 10);

async function main() {
  console.log(
    dryRun
      ? '🔍 地理补全（DRY RUN，不写库）'
      : '✍️  地理补全（将写入数据库，按 Nominatim 间隔限速）',
  );
  const result = await backfillProjectsMissingGeocode(pool, {
    dryRun,
    fetchLimit,
    maxAttempts,
    onProgress: (e) => {
      if (e.status === 'updated') console.log('  ✓', e.id);
      else if (e.status === 'failed') console.log('  ✗', e.id, e.detail || '');
    },
  });
  console.log('\n结果汇总：');
  console.log(JSON.stringify(result, null, 2));
  if (result.remainingInQueue > 0) {
    console.log(
      `\n仍有约 ${result.remainingInQueue} 条待补全，可再次运行本脚本或调用 /api/admin/backfill-project-geocodes`,
    );
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
