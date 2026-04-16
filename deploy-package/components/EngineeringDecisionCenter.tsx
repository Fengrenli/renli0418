/**
 * 🏛️ Engineering Decision Center — 沉浸式材料销售展示中心
 *
 * 核心理念：不是"算量工具"，而是"帮你卖古建材料的沉浸式展示中心"
 * - 左侧：Pascal 3D 场景（真实古建模型） / R3F 占位场景
 * - 右侧：BOM 算量看板 + 一键询价
 * - 支持多项目切换（小龙坎不同门店案例展示）
 * - Apple-Style 极简高级 UI
 */

import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import {
  Calculator, Layers, Package, TrendingUp, Loader2,
  ChevronRight, Box, Sparkles, X, Download,
  Building2, Ruler, BarChart3, ArrowUpRight,
  ExternalLink, Eye, ShoppingCart, Send, Globe2, Cuboid,
  Pencil, Trash2, Type, Move, MousePointer, ChevronUp
} from 'lucide-react';
import { motion, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import SceneParser, { DEMO_SCENE } from './SceneParser';
import { useEngineeringStore, type BomLineItem, type BomGroup } from '../store/useEngineeringStore';

// ─── 标注类型 ───
interface Annotation {
  id: number;
  type: 'point' | 'dimension';
  text: string;
  /** 屏幕坐标（相对于场景容器） */
  x: number;
  y: number;
  /** 终点坐标（仅 dimension 类型） */
  x2?: number;
  y2?: number;
  color: string;
  timestamp: number;
}

const ANNOTATION_COLORS = ['#E1251B', '#2563EB', '#16A34A', '#D97706', '#9333EA', '#0891B2'];

const DEFAULT_EDITOR_WEB_URL = '/editor/';
const DEFAULT_EDITOR_DESKTOP_DOWNLOAD_URL = '/downloads/rdesign/latest/';

const normalizeEditorPath = (value: string, fallback: string) => {
  const candidate = (value || '').trim();
  if (!candidate) return fallback;
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return candidate.startsWith('/') ? candidate : `/${candidate}`;
};

const EDITOR_WEB_URL = normalizeEditorPath(import.meta.env.VITE_EDITOR_URL || '', DEFAULT_EDITOR_WEB_URL);
const EDITOR_DESKTOP_DOWNLOAD_URL = normalizeEditorPath(
  import.meta.env.VITE_EDITOR_DESKTOP_URL || '',
  DEFAULT_EDITOR_DESKTOP_DOWNLOAD_URL,
);

// ─── Pascal 展示项目库 ───
const PASCAL_PROJECTS = [
  {
    id: 'project_PjEOMi07tgcpwVma',
    name: '磁器口古建门店',
    nameEn: 'CiQi Traditional Store',
    author: '@Moruofrl',
    url: EDITOR_WEB_URL,
    thumbnail: 'https://sc02.alicdn.com/kf/A91177461865e4231b6201d4a17039344K.png',
    description: '传统中式古建餐饮门店，含木柱、斗拱、栏杆、屋架结构',
    tags: ['古建', '木作', '斗拱', '中式'],
  },
  {
    id: 'project_0hrQfgRZo4uiNZSo',
    name: '现代中式概念店',
    nameEn: 'Modern Chinese Concept',
    author: '@aymeric',
    url: EDITOR_WEB_URL,
    thumbnail: 'https://sc02.alicdn.com/kf/Adb2359a7bb5a43b59573b776abf9a1dds.png',
    description: '现代简约与中式元素结合的概念门店设计',
    tags: ['现代', '概念', '简约'],
  },
];

// ─── 数字动画 Hook ───
function useAnimatedNumber(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const ref = useRef({ start: 0, end: 0, startTime: 0 });

  useEffect(() => {
    ref.current = { start: value, end: target, startTime: Date.now() };
    const animate = () => {
      const elapsed = Date.now() - ref.current.startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(ref.current.start + (ref.current.end - ref.current.start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

// ─── 统计卡片 ───
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accent?: string;
}> = ({ icon, label, value, subtitle, accent = 'text-gray-900' }) => (
  <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/20 p-4 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className="flex items-start justify-between mb-2">
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-gray-400 group-hover:bg-red-50/50 group-hover:text-red-500 transition-colors">
        {icon}
      </div>
      <ArrowUpRight size={12} className="text-gray-300 group-hover:text-red-400 transition-colors" />
    </div>
    <div className={`text-xl font-black tracking-tight ${accent}`}>{value}</div>
    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.12em] mt-0.5">{label}</div>
    {subtitle && <div className="text-[9px] text-gray-300 mt-0.5">{subtitle}</div>}
  </div>
);

// ─── BOM 行组件 ───
const BomRow: React.FC<{
  item: BomLineItem;
  index: number;
  isHighlighted: boolean;
  onSelect: (sku: string) => void;
}> = ({ item, index, isHighlighted, onSelect }) => {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHighlighted && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isHighlighted]);

  return (
    <div
      ref={rowRef}
      onClick={() => onSelect(item.sku_code)}
      className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-500 ${
        isHighlighted
          ? 'bg-red-50/40 backdrop-blur-md border border-red-200/40 shadow-lg shadow-red-500/5 scale-[1.01]'
          : 'bg-white/30 border border-white/20 hover:bg-white/60 hover:border-white/40'
      }`}
    >
      <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[9px] font-black ${
        isHighlighted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/40 text-gray-400'
      }`}>
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-black text-gray-900 truncate">{item.name}</div>
        <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mt-0.5 truncate">
          {item.sku_code}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs font-black text-gray-900">{item.final_qty}<span className="text-[8px] text-gray-400 ml-0.5">{item.unit}</span></div>
      </div>
      <div className="text-right shrink-0 w-16">
        <div className={`text-xs font-black ${isHighlighted ? 'text-red-600' : 'text-gray-700'}`}>
          ¥{item.total_price.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

// ─── BOM 分组 ───
const BomGroupCard: React.FC<{
  group: BomGroup;
  highlightedSku: string | null;
  onSelectSku: (sku: string) => void;
}> = ({ group, highlightedSku, onSelectSku }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 overflow-hidden shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/30 flex items-center justify-center text-gray-500">
            {group.group_code === 'eaves_standard' ? <Building2 size={13} /> : <Layers size={13} />}
          </div>
          <div className="text-left">
            <div className="text-[11px] font-black text-gray-900 uppercase tracking-wider">{group.group_name}</div>
            <div className="text-[9px] text-gray-400 font-bold">{group.items.length} 项材料</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm font-black text-gray-900">¥{group.subtotal.toLocaleString()}</div>
          <ChevronRight size={14} className={`text-gray-300 transition-transform duration-300 ${collapsed ? '' : 'rotate-90'}`} />
        </div>
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {group.items.map((item, idx) => (
            <BomRow
              key={item.sku_code}
              item={item}
              index={idx}
              isHighlighted={highlightedSku === item.sku_code}
              onSelect={onSelectSku}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── 项目选择卡片 ───
const ProjectSelector: React.FC<{
  projects: typeof PASCAL_PROJECTS;
  activeId: string;
  onSelect: (id: string) => void;
  onSelectR3F: () => void;
  viewMode: 'pascal' | 'r3f';
  editorWebUrl: string;
  desktopDownloadUrl: string;
}> = ({ projects, activeId, onSelect, onSelectR3F, viewMode, editorWebUrl, desktopDownloadUrl }) => (
  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
    {projects.map((p) => (
      <button
        key={p.id}
        onClick={() => onSelect(p.id)}
        className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
          viewMode === 'pascal' && activeId === p.id
            ? 'bg-white text-gray-900 shadow-md border border-gray-200'
            : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
        }`}
      >
        <Globe2 size={12} />
        {p.name}
      </button>
    ))}
    <button
      onClick={onSelectR3F}
      className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
        viewMode === 'r3f'
          ? 'bg-white text-gray-900 shadow-md border border-gray-200'
          : 'text-gray-400 hover:text-gray-600 hover:bg-white/50'
      }`}
    >
      <Cuboid size={12} />
      算量模型
    </button>
    <button
      onClick={() => window.open(editorWebUrl, '_blank')}
      className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md hover:from-blue-600 hover:to-indigo-600 hover:shadow-lg hover:scale-[1.02]"
    >
      <Pencil size={12} />
      设计编辑器
    </button>
    <button
      onClick={() => window.open(desktopDownloadUrl, '_blank')}
      className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md hover:from-emerald-600 hover:to-teal-600 hover:shadow-lg hover:scale-[1.02]"
      title="下载桌面版编辑器"
    >
      <Download size={12} />
      桌面版下载
    </button>
  </div>
);

// ─── 三段式底部抽屉高度配置 ───
const SHEET_HEIGHTS = {
  peek: 0.15,   // 15% 屏幕
  half: 0.50,   // 50% 屏幕
  full: 0.92,   // 92% 屏幕（留安全区）
};
const STAGE_ORDER: Array<'peek' | 'half' | 'full'> = ['peek', 'half', 'full'];

// ─── 移动端三段式底部抽屉组件 ───
const MobileBottomSheet: React.FC<{
  sheetStage: 'peek' | 'half' | 'full';
  setSheetStage: (s: 'peek' | 'half' | 'full') => void;
  animTotal: number;
  animItems: number;
  animSkus: number;
  measurements: { totalArea: number; totalLength: number };
  wasteRate: number;
  isCalculating: boolean;
  bomData: any;
  highlightedSku: string | null;
  handlePanelSelect: (sku: string) => void;
  setShowInquiry: (v: boolean) => void;
  lang: 'cn' | 'en';
}> = ({
  sheetStage, setSheetStage,
  animTotal, animItems, animSkus,
  measurements, wasteRate,
  isCalculating, bomData, highlightedSku,
  handlePanelSelect, setShowInquiry, lang,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartStage = useRef<'peek' | 'half' | 'full'>('peek');

  const heightPercent = SHEET_HEIGHTS[sheetStage];
  const isFull = sheetStage === 'full';
  const isPeek = sheetStage === 'peek';

  const handleDragStart = useCallback(() => {
    dragStartStage.current = sheetStage;
  }, [sheetStage]);

  const handleDrag = useCallback((_: any, info: PanInfo) => {
    // 实时拖拽在 framer-motion 内部处理
  }, []);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offsetY = info.offset.y;
    const currentIdx = STAGE_ORDER.indexOf(dragStartStage.current);

    // 快速甩动
    if (Math.abs(velocity) > 500) {
      if (velocity < 0 && currentIdx < 2) {
        setSheetStage(STAGE_ORDER[currentIdx + 1]);
      } else if (velocity > 0 && currentIdx > 0) {
        setSheetStage(STAGE_ORDER[currentIdx - 1]);
      }
      return;
    }

    // 慢速拖拽：超过 60px 切换
    if (offsetY < -60 && currentIdx < 2) {
      setSheetStage(STAGE_ORDER[currentIdx + 1]);
    } else if (offsetY > 60 && currentIdx > 0) {
      setSheetStage(STAGE_ORDER[currentIdx - 1]);
    }
    // 否则回弹到当前阶段
  }, [setSheetStage]);

  const handleHandleClick = useCallback(() => {
    // 点击手柄循环切换: peek → half → full → peek
    const nextMap: Record<string, 'peek' | 'half' | 'full'> = {
      peek: 'half',
      half: 'full',
      full: 'peek',
    };
    setSheetStage(nextMap[sheetStage]);
  }, [sheetStage, setSheetStage]);

  return (
    <motion.div
      ref={sheetRef}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white/85 backdrop-blur-2xl rounded-t-[32px] shadow-[0_-12px_40px_rgb(0,0,0,0.12)] overflow-hidden"
      style={{ touchAction: 'none' }}
      animate={{ height: `${heightPercent * 100}vh` }}
      transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      {/* ── 拖拽手柄 ── */}
      <div
        className="w-full flex flex-col items-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
        onClick={handleHandleClick}
      >
        <div className="w-9 h-[5px] rounded-full bg-gray-300/50 mb-2" />
        <div className="flex items-center gap-3 text-[12px] font-semibold text-[#86868B]">
          <span className="font-bold text-[#1D1D1F]">¥{Math.round(animTotal).toLocaleString()}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span>{Math.round(animItems).toLocaleString()} {lang === 'cn' ? '件' : 'pcs'}</span>
          <span className="w-1 h-1 rounded-full bg-gray-300" />
          <span>{Math.round(animSkus)} SKU</span>
          <ChevronUp size={16} className={`transition-transform duration-300 ${isPeek ? '' : isFull ? 'rotate-180' : 'rotate-90'}`} />
        </div>
      </div>

      {/* ── 统计卡片区（half/full 可见） ── */}
      {!isPeek && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-4 pb-3 shrink-0"
        >
          <div className="grid grid-cols-2 gap-2">
            <StatCard icon={<TrendingUp size={14} />} label={lang === 'cn' ? '预计总造价' : 'Total Cost'} value={`¥${Math.round(animTotal).toLocaleString()}`} accent="text-red-600" />
            <StatCard icon={<Package size={14} />} label={lang === 'cn' ? '材料总数' : 'Total Pieces'} value={Math.round(animItems).toLocaleString()} subtitle={`${Math.round(animSkus)} SKUs`} />
            {isFull && (
              <>
                <StatCard icon={<Ruler size={14} />} label={lang === 'cn' ? '测量面积' : 'Area'} value={`${measurements.totalArea} ㎡`} subtitle={`${measurements.totalLength}m 延米`} />
                <StatCard icon={<BarChart3 size={14} />} label={lang === 'cn' ? '损耗率' : 'Waste'} value={`${Math.round(wasteRate * 100)}%`} subtitle={lang === 'cn' ? '向上取整' : 'Rounded up'} />
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* ── BOM 明细列表 ── */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-6 space-y-2.5 custom-scrollbar overscroll-contain"
        style={{ touchAction: 'pan-y' }}
      >
        {isPeek && (
          <div className="flex items-center justify-center py-2 text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
            {lang === 'cn' ? '上拉查看明细' : 'Pull up for details'}
          </div>
        )}

        {!isPeek && isCalculating && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={28} className="animate-spin text-red-500" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'cn' ? '正在计算...' : 'Calculating...'}</p>
          </div>
        )}

        {!isPeek && !isCalculating && bomData && (
          isFull ? (
            // ── Full 模式：详细垂直列表 ──
            <div className="space-y-3">
              {bomData.groups.map((group: BomGroup) => (
                <div key={group.group_code} className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-100/40 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100/30">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500">
                        {group.group_code === 'eaves_standard' ? <Building2 size={13} /> : <Layers size={13} />}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold text-[#1D1D1F]">{group.group_name}</div>
                        <div className="text-[10px] text-[#86868B]">{group.items.length} {lang === 'cn' ? '项材料' : 'items'}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-[#1D1D1F]">¥{group.subtotal.toLocaleString()}</div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.items.map((item: BomLineItem) => (
                      <div
                        key={item.sku_code}
                        onClick={() => handlePanelSelect(item.sku_code)}
                        className={`px-4 py-3 cursor-pointer transition-all active:bg-red-50/50 ${
                          highlightedSku === item.sku_code ? 'bg-red-50/60 border-l-2 border-[#E1251B]' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-bold text-[#1D1D1F]">{item.name}</span>
                          <span className="text-[13px] font-bold text-[#E1251B]">¥{item.total_price.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-[#86868B]">
                          <span>{item.sku_code}</span>
                          <span>{item.final_qty} {item.unit}</span>
                          <span>@¥{item.unit_price}/{item.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 询价 CTA */}
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white mt-4">
                <h4 className="text-xs font-black uppercase tracking-widest mb-1">{lang === 'cn' ? '对这个方案感兴趣？' : 'Interested?'}</h4>
                <p className="text-[10px] text-white/50 mb-3">{lang === 'cn' ? '全球古建材料供应与工程支持' : 'Global heritage material supply'}</p>
                <button onClick={() => setShowInquiry(true)} className="w-full flex items-center justify-center gap-2 bg-[#E1251B] text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                  <Send size={13} />{lang === 'cn' ? '获取报价' : 'Get Quote'}
                </button>
              </div>
              <div className="h-8" />
            </div>
          ) : (
            // ── Half 模式：紧凑卡片 ──
            bomData.groups.map((group: BomGroup) => (
              <BomGroupCard key={group.group_code} group={group} highlightedSku={highlightedSku} onSelectSku={handlePanelSelect} />
            ))
          )
        )}

        {!isPeek && !isCalculating && !bomData && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-30">
            <Calculator size={40} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">{lang === 'cn' ? '点击"算量"开始' : 'Click Calculate'}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── 主组件 ─────────────────────────────────────
interface Props {
  onClose?: () => void;
  lang?: 'cn' | 'en';
  projects?: any[];
  setProjects?: React.Dispatch<React.SetStateAction<any[]>>;
}

const EngineeringDecisionCenter: React.FC<Props> = ({ onClose, lang = 'cn', projects = [], setProjects }) => {
  const sceneConfig = useEngineeringStore((s) => s.sceneConfig);
  const bomData = useEngineeringStore((s) => s.bomData);
  const isCalculating = useEngineeringStore((s) => s.isCalculating);
  const selectedSku = useEngineeringStore((s) => s.selectedSku);
  const highlightPulse = useEngineeringStore((s) => s.highlightPulse);
  const wasteRate = useEngineeringStore((s) => s.wasteRate);

  const loadScene = useEngineeringStore((s) => s.loadScene);
  const calculateBom = useEngineeringStore((s) => s.calculateBom);
  const highlightFromPanel = useEngineeringStore((s) => s.highlightFromPanel);
  const setWasteRate = useEngineeringStore((s) => s.setWasteRate);

  // 视图模式：默认 r3f（可见的算量构件场景），pascal 为参考案例
  const [viewMode, setViewMode] = useState<'pascal' | 'r3f'>('r3f');
  const [activeProjectId, setActiveProjectId] = useState(PASCAL_PROJECTS[0].id);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [iframeReloadKey, setIframeReloadKey] = useState(0);
  const [showInquiry, setShowInquiry] = useState(false);
  // 三段式抽屉 (framer-motion)
  const sheetStage = useEngineeringStore((s) => s.sheetStage);
  const setSheetStage = useEngineeringStore((s) => s.setSheetStage);
  // 标注系统
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationMode, setAnnotationMode] = useState<'none' | 'point' | 'dimension'>('none');
  const [annotationText, setAnnotationText] = useState('');
  const nextAnnotationId = useRef(1);

  // ── 导出到项目资产相关 ──
  const [pendingExport, setPendingExport] = useState<{ blob: Blob | string; name: string; type: string } | null>(null);
  const [showProjectSelectModal, setShowProjectSelectModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [apiProjects, setApiProjects] = useState<any[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 合并 prop 传入的项目 和 API 拉取的项目（去重）
  const mergedProjects = useMemo(() => {
    const byId = new Map<string, any>();
    (projects || []).forEach((p: any) => byId.set(p.id, p));
    apiProjects.forEach((p: any) => { if (!byId.has(p.id)) byId.set(p.id, p); });
    return Array.from(byId.values());
  }, [projects, apiProjects]);

  // 如果 props 没传项目，自行从 API 拉取
  useEffect(() => {
    if (projects && projects.length > 0) return;
    fetch('/api/projects')
      .then(r => r.json())
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || res?.projects || []);
        setApiProjects(list);
      })
      .catch(e => console.error('Failed to fetch projects for modal:', e));
  }, [projects]);

  // 处理来自 Pascal Editor 的消息
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const { type, data, name, blob } = event.data;

      if (type === 'PASCAL_EXPORT_IMAGE' || type === 'EXCALIDRAW_EXPORT') {
        console.log('📦 Received Drawing Export:', name || 'Unnamed Drawing');
        
        let finalBlob = blob;
        if (typeof data === 'string' && data.startsWith('data:image')) {
          const res = await fetch(data);
          finalBlob = await res.blob();
        }

        setPendingExport({ 
          blob: finalBlob, 
          name: name || `Drawing_${new Date().toISOString().slice(0,10)}`, 
          type: 'image' 
        });
        setShowProjectSelectModal(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 手动截图当前 3D 场景并触发上传 Modal
  const handleCaptureAndUpload = useCallback(async () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const sceneName = PASCAL_PROJECTS.find(p => p.id === activeProjectId)?.name || '3D场景';
    const fileName = `${sceneName}_${timestamp}`;

    // 尝试从 iframe 截图
    if (viewMode === 'pascal' && iframeRef.current) {
      try {
        iframeRef.current.contentWindow?.postMessage({ type: 'REQUEST_SCREENSHOT' }, '*');
      } catch (e) {
        // 跨域无法直接截图，使用占位方式
      }
    }

    // 尝试从 R3F canvas 截图
    const canvas = sceneContainerRef.current?.querySelector('canvas');
    if (canvas) {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        setPendingExport({ blob, name: fileName, type: 'image' });
        setShowProjectSelectModal(true);
        return;
      } catch (e) {
        console.warn('Canvas screenshot failed:', e);
      }
    }

    // fallback: 直接打开 Modal，让用户选择项目后使用场景名称作为标记
    setPendingExport({ 
      blob: new Blob(), 
      name: fileName, 
      type: 'link' 
    });
    setShowProjectSelectModal(true);
  }, [viewMode, activeProjectId]);

  const handleUploadToProject = async (projectId: string) => {
    setIsUploading(true);
    setUploadStatus(null);
    
    try {
      // 如果有图片 blob，直接上传
      if (pendingExport && pendingExport.blob instanceof Blob && pendingExport.blob.size > 0) {
        const formData = new FormData();
        const fileName = pendingExport.name.endsWith('.png') ? pendingExport.name : `${pendingExport.name}.png`;
        formData.append('file', pendingExport.blob, fileName);

        const res = await fetch(`/api/upload?projectId=${encodeURIComponent(projectId)}`, {
          method: 'POST',
          body: formData,
        });

        const result = await res.json();
        
        if (result.success) {
          setUploadStatus({ type: 'success', message: lang === 'cn' ? '已成功上传到项目资产' : 'Successfully uploaded to project assets' });
          
          if (setProjects && result.data?.digitalAssets) {
            setProjects(prev => prev.map(p => 
              p.id === projectId ? { ...p, digitalAssets: result.data.digitalAssets } : p
            ));
          }
        } else {
          throw new Error(result.msg || 'Upload failed');
        }
      } else {
        // 无图片 blob 时，保存一个链接类型的资产
        const sceneName = PASCAL_PROJECTS.find(p => p.id === activeProjectId)?.name || '3D Scene';
        const assetEntry = {
          id: `asset-${Date.now()}`,
          name: pendingExport?.name || sceneName,
          type: 'link' as const,
          url: PASCAL_PROJECTS.find(p => p.id === activeProjectId)?.url || '/editor/',
          size: '-',
          uploadDate: new Date().toISOString().split('T')[0],
        };

        const res = await fetch(`/api/save-project-detailed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: projectId,
            digitalAssets: [...(mergedProjects.find(p => p.id === projectId)?.digitalAssets || []), assetEntry],
          }),
        });

        const result = await res.json();
        if (result.success) {
          setUploadStatus({ type: 'success', message: lang === 'cn' ? '场景链接已关联到项目' : 'Scene link added to project' });
          if (setProjects) {
            setProjects(prev => prev.map(p => 
              p.id === projectId ? { ...p, digitalAssets: [...(p.digitalAssets || []), assetEntry] } : p
            ));
          }
        } else {
          throw new Error(result.msg || 'Save failed');
        }
      }

      setTimeout(() => {
        setShowProjectSelectModal(false);
        setPendingExport(null);
        setUploadStatus(null);
      }, 3000);
    } catch (err: any) {
      console.error('Upload Error:', err);
      setUploadStatus({ type: 'error', message: lang === 'cn' ? `上传失败: ${err.message}` : `Upload failed: ${err.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const activeProject = useMemo(
    () => PASCAL_PROJECTS.find((p) => p.id === activeProjectId) || PASCAL_PROJECTS[0],
    [activeProjectId]
  );

  // 加载 R3F 示例场景
  useEffect(() => {
    if (sceneConfig.length === 0) loadScene(DEMO_SCENE);
  }, []);

  // 自动算量
  useEffect(() => {
    if (sceneConfig.length > 0 && !bomData && !isCalculating) calculateBom();
  }, [sceneConfig.length]);

  // 动画数字
  const animTotal = useAnimatedNumber(bomData?.summary?.total_price || 0);
  const animItems = useAnimatedNumber(bomData?.summary?.total_items || 0);
  const animSkus = useAnimatedNumber(bomData?.summary?.total_skus || 0);

  const measurements = useMemo(() => {
    let a = 0, l = 0;
    sceneConfig.forEach((n) => { a += n.area || 0; l += n.length || 0; });
    return { totalArea: Math.round(a * 100) / 100, totalLength: Math.round(l * 100) / 100 };
  }, [sceneConfig]);

  const handlePanelSelect = useCallback((sku: string) => {
    highlightFromPanel(sku);
    // 如果在 Pascal 模式，切换到 R3F 以显示高亮
    if (viewMode === 'pascal') setViewMode('r3f');
  }, [highlightFromPanel, viewMode]);

  const handleProjectSwitch = useCallback((id: string) => {
    setActiveProjectId(id);
    setViewMode('pascal');
    setIframeLoaded(false);
    setIframeError(null);
    setIframeReloadKey((prev) => prev + 1);
  }, []);

  // ─── 标注系统 ───
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const dimensionStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleSceneClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (annotationMode === 'none') return;
    const rect = sceneContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (annotationMode === 'point') {
      const label = annotationText.trim() || `标注 ${nextAnnotationId.current}`;
      setAnnotations(prev => [...prev, {
        id: nextAnnotationId.current++,
        type: 'point',
        text: label,
        x, y,
        color: ANNOTATION_COLORS[(nextAnnotationId.current - 1) % ANNOTATION_COLORS.length],
        timestamp: Date.now(),
      }]);
      setAnnotationText('');
    } else if (annotationMode === 'dimension') {
      if (!dimensionStartRef.current) {
        dimensionStartRef.current = { x, y };
      } else {
        const start = dimensionStartRef.current;
        const dx = x - start.x;
        const dy = y - start.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const label = annotationText.trim() || `${(distPx * 0.02).toFixed(2)}m`;
        setAnnotations(prev => [...prev, {
          id: nextAnnotationId.current++,
          type: 'dimension',
          text: label,
          x: start.x, y: start.y,
          x2: x, y2: y,
          color: ANNOTATION_COLORS[(nextAnnotationId.current - 1) % ANNOTATION_COLORS.length],
          timestamp: Date.now(),
        }]);
        dimensionStartRef.current = null;
        setAnnotationText('');
      }
    }
  }, [annotationMode, annotationText]);

  const removeAnnotation = useCallback((id: number) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    dimensionStartRef.current = null;
  }, []);

  const highlightedSku = highlightPulse?.sku || null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#F5F5F7] flex flex-col">
      {/* ─── 顶部导航 ─── */}
      <header className="h-[52px] bg-white/40 backdrop-blur-3xl border-b border-white/20 flex items-center justify-between px-5 shrink-0 shadow-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-red-600 to-red-500 rounded-lg flex items-center justify-center shadow-lg shadow-red-500/20">
            <Building2 size={14} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black text-gray-900 uppercase tracking-wider">
              {lang === 'cn' ? '古建材料展示中心' : 'Heritage Materials Showroom'}
            </h1>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.15em]">
              Digital Twin · BOM Engine · Immersive Experience
            </p>
          </div>
        </div>

        {/* 项目选择器 */}
        <div className="flex-1 max-w-xl mx-4">
          <ProjectSelector
            projects={PASCAL_PROJECTS}
            activeId={activeProjectId}
            onSelect={handleProjectSwitch}
            onSelectR3F={() => setViewMode('r3f')}
            viewMode={viewMode}
            editorWebUrl={EDITOR_WEB_URL}
            desktopDownloadUrl={EDITOR_DESKTOP_DOWNLOAD_URL}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* 损耗率 (Desktop only) */}
          <div className="hidden lg:flex items-center gap-1.5 bg-white/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[9px]">
            <span className="font-black text-gray-400 uppercase">损耗</span>
            <input
              type="number"
              value={Math.round(wasteRate * 100)}
              onChange={(e) => setWasteRate(Number(e.target.value) / 100)}
              className="w-8 bg-transparent font-black text-center focus:outline-none"
              min={0} max={50}
            />
            <span className="font-bold text-gray-400">%</span>
          </div>

          <button
            onClick={() => calculateBom()}
            disabled={isCalculating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900/90 backdrop-blur-md text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all disabled:opacity-30 shadow-md"
          >
            {isCalculating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span className="hidden sm:inline">算量</span>
          </button>

          {/* 一键询价 */}
          <button
            onClick={() => setShowInquiry(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:from-red-700 hover:to-red-600 transition-all shadow-md shadow-red-500/20"
          >
            <ShoppingCart size={12} />
            {lang === 'cn' ? '询价' : 'Quote'}
          </button>

          {/* 同步到项目 */}
          <button
            onClick={handleCaptureAndUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/90 backdrop-blur-md text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md"
            title={lang === 'cn' ? '同步当前场景到项目资产' : 'Sync scene to project assets'}
          >
            <Download size={12} />
            {lang === 'cn' ? '同步' : 'Sync'}
          </button>

          {onClose && (
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* ─── 主体 ─── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* 左侧：3D 场景 */}
        <div
          ref={sceneContainerRef}
          className={`flex-1 relative min-w-0 bg-gradient-to-b from-[#e8e8ed] to-[#f5f5f7] min-h-[60vh] md:min-h-0 ${annotationMode !== 'none' ? 'cursor-crosshair' : ''}`}
          onClick={handleSceneClick}
        >
          {viewMode === 'pascal' ? (
            <>
              {!iframeLoaded && !iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 bg-[#F5F5F7]">
                  <Loader2 size={32} className="animate-spin text-red-500" />
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                    {lang === 'cn' ? '正在加载 3D 场景...' : 'Loading 3D Scene...'}
                  </p>
                </div>
              )}
              {iframeError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 bg-[#F5F5F7] px-6 text-center">
                  <p className="text-xs font-black text-red-500 uppercase tracking-widest">
                    {lang === 'cn' ? '编辑器嵌入失败' : 'Editor embed failed'}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-500 max-w-md">
                    {lang === 'cn'
                      ? '请检查 /editor 路由代理是否正常。你也可以先在新窗口打开编辑器。'
                      : 'Please verify the /editor proxy. You can open editor in a new tab first.'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIframeError(null);
                        setIframeLoaded(false);
                        setIframeReloadKey((prev) => prev + 1);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                    >
                      {lang === 'cn' ? '重试' : 'Retry'}
                    </button>
                    <button
                      onClick={() => window.open(activeProject.url, '_blank')}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors"
                    >
                      {lang === 'cn' ? '新窗口打开' : 'Open in new tab'}
                    </button>
                  </div>
                </div>
              )}
              <iframe
                key={`${activeProject.id}-${iframeReloadKey}`}
                ref={iframeRef}
                src={activeProject.url}
                className={`w-full h-full border-0 transition-opacity duration-700 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                allowFullScreen
                onLoad={() => {
                  setIframeLoaded(true);
                  setIframeError(null);
                }}
                onError={() => {
                  setIframeError('iframe_load_error');
                  setIframeLoaded(false);
                }}
                style={{ pointerEvents: annotationMode !== 'none' ? 'none' : 'auto' }}
              />
            </>
          ) : (
            <>
              <SceneParser className="w-full h-full" />
            </>
          )}

          {/* ─── 标注渲染层（覆盖在 3D 场景之上） ─── */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ overflow: 'visible' }}>
            {annotations.map((ann) => {
              if (ann.type === 'dimension' && ann.x2 !== undefined && ann.y2 !== undefined) {
                const mx = (ann.x + ann.x2) / 2;
                const my = (ann.y + ann.y2) / 2;
                const dx = ann.x2 - ann.x;
                const dy = ann.y2 - ann.y;
                const distPx = Math.sqrt(dx * dx + dy * dy);
                return (
                  <g key={ann.id}>
                    {/* 测量线 */}
                    <line x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} stroke={ann.color} strokeWidth="2" strokeDasharray="6 3" />
                    {/* 端点圆 */}
                    <circle cx={ann.x} cy={ann.y} r="4" fill={ann.color} />
                    <circle cx={ann.x2} cy={ann.y2} r="4" fill={ann.color} />
                    {/* 垂直端点线 */}
                    <line x1={ann.x} y1={ann.y - 8} x2={ann.x} y2={ann.y + 8} stroke={ann.color} strokeWidth="1.5" />
                    <line x1={ann.x2} y1={ann.y2 - 8} x2={ann.x2} y2={ann.y2 + 8} stroke={ann.color} strokeWidth="1.5" />
                    {/* 标签背景 */}
                    <rect x={mx - 30} y={my - 18} width="60" height="22" rx="6" fill={ann.color} className="pointer-events-auto cursor-pointer" onClick={() => removeAnnotation(ann.id)} />
                    <text x={mx} y={my - 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="900" className="uppercase pointer-events-none">{ann.text}</text>
                  </g>
                );
              }
              // 点标注
              return (
                <g key={ann.id} className="pointer-events-auto cursor-pointer" onClick={() => removeAnnotation(ann.id)}>
                  {/* 外圈脉冲 */}
                  <circle cx={ann.x} cy={ann.y} r="12" fill="none" stroke={ann.color} strokeWidth="2" opacity="0.3">
                    <animate attributeName="r" from="8" to="20" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  {/* 内圈 */}
                  <circle cx={ann.x} cy={ann.y} r="6" fill={ann.color} stroke="white" strokeWidth="2" />
                  {/* 标签 */}
                  <rect x={ann.x + 10} y={ann.y - 14} width={Math.max(ann.text.length * 8 + 16, 50)} height="22" rx="6" fill={ann.color} />
                  <text x={ann.x + 18} y={ann.y} fill="white" fontSize="10" fontWeight="900">{ann.text}</text>
                </g>
              );
            })}
            {/* 测量模式：提示起点已选 */}
            {annotationMode === 'dimension' && dimensionStartRef.current && (
              <circle cx={dimensionStartRef.current.x} cy={dimensionStartRef.current.y} r="6" fill="#E1251B" stroke="white" strokeWidth="2" opacity="0.8">
                <animate attributeName="r" from="6" to="12" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>

          {/* ─── 标注工具栏 ─── */}
          <div className="absolute top-4 right-4 z-30 flex flex-col gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); setAnnotationMode(annotationMode === 'point' ? 'none' : 'point'); dimensionStartRef.current = null; }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                annotationMode === 'point' ? 'bg-red-600 text-white shadow-red-500/30' : 'bg-white/90 backdrop-blur-xl text-gray-600 hover:bg-white border border-gray-200'
              }`}
              title="点标注"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAnnotationMode(annotationMode === 'dimension' ? 'none' : 'dimension'); dimensionStartRef.current = null; }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                annotationMode === 'dimension' ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white/90 backdrop-blur-xl text-gray-600 hover:bg-white border border-gray-200'
              }`}
              title="尺寸标注"
            >
              <Ruler size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAnnotationMode('none'); dimensionStartRef.current = null; }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                annotationMode === 'none' ? 'bg-gray-900 text-white' : 'bg-white/90 backdrop-blur-xl text-gray-600 hover:bg-white border border-gray-200'
              }`}
              title="选择/旋转"
            >
              <MousePointer size={15} />
            </button>
            {annotations.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); clearAnnotations(); }}
                className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur-xl text-red-500 hover:bg-red-50 border border-gray-200 flex items-center justify-center transition-all shadow-lg"
                title="清除全部标注"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          {/* ─── 标注输入框（激活标注模式时显示） ─── */}
          {annotationMode !== 'none' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl px-4 py-2.5">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${annotationMode === 'point' ? 'bg-red-500' : 'bg-blue-500'}`} />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">
                {annotationMode === 'point' ? '点击添加标注' : dimensionStartRef.current ? '点击终点' : '点击起点'}
              </span>
              <input
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                className="w-32 px-2 py-1 bg-gray-50 rounded-lg text-xs font-bold border border-gray-100 focus:outline-none focus:border-red-500"
                placeholder={annotationMode === 'point' ? '标注文字...' : '尺寸标签...'}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-[9px] text-gray-300 font-bold">{annotations.length} 个标注</span>
            </div>
          )}

          {/* ─── 底部信息条 ─── */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
            {viewMode === 'r3f' && (
              <div className="bg-black/60 backdrop-blur-xl text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <Cuboid size={12} />
                {sceneConfig.length} 构件
              </div>
            )}
            {viewMode === 'pascal' && iframeLoaded && (
              <div className="bg-black/60 backdrop-blur-xl text-white px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <Globe2 size={12} />
                {activeProject.name}
              </div>
            )}
            {selectedSku && (
              <div className="bg-white/90 backdrop-blur-xl border border-gray-100 px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black text-gray-900">{selectedSku}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── 桌面端侧栏（md 以上显示） ─── */}
        <aside className="hidden md:flex w-[400px] h-full flex-col shrink-0 bg-[#F5F5F7]/40 backdrop-blur-3xl border-l border-white/20 overflow-hidden">
          {/* 统计头 */}
          <div className="p-4 shrink-0">
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard icon={<TrendingUp size={14} />} label={lang === 'cn' ? '预计总造价' : 'Total Cost'} value={`¥${Math.round(animTotal).toLocaleString()}`} accent="text-red-600" />
              <StatCard icon={<Package size={14} />} label={lang === 'cn' ? '材料总数' : 'Total Pieces'} value={Math.round(animItems).toLocaleString()} subtitle={`${Math.round(animSkus)} SKUs`} />
              <StatCard icon={<Ruler size={14} />} label={lang === 'cn' ? '测量面积' : 'Area'} value={`${measurements.totalArea} ㎡`} subtitle={`${measurements.totalLength}m 延米`} />
              <StatCard icon={<BarChart3 size={14} />} label={lang === 'cn' ? '损耗率' : 'Waste'} value={`${Math.round(wasteRate * 100)}%`} subtitle={lang === 'cn' ? '向上取整' : 'Rounded up'} />
            </div>
          </div>
          {/* BOM 明细 */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5 custom-scrollbar">
            {isCalculating && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={28} className="animate-spin text-red-500" />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'cn' ? '正在计算...' : 'Calculating...'}</p>
              </div>
            )}
            {!isCalculating && bomData && bomData.groups.map((group) => (
              <BomGroupCard key={group.group_code} group={group} highlightedSku={highlightedSku} onSelectSku={handlePanelSelect} />
            ))}
            {!isCalculating && !bomData && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-30">
                <Calculator size={40} />
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">{lang === 'cn' ? '点击"算量"开始' : 'Click Calculate'}</p>
              </div>
            )}
            {bomData && (
              <div className="mt-4 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white">
                <h4 className="text-xs font-black uppercase tracking-widest mb-1">{lang === 'cn' ? '对这个方案感兴趣？' : 'Interested in this design?'}</h4>
                <p className="text-[10px] text-white/50 mb-4">{lang === 'cn' ? '我们提供全球古建材料供应与工程支持服务' : 'We provide global heritage material supply & engineering support'}</p>
                <button onClick={() => setShowInquiry(true)} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-900/30">
                  <Send size={13} />{lang === 'cn' ? '获取报价 & 工程方案' : 'Get Quote & Engineering Plan'}
                </button>
              </div>
            )}
            <div className="h-4" />
          </div>
        </aside>

        {/* ─── 移动端三段式底部抽屉 (framer-motion) ─── */}
        <MobileBottomSheet
          sheetStage={sheetStage}
          setSheetStage={setSheetStage}
          animTotal={animTotal}
          animItems={animItems}
          animSkus={animSkus}
          measurements={measurements}
          wasteRate={wasteRate}
          isCalculating={isCalculating}
          bomData={bomData}
          highlightedSku={highlightedSku}
          handlePanelSelect={handlePanelSelect}
          setShowInquiry={setShowInquiry}
          lang={lang}
        />
      </div>

      {/* ── 导出项目选择 Modal ── */}
      {showProjectSelectModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isUploading && setShowProjectSelectModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300 flex flex-col max-h-[80vh]">
            <button onClick={() => setShowProjectSelectModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors">
              <X size={24} />
            </button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Download size={32} />
              </div>
              <h3 className="text-xl font-black">{lang === 'cn' ? '上传设计到项目资产' : 'Push to Project Assets'}</h3>
              <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">{lang === 'cn' ? '请选择目标项目' : 'Select Target Project'}</p>
            </div>

            {uploadStatus && (
              <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {uploadStatus.type === 'error' ? <Box size={18} /> : <Box size={18} />}
                <span className="text-xs font-black uppercase tracking-tight">{uploadStatus.message}</span>
              </div>
            )}

            {!uploadStatus && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-4">
                {mergedProjects && mergedProjects.length > 0 ? mergedProjects.map((p: any) => (
                  <button 
                    key={p.id}
                    onClick={() => handleUploadToProject(p.id)}
                    disabled={isUploading}
                    className="w-full flex items-center justify-between p-5 bg-gray-50 hover:bg-white hover:shadow-xl hover:border-red-100 border border-transparent rounded-2xl transition-all group relative overflow-hidden"
                  >
                    <div className="text-left relative z-10">
                      <div className="text-[14px] font-black text-gray-900 group-hover:text-red-600 transition-colors">{p.name || '未命名项目'}</div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{p.id}</div>
                    </div>
                    <div className="relative z-10">
                      {isUploading ? <Loader2 size={18} className="animate-spin text-red-500" /> : <ChevronRight size={18} className="text-gray-300 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />}
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500 transform translate-x-full group-hover:translate-x-0 transition-transform" />
                  </button>
                )) : (
                  <div className="py-12 text-center">
                    <div className="text-gray-200 mb-2 flex justify-center"><Box size={48} /></div>
                    <div className="text-gray-400 text-xs font-black uppercase tracking-widest">
                      {lang === 'cn' ? '暂无可用项目' : 'No projects available'}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {uploadStatus && uploadStatus.type === 'success' && (
              <div className="pt-2 text-center animate-bounce">
                <div className="text-red-500 font-black text-xs uppercase tracking-[0.3em]">Sync Completed</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 询价弹窗 ─── */}
      {showInquiry && (
        <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setShowInquiry(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900">
                  {lang === 'cn' ? '获取工程报价' : 'Request a Quote'}
                </h3>
                <p className="text-xs text-gray-400 font-bold mt-1">
                  {lang === 'cn' ? '预计总造价' : 'Est. Total'}: ¥{Math.round(bomData?.summary?.total_price || 0).toLocaleString()}
                  {' · '}{bomData?.summary?.total_skus || 0} SKUs
                </p>
              </div>
              <button onClick={() => setShowInquiry(false)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  {lang === 'cn' ? '公司名称 / 项目名称' : 'Company / Project Name'}
                </label>
                <input className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20" placeholder={lang === 'cn' ? '例：小龙坎柏林分店' : 'e.g., Xiaolongkan Berlin'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                    {lang === 'cn' ? '联系人' : 'Contact'}
                  </label>
                  <input className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Email / WhatsApp</label>
                  <input className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:outline-none focus:border-red-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  {lang === 'cn' ? '备注' : 'Notes'}
                </label>
                <textarea className="w-full px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-sm font-bold focus:outline-none focus:border-red-500 resize-none h-20" placeholder={lang === 'cn' ? '您的需求描述...' : 'Describe your needs...'} />
              </div>
            </div>

            <button className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:from-red-700 hover:to-red-600 transition-all shadow-lg shadow-red-500/20">
              <Send size={14} />
              {lang === 'cn' ? '提交询价请求' : 'Submit Quote Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(EngineeringDecisionCenter);
