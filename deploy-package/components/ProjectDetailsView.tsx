import React, { useState, useRef } from 'react';
import { 
  HardHat, MapPin, Save, Settings, Share2, X, Layout, Clock, 
  FileStack, User as UserIcon, Maximize2, Shield, CheckCircle2, 
  Upload, Link as LinkIcon, Eye, Trash2, Send, UserPlus, MessageSquare,
  Download, Box, FileText, FileArchive, Loader2
} from 'lucide-react';
import { ProjectLocation, DigitalAsset, ProjectTeamMember } from '../types';
import { getAssetIcon } from './AssetIcon';
import ModelPreview from './ModelPreview';
import ProjectTimeline from './ProjectTimeline';

interface ProjectDetailsViewProps {
  project: ProjectLocation;
  onClose: () => void;
  isAdmin: boolean;
  onUpdateProjectDetails: (projectId: string, field: keyof ProjectLocation, value: any) => void;
  setProjects: React.Dispatch<React.SetStateAction<ProjectLocation[]>>;
  projects: ProjectLocation[];
  setAiStatus: React.Dispatch<React.SetStateAction<{message: string, type: 'info' | 'success' | 'error'} | null>>;
}

const ProjectDetailsView: React.FC<ProjectDetailsViewProps> = ({ 
  project, 
  onClose, 
  isAdmin, 
  onUpdateProjectDetails,
  setProjects,
  projects,
  setAiStatus
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'assets' | 'team'>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ProjectLocation>>(project);
  const [previewModel, setPreviewModel] = useState<{ url: string, name: string } | null>(null);
  const [localProject, setLocalProject] = useState<ProjectLocation>(project);

  // 🚀 修复 4：页面加载时从接口读取真实数据
  React.useEffect(() => {
    const loadProject = async () => {
      try {
        const res = await fetch(`/api/project/${project.id}`);
        const result = await res.json();
        if (result.success && result.data) {
          setLocalProject(result.data);
          setEditData(result.data);
        }
      } catch (err) {
        console.error('加载项目详情失败:', err);
      }
    };
    if (project.id) loadProject();
  }, [project.id]);

  const [feishuExcludedMemberIds, setFeishuExcludedMemberIds] = React.useState<string[]>(
    Array.isArray(project.feishuExcludedMemberIds) ? project.feishuExcludedMemberIds : [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const persistProjectPatch = React.useCallback(async (patch: Partial<ProjectLocation>) => {
    // 🚀 改进：仅更新本地状态，不再触发冗余的异步请求
    // 所有持久化操作统一由父组件 (Dashboard) 的 onUpdateProjectDetails 处理
    setLocalProject(prev => ({ ...prev, ...patch }));
  }, []);

  const normalizeAssetUrl = React.useCallback((rawUrl?: string) => {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';

    if (raw.startsWith('/uploads/')) return raw;
    if (raw.startsWith('uploads/')) return `/${raw}`;
    if (raw.startsWith('/files/uploads/')) return raw.replace('/files', '');

    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        const pathName = u.pathname || '';
        if (pathName.startsWith('/files/uploads/')) return pathName.replace('/files', '');
        if (pathName.startsWith('/uploads/')) return pathName;
        return raw;
      } catch {
        return raw;
      }
    }

    if (raw.includes('/uploads/')) {
      const i = raw.indexOf('/uploads/');
      return raw.slice(i);
    }
    if (raw.includes('\\uploads\\')) {
      const normalized = raw.replace(/\\/g, '/');
      const i = normalized.indexOf('/uploads/');
      if (i >= 0) return normalized.slice(i);
    }
    return raw;
  }, []);
  const normalizedAssets = React.useMemo(() => {
    // 🚀 核心改进：极其严谨地获取数字资产，兼容各种后端返回格式
    const getRawAssets = () => {
      // 优先级 1：localProject (最新 UI 状态)
      if (localProject.digitalAssets && Array.isArray(localProject.digitalAssets)) return localProject.digitalAssets;
      if ((localProject as any).digital_assets && Array.isArray((localProject as any).digital_assets)) return (localProject as any).digital_assets;
      
      // 优先级 2：project (原始 props)
      if (project.digitalAssets && Array.isArray(project.digitalAssets)) return project.digitalAssets;
      if ((project as any).digital_assets && Array.isArray((project as any).digital_assets)) return (project as any).digital_assets;
      
      return [];
    };

    const assets = getRawAssets().filter((a: any) => a != null && typeof a === 'object' && a.url);
    console.log(`[ProjectDetailsView] 渲染资产, 数量: ${assets.length}, 项目: ${project.id}`);
    
    return assets.map(asset => ({
      ...asset,
      url: normalizeAssetUrl(asset.url),
    }));
  }, [localProject.digitalAssets, (localProject as any).digital_assets, project.digitalAssets, (project as any).digital_assets, normalizeAssetUrl, project.id]);
  const [feishuMembers, setFeishuMembers] = React.useState<
    { userId: string; name: string; enName?: string; email?: string; mobile?: string; avatar?: string; jobTitle?: string }[]
  >([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);
  const [feishuSourceDeptId, setFeishuSourceDeptId] = React.useState('');
  const [feishuError, setFeishuError] = React.useState('');
  const manualTeamMembers = React.useMemo(
    () => (Array.isArray(localProject.teamMembers) ? localProject.teamMembers : []),
    [localProject.teamMembers],
  );
  const [showFeishuDirectory, setShowFeishuDirectory] = React.useState(false);
  const [loadingFeishuDirectory, setLoadingFeishuDirectory] = React.useState(false);
  const [feishuDirectoryError, setFeishuDirectoryError] = React.useState('');
  const [feishuDirectoryKeyword, setFeishuDirectoryKeyword] = React.useState('');
  const [feishuDeptKeyword, setFeishuDeptKeyword] = React.useState('');
  const [feishuDirectoryMembers, setFeishuDirectoryMembers] = React.useState<
    { userId: string; name: string; enName?: string; email?: string; mobile?: string; avatar?: string; jobTitle?: string }[]
  >([]);
  const [feishuDeptNodes, setFeishuDeptNodes] = React.useState<
    { id: string; name: string; parentId?: string; memberCount?: number }[]
  >([]);
  const [selectedDirectoryDeptId, setSelectedDirectoryDeptId] = React.useState('');
  const [feishuDirectorySelectedIds, setFeishuDirectorySelectedIds] = React.useState<Set<string>>(new Set());

  // 🚀 修复同步逻辑：确保即使在编辑基本信息时，资产和阶段也能从父组件同步
  React.useEffect(() => {
    setLocalProject(prev => {
      // 如果切换项目，完全重置
      if (prev.id !== project.id) {
        console.log('[ProjectDetailsView] 切换项目:', project.id);
        return project;
      }
      
      // 如果是同一项目，且正在编辑基本信息 (Name, Client等)，
      // 我们也要强制同步数字资产和阶段，防止这些“非编辑字段”持有旧数据并在保存时覆盖 DB
      console.log('[ProjectDetailsView] 同步父组件数据, 资产数:', project.digitalAssets?.length);
      return {
        ...prev,
        digitalAssets: project.digitalAssets || [],
        stages: project.stages || [],
        teamMembers: project.teamMembers || [],
        status: project.status,
        progress: project.progress,
        // 如果不在编辑模式，则同步所有字段
        ...(isEditing ? {} : project)
      };
    });
    
    setFeishuExcludedMemberIds(Array.isArray(project.feishuExcludedMemberIds) ? project.feishuExcludedMemberIds : []);
  }, [project, isEditing]);

  // 加载飞书部门成员（如果项目绑定了部门ID）
  React.useEffect(() => {
    const load = async () => {
      setLoadingMembers(true);
      setFeishuError('');
      try {
        const query = project.feishuDeptId
          ? `?departmentId=${encodeURIComponent(project.feishuDeptId)}`
          : '';
        const res = await fetch(`/api/feishu-members-by-dept${query}`);
        const json = await res.json();
        if (res.ok && json && Array.isArray(json.data)) {
          setFeishuMembers(json.data);
          setFeishuSourceDeptId(String(json.sourceDepartmentId || ''));
        } else {
          setFeishuMembers([]);
          setFeishuSourceDeptId('');
          setFeishuError(String(json?.msg || '飞书接口返回异常'));
        }
      } catch (err) {
        console.error('Failed to load Feishu members:', err);
        setFeishuMembers([]);
        setFeishuSourceDeptId('');
        setFeishuError('飞书接口请求失败，请检查网络或服务端配置');
      } finally {
        setLoadingMembers(false);
      }
    };
    void load();
  }, [project.feishuDeptId, project.id]);

  const handleSave = async () => {
    // 合并 project、editData 和 localProject（包含最新的成员数据和数字资产）
    const updatedProject = { 
      ...project, 
      ...editData,
      teamMembers: localProject.teamMembers,
      feishuExcludedMemberIds: feishuExcludedMemberIds,
      digitalAssets: localProject.digitalAssets || project.digitalAssets || []
    };
    const updatedProjects = projects.map(p => p.id === project.id ? updatedProject : p);
    setProjects(updatedProjects);
    
    console.log('[SAVE] handleSave 保存项目，成员数量:', updatedProject.teamMembers?.length || 0);
    
    try {
      const res = await fetch('/api/save-project-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject)
      });
      const result = await res.json();
      console.log('[SAVE] handleSave 保存结果:', result);
      
      if (res.ok) {
        setIsEditing(false);
        setAiStatus({ message: '项目详情更新成功', type: 'success' });
      } else {
        setAiStatus({ message: '保存失败: ' + (result.msg || '未知错误'), type: 'error' });
      }
      setTimeout(() => setAiStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save project:', error);
      setAiStatus({ message: '保存失败', type: 'error' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (isUploading) return;
    
    // Create form data for file upload
    const formData = new FormData();
    const uploadProjectId = localProject?.id || project?.id || 'default';
    formData.append('projectId', uploadProjectId);
    formData.append('file', file);
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadingFileName(file.name);
      setAiStatus({ message: `正在上传：${file.name}（0%）`, type: 'info' });

      // Use XMLHttpRequest so we can show upload progress for large files.
      const result: any = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload?projectId=${encodeURIComponent(uploadProjectId)}`);
        xhr.setRequestHeader('x-project-id', uploadProjectId);

        xhr.upload.onprogress = (ev) => {
          if (!ev.lengthComputable) return;
          const p = Math.min(100, Math.max(0, Math.round((ev.loaded / ev.total) * 100)));
          setUploadProgress(p);
          setAiStatus({ message: `正在上传：${file.name}（${p}%）`, type: 'info' });
        };

        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) resolve(parsed);
            else reject(new Error(parsed?.msg || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`上传返回解析失败（HTTP ${xhr.status}）`));
          }
        };

        xhr.onerror = () => reject(new Error('网络异常，上传连接失败'));
        xhr.onabort = () => reject(new Error('上传已取消'));
        xhr.send(formData);
      });

      if (result.code !== 200) {
        setAiStatus({ 
          message: `上传失败：${result.msg}`, 
          type: 'error' 
        });
        setTimeout(() => setAiStatus(null), 3000);
        return;
      }
      
      // 🚀 核心改进：优先使用后端返回的最新完整资产列表
      const updatedAssets = result?.data?.digitalAssets || 
                           [...(Array.isArray(localProject.digitalAssets) ? localProject.digitalAssets : []), result?.data?.asset];
      
      console.log('[Upload] 更新资产列表, 数量:', updatedAssets.length);

      // 1. 更新本地 UI 状态
      setLocalProject(prev => ({
        ...prev,
        digitalAssets: updatedAssets
      }));
      
      // 2. 同步到父组件看板 (Dashboard)
      onUpdateProjectDetails(project.id, 'digitalAssets', updatedAssets);
      
      setAiStatus({ message: `文件 "${file.name}" 上传并保存成功！`, type: 'success' });
      
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      setTimeout(() => setAiStatus(null), 3000);
    } catch (error) {
      console.error('File upload failed:', error);
      setAiStatus({ 
        message: `上传失败：${(error as Error)?.message || '请稍后重试'}`, 
        type: 'error' 
      });
      setTimeout(() => setAiStatus(null), 3000);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadingFileName('');
    }
  };

  const handleAddLink = () => {
    const url = prompt('请输入外部链接地址 (URL):', 'https://');
    if (!url) return;
    const name = prompt('请输入资源名称:', '外部资源');
    if (!name) return;

    const newAsset: DigitalAsset = {
      id: `asset-${Date.now()}`,
      name,
      type: 'link',
      url,
      uploadDate: new Date().toISOString().split('T')[0],
      size: '--'
    };

    const updatedAssets = [...(Array.isArray(localProject.digitalAssets) ? localProject.digitalAssets : []), newAsset];
    setLocalProject(prev => ({
      ...prev,
      digitalAssets: updatedAssets
    }));
    onUpdateProjectDetails(project.id, 'digitalAssets', updatedAssets);
    void persistProjectPatch({ digitalAssets: updatedAssets });
  };

  const handleRemoveAsset = (assetId: string) => {
    if (!confirm('确定要移除此资产吗？')) return;
    const updatedAssets = (Array.isArray(localProject.digitalAssets) ? localProject.digitalAssets : []).filter(a => a.id !== assetId);
    
    // 更新本地状态，确保界面实时更新
    setLocalProject(prev => ({
      ...prev,
      digitalAssets: updatedAssets
    }));
    
    onUpdateProjectDetails(project.id, 'digitalAssets', updatedAssets);
    void persistProjectPatch({ digitalAssets: updatedAssets });
  };

  const loadDepartmentMembers = async (departmentId: string) => {
    if (!departmentId) return;
    setLoadingFeishuDirectory(true);
    setFeishuDirectoryError('');
    try {
      // 如果是根节点，获取全员；否则按部门获取
      const endpoint = departmentId === '0' 
        ? '/api/feishu-members-all' 
        : `/api/feishu-members-by-dept?departmentId=${encodeURIComponent(departmentId)}`;
      
      const res = await fetch(endpoint);
      const json = await res.json();
      
      if (res.ok && json?.success && Array.isArray(json.data)) {
        setFeishuDirectoryMembers(json.data);
        if (json.data.length === 0) {
          // 不再报错，仅提示该部门无成员
          setFeishuDirectoryMembers([]);
        }
      } else {
        setFeishuDirectoryMembers([]);
        setFeishuDirectoryError(String(json?.msg || '成员加载失败'));
      }
    } catch (error: any) {
      setFeishuDirectoryMembers([]);
      setFeishuDirectoryError(error?.message || '成员请求失败');
    } finally {
      setLoadingFeishuDirectory(false);
    }
  };

  const loadFeishuDepartments = async () => {
    setLoadingFeishuDirectory(true);
    setFeishuDirectoryError('');
    try {
      const res = await fetch('/api/feishu-org-tree?rootDepartmentId=0&maxNodes=2000');
      const json = await res.json();
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        setFeishuDeptNodes([]);
        setFeishuDirectoryMembers([]);
        setFeishuDirectoryError(String(json?.msg || '组织架构加载失败'));
        return;
      }

      const depts = (json.data as { id: string; name: string; parentId?: string; memberCount?: number }[])
        .map(d => ({ ...d, name: d.name || (d.id === '0' ? '组织根节点' : '未命名部门') }));
      const activeProjectDeptId = project.feishuDeptId || feishuSourceDeptId || '';
      const mergedDepts = [...depts];
      if (activeProjectDeptId && !mergedDepts.some(d => d.id === activeProjectDeptId)) {
        mergedDepts.unshift({
          id: activeProjectDeptId,
          name: '当前项目绑定部门',
          parentId: '0',
          memberCount: feishuMembers.length || 0,
        });
      }
      setFeishuDeptNodes(mergedDepts);

      const defaultDeptId = selectedDirectoryDeptId || '0';
      setSelectedDirectoryDeptId(defaultDeptId);
      await loadDepartmentMembers(defaultDeptId);
    } catch (error: any) {
      setFeishuDeptNodes([]);
      setFeishuDirectoryMembers([]);
      setFeishuDirectoryError(error?.message || '组织架构请求失败');
    } finally {
      setLoadingFeishuDirectory(false);
    }
  };

  const handleOpenFeishuDirectory = async () => {
    setShowFeishuDirectory(true);
    if ((feishuDeptNodes.length === 0 || feishuDirectoryMembers.length === 0) && !loadingFeishuDirectory) {
      await loadFeishuDepartments();
    }
  };

  const handleToggleDirectorySelection = (memberId: string) => {
    setFeishuDirectorySelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleAddSelectedDirectoryMembers = () => {
    if (feishuDirectorySelectedIds.size === 0) return;

    const selectedMembers = feishuDirectoryMembers.filter(m => feishuDirectorySelectedIds.has(m.userId));
    const existing = manualTeamMembers;
    const toAdd: ProjectTeamMember[] = [];

    for (const member of selectedMembers) {
      const exists = existing.some(m => (m.email && member.email && m.email === member.email) || m.name === member.name);
      if (exists) continue;

      toAdd.push({
        id: `tm-feishu-${member.userId || Date.now()}`,
        name: member.name?.trim() || '未知成员',
        role: (member.jobTitle || 'Team Member').trim(),
        dept: 'Feishu Directory',
        email: (member.email || '').trim(),
        mobile: (member.mobile || '').trim(),
        avatar: member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.name || 'member')}`,
        source: 'feishu',
        feishuOpenId: String(member.userId || '').trim() || undefined,
      });
    }

    if (toAdd.length === 0) {
      setAiStatus({ message: '所选成员均已在项目团队中', type: 'info' });
      setTimeout(() => setAiStatus(null), 2000);
      return;
    }

    const updatedMembers = [...existing, ...toAdd];
    const selectedIds = new Set(selectedMembers.map(member => member.userId));
    const updatedExcludedIds = feishuExcludedMemberIds.filter(id => !selectedIds.has(id));
    
    // 1. 同步父组件状态 (Dashboard 会触发防抖保存)
    onUpdateProjectDetails(project.id, 'teamMembers' as keyof ProjectLocation, updatedMembers);
    onUpdateProjectDetails(project.id, 'feishuExcludedMemberIds' as keyof ProjectLocation, updatedExcludedIds);
    
    // 2. 本地持久化 (调用通用 Patch 方法)
    void persistProjectPatch({ 
      teamMembers: updatedMembers, 
      feishuExcludedMemberIds: updatedExcludedIds 
    });

    setFeishuDirectorySelectedIds(new Set());
    setAiStatus({ message: `已添加 ${toAdd.length} 名成员`, type: 'success' });
    setTimeout(() => setAiStatus(null), 2000);
  };

  const filteredFeishuDirectoryMembers = React.useMemo(() => {
    const keyword = feishuDirectoryKeyword.trim().toLowerCase();
    if (!keyword) return feishuDirectoryMembers;
    return feishuDirectoryMembers.filter(member => {
      const content = `${member.name || ''} ${member.enName || ''} ${member.email || ''} ${member.mobile || ''} ${member.jobTitle || ''}`.toLowerCase();
      return content.includes(keyword);
    });
  }, [feishuDirectoryMembers, feishuDirectoryKeyword]);

  const filteredDeptNodes = React.useMemo(() => {
    const keyword = feishuDeptKeyword.trim().toLowerCase();
    if (!keyword) return feishuDeptNodes;
    return feishuDeptNodes.filter(dept => String(dept.name || '').toLowerCase().includes(keyword));
  }, [feishuDeptNodes, feishuDeptKeyword]);

  const deptDepthMap = React.useMemo(() => {
    const parentMap = new Map<string, string>();
    for (const dept of feishuDeptNodes) {
      parentMap.set(dept.id, String(dept.parentId || ''));
    }
    const cache = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (cache.has(id)) return cache.get(id)!;
      let depth = 0;
      let current = id;
      const guard = new Set<string>();
      while (parentMap.has(current)) {
        const parent = parentMap.get(current) || '';
        if (!parent || parent === '0') break;
        if (guard.has(parent)) break;
        guard.add(parent);
        depth += 1;
        current = parent;
        if (depth > 10) break;
      }
      cache.set(id, depth);
      return depth;
    };
    const map = new Map<string, number>();
    for (const dept of feishuDeptNodes) {
      map.set(dept.id, getDepth(dept.id));
    }
    return map;
  }, [feishuDeptNodes]);

  const handleRemoveManualMember = (memberId: string) => {
    if (!isAdmin) return;
    const updatedMembers = manualTeamMembers.filter(member => member.id !== memberId);
    setLocalProject(prev => ({ ...prev, teamMembers: updatedMembers }));
    onUpdateProjectDetails(project.id, 'teamMembers' as keyof ProjectLocation, updatedMembers);
    void persistProjectMemberSettings(updatedMembers, feishuExcludedMemberIds);
  };

  const handleHideFeishuMember = (memberId: string) => {
    const nextExcluded = Array.from(new Set([...(Array.isArray(feishuExcludedMemberIds) ? feishuExcludedMemberIds : []), memberId]));
    setFeishuExcludedMemberIds(nextExcluded);
    setLocalProject(prev => ({ ...prev, feishuExcludedMemberIds: nextExcluded }));
    onUpdateProjectDetails(project.id, 'feishuExcludedMemberIds' as keyof ProjectLocation, nextExcluded);
    void persistProjectMemberSettings(manualTeamMembers, nextExcluded);
    setAiStatus({ message: '成员已从本项目隐藏', type: 'success' });
    setTimeout(() => setAiStatus(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-10">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
      <div className="bg-white w-full max-w-7xl h-full max-h-[100vh] md:max-h-[95vh] rounded-none md:rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 border-0 md:border border-white/10">
        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept=".pdf,.rvt,.ifc,.nwd,.dwg,.skp,.fbx,.obj,.glb,.jpg,.jpeg,.png,.webp,.mp4,.mov,.avi,.doc,.docx,.xls,.xlsx"
        />
        {/* Top Bar */}
        <div className="border-b border-gray-100 flex items-center justify-between px-4 py-3 md:h-20 md:px-10 shrink-0 bg-white">
          <div className="flex items-center gap-3 md:gap-6 min-w-0">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-black text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <HardHat size={24} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-xl font-black uppercase tracking-tighter truncate">{project.name}</h2>
              <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider md:tracking-widest truncate">
                <MapPin size={12} className="text-red-500" /> {project.location} • ID: {project.id}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {isAdmin && (
              <button 
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                className={`hidden md:flex items-center gap-2 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-black text-white hover:bg-red-600'}`}
              >
                {isEditing ? <Save size={14} /> : <Settings size={14} />}
                {isEditing ? 'Save Changes' : 'Edit Details'}
              </button>
            )}
            <button 
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => {
                  setAiStatus({ message: '链接已复制到剪贴板', type: 'success' });
                  setTimeout(() => setAiStatus(null), 3000);
                });
              }}
              className="hidden md:flex items-center gap-2 px-6 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Share2 size={14} /> Share
            </button>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-500 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
          {/* Side Navigation */}
          <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/50 flex flex-col p-3 md:p-6 shrink-0">
            <nav className="flex md:block gap-2 overflow-x-auto md:overflow-visible scrollbar-hide">
              {[
                { id: 'overview', label: '项目概览', icon: <Layout size={16} /> },
                { id: 'timeline', label: '进度追踪', icon: <Clock size={16} /> },
                { id: 'assets', label: '数字化资产', icon: <FileStack size={16} /> },
                { id: 'team', label: '团队协作', icon: <UserIcon size={16} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-auto md:w-full flex items-center gap-2 md:gap-4 px-4 md:px-5 py-3 md:py-4 rounded-2xl text-[11px] md:text-xs font-black uppercase tracking-wider md:tracking-widest transition-all whitespace-nowrap ${
                    activeTab === tab.id ? 'bg-black text-white shadow-xl md:translate-x-2' : 'text-gray-400 hover:bg-white hover:text-black'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>


          </aside>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar bg-white">
            {activeTab === 'overview' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Hero Image */}
                <div className="relative h-48 md:h-80 rounded-[1.25rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <img 
                    src={project.imageUrl || `https://picsum.photos/seed/${project.id}/1200/600`} 
                    alt={project.name} 
                    loading="lazy"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                  <div className="absolute bottom-5 left-5 md:bottom-10 md:left-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-4 py-1 bg-red-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">Live Project</span>
                      <span className="text-white/70 text-xs font-bold uppercase tracking-widest">{project.projectType || 'Commercial Space'}</span>
                    </div>
                    <h3 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">{project.name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-12">
                  <div className="lg:col-span-2 space-y-12">
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600 mb-6 border-b border-red-50 pb-2">项目背景 / Background</h4>
                      {isEditing ? (
                        <textarea 
                          value={editData.description || ''} 
                          onChange={(e) => setEditData({...editData, description: e.target.value})}
                          className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-6 text-sm font-medium leading-relaxed focus:outline-none focus:border-red-500 h-32 resize-none"
                        />
                      ) : (
                        <p className="text-lg font-medium text-gray-700 leading-relaxed italic">
                          "{project.description}"
                        </p>
                      )}
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                      <div className="p-5 md:p-10 bg-gray-50 rounded-[1.25rem] md:rounded-[2.5rem] border border-gray-100 group hover:bg-white hover:shadow-2xl transition-all">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Client Entity</h5>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editData.clientName || ''} 
                            onChange={(e) => setEditData({...editData, clientName: e.target.value})}
                            className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-black focus:outline-none focus:border-red-500"
                          />
                        ) : (
                          <p className="text-2xl font-black text-gray-900 leading-tight">{project.clientName || 'Private Enterprise'}</p>
                        )}
                        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-red-600 uppercase tracking-widest">
                          <Shield size={12} /> Verified Partner
                        </div>
                      </div>
                      <div className="p-5 md:p-10 bg-gray-50 rounded-[1.25rem] md:rounded-[2.5rem] border border-gray-100 group hover:bg-white hover:shadow-2xl transition-all">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Spatial Area</h5>
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={editData.area || ''} 
                            onChange={(e) => setEditData({...editData, area: e.target.value})}
                            className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-black focus:outline-none focus:border-red-500"
                          />
                        ) : (
                          <p className="text-2xl font-black text-gray-900 leading-tight">{project.area || '450 m²'}</p>
                        )}
                        <div className="mt-6 flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <Maximize2 size={12} /> Total Footprint
                        </div>
                      </div>
                      <div className="p-5 md:p-10 bg-gray-50 rounded-[1.25rem] md:rounded-[2.5rem] border border-gray-100 group hover:bg-white hover:shadow-2xl transition-all">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">飞书部门 ID</h5>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.feishuDeptId || ''}
                            onChange={(e) => setEditData({ ...editData, feishuDeptId: e.target.value })}
                            placeholder="例如：od-xxxxxxxxxxxx"
                            className="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-black focus:outline-none focus:border-red-500"
                          />
                        ) : (
                          <p className="text-xs font-bold text-gray-600 break-all">
                            {project.feishuDeptId || '未绑定飞书部门'}
                          </p>
                        )}
                        <div className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          用于从飞书同步团队成员
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 mb-8">核心指标 / Key Metrics</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {[
                          { label: 'Budget Status', value: 'On Track', color: 'text-green-600' },
                          { label: 'Supply Chain', value: 'Active', color: 'text-red-600' },
                          { label: 'Quality Control', value: '98%', color: 'text-black' },
                        ].map((metric, i) => (
                          <div key={i} className="text-center p-6 border border-gray-100 rounded-3xl">
                            <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">{metric.label}</div>
                            <div className={`text-xl font-black uppercase tracking-tighter ${metric.color}`}>{metric.value}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Digital Assets Section in Overview */}
                    <section>
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">数字化资产 / Digital Assets</h4>
                        <button 
                          onClick={() => setActiveTab('assets')}
                          className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline"
                        >
                          View All Assets
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {normalizedAssets.slice(0, 4).map((asset, idx) => (
                          <div key={asset.id || `asset-overview-${idx}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-lg transition-all group">
                            <div className="p-3 bg-white rounded-xl shadow-sm group-hover:bg-red-600 group-hover:text-white transition-all">
                              {getAssetIcon(asset.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-widest truncate">{asset.name}</p>
                              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{asset.type} • {asset.size || '--'}</p>
                            </div>
                            <a 
                              href={asset.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-gray-300 hover:text-black transition-colors"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        ))}
                        {(normalizedAssets.length === 0) && (
                          <div className="col-span-2 py-8 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-gray-400">
                            <FileStack size={24} className="mb-2 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No assets uploaded yet</p>
                          </div>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="md:col-span-2 py-4 bg-white border border-dashed border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-red-500 hover:text-red-600 transition-all flex items-center justify-center gap-2"
                          >
                            <Upload size={14} /> Upload New Asset
                          </button>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 md:p-8 bg-black text-white rounded-[1.25rem] md:rounded-[2.5rem] shadow-2xl">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">Current Progress</h5>
                      <div className="flex items-end gap-2 mb-4">
                        <span className="text-6xl font-black leading-none">{localProject.progress ?? 0}</span>
                        <span className="text-2xl font-black text-red-500 mb-1">%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600" style={{ width: `${localProject.progress ?? 0}%` }}></div>
                      </div>
                      <p className="mt-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                        Estimated Completion:<br/>
                        <span className="text-white">Q4 2024 - DECEMBER</span>
                      </p>
                    </div>

                    <div className="p-6 md:p-8 bg-gray-50 rounded-[1.25rem] md:rounded-[2.5rem] border border-gray-100">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">Key Milestones</h5>
                      <div className="space-y-4">
                        {[
                          { label: 'Site Survey', status: 'Done' },
                          { label: 'Design Approval', status: 'Done' },
                          { label: 'Procurement', status: 'In Progress' },
                        ].map((m, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-700">{m.label}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${m.status === 'Done' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{m.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-right-4 duration-500">
                <ProjectTimeline 
                  lang="cn" 
                  project={localProject} 
                  onTimelineChange={(stages, projectStatus, progress) => {
                    const toChineseStatus = (s: 'pending' | 'inProgress' | 'completed') => {
                      if (s === 'completed') return '已完成';
                      if (s === 'inProgress') return '进行中';
                      return '未开始';
                    };

                    const updatedStages = stages.map(stage => ({
                      ...stage,
                      status: toChineseStatus(stage.status),
                      subSteps: stage.subSteps.map(sub => ({
                        ...sub,
                        title: sub.name,
                        status: toChineseStatus(sub.status),
                      })),
                    }));

                    setLocalProject(prev => ({
                      ...prev,
                      stages: updatedStages as any,
                      status: projectStatus,
                      progress,
                    }));

                    // 回写所有变更字段，确保数据库更新完整
                    onUpdateProjectDetails(project.id, 'stages', updatedStages);
                    onUpdateProjectDetails(project.id, 'status', projectStatus);
                    onUpdateProjectDetails(project.id, 'progress', progress);
                  }}
                  onStatusChange={(stageId, status) => {
                    console.log('Status changed:', stageId, status);
                  }}
                />
              </div>
            )}

            {activeTab === 'assets' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter">数字化资产 / Assets</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">BIM models, drawings, and legal documents</p>
                    {isUploading && (
                      <p className="mt-2 text-[10px] font-black text-red-600 uppercase tracking-widest">
                        Uploading {uploadingFileName} ... {uploadProgress}%
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleAddLink} className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm">
                      <LinkIcon size={16} /> Add Link
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Upload size={16} /> {isUploading ? `Uploading ${uploadProgress}%` : 'Upload Asset'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {normalizedAssets.length > 0 ? (
                    normalizedAssets.map((asset, idx) => (
                      <div key={asset.id || `asset-full-${idx}`} className="bg-gray-50 border border-gray-100 rounded-[2rem] p-8 hover:bg-white hover:shadow-2xl transition-all group cursor-pointer">
                        <div className="flex justify-between items-start mb-8">
                          <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:bg-red-600 group-hover:text-white transition-all">
                            {getAssetIcon(asset.type)}
                          </div>
                          <div className="flex gap-2">
                            {asset.name.toLowerCase().endsWith('.glb') && (
                              <button 
                                onClick={() => setPreviewModel({ url: asset.url, name: asset.name })}
                                className="p-2 text-red-500 hover:text-red-600 transition-colors" 
                                title="3D Preview"
                              >
                                <Box size={16} />
                              </button>
                            )}
                            {asset.name.toLowerCase().endsWith('.pdf') && (
                              <a 
                                href={asset.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 text-blue-500 hover:text-blue-600 transition-colors"
                                title="PDF Preview"
                              >
                                <FileText size={16} />
                              </a>
                            )}
                            {asset.name.toLowerCase().endsWith('.xlsx') || asset.name.toLowerCase().endsWith('.xls') && (
                              <a 
                                href={asset.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 text-green-500 hover:text-green-600 transition-colors"
                                title="Excel Preview"
                              >
                                <FileArchive size={16} />
                              </a>
                            )}
                            <a href={asset.url} download={asset.name} className="p-2 text-gray-300 hover:text-black transition-colors" title="Download">
                              <Download size={16} />
                            </a>
                            <button onClick={() => handleRemoveAsset(asset.id)} className="p-2 text-gray-300 hover:text-red-600 transition-colors" title="Remove">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-2">{asset.name}</h5>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>{asset.type}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                          <span>{asset.size || '2.4 MB'}</span>
                        </div>
                        <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Added: {asset.uploadDate}</span>
                          <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white overflow-hidden">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${asset.id}`} alt="uploader" loading="lazy" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-32 border-2 border-dashed border-gray-100 rounded-[3rem] flex flex-col items-center justify-center text-center gap-6">
                      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
                        <FileStack size={40} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-300 uppercase tracking-widest">No Digital Assets Found</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Upload your first drawing or BIM model</p>
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="px-8 py-3 bg-gray-100 text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-black hover:text-white transition-all">
                        Upload Now
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'team' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-left-4 duration-500">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter">团队协作 / Team</h3>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Project managers, designers, and local contractors</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleOpenFeishuDirectory}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm"
                      >
                        <UserPlus size={14} />
                        从飞书全员添加
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 仅显示已手动添加或从全员目录选中的成员 */}
                  {manualTeamMembers.map((member) => (
                    <div key={member.id} className="bg-gray-50 border border-gray-100 rounded-[2.5rem] p-8 flex items-center gap-6 hover:bg-white hover:shadow-2xl transition-all group">
                      <div className="w-20 h-20 rounded-3xl bg-white shadow-sm overflow-hidden border border-gray-100 group-hover:border-red-500 transition-all">
                        <img src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} alt={member.name} loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1">
                        <h5 className="text-lg font-black text-gray-900 mb-1">{member.name}</h5>
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">{member.role || 'Project Member'}</p>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Shield size={12} /> {member.dept || 'Project Team'}</span>
                          {(member.email || member.mobile) && (
                            <span className="flex items-center gap-1"><Send size={12} /> {member.email || member.mobile}</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveManualMember(member.id)}
                          className="p-3 bg-white rounded-xl shadow-sm text-gray-300 hover:text-red-600 transition-colors"
                          title="Remove Member"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                  {manualTeamMembers.length === 0 && (
                    <div className="col-span-full py-14 border-2 border-dashed border-gray-100 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-3">
                      <UserIcon size={28} className="text-gray-300" />
                      <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No team members selected</p>
                      {isAdmin && (
                        <p className="text-[10px] font-bold text-gray-400 max-w-sm px-4">
                          请点击右上角「从飞书全员添加」，在飞书全员目录中选择成员加入本项目。
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 移除自动显示的飞书成员部分，统一由全员目录添加 */}
              </div>
            )}
          </main>
        </div>
      </div>
      {previewModel && (
        <ModelPreview 
          url={previewModel.url} 
          name={previewModel.name} 
          onClose={() => setPreviewModel(null)} 
        />
      )}
      {showFeishuDirectory && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFeishuDirectory(false)}></div>
          <div className="relative w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest">从飞书全员目录添加</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">支持按姓名 / 邮箱 / 手机搜索</p>
              </div>
              <button onClick={() => setShowFeishuDirectory(false)} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <input
                type="text"
                value={feishuDirectoryKeyword}
                onChange={(e) => setFeishuDirectoryKeyword(e.target.value)}
                placeholder="搜索当前部门成员（姓名、邮箱、手机号）"
                className="flex-1 bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-red-500"
              />
              <button
                onClick={loadFeishuDepartments}
                disabled={loadingFeishuDirectory}
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50"
              >
                刷新架构
              </button>
              <button
                onClick={handleAddSelectedDirectoryMembers}
                disabled={feishuDirectorySelectedIds.size === 0}
                className="px-5 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-40"
              >
                添加已选（{feishuDirectorySelectedIds.size}）
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-gray-50/40 grid grid-cols-12">
              <div className="col-span-4 border-r border-gray-100 bg-white p-4 overflow-y-auto">
                <div className="mb-3">
                  <input
                    type="text"
                    value={feishuDeptKeyword}
                    onChange={(e) => setFeishuDeptKeyword(e.target.value)}
                    placeholder="搜索部门"
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg p-2.5 text-xs font-bold focus:outline-none focus:border-red-500"
                  />
                </div>
                <div className="space-y-2">
                  {filteredDeptNodes.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => {
                        setSelectedDirectoryDeptId(dept.id);
                        setFeishuDirectorySelectedIds(new Set());
                        void loadDepartmentMembers(dept.id);
                      }}
                      className={`w-full text-left py-2.5 pr-3 rounded-xl border text-xs font-bold transition-all ${
                        selectedDirectoryDeptId === dept.id
                          ? 'border-black bg-black text-white'
                          : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-300'
                      }`}
                      style={{ paddingLeft: `${12 + Math.min((deptDepthMap.get(dept.id) || 0), 6) * 14}px` }}
                    >
                      <div className="truncate">{dept.name || '未命名部门'}</div>
                      <div className={`text-[10px] ${selectedDirectoryDeptId === dept.id ? 'text-white/70' : 'text-gray-400'}`}>
                        {dept.memberCount || 0} 人
                      </div>
                    </button>
                  ))}
                  {!loadingFeishuDirectory && filteredDeptNodes.length === 0 && (
                    <div className="text-center text-[11px] text-gray-400 py-6">暂无可见部门</div>
                  )}
                </div>
              </div>
              <div className="col-span-8 overflow-y-auto p-6">
              {loadingFeishuDirectory && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="animate-spin text-[#E1251B]" size={16} />
                  正在加载部门成员...
                </div>
              )}
              {!loadingFeishuDirectory && feishuDirectoryError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                  加载失败：{feishuDirectoryError}
                </div>
              )}
              {!loadingFeishuDirectory && !feishuDirectoryError && filteredFeishuDirectoryMembers.length === 0 && (
                <div className="text-center text-xs font-bold text-gray-400 py-12 uppercase tracking-widest">
                  没有匹配的成员
                </div>
              )}
              <div className="space-y-3">
                {filteredFeishuDirectoryMembers.map(member => (
                  <div
                    key={member.userId}
                    className={`bg-white border rounded-2xl px-4 py-3 flex items-center justify-between gap-4 cursor-pointer transition-all ${
                      feishuDirectorySelectedIds.has(member.userId) ? 'border-black ring-1 ring-black/5 bg-gray-50' : 'border-gray-100 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleDirectorySelection(member.userId)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-black shrink-0 ${
                          feishuDirectorySelectedIds.has(member.userId) ? 'bg-black border-black text-white' : 'bg-white border-gray-300 text-transparent'
                        }`}
                      >
                        ✓
                      </div>
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <UserIcon size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-gray-900 truncate">{member.name || '未命名成员'}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">
                          {member.jobTitle || 'Team Member'}{member.email ? ` • ${member.email}` : member.mobile ? ` • ${member.mobile}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap pl-2">
                      {member.email || member.mobile || '无联系方式'}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                已选中 {feishuDirectorySelectedIds.size} 名成员
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFeishuDirectory(false)}
                  className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleAddSelectedDirectoryMembers}
                  disabled={feishuDirectorySelectedIds.size === 0}
                  className="px-8 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl disabled:opacity-30 disabled:hover:bg-black"
                >
                  加入项目
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailsView;
