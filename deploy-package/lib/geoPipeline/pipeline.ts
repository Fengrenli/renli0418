import { extractGeoFromNaturalLanguage } from './llmGeoExtract.js';
import { processAndGeocode } from './processAndGeocode.js';
import type { GeocodedProjectPayload } from './types.js';

export interface NormalizedAiProjectRow {
  name: string;
  location: string;
  lat: number;
  lng: number;
  description: string;
  area: string;
  brand: string;
  city: string;
  country: string;
}

export function geocodedToNormalizedRow(payload: GeocodedProjectPayload): NormalizedAiProjectRow {
  const { city, country } = payload.location;
  const locationLabel = [city, country].filter(Boolean).join(', ') || payload.projectName;
  return {
    name: payload.projectName,
    location: locationLabel,
    lat: payload.coordinates.lat,
    lng: payload.coordinates.lng,
    description: '',
    area: '',
    brand: payload.brand || '',
    city,
    country,
  };
}

/**
 * 全链路：自然语言 → LLM 抽取 → Nominatim 地理编码。
 */
export async function naturalLanguageToGeocodedProject(
  prompt: string,
): Promise<{ payload: GeocodedProjectPayload; normalized: NormalizedAiProjectRow }> {
  const extracted = await extractGeoFromNaturalLanguage(prompt);
  const geo = await processAndGeocode(extracted);
  if ('error' in geo) {
    throw new Error(geo.error);
  }
  return {
    payload: geo,
    normalized: geocodedToNormalizedRow(geo),
  };
}
