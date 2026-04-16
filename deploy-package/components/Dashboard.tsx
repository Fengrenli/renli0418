
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Bell, Globe, Layout, Filter, MapPin, Maximize2, RotateCw, 
  FileText, Settings, ShieldCheck, Share2, Upload, 
  MessageSquare, Send, Plus, Trash2, Loader2, CheckCircle2, Clock, X, Save, File, Download,
  User as UserIcon, LogOut, LogIn, UserPlus, ChevronDown, Lock, Shield, Sparkles, Monitor,
  ArrowRight, Search, Link as LinkIcon, QrCode, Box, ExternalLink, Eye, LayoutDashboard,
  ShieldAlert, Ruler, Info, FileStack, TrendingUp, CheckCircle, Calendar, FileType, HardHat,
  Image as ImageIcon, Video, FileArchive, FileBox
} from 'lucide-react';
const GlobeVisual = React.lazy(() => import('./GlobeVisual'));
const GlobeThreeScene = React.lazy(() => import('./GlobeThreeScene'));
const AdminPortal = React.lazy(() => import('./AdminPortal'));
const BOMGenerator = React.lazy(() => import('./BOMGenerator'));
const ProjectDetailsView = React.lazy(() => import('./ProjectDetailsView'));
import ManualProjectModal from './ManualProjectModal';
import ErrorBoundary from './ErrorBoundary';
import { getAssetIcon } from './AssetIcon';
import { ProjectLocation, User, UserRole, DigitalAsset } from '../types';
import { parseProjectCoordinates } from '../utils/parseProjectCoordinates';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { fetchAiGeneratedProject, serverAiPayloadToProjectLocation } from '../utils/fetchAiGeneratedProject';
import { hydrateMissingProjectGeocodes } from '../utils/hydrateProjectGeocodes';

// Memoized Project Item：单击仅选中（地球旋转）；双击打开完整明细
const ProjectListItem = React.memo(({ 
  project, 
  isSelected, 
  onSelect,
  onOpenDetails,
}: { 
  project: ProjectLocation, 
  isSelected: boolean, 
  onSelect: () => void,
  onOpenDetails: () => void,
}) => {
  const clickRef = useRef<{
    id: string;
    t: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = String(project.id || '');
    const now = Date.now();
    const prev = clickRef.current;
    if (prev && prev.id === id && now - prev.t < 420) {
      if (prev.timer) clearTimeout(prev.timer);
      clickRef.current = null;
      onOpenDetails();
      return;
    }
    if (prev?.timer) {
      clearTimeout(prev.timer);
      clickRef.current = null;
    }
    clickRef.current = {
      id,
      t: now,
      timer: setTimeout(() => {
        clickRef.current = null;
        onSelect();
      }, 300),
    };
  };

  return (
    <div 
      className={`group p-4 rounded-xl transition-all border ${isSelected ? 'bg-white shadow-md border-gray-200' : 'border-transparent hover:bg-gray-100'}`}
    >
      <h3 
        role="button"
        tabIndex={0}
        title="单击预览地球 · 双击打开详情"
        onClick={handleTitleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        className={`text-sm font-bold truncate cursor-pointer hover:underline ${isSelected ? 'text-[#E1251B]' : 'text-gray-700'}`}
      >{project.name}</h3>
      <div className="flex items-center space-x-1 text-xs text-gray-400 font-medium mb-1 pointer-events-none select-none">
        <MapPin size={10} />
        <span>{project.location}</span>
      </div>
    </div>
  );
});

// 预设的超级管理员凭证 (已弃用，仅保留类型定义)
interface MasterAdmin {
  username: string;
  role: UserRole;
}

interface DashboardProps {
  onBack: () => void;
  projects: ProjectLocation[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectLocation[]>>;
  lang: 'cn' | 'en' | 'de';
}

type SubView = 'dashboard' | 'inProgress' | 'completed' | 'bom';

const Dashboard: React.FC<DashboardProps> = ({ onBack, projects, setProjects, lang }) => {
  const [isAdminPortalOpen, setIsAdminPortalOpen] = useState(false);
  const [activeSubView, setActiveSubView] = useState<SubView>('dashboard');
  
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

  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rl_user');
    return safeJSONParse(saved, null);
  });
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authFormData, setAuthFormData] = useState({ username: '', password: '' });
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [aiStatus, setAiStatus] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveInFlightRef = useRef<Record<string, boolean>>({});
  const pendingProjectRef = useRef<Record<string, ProjectLocation>>({});

  const flushProjectSave = async (projectId: string) => {
    const pendingProject = pendingProjectRef.current[projectId];
    if (!pendingProject || saveInFlightRef.current[projectId]) return;

    // 从当前 projects 数组中获取完整的项目数据，确保包含所有字段
    const currentProject = (Array.isArray(projects) ? projects : []).find(p => p.id === projectId);
    if (!currentProject) {
      console.error('[flushProjectSave] 未找到项目:', projectId);
      delete pendingProjectRef.current[projectId];
      return;
    }

    // 合并 pending 的修改和当前完整数据
    const projectToSave = {
      ...currentProject,
      ...pendingProject,
      // 确保关键字段不会被覆盖为空
      digitalAssets: pendingProject.digitalAssets ?? currentProject.digitalAssets ?? [],
      stages: pendingProject.stages ?? currentProject.stages ?? [],
      teamMembers: pendingProject.teamMembers ?? currentProject.teamMembers ?? [],
      progress: pendingProject.progress ?? currentProject.progress ?? 0,
    };

    console.log('[flushProjectSave] 保存项目:', projectId);
    console.log('[flushProjectSave] digitalAssets 数量:', projectToSave.digitalAssets?.length || 0);
    console.log('[flushProjectSave] stages 数量:', projectToSave.stages?.length || 0);
    console.log('[flushProjectSave] teamMembers 数量:', projectToSave.teamMembers?.length || 0);

    saveInFlightRef.current[projectId] = true;
    try {
      const res = await fetch('/api/save-project-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectToSave)
      });
      const result = await res.json();
      console.log('[flushProjectSave] 保存结果:', result);
      delete pendingProjectRef.current[projectId];
    } catch (error) {
      console.error('[flushProjectSave] 保存失败:', error);
    } finally {
      saveInFlightRef.current[projectId] = false;
      if (pendingProjectRef.current[projectId]) {
        // 若请求期间又有新修改，立即再冲一次，确保最终一致
        void flushProjectSave(projectId);
      }
    }
  };

  // Load projects from server
  const fetchProjects = async () => {
    try {
      setFetchError(null);
      console.log('Fetching projects from /api/projects...');
      
      // 构建请求URL，根据用户的品牌信息添加过滤参数
      let url = '/api/projects';
      if (user && user.brand_id && user.role?.toLowerCase() !== 'admin') {
        url += `?brand_id=${encodeURIComponent(user.brand_id)}`;
      }
      
      const response = await fetchWithTimeout(url, { timeoutMs: 45000 });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      console.log('Projects fetch result (Dashboard):', result);
      if (result.success === false) {
        throw new Error(result.msg || '项目列表接口返回失败');
      }
      const data = Array.isArray(result.data) ? result.data : [];
      // Normalize data（含空数组，避免「有数据却未 setState」或接口变空后界面不刷新）
        const normalized = data.map((p: any) => {
          const coords = parseProjectCoordinates(p.coordinates);
          
          // Normalize status to Chinese (case-insensitive and handling variations)
          let status = (p.status || '').toString().trim();
          const statusMap: Record<string, string> = {
            'planning': '待启动',
            '待启动': '待启动',
            'in progress': '进行中',
            '进行中': '进行中',
            'completed': '已完成',
            '已完成': '已完成',
            'maintenance': '维护中',
            '维护中': '维护中',
            'pending': '待处理',
            '待处理': '待处理',
            'done': '已完成'
          };
          
          // Check for matches (case-insensitive)
          const lowerStatus = status.toLowerCase();
          let normalizedStatus = '待处理'; // Default
          
          for (const [key, value] of Object.entries(statusMap)) {
            if (lowerStatus.includes(key)) {
              normalizedStatus = value;
              break;
            }
          }
          status = normalizedStatus;

        // Normalize stages + derive project status from child sub-steps
          const rawStages = Array.isArray(p.stages) ? p.stages : [];
          const stages = rawStages.map((s: any, sIdx: number) => {
            const sStatus = (s.status || '').toLowerCase();
            let normalizedSStatus = s.status;
            for (const [key, value] of Object.entries(statusMap)) {
              if (sStatus.includes(key.toLowerCase())) {
                normalizedSStatus = value;
                break;
              }
            }

            const rawSubSteps = Array.isArray(s.subSteps) ? s.subSteps : [];
            const subSteps = rawSubSteps.map((sub: any, subIdx: number) => {
              const raw = (sub.status || '').toLowerCase();
              let normalizedSubStatus = sub.status;
              for (const [key, value] of Object.entries(statusMap)) {
                if (raw.includes(key.toLowerCase())) {
                  normalizedSubStatus = value;
                  break;
                }
              }
              return {
                id: sub.id || `sub-${sIdx}-${subIdx}`,
                ...sub,
                status: normalizedSubStatus,
              };
            });

            // 如果该阶段所有子阶段都已完成，则强制阶段为已完成
            const allSubStepsCompleted =
              subSteps.length > 0 && subSteps.every(sub => sub.status === '已完成');
            const finalStageStatus = allSubStepsCompleted ? '已完成' : normalizedSStatus;
            
            return {
              id: s.id || `stage-${sIdx}`,
              ...s,
              status: finalStageStatus,
              subSteps,
            };
          });

          // 若存在阶段信息，则统一由阶段/子阶段推导项目状态
          if (stages.length > 0) {
            const allSubsCompleted =
              stages.every(stage => {
                const subs = Array.isArray(stage.subSteps) ? stage.subSteps : [];
                if (subs.length === 0) return stage.status === '已完成';
                return subs.every((sub: any) => sub.status === '已完成');
              });

            const anySubActive =
              stages.some(stage => {
                const subs = Array.isArray(stage.subSteps) ? stage.subSteps : [];
                const stageActive =
                  stage.status === '进行中' || stage.status === '已完成';
                const subActive = subs.some(
                  (sub: any) => sub.status === '进行中' || sub.status === '已完成',
                );
                return stageActive || subActive;
              });

            if (allSubsCompleted) {
              status = '已完成';
            } else if (anySubActive) {
              // 只要任意子阶段已经开始，就视为进行中
              status = '进行中';
            } else {
              status = '待启动';
            }
          }

          // Normalize digital assets
          const rawAssets = Array.isArray(p.digital_assets || p.digitalAssets) ? (p.digital_assets || p.digitalAssets) : [];
          const digitalAssets = rawAssets
            .filter((asset: any) => asset != null && typeof asset === 'object' && asset.url)
            .map((asset: any, aIdx: number) => ({
              id: asset.id || `asset-${aIdx}`,
              name: asset.name || 'Untitled Asset',
              type: asset.type || 'link',
              url: asset.url || '#',
              size: asset.size,
              uploadDate: asset.uploadDate || new Date().toISOString()
            }));

          return {
            ...p,
            coordinates: coords,
            status: status,
            stages: stages,
            digitalAssets: digitalAssets,
            feishuDeptId: p.feishuDeptId || p.feishu_dept_id || '',
            brandId: p.brandId ?? p.brand_id,
            teamMembers: Array.isArray(p.teamMembers || p.team_members) ? (p.teamMembers || p.team_members) : [],
            feishuExcludedMemberIds: Array.isArray(p.feishuExcludedMemberIds || p.feishu_excluded_member_ids) ? (p.feishuExcludedMemberIds || p.feishu_excluded_member_ids) : [],
          };
        });
        setProjects(normalized);
        void (async () => {
          try {
            const patches = await hydrateMissingProjectGeocodes(normalized);
            if (patches.size === 0) return;
            setProjects((prev) =>
              prev.map((p) => {
                const c = patches.get(p.id);
                if (!c) return p;
                return {
                  ...p,
                  coordinates: c.coordinates,
                  ...(c.city ? { city: c.city } : {}),
                  ...(c.country ? { country: c.country } : {}),
                };
              }),
            );
          } catch {
            /* 补全失败不影响主列表 */
          }
        })();
    } catch (error: any) {
      console.error('Failed to fetch projects (Dashboard):', error.message || error);
      setFetchError(lang === 'cn' ? '项目数据加载失败，请检查网络连接。' : 'Failed to load project data. Please check your connection.');
      setProjects([]);
    }
  };

  const [selectedId, setSelectedId] = useState('');
  
  useEffect(() => {
    if (!selectedId && Array.isArray(projects) && projects.length > 0) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  // 当用户登录状态变化时，重新获取项目列表
  useEffect(() => {
    fetchProjects();
  }, [user, lang]);

  useEffect(() => {
    const handleOpenDetails = (e: any) => {
      const project = e.detail;
      setSelectedId(project.id);
      setSelectedProjectForDetails(project);
    };
    window.addEventListener('open-project-details', handleOpenDetails);
    return () => window.removeEventListener('open-project-details', handleOpenDetails);
  }, []);

  const [showDetails, setShowDetails] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<ProjectLocation | null>(null);

  const handleProjectSelectOnly = useCallback((project: ProjectLocation) => {
    setSelectedId(project.id);
    setSelectedProjectForDetails(null);
  }, []);

  const handleProjectOpenDetails = useCallback((project: ProjectLocation) => {
    setSelectedId(project.id);
    setSelectedProjectForDetails(project);
  }, []);

  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualProjData, setManualProjData] = useState<Partial<ProjectLocation>>({
    name: '',
    location: '',
    coordinates: [0, 0],
    status: '待启动',
    area: '',
    description: '',
    clientName: '',
    projectType: '',
    region: '',
    country: '',
    city: ''
  });

  const handleManualAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newProj: ProjectLocation = {
      ...manualProjData as ProjectLocation,
      id: `proj-${Date.now()}`,
      brandId: user?.brand_id || undefined,
      digitalAssets: [],
      progress: 0,
      createdAt: new Date().toISOString().split('T')[0],
      stages: [
        { id: 'design', name: '设计阶段', status: '未开始', subSteps: [
          { id: 'd1', name: '需求分析', status: '未开始' },
          { id: 'd2', name: '方案设计', status: '未开始' },
          { id: 'd3', name: '施工图设计', status: '未开始' },
          { id: 'd4', name: '设计确认', status: '未开始' }
        ]},
        { id: 'procurement', name: '采购阶段', status: '未开始', subSteps: [
          { id: 'p1', name: '材料清单', status: '未开始' },
          { id: 'p2', name: '供应商选择', status: '未开始' },
          { id: 'p3', name: '采购订单', status: '未开始' },
          { id: 'p4', name: '材料验收', status: '未开始' }
        ]},
        { id: 'logistics', name: '物流阶段', status: '未开始', subSteps: [
          { id: 'l1', name: '物流规划', status: '未开始' },
          { id: 'l2', name: '货物打包', status: '未开始' },
          { id: 'l3', name: '国际运输', status: '未开始' },
          { id: 'l4', name: '清关', status: '未开始' },
          { id: 'l5', name: '国内配送', status: '未开始' }
        ]},
        { id: 'installation', name: '安装阶段', status: '未开始', subSteps: [
          { id: 'i1', name: '现场准备', status: '未开始' },
          { id: 'i2', name: '基础施工', status: '未开始' },
          { id: 'i3', name: '设备安装', status: '未开始' },
          { id: 'i4', name: '调试', status: '未开始' },
          { id: 'i5', name: '验收', status: '未开始' }
        ]},
        { id: 'operation', name: '正式营业', status: '未开始', subSteps: [
          { id: 'o1', name: '开业准备', status: '未开始' },
          { id: 'o2', name: '正式开业', status: '未开始' }
        ]}
      ]
    };

    try {
      const response = await fetch('/api/save-project-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProj)
      });
      const result = await response.json();
      if (result.code === 0 || result.code === 200) {
        setProjects(prev => [newProj, ...(Array.isArray(prev) ? prev : [])]);
        setShowManualAddModal(false);
        setManualProjData({
          name: '',
          location: '',
          coordinates: [0, 0],
          status: '待启动',
          area: '',
          description: '',
          clientName: '',
          projectType: '',
          region: '',
          country: '',
          city: ''
        });
        setAiStatus({ message: lang === 'cn' ? "项目已保存至数据库" : "Project saved to database", type: 'success' });
      } else {
        setAiStatus({ message: result.msg || "保存失败", type: 'error' });
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      setAiStatus({ message: "网络错误", type: 'error' });
    }
    setTimeout(() => setAiStatus(null), 3000);
  };

  const handleUpdateProjectDetails = async (projectId: string, field: keyof ProjectLocation, value: any) => {
    setProjects(prevProjects => {
      const updatedProjects = (Array.isArray(prevProjects) ? prevProjects : []).map(p => {
        if (p.id !== projectId) return p;

        // 🚀 核心改进：深度合并变更，确保不丢失其他字段
        const nextProject: any = { ...p, [field]: value };

        // 当阶段变化时，统一推导项目状态与进度
        if (field === 'stages' && Array.isArray(value)) {
          const stageStatusToChinese = (status: any) => {
            if (status === 'completed' || status === '已完成') return '已完成';
            if (status === 'inProgress' || status === '进行中') return '进行中';
            return '未开始';
          };

          const normalizedStages = value.map((s: any) => {
            const rawSubSteps = Array.isArray(s?.subSteps) ? s.subSteps : [];
            const subSteps = rawSubSteps.map((sub: any) => ({
              ...sub,
              status: stageStatusToChinese(sub?.status),
              title: sub?.title || sub?.name,
            }));

            const allSubCompleted =
              subSteps.length > 0 && subSteps.every(sub => sub.status === '已完成');

            return {
              ...s,
              status: allSubCompleted ? '已完成' : stageStatusToChinese(s?.status),
              subSteps,
            };
          });

          const anySubActive = normalizedStages.some((stage: any) =>
            (Array.isArray(stage.subSteps) ? stage.subSteps : []).some(
              (sub: any) => sub.status === '进行中' || sub.status === '已完成',
            ),
          );
          const completedCount = normalizedStages.filter((s: any) => s.status === '已完成').length;
          const total = normalizedStages.length || 1;
          
          nextProject.stages = normalizedStages;
          nextProject.progress = Math.round((completedCount / total) * 100);
          
          if (completedCount === total && total > 0) {
            nextProject.status = '已完成';
          } else if (anySubActive) {
            nextProject.status = '进行中';
          } else {
            nextProject.status = '待启动';
          }
        }

        return nextProject;
      });

      // 同时也更新当前选中的详情项目，保持引用最新
      const currentSelected = updatedProjects.find(p => p.id === projectId);
      if (currentSelected && selectedProjectForDetails?.id === projectId) {
        // 使用微任务或延时确保在 render 循环外触发
        setTimeout(() => setSelectedProjectForDetails(currentSelected), 0);
      }
      
      // 更新待保存引用
      if (currentSelected) {
        pendingProjectRef.current[projectId] = currentSelected;
        
        // 防抖保存
        if (saveTimersRef.current[projectId]) {
          clearTimeout(saveTimersRef.current[projectId]);
        }
        saveTimersRef.current[projectId] = setTimeout(() => {
          void flushProjectSave(projectId);
        }, 500); // 稍微加长防抖时间，确保合并多次微调
      }

      return updatedProjects;
    });
  };

  const content = {
    cn: {
      dashTitle: "全球项目看板",
      navDashboard: "仪表盘",
      navInProgress: "进行中",
      navCompleted: "已完成",
      listTitle: "项目列表",
      searchPlaceholder: "搜索项目名称或地点...",
      total: "总计",
      login: "管理员登录",
      register: "注册",
      logout: "退出登录",
      notLogged: "未登录",
      guest: "普通客户",
      admin: "系统管理员",
      details: "项目详情",
      description: "项目描述",
      area: "建筑面积",
      status: "当前状态",
      location: "项目选址",
      delivery: "数字化资产 / 图纸",
      noAssets: "暂无数字化图纸资产",
      adminPortal: "管理后台",
      authError: "认证失败：用户名或密码错误",
      authSuccess: "认证成功：欢迎回来",
      authenticating: "正在通过安全网关验证...",
      aiPlaceholder: "描述新项目（例如：在柏林增加一个200平米的旗舰店）",
      aiAssistant: "AI 智慧助理",
      loginToUse: "登录管理员账号解锁 AI 助理",
      testAccount: "管理员凭证: admin / Renli2026",
      inProgress: "进行中项目",
      completed: "已完成项目",
      planning: "待启动项目",
      navBOM: "BOM表单定制",
      viewFiles: "查看文件",
      completionTime: "完成时间",
      intro: "项目介绍",
      size: "大小",
      date: "日期"
    },
    en: {
      dashTitle: "Global Dashboard",
      navDashboard: "Dashboard",
      navInProgress: "In Progress",
      navCompleted: "Completed",
      listTitle: "Project List",
      searchPlaceholder: "Search projects...",
      total: "Total",
      login: "Admin Login",
      register: "Register",
      logout: "Logout",
      notLogged: "Guest",
      guest: "Client",
      admin: "Admin",
      details: "Details",
      description: "Description",
      area: "Area",
      status: "Status",
      location: "Location",
      delivery: "Digital Assets",
      noAssets: "No assets found",
      adminPortal: "Admin Portal",
      authError: "Auth Failed: Invalid credentials",
      authSuccess: "Welcome back, Admin",
      authenticating: "Authenticating...",
      aiPlaceholder: "Describe new project (e.g. Add a 200m² store in Berlin)",
      aiAssistant: "AI Assistant",
      loginToUse: "Login as Admin to unlock",
      testAccount: "Admin Demo: admin / Renli2026",
      inProgress: "In Progress",
      completed: "Completed",
      planning: "Planning",
      navBOM: "BOM Customization",
      viewFiles: "View Files",
      completionTime: "Completed Date",
      intro: "Introduction",
      size: "Size",
      date: "Date"
    }
  }[lang === 'de' ? 'en' : lang];

  useEffect(() => {
    if (user) localStorage.setItem('rl_user', JSON.stringify(user));
    else localStorage.removeItem('rl_user');
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Get the user menu container by looking for the avatar or user icon
      const userMenuContainer = document.querySelector('div.relative');
      // Get the dropdown itself
      const dropdown = document.querySelector('div.absolute.right-0.top-full.w-48');
      
      // If dropdown is open and click is outside both container and dropdown
      if (showUserDropdown && dropdown && userMenuContainer) {
        const target = event.target as Node;
        if (!userMenuContainer.contains(target) && !dropdown.contains(target)) {
          setShowUserDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthProcessing) return;

    const { username, password } = authFormData;
    if (!username || !password) return;
    
    setIsAuthProcessing(true);
    setAiStatus({ message: content.authenticating, type: 'info' });

    try {
      const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
      const response = await fetch(endpoint, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const result = await response.json();
      
      if (response.ok && (result.code === 0 || result.code === 200)) {
        const userData = result.user || { username: result.username, role: result.role, brand_id: result.brand_id, brand_name: result.brand_name };
        setUser(userData);
        localStorage.setItem('rl_user', JSON.stringify(userData));
        setAiStatus({ message: result.msg || content.authSuccess, type: 'success' });
        setTimeout(() => {
          setShowAuthModal(false);
          setAiStatus(null);
          setIsAuthProcessing(false);
          // 登录成功后根据角色决定是否打开管理员后台
          if (userData.role?.toLowerCase() === 'admin') {
            setIsAdminPortalOpen(true);
          } else {
            // 品牌客户登录后刷新项目列表
            fetchProjects();
          }
        }, 1000);
      } else {
        setAiStatus({ message: result.msg || content.authError, type: 'error' });
        setIsAuthProcessing(false);
        setTimeout(() => setAiStatus(null), 3000);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setAiStatus({ message: '网络错误，请稍后重试', type: 'error' });
      setIsAuthProcessing(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setShowUserDropdown(false);
    setIsAdminPortalOpen(false);
  };

  const handleAISubmit = async () => {
    if (!isAdmin) {
      setShowAuthModal(true);
      return;
    }
    if (!aiPrompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setAiStatus({ message: lang === 'cn' ? "正在分析地理位置与规模..." : "Analyzing location and scale...", type: 'info' });
    try {
      const { data, geocodeWarning } = await fetchAiGeneratedProject(aiPrompt);
      const newProjAI = serverAiPayloadToProjectLocation(data);
      setProjects((prev) => [newProjAI, ...(Array.isArray(prev) ? prev : [])]);
      setSelectedId(newProjAI.id);
      setAiPrompt('');
      void (async () => {
        try {
          const patches = await hydrateMissingProjectGeocodes([newProjAI]);
          if (patches.size === 0) return;
          setProjects((prev) =>
            prev.map((p) => {
              const c = patches.get(p.id);
              if (!c) return p;
              return {
                ...p,
                coordinates: c.coordinates,
                ...(c.city ? { city: c.city } : {}),
                ...(c.country ? { country: c.country } : {}),
              };
            }),
          );
        } catch {
          /* 单条补全失败可忽略 */
        }
      })();
      const baseOk =
        lang === 'cn' ? '解析成功！已添加至全球看板' : 'Success! Project added';
      const warn =
        geocodeWarning &&
        (lang === 'cn'
          ? `（主链路地理编码未命中，已根据地址尝试二次解析：${geocodeWarning}）`
          : ` (Geocode note: ${geocodeWarning})`);
      setAiStatus({
        message: warn ? `${baseOk}${warn}` : baseOk,
        type: geocodeWarning ? 'info' : 'success',
      });
    } catch (err) {
      console.error('AI project creation failed:', err);
      setAiStatus({ message: lang === 'cn' ? "AI 服务暂时不可用，请使用手动添加项目" : "AI service unavailable, use manual add", type: 'info' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const filteredProjects = useMemo(() => (Array.isArray(projects) ? projects : []).filter(p => 
    (p.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
    (p.location || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  ), [projects, searchQuery]);

  const inProgressProjects = useMemo(() => filteredProjects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s === '进行中' || s === '维护中' || s.includes('progress') || s.includes('maintenance');
  }), [filteredProjects]);
  
  const completedProjects = useMemo(() => filteredProjects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s === '已完成' || s.includes('completed') || s.includes('done');
  }), [filteredProjects]);
  
  const planningProjects = useMemo(() => filteredProjects.filter(p => {
    const s = (p.status || '').toLowerCase();
    return s === '待启动' || s.includes('planning') || s.includes('规划');
  }), [filteredProjects]);
  
  const otherProjects = useMemo(() => filteredProjects.filter(p => {
    const s = (p.status || '').toLowerCase();
    const isKnown = s === '进行中' || s === '维护中' || s.includes('progress') || s.includes('maintenance') ||
                    s === '已完成' || s.includes('completed') || s.includes('done') ||
                    s === '待启动' || s.includes('planning') || s.includes('规划');
    return !isKnown;
  }), [filteredProjects]);

  const selectedProject = useMemo(() => (Array.isArray(projects) ? projects : []).find(p => p.id === selectedId), [projects, selectedId]);

  if (isAdminPortalOpen && isAdmin) {
    return (
      <React.Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-[#E1251B]" /></div>}>
        <AdminPortal projects={projects} setProjects={setProjects} onBack={() => setIsAdminPortalOpen(false)} lang={lang} />
      </React.Suspense>
    );
  }

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden font-sans text-gray-800">
      {/* Auth Modal 省略相同部分... */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isAuthProcessing && setShowAuthModal(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative animate-in fade-in zoom-in duration-300">
            {!isAuthProcessing && (
              <button type="button" onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-black transition-colors" aria-label="Close">
                <X size={24} />
              </button>
            )}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#E1251B] rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl shadow-red-500/20">
                {isAuthProcessing ? <Loader2 size={32} className="animate-spin" /> : (authMode === 'login' ? <LogIn size={32} /> : <UserPlus size={32} />)}
              </div>
              <h2 className="text-2xl font-black">{isAuthProcessing ? content.authenticating : (authMode === 'login' ? content.login : content.register)}</h2>
            </div>
            {aiStatus && aiStatus.type !== 'info' && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${aiStatus.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {aiStatus.type === 'error' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
                <span className="text-xs font-bold uppercase tracking-tighter">{aiStatus.message}</span>
              </div>
            )}
            <form onSubmit={handleAuth} className={`space-y-5 ${isAuthProcessing ? 'opacity-30 pointer-events-none' : ''}`}>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="text" required value={authFormData.username} onChange={(e) => setAuthFormData({...authFormData, username: e.target.value})} placeholder="Username" className="w-full bg-gray-50 border border-gray-100 rounded-xl py-4 pl-12 pr-4 font-bold text-sm focus:outline-none focus:border-[#E1251B]" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input type="password" required value={authFormData.password} onChange={(e) => setAuthFormData({...authFormData, password: e.target.value})} placeholder="••••••••" className="w-full bg-gray-50 border border-gray-100 rounded-xl py-4 pl-12 pr-4 font-bold text-sm focus:outline-none focus:border-[#E1251B]" />
                </div>
              </div>
              <button type="submit" className="w-full bg-black text-white py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-[#E1251B] transition-all">
                {isAuthProcessing ? <Loader2 size={16} className="animate-spin mx-auto" /> : (authMode === 'login' ? content.login : content.register)}
              </button>
            </form>
          </div>
        </div>
      )}

      <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0 z-50">
        <div className="flex items-center space-x-6 w-1/4">
          <div className="flex flex-col items-start cursor-pointer" onClick={onBack}>
            <div className="flex items-center space-x-1">
              <div className="w-6 h-6 bg-[#E1251B] rounded flex items-center justify-center text-white font-bold text-xs">R</div>
              <span className="text-base font-extrabold text-[#1A1A1A]">Renli Yesheng</span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex justify-center overflow-x-auto no-scrollbar px-4">
          <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100 min-w-max">
            <button
              type="button"
              onClick={() => setActiveSubView('dashboard')}
              className={`flex items-center gap-2 px-3 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeSubView === 'dashboard' ? 'bg-white text-[#E1251B] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Globe size={14} />
              <span>{content.navDashboard}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('inProgress')}
              className={`flex items-center gap-2 px-3 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeSubView === 'inProgress' ? 'bg-white text-[#E1251B] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <TrendingUp size={14} />
              <span>{content.navInProgress}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('completed')}
              className={`flex items-center gap-2 px-3 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeSubView === 'completed' ? 'bg-white text-[#E1251B] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <CheckCircle size={14} />
              <span>{content.navCompleted}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('bom')}
              className={`flex items-center gap-2 px-3 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${activeSubView === 'bom' ? 'bg-white text-[#E1251B] shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <FileStack size={14} />
              <span>{content.navBOM}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4 w-1/4">
          {isAdmin && (
            <button type="button" onClick={() => setIsAdminPortalOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-black text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-[#E1251B] shadow-lg">
              <LayoutDashboard size={14} /><span>{content.adminPortal}</span>
            </button>
          )}
          <div className="relative z-[10000]">
            <button type="button" onClick={() => user ? setShowUserDropdown(!showUserDropdown) : setShowAuthModal(true)} className="flex items-center space-x-2 p-1 pl-2 hover:bg-gray-50 rounded-full border border-transparent hover:border-gray-100" aria-expanded={showUserDropdown} aria-haspopup="true">
              <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                {user ? <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-600 text-white text-xs font-bold uppercase">{(user.username || '?')[0]}</span> : <UserIcon size={16} className="text-gray-300" />}
              </div>
            </button>
            {showUserDropdown && user && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl py-2 z-[10000]">
                <button type="button" onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left">
                  <LogOut size={16} /><span>{content.logout}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row overflow-hidden relative">
        {activeSubView !== 'bom' && (
          <aside className={`w-full md:w-72 border-r border-gray-100 flex-col shrink-0 bg-[#FCFCFC] transition-all duration-300 ${
            activeSubView === 'dashboard' ? 'flex h-[40vh] md:h-full' : 'flex flex-1 h-full md:h-full'
          }`}>
            <div className="p-5 border-b border-gray-100 space-y-4">
              <h2 className="text-xs font-black text-gray-800 tracking-wider uppercase mb-1">{content.listTitle} ({filteredProjects.length})</h2>
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={content.searchPlaceholder} className="w-full bg-white border border-gray-100 rounded-xl py-2.5 pl-9 pr-3 text-[11px] font-bold focus:outline-none focus:border-[#E1251B]" />
              </div>
            </div>
            <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto md:overflow-x-hidden snap-x snap-mandatory md:snap-none hide-scrollbar p-3 gap-4 md:gap-2 md:space-y-6">
                {(activeSubView === 'dashboard' || activeSubView === 'inProgress') && planningProjects.length > 0 && (
                   <div className="space-y-2">
                     <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-2">
                       <Clock size={12} /><span>{content.planning}</span>
                     </div>
                     {planningProjects.map(project => (
                       <ProjectListItem 
                         key={project.id}
                         project={project}
                         isSelected={selectedId === project.id}
                         onSelect={() => handleProjectSelectOnly(project)}
                         onOpenDetails={() => handleProjectOpenDetails(project)}
                       />
                     ))}
                   </div>
                )}
                {(activeSubView === 'dashboard' || activeSubView === 'inProgress') && inProgressProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#E1251B] mb-2">
                      <TrendingUp size={12} /><span>{content.inProgress}</span>
                    </div>
                    {inProgressProjects.map(project => (
                      <ProjectListItem 
                        key={project.id}
                        project={project}
                        isSelected={selectedId === project.id}
                        onSelect={() => handleProjectSelectOnly(project)}
                        onOpenDetails={() => handleProjectOpenDetails(project)}
                      />
                    ))}
                  </div>
               )}
               {(activeSubView === 'dashboard' || activeSubView === 'completed') && completedProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-2">
                      <CheckCircle size={12} /><span>{content.completed}</span>
                    </div>
                    {completedProjects.map(project => (
                      <ProjectListItem 
                        key={project.id}
                        project={project}
                        isSelected={selectedId === project.id}
                        onSelect={() => handleProjectSelectOnly(project)}
                        onOpenDetails={() => handleProjectOpenDetails(project)}
                      />
                    ))}
                  </div>
               )}
               {activeSubView === 'dashboard' && otherProjects.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      <Info size={12} /><span>其他项目 / Others</span>
                    </div>
                    {otherProjects.map(project => (
                      <ProjectListItem 
                        key={project.id}
                        project={project}
                        isSelected={selectedId === project.id}
                        onSelect={() => handleProjectSelectOnly(project)}
                        onOpenDetails={() => handleProjectOpenDetails(project)}
                      />
                    ))}
                  </div>
               )}
            </div>
          </aside>
        )}

          <main className={`flex-1 relative bg-white flex-col overflow-hidden transition-all duration-300 ${
            (activeSubView === 'inProgress' || activeSubView === 'completed') ? 'hidden md:flex' : 'flex'
          }`}>
            {activeSubView === 'dashboard' && (
              <>
                <React.Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E1251B]" /></div>}>
                  <>
                    <GlobeVisual
                      interactive
                      lang={lang}
                      projects={projects}
                      projectionType={viewMode}
                      onProjectionChange={setViewMode}
                      centerCoordinates={selectedProject?.coordinates ?? null}
                      markersMode="selected-only"
                      selectedProjectId={selectedId}
                      onMarkerSelect={handleProjectSelectOnly}
                      onMarkerOpenDetails={handleProjectOpenDetails}
                    />
                    {/* 占位：保证 GlobeThreeScene 符号与 chunk 存在，避免浏览器缓存旧 Dashboard 时出现 ReferenceError；不展示 UI */}
                    <div hidden aria-hidden>
                      <React.Suspense fallback={null}>
                        <GlobeThreeScene projects={projects} />
                      </React.Suspense>
                    </div>
                  </>
                </React.Suspense>
                
                {/* 3D / 2D 地球视图切换 */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex bg-white/70 backdrop-blur-2xl p-1.5 rounded-full border border-gray-100 shadow-2xl shadow-black/5">
                  <button
                    type="button"
                    onClick={() => setViewMode('3d')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${viewMode === '3d' ? 'bg-[#E1251B] text-white shadow-xl' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Globe size={16} /> 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('2d')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all ${viewMode === '2d' ? 'bg-[#E1251B] text-white shadow-xl' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Layout size={16} /> 2D
                  </button>
                </div>

                {selectedProject && showDetails && (
                  <div className="fixed inset-0 md:absolute md:right-6 md:top-6 md:bottom-32 md:w-96 z-[9999] md:z-40 flex flex-col animate-in slide-in-from-right-10 duration-500 bg-white md:bg-transparent">
                    <div className="flex-1 bg-white md:bg-white/95 md:backdrop-blur-2xl border-none md:border md:border-gray-100 md:shadow-2xl md:rounded-[2.5rem] p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
                      <div className="flex justify-between items-center mb-6">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          (selectedProject.status === '进行中' || selectedProject.status === '待启动') ? 'bg-red-50 text-[#E1251B]' : 
                          selectedProject.status === '已完成' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
                        }`}>{selectedProject.status}</div>
                        <button type="button" onClick={() => setShowDetails(false)} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-600 transition-colors shadow-sm" aria-label="Close details"><X size={20} /></button>
                      </div>
                    <h2 className="text-3xl font-black text-[#1A1A1A] mb-2 leading-tight">{selectedProject.name}</h2>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-8"><MapPin size={14} className="text-[#E1251B]" />{selectedProject.location}</div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1"><Ruler size={12} className="text-[#E1251B]" />{content.area}</div>
                        <div className="text-lg font-black text-gray-900">{selectedProject.area || '--'}</div>
                      </div>
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1"><Calendar size={12} className="text-[#E1251B]" />{content.date}</div>
                        <div className="text-xs font-black text-gray-900 truncate">{selectedProject.completionDate || '--'}</div>
                      </div>
                    </div>

                    <div className="space-y-8 flex-1">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-3">{content.description}</h4>
                        <p className="text-sm font-medium text-gray-600 leading-relaxed">{selectedProject.description}</p>
                      </div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">{content.delivery}</h4>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setSelectedProjectForDetails(selectedProject)}
                            className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                          >
                            <Upload size={10} /> Upload
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        {(selectedProject.digitalAssets || []).length > 0 ? (
                          (selectedProject.digitalAssets || []).map((asset, idx) => (
                            <a key={asset.id || `asset-${idx}`} href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-white border border-transparent hover:border-gray-100 hover:shadow-xl transition-all group/asset">
                              <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm group-hover/asset:bg-red-600 group-hover/asset:text-white transition-all">{getAssetIcon(asset.type)}</div>
                                <div>
                                  <p className="text-[11px] font-bold text-gray-900 tracking-wide mb-1 truncate" title={asset.name}>{asset.name}</p>
                                  <span className="text-[10px] font-bold text-gray-400 tracking-tight">{asset.size || asset.type} • {asset.uploadDate}</span>
                                </div>
                              </div>
                              <Download size={14} className="text-gray-300 group-hover/asset:text-red-600 transition-colors" />
                            </a>
                          ))
                        ) : (
                          <div className="p-8 border-2 border-dashed border-gray-100 rounded-[2rem] flex flex-col items-center justify-center text-center gap-3">
                            <FileStack size={32} className="text-gray-200" />
                            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{content.noAssets}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeSubView === 'inProgress' && (
            <div className="p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
              <div className="max-w-6xl mx-auto space-y-10">
                <div className="flex items-center justify-between">
                   <div>
                     <h2 className="text-3xl font-bold tracking-tight text-[#1D1D1F] mb-2">{content.navInProgress}</h2>
                     <p className="text-sm text-[#86868B] font-normal leading-relaxed">Global Construction Real-time Assets Pool</p>
                   </div>
                   <div className="p-3 bg-red-50 text-[#E1251B] rounded-2xl shadow-xl shadow-red-500/10"><HardHat size={32} /></div>
                </div>

                <div className="flex md:grid md:grid-cols-2 gap-6 md:gap-8 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none hide-scrollbar pb-4 md:pb-0 -mx-5 px-5 md:mx-0 md:px-0">
                  {inProgressProjects.map(proj => (
                    <div 
                      key={proj.id} 
                      onClick={() => {
                        setSelectedId(proj.id);
                        setSelectedProjectForDetails(proj);
                      }} 
                      className={`snap-center shrink-0 w-[85vw] md:w-auto md:shrink bg-white border rounded-3xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-200 active:scale-[0.97] cursor-pointer ${selectedId === proj.id ? 'border-[#E1251B] ring-2 ring-[#E1251B]/10' : 'border-gray-100/80'}`}
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-xl font-black text-gray-900 mb-1 leading-tight">{proj.name}</h3>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1"><MapPin size={12} /> {proj.location}</p>
                        </div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider bg-red-50 text-[#E1251B] px-3 py-1 rounded-full">Constructing</div>
                      </div>
                      
                      <div className="space-y-3">
                        {(proj.digitalAssets || []).length > 0 ? (
                          (proj.digitalAssets || []).slice(0, 2).map((asset, idx) => (
                             <div key={asset.id || `asset-sm-${idx}`} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group-hover:bg-[#E1251B] group-hover:text-white transition-all">
                                <div className="flex items-center gap-4">
                                  {getAssetIcon(asset.type)}
                                  <span className="text-xs font-bold tracking-wide truncate" title={asset.name}>{asset.name}</span>
                                </div>
                                <Eye size={14} />
                             </div>
                          ))
                        ) : (
                          <div className="p-10 border-2 border-dashed border-gray-50 rounded-2xl flex flex-col items-center justify-center text-center gap-2">
                             <FileBox size={24} className="text-gray-200" />
                             <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{content.noAssets}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubView === 'completed' && (
            <div className="p-12 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
               <div className="max-w-6xl mx-auto space-y-10">
                <div className="flex items-center justify-between">
                   <div>
                     <h2 className="text-3xl font-bold tracking-tight text-[#1D1D1F] mb-2">{content.navCompleted}</h2>
                     <p className="text-sm text-[#86868B] font-normal leading-relaxed">Historical Success & Brand Footprints Archive</p>
                   </div>
                   <div className="p-3 bg-green-50 text-green-600 rounded-2xl shadow-xl shadow-green-500/10"><CheckCircle size={32} /></div>
                </div>

                <div className="flex md:block gap-6 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory md:snap-none hide-scrollbar pb-4 md:pb-0 -mx-5 px-5 md:mx-0 md:px-0 md:space-y-6">
                   {completedProjects.map(proj => (
                     <div 
                       key={proj.id} 
                       onClick={() => {
                         setSelectedId(proj.id);
                         setSelectedProjectForDetails(proj);
                       }}
                       className={`bg-white border rounded-[2.5rem] p-10 shadow-lg hover:shadow-2xl transition-all flex flex-col md:flex-row gap-8 items-center group cursor-pointer ${selectedId === proj.id ? 'border-red-500 ring-2 ring-red-500/20' : 'border-gray-100'}`}
                     >
                        <div className="w-full md:w-1/3 space-y-4">
                          <h3 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-[#E1251B] transition-colors">{proj.name}</h3>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest"><MapPin size={14} className="text-[#E1251B]" /> {proj.location}</div>
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-600">
                            <Calendar size={12} /> {proj.completionDate || "2023-10-12"}
                          </div>
                        </div>
                        <div className="flex-1 space-y-4 border-l border-gray-100 pl-0 md:pl-10">
                           <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E1251B]">{content.intro}</div>
                           <p className="text-sm text-[#86868B] font-normal leading-relaxed">{proj.description}</p>
                           <div className="flex gap-4 pt-4 overflow-x-auto pb-2 custom-scrollbar">
                              {(proj.digitalAssets || []).slice(0, 3).map((asset, idx) => (
                                <a key={asset.id || `asset-grid-${idx}`} href={asset.url} target="_blank" className="flex-shrink-0 bg-gray-50 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-black hover:text-white transition-all">
                                   {getAssetIcon(asset.type)}
                                   <span className="text-[10px] font-bold tracking-wide truncate" title={asset.name}>{asset.name}</span>
                                </a>
                              ))}
                              <div className="bg-gray-50 rounded-xl px-4 py-2 flex-shrink-0">
                                <span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Scale</span>
                                <span className="text-sm font-black">{proj.area || "400m²"}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          )}

          {activeSubView === 'bom' && (
            <React.Suspense fallback={<div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#E1251B]" /></div>}>
              <ErrorBoundary>
                <BOMGenerator
                  lang={lang}
                  isAdmin={isAdmin}
                  onBackToHub={() => setActiveSubView('dashboard')}
                  projects={projects}
                  setProjects={setProjects}
                />
              </ErrorBoundary>
            </React.Suspense>
          )}

          {/* AI Assistant UI (Simplified) */}
          {activeSubView === 'dashboard' && (
            <div className="absolute bottom-6 right-6 z-40 max-w-sm w-full">
              <div className={`bg-white/90 backdrop-blur-2xl border border-gray-100 shadow-2xl rounded-[2.5rem] p-5 transition-all transform ${isProcessing ? 'ring-2 ring-red-500/20' : ''}`}>
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-2xl bg-[#E1251B] text-white shadow-lg ${isProcessing ? 'animate-pulse' : ''}`}><Sparkles size={18} /></div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-gray-900">{content.aiAssistant}</h4>
                      <p className={`text-[10px] font-bold uppercase tracking-tighter ${isProcessing ? 'text-[#E1251B]' : 'text-gray-400'}`}>{isAdmin ? 'System Ready' : 'Access Restricted'}</p>
                    </div>
                  </div>
                  {!isAdmin && <Lock size={14} className="text-gray-300" />}
                </div>
                {aiStatus && (
                  <div className={`mb-4 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest ${aiStatus.type === 'info' ? 'bg-blue-50 text-blue-600' : aiStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{aiStatus.message}</div>
                )}
                {isAdmin ? (
                  <div className="space-y-4">
                    <div className="relative">
                      <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISubmit(); }}} placeholder={content.aiPlaceholder} className="w-full bg-gray-50 border border-gray-100 rounded-3xl p-5 pr-14 text-xs font-bold text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-[#E1251B] resize-none min-h-[80px] custom-scrollbar" />
                      <button type="button" onClick={handleAISubmit} disabled={isProcessing || !aiPrompt.trim()} className="absolute right-4 bottom-4 p-3 bg-[#E1251B] text-white rounded-2xl shadow-xl shadow-red-500/20 hover:bg-black transition-all disabled:opacity-30" aria-label="Submit AI prompt"><Send size={18} /></button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowManualAddModal(true)}
                      className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#E1251B] transition-all flex items-center justify-center gap-3 shadow-lg"
                    >
                      <Plus size={14} /> 手动添加项目 / Manual Add
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowAuthModal(true)} className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] p-5 text-xs font-black text-gray-400 hover:text-black hover:border-black transition-all flex items-center justify-center gap-4 uppercase tracking-widest">
                    <Shield size={16} className="text-[#E1251B]" />{content.loginToUse}
                  </button>
                )}
              </div>
            </div>
          )}
          {selectedProjectForDetails && (
            <React.Suspense fallback={<div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/50 backdrop-blur-sm"><Loader2 className="animate-spin text-[#E1251B]" /></div>}>
              <ProjectDetailsView 
                project={selectedProjectForDetails} 
                onClose={() => setSelectedProjectForDetails(null)} 
                isAdmin={isAdmin}
                onUpdateProjectDetails={handleUpdateProjectDetails}
                setProjects={setProjects}
                projects={projects}
                setAiStatus={setAiStatus}
              />
            </React.Suspense>
          )}

          {showManualAddModal && (
            <ManualProjectModal 
              show={showManualAddModal}
              onClose={() => setShowManualAddModal(false)}
              onSubmit={handleManualAddSubmit}
              manualProjData={manualProjData}
              setManualProjData={setManualProjData}
            />
          )}
    </main>
      </div>
    </div>
  );
};

export default Dashboard;
