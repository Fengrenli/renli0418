import type { ProjectLocation } from '../types';
import { parseProjectCoordinates } from './parseProjectCoordinates';

export type ProjectWithCoord = { project: ProjectLocation; lat: number; lng: number };

export type CityMarkerGroup = {
  /** 经纬度保留 2 位小数后的网格键（约 1km 级，同城多点合并为一颗） */
  key: string;
  lat: number;
  lng: number;
  projects: ProjectLocation[];
};

const GRID_DECIMALS = 2;

export function cityGridKey(lat: number, lng: number): string {
  return `${Number(lat).toFixed(GRID_DECIMALS)},${Number(lng).toFixed(GRID_DECIMALS)}`;
}

export function buildCityMarkerGroups(items: ProjectWithCoord[]): CityMarkerGroup[] {
  const map = new Map<string, ProjectWithCoord[]>();
  for (const item of items) {
    const k = cityGridKey(item.lat, item.lng);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  const out: CityMarkerGroup[] = [];
  for (const [key, arr] of map) {
    const lat = arr.reduce((s, x) => s + x.lat, 0) / arr.length;
    const lng = arr.reduce((s, x) => s + x.lng, 0) / arr.length;
    out.push({
      key,
      lat,
      lng,
      projects: arr.map((x) => x.project),
    });
  }
  return out;
}

export function formatCityGroupLabel(group: CityMarkerGroup): string {
  if (group.projects.length === 1) {
    const p = group.projects[0];
    return (p.name || p.location || p.city || '项目').trim() || '项目';
  }
  const locBits = new Set(
    group.projects
      .map((p) => [p.city, p.country].filter(Boolean).join(' · ').trim())
      .filter(Boolean),
  );
  if (locBits.size === 1) {
    const loc = [...locBits][0];
    return `${loc}（${group.projects.length}）`;
  }
  const one = group.projects[0].location?.trim();
  if (one) return `${one}（${group.projects.length}）`;
  return `${group.projects.length} 个项目`;
}

export function pickRepresentativeProject(
  group: CityMarkerGroup,
  selectedId?: string,
): ProjectLocation {
  if (selectedId) {
    const hit = group.projects.find((p) => p.id === selectedId);
    if (hit) return hit;
  }
  return group.projects[0];
}

/** 当前选中坐标是否落在此城市网格（或组内任一点） */
export function isCityGroupFocused(
  group: CityMarkerGroup,
  center: [number, number] | null,
): boolean {
  if (!center) return false;
  const [cLat, cLng] = center;
  const thr = 0.015;
  const near = (a: number, b: number) => Math.abs(a - b) < thr;
  if (near(group.lat, cLat) && near(group.lng, cLng)) return true;
  for (const p of group.projects) {
    const c = parseProjectCoordinates(p.coordinates as unknown);
    if (c && near(c[0], cLat) && near(c[1], cLng)) return true;
  }
  return false;
}

/** 将项目列表转为带坐标项（无效坐标已过滤） */
export function projectsToWithCoords(projects: ProjectLocation[]): ProjectWithCoord[] {
  return (Array.isArray(projects) ? projects : [])
    .map((project) => {
      const normalized = parseProjectCoordinates((project as ProjectLocation).coordinates as unknown);
      if (!normalized) return null;
      return { project, lat: normalized[0], lng: normalized[1] };
    })
    .filter((v): v is ProjectWithCoord => Boolean(v));
}
