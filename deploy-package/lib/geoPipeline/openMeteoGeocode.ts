import { geocodeAbortSignal } from './geocodeHttp.js';

type OpenMeteoResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  admin1?: string;
  admin2?: string;
};

const OPEN_METEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export type OpenMeteoHit = {
  lat: number;
  lon: number;
  displayName: string;
  address?: Record<string, string>;
};

/** 把「多特蒙德、德国」等拆成多段检索词，优先长串再试短段 */
export function buildOpenMeteoQueryVariants(raw: string): string[] {
  const s = raw
    .replace(/[、，,;；|／/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const set = new Set<string>();
  if (s.length >= 2) set.add(s);
  for (const part of s.split(' ')) {
    const p = part.trim();
    if (p.length >= 2) set.add(p);
  }
  return [...set].sort((a, b) => b.length - a.length);
}

async function openMeteoSearchOnce(
  name: string,
  limit: number,
  language: string,
): Promise<OpenMeteoHit[]> {
  const url =
    `${OPEN_METEO_URL}?` +
    new URLSearchParams({
      name: name.trim(),
      count: String(Math.min(10, Math.max(1, limit))),
      language,
      format: 'json',
    }).toString();

  const r = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: geocodeAbortSignal(),
  });
  if (!r.ok) {
    throw new Error(`Open-Meteo HTTP ${r.status}`);
  }
  const data = (await r.json()) as { results?: OpenMeteoResult[] };
  const rows = Array.isArray(data.results) ? data.results : [];

  return rows
    .map((row) => {
      const lat = Number(row.latitude);
      const lon = Number(row.longitude);
      const nm = String(row.name || '').trim();
      const parts = [nm, row.admin1, row.country].filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 0,
      );
      const displayName = parts.join(', ') || name.trim();
      const address: Record<string, string> = {};
      if (row.country) address.country = String(row.country);
      if (nm) address.city = nm;
      if (row.admin1) address.state = String(row.admin1);

      return {
        lat,
        lon,
        displayName,
        address: Object.keys(address).length ? address : undefined,
      } satisfies OpenMeteoHit;
    })
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
 * Open-Meteo 免费地理编码（无需 Key）。
 * 对中文/顿号地址做多拆分 + en/zh 双语尝试，提高「多特蒙德、德国」类命中率。
 */
export async function openMeteoSearchAsNominatimHits(
  q: string,
  limit: number,
): Promise<OpenMeteoHit[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const variants = buildOpenMeteoQueryVariants(trimmed);
  const languages = ['en', 'zh'];

  let lastErr: unknown;
  for (const lang of languages) {
    for (const v of variants) {
      try {
        const hits = await openMeteoSearchOnce(v, limit, lang);
        if (hits.length > 0) return hits;
      } catch (e) {
        lastErr = e;
      }
    }
  }

  if (lastErr) {
    console.warn(
      '[open-meteo] all variants failed, last error:',
      lastErr instanceof Error ? lastErr.message : lastErr,
    );
  }
  return [];
}
