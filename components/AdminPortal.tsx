
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Briefcase, Database, Search, Filter, MoreHorizontal, 
  CheckCircle2, XCircle, Clock, Trash2, Mail, Phone, MapPin, 
  ExternalLink, ArrowLeft, Download, Eye, Shield, User as UserIcon,
  Layout, QrCode, Box, Link as LinkIcon, Building2, Ruler, Map, Save, Sparkles, Send, Loader2,
  FileText, ShieldCheck, FilePlus, X, FileBox, Plus, Image as ImageIcon, Video, FileArchive
} from 'lucide-react';
import { Lead, User, ProjectLocation, DigitalAsset } from '../types';
import { fetchAiGeneratedProject, serverAiPayloadToProjectLocation } from '../utils/fetchAiGeneratedProject';
import { hydrateMissingProjectGeocodes } from '../utils/hydrateProjectGeocodes';
import ModelPreview from './ModelPreview';
import ProjectTimeline from './ProjectTimeline';

const API_KEY = import.meta.env.VITE_AMAP_API_KEY || '';


interface AdminPortalProps {
  projects: ProjectLocation[];
  setProjects: React.Dispatch<React.SetStateAction<ProjectLocation[]>>;
  onBack: () => void;
  lang: 'cn' | 'en' | 'de';
}

const AdminPortal: React.FC<AdminPortalProps> = ({ projects, setProjects, onBack, lang }) => {
  const [activeTab, setActiveTab] = useState<'leads' | 'users' | 'projects'>('projects');
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  console.log('初始leads状态:', leads);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [previewModel, setPreviewModel] = useState<{ url: string, name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiStatus, setAiStatus] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);
  const [address, setAddress] = useState('');
  const [coordinateStatus, setCoordinateStatus] = useState<{message: string, type: 'info' | 'success' | 'error'} | null>(null);

  // 地理编码函数：根据地址获取经纬度
  const getCoordinatesFromAddress = async (addr: string) => {
    if (!API_KEY) {
      setCoordinateStatus({ message: '高德地图API密钥未配置', type: 'error' });
      return null;
    }

    setCoordinateStatus({ message: '正在获取坐标...', type: 'info' });
    try {
      const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${API_KEY}&address=${encodeURIComponent(addr)}`);
      const data = await response.json();
      
      if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
        const location = data.geocodes[0].location.split(',');
        const [lng, lat] = location.map(Number);
        setCoordinateStatus({ message: '坐标获取成功', type: 'success' });
        return [lat, lng] as [number, number];
      } else {
        setCoordinateStatus({ message: '地址解析失败，请检查地址是否正确', type: 'error' });
        return null;
      }
    } catch (error) {
      console.error('地理编码失败:', error);
      setCoordinateStatus({ message: '网络错误，请稍后重试', type: 'error' });
      return null;
    }
  };

  useEffect(() => {
    // Load Users from API
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/list-users');
        const result = await response.json();
        console.log('用户API响应:', result);
        if ((result.code === 200 || result.code === 0) && Array.isArray(result.data)) {
          setUsers(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();

    // Load Leads from API
    const fetchLeads = async () => {
      console.log('开始获取商机线索数据...');
      try {
        const response = await fetch('/api/list-campaign');
        console.log('商机线索API响应状态:', response.status);
        const result = await response.json();
        console.log('商机线索API响应数据:', result);
        if ((result.code === 200 || result.code === 0) && Array.isArray(result.data)) {
          console.log('商机线索数据:', result.data);
          const mappedLeads: Lead[] = result.data.map((l: any) => ({
            id: l.id.toString(),
            name: l.full_name || l.name,
            email: l.email,
            phone: l.phone,
            city: l.preferred_city || l.city,
            budget: l.investment_budget || l.budget,
            date: l.create_time || l.date,
            status: l.status || 'pending'
          }));
          console.log('映射后的商机线索数据:', mappedLeads);
          setLeads(mappedLeads);
        } else {
          console.log('商机线索API响应不符合预期:', result);
        }
      } catch (error) {
        console.error('获取商机线索失败:', error);
      }
    };
    fetchLeads();
  }, []);

  const handleDeleteLead = async (id: string) => {
    if (window.confirm('确认删除该线索吗？')) {
      try {
        const response = await fetch('/api/delete-campaign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (result.code === 200 || result.code === 0) {
          setLeads(leads.filter(l => l.id !== id));
        } else {
          alert(result.msg || '删除失败');
        }
      } catch (error) {
        console.error('Failed to delete lead:', error);
        alert('网络错误，请稍后重试');
      }
    }
  };

  const handleUpdateLeadStatus = async (id: string, status: Lead['status']) => {
    try {
      const response = await fetch('/api/update-campaign-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const result = await response.json();
      if (result.code === 200 || result.code === 0) {
        setLeads(leads.map(l => l.id === id ? { ...l, status } : l));
      } else {
        alert(result.msg || '更新失败');
      }
    } catch (error) {
      console.error('Failed to update lead status:', error);
      alert('网络错误，请稍后重试');
    }
  };

  const handleUpdateProject = (id: string, field: keyof ProjectLocation, value: any) => {
    setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSaveProject = async (project: ProjectLocation) => {
    try {
      setIsProcessing(true);
      const response = await fetch('/api/save-project-detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project)
      });
      const result = await response.json();
      if (result.code === 200 || result.code === 0) {
        setAiStatus({ message: lang === 'cn' ? '项目已保存' : 'Project saved', type: 'success' });
      } else {
        setAiStatus({ message: result.msg || '保存失败', type: 'error' });
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      setAiStatus({ message: '网络错误', type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (window.confirm(lang === 'cn' ? '确认删除该项目及其所有关联数据吗？' : 'Are you sure you want to delete this project and all its data?')) {
      try {
        const response = await fetch('/api/delete-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        const result = await response.json();
        if (result.code === 200 || result.code === 0) {
          setProjects(prev => (Array.isArray(prev) ? prev : []).filter(p => p.id !== id));
          setAiStatus({ message: lang === 'cn' ? '项目已删除' : 'Project deleted', type: 'success' });
        } else {
          alert(result.msg || '删除失败');
        }
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('网络错误');
      } finally {
        setTimeout(() => setAiStatus(null), 3000);
      }
    }
  };

  const cycleProjectStatus = (current: string | undefined | null): '待启动' | '进行中' | '已完成' | '维护中' => {
    const order: Array<'待启动' | '进行中' | '已完成' | '维护中'> = ['待启动', '进行中', '已完成', '维护中'];
    const normalized = (current || '').trim() as any;
    const idx = order.indexOf(normalized) >= 0 ? order.indexOf(normalized) : 0;
    return order[(idx + 1) % order.length];
  };

  const handleToggleProjectStatus = (project: ProjectLocation) => {
    const nextStatus = cycleProjectStatus(project.status as string | undefined);
    const updated: ProjectLocation = { ...project, status: nextStatus };

    // 当管理员设为"已完成"时，同步将所有 stages 和 subSteps 也标记为已完成
    if (nextStatus === '已完成' && Array.isArray(updated.stages)) {
      updated.stages = updated.stages.map((stage: any) => ({
        ...stage,
        status: '已完成',
        subSteps: Array.isArray(stage.subSteps)
          ? stage.subSteps.map((sub: any) => ({ ...sub, status: '已完成' }))
          : []
      }));
      updated.progress = 100;
    } else if (nextStatus === '待启动' && Array.isArray(updated.stages)) {
      // 重置为待启动时，所有阶段也重置
      updated.stages = updated.stages.map((stage: any) => ({
        ...stage,
        status: '未开始',
        subSteps: Array.isArray(stage.subSteps)
          ? stage.subSteps.map((sub: any) => ({ ...sub, status: '未开始' }))
          : []
      }));
      updated.progress = 0;
    }

    setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => (p.id === project.id ? updated : p)));
    void handleSaveProject(updated);
  };

  const handleAddAsset = async (projectId: string, asset: DigitalAsset) => {
    let updatedProject: ProjectLocation | null = null;
    setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => {
      if (p.id === projectId) {
        // Filter out any assets with blob URLs (temporary URLs that will expire)
        const existingAssets = Array.isArray(p.digitalAssets) ? p.digitalAssets : [];
        const filteredAssets = existingAssets.filter(asset => asset && asset.url && !asset.url.startsWith('blob:'));
        updatedProject = { ...p, digitalAssets: [...filteredAssets, asset] };
        return updatedProject;
      }
      return p;
    }));

    if (updatedProject) {
      await handleSaveProject(updatedProject);
    }
  };

  const handleRemoveAsset = async (projectId: string, assetId: string) => {
    let updatedProject: ProjectLocation | null = null;
    setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => {
      if (p.id === projectId) {
        updatedProject = { ...p, digitalAssets: (Array.isArray(p.digitalAssets) ? p.digitalAssets : []).filter(a => a.id !== assetId) };
        return updatedProject;
      }
      return p;
    }));

    if (updatedProject) {
      await handleSaveProject(updatedProject);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingProjectId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    
    setIsProcessing(true);
    setAiStatus({ message: lang === 'cn' ? "正在上传文件..." : "Uploading file...", type: 'info' });

    try {
      const formData = new FormData();
      formData.append('projectId', editingProjectId);
      formData.append('file', file);
      const response = await fetch(`/api/upload?projectId=${encodeURIComponent(editingProjectId)}`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      const uploadedUrl = result?.data?.url || result?.url;
      if (result.code === 200 && uploadedUrl) {
        // Determine file type
        const ext = (file.name || '').split('.').pop()?.toLowerCase();
        let type: DigitalAsset['type'] = 'list';
        
        if (ext === 'pdf') type = 'pdf';
        else if (ext === 'rvt') type = 'rvt';
        else if (['ifc', 'nwd', 'dwg', 'skp', 'fbx', 'obj', 'glb'].includes(ext || '')) type = 'model';
        else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) type = 'image';
        else if (['mp4', 'mov', 'avi'].includes(ext || '')) type = 'video';
        else if (['doc', 'docx', 'xls', 'xlsx'].includes(ext || '')) type = 'contract';

        const newAsset: DigitalAsset = {
          id: `asset-${Date.now()}`,
          name: file.name,
          url: uploadedUrl,
          type,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
          uploadDate: new Date().toISOString().split('T')[0]
        };
        
        await handleAddAsset(editingProjectId, newAsset);
        
        setAiStatus({ 
          message: lang === 'cn' ? `文件 "${file.name}" 上传成功！` : `File "${file.name}" uploaded successfully!`, 
          type: 'success' 
        });
      } else {
        setAiStatus({ message: result.msg || '上传失败', type: 'error' });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setAiStatus({ message: '上传出错', type: 'error' });
    } finally {
      setIsProcessing(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const [showExternalLinkModal, setShowExternalLinkModal] = useState(false);
  const [externalLinkUrl, setExternalLinkUrl] = useState('');
  const [externalLinkName, setExternalLinkName] = useState('External Resource');

  const handleAddExternalLink = () => {
    if (!editingProjectId) return;
    setExternalLinkUrl('');
    setExternalLinkName('External Resource');
    setShowExternalLinkModal(true);
  };

  const handleExternalLinkSubmit = () => {
    if (!externalLinkUrl || !externalLinkName) return;

    const newAsset: DigitalAsset = {
      id: `asset-${Date.now()}`,
      name: externalLinkName,
      url: externalLinkUrl,
      type: 'link',
      uploadDate: new Date().toISOString().split('T')[0]
    };
    
    handleAddAsset(editingProjectId, newAsset);
    setShowExternalLinkModal(false);
  };

  const handleAddUser = async () => {
    const username = window.prompt('请输入用户名:');
    if (!username) return;
    const role = window.prompt('请输入角色 (admin/user/guest):', 'user');
    if (!role) return;
    const password = window.prompt('请输入初始密码:', '123456');
    if (!password) return;

    try {
      const response = await fetch('/api/save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, role, password, status: 'active' })
      });
      const result = await response.json();
      if (result.code === 200 || result.code === 0) {
        // Refresh users list
        const res = await fetch('/api/list-users');
        const data = await res.json();
        if (data.code === 200 || data.code === 0) setUsers(data.data);
        alert('用户创建成功');
      } else {
        alert(result.msg || '创建失败');
      }
    } catch (error) {
      console.error('Failed to add user:', error);
      alert('网络错误');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === 'admin') return alert('不能删除管理员');
    if (!window.confirm(`确认删除用户 ${username} 吗？`)) return;

    try {
      const response = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await response.json();
      if (result.code === 200 || result.code === 0) {
        setUsers(users.filter(u => u.username !== username));
      } else {
        alert(result.msg || '删除失败');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert('网络错误');
    }
  };

  const handleAIAddProject = async () => {
    if (!aiPrompt.trim() || isProcessing) return;
    setIsProcessing(true);
    setAiStatus({ message: lang === 'cn' ? "AI 正在分析项目详情..." : "AI analyzing project details...", type: 'info' });
    try {
      const { data, geocodeWarning } = await fetchAiGeneratedProject(aiPrompt);
      const newProj = serverAiPayloadToProjectLocation(data);
      setProjects((prev) => [newProj, ...prev]);
      setAiPrompt('');
      void (async () => {
        try {
          const patches = await hydrateMissingProjectGeocodes([newProj]);
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
          /* ignore */
        }
      })();
      const ok =
        lang === 'cn' ? '解析成功！项目已创建。' : 'Successfully added!';
      setAiStatus({
        message:
          geocodeWarning && lang === 'cn'
            ? `${ok}（地理编码降级：${geocodeWarning}）`
            : geocodeWarning
              ? `${ok} Geocode: ${geocodeWarning}`
              : ok,
        type: geocodeWarning ? 'info' : 'success',
      });
    } catch (err) {
      console.error('AI project creation failed:', err);
      setAiStatus({ message: lang === 'cn' ? "AI 服务暂时不可用，请通过项目列表手动添加" : "AI service unavailable, add project manually", type: 'info' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const handleSeedMaterials = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setAiStatus({ message: lang === 'cn' ? "正在导入种子材料数据..." : "Seeding materials...", type: 'info' });
    try {
      const response = await fetch('/api/seed-materials', { method: 'POST' });
      const result = await response.json();
      if (result.code === 200 || result.code === 0) {
        setAiStatus({ message: lang === 'cn' ? "材料导入成功！" : "Materials seeded successfully!", type: 'success' });
      } else {
        setAiStatus({ message: result.msg || "导入失败", type: 'error' });
      }
    } catch (error) {
      setAiStatus({ message: "网络错误", type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setAiStatus(null), 3000);
    }
  };

  const content = {
    cn: {
      title: "仁力烨升·管理系统",
      leads: "商机线索",
      users: "权限管理",
      projects: "项目资产管理",
      search: "搜索项目、文档...",
      name: "项目/品牌名称",
      location: "落地城市",
      area: "规模",
      status: "阶段",
      actions: "操作",
      aiHelperTitle: "AI 智慧云录入",
      aiHelperDesc: "输入一段文字描述（如：在柏林增加一个400平米的小龙坎旗舰店），AI将自动提取地理坐标与基础参数。",
      btnGenerate: "解析并入库",
      assetTitle: "数字化资产库",
      uploadBtn: "上传本地文档",
      addLink: "添加外部链接",
      noAssets: "暂无关联的数字图纸或文档",
      fileType: "类型",
      fileName: "资产名称",
      fileSize: "大小",
      uploadDate: "上传时间"
    },
    en: {
      title: "RENLI Admin Hub",
      leads: "Global Leads",
      users: "Permissions",
      projects: "Project Assets",
      search: "Search projects/files...",
      name: "Brand/Name",
      location: "Global City",
      area: "Scale",
      status: "Phase",
      actions: "Actions",
      aiHelperTitle: "AI Intelligent Ingest",
      aiHelperDesc: "Describe a project briefly to generate a new node and map coordinates automatically.",
      btnGenerate: "Parse & Ingest",
      assetTitle: "Digital Assets Vault",
      uploadBtn: "Upload Document",
      addLink: "Add External Link",
      noAssets: "No digital assets linked to this project",
      fileType: "Type",
      fileName: "Asset Name",
      fileSize: "Size",
      uploadDate: "Date"
    }
  }[lang === 'de' ? 'en' : lang];

  // 先排序，再过滤
  const sortedProjects = (Array.isArray(projects) ? projects : []).sort((a, b) => {
    const dateA = new Date(a.createdAt || a.create_time || 0).getTime();
    const dateB = new Date(b.createdAt || b.create_time || 0).getTime();
    return dateB - dateA; // 降序排序
  });
  const filteredProjects = sortedProjects.filter(p => (p.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || (p.location || '').toLowerCase().includes((searchTerm || '').toLowerCase()));
  const currentEditingProject = React.useMemo(() => {
    return (Array.isArray(projects) ? projects : []).find(p => p.id === editingProjectId);
  }, [projects, editingProjectId]);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="text-red-500" />;
      case 'rvt': return <Box className="text-blue-500" />;
      case 'model': return <FileBox className="text-indigo-500" />;
      case 'image': return <ImageIcon className="text-green-500" />;
      case 'video': return <Video className="text-purple-500" />;
      case 'contract': return <ShieldCheck className="text-orange-500" />;
      case 'link': return <LinkIcon className="text-blue-400" />;
      case 'qr': return <QrCode className="text-gray-800" />;
      default: return <FileArchive className="text-gray-400" />;
    }
  };

  return (
    <div className="h-screen bg-[#F8F9FA] flex flex-col overflow-hidden font-sans">
      {showExternalLinkModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowExternalLinkModal(false)}></div>
          <div className="bg-white rounded-[3rem] w-full max-w-md p-12 shadow-2xl relative animate-in zoom-in-95 duration-300 border border-white/10">
            <button onClick={() => setShowExternalLinkModal(false)} className="absolute top-10 right-10 text-gray-400 hover:text-black transition-colors p-2 bg-gray-50 rounded-full">
              <X size={24} />
            </button>
            
            <div className="flex items-center gap-6 mb-12">
              <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-black/20">
                <LinkIcon size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tighter leading-none mb-2">添加外部链接</h2>
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em]">Add External Link</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">链接地址 / URL</label>
                <input 
                  type="url" 
                  required 
                  value={externalLinkUrl} 
                  onChange={(e) => setExternalLinkUrl(e.target.value)} 
                  placeholder="https://example.com" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">链接名称 / Name</label>
                <input 
                  type="text" 
                  required 
                  value={externalLinkName} 
                  onChange={(e) => setExternalLinkName(e.target.value)} 
                  placeholder="External Resource" 
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                />
              </div>
              
              <div className="pt-6 flex gap-4">
                <button onClick={() => setShowExternalLinkModal(false)} className="flex-1 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">
                  取消 / Cancel
                </button>
                <button onClick={handleExternalLinkSubmit} className="flex-1 bg-black text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-red-600 transition-all">
                  确认添加 / Add Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="h-16 bg-white border-b border-gray-200 px-8 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-[#1A1A1A]">{content.title}</h1>
            <p className="text-[10px] font-bold text-[#E1251B] uppercase tracking-tighter">Secure Administration Portal</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={content.search} className="bg-gray-50 border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold w-72 focus:outline-none focus:border-[#E1251B] transition-all" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-2 shrink-0">
           <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'projects' ? 'bg-[#E1251B] text-white shadow-xl translate-x-1' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Building2 size={18} /><span>{content.projects}</span>
           </button>
           <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'leads' ? 'bg-[#E1251B] text-white shadow-xl translate-x-1' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Briefcase size={18} /><span>{content.leads}</span>
           </button>
           <button onClick={() => setActiveTab('users')} className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase transition-all ${activeTab === 'users' ? 'bg-[#E1251B] text-white shadow-xl translate-x-1' : 'text-gray-400 hover:bg-gray-50'}`}>
              <Shield size={18} /><span>{content.users}</span>
           </button>
           
           <div className="mt-auto pt-6 border-t border-gray-100">
             <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 px-4">System Tools</p>
             <button 
               onClick={handleSeedMaterials}
               disabled={isProcessing}
               className="w-full flex items-center gap-3 p-4 rounded-2xl text-xs font-black uppercase text-gray-400 hover:bg-gray-50 transition-all disabled:opacity-50"
             >
               <Database size={18} />
               <span>Seed Materials</span>
             </button>
           </div>
        </nav>

        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/50">
           {activeTab === 'projects' && (
             <div className="space-y-8 animate-in fade-in duration-500">
               {/* Project List Table */}
               <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{content.name}</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{content.location}</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{content.area}</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">{content.status}</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">{content.actions}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {(filteredProjects || []).map(project => (
                          <tr key={project.id} className={`hover:bg-gray-50/80 transition-colors group ${editingProjectId === project.id ? 'bg-red-50/30' : ''}`}>
                             <td className="px-6 py-5 font-black text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{project.name}</td>
                             <td className="px-6 py-5 text-xs font-bold text-gray-500 uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{project.location}</td>
                             <td className="px-6 py-5 text-xs font-black text-gray-900">{project.area || '--'}</td>
                             <td className="px-6 py-5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleProjectStatus(project)}
                                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer border border-transparent hover:border-gray-200 transition-colors ${
                                  project.status === '已完成' ? 'bg-green-50 text-green-600' : 
                                  project.status === '进行中' ? 'bg-red-50 text-[#E1251B]' : 
                                  project.status === '待启动' ? 'bg-yellow-50 text-yellow-500' :
                                  'bg-gray-50 text-gray-500'
                                }`}
                                >
                                   {project.status}
                                </button>
                             </td>
                             <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => setEditingProjectId(project.id === editingProjectId ? null : project.id)} 
                                    className={`p-2 rounded-lg transition-all ${editingProjectId === project.id ? 'bg-[#E1251B] text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-black'}`}
                                    title="管理项目资产"
                                  >
                                    <FileBox size={18} />
                                  </button>
                                  <button onClick={() => handleDeleteProject(project.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                </div>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               {/* Asset Management Panel (Dynamic based on selected project) */}
               {currentEditingProject && (
                 <div className="bg-white rounded-[2.5rem] border border-gray-100 p-10 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                    <div className="flex justify-between items-start mb-10">
                       <div className="flex items-center gap-5">
                         <div className="w-16 h-16 bg-[#E1251B] text-white rounded-3xl flex items-center justify-center shadow-xl shadow-red-500/20"><FileBox size={32} /></div>
                         <div>
                            <h2 className="text-2xl font-black text-[#1A1A1A]">{currentEditingProject.name}</h2>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{content.assetTitle}</p>
                         </div>
                       </div>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleSaveProject(currentEditingProject)} 
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {lang === 'cn' ? '保存更改' : 'Save Changes'}
                          </button>
                          <button onClick={() => setEditingProjectId(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={24} /></button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                       <div className="lg:col-span-2 space-y-4">
                          <div className="flex justify-between items-center px-4 mb-4">
                             <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">已上线资产 ({currentEditingProject.digitalAssets?.length || 0})</h3>
                             <div className="flex gap-3">
                                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#E1251B] transition-all shadow-lg">
                                   <FilePlus size={14} /> {content.uploadBtn}
                                </button>
                                <button onClick={handleAddExternalLink} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-200 text-gray-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-sm">
                                   <LinkIcon size={14} /> {content.addLink}
                                </button>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                             {(currentEditingProject.digitalAssets && (currentEditingProject.digitalAssets || []).filter((a: any) => a && a.url).length > 0) ? (
                               (currentEditingProject.digitalAssets || []).filter((a: any) => a && a.url).map(asset => (
                                 <div key={asset.id} className="bg-gray-50/50 border border-gray-100 p-5 rounded-3xl flex items-center justify-between group/asset hover:bg-white hover:shadow-xl transition-all">
                                    <div className="flex items-center gap-5">
                                       <div className="p-3 bg-white rounded-2xl shadow-sm">{getAssetIcon(asset.type)}</div>
                                       <div>
                                          <p className="text-sm font-black text-gray-900 mb-1">{asset.name}</p>
                                          <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                                             <span>{asset.type}</span>
                                             <span>{asset.size || '--'}</span>
                                             <span>{asset.uploadDate}</span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover/asset:opacity-100 transition-opacity">
                                       {(asset.type === 'model' || asset.url.toLowerCase().endsWith('.glb')) && (
                                         <button 
                                           onClick={() => setPreviewModel({ url: asset.url, name: asset.name })}
                                           className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors" 
                                           title="3D Preview"
                                         >
                                           <Box size={16} />
                                         </button>
                                       )}
                                       {(asset.type === 'pdf' || asset.url.toLowerCase().endsWith('.pdf')) && (
                                         <a 
                                           href={asset.url} 
                                           target="_blank" 
                                           className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                                           title="PDF Preview"
                                         >
                                           <FileText size={16} />
                                         </a>
                                       )}
                                       {(asset.type === 'contract' || asset.url.toLowerCase().endsWith('.xlsx') || asset.url.toLowerCase().endsWith('.xls')) && (
                                         <a 
                                           href={asset.url} 
                                           target="_blank" 
                                           className="p-2.5 text-green-500 hover:bg-green-50 rounded-xl transition-colors"
                                           title="Excel Preview"
                                         >
                                           <FileArchive size={16} />
                                         </a>
                                       )}
                                       <a 
                                         href={asset.url} 
                                         download={asset.name}
                                         className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                                         title="Download File"
                                       >
                                         <Download size={16} />
                                       </a>
                                       <button onClick={() => handleRemoveAsset(currentEditingProject.id, asset.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                    </div>
                                 </div>
                               ))
                             ) : (
                               <div className="py-20 flex flex-col items-center justify-center text-center gap-4 bg-gray-50/30 rounded-[2rem] border-2 border-dashed border-gray-100">
                                  <FileBox size={48} className="text-gray-200" />
                                  <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">{content.noAssets}</p>
                               </div>
                             )}
                          </div>
                       </div>
                       
                       <div className="space-y-6">
                          <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6">
                             <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 mb-4">项目快速修订</h4>
                             <div className="space-y-4">
                                <div>
                                   <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">完成日期</label>
                                   <input type="date" value={currentEditingProject.completionDate || ''} onChange={(e) => handleUpdateProject(currentEditingProject.id, 'completionDate', e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-[#E1251B]" />
                                </div>
                                <div>
                                   <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">项目规模 (m²)</label>
                                   <input type="text" value={currentEditingProject.area || ''} onChange={(e) => handleUpdateProject(currentEditingProject.id, 'area', e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-[#E1251B]" />
                                </div>
                                <div>
                                   <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">详情描述</label>
                                   <textarea value={currentEditingProject.description || ''} onChange={(e) => handleUpdateProject(currentEditingProject.id, 'description', e.target.value)} className="w-full bg-white border border-gray-100 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-[#E1251B] h-32 resize-none" />
                                </div>
                             </div>
                          </div>
                          
                          <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6">
                             <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 mb-4">项目进度追踪</h4>
                             <ProjectTimeline 
                               lang={lang} 
                               project={currentEditingProject} 
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

                                 setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => {
                                   if (p.id !== currentEditingProject.id) return p;
                                   // 维护中 由管理员手动设置，进度追踪不应覆盖
                                   const keepStatus = p.status === '维护中' ? '维护中' : projectStatus;
                                   return { ...p, stages: updatedStages as any, status: keepStatus, progress };
                                 }));
                               }}
                               onStatusChange={(stageId, status) => {
                                 console.log('Status changed:', stageId, status);
                               }}
                             />
                          </div>
                       </div>
                    </div>
                 </div>
               )}

               {/* AI Intelligent Ingest */}
               <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-[100px] opacity-20 -z-0"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-8">
                      <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><Sparkles size={24} className="text-[#E1251B]" /></div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-widest">{content.aiHelperTitle}</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter max-w-md">{content.aiHelperDesc}</p>
                      </div>
                    </div>
                    {aiStatus && <div className={`mb-6 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${aiStatus.type === 'info' ? 'bg-blue-50 text-blue-600' : aiStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{aiStatus.message}</div>}
                    <div className="flex gap-4">
                      <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => {if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAIAddProject(); }}} placeholder="描述您的新扩张项目..." className="flex-1 bg-gray-50 border border-gray-200 rounded-[2rem] p-6 text-sm font-bold focus:outline-none focus:border-[#E1251B] h-24 resize-none transition-all shadow-inner" />
                      <button onClick={handleAIAddProject} disabled={isProcessing || !aiPrompt.trim()} className="px-10 bg-black text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-[#E1251B] transition-all disabled:opacity-50 flex items-center justify-center shadow-2xl">
                        {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 地址到坐标转换工具 */}
                <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[100px] opacity-20 -z-0"></div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-8">
                      <div className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><MapPin size={24} className="text-blue-500" /></div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-widest">地址到坐标转换</h3>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter max-w-md">输入地址获取经纬度坐标，自动对齐地图位置</p>
                      </div>
                    </div>
                    {coordinateStatus && <div className={`mb-6 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${coordinateStatus.type === 'info' ? 'bg-blue-50 text-blue-600' : coordinateStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{coordinateStatus.message}</div>}
                    <div className="flex gap-4 mb-6">
                      <input 
                        type="text" 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="输入地址，例如：北京市朝阳区建国路88号" 
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-[2rem] p-6 text-sm font-bold focus:outline-none focus:border-[#E1251B] transition-all shadow-inner"
                      />
                      <button 
                        onClick={async () => {
                          if (!address.trim()) {
                            setCoordinateStatus({ message: '请输入地址', type: 'error' });
                            return;
                          }
                          const coordinates = await getCoordinatesFromAddress(address);
                          if (coordinates && currentEditingProject) {
                            // 更新当前编辑项目的坐标
                            handleUpdateProject(currentEditingProject.id, 'coordinates', coordinates);
                            setCoordinateStatus({ message: '坐标已更新到当前项目', type: 'success' });
                          }
                        }} 
                        disabled={!address.trim() || !currentEditingProject}
                        className="px-10 bg-black text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50 flex items-center justify-center shadow-2xl"
                      >
                        获取坐标
                      </button>
                    </div>
                    {currentEditingProject && (
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">当前项目坐标</h4>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm font-black text-gray-900">{currentEditingProject.name}</p>
                            <p className="text-xs font-bold text-gray-400">{currentEditingProject.location}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-gray-900">
                              纬度: {currentEditingProject.coordinates?.[0] || '--'}
                            </p>
                            <p className="text-sm font-black text-gray-900">
                              经度: {currentEditingProject.coordinates?.[1] || '--'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
             </div>
           )}

           {activeTab === 'users' && (
             <div className="space-y-6">
               <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-black uppercase tracking-widest text-gray-900">用户管理 / User Management</h2>
                 <button 
                   onClick={handleAddUser}
                   className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#E1251B] transition-all shadow-xl"
                 >
                   <Plus size={14} /> 添加新用户 / Add User
                 </button>
               </div>
               <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden max-w-4xl animate-in fade-in duration-500">
                  <table className="w-full text-left">
                     <thead>
                       <tr className="bg-gray-50 border-b border-gray-100">
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">User Identity</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400">Access Level</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase text-gray-400 text-right">Actions</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {(users || []).map(u => (
                          <tr key={u.username} className="hover:bg-gray-50/80 transition-colors group">
                             <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400"><UserIcon size={14} /></div>
                                   <span className="font-black text-gray-900">{u.username}</span>
                                </div>
                             </td>
                             <td className="px-6 py-5">
                                <div className="flex items-center gap-2">
                                  <Shield size={12} className={u.role === 'admin' ? 'text-red-500' : 'text-gray-300'} />
                                  <span className="text-xs font-black uppercase text-gray-600 tracking-widest">{u.role}</span>
                                </div>
                             </td>
                             <td className="px-6 py-5 text-right">
                               {u.username !== 'admin' && (
                                 <button 
                                   onClick={() => handleDeleteUser(u.username)}
                                   className="p-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                 >
                                   <Trash2 size={16} />
                                 </button>
                               )}
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
             </div>
           )}

           {activeTab === 'leads' && (
             <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">联系人 / 详情</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">城市 / 预算</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">提交日期</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">状态</th>
                         <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">操作</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {(leads || []).length > 0 ? (leads || []).map(lead => (
                        <tr key={lead.id} className="hover:bg-gray-50/80 transition-colors group">
                           <td className="px-6 py-5">
                              <div className="flex flex-col">
                                 <span className="font-black text-gray-900 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]">{lead.name}</span>
                                 <div className="flex flex-col gap-1 mt-1 text-[10px] font-bold text-gray-400 uppercase">
                                    <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"><Mail size={10} /> {lead.email}</span>
                                    <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"><Phone size={10} /> {lead.phone}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-gray-700 uppercase tracking-widest whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{lead.city}</span>
                                 <span className="text-[10px] font-bold text-[#E1251B] mt-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{lead.budget}</span>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-xs font-bold text-gray-400">{lead.date}</td>
                           <td className="px-6 py-5">
                              <select 
                                value={lead.status}
                                onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as Lead['status'])}
                                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-none focus:ring-2 focus:ring-[#E1251B] cursor-pointer ${
                                  lead.status === 'pending' ? 'bg-yellow-50 text-yellow-600' :
                                  lead.status === 'contacted' ? 'bg-blue-50 text-blue-600' :
                                  lead.status === 'rejected' ? 'bg-gray-50 text-gray-400' :
                                  'bg-green-50 text-green-600'
                                }`}
                              >
                                <option value="pending">待处理</option>
                                <option value="contacted">已联系</option>
                                <option value="rejected">已拒绝</option>
                                <option value="signed">已签约</option>
                              </select>
                           </td>
                           <td className="px-6 py-5 text-right">
                              <button onClick={() => handleDeleteLead(lead.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={16} />
                              </button>
                           </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-20">
                              <Briefcase size={48} />
                              <p className="text-xs font-black uppercase tracking-widest">暂无商机线索</p>
                            </div>
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
           )}
        </main>
      </div>
      {previewModel && (
        <ModelPreview 
          url={previewModel.url} 
          name={previewModel.name} 
          onClose={() => setPreviewModel(null)} 
        />
      )}
    </div>
  );
};

export default AdminPortal;
