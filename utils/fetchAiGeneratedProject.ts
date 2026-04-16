import { parseProjectCoordinates } from './parseProjectCoordinates';
import type { ProjectLocation } from '../types';

export type ServerAiProjectPayload = {
  name: string;
  location: string;
  lat: number;
  lng: number;
  description?: string;
  area?: string;
  brand?: string;
  city?: string;
  country?: string;
};

/**
 * 调用服务端全链路：NLP 抽取（英文地名）→ Nominatim 地理编码 → 标准项目字段
 */
export async function fetchAiGeneratedProject(prompt: string): Promise<{
  data: ServerAiProjectPayload;
  geocodeWarning?: string;
}> {
  const res = await fetch('/api/ai/generate-project', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ prompt }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: ServerAiProjectPayload;
    msg?: string;
    geocodeWarning?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.msg || `HTTP ${res.status}`);
  }
  return { data: json.data, geocodeWarning: json.geocodeWarning };
}

export function serverAiPayloadToProjectLocation(
  data: ServerAiProjectPayload,
): ProjectLocation {
  const coords = parseProjectCoordinates({ lat: data.lat, lng: data.lng });
  return {
    id: `proj-${Date.now()}`,
    name: data.name,
    location: data.location,
    ...(coords ? { coordinates: coords } : {}),
    status: '进行中',
    area: data.area,
    description: data.description,
    clientName: data.brand || undefined,
    city: data.city,
    country: data.country,
    digitalAssets: [],
  };
}
