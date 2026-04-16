import { openMeteoSearchAsNominatimHits } from './openMeteoGeocode.js';
import { geocodeAbortSignal } from './geocodeHttp.js';

const DEFAULT_USER_AGENT =
  'RenliProjectSite/1.0 (geocoding; set NOMINATIM_USER_AGENT in .env with your contact URL)';

function explainFetchError(e: unknown): string {
  if (e instanceof TypeError && e.message === 'fetch failed') {
    const c = (e as Error & { cause?: NodeJS.ErrnoException }).cause;
    if (c?.code) {
      return `fetch failed (${c.code}${c.message ? `: ${c.message}` : ''})`;
    }
    return 'fetch failed（多为网络/DNS/防火墙无法访问 Nominatim 主站）';
  }
  return e instanceof Error ? e.message : String(e);
}

function openMeteoFallbackEnabled(): boolean {
  const v = process.env.GEOCODE_DISABLE_OPEN_METEO_FALLBACK?.trim().toLowerCase();
  return v !== '1' && v !== 'true' && v !== 'yes';
}

/** 国内 Nominatim 常超时：可先打 Open-Meteo，无结果再试 Nominatim（省大量等待） */
function preferOpenMeteoFirst(): boolean {
  const v = process.env.GEOCODE_PREFER_OPEN_METEO?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export type NominatimHit = {
  lat: number;
  lon: number;
  displayName: string;
  /** Nominatim jsonv2 + addressdetails=1 */
  address?: Record<string, string>;
};

function normalizeAddressField(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null || v === '') continue;
    out[k] = typeof v === 'string' ? v : String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

export function getNominatimUserAgent(): string {
  return process.env.NOMINATIM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

function mapNominatimJson(data: unknown, q: string): NominatimHit[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => ({
      lat: parseFloat(String(row.lat)),
      lon: parseFloat(String(row.lon)),
      displayName: String(row.display_name || row.name || q),
      address: normalizeAddressField(row.address),
    }))
    .filter(
      (x) =>
        Number.isFinite(x.lat) &&
        Number.isFinite(x.lon) &&
        x.lat >= -90 &&
        x.lat <= 90 &&
        x.lon >= -180 &&
        x.lon <= 180,
    );
}

/**
 * 优先请求 OSM Nominatim；网络失败或 HTTP 非 2xx 时自动降级 Open-Meteo（国内常用场景）。
 * 设置 GEOCODE_DISABLE_OPEN_METEO_FALLBACK=1 可关闭降级。
 */
export async function nominatimSearch(
  q: string,
  limit: number,
  userAgent: string = getNominatimUserAgent(),
): Promise<NominatimHit[]> {
  const base =
    process.env.NOMINATIM_BASE_URL?.trim().replace(/\/$/, '') ||
    'https://nominatim.openstreetmap.org';
  const url =
    `${base}/search?` +
    new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
      q,
    }).toString();

  if (openMeteoFallbackEnabled()) {
    if (preferOpenMeteoFirst()) {
      const quick = await openMeteoSearchAsNominatimHits(q, limit);
      if (quick.length > 0) return quick;
    }
    try {
      const r = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        signal: geocodeAbortSignal(),
      });
      if (r.ok) {
        const data = (await r.json()) as unknown;
        return mapNominatimJson(data, q);
      }
      console.warn(
        `[nominatim] HTTP ${r.status} for "${q.slice(0, 80)}…" → trying Open-Meteo fallback`,
      );
      try {
        return await openMeteoSearchAsNominatimHits(q, limit);
      } catch (e2) {
        throw new Error(
          `Nominatim HTTP ${r.status} | Open-Meteo: ${e2 instanceof Error ? e2.message : String(e2)}`,
        );
      }
    } catch (e) {
      console.warn(
        `[nominatim] ${explainFetchError(e)} — query: "${q.slice(0, 60)}…" → Open-Meteo fallback`,
      );
      try {
        return await openMeteoSearchAsNominatimHits(q, limit);
      } catch (e2) {
        throw new Error(
          `Nominatim: ${explainFetchError(e)} | Open-Meteo: ${e2 instanceof Error ? e2.message : String(e2)}`,
        );
      }
    }
  }

  const r = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
    },
    signal: geocodeAbortSignal(),
  });
  if (!r.ok) {
    throw new Error(`Nominatim HTTP ${r.status}`);
  }
  const data = (await r.json()) as unknown;
  return mapNominatimJson(data, q);
}
