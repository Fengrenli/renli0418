import type { GeoExtractResult } from './types.js';

export function parseGeoExtractPayload(raw: unknown): GeoExtractResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const projectName = String(o.projectName ?? '').trim();
  const brand = String(o.brand ?? '').trim();
  const loc = o.location;
  if (!loc || typeof loc !== 'object') return null;
  const l = loc as Record<string, unknown>;
  const city = String(l.city ?? '').trim();
  const country = String(l.country ?? '').trim();
  if (!projectName) return null;
  if (!city && !country) return null;
  return {
    projectName,
    brand,
    location: { city, country },
  };
}
