import React, { useEffect, useMemo, useState } from 'react';
import { X, Shield, HardHat, Package } from 'lucide-react';
import type { Material, CartItem } from '../types';

const SESSION_KEY = 'rl_engineering_bom_draft';
const HERO_IMG = '/assets/digital-twin-storefront.png';
/** 与官网 VI 一致：黑 / 白 / 灰 / 仁力红（不用 #FF0000 以免与印刷色偏差） */
const VI = {
  bg: '#1A1A1A',
  black: '#000000',
  white: '#FFFFFF',
  gray: '#808080',
  line: '#E0E0E0',
  red: '#E1251B',
} as const;

export type EngineeringScenarioKind = 'eaves' | 'wall' | 'generic';

export function inferEngineeringKind(
  activeCategory: string,
  material: Material | null,
): EngineeringScenarioKind {
  const id = `${material?.id || ''}`.toUpperCase();
  const nm = `${material?.name || ''}`;
  /** 有聚焦物料时优先看编码/名称，避免「墙地瓷砖」分类盖住用户点的筒瓦 SKU */
  if (material) {
    if (/ABMRR|ABCEC|MRR|CEC/.test(id) || /青砖|预制板|墙板|切片/.test(nm)) {
      return 'wall';
    }
    if (/ABETH|ABDET|ABHRG|ABRTL|ABTIE|ABRAF/.test(id) || /筒瓦|瓦片|屋檐|滴水|正脊|挡沟/.test(nm)) {
      return 'eaves';
    }
  }
  const blob = `${material?.id || ''} ${nm} ${material?.category || ''} ${activeCategory}`;
  const s = blob.toLowerCase();
  if (
    /墙地瓷砖|陶艺|铺贴|青砖|预制板|abmrr|abcec|cec-/.test(s) ||
    /ce01-gyhg-abmrr|ce01-gyhg-abcec/i.test(blob)
  ) {
    return 'wall';
  }
  if (
    /定制中式|建筑结构|筒瓦|瓦片|屋檐|脊|烧制|陶制|abdet|abeth|abhrg|abrtl/.test(s) ||
    /ce01-gyhg-abdet|ce01-gyhg-abeth|ce01-gyhg-abhrg/i.test(blob)
  ) {
    return 'eaves';
  }
  return 'generic';
}

/** 严格：仅 assets/PIC/${code}.png（与后端 imageRef 一致） */
export function resolveProductImageSrc(code: string): string {
  const c = (code || '').trim();
  if (!c) return '';
  return `/assets/PIC/${c}.png`;
}

function resolveSkuCode(materials: Material[], candidates: string[]): string {
  for (const c of candidates) {
    if (materials.some((m) => String(m.id) === c)) return c;
  }
  return candidates[0] || '';
}

/** 与 server seedBomAssemblyRules 白名单一致（短码优先展示，mock 与 API 同源） */
const EAVES_SKU_ROWS: {
  cands: string[];
  qtyPerM: number;
  defaultName: string;
  label: string;
}[] = [
  { cands: ['BR99-GYHG-ABETH-001', 'ABETH-002', 'ABETH-001', 'CE01-GYHG-ABETH-002'], qtyPerM: 25, defaultName: '筒瓦', label: '筒瓦 片/延米' },
  { cands: ['BR99-GYHG-X8D5-001', 'ABDET-001', 'CE01-GYHG-ABDET-001'], qtyPerM: 35, defaultName: '板瓦', label: '板瓦 片/延米' },
  {
    cands: ['BR99-GYHG-ABHRG-001', 'ABHRG-002', 'ABHRG-001', 'CE01-GYHG-ABHRG-002', 'CE01-GYHG-ABHRG-001'],
    qtyPerM: 2,
    defaultName: '正脊',
    label: '正脊 套/延米',
  },
  { cands: ['BR99-GYHG-ABTIE-001', 'ABTIE-001', 'CE01-GYHG-ABTIE-001'], qtyPerM: 1.5, defaultName: '滴水', label: '滴水 套/延米' },
  { cands: ['BR99-GYHG-ABRAF-001', 'ABRAF-001', 'CE01-GYHG-ABRAF-001'], qtyPerM: 1.5, defaultName: '挡沟', label: '挡沟 套/延米' },
];

const WALL_SKU_ROWS: {
  cands: string[];
  qtyFactor: (v: number) => number;
  waste: number;
  defaultName: string;
  label: string;
}[] = [
  {
    cands: ['BR99-GYHG-ABMRR-002', 'ABCEC-002', 'CE01-GYHG-ABCEC-002'],
    qtyFactor: (v) => v * (1 / 0.702) * 0.95,
    waste: 0.03,
    defaultName: '预制墙板',
    label: '预制墙板 块/㎡（主材 · 95% 面积）',
  },
  {
    cands: ['BR99-GYHG-ABMRR-001', 'ABMRR-001', 'CE01-GYHG-ABMRR-001'],
    qtyFactor: (v) => v * 80 * 0.05,
    waste: 0.375,
    defaultName: '青砖片',
    label: '青砖片 片/㎡（收口 · 5% 面积）',
  },
];

/** 列表接口已 DISTINCT ON code；此处再兜底：同码多行时取最后一条（通常与库内最大 id 一致） */
function pickMaterialByCode(materials: Material[], code: string): Material | undefined {
  // 优先按 code 字段匹配，其次按 id 匹配（兼容旧数据）
  const byCode = materials.filter((x) => String((x as any).code || '') === String(code));
  if (byCode.length > 0) return byCode[byCode.length - 1];
  const matches = materials.filter((x) => String(x.id) === String(code));
  if (matches.length === 0) return undefined;
  return matches[matches.length - 1];
}

type BomLine = {
  code: string;
  name: string;
  standardQty: number;
  wasteRate: number;
  finalOrderQty: number;
  unitPrice: number;
  linePrice: number;
  weightEach: number;
  volumeEach: number;
  lineWeight: number;
  lineVolume: number;
  imageRef: string;
  ruleItemLabel?: string;
  highBrickWasteWarning?: { message: string } | null;
};

function buildLine(
  code: string,
  nameDefault: string,
  standardQty: number,
  wasteRate: number,
  ruleItemLabel: string,
  materials: Material[],
): BomLine {
  const finalOrderQty = Math.ceil(standardQty * (1 + wasteRate));
  const m = pickMaterialByCode(materials, code);
  const name = m?.name || nameDefault;
  const unitPrice = m?.basePrice ?? 0;
  const weightEach = m?.weight ?? 0;
  const volumeEach = m?.volume ?? 0;
  return {
    code,
    name,
    standardQty,
    wasteRate,
    finalOrderQty,
    unitPrice,
    linePrice: finalOrderQty * unitPrice,
    weightEach,
    volumeEach,
    lineWeight: finalOrderQty * weightEach,
    lineVolume: finalOrderQty * volumeEach,
    imageRef: `assets/PIC/${code}.png`,
    ruleItemLabel,
    highBrickWasteWarning:
      code.toUpperCase().includes('ABMRR') || code.includes('ABMRR')
        ? { message: '散砖大面积铺贴：高损耗与人工预警（预览数据）' }
        : null,
  };
}

/** 本地 mock 与 server seed 白名单一致；图片仅 /assets/PIC/${code}.png */
function computeMockPayload(
  scenario: 'eaves_standard' | 'wall_hybrid',
  value: number,
  materials: Material[],
): {
  scenario_name: string;
  scenario_unit: string;
  inputValue: number;
  lines: BomLine[];
  totals: { totalWeight: number; totalVolume: number; totalPrice: number };
} {
  const EAVES_WASTE = 0.1;
  if (scenario === 'eaves_standard') {
    const lines = EAVES_SKU_ROWS.map((row) => {
      const code = resolveSkuCode(materials, row.cands);
      return buildLine(
        code,
        row.defaultName,
        value * row.qtyPerM,
        EAVES_WASTE,
        row.label,
        materials,
      );
    });
    const totals = lines.reduce(
      (acc, l) => ({
        totalWeight: acc.totalWeight + l.lineWeight,
        totalVolume: acc.totalVolume + l.lineVolume,
        totalPrice: acc.totalPrice + l.linePrice,
      }),
      { totalWeight: 0, totalVolume: 0, totalPrice: 0 },
    );
    return {
      scenario_name: '中式标准屋檐 (亚特兰大同款)',
      scenario_unit: 'linear_meter',
      inputValue: value,
      lines,
      totals,
    };
  }

  const lines = WALL_SKU_ROWS.map((row) => {
    const code = resolveSkuCode(materials, row.cands);
    return buildLine(code, row.defaultName, row.qtyFactor(value), row.waste, row.label, materials);
  });
  const totals = lines.reduce(
    (acc, l) => ({
      totalWeight: acc.totalWeight + l.lineWeight,
      totalVolume: acc.totalVolume + l.lineVolume,
      totalPrice: acc.totalPrice + l.linePrice,
    }),
    { totalWeight: 0, totalVolume: 0, totalPrice: 0 },
  );
  return {
    scenario_name: '数字化墙面方案 (预制+散砖收口)',
    scenario_unit: 'sqm',
    inputValue: value,
    lines,
    totals,
  };
}

const BomRowImage: React.FC<{ code: string }> = ({ code }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveProductImageSrc(code);

  if (!code || failed || !src) {
    return (
      <div
        className="w-[4.5rem] h-[4.5rem] md:w-[5.25rem] md:h-[5.25rem] shrink-0 flex items-center justify-center border border-[#E0E0E0] text-center px-1"
        style={{ backgroundColor: VI.gray }}
        title={code || 'NO CODE'}
      >
        <span
          className="text-[10px] md:text-xs font-black leading-tight uppercase tracking-tight"
          style={{ color: VI.red }}
        >
          MISSING PIC
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-[4.5rem] h-[4.5rem] md:w-[5.25rem] md:h-[5.25rem] object-cover shrink-0 border border-[#E0E0E0]"
      style={{ backgroundColor: VI.black }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        console.warn(`[EngineeringAssistantModal] Missing assets/PIC/${code}.png — show MISSING PIC.`);
        setFailed(true);
      }}
    />
  );
};

const EngineeringAssistantModal: React.FC<{
  open: boolean;
  onClose: () => void;
  activeCategory: string;
  focusMaterial: Material | null;
  onClearFocus: () => void;
  materials: Material[];
  onAddLinesAsCart: (items: CartItem[]) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  lang: 'cn' | 'en' | 'de';
}> = ({
  open,
  onClose,
  activeCategory,
  focusMaterial,
  onClearFocus,
  materials,
  onAddLinesAsCart,
  showToast,
  lang,
}) => {
  const kind = useMemo(
    () => inferEngineeringKind(activeCategory, focusMaterial),
    [activeCategory, focusMaterial],
  );

  const [uiMode, setUiMode] = useState<'plan' | 'parts'>('plan');
  const [scenarioCode, setScenarioCode] = useState<'eaves_standard' | 'wall_hybrid'>('eaves_standard');
  const [valueLinear, setValueLinear] = useState(12);
  const [valueArea, setValueArea] = useState(20);
  const wasOpenRef = React.useRef(false);

  /** 仅在每次「从关到开」时根据上下文设默认场景，避免用户已选手动切换后被 effect 覆盖 */
  React.useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (!wasOpenRef.current) {
      wasOpenRef.current = true;
      setScenarioCode(kind === 'wall' ? 'wall_hybrid' : 'eaves_standard');
    }
  }, [open, kind]);

  const [apiPlanPayload, setApiPlanPayload] = useState<ReturnType<typeof computeMockPayload> | null>(
    null,
  );
  const [bomFetchErr, setBomFetchErr] = useState<string | null>(null);
  const [bomLoading, setBomLoading] = useState(false);
  const bomFetchSeqRef = React.useRef(0);

  useEffect(() => {
    if (!open) {
      setApiPlanPayload(null);
      setBomFetchErr(null);
      setBomLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || uiMode !== 'plan') return;
    const value = scenarioCode === 'wall_hybrid' ? valueArea : valueLinear;
    const sc = scenarioCode;
    const mySeq = ++bomFetchSeqRef.current;
    let cancelled = false;
    setBomLoading(true);
    const tid = window.setTimeout(async () => {
      try {
        const r = await fetch('/api/v1/calculate-bom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario_code: sc, value }),
        });
        const j = (await r.json()) as {
          success?: boolean;
          msg?: string;
          data?: {
            scenario_name?: string;
            scenario_unit?: string;
            inputValue?: number;
            lines?: Record<string, unknown>[];
            totals?: { totalWeight?: number; totalVolume?: number; totalPrice?: number };
          };
        };
        if (cancelled || mySeq !== bomFetchSeqRef.current) return;
        if (r.ok && j.success && j.data?.lines && Array.isArray(j.data.lines)) {
          const lines: BomLine[] = j.data.lines.map((row) => ({
            code: String(row.code),
            name: String(row.name ?? ''),
            standardQty: Number(row.standardQty),
            wasteRate: Number(row.wasteRate),
            finalOrderQty: Number(row.finalOrderQty),
            unitPrice: Number(row.unitPrice),
            linePrice: Number(row.linePrice),
            weightEach: Number(row.weightEach),
            volumeEach: Number(row.volumeEach),
            lineWeight: Number(row.lineWeight),
            lineVolume: Number(row.lineVolume),
            imageRef: String(row.imageRef ?? ''),
            ruleItemLabel: row.ruleItemLabel != null ? String(row.ruleItemLabel) : undefined,
            highBrickWasteWarning: (row.highBrickWasteWarning as BomLine['highBrickWasteWarning']) ?? null,
          }));
          setApiPlanPayload({
            scenario_name: String(j.data.scenario_name ?? ''),
            scenario_unit: String(j.data.scenario_unit ?? ''),
            inputValue: Number(j.data.inputValue),
            lines,
            totals: {
              totalWeight: Number(j.data.totals?.totalWeight ?? 0),
              totalVolume: Number(j.data.totals?.totalVolume ?? 0),
              totalPrice: Number(j.data.totals?.totalPrice ?? 0),
            },
          });
          setBomFetchErr(null);
        } else {
          if (mySeq !== bomFetchSeqRef.current) return;
          setApiPlanPayload(null);
          setBomFetchErr(String(j.msg || `HTTP ${r.status}`));
        }
      } catch {
        if (!cancelled && mySeq === bomFetchSeqRef.current) {
          setApiPlanPayload(null);
          setBomFetchErr(
            lang === 'cn' ? '网络或服务不可用' : lang === 'de' ? 'Netzwerkfehler' : 'Network error',
          );
        }
      } finally {
        if (!cancelled && mySeq === bomFetchSeqRef.current) setBomLoading(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [open, uiMode, scenarioCode, valueLinear, valueArea, lang]);

  const planSubtitle = useMemo(() => {
    if (lang === 'en') {
      if (bomLoading && !apiPlanPayload) return 'Syncing BOM from rule_items…';
      if (apiPlanPayload) return 'Atlanta-certified engine · synced with database rules';
      if (bomFetchErr) return `API unavailable (${bomFetchErr}) — local seed preview`;
      return 'Atlanta-certified · local preview (same whitelist as seed when offline)';
    }
    if (lang === 'de') {
      if (bomLoading && !apiPlanPayload) return 'Synchronisiere Stückliste…';
      if (apiPlanPayload) return 'Atlanta-zertifiziert · mit Datenbankregeln synchron';
      if (bomFetchErr) return `API nicht verfügbar (${bomFetchErr}) — lokale Vorschau`;
      return 'Atlanta-zertifiziert · lokale Vorschau (offline wie Seed-Whitelist)';
    }
    if (bomLoading && !apiPlanPayload) return '正在从 rule_items 同步算量…';
    if (apiPlanPayload) return '亚特兰大认证算量引擎 · 已与数据库规则同步';
    if (bomFetchErr) return `算量接口不可用（${bomFetchErr}），以下为与 seed 白名单一致的本地预览`;
    return '亚特兰大认证算量引擎 · 本地预览（离线时与 seed 白名单一致）';
  }, [lang, bomLoading, apiPlanPayload, bomFetchErr]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const inputValue = scenarioCode === 'wall_hybrid' ? valueArea : valueLinear;
  const mockPlanPayload = computeMockPayload(scenarioCode, inputValue, materials);
  const payload = uiMode === 'plan' ? (apiPlanPayload ?? mockPlanPayload) : null;
  const certification = '亚特兰大店同款算法认证';
  const payloadFromApi = apiPlanPayload !== null;
  const anyBrick = payload?.lines.some((l) => l.highBrickWasteWarning);

  const t =
    lang === 'en'
      ? {
          title: 'Engineering Decision Center',
            subtitle: planSubtitle,
          close: 'Close',
          plan: 'Preset package',
          parts: 'Loose items',
          eaves: 'Eaves (linear m)',
          wall: 'Wall hybrid (㎡)',
          length: 'Run length (m)',
          area: 'Wall area (㎡)',
          presetHint: 'Typical storefront eaves depth ≈ 1.2–1.5 m — adjust length for full run.',
          partsHint: 'Add SKUs from the library below; this screen is for engineered packages.',
          cert: 'Digital Twin · Certified algorithm',
          twin: 'Digital Twin Certified',
          twinSub: '数字化孪生认证',
          bom: 'Bill of materials',
          standard: 'Standard qty',
          waste: 'Waste Δ',
          final: 'Order qty',
          totals: 'Logistics totals',
          weight: 'Total weight',
          vol: 'Total volume',
          price: 'Est. line value (CNY)',
          compare: 'Cost & efficiency — brick vs panel',
          brickCol: 'Loose brick',
          panelCol: 'Prefab panel',
          launch: 'Launch Decision Center',
          gen: 'Push to BOM workspace',
        }
      : lang === 'de'
        ? {
            title: 'Engineering Decision Center',
            subtitle: planSubtitle,
            close: 'Schließen',
            plan: 'Paket',
            parts: 'Einzelteile',
            eaves: 'Trauf (lfm)',
            wall: 'Wand Hybrid (m²)',
            length: 'Länge (m)',
            area: 'Fläche (m²)',
            presetHint: 'Typische Traufe 1,2–1,5 m.',
            partsHint: 'Lose Positionen über die Bibliothek.',
            cert: 'Digital Twin · Zertifiziert',
            twin: 'Digital Twin Certified',
            twinSub: '数字化孪生认证',
            bom: 'Stückliste',
            standard: 'Soll',
            waste: 'Verschnitt Δ',
            final: 'Bestellmenge',
            totals: 'Logistik',
            weight: 'Gewicht',
            vol: 'Volumen',
            price: 'Schätzwert CNY',
            compare: 'Vergleich Ziegel vs Platte',
            brickCol: 'Einzelziegel',
            panelCol: 'Fertigplatte',
            launch: 'Decision Center',
            gen: 'In BOM übernehmen',
          }
        : {
            title: '工程决策中心',
            subtitle: planSubtitle,
            close: '关闭',
            plan: '成品方案',
            parts: '灵活散件',
            eaves: '屋檐算量（延米）',
            wall: '混合墙面（㎡）',
            length: '屋檐总延米',
            area: '墙面面积（㎡）',
            presetHint: '门头典型屋檐进深约 1.2–1.5 m，请按实际檐口拉通长度调整延米。',
            partsHint: '散件请在左侧物料库点击卡片加入购物车；此处专注「场景化套餐」算量。',
            cert: '数字化孪生 · 算法认证',
            twin: 'Digital Twin Certified',
            twinSub: '数字化孪生认证',
            bom: '物料清单（BOM）',
            standard: '标准用量',
            waste: '损耗增量',
            final: '最终下单量',
            totals: '物流汇总',
            weight: '总重',
            vol: '总体积',
            price: '参考金额（CNY）',
            compare: '散砖 vs 预制板 — 成本与效率',
            brickCol: '散砖铺贴',
            panelCol: '预制墙板',
            launch: '启动工程决策中心',
            gen: '生成并写入 BOM 工作区',
          };

  const handleGenerate = () => {
    if (!payload?.lines.length) {
      showToast(lang === 'cn' ? '请先选择「成品方案」' : 'Select preset package first', 'info');
      return;
    }
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          certification,
          scenario: scenarioCode,
          value: inputValue,
          lines: payload.lines,
          totals: payload.totals,
          mock: !payloadFromApi,
        }),
      );
    } catch {
      /* ignore */
    }
    const items: CartItem[] = payload.lines.map((line, i) => {
      const m = pickMaterialByCode(materials, line.code);
      const imgPrimary = resolveProductImageSrc(line.code);
      const base: Material =
        m ||
        ({
          id: line.code,
          name: line.name,
          category: '工程算量',
          brandId: '',
          imageUrl: imgPrimary,
          unit: '片',
          basePrice: line.unitPrice,
          hsCode: '',
          weight: line.weightEach,
          volume: line.volumeEach,
        } as Material);
      return {
        ...base,
        imageUrl: m?.imageUrl || imgPrimary,
        cartId: `${line.code}-eng-${Date.now()}-${i}`,
        quantity: line.finalOrderQty,
        packingNo: '',
        selectedSpec: line.ruleItemLabel || base.specs,
        selectedArea: payload.scenario_name,
      };
    });
    onAddLinesAsCart(items);
    showToast(lang === 'cn' ? '已写入右侧 BOM，可继续编辑导出' : 'Added to workspace', 'success');
    onClose();
    requestAnimationFrame(() => {
      document.getElementById('bom-workspace-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden text-white"
      style={{ backgroundColor: VI.bg }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="engineering-decision-center-title"
    >
      <header
        className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-6 md:px-12 md:py-8 shrink-0 border-b"
        style={{ borderColor: VI.line, backgroundColor: VI.black }}
      >
        <div className="min-w-0">
          <h2
            id="engineering-decision-center-title"
            className="font-black tracking-tight truncate text-white"
            style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)' }}
          >
            🛡️ {t.title}
          </h2>
          <p
            className="mt-2 font-medium leading-relaxed max-w-3xl"
            style={{ color: VI.gray, fontSize: 'clamp(1rem, 1.5vw, 1.125rem)' }}
          >
            {t.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 flex items-center gap-2 px-6 py-3 font-bold border-2 transition-colors hover:opacity-90"
          style={{
            borderColor: VI.line,
            backgroundColor: VI.bg,
            color: VI.white,
            fontSize: '1.0625rem',
          }}
        >
          <X size={22} />
          {t.close}
        </button>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1680px] mx-auto px-6 py-10 md:px-12 md:py-12 grid grid-cols-1 xl:grid-cols-2 gap-12 xl:gap-16">
          <section className="flex flex-col gap-10 min-w-0">
            <div
              className="relative overflow-hidden border aspect-[16/10] max-h-[min(54vh,560px)]"
              style={{ borderColor: VI.line, backgroundColor: VI.black }}
            >
              <img
                src={HERO_IMG}
                alt=""
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = '0.35';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 flex flex-wrap items-end justify-between gap-3 bg-black/80 border-t" style={{ borderColor: VI.line }}>
                <div className="px-4 py-3 border-2 bg-white" style={{ borderColor: VI.line }}>
                  <p className="text-base md:text-lg font-black tracking-widest uppercase" style={{ color: VI.red }}>
                    {t.twin}
                  </p>
                  <p className="text-sm md:text-base font-bold mt-1" style={{ color: VI.gray }}>
                    {t.twinSub}
                  </p>
                </div>
                <div className="px-4 py-3 border-2 bg-black" style={{ borderColor: VI.red }}>
                  <span className="text-sm md:text-base font-black text-white uppercase tracking-wide">{certification}</span>
                </div>
              </div>
            </div>

            {focusMaterial && (
              <div
                className="flex items-center justify-between gap-3 px-5 py-4 border text-lg"
                style={{ borderColor: VI.line, backgroundColor: VI.black, color: VI.gray }}
              >
                <span className="truncate">
                  <span className="font-semibold">聚焦物料 </span>
                  <span className="font-bold text-white">{focusMaterial.name}</span>
                  <span> ({focusMaterial.id})</span>
                </span>
                <button type="button" onClick={onClearFocus} className="shrink-0 font-black px-2" style={{ color: VI.red }}>
                  清除
                </button>
              </div>
            )}

            <div className="flex border-2 overflow-hidden font-black" style={{ borderColor: VI.line }}>
              <button
                type="button"
                onClick={() => setUiMode('plan')}
                className="flex-1 py-5 transition-colors text-lg"
                style={{
                  backgroundColor: uiMode === 'plan' ? VI.red : VI.bg,
                  color: VI.white,
                }}
              >
                {t.plan}
              </button>
              <button
                type="button"
                onClick={() => setUiMode('parts')}
                className="flex-1 py-5 transition-colors text-lg border-l-2"
                style={{
                  borderColor: VI.line,
                  backgroundColor: uiMode === 'parts' ? VI.red : VI.bg,
                  color: uiMode === 'parts' ? VI.white : VI.gray,
                }}
              >
                {t.parts}
              </button>
            </div>

            {uiMode === 'plan' ? (
              <div className="space-y-8">
                <h3 className="text-2xl md:text-3xl font-black text-white border-b-2 pb-4" style={{ borderColor: VI.line }}>
                  场景选择
                </h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    type="button"
                    onClick={() => setScenarioCode('eaves_standard')}
                    className="flex-1 py-5 px-4 border-2 text-lg font-bold transition-colors"
                    style={{
                      borderColor: scenarioCode === 'eaves_standard' ? VI.red : VI.line,
                      backgroundColor: VI.black,
                      color: scenarioCode === 'eaves_standard' ? VI.white : VI.gray,
                    }}
                  >
                    {t.eaves}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScenarioCode('wall_hybrid')}
                    className="flex-1 py-5 px-4 border-2 text-lg font-bold transition-colors"
                    style={{
                      borderColor: scenarioCode === 'wall_hybrid' ? VI.red : VI.line,
                      backgroundColor: VI.black,
                      color: scenarioCode === 'wall_hybrid' ? VI.white : VI.gray,
                    }}
                  >
                    {t.wall}
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-4">
                    <label className="text-xl font-bold text-white">{scenarioCode === 'wall_hybrid' ? t.area : t.length}</label>
                    <span className="text-3xl md:text-4xl font-black tabular-nums" style={{ color: VI.red }}>
                      {inputValue}
                    </span>
                  </div>
                  <p className="text-base md:text-lg mb-5 leading-relaxed" style={{ color: VI.gray }}>
                    {t.presetHint}
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={scenarioCode === 'wall_hybrid' ? 200 : 40}
                    step={scenarioCode === 'wall_hybrid' ? 1 : 0.5}
                    value={inputValue}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (scenarioCode === 'wall_hybrid') setValueArea(v);
                      else setValueLinear(v);
                    }}
                    className="w-full h-4 cursor-pointer"
                    style={{ accentColor: VI.red }}
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex items-start gap-4 p-8 border-2 text-lg md:text-xl leading-relaxed"
                style={{ borderColor: VI.line, backgroundColor: VI.black, color: VI.gray }}
              >
                <Package className="shrink-0 mt-1" size={32} style={{ color: VI.red }} />
                <p>{t.partsHint}</p>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-10 min-w-0">
            <div className="flex items-center gap-4">
              <Shield className="shrink-0" size={32} style={{ color: VI.red }} />
              <h3 className="text-2xl md:text-3xl font-black text-white">{t.bom}</h3>
            </div>

            {scenarioCode === 'wall_hybrid' && uiMode === 'plan' && (
              <div className="border-2 p-8 md:p-10" style={{ borderColor: VI.line, backgroundColor: VI.black }}>
                <h4 className="text-xl md:text-2xl font-black text-white mb-8">{t.compare}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="border-2 p-6" style={{ borderColor: VI.line }}>
                    <p className="text-lg md:text-xl font-black mb-5 uppercase tracking-wide" style={{ color: VI.red }}>
                      {t.brickCol}
                    </p>
                    <ul className="space-y-4 text-base md:text-lg leading-relaxed" style={{ color: VI.gray }}>
                      <li>• 损耗通常 35%–40%，补货与破碎风险高</li>
                      <li>• 人工铺贴工时长，海外工地语言/工艺差异放大成本</li>
                      <li>• 适合小面积收口、异形节点</li>
                    </ul>
                    <p className="mt-6 text-base" style={{ color: VI.gray }}>
                      收口 SKU（与库内一致）：<span className="font-mono font-bold text-white">ABMRR-001 / CE01-GYHG-ABMRR-001</span>
                    </p>
                  </div>
                  <div className="border-2 p-6" style={{ borderColor: VI.line }}>
                    <p className="text-lg md:text-xl font-black text-white mb-5 uppercase tracking-wide border-b-2 pb-2 inline-block" style={{ borderColor: VI.red }}>
                      {t.panelCol}
                    </p>
                    <ul className="space-y-4 text-base md:text-lg leading-relaxed" style={{ color: VI.gray }}>
                      <li>• 损耗约 3%，尺寸标准化利于装箱与报关</li>
                      <li>• 「乐高式」安装路径，降低现场人工依赖</li>
                      <li>• 主材为预制板：95% 面积 + 5% 青砖收口折合</li>
                    </ul>
                    <p className="mt-6 text-base" style={{ color: VI.gray }}>
                      主材 SKU：<span className="font-mono font-bold text-white">ABCEC-002 / CE01-GYHG-ABCEC-002</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {uiMode === 'plan' && payload && (
              <>
                {anyBrick && (
                  <div
                    className="border-2 px-6 py-5 text-lg leading-relaxed border-l-8"
                    style={{ borderColor: VI.line, borderLeftColor: VI.red, backgroundColor: VI.black, color: VI.gray }}
                  >
                    <strong style={{ color: VI.red }}>损耗预警：</strong>
                    青砖片在混合墙面中仅约 5% 收口面积；全墙散砖将显著抬高损耗与人工。主材应保持预制板方案。
                  </div>
                )}

                <div className="border-2 overflow-hidden" style={{ borderColor: VI.line, backgroundColor: VI.black }}>
                  <div
                    className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.75fr_0.75fr] gap-2 px-5 py-5 font-black uppercase tracking-wide border-b-2 text-base md:text-lg"
                    style={{ borderColor: VI.line, color: VI.gray, backgroundColor: VI.bg }}
                  >
                    <span>物料 / SKU</span>
                    <span className="text-right">{t.standard}</span>
                    <span className="text-right" style={{ color: VI.red }}>
                      {t.waste}
                    </span>
                    <span className="text-right text-white">{t.final}</span>
                  </div>
                  <div>
                    {payload.lines.map((line) => {
                      const wasteDelta = Math.max(0, line.finalOrderQty - line.standardQty);
                      return (
                        <div
                          key={line.code}
                          className="grid grid-cols-[minmax(0,1.2fr)_0.9fr_0.75fr_0.75fr] gap-2 px-5 py-6 items-center border-b"
                          style={{ borderColor: VI.line }}
                        >
                          <div className="flex items-center gap-5 min-w-0">
                            <BomRowImage code={line.code} />
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate text-lg md:text-xl">{line.name}</p>
                              <p className="text-base font-mono truncate mt-1" style={{ color: VI.gray }}>
                                {line.code}
                              </p>
                              {line.ruleItemLabel && (
                                <p className="text-base mt-2 line-clamp-2" style={{ color: VI.gray }}>
                                  {line.ruleItemLabel}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-right tabular-nums font-semibold text-lg text-white">{line.standardQty.toFixed(2)}</span>
                          <span className="text-right tabular-nums font-black text-xl" style={{ color: VI.red }}>
                            +{wasteDelta.toFixed(1)}
                          </span>
                          <span className="text-right tabular-nums font-black text-2xl text-white">{line.finalOrderQty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {[
                    { k: t.weight, v: `${payload.totals.totalWeight.toFixed(1)}`, u: 'kg', accent: false },
                    { k: t.vol, v: `${payload.totals.totalVolume.toFixed(4)}`, u: 'm³', accent: false },
                    {
                      k: t.price,
                      v: `¥${payload.totals.totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                      u: '',
                      accent: true,
                    },
                  ].map((row) => (
                    <div key={row.k} className="border-2 p-8 text-center" style={{ borderColor: VI.line, backgroundColor: VI.black }}>
                      <p className="text-base font-bold uppercase tracking-wider mb-3" style={{ color: VI.gray }}>
                        {row.k}
                      </p>
                      <p
                        className="text-3xl md:text-4xl font-black tabular-nums"
                        style={{ color: row.accent ? VI.red : VI.white }}
                      >
                        {row.v}
                        {row.u ? <span className="text-xl ml-1" style={{ color: VI.gray }}>{row.u}</span> : null}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-3 py-6 border-2 font-black uppercase tracking-wide transition-opacity hover:opacity-95"
                  style={{
                    backgroundColor: VI.red,
                    color: VI.white,
                    borderColor: VI.red,
                    fontSize: '1.25rem',
                  }}
                >
                  <HardHat size={28} />
                  {t.gen}
                </button>
              </>
            )}

            {uiMode === 'parts' && (
              <p className="text-lg md:text-xl text-center py-20" style={{ color: VI.gray }}>
                {t.partsHint}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default EngineeringAssistantModal;
