/** 地理编码 HTTP 超时（毫秒），避免 undici 默认 10s 在跨境链路易失败 */
export function getGeocodeFetchTimeoutMs(): number {
  const n = parseInt(process.env.GEOCODE_FETCH_TIMEOUT_MS || '45000', 10);
  return Math.min(120000, Math.max(8000, n));
}

export function geocodeAbortSignal(): AbortSignal {
  return AbortSignal.timeout(getGeocodeFetchTimeoutMs());
}
