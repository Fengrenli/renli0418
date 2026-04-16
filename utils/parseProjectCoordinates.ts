import { normalizeLatLngTuple } from './normalizeLatLngTuple';

const NULL_ISLAND_EPS = 1e-5;

/** 将 (0,0) 视为「未地理编码」占位，避免与 Nominatim 失败默认值叠在几内亚湾 */
function rejectNullIsland(pair: [number, number] | null): [number, number] | null {
  if (!pair) return null;
  if (Math.abs(pair[0]) < NULL_ISLAND_EPS && Math.abs(pair[1]) < NULL_ISLAND_EPS) return null;
  return pair;
}

function parseProjectCoordinatesInner(raw: unknown): [number, number] | null {
  if (raw == null || raw === '') return null;

  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return null;
    try {
      return parseProjectCoordinatesInner(JSON.parse(s));
    } catch {
      return null;
    }
  }

  if (Array.isArray(raw)) {
    const nums = raw.slice(0, 2).map((c: unknown) =>
      typeof c === 'string' ? parseFloat(c) : Number(c),
    );
    return normalizeLatLngTuple(nums);
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;

    // GeoJSON Feature → geometry
    if (o.type === 'Feature' && o.geometry != null && typeof o.geometry === 'object') {
      return parseProjectCoordinatesInner(o.geometry);
    }

    // GeoJSON Point: coordinates 为 [lng, lat]
    if (o.type === 'Point' && Array.isArray(o.coordinates)) {
      const c = o.coordinates as unknown[];
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return normalizeLatLngTuple([lat, lng]);
    }

    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.lon ?? o.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return normalizeLatLngTuple([lat, lng]);
    }

    // terraink / 部分地图组件: { center: { lat, lng } }
    if (o.center != null && typeof o.center === 'object') {
      return parseProjectCoordinatesInner(o.center);
    }
  }

  return null;
}

/**
 * 将库内/第三方（如 terraink MapLibre、[lng,lat]、GeoJSON Point）各类坐标存法
 * 统一为前端使用的 [lat, lng]；无法解析或占位 (0,0) 则返回 null（不抛错）。
 */
export function parseProjectCoordinates(raw: unknown): [number, number] | null {
  return rejectNullIsland(parseProjectCoordinatesInner(raw));
}
