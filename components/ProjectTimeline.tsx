import React from 'react';
import { Clock, CheckCircle, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface ProjectTimelineProps {
  lang: 'cn' | 'en' | 'de';
  project: any;
  onStatusChange?: (stageId: string, status: 'pending' | 'inProgress' | 'completed') => void;
  onTimelineChange?: (
    stages: {
      id: string;
      name: string;
      status: 'pending' | 'inProgress' | 'completed';
      subSteps: { id: string; name: string; status: 'pending' | 'inProgress' | 'completed'; description?: string }[];
    }[],
    projectStatus: '待启动' | '进行中' | '已完成',
    progress: number
  ) => void;
}

interface Stage {
  id: string;
  name: string;
  status: 'completed' | 'inProgress' | 'pending';
  subSteps: {
    id: string;
    name: string;
    status: 'completed' | 'inProgress' | 'pending';
    description?: string;
  }[];
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ lang, project, onStatusChange, onTimelineChange }) => {
  const [expandedStage, setExpandedStage] = React.useState<string | null>(null);
  const [stageStatuses, setStageStatuses] = React.useState<Record<string, 'pending' | 'inProgress' | 'completed'>>({});
  const [subStepStatuses, setSubStepStatuses] = React.useState<Record<string, 'pending' | 'inProgress' | 'completed'>>({});
  const initializedProjectIdRef = React.useRef<string | null>(null);
  const isUserActionRef = React.useRef(false); // 只有用户手动操作时才触发回写

  const translations = {
    cn: {
      title: '进度追踪 / TIMELINE',
      subtitle: 'REAL-TIME CONSTRUCTION PHASE MONITORING',
      status: {
        completed: '已完成',
        inProgress: '进行中',
        pending: '待开始'
      },
      stages: {
        design: '设计阶段',
        procurement: '采购阶段',
        logistics: '物流阶段',
        installation: '安装阶段',
        operation: '正式营业'
      },
      subSteps: {
        design: [
          { id: 'd1', name: '需求分析', description: '与客户沟通，确定设计需求' },
          { id: 'd2', name: '方案设计', description: '根据需求设计店面布局' },
          { id: 'd3', name: '施工图设计', description: '绘制详细的施工图纸' },
          { id: 'd4', name: '设计确认', description: '客户确认设计方案' }
        ],
        procurement: [
          { id: 'p1', name: '材料清单', description: '生成材料采购清单' },
          { id: 'p2', name: '供应商选择', description: '选择合适的供应商' },
          { id: 'p3', name: '采购订单', description: '下达采购订单' },
          { id: 'p4', name: '材料验收', description: '验收采购的材料' }
        ],
        logistics: [
          { id: 'l1', name: '物流规划', description: '制定物流运输计划' },
          { id: 'l2', name: '货物打包', description: '将材料打包准备运输' },
          { id: 'l3', name: '国际运输', description: '通过海运或空运运输货物' },
          { id: 'l4', name: '清关', description: '办理货物清关手续' },
          { id: 'l5', name: '国内配送', description: '将货物配送到项目现场' }
        ],
        installation: [
          { id: 'i1', name: '现场准备', description: '准备安装现场' },
          { id: 'i2', name: '基础施工', description: '进行基础施工工作' },
          { id: 'i3', name: '设备安装', description: '安装设备和家具' },
          { id: 'i4', name: '调试', description: '调试设备和系统' },
          { id: 'i5', name: '验收', description: '项目验收' }
        ],
        operation: [
          { id: 'o1', name: '开业准备', description: '员工培训、设备调试、运营准备' },
          { id: 'o2', name: '正式开业', description: '店铺正式对外营业' }
        ]
      }
    },
    en: {
      title: 'Progress Tracking / TIMELINE',
      subtitle: 'REAL-TIME CONSTRUCTION PHASE MONITORING',
      status: {
        completed: 'Completed',
        inProgress: 'In Progress',
        pending: 'Pending'
      },
      stages: {
        design: 'Design Phase',
        procurement: 'Procurement Phase',
        logistics: 'Logistics Phase',
        installation: 'Installation Phase',
        operation: 'Operation Phase'
      },
      subSteps: {
        design: [
          { id: 'd1', name: 'Requirement Analysis', description: 'Communicate with client to determine design requirements' },
          { id: 'd2', name: 'Concept Design', description: 'Design store layout based on requirements' },
          { id: 'd3', name: 'Construction Drawings', description: 'Create detailed construction drawings' },
          { id: 'd4', name: 'Design Confirmation', description: 'Client confirms design plan' }
        ],
        procurement: [
          { id: 'p1', name: 'Material List', description: 'Generate material procurement list' },
          { id: 'p2', name: 'Supplier Selection', description: 'Select appropriate suppliers' },
          { id: 'p3', name: 'Purchase Orders', description: 'Issue purchase orders' },
          { id: 'p4', name: 'Material Inspection', description: 'Inspect purchased materials' }
        ],
        logistics: [
          { id: 'l1', name: 'Logistics Planning', description: 'Develop logistics transportation plan' },
          { id: 'l2', name: 'Packaging', description: 'Package materials for transportation' },
          { id: 'l3', name: 'International Shipping', description: 'Transport goods by sea or air' },
          { id: 'l4', name: 'Customs Clearance', description: 'Handle customs clearance procedures' },
          { id: 'l5', name: 'Domestic Delivery', description: 'Deliver goods to project site' }
        ],
        installation: [
          { id: 'i1', name: 'Site Preparation', description: 'Prepare installation site' },
          { id: 'i2', name: 'Foundation Work', description: 'Carry out foundation construction' },
          { id: 'i3', name: 'Equipment Installation', description: 'Install equipment and furniture' },
          { id: 'i4', name: 'Commissioning', description: 'Commission equipment and systems' },
          { id: 'i5', name: 'Acceptance', description: 'Project acceptance' }
        ],
        operation: [
          { id: 'o1', name: 'Opening Preparation', description: 'Staff training, equipment debugging, operation preparation' },
          { id: 'o2', name: 'Official Opening', description: 'Store officially opens for business' }
        ]
      }
    },
    de: {
      title: 'Fortschrittsverfolgung / TIMELINE',
      subtitle: 'ECHTZEIT-ÜBERWACHUNG DER BAUPHASE',
      status: {
        completed: 'Abgeschlossen',
        inProgress: 'In Bearbeitung',
        pending: 'Ausstehend'
      },
      stages: {
        design: 'Entwurfsphase',
        procurement: 'Beschaffungsphase',
        logistics: 'Logistikphase',
        installation: 'Installationsphase',
        operation: 'Betriebsphase'
      },
      subSteps: {
        design: [
          { id: 'd1', name: 'Anforderungsanalyse', description: 'Kommunikation mit dem Kunden, um Designanforderungen zu bestimmen' },
          { id: 'd2', name: 'Konzeptdesign', description: 'Gestaltung des Ladenlayouts basierend auf Anforderungen' },
          { id: 'd3', name: 'Konstruktionszeichnungen', description: 'Erstellung detaillierter Konstruktionszeichnungen' },
          { id: 'd4', name: 'Designbestätigung', description: 'Kunde bestätigt den Designplan' }
        ],
        procurement: [
          { id: 'p1', name: 'Materialliste', description: 'Erstellung der Materialbeschaffungsliste' },
          { id: 'p2', name: 'Lieferantenauswahl', description: 'Auswahl geeigneter Lieferanten' },
          { id: 'p3', name: 'Bestellungen', description: 'Ausgabe von Bestellungen' },
          { id: 'p4', name: 'Materialinspektion', description: 'Inspektion der gekauften Materialien' }
        ],
        logistics: [
          { id: 'l1', name: 'Logistikplanung', description: 'Entwicklung eines Logistiktransportplans' },
          { id: 'l2', name: 'Verpackung', description: 'Verpackung von Materialien für den Transport' },
          { id: 'l3', name: 'Internationaler Versand', description: 'Transport von Waren per See oder Luft' },
          { id: 'l4', name: 'Zollabfertigung', description: 'Abwicklung von Zollabfertigungsverfahren' },
          { id: 'l5', name: 'Inländische Lieferung', description: 'Lieferung von Waren an den Projektstandort' }
        ],
        installation: [
          { id: 'i1', name: 'Baustellenvorbereitung', description: 'Vorbereitung der Installationsstelle' },
          { id: 'i2', name: 'Grundlagenarbeiten', description: 'Durchführung von Grundlagenbauarbeiten' },
          { id: 'i3', name: 'Geräteinstallation', description: 'Installation von Geräten und Möbeln' },
          { id: 'i4', name: 'Inbetriebnahme', description: 'Inbetriebnahme von Geräten und Systemen' },
          { id: 'i5', name: 'Abnahme', description: 'Projektabnahme' }
        ],
        operation: [
          { id: 'o1', name: 'Eröffnungsvorbereitung', description: 'Mitarbeiterausbildung, Geräteinbetriebnahme, Betriebsvorbereitung' },
          { id: 'o2', name: 'Offizielle Eröffnung', description: 'Geschäft wird offiziell für den Betrieb geöffnet' }
        ]
      }
    }
  };

  const t = React.useMemo(() => translations[lang], [lang]);

  const stageOrder = React.useMemo<Array<'design' | 'procurement' | 'logistics' | 'installation' | 'operation'>>(
    () => ['design', 'procurement', 'logistics', 'installation', 'operation'],
    []
  );

  const normalizeStatus = (value: any): 'pending' | 'inProgress' | 'completed' => {
    if (value === '已完成' || value === 'completed') return 'completed';
    if (value === '进行中' || value === 'inProgress') return 'inProgress';
    return 'pending';
  };

  // 仅在切换项目时初始化，从数据库数据恢复状态，不触发回写
  React.useEffect(() => {
    const currentProjectId = project?.id ? String(project.id) : 'default-project';
    if (initializedProjectIdRef.current === currentProjectId) return;
    initializedProjectIdRef.current = currentProjectId;
    isUserActionRef.current = false; // 初始化期间禁止回写

    // 默认全部 pending（不是 inProgress！）
    const initStages: Record<string, 'pending' | 'inProgress' | 'completed'> = {
      design: 'pending', procurement: 'pending', logistics: 'pending',
      installation: 'pending', operation: 'pending',
    };
    const initSubs: Record<string, 'pending' | 'inProgress' | 'completed'> = {};

    // 先用默认值填充所有子步骤
    stageOrder.forEach((stageId) => {
      t.subSteps[stageId].forEach((step) => {
        initSubs[`${stageId}-${step.id}`] = 'pending';
      });
    });

    // 检查项目整体状态（管理后台设置优先）
    const projectCompleted = project?.status === '已完成' || project?.status === 'completed';

    if (project && Array.isArray(project.stages) && project.stages.length > 0) {
      // 兼容旧数据（s1-s4）的 ID 映射
      const legacyIdMap: Record<string, string> = {
        's1': 'design', 's2': 'procurement', 's3': 'logistics', 's4': 'installation'
      };
      const stageMap = new Map<string, any>();
      project.stages.forEach((raw: any, idx: number) => {
        const rawId = raw?.id || '';
        const mapped = stageOrder.includes(rawId as any) ? rawId
          : legacyIdMap[rawId] || stageOrder[idx] || null;
        if (mapped) stageMap.set(mapped, raw);
      });

      stageOrder.forEach((stageId) => {
        const raw = stageMap.get(stageId);

        // 如果项目整体已完成，所有阶段和子步骤强制 completed
        if (projectCompleted) {
          initStages[stageId] = 'completed';
          t.subSteps[stageId].forEach((step) => {
            initSubs[`${stageId}-${step.id}`] = 'completed';
          });
          return;
        }

        if (!raw) return;

        // 正常恢复：使用数据库中保存的状态
        initStages[stageId] = normalizeStatus(raw.status);

        const expectedSteps = t.subSteps[stageId as keyof typeof t.subSteps] || [];
        if (Array.isArray(raw.subSteps)) {
          const subMap = new Map<string, any>();
          raw.subSteps.forEach((s: any, i: number) => {
            const sid = s?.id || expectedSteps[i]?.id;
            if (sid) subMap.set(sid, s);
          });
          expectedSteps.forEach((step) => {
            const s = subMap.get(step.id);
            if (s) initSubs[`${stageId}-${step.id}`] = normalizeStatus(s.status);
          });
        }
      });
    } else if (projectCompleted) {
      // 没有 stages 数据但项目已完成，全部标记 completed
      stageOrder.forEach((stageId) => {
        initStages[stageId] = 'completed';
        t.subSteps[stageId].forEach((step) => {
          initSubs[`${stageId}-${step.id}`] = 'completed';
        });
      });
    }

    setStageStatuses(initStages);
    setSubStepStatuses(initSubs);

    // 延迟启用回写，确保初始化完成后不误触发 onTimelineChange
    setTimeout(() => { isUserActionRef.current = true; }, 600);
  }, [project?.id, t, stageOrder]);
  // 由子阶段状态推导阶段状态 + 自动推进下一阶段
  React.useEffect(() => {
    setStageStatuses(prev => {
      const next = { ...prev };

      stageOrder.forEach((stageId, index) => {
        const stageSubSteps = t.subSteps[stageId];
        const keys = stageSubSteps.map(step => `${stageId}-${step.id}`);
        const allCompleted = keys.every(k => subStepStatuses[k] === 'completed');
        const anyInProgress = keys.some(k => subStepStatuses[k] === 'inProgress');
        const anyCompleted = keys.some(k => subStepStatuses[k] === 'completed');
        // 主阶段状态由子阶段推导：全完成=已完成，否则（有进行中或有已完成）=进行中，否则=未开始
        next[stageId] = allCompleted ? 'completed' : (anyInProgress || anyCompleted ? 'inProgress' : 'pending');

        // 当前阶段完成后，自动推进到下一阶段
        if (allCompleted && index < stageOrder.length - 1) {
          const nextStageId = stageOrder[index + 1];
          const nextStageSteps = t.subSteps[nextStageId];
          const nextKeys = nextStageSteps.map(step => `${nextStageId}-${step.id}`);
          const nextAllPending = nextKeys.every(k => (subStepStatuses[k] || 'pending') === 'pending');
          if (nextAllPending) {
            next[nextStageId] = 'inProgress';
            // 下一阶段首个子阶段自动进入进行中
            if (nextStageSteps.length > 0) {
              setSubStepStatuses(prevSub => {
                const firstKey = `${nextStageId}-${nextStageSteps[0].id}`;
                if ((prevSub[firstKey] || 'pending') !== 'pending') return prevSub;
                return { ...prevSub, [firstKey]: 'inProgress' };
              });
            }
          }
        }
      });

      return next;
    });
  }, [subStepStatuses, t, stageOrder]);

  // 项目阶段数据
  const stages: Stage[] = [
    {
      id: 'design',
      name: t.stages.design,
      status: stageStatuses['design'] || 'pending',
      subSteps: t.subSteps.design.map(step => ({
        ...step,
        status: subStepStatuses[`design-${step.id}`] || 'pending'
      }))
    },
    {
      id: 'procurement',
      name: t.stages.procurement,
      status: stageStatuses['procurement'] || 'pending',
      subSteps: t.subSteps.procurement.map(step => ({
        ...step,
        status: subStepStatuses[`procurement-${step.id}`] || 'pending'
      }))
    },
    {
      id: 'logistics',
      name: t.stages.logistics,
      status: stageStatuses['logistics'] || 'pending',
      subSteps: t.subSteps.logistics.map(step => ({
        ...step,
        status: subStepStatuses[`logistics-${step.id}`] || 'pending'
      }))
    },
    {
      id: 'installation',
      name: t.stages.installation,
      status: stageStatuses['installation'] || 'pending',
      subSteps: t.subSteps.installation.map(step => ({
        ...step,
        status: subStepStatuses[`installation-${step.id}`] || 'pending'
      }))
    },
    {
      id: 'operation',
      name: t.stages.operation,
      status: stageStatuses['operation'] || 'pending',
      subSteps: t.subSteps.operation.map(step => ({
        ...step,
        status: subStepStatuses[`operation-${step.id}`] || 'pending'
      }))
    }
  ];

  // 统一向父组件回传 stages/status/progress（用于持久化）
  // 关键：仅在用户手动操作后才触发回写，初始化期间不回写
  const lastEmitRef = React.useRef<string>('');
  React.useEffect(() => {
    // 初始化期间不触发回写，防止默认值覆盖数据库数据
    if (!isUserActionRef.current) return;

    const builtStages = stageOrder.map(stageId => ({
      id: stageId,
      name: t.stages[stageId],
      status: stageStatuses[stageId] || 'pending',
      subSteps: t.subSteps[stageId].map(step => ({
        ...step,
        status: subStepStatuses[`${stageId}-${step.id}`] || 'pending',
      })),
    }));

    const completedStages = builtStages.filter(s => s.status === 'completed').length;
    const allPending = builtStages.every(s => s.status === 'pending');
    const progress = Math.round((completedStages / stageOrder.length) * 100);
    // 全部待开始 → 保持 待启动；全部完成 → 已完成；其他 → 进行中
    const projectStatus: '待启动' | '进行中' | '已完成' =
      completedStages === stageOrder.length ? '已完成'
      : allPending ? '待启动'
      : '进行中';

    const payload = JSON.stringify({
      stages: builtStages.map(s => ({
        id: s.id,
        status: s.status,
        subSteps: s.subSteps.map(ss => ({ id: ss.id, status: ss.status })),
      })),
      projectStatus,
      progress,
    });

    if (payload !== lastEmitRef.current) {
      lastEmitRef.current = payload;
      if (onTimelineChange) {
        onTimelineChange(builtStages, projectStatus, progress);
      }
    }
  }, [stageStatuses, subStepStatuses, onTimelineChange, t, stageOrder]);

  // 主阶段状态由子阶段决定，不允许直接点击切换
  const handleStatusChange = (stageId: string) => {
    // no-op
    return;
  };

  // 切换子步骤状态的函数
  const handleSubStepStatusChange = (stageId: string, subStepId: string) => {
    setSubStepStatuses(prev => {
      const key = `${stageId}-${subStepId}`;
      const currentStatus = prev[key] || 'pending';
      let newStatus: 'pending' | 'inProgress' | 'completed';
      
      // 循环切换状态：pending -> inProgress -> completed -> pending
      switch (currentStatus) {
        case 'pending':
          newStatus = 'inProgress';
          break;
        case 'inProgress':
          newStatus = 'completed';
          break;
        case 'completed':
          newStatus = 'pending';
          break;
        default:
          newStatus = 'pending';
      }
      
      return { ...prev, [key]: newStatus };
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'inProgress':
        return <Clock className="text-red-500" size={20} />;
      case 'pending':
        return <AlertTriangle className="text-yellow-500" size={20} />;
      default:
        return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getStatusBadge = (status: string, stageId: string, subStepId?: string) => {
    const isSubStep = !!subStepId;
    
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // 阻止事件冒泡，防止点击状态按钮时展开/折叠明细
      if (!isSubStep) return;
      if (subStepId) {
        handleSubStepStatusChange(stageId, subStepId);
      } else {
        handleStatusChange(stageId);
      }
    };

    const baseClasses = "text-xs px-2 py-1 rounded-full transition-colors cursor-pointer";

    switch (status) {
      case 'completed':
        return (
          <button 
            onClick={handleClick}
            className={`${baseClasses} bg-green-100 text-green-800 ${isSubStep ? 'hover:bg-green-200' : 'cursor-default'}`}
          >
            {t.status.completed}
          </button>
        );
      case 'inProgress':
        return (
          <button 
            onClick={handleClick}
            className={`${baseClasses} bg-red-100 text-red-800 ${isSubStep ? 'hover:bg-red-200' : 'cursor-default'}`}
          >
            {t.status.inProgress}
          </button>
        );
      case 'pending':
        return (
          <button 
            onClick={handleClick}
            className={`${baseClasses} bg-yellow-100 text-yellow-800 hover:bg-yellow-200`}
          >
            {t.status.pending}
          </button>
        );
      default:
        return null;
    }
  };

  const toggleStage = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.title}</h3>
        <p className="text-sm text-gray-500">{t.subtitle}</p>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        {/* Stages */}
        <div className="space-y-8">
          {stages.map((stage, index) => (
            <div key={stage.id} className="relative">
              {/* Stage header */}
              <div 
                className="flex items-center gap-4 cursor-pointer group"
                onClick={() => toggleStage(stage.id)}
              >
                {/* Status icon */}
                <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10">
                  {getStatusIcon(stage.status)}
                </div>

                {/* Stage info */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-gray-900 group-hover:text-[#E1251B] transition-colors">
                      {stage.name}
                    </h4>
                    {getStatusBadge(stage.status, stage.id)}
                  </div>
                </div>

                {/* Expand/collapse button */}
                <button 
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStage(stage.id);
                  }}
                >
                  {expandedStage === stage.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </button>
              </div>

              {/* Sub-steps */}
              {expandedStage === stage.id && (
                <div className="ml-14 mt-4 space-y-4">
                  {stage.subSteps.map((step) => (
                    <div key={step.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-gray-900">{step.name}</h5>
                        {getStatusBadge(step.status, stage.id, step.id)}
                      </div>
                      {step.description && (
                        <p className="text-sm text-gray-500">{step.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectTimeline;