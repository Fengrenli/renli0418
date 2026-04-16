// 安全的JSON解析函数
const safeJSONParse = (str: string | null, defaultValue: any = null) => {
  try {
    if (!str || str === "undefined") return defaultValue;
    return JSON.parse(str);
  } catch (e) {
    console.error("JSON 解析失败:", e);
    return defaultValue;
  }
};

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Trash2, Plus, Download, Package, 
  Search, QrCode as QrCodeIcon, X, 
  ChevronRight, Globe, Calculator, FileText,
  ArrowRight, Save, Layout, Filter, Settings,
  Sparkles, Loader2, Upload, Image as ImageIcon,
  RefreshCw, HardHat
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { Material, CartItem } from '../types';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import EngineeringAssistantModal from './EngineeringAssistantModal';
const EngineeringDecisionCenter = React.lazy(() => import('./EngineeringDecisionCenter'));

const MATERIALS_OSS_BASE = 'https://renli2026.oss-cn-chengdu.aliyuncs.com/materials';
/** 品牌名（数据库） -> OSS 品牌目录 */
const BRAND_TO_OSS_FOLDER: Record<string, string> = {
  '小龙坎': 'xiaolongkan',
  '吼堂': 'houtang',
  '杨国福': 'yangguofu',
};

/** 规范分类 → OSS 短目录（与 materials_cleaned.pic_folder 一致；无 pic_folder 时兜底，多目录类取 CSV 中占比最高的目录） */
const CATEGORY_TO_OSS_FOLDER: Record<string, string> = {
  '五金杂件及工程灯具': '工程灯具',
  '厨房电器及设备': '厨房设备',
  '灯笼': '灯笼',
  '定制玻璃钢雕塑': '玻璃钢',
  '定制活动家具及软装物料': '桌椅',
  '定制活动家具及软装材料': '桌椅',
  '定制金属制品': '不锈钢',
  '定制石材制品': '石材',
  '定制中式建筑结构': '古建木结构',
  '墙地瓷砖制品': '瓷砖',
  '陶瓷烧制制品': '瓷砖',
  '陶制烧制制品': '瓷砖',
  '砖瓦': '砖瓦',
  '小型电器及设备': '厨房设备',
  '植物盆栽': '软装',
  // 14 类新口径（category 与 OSS 子目录同名）
  '玻璃钢': '玻璃钢',
  '不锈钢': '不锈钢',
  '厨房设备': '厨房设备',
  '瓷砖': '瓷砖',
  '定制柜体': '定制柜体',
  '工程灯具': '工程灯具',
  '古建木结构': '古建木结构',
  '锅具': '锅具',
  '软装': '软装',
  '石材': '石材',
  '五金杂件': '五金杂件',
  '桌椅': '桌椅',
};

function ossFolderForRow(row: { pic_folder?: string; picFolder?: string }, category: string): string {
  const pf = String(row.pic_folder ?? row.picFolder ?? '').trim();
  if (pf) return pf;
  return CATEGORY_TO_OSS_FOLDER[category] || '工程灯具';
}

function ossBrandFolderForRow(row: {
  restaurant_brand_name?: string;
  restaurant_brand?: string;
  restaurantBrand?: string;
}): string {
  const brandName = String(
    row.restaurant_brand_name ?? row.restaurant_brand ?? row.restaurantBrand ?? '',
  ).trim();
  return BRAND_TO_OSS_FOLDER[brandName] || '';
}

function materialOssImageUrl(folderName: string, fileName: string, brandFolder = ''): string {
  const brandPart = brandFolder ? `${encodeURIComponent(brandFolder)}/` : '';
  return `${MATERIALS_OSS_BASE}/${brandPart}${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;
}

function isDispimgGarbage(s: string): boolean {
  return /^=?\s*DISPIMG/i.test(String(s).trim());
}

function isDataImageUrl(s: string): boolean {
  return /^data:image\//i.test(String(s).trim());
}

/**
 * 线上 OSS 约定：对象键在 materials/{品牌英文目录}/ 下（如 houtang、xiaolongkan）。
 * 旧数据若写成 .../materials/桌椅/xxx.png（缺品牌段）会 404，此处丢弃以便走 pic_folder 重拼。
 */
function ossStoredImageAcceptable(url: string, brandFolder: string): boolean {
  const u = String(url).trim();
  if (!u.startsWith('http')) return false;
  const idx = u.indexOf('/materials/');
  if (idx === -1) return false;
  let tail = u.slice(idx + '/materials/'.length).split('?')[0];
  try {
    tail = decodeURIComponent(tail);
  } catch {
    /* 保持原样 */
  }
  if (!brandFolder) {
    return tail.includes('/');
  }
  return tail.startsWith(`${brandFolder}/`);
}

/** 非 data: 的 http(s) 需满足 OSS 路径约定；其余原样返回（含裸 base64 等历史数据） */
function coerceMaterialImageField(
  raw: unknown,
  brandFolder: string,
): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw).trim();
  if (!s || isDispimgGarbage(s)) return undefined;
  if (isDataImageUrl(s)) return s;
  if (s.startsWith('http')) {
    return ossStoredImageAcceptable(s, brandFolder) ? s : undefined;
  }
  return s;
}

/** BOM 行加载：合并快照 image 与 materials 表当前图，缺品牌段的旧 URL 会按 pic_folder 重拼 */
function resolveLineItemImageUrl(
  item: {
    image?: string;
    material_image?: string;
    pic_folder?: string;
    image_filename?: string;
    area?: string;
    category?: string;
    restaurant_brand_name?: string;
  },
  materialCode: string,
): string {
  const cat = item.category || item.area || '未分类';
  const row = {
    pic_folder: item.pic_folder,
    restaurant_brand_name: item.restaurant_brand_name,
  };
  const folderName = ossFolderForRow(row, cat);
  const brandFolder = ossBrandFolderForRow(row);
  let imageUrl =
    coerceMaterialImageField(item.image, brandFolder) ??
    coerceMaterialImageField(item.material_image, brandFolder);
  if (!imageUrl && item.image_filename) {
    imageUrl = materialOssImageUrl(
      folderName,
      String(item.image_filename).trim(),
      brandFolder,
    );
  }
  if (!imageUrl) {
    imageUrl = materialOssImageUrl(folderName, `${materialCode}.png`, brandFolder);
  }
  return imageUrl;
}

// Memoized Material Card for performance
const MaterialCard = React.memo(({ 
  material, 
  onAdd,
  onOpenEngineering,
}: { 
  material: Material, 
  onAdd: (m: Material) => void;
  onOpenEngineering?: (m: Material) => void;
}) => (
  <motion.div 
    layout
    onClick={() => onAdd(material)}
    className="bg-white border border-slate-200 rounded-xl p-2 cursor-pointer transition-all duration-200 hover:shadow-xl hover:border-red-500 group flex flex-col relative overflow-hidden"
  >
    {onOpenEngineering && (
      <button
        type="button"
        title="工程决策中心 / Decision Center"
        onClick={(e) => {
          e.stopPropagation();
          onOpenEngineering(material);
        }}
        className="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-lg bg-black/90 text-white flex items-center justify-center border border-white/20 hover:bg-[#E1251B] shadow-md opacity-95"
      >
        <HardHat size={14} />
      </button>
    )}
    <div className="aspect-square rounded-lg bg-slate-100 overflow-hidden mb-2 relative">
      <img 
        src={material.imageUrl} 
        loading="lazy"
        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
        referrerPolicy="no-referrer"
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
    </div>
    <div className="min-w-0">
      <h4 className="text-[10px] font-black text-slate-900 truncate leading-tight mb-0.5 uppercase tracking-tight">{material.name}</h4>
      <p className="text-[8px] font-bold text-slate-400 truncate mb-2">{material.id}</p>
      <div className="flex items-center justify-between mt-auto">
        <span className="text-[11px] font-black text-red-600">¥{material.basePrice.toLocaleString()}</span>
        <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
          <Plus size={14} />
        </div>
      </div>
    </div>
  </motion.div>
));

// Swiss Design Palette
const SWISS_COLORS = {
  white: '#FFFFFF',
  black: '#000000',
  red: '#E1251B', // Renli Red
  gray: '#F5F5F5',
  darkGray: '#1A1A1A',
  border: '#E5E5E5'
};



const CATEGORIES = [
  "全部", 
  "厨房电器及设备", 
  "灯笼灯具及五金", 
  "五金杂件及工程灯具",
  "玻璃钢雕塑制品", 
  "活动家具及软装", 
  "金属制品及不锈钢", 
  "石材制品及雕刻", 
  "定制中式建筑结构", 
  "墙地瓷砖及陶艺", 
  "景观植物及盆栽",
  "未分类"
];

const QRCodeDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 100 }) => {
  const [qrData, setQrData] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size })
      .then(url => setQrData(url))
      .catch(err => console.error(err));
  }, [value, size]);

  if (!qrData) return <div style={{ width: size, height: size }} className="bg-gray-100 animate-pulse" />;
  return <img src={qrData} alt="QR Code" loading="lazy" width={size} height={size} />;
};

const BOMGenerator: React.FC<{
  lang: 'cn' | 'en' | 'de';
  isAdmin?: boolean;
  /** 返回应用内「仪表盘 / 材料中心」主界面，勿用 history.back（直开 BOM 会跳到浏览器首页） */
  onBackToHub?: () => void;
  projects?: any[];
  setProjects?: React.Dispatch<React.SetStateAction<any[]>>;
}> = ({ lang, isAdmin, onBackToHub, projects = [], setProjects }) => {
  // --- State ---
  const [materials, setMaterials] = useState<Material[]>([]);
  /** 工程决策中心：从分类/物料卡带入上下文 */
  const [assistantFocusMaterial, setAssistantFocusMaterial] = useState<Material | null>(null);
  const [engineeringModalOpen, setEngineeringModalOpen] = useState(false);
  const [showDecisionCenter, setShowDecisionCenter] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bom_cart');
      return safeJSONParse(saved, []);
    }
    return [];
  });
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ message: string, onConfirm: () => void } | null>(null);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('bom_cart', JSON.stringify(cart));
  }, [cart]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  const [activeCategory, setActiveCategory] = useState("全部");
  const [activeBrand, setActiveBrand] = useState("全部");
  const [activeRestaurantBrand, setActiveRestaurantBrand] = useState("全部");
  
  // Exchange Rates
  const [rates, setRates] = useState({ EUR: 0.13, USD: 0.14 }); // Default mock rates
  
  // Project Header
  const [projectHeader, setProjectHeader] = useState({
    id: null as string | null,
    projectName: "小龙坎比利时安特卫普店",
    orderUnit: "张三 / 某某餐饮管理公司",
    orderDate: new Date().toISOString().split('T')[0],
    contact: "+86 138 0013 8000",
    supplier: "四川盛世建材有限公司",
    notes: "1. 报价不含国际运费及目的地进口税费，仅包含至成都货代仓库费用。\n2. 报价有效期为60天，逾期请重新询价。\n3. 生产周期预计20个工作日，请提前安排订购计划。\n4. 货物签收时请务必核对装箱单，如有破损请在24小时内反馈。"
  });

  const clearProject = () => {
    setProjectHeader({
      id: null,
      projectName: "",
      orderUnit: "",
      orderDate: new Date().toISOString().split('T')[0],
      contact: "",
      supplier: "成都仁力烨升国际贸易有限公司",
      notes: "1. 报价不含国际运费及目的地进口税费，仅包含至成都货代仓库费用。\n2. 报价有效期为60天，逾期请重新询价。\n3. 生产周期预计20个工作日，请提前安排订购计划。\n4. 货物签收时请务必核对装箱单，如有破损请在24小时内反馈。"
    });
    setCart([]);
    showToast('已开启新项目', 'success');
  };

  const [showPreview, setShowPreview] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      let newWidth = e.clientX;
      if (newWidth < 280) newWidth = 280;
      if (newWidth > 600) newWidth = 600;
      setLeftPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    category: '厨房电器及设备',
    unit: '台',
    basePrice: 0,
    hsCode: '',
    weight: 0,
    volume: 0,
    brandId: '全部',
    restaurantBrand: '全部'
  });

  // --- Persistence & Fetching ---
  const fetchProjects = async () => {
    try {
      console.log('Fetching projects from /api/list-projects...');
      const response = await fetchWithTimeout('/api/list-projects', { timeoutMs: 45000 });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log('Projects fetch result:', result);
      if (result && (result.code === 200 || result.success === true || result.code === 0)) {
        // 确保data是数组
        const data = Array.isArray(result.data) ? result.data : [];
        
        // Extract brands from project names
        const brands = new Set<string>();
        const projectsWithBrand = data.map((project: any) => {
          // Extract brand from project name (e.g., 小龙坎杜塞店 -> 小龙坎)
          let brand = '未知品牌';
          if (project.name) {
            if (project.name.includes('小龙坎')) {
              brand = '小龙坎';
            } else if (project.name.includes('吼堂')) {
              brand = '吼堂';
            } else {
              // Extract first part before location
              const parts = project.name.split(/[\u4e00-\u9fa5]/).filter(Boolean);
              if (parts.length > 0) {
                brand = parts[0];
              }
            }
          }
          brands.add(brand);
          return { ...project, brand };
        });
        
        // Sort projects: in progress projects first
        const sortedProjects = [...projectsWithBrand].sort((a, b) => {
          const statusA = a.status || '';
          const statusB = b.status || '';
          const isAInProgress = statusA.includes('进行中') || statusA.includes('in progress');
          const isBInProgress = statusB.includes('进行中') || statusB.includes('in progress');
          if (isAInProgress && !isBInProgress) return -1;
          if (!isAInProgress && isBInProgress) return 1;
          return 0;
        });
        
        setAllProjects(sortedProjects);
        
        // Update materials with brand information
        if (materials.length > 0) {
          const updatedMaterials = materials.map(material => {
            // Find project associated with this material
            const associatedProject = sortedProjects.find(p => 
              material.id.includes(p.id) || 
              material.name.includes(p.name)
            );
            return {
              ...material,
              brandId: associatedProject?.brand || material.brandId || '未知品牌'
            };
          });
          setMaterials(updatedMaterials);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch projects:', error.message || error);
    }
  };

  const loadProject = async (projectId: string) => {
    try {
      // First, try to load from main project table
      const mainProjectResponse = await fetchWithTimeout('/api/projects', { timeoutMs: 45000 });
      const mainProjectResult = await mainProjectResponse.json();
      // 确保mainProjectResult.data是数组
      const mainProjects = Array.isArray(mainProjectResult.data) ? mainProjectResult.data : [];
      const mainProject = mainProjects.find((p: any) => p.id === projectId);
      
      if (mainProject) {
        // Update header with main project info
        setProjectHeader({
          id: mainProject.id,
          projectName: mainProject.name || '',
          orderUnit: mainProject.clientName || '',
          orderDate: new Date().toISOString().split('T')[0],
          contact: '',
          supplier: '成都仁力烨升国际贸易有限公司',
          notes: ''
        });
        showToast('项目信息加载成功', 'success');
      } else {
        // Fallback to BOM project
        const response = await fetch('/api/get-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId })
        });
        const result = await response.json();
        if ((result.code === 0 || result.code === 200) && result.data) {
          const { project, items } = result.data;
          
          // Update header
          setProjectHeader({
            id: project.id,
            projectName: project.project_name || '',
            orderUnit: project.order_unit || '',
            orderDate: project.order_date || new Date().toISOString().split('T')[0],
            contact: project.contact || '',
            supplier: project.supplier || '成都仁力烨升国际贸易有限公司',
            notes: project.notes || ''
          });

          // Update cart
          const loadedCart = items.map((item: any, index: number) => ({
            id: item.material_id,
            cartId: `${item.material_id}-${Date.now()}-${index}`,
            brandId: item.brand_id || 'xlk',
            category: item.category || item.area || '未分类',
            name: item.material_name || item.name || item.material_id,
            imageUrl: resolveLineItemImageUrl(item, item.material_id),
            unit: item.unit || '个',
            basePrice: Number(item.price_cny),
            hsCode: item.hs_code || '',
            weight: Number(item.weight || 0),
            volume: Number(item.volume || 0),
            specs: item.spec || '',
            materialArea: item.material_area || '',
            detailLink: item.detail_link || '',
            quantity: Number(item.quantity),
            packingNo: item.box_no || '',
            selectedArea: item.remark || '',
            selectedSpec: item.spec || ''
          }));
          setCart(loadedCart);
          showToast('BOM项目加载成功', 'success');
        }
      }
    } catch (error) {
      console.error('Load project failed', error);
      showToast('加载失败', 'error');
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!window.confirm('确定要删除此项目吗？')) return;
    try {
      // Try to delete from main project table first
      const mainDeleteResponse = await fetch('/api/delete-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId })
      });
      const mainDeleteResult = await mainDeleteResponse.json();
      
      if (mainDeleteResult.code === 0) {
        showToast('项目删除成功', 'success');
        fetchProjects(); // Refresh list
        clearProject(); // Clear current project
        return;
      }
      
      // Fallback to BOM project delete
      const response = await fetch('/api/delete-bom-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      const result = await response.json();
      if (result.code === 0 || result.code === 200) {
        showToast('BOM项目删除成功', 'success');
        fetchProjects(); // Refresh list
        clearProject(); // Clear current project
      } else {
        showToast(result.msg || '删除失败', 'error');
      }
    } catch (error) {
      console.error('Delete project failed', error);
      showToast('网络错误，请稍后重试', 'error');
    }
  };

  const fetchMaterials = async (restaurantBrandId?: string) => {
    setIsLoadingMaterials(true);
    setFetchError(null);
    try {
      console.log('Fetching materials from /api/list-materials...');
      let url = '/api/list-materials';
      if (restaurantBrandId && restaurantBrandId !== '全部') {
        url += `?restaurant_brand_id=${restaurantBrandId}`;
      }
      const response = await fetchWithTimeout(url, { timeoutMs: 60000 });
      
      if (!response.ok) {
        const text = await response.text();
        console.error('API response not OK:', response.status, text);
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Materials fetch result:', result);

      if (result && (result.code === 200 || result.success === true)) {
        // 确保data是数组
        const data = Array.isArray(result.data) ? result.data : [];
        
        if (data.length === 0) {
          console.warn('API returned 0 materials, keeping current state');
          return;
        }

        // Log first few materials to understand structure
        if (data.length > 0) {
          console.log('First material structure:', data[0]);
        }
        
        const mapped = data.map((m: any) => {
          // Robust category mapping - try multiple possible fields
          const cat = m.category || m.area || m.type || m.material_type || m.category_name || 
                     m.cat || m.classification || m.group || m.section || '未分类';
          
          // Get brand from material data
          const brand = m.brand || m.brandId || m.brand_id || '';
          
          // Get material code
          const code = m.code || `DB-${m.id || Math.random().toString(36).substr(2, 9)}`;

          const folderName = ossFolderForRow(m, cat);
          const brandFolder = ossBrandFolderForRow(m);

          // 优先 DB 字段，但须满足 OSS 路径（含品牌段）；否则用 pic_folder + 文件名/编码 重拼
          let imageUrl =
            coerceMaterialImageField(m.image_data, brandFolder) ??
            coerceMaterialImageField(m.image, brandFolder) ??
            coerceMaterialImageField(m.image_url, brandFolder) ??
            coerceMaterialImageField(m.imageUrl, brandFolder);

          console.log(`Material ${code}:`, {
            image_data: m.image_data,
            image: m.image,
            image_url: m.image_url,
            imageUrl: m.imageUrl,
            image_filename: m.image_filename,
            pic_folder: m.pic_folder,
            brandFolder,
            final_imageUrl: imageUrl,
          });

          if (!imageUrl && m.image_filename) {
            imageUrl = materialOssImageUrl(folderName, String(m.image_filename).trim(), brandFolder);
          }

          if (!imageUrl) {
            imageUrl = materialOssImageUrl(folderName, `${code}.png`, brandFolder);
          }
          
          // Get restaurant brand from material data
          let restaurantBrand = '';
          if (m.restaurant_brand_id) {
            // 优先用后端联表返回的品牌名，兜底再从品牌列表映射
            if (m.restaurant_brand_name) {
              restaurantBrand = m.restaurant_brand_name;
            } else {
              const brand = brands.find(b => String(b.id) === String(m.restaurant_brand_id));
              restaurantBrand = brand ? brand.name : '';
            }
          } else {
            restaurantBrand = m.restaurant_brand || m.restaurantBrand || '';
          }
          
          // Get material brand
          const materialBrand = m.material_brand || m.materialBrand || '';
          
          return {
            id: code,
            brandId: brand,
            materialBrand: materialBrand,
            restaurantBrand: restaurantBrand,
            restaurantBrandId: m.restaurant_brand_id,
            category: cat, 
            name: m.name || m.code || '未命名材料',                     
            imageUrl: imageUrl,
            unit: m.unit || '个',
            basePrice: Number(m.price || m.base_price || m.basePrice || 0),
            hsCode: m.hs_code || m.hsCode || '',
            weight: Number(m.weight || 0),
            volume: Number(m.volume || 0),
            specs: m.specs || m.spec || '',
            materialArea: m.material_area || m.material_location || m.material_color || m.location || m.color || '',
            detailLink: m.detail_link || m.detailLink || ''
          };
        });

        // Ensure unique IDs - use code as primary identifier
        const uniqueMapped: Material[] = [];
        const seenIds = new Set<string>();
        mapped.forEach((m: Material) => {
          // Use code as primary identifier, fall back to id
          const idToCheck = m.id || m.code;
          if (idToCheck && !seenIds.has(idToCheck)) {
            uniqueMapped.push(m);
            seenIds.add(idToCheck);
          }
        });
        setMaterials(uniqueMapped);
      } else {
        console.error('Invalid API response format:', result);
        setFetchError('API 返回格式错误');
      }
    } catch (error: any) {
      console.error('Failed to fetch materials:', error);
      setFetchError(error.message || '获取材料失败');
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetchWithTimeout('/api/health', { timeoutMs: 15000 });
        const result = await response.json();
        console.log('Server health check:', result);
      } catch (error) {
        console.error('Server health check failed:', error);
      }
    };
    checkHealth();
    fetchProjects();
    fetchMaterials();
    fetchBrands();
  }, []);

  useEffect(() => {
    if (materials.length > 0) {
      localStorage.setItem('rl_bom_materials_v2', JSON.stringify(materials));
    }
  }, [materials]);

  // --- Logic ---
  // 动态生成分类列表
  const dynamicCategories = useMemo(() => {
    const cats = new Set(["全部"]);
    // 只添加数据中的分类
    materials.forEach(m => {
      if (m.category) cats.add(m.category);
    });
    cats.add("未分类");
    return Array.from(cats);
  }, [materials]);

  // 动态生成物料品牌列表
  const materialBrands = useMemo(() => {
    const brands = new Set(["全部"]);
    // 从材料中提取物料品牌
    materials.forEach(m => {
      if (m.brandId) {
        brands.add(m.brandId);
      }
    });
    return Array.from(brands);
  }, [materials]);

  // 动态生成餐饮品牌列表
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);

  const fetchBrands = async () => {
    setIsLoadingBrands(true);
    try {
      const response = await fetchWithTimeout('/api/list-brands', { timeoutMs: 45000 });
      if (response.ok) {
        const result = await response.json();
        if (result && (result.code === 200 || result.success === true)) {
          setBrands(result.data || []);
        }
      } else {
        console.error('Failed to fetch brands: HTTP', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  // 动态生成餐饮品牌列表
  const restaurantBrands = useMemo(() => {
    const brandSet = new Set(["全部"]);
    // 从品牌列表中提取餐饮品牌
    brands.forEach(brand => {
      if (brand.name) {
        brandSet.add(brand.name);
      }
    });
    return Array.from(brandSet);
  }, [brands]);

  // 处理餐饮品牌选择变化
  const handleRestaurantBrandChange = (brandName: string) => {
    setActiveRestaurantBrand(brandName);
    setActiveCategory('全部');
    // 根据品牌名称获取品牌ID
    const brand = brands.find(b => b.name === brandName);
    const brandId = brand ? brand.id : '';
    // 重新获取物料列表
    fetchMaterials(brandId);
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => 
      (activeCategory === "全部" || m.category === activeCategory) &&
      (activeRestaurantBrand === "全部" || m.restaurantBrand === activeRestaurantBrand)
    );
  }, [materials, activeCategory, activeRestaurantBrand]);

  const addToCart = (material: Material) => {
    const newItem: CartItem = {
      ...material,
      cartId: `${material.id}-${Date.now()}`,
      quantity: 1,
      packingNo: '',
      selectedSpec: material.spec || material.specs,
      selectedArea: material.area || material.materialArea || ''
    };
    setCart(prev => [...prev, newItem]);
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId));
  };

  const updateCartItem = (cartId: string, updates: Partial<CartItem>) => {
    setCart(prev => prev.map(item => item.cartId === cartId ? { ...item, ...updates } : item));
  };

  const totalCNY = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.basePrice * item.quantity), 0);
  }, [cart]);

  const suggestHSCode = async (cartId: string, productName: string) => {
    setAiLoadingId(cartId);
    try {
      const res = await fetch('/api/ai/suggest-hscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ productName }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { hsCode?: string | null };
        msg?: string;
      };
      const cleanedCode = json.data?.hsCode?.trim() || '';
      if (json.success && cleanedCode.length >= 6) {
        updateCartItem(cartId, { hsCode: cleanedCode });
        showToast('AI 建议 HS 编码成功', 'success');
      } else {
        showToast(json.msg || 'AI 未能生成有效 HS 编码，请手动输入', 'info');
      }
    } catch (error) {
      console.error('AI HS Code suggestion failed', error);
      showToast('AI 服务暂时不可用，请手动输入 HS 编码', 'info');
    } finally {
      setAiLoadingId(null);
    }
  };

  const suggestAllHSCodes = async () => {
    const itemsToSuggest = cart.filter(item => !item.hsCode);
    if (itemsToSuggest.length === 0) {
      showToast('所有项目已有HS编码或购物车为空。', 'info');
      return;
    }
    
    setShowConfirmModal({
      message: `确定要为 ${itemsToSuggest.length} 个项目使用AI建议HS编码吗？`,
      onConfirm: async () => {
        setShowConfirmModal(null);
        let successCount = 0;
        for (const item of itemsToSuggest) {
          try {
            await suggestHSCode(item.cartId, item.name);
            successCount++;
          } catch (error) {
            console.error('Error suggesting HS code for item:', error);
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        showToast(`AI HS 编码建议完成，成功 ${successCount} 个，失败 ${itemsToSuggest.length - successCount} 个`, successCount > 0 ? 'success' : 'info');
      }
    });
  };

  const analyzeForHSCode = async (name: string, imageBase64?: string) => {
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/ai/suggest-hscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ productName: name, imageBase64 }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { hsCode?: string | null };
        msg?: string;
      };
      const cleanedCode = json.data?.hsCode?.trim() || '';
      if (json.success && cleanedCode.length >= 6) {
        setNewMaterial(prev => ({ ...prev, hsCode: cleanedCode }));
        showToast('AI 识别成功，已自动填充 HS 编码', 'success');
      } else {
        showToast(json.msg || 'AI 未能识别，请手动输入 HS 编码', 'info');
      }
    } catch (error) {
      console.error('AI Analysis failed', error);
      showToast('AI 服务暂时不可用，请手动输入 HS 编码', 'info');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleImageUploadForAI = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsAiAnalyzing(true);
    try {
      // 1. Upload file to server
      const formData = new FormData();
      formData.append('projectId', 'default'); // or any context ID
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const uploadData = await uploadRes.json();
      
      if (uploadData.code === 0 && uploadData.url) {
        setNewMaterial(prev => ({ ...prev, imageUrl: uploadData.url }));
        
        // 2. Perform AI Analysis (using base64 for the API call as it's already in memory)
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          analyzeForHSCode(newMaterial.name || 'Unknown Product', base64);
        };
        reader.readAsDataURL(file);
      } else {
        showToast('图片上传失败', 'error');
      }
    } catch (error) {
      console.error('Upload failed', error);
      showToast('上传出错', 'error');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const handleManualAdd = async () => {
    if (!newMaterial.name || !newMaterial.id || !newMaterial.hsCode) {
      showToast('请填写必要信息（名称、编码、HS编码）', 'error');
      return;
    }

    // Check for duplicate ID in local state
    if (materials.some(m => m.id === newMaterial.id)) {
      showToast('物料编码已存在，请使用唯一的编码', 'error');
      return;
    }

    // Build OSS image URL based on code and category if no image URL provided
    let imageUrl = newMaterial.imageUrl;
    if (!imageUrl) {
      const category = newMaterial.category || '未分类';
      const code = newMaterial.id as string;
      const folderName = ossFolderForRow({ pic_folder: newMaterial.pic_folder }, category);
      const brandFolder = BRAND_TO_OSS_FOLDER[newMaterial.restaurantBrand || ''] || '';
      imageUrl = materialOssImageUrl(folderName, `${code}.png`, brandFolder);
    }
    
    const materialToAdd: Material = {
      id: newMaterial.id as string,
      brandId: newMaterial.brandId || '',
      restaurantBrand: newMaterial.restaurantBrand || '',
      category: newMaterial.category || '未分类',
      name: newMaterial.name,
      imageUrl: imageUrl,
      unit: newMaterial.unit || '个',
      basePrice: newMaterial.basePrice || 0,
      hsCode: newMaterial.hsCode,
      weight: newMaterial.weight || 0,
      volume: newMaterial.volume || 0,
      specs: newMaterial.specs,
      materialArea: newMaterial.materialArea,
      detailLink: newMaterial.detailLink
    };

    try {
      // Save to backend
        const response = await fetch('/api/save-material', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: materialToAdd.id,
            name: materialToAdd.name,
            image: materialToAdd.imageUrl,
            price: materialToAdd.basePrice,
            unit: materialToAdd.unit,
            spec: materialToAdd.specs,
            area: materialToAdd.category,
            hs_code: materialToAdd.hsCode,
            weight: materialToAdd.weight,
            volume: materialToAdd.volume,
            color: materialToAdd.materialArea,
            brand: materialToAdd.brandId === '全部' ? '' : materialToAdd.brandId,
            material_brand: materialToAdd.materialBrand || '',
            restaurant_brand_id: materialToAdd.restaurantBrandId || '',
            material: materialToAdd.material,
            specs_l: materialToAdd.specsL,
            location: materialToAdd.location,
            box_no: materialToAdd.boxNo
          })
        });
      const result = await response.json();
      
      if (result.code === 0 || result.code === 200) {
        setMaterials(prev => [...prev, materialToAdd]);
        showToast('材料添加成功并已同步至数据库', 'success');
        setShowAddModal(false);
        setNewMaterial({
          category: '砖瓦',
          unit: '匹',
          basePrice: 0,
          hsCode: '',
          weight: 0,
          volume: 0,
          brandId: activeBrand,
          materialArea: ''
        });
      } else {
        showToast(result.msg || '保存失败', 'error');
      }
    } catch (error) {
      console.error('Save material failed', error);
      showToast('网络错误，保存失败', 'error');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const fileName = file.name.toLowerCase();
      const isCSV = fileName.endsWith('.csv');
      const newMaterials: Material[] = [];

      if (isCSV) {
        // Handle CSV files with proper encoding
        const text = await new Promise<string>((resolve, reject) => {
          // Read as array buffer first to have more control over decoding
          const reader = new FileReader();
          
          reader.onload = (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Try different decoding methods
            const decodeWithEncoding = (encoding: string) => {
              try {
                return new TextDecoder(encoding).decode(uint8Array);
              } catch (e) {
                return null;
              }
            };
            
            // Try multiple encodings and select the best one
            const encodings = ['UTF-8', 'gb18030', 'gbk', 'ISO-8859-1'];
            let bestResult: string | null = null;
            let bestEncoding: string | null = null;
            
            for (const encoding of encodings) {
              const result = decodeWithEncoding(encoding);
              if (result) {
                // Check if this encoding can handle Chinese characters
                const hasChinese = /[\u4e00-\u9fa5]/.test(result);
                if (hasChinese) {
                  bestResult = result;
                  bestEncoding = encoding;
                  break; // Found a good encoding with Chinese support
                } else if (!bestResult) {
                  // Use this as fallback if no Chinese found yet
                  bestResult = result;
                  bestEncoding = encoding;
                }
              }
            }
            
            let result = bestResult;
            
            if (result) {
              // Clean up any remaining乱码 characters
              result = result.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '');
              // Also clean up any other special characters that might cause issues
              result = result.replace(/[\x00-\x1F]/g, '');
              resolve(result);
            } else {
              reject(new Error('Failed to decode CSV file'));
            }
          };
          
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
        
        // Better CSV parsing that handles quoted fields with newlines correctly
        const parseCSV = (csvText: string) => {
          // First, normalize line endings
          const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          
          const lines: string[] = [];
          let currentLine: string[] = [];
          let currentCell = '';
          let inQuotes = false;
          let inCell = false;
          
          for (let i = 0; i < normalizedText.length; i++) {
            const char = normalizedText[i];
            
            if (char === '\n' && !inQuotes) {
              // End of line
              currentLine.push(currentCell.trim());
              lines.push(currentLine.join(','));
              currentLine = [];
              currentCell = '';
              inCell = false;
            } else if (char === ',' && !inQuotes) {
              // End of cell
              currentLine.push(currentCell.trim());
              currentCell = '';
              inCell = false;
            } else if (char === '"') {
              // Toggle quotes
              inQuotes = !inQuotes;
              inCell = true;
            } else {
              // Regular character
              currentCell += char;
              inCell = true;
            }
          }
          
          // Add last line if not empty
          if (inCell || currentCell.trim()) {
            currentLine.push(currentCell.trim());
            lines.push(currentLine.join(','));
          }
          
          return lines;
        };
        
        const rows = parseCSV(text);
        
        if (rows.length === 0) {
          throw new Error('CSV文件为空');
        }

        // Parse header row (first row)
        const headers = rows[0].split(',');
        const colMap: { [key: string]: number } = {};
        headers.forEach((header, index) => {
          const trimmedHeader = header.trim();
          if (trimmedHeader) colMap[trimmedHeader] = index;
        });
        
        // Debug: log header mapping
        console.log('Header mapping:', colMap);
        console.log('Headers found:', headers);

        // Process data rows
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i];
          
          // Debug: log raw row data
          console.log(`Raw row ${i}:`, cells);
          
          // Skip empty rows
          if (cells.length === 0) continue;
          
          // Get ID - try to find by header first, then use first column
          let idCol = colMap['ITEM CODE'] || colMap['Code'] || colMap['code'] || colMap['序号'] || 0;
          let id = cells[idCol] || `NEW-${Date.now()}-${i}`;
          
          // Get name - try to find by header first, then use second column
          let nameCol = colMap['PRODUCT NAME'] || colMap['Name'] || colMap['name'] || colMap['产品名称'] || 1;
          let name = cells[nameCol] || '';
          
          // Skip empty rows, summary rows, or special notes
          if (!name || name === '合计' || name === '合计：' || name.includes('特别说明') || name.includes('打包运输费')) continue;

          // Get price - try to find by header first, then use 10th column
          let priceCol = colMap['U. PRICE'] || colMap['Price'] || colMap['price'] || colMap['单价'] || 9;
          const priceStr = cells[priceCol] || '0';
          const cleanedPriceStr = priceStr.replace(/[¥￥, ]/g, '').replace('nan', '0');
          const price = parseFloat(cleanedPriceStr) || 0;

          // Get unit - try to find by header first, then use 9th column
          let unitCol = colMap['UNIT'] || colMap['Unit'] || colMap['unit'] || colMap['单位'] || 8;
          const unit = cells[unitCol] || '个';
          
          // Get specs - try to find by header first, then use 5th column
          let specsCol = colMap['Specs'] || colMap['specs'] || colMap['规格'] || 4;
          const specs = cells[specsCol] || '';
          
          // Get material area - try to find by header first, then use 4th column
          let areaValCol = colMap['Area'] || colMap['area'] || colMap['区域'] || 3;
          const areaVal = cells[areaValCol] || '';
          
          // Get HS code - try to find by header first, then use 12th column
          let hsCol = colMap['HS CODE'] || colMap['hs_code'] || colMap['HS编码'] || 11;
          const hs = cells[hsCol] || '';
          
          // Get category - try to find by header first, then use 11th column
          let categoryCol = colMap['category'] || colMap['Category'] || colMap['类别'] || 10;
          let category = cells[categoryCol] || '砖瓦';
          
          // Get additional fields from CSV
          let specsW = '';
          let specsH = '';
          let qty = 1;
          let imageFilename = '';
          let material = '';
          let specsL = '';
          let location = '';
          let boxNo = '';
          
          // SPECS_W - try to find by header first, then use 6th column
          let specsWCol = colMap['SPECS_W'] || colMap['specs_w'] || colMap['宽度'] || 5;
          if (cells[specsWCol]) {
            specsW = cells[specsWCol];
          }
          
          // SPECS_H - try to find by header first, then use 7th column
          let specsHCol = colMap['SPECS_H'] || colMap['specs_h'] || colMap['高度'] || 6;
          if (cells[specsHCol]) {
            specsH = cells[specsHCol];
          }
          
          // QTY - try to find by header first, then use 8th column
          let qtyCol = colMap['QTY'] || colMap['qty'] || colMap['数量'] || 7;
          if (cells[qtyCol]) {
            const qtyStr = cells[qtyCol].replace('nan', '1');
            qty = parseFloat(qtyStr) || 1;
          }
          
          // 图片文件名 - try to find by header first, then use 12th column
          let imageFilenameCol = colMap['图片文件名'] || colMap['image_filename'] || colMap['Image Filename'] || 11;
          if (cells[imageFilenameCol]) {
            imageFilename = cells[imageFilenameCol];
          } else if (cells[colMap['图片URL'] || colMap['imageUrl'] || colMap['image_url'] || colMap['image'] || colMap['Image URL'] || 12]) {
            // If no image filename, try to extract from image URL
            const imageUrl = cells[colMap['图片URL'] || colMap['imageUrl'] || colMap['image_url'] || colMap['image'] || colMap['Image URL'] || 12];
            imageFilename = imageUrl.split('/').pop() || '';
          }
          
          // MATERIAL - try to find by header first, then use 4th column
          let materialCol = colMap['MATERIAL'] || colMap['material'] || colMap['材质'] || 3;
          if (cells[materialCol]) {
            material = cells[materialCol];
          }
          
          // SPECS_L - try to find by header first, then use 5th column
          let specsLCol = colMap['SPECS_L'] || colMap['specs_l'] || colMap['长度'] || 4;
          if (cells[specsLCol]) {
            specsL = cells[specsLCol];
          }
          
          // location - try to find by header first, then use 14th column
          let locationCol = colMap['location'] || colMap['Location'] || colMap['位置'] || 13;
          if (cells[locationCol]) {
            location = cells[locationCol];
          }
          
          // box_no - try to find by header first, then use 16th column
          let boxNoCol = colMap['box_no'] || colMap['Box No'] || colMap['装箱号'] || 15;
          if (cells[boxNoCol]) {
            boxNo = cells[boxNoCol];
          }
          
          // Clean up all fields to avoid乱码
          category = category.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          if (!category) category = '砖瓦';
          
          name = name.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          id = id.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          specsW = specsW.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          specsH = specsH.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          imageFilename = imageFilename.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          material = material.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          specsL = specsL.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          location = location.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          boxNo = boxNo.replace(/[♦♦♦♦♦♦♦]/g, '').replace(/[�]/g, '').trim();
          
          // Don't skip rows with乱码 in name or id, just clean them up
          console.log(`Processing row ${i}: ID=${id}, Name=${name}, Category=${category}`);
          
          // Image URL handling
          let imageUrl = '';
          
          // Try to find image URL column by header
          let imageUrlCol = colMap['图片URL'] || colMap['imageUrl'] || colMap['image_url'] || colMap['image'] || colMap['Image URL'] || 12;
          
          if (cells[imageUrlCol]) {
            imageUrl = cells[imageUrlCol];
          } else {
            const folderName = ossFolderForRow({}, category);
            const brandFolder = BRAND_TO_OSS_FOLDER[activeRestaurantBrand] || '';
            imageUrl = materialOssImageUrl(folderName, `${id}.png`, brandFolder);
          }

          newMaterials.push({
            id: id,
            brandId: '',
            restaurantBrand: activeRestaurantBrand === '全部' ? '' : activeRestaurantBrand,
            category: category,
            name: name,
            imageUrl: imageUrl,
            unit: unit,
            basePrice: price,
            hsCode: hs,
            weight: 0,
            volume: 0,
            specs: specs,
            materialArea: areaVal,
            specsW: specsW,
            specsH: specsH,
            qty: qty,
            imageFilename: imageFilename
          });
        }
      } else {
        // Handle Excel files (existing logic)
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        const worksheet = workbook.worksheets[0];

        // Find header row dynamically (looking for "序号" and "产品名称")
        let headerRowIndex = -1;
        worksheet.eachRow((row, rowNumber) => {
          if (headerRowIndex !== -1) return;
          let hasId = false;
          let hasName = false;
          row.eachCell((cell) => {
            const val = cell.text?.trim() || '';
            if (val.includes('序号')) hasId = true;
            if (val.includes('产品名称')) hasName = true;
          });
          if (hasId && hasName) {
            headerRowIndex = rowNumber;
          }
        });

        if (headerRowIndex === -1) {
          throw new Error('未找到有效的表头（需包含"序号"和"产品名称"）');
        }

        const headerRow = worksheet.getRow(headerRowIndex);
        const colMap: { [key: string]: number } = {};
        headerRow.eachCell((cell, colNumber) => {
          const val = cell.text ? cell.text.trim() : '';
          if (val) colMap[val] = colNumber;
        });

        // Helper to convert buffer to base64 in browser
        const bufferToBase64 = (buffer: ArrayBuffer, extension: string) => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return `data:image/${extension};base64,${window.btoa(binary)}`;
        };

        // Extract images and map them to rows
        const imagesByRow: { [key: number]: string } = {};
        try {
          worksheet.getImages().forEach((img) => {
            const image = workbook.getImage(Number(img.imageId));
            if (image && image.buffer) {
              const base64 = bufferToBase64(image.buffer, image.extension);
              const rowIdx = Math.floor(img.range.tl.row) + 1;
              imagesByRow[rowIdx] = base64;
            }
          });
        } catch (imgErr) {
          console.warn('Failed to extract images', imgErr);
        }

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber <= headerRowIndex) return;
          
          // Get name using flexible mapping
          const nameCol = colMap['产品名称'] || colMap['名称'] || 2;
          const name = row.getCell(nameCol).text?.trim() || '';
          
          // Skip empty rows, summary rows, or special notes
          if (!name || name === '合计' || name === '合计：' || name.includes('特别说明') || name.includes('打包运输费')) return;

          const idCol = colMap['序号'] || 1;
          const id = row.getCell(idCol).text?.trim() || `NEW-${Date.now()}-${rowNumber}`;
          
          // Price extraction - more robust
          const priceCol = colMap['单价 (元)'] || colMap['单价(元)'] || colMap['单价'] || 9;
          const priceCell = row.getCell(priceCol);
          let price = 0;
          
          if (priceCell.type === ExcelJS.ValueType.Formula) {
            price = Number(priceCell.result) || 0;
          } else if (priceCell.type === ExcelJS.ValueType.Number) {
            price = Number(priceCell.value) || 0;
          } else {
            // Try to parse string, removing currency symbols
            const strVal = priceCell.text?.replace(/[¥￥, ]/g, '') || '0';
            price = parseFloat(strVal) || 0;
          }

          const unit = row.getCell(colMap['单位'] || 8).text?.trim() || '个';
          const specs = row.getCell(colMap['规格 (mm)'] || colMap['规格'] || 5).text?.trim() || '';
          const areaVal = row.getCell(colMap['区域'] || colMap['安装位置'] || colMap['材质/颜色'] || colMap['颜色'] || 6).text?.trim() || '';
          const hs = row.getCell(colMap['HS编码'] || 12).text?.trim() || '';
          const area = row.getCell(colMap['区域'] || 4).text?.trim() || '砖瓦';

          newMaterials.push({
            id: `MAT-${id}-${Date.now()}-${rowNumber}`,
            brandId: '',
            restaurantBrand: activeRestaurantBrand === '全部' ? '' : activeRestaurantBrand,
            category: area,
            name: name,
            imageUrl: imagesByRow[rowNumber] || 'https://renli2026.oss-cn-chengdu.aliyuncs.com/materials/%E4%BA%94%E9%87%91%E6%9D%82%E4%BB%B6%E5%8F%8A%E5%B7%A5%E7%A8%8B%E7%81%AF%E5%85%B7/CE11-BKCH-HWELI-001.png',
            unit: unit,
            basePrice: price,
            hsCode: hs,
            weight: 0,
            volume: 0,
            specs: specs,
            materialArea: areaVal
          });
        });
      }

      if (newMaterials.length === 0) {
        throw new Error('未读取到任何有效的物料数据，请检查表格内容');
      }

      // 检查是否已存在相同ID的材料
      const existingIds = new Set(materials.map(m => m.id));
      const filteredMaterials = newMaterials.filter(m => !existingIds.has(m.id));
      const skippedCount = newMaterials.length - filteredMaterials.length;

      if (filteredMaterials.length > 0) {
        // Save materials to database
        let savedCount = 0;
        for (const material of filteredMaterials) {
          try {
            const response = await fetch('/api/save-material', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code: material.id,
                name: material.name,
                image: material.imageUrl,
                price: material.basePrice,
                unit: material.unit,
                spec: material.specs,
                color: material.materialArea,
                area: material.category,
                hs_code: material.hsCode,
                weight: material.weight,
                volume: material.volume,
                brand: material.brandId === '全部' ? '' : material.brandId,
                specs_w: material.specsW,
                specs_h: material.specsH,
                qty: material.qty,
                image_filename: material.imageFilename,
                material: material.material,
                specs_l: material.specsL,
                location: material.location,
                box_no: material.boxNo
              })
            });
            const result = await response.json();
            if (result.code === 0 || result.code === 200) {
              savedCount++;
            }
          } catch (error) {
            console.error('Failed to save material:', error);
          }
        }

        // Update local state
        setMaterials(prev => [...prev, ...filteredMaterials]);

        if (skippedCount > 0) {
          showToast(`成功导入 ${filteredMaterials.length} 个物料，跳过 ${skippedCount} 个已存在的物料，其中 ${savedCount} 个已保存到数据库`, 'success');
        } else {
          showToast(`成功导入 ${filteredMaterials.length} 个物料，其中 ${savedCount} 个已保存到数据库`, 'success');
        }
      } else {
        showToast(`没有新物料导入，跳过 ${skippedCount} 个已存在的物料`, 'info');
      }
    } catch (err: any) {
      console.error('Import failed', err);
      showToast(`导入失败: ${err.message || '请检查文件格式'}`, 'error');
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const deleteMaterial = (id: string) => {
    setShowConfirmModal({
      message: '确定要从材料库中永久删除此物料吗？',
      onConfirm: () => {
        setMaterials(prev => prev.filter(m => m.id !== id));
        setShowConfirmModal(null);
        showToast('物料已删除', 'success');
      }
    });
  };

  // --- Export ---
  const exportToExcel = async () => {
    if (cart.length === 0) return;
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('材料单项明细单');

      // Helper to fetch image and convert to base64
      const fetchImageAsBase64 = async (url: string): Promise<{ base64: string, extension: string } | null> => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onloadend = () => {
              const base64 = reader.result as string;
              const extension = blob.type.split('/')[1] || 'png';
              resolve({ base64: base64.split(',')[1], extension });
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          console.warn('Failed to fetch image for Excel export', url, err);
          return null;
        }
      };

      // Title & Header Info
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      const categoryText = activeCategory === '全部' ? '全部材料' : activeCategory;
      titleCell.value = `材料单项明细单 (${categoryText})`;
      titleCell.font = { size: 18, bold: true, name: 'Microsoft YaHei' };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      // Add Main Document QR Code in Header
      try {
        const mainQrDataUrl = await QRCode.toDataURL(window.location.href);
        const mainQrImageId = workbook.addImage({ base64: mainQrDataUrl.split(',')[1], extension: 'png' });
        worksheet.addImage(mainQrImageId, {
          tl: { col: 11, row: 0 },
          ext: { width: 60, height: 60 }
        });
      } catch (qrErr) {
        console.warn('Failed to add main QR code', qrErr);
      }

      // Project Info Grid
      const infoRows = [
        { label1: '订购单位 (人)', val1: projectHeader.orderUnit, label2: '订购时间', val2: projectHeader.orderDate, label3: '联系方式', val3: projectHeader.contact },
        { label1: '项目负责人', val1: projectHeader.supplier, label2: '项目名称', val2: projectHeader.projectName, label3: '制单日期', val3: new Date().toLocaleDateString() }
      ];

      infoRows.forEach((info, idx) => {
        const rowNum = idx + 3;
        worksheet.getRow(rowNum).height = 25;
        worksheet.getCell(`A${rowNum}`).value = info.label1;
        worksheet.getCell(`B${rowNum}`).value = info.val1;
        worksheet.getCell(`E${rowNum}`).value = info.label2;
        worksheet.getCell(`F${rowNum}`).value = info.val2;
        worksheet.getCell(`I${rowNum}`).value = info.label3;
        worksheet.getCell(`J${rowNum}`).value = info.val3;

        ['A', 'E', 'I'].forEach(col => {
          const cell = worksheet.getCell(`${col}${rowNum}`);
          cell.font = { bold: true, color: { argb: 'FF888888' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        });
      });

      // Table Headers
      const headers = ['序号', '产品名称', '图片', '区域', '规格 (mm)', '数量', '单位', '单价 (元)', '合计 (元)', '备注', 'HS编码', '装箱号'];
      const headerRow = worksheet.addRow(headers);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Microsoft YaHei' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      // Data Rows
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const rowData = [
          i + 1,
          item.name,
          '', // Image Placeholder
          item.selectedArea || item.materialArea || item.category || '门头',
          item.selectedSpec || item.specs || '',
          item.quantity,
          item.unit,
          item.basePrice,
          item.basePrice * item.quantity,
          '-',
          item.hsCode,
          item.packingNo || '-'
        ];
        const row = worksheet.addRow(rowData);
        row.height = 80;
        row.eachCell((cell, colIdx) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (colIdx === 9 || colIdx === 10) cell.numFmt = '#,##0.00';
        });

        // Add Actual Product Image
        if (item.imageUrl) {
          const imgData = await fetchImageAsBase64(item.imageUrl);
          if (imgData) {
            try {
              const imageId = workbook.addImage({ base64: imgData.base64, extension: imgData.extension as any });
              worksheet.addImage(imageId, {
                tl: { col: 2, row: row.number - 1 },
                ext: { width: 80, height: 80 },
                editAs: 'oneCell'
              });
            } catch (err) {
              console.warn('Failed to add image to Excel', err);
            }
          }
        }

        // Add QR Code for Detail Link in the last column or as a small overlay
        try {
          const itemQrDataUrl = await QRCode.toDataURL(item.detailLink || `https://renli.com/p/${item.id}`);
          const itemQrImageId = workbook.addImage({ base64: itemQrDataUrl.split(',')[1], extension: 'png' });
          worksheet.addImage(itemQrImageId, {
            tl: { col: 1, row: row.number - 1 },
            ext: { width: 30, height: 30 },
            editAs: 'oneCell'
          });
        } catch (qrErr) {
          console.warn('Failed to add item QR code', qrErr);
        }
      }

      // Summary Row
      const summaryRow = worksheet.addRow(['', '', '', '', '', '', '', '', '合计 GRAND TOTAL', totalCNY, '', '', '']);
      summaryRow.height = 40;
      summaryRow.getCell(9).font = { bold: true, size: 12 };
      summaryRow.getCell(10).font = { bold: true, size: 14, color: { argb: 'FFE1251B' } };
      summaryRow.getCell(10).numFmt = '¥#,##0.00';
      summaryRow.getCell(10).alignment = { vertical: 'middle', horizontal: 'right' };

      // Special Instructions
      worksheet.addRow([]);
      const instrTitleRow = worksheet.addRow(['特别说明 (SPECIAL INSTRUCTIONS)']);
      instrTitleRow.getCell(1).font = { bold: true, color: { argb: 'FF888888' }, size: 9 };
      
      (projectHeader.notes || '').split('\n').forEach((note, idx) => {
        if (!note.trim()) return;
        const row = worksheet.addRow([`${idx + 1}. ${note.replace(/^\d+[.、]\s*/, '')}`]);
        row.getCell(1).font = { size: 10, color: { argb: 'FF666666' } };
        worksheet.mergeCells(`A${row.number}:M${row.number}`);
      });

      // Footer
      worksheet.addRow([]);
      const footerRow = worksheet.addRow([`© ${new Date().getFullYear()} 成都仁力烨升国际贸易有限公司 | Generated on ${new Date().toLocaleString()}`]);
      footerRow.getCell(1).font = { size: 8, color: { argb: 'FFAAAAAA' } };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOM_${projectHeader.projectName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (error) {
      console.error('Export failed', error);
    } finally {
      setIsExporting(false);
    }
  };

  const [isSavingProject, setIsSavingProject] = useState(false);

  const saveProject = async () => {
    if (cart.length === 0) return;
    setIsSavingProject(true);
    try {
      const payload = {
        project_id: projectHeader.id,
        project_name: projectHeader.projectName,
        order_unit: projectHeader.orderUnit,
        contact: projectHeader.contact,
        supplier: projectHeader.supplier,
        notes: projectHeader.notes,
        items: cart.map(item => ({
          material_id: item.id,
          quantity: item.quantity,
          price_cny: item.basePrice,
          price_eur: Number((item.basePrice * rates.EUR).toFixed(2)),
          remark: item.selectedArea || '',
          box_no: item.packingNo || '',
          material_name: item.name || '',
          unit: item.unit || '',
          spec: item.specs || '',
          color: item.materialArea || '',
          area: item.category || '',
          hs_code: item.hsCode || '',
          specs_w: item.specsW || '',
          specs_h: item.specsH || '',
          image: item.imageUrl || ''
        }))
      };

      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.code === 0 || result.code === 200) {
        showToast(result.msg || '保存成功', 'success');
        if (!projectHeader.id && result.projectId) {
          setProjectHeader(prev => ({ ...prev, id: result.projectId }));
        }
        fetchProjects(); // Refresh list
      } else {
        showToast(result.msg || '保存失败', 'error');
      }
    } catch (error) {
      console.error('Save project failed', error);
      showToast('网络错误，请稍后重试', 'error');
    } finally {
      setIsSavingProject(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-black overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm h-[73px] flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => {
              if (onBackToHub) onBackToHub();
              else window.history.back();
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronRight size={20} className="rotate-180" />
            <span className="font-medium text-sm">返回材料中心 / Back</span>
          </button>
          <div className="h-10 w-10 rounded-lg bg-[#E1251B] flex items-center justify-center text-white font-bold text-lg">R</div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-slate-900 leading-none">BOM 清单制作</h1>
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-[0.2em] mt-1">Digital Material Management</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-2 bg-slate-100 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-transparent focus-within:border-red-500 transition-all">
            <Globe size={12} className="text-slate-400" />
            <span className="text-[8px] md:text-[10px] font-black uppercase">EUR</span>
            <input 
              type="number" 
              value={rates.EUR} 
              onChange={(e) => setRates({...rates, EUR: Number(e.target.value)})}
              className="w-10 md:w-16 bg-transparent text-[10px] md:text-xs font-black focus:outline-none"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 px-2 md:px-3 py-1.5 md:py-2 rounded-lg border border-transparent focus-within:border-red-500 transition-all">
            <Globe size={12} className="text-slate-400" />
            <span className="text-[8px] md:text-[10px] font-black uppercase">USD</span>
            <input 
              type="number" 
              value={rates.USD} 
              onChange={(e) => setRates({...rates, USD: Number(e.target.value)})}
              className="w-10 md:w-16 bg-transparent text-[10px] md:text-xs font-black focus:outline-none"
            />
          </div>
          <div className="hidden md:block h-6 w-px bg-slate-200 mx-1"></div>
          <button 
            onClick={saveProject}
            disabled={isSavingProject || cart.length === 0}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 md:px-5 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-30"
          >
            <span className="hidden sm:inline">{isSavingProject ? 'Saving...' : 'Save'}</span>
            <Save size={14} />
          </button>
          <button 
            onClick={exportToExcel}
            disabled={isExporting || cart.length === 0}
            className="flex items-center gap-2 bg-[#E1251B] text-white px-3 md:px-5 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-bold hover:bg-black transition-all disabled:opacity-30 shadow-lg shadow-red-500/20"
          >
            <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
            <Download size={14} />
          </button>
        </div>
      </header>

      <div className="shrink-0 px-4 py-3 md:px-6 bg-black border-b border-white/10 flex flex-wrap items-center justify-center md:justify-between gap-3">
        <button
          type="button"
          onClick={() => setEngineeringModalOpen(true)}
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-[#E1251B] hover:bg-[#c11f17] text-white text-sm md:text-base font-black tracking-wide shadow-lg shadow-black/40 border border-white/10 transition-colors"
        >
          <span className="text-lg" aria-hidden>
            🛡️
          </span>
          {lang === 'cn'
            ? '启动工程决策中心 · 亚特兰大认证算量'
            : lang === 'de'
              ? 'Engineering Decision Center · Atlanta'
              : 'Launch Engineering Decision Center · Atlanta certified'}
        </button>
        <button
          type="button"
          onClick={() => setShowDecisionCenter(true)}
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 hover:from-red-700 hover:to-red-600 text-white text-sm md:text-base font-black tracking-wide shadow-lg shadow-black/40 border border-white/10 transition-all"
        >
          <span className="text-lg" aria-hidden>🏛️</span>
          {lang === 'cn' ? '3D 数字孪生决策中心' : '3D Digital Twin Center'}
        </button>
        <p className="text-neutral-400 text-sm font-medium text-center md:text-left max-w-xl hidden lg:block">
          {lang === 'cn'
            ? '全屏场景化算量与散砖/预制板对比，便于与海外客户现场深化方案。'
            : 'Full-screen BOM scenario for client-facing reviews.'}
        </p>
      </div>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        {/* Left Panel: Material Library */}
        <aside 
          className="bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden w-full md:w-auto h-[40vh] md:h-full z-10"
          style={{ width: typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : leftPanelWidth }}
        >
          {/* Library Header */}
          <div className="p-4 border-b border-slate-200 bg-white relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package size={14} className="text-red-600" />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">物料库 / LIBRARY</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchMaterials()}
                  disabled={isLoadingMaterials}
                  className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-all disabled:opacity-50"
                  title="刷新材料库"
                >
                  <RefreshCw size={14} className={isLoadingMaterials ? "animate-spin" : ""} />
                </button>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {materials.length} ITEMS
                </span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select 
                  value={activeRestaurantBrand}
                  onChange={(e) => handleRestaurantBrandChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-8 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-red-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="全部">餐饮品牌</option>
                  {restaurantBrands.filter(brand => brand !== "全部").map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight size={14} className="rotate-90 text-slate-400" />
                </div>
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <select 
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-8 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-red-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="全部">材料</option>
                  {dynamicCategories.filter(cat => cat !== "全部").map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronRight size={14} className="rotate-90 text-slate-400" />
                </div>
              </div>
            </div>

          </div>

          {/* Material Grid */}
          <div className="flex-1 overflow-y-auto p-3 bg-slate-50/50 custom-scrollbar">
            {isLoadingMaterials ? (
              <div className="flex flex-col items-center justify-center h-full opacity-30">
                <Loader2 size={24} className="animate-spin mb-2" />
                <span className="text-[10px] font-black uppercase">Loading Library...</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredMaterials.map(material => (
                  <MaterialCard 
                    key={material.id}
                    material={material}
                    onAdd={addToCart}
                    onOpenEngineering={(m) => {
                      setAssistantFocusMaterial(m);
                      setEngineeringModalOpen(true);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Library Footer */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Materials: {filteredMaterials.length}</span>
              <button className="text-red-600 hover:underline">View All</button>
            </div>
          </div>
        </aside>

        {/* Resize Handle */}
        <div 
          className={`hidden md:flex w-1 bg-slate-200 hover:bg-red-500 cursor-col-resize transition-colors flex-shrink-0 group relative ${isResizing ? 'bg-red-500' : ''}`}
          onMouseDown={startResizing}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 z-10"></div>
        </div>

        {/* Central Area: BOM Workspace */}
        <main id="bom-workspace-anchor" className="flex-1 flex flex-col bg-slate-50 overflow-hidden min-w-0 scroll-mt-4">
          {/* Project Header Editor */}
          <div className="bg-white border-b border-slate-200 p-6 shrink-0">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                    <Layout size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tighter text-slate-900">项目信息配置 / PROJECT CONFIG</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Configure document headers and metadata</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowCustomizer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    <Settings size={14} /> Advanced Settings
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">项目名称 / Project Name</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={projectHeader.projectName}
                      onChange={(e) => setProjectHeader({...projectHeader, projectName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-black focus:outline-none focus:border-red-500 transition-all"
                      placeholder="Enter project name..."
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">订购单位 / Order Unit</label>
                  <input 
                    type="text" 
                    value={projectHeader.orderUnit}
                    onChange={(e) => setProjectHeader({...projectHeader, orderUnit: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-black focus:outline-none focus:border-red-500 transition-all"
                    placeholder="Company or person..."
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">联系方式 / Contact</label>
                  <input 
                    type="text" 
                    value={projectHeader.contact}
                    onChange={(e) => setProjectHeader({...projectHeader, contact: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-black focus:outline-none focus:border-red-500 transition-all"
                    placeholder="Phone or email..."
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">关联项目 / Link Project</label>
                    <button 
                      onClick={clearProject}
                      className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline"
                    >
                      + New Project
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-black focus:outline-none focus:border-red-500 transition-all appearance-none"
                      value={projectHeader.id || ""}
                      onChange={(e) => {
                        if (e.target.value) {
                          loadProject(e.target.value);
                        } else {
                          clearProject();
                        }
                      }}
                    >
                      <option value="">Select Existing Project</option>
                      {allProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => {
                        if (projectHeader.id) {
                          deleteProject(projectHeader.id);
                        }
                      }}
                      disabled={!projectHeader.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 transition-all disabled:opacity-50"
                      title="Delete selected project"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOM Table Workspace */}
          <div className="flex-1 p-6 overflow-hidden flex flex-col">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl flex-1 flex flex-col overflow-hidden">
              {/* Table Toolbar */}
              <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    <ShoppingCart size={14} /> {cart.length} Items Selected
                  </div>
                  <div className="h-4 w-px bg-slate-200" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Last Saved: {new Date().toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={suggestAllHSCodes}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all"
                  >
                    <Sparkles size={14} /> AI Suggest All
                  </button>
                  <button 
                    onClick={clearProject}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    <Plus size={14} /> New Project
                  </button>
                  <button 
                    onClick={() => {
                      setShowConfirmModal({
                        message: '确定要清空购物车吗？',
                        onConfirm: () => {
                          setCart([]);
                          setShowConfirmModal(null);
                          showToast('购物车已清空', 'info');
                        }
                      });
                    }}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-all"
                  >
                    Clear All
                  </button>
                  <button 
                    onClick={saveProject}
                    disabled={isSavingProject}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-black/10 disabled:opacity-50"
                  >
                    <Save size={14} /> {isSavingProject ? 'Saving...' : 'Save Project'}
                  </button>
                  <button 
                    onClick={() => setShowPreview(true)}
                    className="px-6 py-2 bg-[#E1251B] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                  >
                    Preview Document
                  </button>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-slate-50">
                <table className="hidden md:table w-full border-collapse text-[11px] min-w-[1200px] bg-white">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr className="bg-slate-50 text-slate-400 font-black uppercase tracking-[0.2em] text-[9px] border-b border-slate-200">
                      <th className="px-4 py-4 text-center w-12">#</th>
                      <th className="px-4 py-4 text-left w-32">ID / 编码</th>
                      <th className="px-4 py-4 text-left">Product / 产品名称</th>
                      <th className="px-4 py-4 text-center w-20">Image</th>
                      <th className="px-4 py-4 text-left w-32">Area / 区域</th>
                      <th className="px-4 py-4 text-left w-40">Specs / 规格</th>
                      <th className="px-4 py-4 text-center w-32">Qty / 数量</th>
                      <th className="px-4 py-4 text-center w-16">Unit</th>
                      <th className="px-4 py-4 text-right w-28">Price (¥)</th>
                      <th className="px-4 py-4 text-right w-32">Total (¥)</th>
                      <th className="px-4 py-4 text-left w-32">HS Code</th>
                      <th className="px-4 py-4 text-left w-24">Box No.</th>
                      <th className="px-4 py-4 text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-32 text-center">
                          <div className="flex flex-col items-center opacity-10">
                            <ShoppingCart size={64} className="mb-4" />
                            <p className="text-xl font-black uppercase tracking-[0.5em]">No Items Selected</p>
                            <p className="text-xs font-bold mt-2">Add materials from the library on the left</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      cart.map((item, idx) => (
                        <tr key={item.cartId} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-4 py-4 text-center text-slate-300 font-black">{idx + 1}</td>
                          <td className="px-4 py-4 font-bold text-slate-500">{item.id}</td>
                          <td className="px-4 py-4">
                            <div className="font-black text-slate-900 uppercase tracking-tight">{item.name}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden mx-auto border border-slate-200 group-hover:border-red-500 transition-colors">
                              <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" referrerPolicy="no-referrer" />
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <input 
                              type="text" 
                              value={item.selectedArea}
                              onChange={(e) => updateCartItem(item.cartId, { selectedArea: e.target.value })}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:outline-none focus:border-red-500 py-1 font-medium transition-all"
                              placeholder="区域"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input 
                              type="text" 
                              value={item.selectedSpec || item.specs}
                              onChange={(e) => updateCartItem(item.cartId, { selectedSpec: e.target.value })}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:outline-none focus:border-red-500 py-1 font-medium transition-all"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-3">
                              <button 
                                onClick={() => updateCartItem(item.cartId, { quantity: Math.max(1, item.quantity - 1) })}
                                className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-black hover:text-white transition-all font-black"
                              >-</button>
                              <input 
                                type="number" 
                                value={item.quantity}
                                onChange={(e) => updateCartItem(item.cartId, { quantity: Number(e.target.value) })}
                                className="w-10 text-center font-black bg-transparent focus:outline-none text-sm"
                              />
                              <button 
                                onClick={() => updateCartItem(item.cartId, { quantity: item.quantity + 1 })}
                                className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-black hover:text-white transition-all font-black"
                              >+</button>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-slate-400 font-bold uppercase">{item.unit}</td>
                          <td className="px-4 py-4 text-right font-bold text-slate-600">¥{item.basePrice.toFixed(2)}</td>
                          <td className="px-4 py-4 text-right font-black text-slate-900 text-sm">¥{(item.basePrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                value={item.hsCode}
                                onChange={(e) => updateCartItem(item.cartId, { hsCode: e.target.value })}
                                className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:outline-none focus:border-red-500 py-1 font-bold transition-all"
                              />
                              <button 
                                onClick={() => suggestHSCode(item.cartId, item.name)}
                                className="text-slate-300 hover:text-red-600 transition-all"
                                title="AI Suggest HS Code"
                              >
                                {aiLoadingId === item.cartId ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <input 
                              type="text" 
                              value={item.packingNo}
                              onChange={(e) => updateCartItem(item.cartId, { packingNo: e.target.value })}
                              className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:outline-none focus:border-red-500 py-1 font-bold transition-all"
                              placeholder="BOX-00"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button 
                              onClick={() => removeFromCart(item.cartId)}
                              className="text-slate-200 hover:text-red-600 transition-all transform hover:scale-110"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="flex md:hidden flex-col divide-y divide-slate-100 bg-white">
                  {cart.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center opacity-20 px-6">
                      <ShoppingCart size={40} className="mb-3 text-slate-300" />
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">BOM 清单为空</p>
                      <p className="text-[9px] font-bold mt-1 text-slate-300">请从上方物料库选择</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => (
                      <div key={item.cartId} className="p-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors">
                        <div className="flex gap-4 items-start">
                          <div className="w-14 h-14 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 shrink-0">
                            <img src={item.imageUrl} className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{item.id}</span>
                              <button 
                                onClick={() => removeFromCart(item.cartId)}
                                className="p-1 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="font-black text-slate-900 uppercase leading-tight truncate text-xs mb-1">{item.name}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-[#E1251B]">¥{item.basePrice.toLocaleString()}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase">区域 / Area</label>
                            <input 
                              value={item.selectedArea} 
                              onChange={(e) => updateCartItem(item.cartId, { selectedArea: e.target.value })} 
                              className="w-full bg-slate-50 rounded-lg px-2 py-1.5 text-[10px] font-bold border border-transparent focus:border-red-500/20"
                              placeholder="区域..."
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase">数量 / Qty</label>
                            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                              <button onClick={() => updateCartItem(item.cartId, { quantity: Math.max(1, item.quantity - 1) })} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-black text-xs">-</button>
                              <span className="text-[10px] font-black">{item.quantity}</span>
                              <button onClick={() => updateCartItem(item.cartId, { quantity: item.quantity + 1 })} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-slate-600 font-black text-xs">+</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Table Footer / Summary Bar */}
              <div className="px-10 py-8 bg-slate-900 text-white shrink-0 flex items-center justify-between">
                <div className="flex gap-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Items</span>
                    <span className="text-2xl font-black">{cart.length} <span className="text-xs text-slate-500 font-bold">UNITS</span></span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Volume</span>
                    <span className="text-2xl font-black">0.00 <span className="text-xs text-slate-500 font-bold">M³</span></span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Total Weight</span>
                    <span className="text-2xl font-black">0.00 <span className="text-xs text-slate-500 font-bold">KG</span></span>
                  </div>
                </div>
                
                <div className="flex items-center gap-10">
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Estimated EUR</span>
                    <span className="text-xl font-black text-slate-300">€{(totalCNY * rates.EUR).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="h-12 w-px bg-slate-800" />
                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block">Grand Total Amount</span>
                    <span className="text-4xl font-black text-white tracking-tighter">¥{totalCNY.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <EngineeringAssistantModal
        open={engineeringModalOpen}
        onClose={() => setEngineeringModalOpen(false)}
        activeCategory={activeCategory}
        focusMaterial={assistantFocusMaterial}
        onClearFocus={() => setAssistantFocusMaterial(null)}
        materials={materials}
        onAddLinesAsCart={(items) => setCart((prev) => [...prev, ...items])}
        showToast={showToast}
        lang={lang}
      />

      {/* 3D 工程决策中心 (Sprint 3) */}
      {showDecisionCenter && (
        <React.Suspense fallback={<div className="fixed inset-0 z-[9999] bg-[#F5F5F7] flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32} /></div>}>
          <EngineeringDecisionCenter
            onClose={() => setShowDecisionCenter(false)}
            lang={lang === 'de' ? 'en' : lang}
            projects={projects}
            setProjects={setProjects}
          />
        </React.Suspense>
      )}

      {/* BOM Customizer Modal */}
      <AnimatePresence>
        {showCustomizer && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCustomizer(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col border border-white/10"
            >
              <div className="h-20 border-b border-gray-100 flex items-center justify-between px-10 shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center">
                    <Settings size={20} />
                  </div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">BOM 表单定制 / Customization</h2>
                </div>
                <button onClick={() => setShowCustomizer(false)} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-full transition-all">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 border-b border-red-100 pb-2">项目抬头 / Project Header</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">项目名称 / Project Name</label>
                        <input 
                          type="text" 
                          value={projectHeader.projectName}
                          onChange={(e) => setProjectHeader({...projectHeader, projectName: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">订购单位 / Order Unit</label>
                        <input 
                          type="text" 
                          value={projectHeader.orderUnit}
                          onChange={(e) => setProjectHeader({...projectHeader, orderUnit: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">联系方式 / Contact</label>
                          <input 
                            type="text" 
                            value={projectHeader.contact}
                            onChange={(e) => setProjectHeader({...projectHeader, contact: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">日期 / Date</label>
                          <input 
                            type="date" 
                            value={projectHeader.orderDate}
                            onChange={(e) => setProjectHeader({...projectHeader, orderDate: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 border-b border-red-100 pb-2">汇率与供应商 / Rates & Supplier</h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">供应商 / Supplier</label>
                        <input 
                          type="text" 
                          value={projectHeader.supplier}
                          onChange={(e) => setProjectHeader({...projectHeader, supplier: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">EUR 汇率 / Rate</label>
                          <input 
                            type="number" 
                            step="0.0001"
                            value={rates.EUR}
                            onChange={(e) => setRates({...rates, EUR: parseFloat(e.target.value)})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">USD 汇率 / Rate</label>
                          <input 
                            type="number" 
                            step="0.0001"
                            value={rates.USD}
                            onChange={(e) => setRates({...rates, USD: parseFloat(e.target.value)})}
                            className="w-full bg-gray-50 border border-gray-100 rounded-xl py-3 px-4 font-bold text-sm focus:outline-none focus:border-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">备注说明 / Remarks & Notes</label>
                  <textarea 
                    value={projectHeader.notes}
                    onChange={(e) => setProjectHeader({...projectHeader, notes: e.target.value})}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-medium text-sm focus:outline-none focus:border-red-500 h-40 resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="p-10 border-t border-gray-100 bg-gray-50/50">
                <button 
                  onClick={() => setShowCustomizer(false)}
                  className="w-full bg-black text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-xl hover:bg-red-600 transition-all"
                >
                  保存并应用设置 / Save & Apply
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOM Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" 
              onClick={() => setShowPreview(false)}
            ></motion.div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#F8F9FA] w-full max-w-6xl h-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative border border-white/10"
            >
              {/* Preview Header */}
              <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0">
                <button 
                  onClick={() => setShowPreview(false)}
                  className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors"
                >
                  <ChevronRight size={20} className="rotate-180" />
                  <span className="text-sm font-bold">返回编辑</span>
                </button>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition-all"
                  >
                    <FileText size={16} />
                    预览 PDF
                  </button>
                  <button 
                    onClick={exportToExcel}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-6 py-2 bg-[#E1251B] text-white rounded-lg text-sm font-bold hover:bg-black transition-all shadow-lg shadow-red-500/20"
                  >
                    {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    确认并下载清单
                  </button>
                </div>
              </div>

              {/* Printable Content */}
              <div className="flex-1 overflow-y-auto p-12 bg-white print:p-0 custom-scrollbar" id="bom-printable-content">
                <div className="max-w-5xl mx-auto bg-white">
                  {/* Document Title */}
                  <div className="text-center mb-12 relative">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">材料单项明细单 ({activeCategory === '全部' ? '全部材料' : activeCategory})</h1>
                    <div className="absolute top-0 right-0">
                       <QRCodeDisplay value={window.location.href} size={80} />
                    </div>
                  </div>

                  {/* Header Grid */}
                  <div className="grid grid-cols-3 gap-y-6 gap-x-12 mb-10 text-sm border-b border-gray-100 pb-10">
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">订购单位 (人)</p>
                      <p className="font-bold text-gray-900">{projectHeader.orderUnit}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">订购时间</p>
                      <p className="font-bold text-gray-900">{projectHeader.orderDate}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">订购人联系方式</p>
                      <p className="font-bold text-gray-900">{projectHeader.contact}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">项目负责人</p>
                      <p className="font-bold text-gray-900">{projectHeader.supplier}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">项目名称</p>
                      <p className="font-bold text-[#E1251B]">{projectHeader.projectName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">制单日期</p>
                      <p className="font-bold text-gray-900">{new Date().toISOString().split('T')[0]}</p>
                    </div>
                  </div>

                  {/* Main Table */}
                  <div className="overflow-x-auto mb-8">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#F8F9FA] border-y border-gray-200">
                          <th className="py-4 px-2 text-left font-bold text-gray-400 uppercase tracking-wider w-10">序号</th>
                          <th className="py-4 px-2 text-left font-bold text-gray-400 uppercase tracking-wider">产品名称</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider w-16">图片</th>
                          <th className="py-4 px-2 text-left font-bold text-gray-400 uppercase tracking-wider w-24">区域</th>
                          <th className="py-4 px-2 text-left font-bold text-gray-400 uppercase tracking-wider">规格 (mm)</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider">数量</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider">单位</th>
                          <th className="py-4 px-2 text-right font-bold text-gray-400 uppercase tracking-wider">单价 (元)</th>
                          <th className="py-4 px-2 text-right font-bold text-gray-400 uppercase tracking-wider">合计 (元)</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider">备注</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider">HS编码</th>
                          <th className="py-4 px-2 text-center font-bold text-gray-400 uppercase tracking-wider">装箱号</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {cart.map((item, idx) => (
                          <tr key={item.cartId} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-2 text-gray-500">{idx + 1}</td>
                            <td className="py-4 px-2 font-bold text-gray-900">{item.name}</td>
                            <td className="py-4 px-2">
                              <div className="w-12 h-12 rounded overflow-hidden border border-gray-100 mx-auto">
                                <img src={item.imageUrl} loading="lazy" className="w-full h-full object-cover grayscale" alt="" referrerPolicy="no-referrer" />
                              </div>
                            </td>
                            <td className="py-4 px-2 text-gray-600">{item.selectedArea || item.materialArea || item.category}</td>
                            <td className="py-4 px-2 text-gray-600">{item.selectedSpec || item.specs}</td>
                            <td className="py-4 px-2 text-center font-bold">{item.quantity}</td>
                            <td className="py-4 px-2 text-center text-gray-500">{item.unit}</td>
                            <td className="py-4 px-2 text-right text-gray-600">{item.basePrice.toFixed(2)}</td>
                            <td className="py-4 px-2 text-right font-bold text-gray-900">{(item.basePrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="py-4 px-2 text-center text-gray-300">-</td>
                            <td className="py-4 px-2 text-center text-gray-500">{item.hsCode}</td>
                            <td className="py-4 px-2 text-center font-medium text-gray-600">{item.packingNo || '-'}</td>
                          </tr>
                        ))}
                        {/* Summary Row */}
                        <tr className="bg-gray-50/50">
                          <td colSpan={9} className="py-6 px-4 text-right">
                            <span className="text-lg font-bold text-gray-900 uppercase tracking-tighter">合计 GRAND TOTAL</span>
                          </td>
                          <td className="py-6 px-2 text-right">
                            <span className="text-xl font-black text-[#E1251B]">¥{totalCNY.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Special Instructions */}
                  <div className="bg-[#F8F9FA] rounded-xl p-8 mb-12 border border-gray-100">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">特别说明 (SPECIAL INSTRUCTIONS)</h3>
                    <div className="space-y-3">
                      {(projectHeader.notes || '').split('\n').map((note, i) => (
                        <div key={i} className="flex gap-3 text-xs leading-relaxed">
                          <span className="font-black text-[#E1251B] shrink-0">{i + 1}.</span>
                          <p className="text-gray-600 font-medium">{note.replace(/^\d+[.、]\s*/, '')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-end pt-8 border-t border-gray-100 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <div>
                      <p>© {new Date().getFullYear()} Construction Supply Chain Management System</p>
                      <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p>RENLI YESHENG GLOBAL INFRASTRUCTURE</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl relative animate-in zoom-in duration-300 border border-black">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors">
              <X size={24} />
            </button>
            <div className="mb-8">
              <h2 className="text-2xl font-black uppercase tracking-tighter">Add New Material</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manual Entry System</p>
            </div>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="space-y-1 col-span-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Product Image & AI Analysis</label>
                <div className="flex gap-4 items-start">
                  <div 
                    onClick={() => document.getElementById('ai-image-upload')?.click()}
                    className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500 transition-all overflow-hidden relative group"
                  >
                    {newMaterial.imageUrl ? (
                      <img src={newMaterial.imageUrl} loading="lazy" className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <>
                        <Plus size={24} className="text-gray-300" />
                        <span className="text-[8px] font-bold text-gray-400 mt-2">Upload Image</span>
                      </>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-[8px] font-bold text-white uppercase">Change</span>
                    </div>
                  </div>
                  <input id="ai-image-upload" type="file" accept="image/*" onChange={handleImageUploadForAI} className="hidden" />
                  
                  <div className="flex-1 space-y-3">
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Upload an image or enter a name, then click the AI button to automatically identify the HS Code.
                    </p>
                    <button 
                      onClick={() => analyzeForHSCode(newMaterial.name || '')}
                      disabled={isAiAnalyzing || !newMaterial.name}
                      className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {isAiAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      AI Identify HS Code
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Material Name</label>
                <input type="text" value={newMaterial.name || ''} onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" placeholder="e.g. 瓦片" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Material ID</label>
                <input type="text" value={newMaterial.id || ''} onChange={(e) => setNewMaterial({...newMaterial, id: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" placeholder="e.g. ZW-005" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">HS Code</label>
                <input type="text" value={newMaterial.hsCode || ''} onChange={(e) => setNewMaterial({...newMaterial, hsCode: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" placeholder="e.g. 6905100000" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Price (CNY)</label>
                <input type="number" value={newMaterial.basePrice || 0} onChange={(e) => setNewMaterial({...newMaterial, basePrice: Number(e.target.value)})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Unit</label>
                <input type="text" value={newMaterial.unit || ''} onChange={(e) => setNewMaterial({...newMaterial, unit: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" placeholder="匹 / 个 / 米" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Category</label>
                <select value={newMaterial.category} onChange={(e) => setNewMaterial({...newMaterial, category: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black">
                  {CATEGORIES.filter(c => c !== '全部').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Specs (mm)</label>
                <input type="text" value={newMaterial.specs || ''} onChange={(e) => setNewMaterial({...newMaterial, specs: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black" placeholder="180*180" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Brand / 品牌</label>
                <select value={newMaterial.brandId || activeBrand} onChange={(e) => setNewMaterial({...newMaterial, brandId: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black">
                  {materialBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Restaurant Brand / 餐饮品牌</label>
                <select value={newMaterial.restaurantBrand || activeRestaurantBrand} onChange={(e) => setNewMaterial({...newMaterial, restaurantBrand: e.target.value})} className="w-full bg-gray-50 border border-black/10 rounded-xl p-4 text-xs font-bold focus:outline-none focus:border-black">
                  {restaurantBrands.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={handleManualAdd} className="w-full bg-black text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-red-600 transition-all">
              Confirm Add Material
            </button>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-black text-[10px] uppercase tracking-widest ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 
              notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {notification.type === 'success' ? <Package size={14} /> : 
             notification.type === 'error' ? <X size={14} /> : <Sparkles size={14} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2rem] p-10 max-w-sm w-full relative z-10 shadow-2xl border border-slate-200"
            >
              <h3 className="text-lg font-black uppercase tracking-tighter mb-4">确认操作 / CONFIRM</h3>
              <p className="text-xs font-bold text-slate-500 mb-8 leading-relaxed">{showConfirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowConfirmModal(null)}
                  className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  取消 / Cancel
                </button>
                <button 
                  onClick={showConfirmModal.onConfirm}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                >
                  确认 / Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BOMGenerator;
