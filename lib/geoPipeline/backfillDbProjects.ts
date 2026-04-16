import type { Pool } from 'pg';
import { nominatimSearch, type NominatimHit } from './nominatim.js';
import { buildGeocodeQueries } from '../../utils/geocodeQueries.js';
import { parseProjectCoordinates } from '../../utils/parseProjectCoordinates.js';
import { resolveCityCountryFromNominatimHit } from './nominatimAddress.js';

export type BackfillDbRow = {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  country: string | null;
  coordinates: unknown;
};

export type BackfillProgressEvent = {
  id: string;
  status: 'updated' | 'skipped' | 'failed';
  detail?: string;
};

export type BackfillDbResult = {
  scanned: number;
  needingGeocode: number;
  attemptedThisRun: number;
  updated: number;
  failed: Array<{ id: string; reason: string }>;
  /** 仍需补全、本轮未处理的条数（可再次调用接口） */
  remainingInQueue: number;
  dryRun: boolean;
};

function rowNeedsGeocode(row: BackfillDbRow): boolean {
  return parseProjectCoordinates(row.coordinates) === null;
}

function buildHint(row: BackfillDbRow): string {
  const loc = (row.location || '').trim();
  const cc = [row.city, row.country].filter(Boolean).join(', ').trim();
  const name = (row.name || '').trim();
  return loc || cc || name;
}

/**
 * 拉取一批项目行，在应用层过滤「仍需地理编码」的条目（含 coordinates 为空 / 占位 0,0）。
 */
export type MissingGeocodeEntry = {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  country: string | null;
  /** 自动补全脚本实际用来检索的线索 */
  geocodeHint: string;
  /** 无任何可用地名线索，批量脚本无法处理，只能人工改库或删建 */
  unsolvableByAutomation: boolean;
};

/**
 * 列出仍缺有效坐标（含 NULL / 占位 0,0）的项目，便于人工删除或重建。
 * 默认按 created_at 倒序扫描最多 fetchLimit 行（与补全脚本同一数据源）。
 */
export async function listProjectsMissingGeocode(
  pool: Pool,
  options?: { fetchLimit?: number },
): Promise<{ entries: MissingGeocodeEntry[]; scannedRows: number; totalInDb: number }> {
  const fetchLimit = Math.min(10000, Math.max(1, options?.fetchLimit ?? 5000));
  const countRes = await pool.query(`SELECT COUNT(*)::int AS n FROM projects`);
  const totalInDb = Number(countRes.rows[0]?.n) || 0;

  const rows = await loadProjectsForGeocodeBackfill(pool, fetchLimit);
  const entries: MissingGeocodeEntry[] = [];
  for (const row of rows) {
    if (!rowNeedsGeocode(row)) continue;
    const hint = buildHint(row);
    entries.push({
      id: row.id,
      name: row.name,
      location: row.location,
      city: row.city,
      country: row.country,
      geocodeHint: hint,
      unsolvableByAutomation: hint.length < 2,
    });
  }
  return { entries, scannedRows: rows.length, totalInDb };
}

export async function loadProjectsForGeocodeBackfill(
  pool: Pool,
  fetchLimit: number,
): Promise<BackfillDbRow[]> {
  const cap = Math.min(10000, Math.max(1, fetchLimit));
  const res = await pool.query(
    `
    SELECT id, name, location, city, country, coordinates
    FROM projects
    ORDER BY created_at DESC NULLS LAST
    LIMIT $1
    `,
    [cap],
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    location: r.location != null ? String(r.location) : null,
    city: r.city != null ? String(r.city) : null,
    country: r.country != null ? String(r.country) : null,
    coordinates: r.coordinates,
  }));
}

async function geocodeRow(
  row: BackfillDbRow,
  lastReqAtRef: { t: number },
  minIntervalMs: number,
): Promise<NominatimHit | null> {
  const hint = buildHint(row);
  if (hint.length < 2) return null;

  const queries = buildGeocodeQueries({ name: row.name, location: hint });
  if (queries.length === 0) return null;

  let hit: NominatimHit | null = null;
  for (let i = 0; i < queries.length; i++) {
    const wait =
      lastReqAtRef.t === 0 ? 0 : Math.max(0, minIntervalMs - (Date.now() - lastReqAtRef.t));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastReqAtRef.t = Date.now();

    const rows = await nominatimSearch(queries[i], 6);
    if (rows.length > 0) {
      hit = rows[0];
      break;
    }
  }
  return hit;
}

/**
 * 批量补全库内缺失/占位坐标，并尽量写入 Nominatim 推导的 city/country。
 * 遵守 Nominatim 使用间隔（默认 1100ms）。
 */
export async function backfillProjectsMissingGeocode(
  pool: Pool,
  options?: {
    dryRun?: boolean;
    /** 从库里最多拉多少行再筛选 */
    fetchLimit?: number;
    /** 本轮最多尝试地理编码多少条（避免一次跑太久） */
    maxAttempts?: number;
    minIntervalMs?: number;
    onProgress?: (e: BackfillProgressEvent) => void;
  },
): Promise<BackfillDbResult> {
  const dryRun = Boolean(options?.dryRun);
  const fetchLimit = options?.fetchLimit ?? 800;
  const maxAttempts = Math.min(200, Math.max(1, options?.maxAttempts ?? 40));
  const minIntervalMs = options?.minIntervalMs ?? 1100;

  const rows = await loadProjectsForGeocodeBackfill(pool, fetchLimit);
  const need = rows.filter(rowNeedsGeocode);
  const batch = need.slice(0, maxAttempts);

  const failed: Array<{ id: string; reason: string }> = [];
  let updated = 0;
  const lastReqAtRef = { t: 0 };

  for (const row of batch) {
    const hint = buildHint(row);
    if (hint.length < 2) {
      options?.onProgress?.({ id: row.id, status: 'skipped', detail: 'no_location_hint' });
      continue;
    }

    try {
      const hit = await geocodeRow(row, lastReqAtRef, minIntervalMs);
      if (!hit) {
        failed.push({ id: row.id, reason: 'nominatim_no_results' });
        options?.onProgress?.({ id: row.id, status: 'failed', detail: 'nominatim_no_results' });
        continue;
      }

      const lat = hit.lat;
      const lng = hit.lon;
      if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) {
        failed.push({ id: row.id, reason: 'null_island' });
        options?.onProgress?.({ id: row.id, status: 'failed', detail: 'null_island' });
        continue;
      }

      const { city, country } = resolveCityCountryFromNominatimHit({
        displayName: hit.displayName,
        address: hit.address,
      });

      if (!dryRun) {
        await pool.query(
          `UPDATE projects SET
            coordinates = $1::jsonb,
            city = CASE WHEN $2::text <> '' THEN $2 ELSE city END,
            country = CASE WHEN $3::text <> '' THEN $3 ELSE country END
          WHERE id = $4`,
          [JSON.stringify({ lat, lng }), city, country, row.id],
        );
      }

      updated += 1;
      options?.onProgress?.({ id: row.id, status: 'updated' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failed.push({ id: row.id, reason: msg });
      options?.onProgress?.({ id: row.id, status: 'failed', detail: msg });
    }
  }

  return {
    scanned: rows.length,
    needingGeocode: need.length,
    attemptedThisRun: batch.length,
    updated,
    failed,
    remainingInQueue: Math.max(0, need.length - batch.length),
    dryRun,
  };
}
