/** 模块 A：LLM 输出的结构化地理实体（英文城市/国家） */
export interface GeoExtractResult {
  projectName: string;
  brand: string;
  location: {
    city: string;
    country: string;
  };
}

/** 模块 B：地理编码后的完整载荷（供前端与入库） */
export interface GeocodedProjectPayload {
  projectName: string;
  brand: string;
  location: {
    city: string;
    country: string;
  };
  coordinates: {
    lat: number;
    lng: number;
  };
  /** Nominatim 无结果或异常时为 true，坐标已为默认 0,0 */
  geocodeFailed?: boolean;
  geocodeError?: string;
}
