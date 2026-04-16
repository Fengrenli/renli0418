
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { ProjectLocation } from '../types';
import { parseProjectCoordinates } from '../utils/parseProjectCoordinates';
import {
  buildCityMarkerGroups,
  formatCityGroupLabel,
  isCityGroupFocused,
  pickRepresentativeProject,
  projectsToWithCoords,
  type CityMarkerGroup,
} from '../utils/cityMarkerGroups';
import { Maximize2, Minimize2, RotateCcw, Loader2 } from 'lucide-react';

const GLOBE_CONTROL_ARIA: Record<
  'cn' | 'en' | 'de',
  { expand: string; shrink: string; reset: string }
> = {
  cn: { expand: '放大地图', shrink: '缩小地图', reset: '重置旋转' },
  en: { expand: 'Expand map', shrink: 'Shrink map', reset: 'Reset rotation' },
  de: {
    expand: 'Karte vergrößern',
    shrink: 'Karte verkleinern',
    reset: 'Drehung zurücksetzen',
  },
};

interface GlobeVisualProps {
  interactive?: boolean;
  projects?: ProjectLocation[];
  projectionType?: '3d' | '2d';
  onProjectionChange?: (type: '3d' | '2d') => void;
  centerCoordinates?: [number, number] | null; // [lat, lng]
  /** 看板：只显示当前选中位置的一个红点；首页可传 all 显示全部项目 */
  markersMode?: 'all' | 'selected-only';
  /** 单击地图上的项目点：仅选中（父级可用来旋转地球） */
  onMarkerSelect?: (project: ProjectLocation) => void;
  /** 双击地图上的项目点：打开详情 */
  onMarkerOpenDetails?: (project: ProjectLocation) => void;
  /** 当前列表选中项：同城多店时，地球上用其作为代表并参与高亮判断 */
  selectedProjectId?: string;
  /** 与 App / Dashboard 语言一致，用于地图控件无障碍文案 */
  lang?: 'cn' | 'en' | 'de';
}

const GlobeVisual: React.FC<GlobeVisualProps> = ({ 
  interactive = false, 
  projects = [],
  projectionType = '3d',
  onProjectionChange,
  centerCoordinates = null,
  markersMode = 'all',
  onMarkerSelect,
  onMarkerOpenDetails,
  selectedProjectId,
  lang = 'cn',
}) => {
  const ariaControls = GLOBE_CONTROL_ARIA[lang] ?? GLOBE_CONTROL_ARIA.cn;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [worldData, setWorldData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const rotationRef = useRef<[number, number, number]>([105, -30, 0]);
  const isInteractingRef = useRef(false);
  const screenMarkersRef = useRef<
    Array<{
      id: string;
      sx: number;
      sy: number;
      name: string;
      location: string;
      lat: number;
      lng: number;
      project: ProjectLocation;
    }>
  >([]);
  const hoverTipIdRef = useRef<string | null>(null);
  const onMarkerSelectRef = useRef(onMarkerSelect);
  const onMarkerOpenDetailsRef = useRef(onMarkerOpenDetails);
  const markerClickRef = useRef<{
    id: string;
    t: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  useEffect(() => {
    onMarkerSelectRef.current = onMarkerSelect;
    onMarkerOpenDetailsRef.current = onMarkerOpenDetails;
  }, [onMarkerSelect, onMarkerOpenDetails]);

  const [hoverTip, setHoverTip] = useState<{
    left: number;
    top: number;
    name: string;
    location: string;
    sub: string;
  } | null>(null);
  const safeCenter = useMemo<[number, number] | null>(
    () => parseProjectCoordinates(centerCoordinates as unknown),
    [centerCoordinates],
  );

  /** 用于触发旋转动画：避免引用不变时点击同一项目不重新飞入 */
  const focusKey = safeCenter
    ? `${safeCenter[0].toFixed(6)},${safeCenter[1].toFixed(6)}`
    : '';

  const safeProjects = useMemo(() => projectsToWithCoords(Array.isArray(projects) ? projects : []), [projects]);

  const cityGroups = useMemo(() => buildCityMarkerGroups(safeProjects), [safeProjects]);

  type MarkerDrawEntry =
    | { kind: 'group'; group: CityMarkerGroup }
    | { kind: 'synthetic'; project: ProjectLocation; lat: number; lng: number };

  /** 同城（约 1km 网格）只画一颗红点；列表点击仍按具体项目坐标旋转地球 */
  const markersToDraw = useMemo((): MarkerDrawEntry[] => {
    const base: MarkerDrawEntry[] = cityGroups.map((g) => ({ kind: 'group', group: g }));

    if (markersMode === 'all') return base;

    if (!safeCenter) return base;

    const hasFocus = cityGroups.some((g) => isCityGroupFocused(g, safeCenter));
    if (hasFocus) return base;

    return [
      ...base,
      {
        kind: 'synthetic',
        project: { id: 'focus', name: '', location: '' } as ProjectLocation,
        lat: safeCenter[0],
        lng: safeCenter[1],
      },
    ];
  }, [markersMode, cityGroups, safeCenter]);

  const totalProjCount = Array.isArray(projects) ? projects.length : 0;
  const mappedProjCount = safeProjects.length;
  const showCompactLabels = cityGroups.length > 0 && cityGroups.length <= 14;

  // Intersection Observer to pause animation when not visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fetch world data：优先同源 public（内网/墙外 CDN 不可用时仍可显示地球）
  useEffect(() => {
    setIsLoading(true);
    const urls = [
      '/world-atlas/countries-110m.json',
      'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
    ];
    (async () => {
      for (const url of urls) {
        try {
          const data: any = await d3.json(url);
          if (data?.objects?.countries) {
            setWorldData(topojson.feature(data, data.objects.countries));
            return;
          }
        } catch (err) {
          console.warn('Globe atlas load failed:', url, err);
        }
      }
      console.error('Error loading globe data: all atlas URLs failed');
    })().finally(() => setIsLoading(false));
  }, []);

  // 点击项目后：地球转到该经纬度（不受此前拖拽标志位阻塞）
  useEffect(() => {
    if (!safeCenter || projectionType !== '3d') return;

    isInteractingRef.current = false;
    const [lat, lng] = safeCenter;
    const targetRotation: [number, number, number] = [-(lng || 0), -(lat || 0), 0];

    const startRotation = [...(rotationRef.current || [0, 0, 0])] as [
      number,
      number,
      number,
    ];
    const duration = 1400;
    const startTime = performance.now();

    const animateFocus = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);

      rotationRef.current = [
        startRotation[0] + (targetRotation[0] - startRotation[0]) * ease,
        startRotation[1] + (targetRotation[1] - startRotation[1]) * ease,
        0,
      ];

      if (progress < 1) {
        requestAnimationFrame(animateFocus);
      }
    };

    requestAnimationFrame(animateFocus);
  }, [focusKey, projectionType]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;
    
    const isFlatView = projectionType === '2d';
    const radius = isFlatView 
      ? Math.min(width, height) / 6.5 
      : Math.min(width, height) / 2.6;

    // Adjusted translate to perfectly center [width/2, height/2]
    const projection = (isFlatView ? d3.geoEquirectangular() : d3.geoOrthographic())
      .scale(radius)
      .translate([width / 2, height / 2])
      .rotate(rotationRef.current || [0, 0, 0]);

    const path = d3.geoPath(projection, context);

    context.clearRect(0, 0, width, height);

    if (!isFlatView) {
      const cx = width / 2;
      const cy = height / 2;
      context.beginPath();
      context.arc(cx, cy, radius, 0, 2 * Math.PI);
      context.fillStyle = '#ffffff';
      context.fill();
      context.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      context.lineWidth = 1;
      context.stroke();
    }

    const graticule = d3.geoGraticule();
    context.beginPath();
    path(graticule());
    context.strokeStyle = isFlatView ? 'rgba(0, 0, 0, 0.04)' : 'rgba(0, 0, 0, 0.08)';
    context.lineWidth = 0.5;
    context.stroke();

    if (worldData) {
      context.beginPath();
      path(worldData);
      context.fillStyle = isFlatView ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.04)';
      context.fill();
      context.strokeStyle = isFlatView ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.18)';
      context.lineWidth = 0.65;
      context.stroke();
    }

    screenMarkersRef.current = [];
    markersToDraw.forEach((entry) => {
      let lat: number;
      let lng: number;
      let project: ProjectLocation;
      let markerId: string;
      let labelName: string;
      let labelLoc: string;

      if (entry.kind === 'synthetic') {
        lat = entry.lat;
        lng = entry.lng;
        project = entry.project;
        markerId = 'focus';
        labelName = '';
        labelLoc = '';
      } else {
        const { group } = entry;
        lat = group.lat;
        lng = group.lng;
        project = pickRepresentativeProject(group, selectedProjectId);
        markerId = `grp:${group.key}`;
        labelName = formatCityGroupLabel(group);
        if (group.projects.length > 1) {
          const names = group.projects
            .map((p) => (p.name || '').trim())
            .filter(Boolean);
          labelLoc = names.slice(0, 4).join(' · ') + (names.length > 4 ? '…' : '');
        } else {
          labelLoc =
            (project.location || '').trim() ||
            [project.city, project.country].filter(Boolean).join(' · ');
        }
      }

      const coord = projection([lng, lat]);
      if (coord && Array.isArray(coord) && coord.length >= 2) {
        const r = rotationRef.current || [0, 0, 0];
        const isVisible = isFlatView || (
          Array.isArray(r) && r.length >= 2 &&
          d3.geoDistance([lng, lat], [-(r[0] || 0), -(r[1] || 0)]) < Math.PI / 2
        );

        const isFocused =
          entry.kind === 'synthetic'
            ? Boolean(safeCenter)
            : Boolean(safeCenter && isCityGroupFocused(entry.group, safeCenter));

        if (isVisible) {
          screenMarkersRef.current.push({
            id: markerId,
            sx: coord[0],
            sy: coord[1],
            name: labelName || (project.name || '').trim() || '项目',
            location: labelLoc,
            lat,
            lng,
            project,
          });

          context.beginPath();
          context.arc(coord[0], coord[1], (isFlatView ? 3 : 5) * (isFocused ? 1.6 : 1), 0, 2 * Math.PI);
          context.fillStyle = isFocused ? '#E1251B' : 'rgba(225, 37, 27, 0.85)';
          context.fill();
          context.strokeStyle = '#fff';
          context.lineWidth = isFocused ? 2 : 1;
          context.stroke();

          if (isFocused) {
              const pulseSize = 10 + Math.sin(Date.now() / 200) * 5;
              context.beginPath();
              context.arc(coord[0], coord[1], pulseSize, 0, 2 * Math.PI);
              context.strokeStyle = 'rgba(225, 37, 27, 0.4)';
              context.lineWidth = 2;
              context.stroke();
          } else {
              context.beginPath();
              context.arc(coord[0], coord[1], isFlatView ? 6 : 9, 0, 2 * Math.PI);
              context.strokeStyle = 'rgba(225, 37, 27, 0.12)';
              context.lineWidth = 1;
              context.stroke();
          }
        }
      }
    });

    if (showCompactLabels && screenMarkersRef.current.length > 0) {
      context.save();
      context.font = '600 10px system-ui, -apple-system, "Segoe UI", sans-serif';
      context.textBaseline = 'middle';
      for (const m of screenMarkersRef.current) {
        if (m.id === 'focus') continue;
        const raw = m.name || '项目';
        const text = raw.length > 18 ? `${raw.slice(0, 16)}…` : raw;
        const tx = m.sx + 9;
        const ty = m.sy;
        context.strokeStyle = 'rgba(255,255,255,0.95)';
        context.lineWidth = 3;
        context.lineJoin = 'round';
        context.strokeText(text, tx, ty);
        context.fillStyle = 'rgba(25,25,25,0.88)';
        context.fillText(text, tx, ty);
      }
      context.restore();
    }
  }, [markersToDraw, worldData, projectionType, safeCenter, showCompactLabels, selectedProjectId]);

  // Main animation loop
  useEffect(() => {
    if (!isVisible) return;
    let animationId: number;
    const animate = () => {
      render();
      animationId = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationId);
  }, [render, isVisible]);

  // Interaction and Auto-rotation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (interactive) {
      const drag = d3.drag<HTMLCanvasElement, any>()
        .on('start', () => { isInteractingRef.current = true; })
        .on('drag', (event) => {
          const isFlatView = projectionType === '2d';
          const k = (isFlatView ? 150 : 75) / 240;
          const r = rotationRef.current || [0, 0, 0];
          rotationRef.current = [
            (r[0] || 0) + event.dx * k,
            (r[1] || 0) - event.dy * k,
            r[2] || 0
          ];
        })
        .on('end', () => {
          setTimeout(() => { isInteractingRef.current = false; }, 100);
        });
      d3.select(canvas).call(drag as any);
    }

    let autoRotateId: d3.Timer;
    if (projectionType === '3d' && !isExpanded && !centerCoordinates && isVisible) {
        autoRotateId = d3.timer(() => {
            if (!isInteractingRef.current) {
                const r = rotationRef.current || [0, 0, 0];
                rotationRef.current = [(r[0] || 0) + 0.1, r[1] || 0, r[2] || 0];
            }
        });
    }

    return () => {
        if (autoRotateId) autoRotateId.stop();
    };
  }, [interactive, projectionType, isExpanded, centerCoordinates]);

  /** 单击选中并通知父级旋转；双击打开详情。与拖拽区分：按下与抬起位移需小于阈值 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;

    const pickMarker = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const mx = ((clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width;
      const my = ((clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height;
      let best: (typeof screenMarkersRef.current)[number] & { d: number } | null = null;
      for (const m of screenMarkersRef.current) {
        if (m.id === 'focus') continue;
        const d = Math.hypot(m.sx - mx, m.sy - my);
        if (d <= 22 && (!best || d < best.d)) best = { ...m, d };
      }
      return best;
    };

    let down: { x: number; y: number } | null = null;

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (!down) return;
      const dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (dist > 14) return;

      const hit = pickMarker(e.clientX, e.clientY);
      if (!hit) return;
      if (!onMarkerSelectRef.current && !onMarkerOpenDetailsRef.current) return;

      const project = hit.project;
      const clickKey = String(hit.id || '');
      if (clickKey === 'focus') return;

      const now = Date.now();
      const prev = markerClickRef.current;
      if (prev && prev.id === clickKey && now - prev.t < 420) {
        if (prev.timer) clearTimeout(prev.timer);
        markerClickRef.current = null;
        onMarkerOpenDetailsRef.current?.(project);
        return;
      }
      if (prev?.timer) {
        clearTimeout(prev.timer);
        markerClickRef.current = null;
      }
      markerClickRef.current = {
        id: clickKey,
        t: now,
        timer: setTimeout(() => {
          markerClickRef.current = null;
          onMarkerSelectRef.current?.(project);
        }, 300),
      };
    };

    canvas.addEventListener('mousedown', onPointerDown, true);
    canvas.addEventListener('mouseup', onPointerUp, true);
    return () => {
      canvas.removeEventListener('mousedown', onPointerDown, true);
      canvas.removeEventListener('mouseup', onPointerUp, true);
      const t = markerClickRef.current?.timer;
      if (t) clearTimeout(t);
      markerClickRef.current = null;
    };
  }, [interactive]);

  const resetRotation = () => {
    rotationRef.current = [105, -30, 0];
  };

  const handleCanvasPointerMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * canvas.width;
    const my = ((e.clientY - rect.top) / Math.max(rect.height, 1)) * canvas.height;
    let best: (typeof screenMarkersRef.current)[number] & { d: number } | null = null;
    for (const m of screenMarkersRef.current) {
      const d = Math.hypot(m.sx - mx, m.sy - my);
      if (d <= 22 && (!best || d < best.d)) best = { ...m, d };
    }
    const cr = container.getBoundingClientRect();
    if (!best) {
      if (hoverTipIdRef.current !== null) {
        hoverTipIdRef.current = null;
        setHoverTip(null);
      }
      return;
    }
    const next = {
      left: e.clientX - cr.left + 14,
      top: e.clientY - cr.top + 14,
      name: best.name,
      location: best.location,
      sub: `${best.lat.toFixed(4)}°, ${best.lng.toFixed(4)}°`,
    };
    if (hoverTipIdRef.current !== best.id) {
      hoverTipIdRef.current = best.id;
      setHoverTip(next);
    } else {
      setHoverTip((prev) => (prev ? { ...prev, left: next.left, top: next.top } : next));
    }
  }, []);

  const handleCanvasPointerLeave = useCallback(() => {
    hoverTipIdRef.current = null;
    setHoverTip(null);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 flex flex-col items-center justify-center w-full h-full bg-white overflow-hidden select-none">
      {!isLoading && totalProjCount > 0 && mappedProjCount < totalProjCount && (
        <div className="absolute top-5 left-5 z-20 max-w-[min(100%,280px)] rounded-lg border border-amber-100 bg-amber-50/95 px-3 py-2 text-[10px] font-bold leading-snug text-amber-950 shadow-sm backdrop-blur-sm">
          共 {mappedProjCount} / {totalProjCount} 个门店含坐标；地球上以约城市尺度合并为 {cityGroups.length} 处标点（同城多店共一颗红点）。其余缺少经纬度的项目将尝试按「城市 / 国家 / 地址」后台补全。
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 z-[1] flex items-center justify-center bg-white/80 animate-in fade-in duration-500">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="text-gray-400 animate-spin" size={40} />
            <span className="text-xs font-bold text-gray-400 tracking-widest">加载地图数据</span>
          </div>
        </div>
      )}

      {/* Removed redundant toggle - now handled in Dashboard.tsx */}

      {hoverTip && (
        <div
          className="pointer-events-none absolute z-30 max-w-[260px] rounded-xl border border-gray-200/80 bg-white/95 px-3 py-2 text-left shadow-xl backdrop-blur-md"
          style={{ left: hoverTip.left, top: hoverTip.top }}
        >
          <div className="text-xs font-black text-gray-900 leading-tight">{hoverTip.name}</div>
          {hoverTip.location ? (
            <div className="mt-1 text-[11px] text-gray-600 leading-snug">{hoverTip.location}</div>
          ) : null}
          <div className="mt-1 font-mono text-[10px] text-gray-400">{hoverTip.sub}</div>
        </div>
      )}

      <canvas 
        ref={canvasRef} 
        width={1000} 
        height={800} 
        title={interactive ? '单击旋转至项目 · 双击打开详情' : undefined}
        onMouseMove={handleCanvasPointerMove}
        onMouseLeave={handleCanvasPointerLeave}
        className={`transition-all duration-1000 ease-in-out ${interactive ? 'cursor-grab active:cursor-grabbing' : ''} ${isExpanded ? 'scale-125' : 'scale-100'} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
      
      <div className="absolute bottom-10 flex gap-4">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-4 bg-white border border-gray-100 text-gray-700 rounded-full hover:bg-gray-50 transition-all shadow-2xl hover:shadow-red-500/10 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
          aria-label={isExpanded ? ariaControls.shrink : ariaControls.expand}
        >
          {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
        <button
          type="button"
          onClick={resetRotation}
          className="p-4 bg-white border border-gray-100 text-gray-700 rounded-full hover:bg-gray-50 transition-all shadow-2xl hover:shadow-red-500/10 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
          aria-label={ariaControls.reset}
        >
          <RotateCcw size={20} className="group-hover:rotate-[-45deg] transition-transform" />
        </button>
      </div>
    </div>
  );
};

export default GlobeVisual;
