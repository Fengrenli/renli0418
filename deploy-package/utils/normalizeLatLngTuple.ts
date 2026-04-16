/** 将 [lat, lng] 或误存的 [lng, lat] 规范为 [lat, lng]；无法识别时返回 null */
export function normalizeLatLngTuple(pair: number[]): [number, number] | null {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const a = Number(pair[0]);
  const b = Number(pair[1]);
  const validLat = (v: number) => Number.isFinite(v) && v >= -90 && v <= 90;
  const validLng = (v: number) => Number.isFinite(v) && v >= -180 && v <= 180;
  if (validLat(a) && validLng(b)) return [a, b];
  if (validLat(b) && validLng(a)) return [b, a];
  return null;
}
