import { nominatimSearch } from './nominatim.js';
import type { GeoExtractResult, GeocodedProjectPayload } from './types.js';

const DEFAULT_COORDS = { lat: 0, lng: 0 };

function parseInput(
  aiJsonResponse: string | GeoExtractResult,
): GeoExtractResult | { error: string } {
  try {
    if (typeof aiJsonResponse === 'string') {
      const data = JSON.parse(aiJsonResponse) as unknown;
      if (!data || typeof data !== 'object') return { error: 'invalid JSON' };
      const o = data as Record<string, unknown>;
      const projectName = String(o.projectName ?? '').trim();
      const brand = String(o.brand ?? '').trim();
      const loc = o.location;
      if (!loc || typeof loc !== 'object') return { error: 'missing location' };
      const l = loc as Record<string, unknown>;
      const city = String(l.city ?? '').trim();
      const country = String(l.country ?? '').trim();
      if (!projectName) return { error: 'missing projectName' };
      return {
        projectName,
        brand,
        location: { city, country },
      };
    }
    return aiJsonResponse;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 模块 B：将模块 A 的 JSON（字符串或对象）转为绝对经纬度；失败时默认 0,0 并打日志。
 */
export async function processAndGeocode(
  aiJsonResponse: string | GeoExtractResult,
): Promise<GeocodedProjectPayload | { error: string }> {
  const data = parseInput(aiJsonResponse);
  if ('error' in data) {
    console.error('[processAndGeocode] parse error:', data.error);
    return data;
  }

  const { city, country } = data.location;
  const query = [city, country].filter(Boolean).join(', ').trim();

  if (!query) {
    console.error('[processAndGeocode] empty city/country, using default coords', {
      projectName: data.projectName,
    });
    return {
      ...data,
      coordinates: { ...DEFAULT_COORDS },
      geocodeFailed: true,
      geocodeError: 'empty city and country',
    };
  }

  try {
    const location = (await nominatimSearch(query, 3))[0];
    if (location) {
      return {
        ...data,
        coordinates: { lat: location.lat, lng: location.lon },
      };
    }
    console.error('[processAndGeocode] Nominatim returned no results', { query });
    return {
      ...data,
      coordinates: { ...DEFAULT_COORDS },
      geocodeFailed: true,
      geocodeError: 'no geocode results',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[processAndGeocode] exception:', msg, { query });
    return {
      ...data,
      coordinates: { ...DEFAULT_COORDS },
      geocodeFailed: true,
      geocodeError: msg,
    };
  }
}
