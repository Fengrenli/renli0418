/** Nominatim `addressdetails` 常见字段 → 城市展示名 */
export function cityFromNominatimAddress(addr?: Record<string, string>): string {
  if (!addr) return '';
  const v =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.suburb ||
    addr.neighbourhood ||
    addr.city_district ||
    addr.municipality ||
    addr.county ||
    '';
  return String(v).trim();
}

export function countryFromNominatimAddress(addr?: Record<string, string>): string {
  if (!addr) return '';
  return String(addr.country || '').trim();
}

/**
 * 无结构化 address 时，用 display_name 粗拆：首段作城市倾向、末段作国家倾向（仅兜底）。
 */
export function cityCountryFromDisplayName(displayName: string): { city: string; country: string } {
  const parts = displayName
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: '', country: '' };
  if (parts.length === 1) return { city: parts[0], country: '' };
  return { city: parts[0], country: parts[parts.length - 1] };
}

export function resolveCityCountryFromNominatimHit(hit: {
  displayName: string;
  address?: Record<string, string>;
}): { city: string; country: string } {
  const fromAddr = {
    city: cityFromNominatimAddress(hit.address),
    country: countryFromNominatimAddress(hit.address),
  };
  if (fromAddr.city || fromAddr.country) return fromAddr;
  return cityCountryFromDisplayName(hit.displayName || '');
}
