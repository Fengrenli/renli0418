import * as THREE from 'three';

/**
 * 模块 C：经纬度转球面笛卡尔坐标（Three.js / WebGL 地球仪贴面标记用）
 * @param lat 纬度
 * @param lng 经度
 * @param radius 地球模型半径
 */
export function latLongToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}
