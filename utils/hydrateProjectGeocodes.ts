import type { ProjectLocation } from '../types';
import { parseProjectCoordinates } from './parseProjectCoordinates';
import { resolveCityCountryFromNominatimHit } from '../lib/geoPipeline/nominatimAddress';

export type GeocodeResolveBest = {
  lat: number;
  lon: number;
  displayName?: string;
  address?: Record<string, string>;
};

export type HydratedProjectPatch = {
  coordinates: [number, number];
  city?: string;
  country?: string;
};

/**
 * 将解析到的坐标（及可选城市/国家）写入数据库。
 */
export async function persistProjectCoordinates(
  projectId: string,
  lat: number,
  lng: number,
  meta?: { city?: string; country?: string; displayName?: string },
): Promise<boolean> {
  const body: Record<string, unknown> = { lat, lng };
  if (meta?.city) body.city = meta.city;
  if (meta?.country) body.country = meta.country;
  if (meta?.displayName) body.displayName = meta.displayName;

  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/coordinates`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  let parsed: { success?: boolean } = {};
  try {
    parsed = (await res.json()) as { success?: boolean };
  } catch {
    /* 非 JSON 响应 */
  }
  return Boolean(res.ok && parsed.success);
}

/**
 * 为缺少 coordinates 的项目调用服务端 /api/geocode/resolve 补全坐标；
 * 默认在解析成功后 PATCH 落库（含 Nominatim 推导的 city/country），可用 persist: false 仅更新前端状态。
 */
export async function hydrateMissingProjectGeocodes(
  projects: ProjectLocation[],
  options?: { maxProjects?: number; minIntervalMs?: number; persist?: boolean },
): Promise<Map<string, HydratedProjectPatch>> {
  const maxProjects = options?.maxProjects ?? 40;
  const minIntervalMs = options?.minIntervalMs ?? 1100;
  const persist = options?.persist !== false;
  const patches = new Map<string, HydratedProjectPatch>();
  let resolved = 0;
  let lastReqAt = 0;

  for (const p of projects) {
    if (resolved >= maxProjects) break;
    if (parseProjectCoordinates(p.coordinates)) continue;

    const location = String(p.location || '').trim();
    const cityCountry = [p.city, p.country].filter(Boolean).join(', ').trim();
    const hint = location || cityCountry || String(p.name || '').trim();
    if (hint.length < 2) continue;

    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastReqAt));
    if (wait > 0 && resolved > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    lastReqAt = Date.now();

    try {
      const res = await fetch('/api/geocode/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          name: String(p.name || '').trim(),
          location: hint,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { best?: GeocodeResolveBest };
      };
      if (!json.success || !json.data?.best) continue;
      const best = json.data.best;
      const lat = Number(best.lat);
      const lng = Number(best.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const displayName = String(best.displayName || '');
      const { city, country } = resolveCityCountryFromNominatimHit({
        displayName,
        address: best.address,
      });

      const patch: HydratedProjectPatch = {
        coordinates: [lat, lng],
        ...(city ? { city } : {}),
        ...(country ? { country } : {}),
      };

      if (persist) {
        const saved = await persistProjectCoordinates(p.id, lat, lng, {
          city: city || undefined,
          country: country || undefined,
          displayName: displayName || undefined,
        });
        if (!saved) {
          console.warn('[hydrateProjectGeocodes] 坐标落库失败，已跳过该项目', p.id);
          continue;
        }
      }

      patches.set(p.id, patch);
      resolved += 1;
    } catch {
      // 单次失败跳过
    }
  }

  return patches;
}
