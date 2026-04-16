
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { LayoutGrid, Factory, Truck, HardHat, ExternalLink, Mail, MapPin, Instagram, Linkedin, MessageCircle, Globe, Layout, Sparkles, ArrowRight, Loader2, X } from 'lucide-react';
import { prepare, layout } from '@chenglou/pretext';
import Navbar from './components/Navbar';
import CustomerSupportButton from './components/CustomerSupportButton';
const GlobeVisual = lazy(() => import('./components/GlobeVisual'));
import { ServiceItem, StatItem, ProjectLocation } from './types';
import { parseProjectCoordinates } from './utils/parseProjectCoordinates';
import { fetchWithTimeout } from './utils/fetchWithTimeout';

// Lazy load heavy components for performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const CampaignView = lazy(() => import('./components/CampaignView'));

const INITIAL_PROJECTS: ProjectLocation[] = [];
const PRETEXT_FONT_DESKTOP = '500 18px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
const PRETEXT_FONT_TABLET = '500 17px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
const PRETEXT_FONT_MOBILE = '500 16px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';

const TRANSLATIONS = {
  cn: {
    heroTitle: "以专业致敬全球野心",
    heroSubtitle: "让世界看见中国品牌",
    heroDesc: "RENLI YESHENG：专业从事海外店面建设、BIM 设计及综合供应链解决方案。已成功助力小龙坎、吼堂、大龙燚、杨国福等知名品牌在全球 100+ 核心城市落地。",
    dashboardBtn: "进入控制台",
    campaignBtn: "2026设计计划",
    servicesTitle: "服务品牌",
    servicesDesc: "仁力烨升与国内外多家知名餐饮品牌如 小龙坎、吼堂、大龙燚、小龙翻大江、谭鸭血、楠火锅、杨国福、牛一嘴、蜀大侠、镇堂子、袁老四 等国内品牌以及海外餐饮 GOLDEN WOK 建有合作关系。",
    servicesFooter: "我们致力于助力中国品牌走向世界，解决海外扩店痛点难点，注重输出中国文化属性，为中国品牌出海提供有力的保障。",
    campaignTitle: "2026 全球免费设计计划",
    campaignStatus: "现已开启申报",
    campaignDesc: "为助力中餐海外扩张，我们将在2026年度为选定的10个优质项目提供免费的全方位的海外店面BIM设计与施工图纸。",
    applyNow: "立即提交申请",
    statsTitle: "RENLI 实战数据",
    realtimeBoard: "查看全球项目实时看板",
    guideBtn: "获取申报指南",
    footerDesc: "连接全球品牌与优质建设基础设施。助力中国品牌，服务全球梦想。",
    footerHead: "总部：中国·成都",
    footerBranch: "分公司：德国·法兰克福",
    links: "快速链接",
    wechat: "扫码关注微信",
    whatsappScan: "WhatsApp",
    home: "首页",
    brands: "服务品牌",
    cases: "项目案例",
    about: "关于我们",
    consult: "免费咨询",
    innovationBadge: "全球计划",
    seoTitle: "成都仁力烨升国际贸易有限公司 | 全球品牌基础设施",
    seoDescription:
      "成都仁力烨升（RENLI YESHENG）专注海外店面建设、BIM 设计与供应链，助力中餐与品牌全球化落地。",
    footerLegalName: "国际贸易有限公司",
    loadErrorTitle: "加载错误",
    loadErrorRetry: "重试",
    loadErrorClose: "关闭",
    loadingShell: "正在加载…",
    socialSoon: "链接待配置",
    socialLinkedin: "LinkedIn",
    socialInstagram: "Instagram",
    socialWechat: "微信",
    fetchErrorTimeout: "项目数据请求超时，请确认已在本机运行 npm run dev 且数据库可访问。",
    fetchErrorGeneric: "项目数据加载失败，请检查网络连接。",
    globeMapAria: "全球项目分布交互地图",
  },
  en: {
    heroTitle: "Honoring Ambition with Professionalism",
    heroSubtitle: "Let the World See Chinese Brands",
    heroDesc: "RENLI YESHENG: Specializing in overseas store construction, BIM design, and integrated supply chain solutions. Successfully supported leading brands like Shoo Loong Kan, Hou Tang, and Da Long Yi across 100+ global cities.",
    dashboardBtn: "Go to Dashboard",
    campaignBtn: "2026 Design Initiative",
    servicesTitle: "Partner Brands",
    servicesDesc: "RENLI YESHENG has established partnerships with renowned brands including Shoo Loong Kan, Hou Tang, Da Long Yi, Xiao Long Fan Da Jiang, Tan Ya Xue, Nan Hotpot, Yang Guo Fu, Niu Yi Zui, Shu Da Xia, and international brands like GOLDEN WOK.",
    servicesFooter: "We are committed to helping Chinese brands go global, solving expansion pain points, and ensuring strong cultural export and logistical security.",
    campaignTitle: "2026 Global Free Design Initiative",
    campaignStatus: "Applications Now Open",
    campaignDesc: "To support the global expansion of Chinese cuisine, we will provide free comprehensive BIM design and construction drawings for 10 selected premium projects in 2026.",
    applyNow: "Apply Now",
    statsTitle: "RENLI Global Metrics",
    realtimeBoard: "View Global Live Dashboard",
    guideBtn: "Get Application Guide",
    footerDesc: "Connecting global brands with premium infrastructure. Empowering brands, serving global dreams.",
    footerHead: "HQ: Chengdu, China",
    footerBranch: "Branch: Frankfurt, Germany",
    links: "Quick Links",
    wechat: "Follow us on WeChat",
    whatsappScan: "WhatsApp",
    home: "Home",
    brands: "Brands",
    cases: "Case Studies",
    about: "About Us",
    consult: "Consult Now",
    innovationBadge: "Global Initiative",
    seoTitle: "RENLI YESHENG | Global Brand Infrastructure",
    seoDescription:
      "RENLI YESHENG: overseas store construction, BIM design, and supply chain for Chinese brands going global.",
    footerLegalName: "International Trade Co., Ltd.",
    loadErrorTitle: "Notice",
    loadErrorRetry: "Retry",
    loadErrorClose: "Dismiss",
    loadingShell: "Loading…",
    socialSoon: "Link not set",
    socialLinkedin: "LinkedIn",
    socialInstagram: "Instagram",
    socialWechat: "WeChat",
    fetchErrorTimeout: "Request timed out. Ensure npm run dev is running and the database is reachable.",
    fetchErrorGeneric: "Failed to load project data. Please check your connection.",
    globeMapAria: "Interactive map of global project locations",
  },
  de: {
    heroTitle: "Ambition mit Professionalität ehren",
    heroSubtitle: "Lassen Sie die Welt chinesische Marken sehen",
    heroDesc: "RENLI YESHENG: Spezialisiert auf den Bau von Auslandsgeschäften, BIM-Design und integrierte Lieferkettenlösungen. Erfolgreiche Unterstützung führender Marken wie Shoo Loong Kan, Hou Tang und Da Long Yi in über 100 Städten weltweit.",
    dashboardBtn: "Zum Dashboard",
    campaignBtn: "Design-Initiative 2026",
    servicesTitle: "Partnermarken",
    servicesDesc: "RENLI YESHENG hat Partnerschaften mit namhaften Marken wie Shoo Loong Kan, Hou Tang, Da Long Yi, Xiao Long Fan Da Jiang, Tan Ya Xue, Nan Hotpot, Yang Guo Fu, Niu Yi Zui, Shu Da Xia und internationalen Marken wie GOLDEN WOK aufgebaut.",
    servicesFooter: "Wir setzen uns dafür ein, chinesischen Marken beim globalen Wachstum zu helfen, Expansionshindernisse zu beseitigen und einen starken kulturellen Export sowie logistische Sicherheit zu gewährleisten.",
    campaignTitle: "Globale Kostenlose Design-Initiative 2026",
    campaignStatus: "Bewerbungen ab sofort möglich",
    campaignDesc: "Um die globale Expansion der chinesischen Gastronomie zu unterstützen, bieten wir im Jahr 2026 kostenlose, umfassende BIM-Designs und Baupläne für 10 ausgewählte Premium-Projekte an.",
    applyNow: "Jetzt bewerben",
    statsTitle: "RENLI Globale Metriken",
    realtimeBoard: "Globales Live-Dashboard anzeigen",
    guideBtn: "Bewerbungsleitfaden anfordern",
    footerDesc: "Verbindung globaler Marken mit erstklassiger Infrastruktur. Marken stärken, globale Träume verwirklichen.",
    footerHead: "Hauptsitz: Chengdu, China",
    footerBranch: "Zweigstelle: Frankfurt, Deutschland",
    links: "Schnelllinks",
    wechat: "Folgen Sie uns auf WeChat",
    whatsappScan: "WhatsApp",
    home: "Startseite",
    brands: "Marken",
    cases: "Fallstudien",
    about: "Über uns",
    consult: "Kostenlose Beratung",
    innovationBadge: "Globale Initiative",
    seoTitle: "RENLI YESHENG | Globale Markeninfrastruktur",
    seoDescription:
      "RENLI YESHENG: Auslandsfilialen, BIM-Design und Lieferkette für chinesische Marken weltweit.",
    footerLegalName: "Internationale Handelsgesellschaft",
    loadErrorTitle: "Hinweis",
    loadErrorRetry: "Erneut",
    loadErrorClose: "Schließen",
    loadingShell: "Wird geladen…",
    socialSoon: "Noch nicht verlinkt",
    socialLinkedin: "LinkedIn",
    socialInstagram: "Instagram",
    socialWechat: "WeChat",
    fetchErrorTimeout: "Zeitüberschreitung. Prüfen Sie, ob npm run dev läuft und die Datenbank erreichbar ist.",
    fetchErrorGeneric: "Projektdaten konnten nicht geladen werden. Bitte Verbindung prüfen.",
    globeMapAria: "Interaktive Karte der globalen Projektstandorte",
  },
};

function trimUrl(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || s === '#') return '';
  return s;
}

const SOCIAL_LINKEDIN = trimUrl(import.meta.env.VITE_SOCIAL_LINKEDIN);
const SOCIAL_INSTAGRAM = trimUrl(import.meta.env.VITE_SOCIAL_INSTAGRAM);
/** 可选：公众号文章页或官方介绍页 */
const SOCIAL_WECHAT = trimUrl(import.meta.env.VITE_SOCIAL_WECHAT);

/** 官网绝对地址（无尾斜杠），用于 canonical / og:url；未配置则跳过注入 */
const SITE_URL = trimUrl(import.meta.env.VITE_SITE_URL).replace(/\/$/, '');
const CONTACT_EMAIL = trimUrl(import.meta.env.VITE_CONTACT_EMAIL) || 'renliyesheng@gmail.com';
const CONTACT_PHONE_DISPLAY = trimUrl(import.meta.env.VITE_CONTACT_PHONE) || '+86 13667649732';
const CONTACT_PHONE_TEL = trimUrl(import.meta.env.VITE_CONTACT_PHONE_TEL) || 'tel:+8613667649732';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'dashboard' | 'campaign'>('landing');
  const [lang, setLang] = useState<'cn' | 'en' | 'de'>('cn');
  const [projects, setProjects] = useState<ProjectLocation[]>(INITIAL_PROJECTS);
  const [heroProjection, setHeroProjection] = useState<'3d' | '2d'>('3d');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  const [copyMinHeights, setCopyMinHeights] = useState<{ hero: number; services: number }>({ hero: 0, services: 0 });
  const heroDescRef = useRef<HTMLParagraphElement | null>(null);
  const servicesDescRef = useRef<HTMLParagraphElement | null>(null);
  /** 与 BOM 材料库同源：`GET /api/list-brands` 返回的 `brands` 表行数 */
  const [listBrandsCount, setListBrandsCount] = useState<number | null>(null);
  /** 避免未连上后端时短暂显示全 0；与项目+品牌接口首轮请求都结束后再展示实战数据 */
  const [metricsReady, setMetricsReady] = useState(false);
  const metricsLoadGenRef = useRef(0);

  /** 餐饮品牌条数（与 `BOMGenerator` 中 `fetchBrands` / 下拉「餐饮品牌」列表一致） */
  const fetchListBrandsCount = async () => {
    try {
      const response = await fetchWithTimeout('/api/list-brands', { timeoutMs: 20000 });
      if (!response.ok) {
        setListBrandsCount(null);
        return;
      }
      const result = await response.json();
      if (result.success === false) {
        setListBrandsCount(null);
        return;
      }
      const n =
        typeof result.total === 'number'
          ? result.total
          : Array.isArray(result.data)
            ? result.data.length
            : 0;
      setListBrandsCount(Number.isFinite(n) ? n : null);
    } catch {
      setListBrandsCount(null);
    }
  };

  // Load projects from server
  const fetchProjects = async () => {
    try {
      setFetchError(null);
      if (import.meta.env.DEV) console.log('Fetching projects from /api/projects...');
      const response = await fetchWithTimeout('/api/projects', { timeoutMs: 45000 });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (import.meta.env.DEV) console.log('Projects fetch result (App):', result);
      if (result.success === false) {
        throw new Error(result.msg || '项目列表接口返回失败');
      }
      const data = Array.isArray(result?.data) ? result.data : [];
        const normalized = data.map((p: any) => {
          const coords = parseProjectCoordinates(p.coordinates);
          
          // Normalize status to Chinese (case-insensitive and handling variations)
          let status = (p.status || '').toString().trim();
          const statusMap: Record<string, string> = {
            'planning': '待启动',
            '待启动': '待启动',
            'in progress': '进行中',
            in_progress: '进行中',
            inprogress: '进行中',
            '进行中': '进行中',
            'completed': '已完成',
            '已完成': '已完成',
            'maintenance': '维护中',
            '维护中': '维护中',
            'pending': '待处理',
            '待处理': '待处理',
            'done': '已完成',
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

          // Normalize stages + 子阶段（与 Dashboard 一致，避免 stages=[] 时 every() 真空真导致全员「已完成」）
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

            const allSubStepsCompleted =
              subSteps.length > 0 && subSteps.every((sub: { status: string }) => sub.status === '已完成');
            const finalStageStatus = allSubStepsCompleted ? '已完成' : normalizedSStatus;

            return {
              id: s.id || `stage-${sIdx}`,
              ...s,
              status: finalStageStatus,
              subSteps,
            };
          });

          if (stages.length > 0) {
            const allSubsCompleted = stages.every((stage) => {
              const subs = Array.isArray(stage.subSteps) ? stage.subSteps : [];
              if (subs.length === 0) return stage.status === '已完成';
              return subs.every((sub: { status: string }) => sub.status === '已完成');
            });

            const anySubActive = stages.some((stage) => {
              const subs = Array.isArray(stage.subSteps) ? stage.subSteps : [];
              const stageActive = stage.status === '进行中' || stage.status === '已完成';
              const subActive = subs.some(
                (sub: { status: string }) => sub.status === '进行中' || sub.status === '已完成',
              );
              return stageActive || subActive;
            });

            if (allSubsCompleted) {
              status = '已完成';
            } else if (anySubActive) {
              status = '进行中';
            } else {
              status = '待启动';
            }
          }

          // Normalize digital assets
          // 修复：优先使用驼峰命名的 digitalAssets，因为它来自 API
          const rawAssets = Array.isArray(p.digitalAssets) ? p.digitalAssets : 
                           Array.isArray(p.digital_assets) ? p.digital_assets : [];
          
          // 调试日志
          if (p.name?.includes('朝鲜')) {
            console.log('[App] 朝鲜店 - p.id:', p.id);
            console.log('[App] 朝鲜店 - p.digitalAssets:', p.digitalAssets);
            console.log('[App] 朝鲜店 - p.digital_assets:', p.digital_assets);
            console.log('[App] 朝鲜店 - rawAssets:', rawAssets);
          }
          
          const digitalAssets = rawAssets.map((asset: any, aIdx: number) => ({
            id: asset.id || `asset-${aIdx}`,
            name: asset.name || 'Untitled Asset',
            type: asset.type || 'link',
            url: asset.url || '#',
            size: asset.size,
            uploadDate: asset.uploadDate || new Date().toISOString()
          }));
          
          // 调试日志
          if (p.name?.includes('朝鲜')) {
            console.log('[App] 朝鲜店 - digitalAssets:', digitalAssets);
          }

          return {
            ...p,
            coordinates: coords,
            status: status,
            stages: stages,
            digitalAssets: digitalAssets,
            brandId: p.brandId ?? p.brand_id,
            clientName: p.clientName ?? p.client_name,
            teamMembers: Array.isArray(p.teamMembers)
              ? p.teamMembers
              : Array.isArray(p.team_members)
                ? p.team_members
                : [],
            feishuExcludedMemberIds: Array.isArray(p.feishuExcludedMemberIds)
              ? p.feishuExcludedMemberIds
              : Array.isArray(p.feishu_excluded_member_ids)
                ? p.feishu_excluded_member_ids
                : [],
          };
        });
        setProjects(normalized);
    } catch (error: any) {
      console.error('Failed to fetch projects (App):', error.message || error);
      const aborted = error?.name === 'AbortError';
      const errTr = TRANSLATIONS[lang];
      setFetchError(aborted ? errTr.fetchErrorTimeout : errTr.fetchErrorGeneric);
      setProjects([]);
    }
  };

  useEffect(() => {
    const gen = ++metricsLoadGenRef.current;
    setMetricsReady(false);
    void Promise.allSettled([fetchProjects(), fetchListBrandsCount()]).then(() => {
      if (metricsLoadGenRef.current === gen) setMetricsReady(true);
    });
  }, [lang]);

  /** 从控制台回到首页时重新拉取，使后台增删的项目立刻出现在地球仪上 */
  const prevViewRef = useRef(view);
  useEffect(() => {
    if (prevViewRef.current === 'dashboard' && view === 'landing') {
      const gen = ++metricsLoadGenRef.current;
      setMetricsReady(false);
      void Promise.allSettled([fetchProjects(), fetchListBrandsCount()]).then(() => {
        if (metricsLoadGenRef.current === gen) setMetricsReady(true);
      });
    }
    prevViewRef.current = view;
  }, [view]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const tr = TRANSLATIONS[lang];
    document.title = tr.seoTitle;
    document.documentElement.lang = lang === 'cn' ? 'zh-CN' : lang === 'en' ? 'en' : 'de';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', tr.seoDescription);

    if (!SITE_URL) return;

    const upsertLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    const upsertMeta = (attr: 'property' | 'name', key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const pageUrl = `${SITE_URL}/`;
    upsertLink('canonical', pageUrl);
    upsertMeta('property', 'og:url', pageUrl);
    upsertMeta('property', 'og:title', tr.seoTitle);
    upsertMeta('property', 'og:description', tr.seoDescription);
    upsertMeta('name', 'twitter:title', tr.seoTitle);
    upsertMeta('name', 'twitter:description', tr.seoDescription);

    const ogImg = trimUrl(import.meta.env.VITE_OG_IMAGE_URL);
    if (ogImg) {
      const abs = /^https?:\/\//i.test(ogImg) ? ogImg : `${SITE_URL}${ogImg.startsWith('/') ? '' : '/'}${ogImg}`;
      upsertMeta('property', 'og:image', abs);
      upsertMeta('name', 'twitter:image', abs);
    }
  }, [lang]);

  // Persistence effect (Save to server when projects change)
  useEffect(() => {
    const saveProjects = async () => {
      // We only save if projects is not the initial state or if we want to sync
      // For simplicity, we'll sync whenever projects change
      // In a real app, you'd only save the specific project being updated
      // But for this demo, we'll send the whole list or the updated one
      // Let's just use the API to save individual projects in AdminPortal instead
    };
    // localStorage.setItem('rl_projects', JSON.stringify(projects));
  }, [projects]);

  const t = TRANSLATIONS[lang];
  const pretextLayoutConfig = useMemo(() => {
    if (viewportWidth < 640) {
      return { font: PRETEXT_FONT_MOBILE, lineHeight: 26 };
    }
    if (viewportWidth < 1024) {
      return { font: PRETEXT_FONT_TABLET, lineHeight: 28 };
    }
    return { font: PRETEXT_FONT_DESKTOP, lineHeight: 29 };
  }, [viewportWidth]);
  const preparedHeroByLang = useMemo(
    () => ({
      cn: prepare(TRANSLATIONS.cn.heroDesc, pretextLayoutConfig.font),
      en: prepare(TRANSLATIONS.en.heroDesc, pretextLayoutConfig.font),
      de: prepare(TRANSLATIONS.de.heroDesc, pretextLayoutConfig.font),
    }),
    [pretextLayoutConfig.font],
  );
  const preparedServicesByLang = useMemo(
    () => ({
      cn: prepare(TRANSLATIONS.cn.servicesDesc, pretextLayoutConfig.font),
      en: prepare(TRANSLATIONS.en.servicesDesc, pretextLayoutConfig.font),
      de: prepare(TRANSLATIONS.de.servicesDesc, pretextLayoutConfig.font),
    }),
    [pretextLayoutConfig.font],
  );

  const recomputeCopyMinHeights = useCallback(() => {
    const heroWidth = heroDescRef.current?.clientWidth ?? 0;
    const servicesWidth = servicesDescRef.current?.clientWidth ?? 0;
    if (heroWidth <= 0 || servicesWidth <= 0) return;

    const heroHeights = (Object.keys(preparedHeroByLang) as Array<keyof typeof preparedHeroByLang>).map(
      key => layout(preparedHeroByLang[key], heroWidth, pretextLayoutConfig.lineHeight).height,
    );
    const servicesHeights = (
      Object.keys(preparedServicesByLang) as Array<keyof typeof preparedServicesByLang>
    ).map(key => layout(preparedServicesByLang[key], servicesWidth, pretextLayoutConfig.lineHeight).height);

    const nextHeroHeight = Math.ceil(Math.max(...heroHeights));
    const nextServicesHeight = Math.ceil(Math.max(...servicesHeights));

    setCopyMinHeights(prev => {
      if (prev.hero === nextHeroHeight && prev.services === nextServicesHeight) return prev;
      return { hero: nextHeroHeight, services: nextServicesHeight };
    });
  }, [preparedHeroByLang, preparedServicesByLang, pretextLayoutConfig.lineHeight]);

  useEffect(() => {
    recomputeCopyMinHeights();

    const observer = new ResizeObserver(() => {
      recomputeCopyMinHeights();
    });
    if (heroDescRef.current) observer.observe(heroDescRef.current);
    if (servicesDescRef.current) observer.observe(servicesDescRef.current);

    window.addEventListener('resize', recomputeCopyMinHeights);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recomputeCopyMinHeights);
    };
  }, [recomputeCopyMinHeights, view]);

  // 实战数据：①总项目数 ②去重国家 ③品牌表条数（同 /api/list-brands）④状态为「进行中」
  const dynamicStats = useMemo(() => {
    if (!metricsReady) {
      return [
        {
          value: '…',
          label: lang === 'cn' ? '全球活跃节点' : lang === 'en' ? 'Global Nodes' : 'Globale Knoten',
        },
        {
          value: '…',
          label: lang === 'cn' ? '服务国家' : lang === 'en' ? 'Countries Served' : 'Bediente Länder',
        },
        {
          value: '…',
          label: lang === 'cn' ? '成功品牌交付' : lang === 'en' ? 'Brand Deliveries' : 'Markenauslieferungen',
        },
        {
          value: '…',
          label: lang === 'cn' ? '在建扩容项目中' : lang === 'en' ? 'Active Projects' : 'Aktive Projekte',
        },
      ];
    }

    const list = Array.isArray(projects) ? projects : [];
    const totalProjects = list.length;

    const inProgressOnly = list.filter((p) => p.status === '进行中').length;

    const countryFromProject = (p: ProjectLocation): string | null => {
      const direct = String(p.country || '').trim();
      if (direct.length >= 2 && !/^全球|global|unknown|待定$/i.test(direct)) return direct;
      const loc = String(p.location || '').trim();
      if (!loc) return null;
      const parts = loc.split(/[,，·|]+/).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        if (last.length >= 2 && !/^全球|global$/i.test(last)) return last;
      }
      return null;
    };

    const countries = new Set<string>();
    for (const p of list) {
      const c = countryFromProject(p);
      if (c) countries.add(c);
    }
    const countryCount = countries.size;

    return [
      {
        value: `${totalProjects}`,
        label: lang === 'cn' ? '全球活跃节点' : lang === 'en' ? 'Global Nodes' : 'Globale Knoten',
      },
      {
        value: `${countryCount}`,
        label: lang === 'cn' ? '服务国家' : lang === 'en' ? 'Countries Served' : 'Bediente Länder',
      },
      {
        value: listBrandsCount === null ? '—' : `${listBrandsCount}`,
        label: lang === 'cn' ? '成功品牌交付' : lang === 'en' ? 'Brand Deliveries' : 'Markenauslieferungen',
      },
      {
        value: `${inProgressOnly}`,
        label: lang === 'cn' ? '在建扩容项目中' : lang === 'en' ? 'Active Projects' : 'Aktive Projekte',
      },
    ];
  }, [projects, lang, listBrandsCount, metricsReady]);

  const services: ServiceItem[] = [
    {
      id: 'design',
      title: lang === 'cn' ? '店面设计' : (lang === 'en' ? 'Store Design' : 'Ladendesign'),
      description: lang === 'cn' ? '专注于海外店面布局与 BIM 施工图设计的专业化服务。' : (lang === 'en' ? 'Specialized services focused on overseas store layout and BIM construction drawings.' : 'Spezialisierte Dienstleistungen für das Layout von Auslandsgeschäften und BIM-Bauzeichnungen.'),
      icon: <LayoutGrid className="text-[#E1251B]" size={32} />
    },
    {
      id: 'factory',
      title: lang === 'cn' ? '工厂生产' : (lang === 'en' ? 'Factory Production' : 'Fabrikproduktion'),
      description: lang === 'cn' ? '智能化制造，确保全球范围内展架与家具的标准化供应。' : (lang === 'en' ? 'Intelligent manufacturing ensuring standardized supply of fixtures and furniture worldwide.' : 'Intelligente Fertigung für eine standardisierte Versorgung mit Einrichtungen und Möbeln weltweit.'),
      icon: <Factory className="text-[#E1251B]" size={32} />
    },
    {
      id: 'logistics',
      title: lang === 'cn' ? '全球物流' : (lang === 'en' ? 'Global Logistics' : 'Globale Logistik'),
      description: lang === 'cn' ? '全方位的国际货运、清关与最后一公里配送协助。' : (lang === 'en' ? 'Comprehensive international freight, customs clearance, and last-mile delivery assistance.' : 'Umfassende Unterstützung bei internationaler Fracht, Zollabfertigung und Zustellung auf der letzten Meile.'),
      icon: <Truck className="text-[#E1251B]" size={32} />
    },
    {
      id: 'construction',
      title: lang === 'cn' ? '施工搭建' : (lang === 'en' ? 'Construction' : 'Bauausführung'),
      description: lang === 'cn' ? '全球落地施工管理，通过 BIM 技术实现远程协同与交付。' : (lang === 'en' ? 'Global on-site construction management with remote collaboration via BIM technology.' : 'Globales Baumanagement vor Ort mit Fernzusammenarbeit über BIM-Technologie.'),
      icon: <HardHat className="text-[#E1251B]" size={32} />
    }
  ];

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToWechatQr = () => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  };

  const isProdBuild = import.meta.env.PROD;

  return (
    <div className="min-h-screen bg-white">
      {fetchError &&
        (isProdBuild ? (
          <div
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-2rem)] max-w-md px-0 animate-in slide-in-from-bottom duration-300"
            role="status"
          >
            <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 text-slate-100 shadow-lg backdrop-blur-sm px-3.5 py-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <MapPin size={16} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.loadErrorTitle}</p>
                <p className="text-[11px] font-medium text-slate-200 leading-snug mt-0.5">{fetchError}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fetchProjects()}
                    className="px-3 py-1.5 rounded-md bg-white text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    {t.loadErrorRetry}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFetchError(null)}
                    className="px-3 py-1.5 rounded-md border border-slate-600 text-[10px] font-bold text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    {t.loadErrorClose}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                className="text-slate-500 hover:text-slate-200 transition-colors shrink-0 p-0.5"
                aria-label={t.loadErrorClose}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in slide-in-from-top duration-300 px-4">
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-red-600 uppercase tracking-widest">{t.loadErrorTitle}</p>
                  <p className="text-[11px] font-bold text-red-500/80 leading-tight">{fetchError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fetchProjects()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors shrink-0"
              >
                {t.loadErrorRetry}
              </button>
              <button
                type="button"
                onClick={() => setFetchError(null)}
                className="text-red-300 hover:text-red-600 transition-colors"
                aria-label={t.loadErrorClose}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      <Suspense
        fallback={
          <div className="h-screen w-screen flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#E1251B] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest text-gray-400">{t.loadingShell}</span>
            </div>
          </div>
        }
      >
        {view === 'dashboard' ? (
          <Dashboard 
            lang={lang}
            projects={projects} 
            setProjects={setProjects} 
            onBack={() => setView('landing')} 
          />
        ) : view === 'campaign' ? (
          <>
            <Navbar lang={lang} setLang={setLang} onNavigate={(v) => setView(v)} />
            <CampaignView lang={lang} onBack={() => setView('landing')} />
          </>
        ) : (
          <>
            <Navbar lang={lang} setLang={setLang} onNavigate={(v) => setView(v)} onScrollTo={scrollToSection} />

            {/* Hero Section */}
            <section className="pt-24 pb-14 px-4 md:pt-32 md:pb-20 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-left duration-700">
            <div className="space-y-4">
              <h1 className="text-[2.25rem] md:text-5xl lg:text-6xl font-black text-[#1A1A1A] leading-[1.05] tracking-tight">
                {t.heroTitle}<br />
                {lang === 'cn' ? '让世界看见' : (lang === 'en' ? 'Let the world see ' : 'Lassen Sie die Welt ')}<span className="text-[#E1251B]">{lang === 'cn' ? '中国品牌' : (lang === 'en' ? 'Chinese Brands' : 'chinesische Marken sehen')}</span>
              </h1>
            </div>
            <div>
              <p
                ref={heroDescRef}
                className="text-base sm:text-lg text-gray-600 max-w-none sm:max-w-lg leading-relaxed font-medium"
                style={copyMinHeights.hero > 0 ? { minHeight: `${copyMinHeights.hero}px` } : undefined}
              >
                {t.heroDesc}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="w-full sm:w-auto bg-[#E1251B] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-md shadow-xl hover:bg-[#c11f17] transition-all font-bold text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
              >
                {t.dashboardBtn}
              </button>
              <button
                type="button"
                onClick={() => setView('campaign')}
                className="w-full sm:w-auto bg-white text-[#1A1A1A] border border-gray-200 px-6 sm:px-8 py-3.5 sm:py-4 rounded-md shadow hover:bg-gray-50 transition-all font-bold text-sm sm:text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
              >
                {t.campaignBtn}
              </button>
            </div>
          </div>
          
          <div
            className="relative h-[320px] sm:h-[420px] lg:h-[600px] flex flex-col items-center justify-center"
            role="region"
            aria-label={t.globeMapAria}
          >
            <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><Loader2 className="animate-spin text-[#E1251B]" aria-hidden /></div>}>
              <GlobeVisual
                interactive
                lang={lang}
                projects={projects}
                projectionType={heroProjection}
                onProjectionChange={setHeroProjection}
              />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Service Brands Section */}
      <section id="services" className="py-16 md:py-24 bg-[#FAFAFA]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12 md:mb-20">
            <h2 className="text-3xl md:text-4xl font-black mb-6 md:mb-8 text-[#1A1A1A]">{t.servicesTitle}</h2>
            <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-gray-100">
              <div>
                <p
                  ref={servicesDescRef}
                  className="text-base md:text-lg text-gray-600 leading-relaxed font-medium"
                  style={copyMinHeights.services > 0 ? { minHeight: `${copyMinHeights.services}px` } : undefined}
                >
                  {t.servicesDesc}
                </p>
              </div>
              <p className="mt-6 text-gray-500 leading-relaxed">
                {t.servicesFooter}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {services.map((item) => (
              <div key={item.id} className="bg-white p-7 md:p-10 rounded-xl shadow-sm border border-transparent hover:border-gray-100 hover:shadow-xl transition-all group text-center">
                <div className="mb-5 md:mb-6 flex justify-center">{item.icon}</div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-[#E1251B] transition-colors">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Innovation Promo Section */}
      <section id="innovation-promo" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
           <div className="bg-black rounded-[2.5rem] p-12 md:p-20 relative overflow-hidden group">
             <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#E1251B] rounded-full blur-[120px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
             
             <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20">
                    <Sparkles size={14} className="text-[#E1251B]" />
                    <span className="text-white text-xs font-black uppercase tracking-widest">{t.innovationBadge}</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                    2026<br />
                    <span className="text-[#E1251B]">{t.campaignTitle}</span><br />
                    {t.campaignStatus}
                  </h2>
                  <p className="text-gray-400 font-medium leading-relaxed max-w-md">
                    {t.campaignDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('campaign')}
                    className="bg-[#E1251B] text-white px-10 py-5 rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-red-500/30 hover:bg-white hover:text-black transition-all hover:-translate-y-1 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {t.applyNow}
                  </button>
                </div>
                <div className="hidden lg:block">
                  <div className="relative aspect-square bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 border border-white/10 rounded-full animate-pulse"></div>
                        <div className="absolute w-48 h-48 border border-[#E1251B]/20 rounded-full"></div>
                        <Layout className="text-[#E1251B] opacity-50" size={80} />
                     </div>
                  </div>
                </div>
             </div>
           </div>
        </div>
      </section>

      {/* Key Stats Section */}
      <section className="py-24 relative overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl font-black mb-16 text-[#1A1A1A]">{t.statsTitle}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {dynamicStats.map((stat) => (
              <div key={stat.label} className="space-y-2">
                <div className="text-6xl font-black text-[#E1251B] tracking-tight transition-all duration-1000">{stat.value}</div>
                <div className="text-gray-500 font-bold text-xs tracking-widest uppercase">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-16 flex flex-wrap justify-center gap-6">
            <button
              type="button"
              onClick={() => setView('dashboard')}
              className="bg-[#E1251B] text-white px-8 py-4 rounded shadow-xl hover:bg-[#c11f17] transition-all font-black uppercase text-xs tracking-widest inline-flex items-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
            >
              <span>{t.realtimeBoard}</span>
              <ExternalLink size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setView('campaign')}
              className="bg-white text-[#1A1A1A] border border-gray-200 px-8 py-4 rounded shadow hover:bg-gray-50 transition-all font-black uppercase text-xs tracking-widest inline-flex items-center space-x-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
            >
              <span>{t.guideBtn}</span>
              <ArrowRight size={14} className="text-[#E1251B]" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer id="about" className="bg-[#FAFAFA] pt-20 pb-10 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1 md:col-span-1 space-y-6">
               <div className="flex flex-col items-start">
                <div className="flex items-center space-x-1">
                  <span className="text-xl font-extrabold text-[#1A1A1A]">RENLI</span>
                  <span className="text-xl font-extrabold text-[#E1251B]">YESHENG</span>
                </div>
                <span className="text-xs tracking-widest text-gray-400 font-bold uppercase leading-none mt-1">{t.footerLegalName}</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                {t.footerDesc}
              </p>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-gray-500 text-sm font-medium">
                  <MapPin size={16} className="text-[#E1251B]" />
                  <span>{t.footerHead}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-500 text-sm font-medium">
                  <MapPin size={16} className="text-[#E1251B]" />
                  <span>{t.footerBranch}</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-500 text-sm font-medium">
                  <Mail size={16} className="text-[#E1251B] shrink-0" aria-hidden />
                  <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-[#E1251B] transition-colors underline-offset-2 hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="font-black text-sm text-[#1A1A1A] tracking-widest uppercase">{t.links}</h4>
              <ul className="space-y-3 text-sm font-medium text-gray-500">
                <li>
                  <button type="button" onClick={() => setView('landing')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">
                    {t.home}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setView('dashboard')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">
                    {t.cases}
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setView('campaign')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">
                    {t.campaignBtn}
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-6 md:col-span-2 flex flex-col md:items-end">
              <div className="text-right w-full">
                <div className="text-xs tracking-widest text-gray-500 font-bold uppercase mb-2">
                  <a href={CONTACT_PHONE_TEL} className="hover:text-[#E1251B] transition-colors">
                    {CONTACT_PHONE_DISPLAY}
                  </a>
                </div>
                <div className="flex flex-wrap gap-4 justify-end">
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 inline-block text-center">
                    <div className="w-36 h-36 flex items-center justify-center border-4 border-white mx-auto">
                      <img src="/whatsapp-qr.png" alt="WhatsApp QR Code" className="w-[128px] h-[128px] object-contain" loading="lazy" />
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1 font-bold uppercase tracking-tighter">
                      <MessageCircle size={10} className="text-emerald-600" />
                      <span>{t.whatsappScan}</span>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100 inline-block text-center">
                    <div className="w-36 h-36 flex items-center justify-center border-4 border-white mx-auto">
                      <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=WeChat QR code for Feng Renli from Chengdu, Sichuan, with WeChat logo in the center, black and white QR code on white background&image_size=square" alt="WeChat QR Code" className="w-[128px] h-[128px] object-contain" loading="lazy" />
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex items-center justify-center gap-1 font-bold uppercase tracking-tighter">
                      <MessageCircle size={10} className="text-green-500" />
                      <span>{t.wechat}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-10 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-col items-center md:items-start space-y-1">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">© 2026 RENLI YESHENG. ALL RIGHTS RESERVED.</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">蜀ICP备2026006053号-1</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-black text-gray-400 tracking-widest uppercase">
              {SOCIAL_LINKEDIN ? (
                <a
                  href={SOCIAL_LINKEDIN}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1A1A1A] flex items-center space-x-1"
                >
                  <Linkedin size={12} aria-hidden />
                  <span>{t.socialLinkedin}</span>
                </a>
              ) : (
                <span className="text-gray-300 flex items-center space-x-1 cursor-default" title={t.socialSoon}>
                  <Linkedin size={12} aria-hidden />
                  <span>{t.socialLinkedin}</span>
                </span>
              )}
              {SOCIAL_WECHAT ? (
                <a
                  href={SOCIAL_WECHAT}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1A1A1A] flex items-center space-x-1"
                >
                  <MessageCircle size={12} aria-hidden />
                  <span>{t.socialWechat}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={scrollToWechatQr}
                  className="hover:text-[#1A1A1A] flex items-center space-x-1 text-gray-400"
                >
                  <MessageCircle size={12} aria-hidden />
                  <span>{t.socialWechat}</span>
                </button>
              )}
              {SOCIAL_INSTAGRAM ? (
                <a
                  href={SOCIAL_INSTAGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#1A1A1A] flex items-center space-x-1"
                >
                  <Instagram size={12} aria-hidden />
                  <span>{t.socialInstagram}</span>
                </a>
              ) : (
                <span className="text-gray-300 flex items-center space-x-1 cursor-default" title={t.socialSoon}>
                  <Instagram size={12} aria-hidden />
                  <span>{t.socialInstagram}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
      <CustomerSupportButton lang={lang} projects={projects} />
    </>
  )}
</Suspense>
    </div>
  );
};

export default App;
