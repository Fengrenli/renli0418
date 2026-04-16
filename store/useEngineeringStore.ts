/**
 * 🏗️ Engineering Decision Center — Zustand 全局状态中枢
 *
 * 职责：
 * 1. 管理 Pascal 场景 JSON（sceneConfig）
 * 2. 维护 3D 场景中当前选中的构件（selectedSku）
 * 3. 缓存后端 BOM 算量结果（bomData）
 * 4. 驱动 3D 场景 ↔ 决策看板的双向联动
 */

import { create } from 'zustand';

// ─── 类型定义 ─────────────────────────────────────

/** Pascal 导出的单个场景节点 */
export interface SceneNode {
  /** 唯一标识（构件实例 ID） */
  id: string;
  /** 材料 SKU 编码（如 BR99-GYHG-ABETH-001） */
  sku: string;
  /** 构件名称（如 "筒瓦"） */
  name?: string;
  /** 3D 位置 [x, y, z] */
  position: [number, number, number];
  /** 3D 旋转 [x, y, z]（弧度） */
  rotation?: [number, number, number];
  /** 3D 缩放 [x, y, z] */
  scale?: [number, number, number];
  /** 模型文件路径（如 /uploads/default/筒瓦.glb） */
  modelUrl?: string;
  /** 测量面积（㎡） */
  area?: number;
  /** 测量长度（延米） */
  length?: number;
  /** 数量 */
  quantity?: number;
  /** 构件分类（eaves / wall / structure / decoration） */
  category?: string;
  /** 自定义颜色（Hex） */
  color?: string;
}

/** BOM 算量结果中的单项 */
export interface BomLineItem {
  sku_code: string;
  name: string;
  unit: string;
  category: string;
  label: string;
  unit_price: number;
  raw_qty: number;
  final_qty: number;
  total_price: number;
  calc_mode: string;
  measured: { area: number; length: number; quantity: number };
}

/** BOM 分组 */
export interface BomGroup {
  group_name: string;
  group_code: string;
  items: BomLineItem[];
  subtotal: number;
}

/** BOM 汇总 */
export interface BomSummary {
  total_price: number;
  total_items: number;
  total_skus: number;
  waste_rate: number;
}

/** 完整 BOM 算量结果 */
export interface BomData {
  summary: BomSummary;
  groups: BomGroup[];
  unmatched?: { sku: string; reason: string }[];
}

/** 高亮脉冲状态 */
export interface HighlightPulse {
  sku: string;
  timestamp: number;
}

// ─── Store 定义 ─────────────────────────────────────

interface EngineeringState {
  /** Pascal 场景配置（构件数组） */
  sceneConfig: SceneNode[];
  /** 当前在 3D 场景中选中的构件 SKU */
  selectedSku: string | null;
  /** 当前选中的构件实例 ID */
  selectedNodeId: string | null;
  /** BOM 算量结果 */
  bomData: BomData | null;
  /** 是否正在计算 */
  isCalculating: boolean;
  /** 高亮脉冲信号（用于看板滚动联动） */
  highlightPulse: HighlightPulse | null;
  /** 全局损耗率 */
  wasteRate: number;
  /** 3D 摄像机是否正在动画中 */
  isCameraAnimating: boolean;
  /** 移动端底部抽屉阶段: peek | half | full */
  sheetStage: 'peek' | 'half' | 'full';

  // ─── Actions ───
  /** 加载 Pascal 场景 JSON */
  loadScene: (nodes: SceneNode[]) => void;
  /** 清空场景 */
  clearScene: () => void;
  /** 添加单个构件到场景 */
  addNode: (node: SceneNode) => void;
  /** 移除构件 */
  removeNode: (nodeId: string) => void;
  /** 更新构件属性 */
  updateNode: (nodeId: string, patch: Partial<SceneNode>) => void;

  /** 3D 场景点击 → 选中 SKU（触发看板联动） */
  selectSku: (sku: string | null, nodeId?: string | null) => void;
  /** 看板点击 → 高亮 3D 构件（反向联动） */
  highlightFromPanel: (sku: string) => void;

  /** 设置 BOM 算量结果 */
  setBomData: (data: BomData | null) => void;
  /** 触发后端算量 */
  calculateBom: () => Promise<void>;

  /** 设置损耗率 */
  setWasteRate: (rate: number) => void;
  /** 设置摄像机动画状态 */
  setCameraAnimating: (v: boolean) => void;
  /** 设置抽屉阶段 */
  setSheetStage: (stage: 'peek' | 'half' | 'full') => void;
}

export const useEngineeringStore = create<EngineeringState>((set, get) => ({
  // ─── Initial State ───
  sceneConfig: [],
  selectedSku: null,
  selectedNodeId: null,
  bomData: null,
  isCalculating: false,
  highlightPulse: null,
  wasteRate: 0.10,
  isCameraAnimating: false,
  sheetStage: 'peek',

  // ─── Scene Management ───
  loadScene: (nodes) => set({ sceneConfig: nodes, selectedSku: null, selectedNodeId: null, bomData: null }),

  clearScene: () => set({ sceneConfig: [], selectedSku: null, selectedNodeId: null, bomData: null }),

  addNode: (node) => set((s) => ({ sceneConfig: [...s.sceneConfig, node] })),

  removeNode: (nodeId) => set((s) => ({
    sceneConfig: s.sceneConfig.filter((n) => n.id !== nodeId),
    selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
  })),

  updateNode: (nodeId, patch) => set((s) => ({
    sceneConfig: s.sceneConfig.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
  })),

  // ─── Selection & Linking ───
  selectSku: (sku, nodeId) => {
    set({
      selectedSku: sku,
      selectedNodeId: nodeId ?? null,
      highlightPulse: sku ? { sku, timestamp: Date.now() } : null,
    });
  },

  highlightFromPanel: (sku) => {
    set({
      selectedSku: sku,
      highlightPulse: { sku, timestamp: Date.now() },
      sheetStage: 'half',
    });
  },

  // ─── BOM Calculation ───
  setBomData: (data) => set({ bomData: data }),

  calculateBom: async () => {
    const { sceneConfig, wasteRate } = get();
    if (sceneConfig.length === 0) return;

    set({ isCalculating: true });
    try {
      const scenePayload = sceneConfig.map((n) => ({
        sku: n.sku,
        area: n.area || 0,
        length: n.length || 0,
        quantity: n.quantity || 1,
      }));

      const res = await fetch('/api/bom/calculate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: scenePayload, waste_rate: wasteRate }),
      });

      const json = await res.json();
      if (json.success) {
        set({ bomData: json.data });
      } else {
        console.error('[BOM] 算量失败:', json.msg);
      }
    } catch (err) {
      console.error('[BOM] 请求异常:', err);
    } finally {
      set({ isCalculating: false });
    }
  },

  // ─── Config ───
  setWasteRate: (rate) => set({ wasteRate: rate }),
  setCameraAnimating: (v) => set({ isCameraAnimating: v }),
  setSheetStage: (stage) => set({ sheetStage: stage }),
}));
