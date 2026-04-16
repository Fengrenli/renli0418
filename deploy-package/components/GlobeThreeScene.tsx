import type { ProjectLocation } from '../types';

/**
 * 原 Three.js 地球预览已下线；保留空壳组件，避免旧缓存/HMR 仍引用 GlobeThreeScene 时报 ReferenceError。
 */
function GlobeThreeScene(_props: { projects: ProjectLocation[]; className?: string }) {
  return null;
}

export default GlobeThreeScene;
