import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Save, Loader2, Sparkles } from 'lucide-react';
import { ProjectLocation } from '../types';

type GeoHit = { lat: number; lon: number; displayName: string };

interface ManualProjectModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  manualProjData: Partial<ProjectLocation>;
  setManualProjData: React.Dispatch<React.SetStateAction<Partial<ProjectLocation>>>;
}

const SEARCH_DEBOUNCE_MS = 420;

const ManualProjectModal: React.FC<ManualProjectModalProps> = ({
  show,
  onClose,
  onSubmit,
  manualProjData,
  setManualProjData,
}) => {
  const [locFocused, setLocFocused] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoHit[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolveAlts, setResolveAlts] = useState<GeoHit[] | null>(null);
  const [resolveNote, setResolveNote] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearchRef = useRef('');

  const applyCoordinates = useCallback(
    (hit: GeoHit) => {
      setManualProjData((prev) => ({
        ...prev,
        coordinates: [hit.lat, hit.lon],
      }));
    },
    [setManualProjData],
  );

  const fetchSuggestions = useCallback(async (q: string) => {
    const trimmed = q.trim();
    latestSearchRef.current = trimmed;
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setGeoError(null);
    try {
      const res = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(trimmed)}&limit=6`,
      );
      const json = await res.json();
      if (latestSearchRef.current !== trimmed) return;
      const rows: GeoHit[] = json?.data?.results || [];
      setSuggestions(Array.isArray(rows) ? rows : []);
    } catch {
      if (latestSearchRef.current === trimmed) {
        setSuggestions([]);
        setGeoError('地点联想请求失败');
      }
    } finally {
      if (latestSearchRef.current === trimmed) setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!show) {
      setSuggestions([]);
      setResolveAlts(null);
      setResolveNote(null);
      setGeoError(null);
      return;
    }
    const q = manualProjData.location || '';
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(q);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [manualProjData.location, show, fetchSuggestions]);

  const pickSuggestion = (hit: GeoHit) => {
    const shortLabel = hit.displayName.split(',').slice(0, 3).join(',').trim();
    setManualProjData((prev) => ({
      ...prev,
      location: shortLabel || hit.displayName,
      coordinates: [hit.lat, hit.lon],
    }));
    setSuggestions([]);
    setGeoError(null);
  };

  const handleSmartResolve = async () => {
    const name = (manualProjData.name || '').trim();
    const location = (manualProjData.location || '').trim();
    if (!name && !location) {
      setGeoError('请先填写项目名称或落地城市');
      return;
    }
    setResolving(true);
    setGeoError(null);
    setResolveAlts(null);
    setResolveNote(null);
    try {
      const res = await fetch('/api/geocode/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, location }),
      });
      const json = await res.json();
      if (!json.success || !json.data?.best) {
        setGeoError(json.msg || '未能解析坐标');
        return;
      }
      const best: GeoHit = json.data.best;
      const all: GeoHit[] = json.data.results || [best];
      applyCoordinates(best);
      setResolveNote(
        `已按「${json.data.queryUsed}」匹配：${best.displayName.slice(0, 80)}${best.displayName.length > 80 ? '…' : ''}`,
      );
      if (all.length > 1) setResolveAlts(all);
    } catch {
      setGeoError('解析请求失败');
    } finally {
      setResolving(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>
      <div className="bg-white rounded-[3rem] w-full max-w-4xl p-12 shadow-2xl relative animate-in zoom-in-95 duration-300 border border-white/10 flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-10 right-10 text-gray-400 hover:text-black transition-colors p-2 bg-gray-50 rounded-full">
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-6 mb-12">
          <div className="w-16 h-16 bg-black text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-black/20 rotate-3 group-hover:rotate-0 transition-transform">
            <Plus size={32} />
          </div>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-2">手动创建新项目</h2>
            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em]">Manual Project Infrastructure Entry</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 border-b border-red-100 pb-2">基本信息 / Basic Info</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">项目名称 / Project Name</label>
                  <input 
                    type="text" 
                    required 
                    value={manualProjData.name || ''} 
                    onChange={(e) => setManualProjData({...manualProjData, name: e.target.value})} 
                    placeholder="如：法国某某品牌、迪拜美食城（可与地理解析联动）" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">客户名称 / Client Name</label>
                  <input 
                    type="text" 
                    value={manualProjData.clientName || ''} 
                    onChange={(e) => setManualProjData({...manualProjData, clientName: e.target.value})} 
                    placeholder="e.g. 某某餐饮集团" 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">项目类型 / Type</label>
                    <input 
                      type="text" 
                      value={manualProjData.projectType || ''} 
                      onChange={(e) => setManualProjData({...manualProjData, projectType: e.target.value})} 
                      placeholder="e.g. 餐饮 / 零售" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">建筑面积 / Area</label>
                    <input 
                      type="text" 
                      value={manualProjData.area || ''} 
                      onChange={(e) => setManualProjData({...manualProjData, area: e.target.value})} 
                      placeholder="e.g. 450 m²" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 border-b border-red-100 pb-2">地理信息 / Location</h3>
              <div className="space-y-4">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">落地城市 / City & Country</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required 
                      value={manualProjData.location || ''} 
                      onChange={(e) => setManualProjData({...manualProjData, location: e.target.value})} 
                      onFocus={() => setLocFocused(true)}
                      onBlur={() => setTimeout(() => setLocFocused(false), 180)}
                      placeholder="输入城市或国家，联想与 TerraInk 同源（Nominatim）" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500" 
                    />
                    {searchLoading && locFocused && (
                      <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-red-500" />
                    )}
                  </div>
                  {locFocused && suggestions.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-xl text-xs">
                      {suggestions.map((hit, idx) => (
                        <li key={`${hit.lat}-${hit.lon}-${idx}`}>
                          <button
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-red-50 text-gray-700 font-medium border-b border-gray-50 last:border-0"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pickSuggestion(hit)}
                          >
                            {hit.displayName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={() => void handleSmartResolve()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-red-600 text-white px-5 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    智能解析坐标（名称+城市）
                  </button>
                  <span className="text-[10px] text-gray-400 font-medium max-w-[14rem] leading-snug">
                    优先用城市字段，否则用项目全名，并尝试识别「国家+品牌」中的国家前缀
                  </span>
                </div>

                {geoError && (
                  <p className="text-xs text-red-600 font-bold">{geoError}</p>
                )}
                {resolveNote && (
                  <p className="text-xs text-green-700 font-medium leading-relaxed">{resolveNote}</p>
                )}
                {resolveAlts && resolveAlts.length > 1 && (
                  <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">其他候选位置</p>
                    <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                      {resolveAlts.map((hit, idx) => (
                        <button
                          key={`alt-${idx}`}
                          type="button"
                          onClick={() => {
                            applyCoordinates(hit);
                            const d = hit.displayName;
                            setResolveNote(
                              d.length > 72 ? `已切换为：${d.slice(0, 72)}…` : `已切换为：${d}`,
                            );
                          }}
                          className="text-left text-[11px] text-gray-700 hover:text-red-600 font-medium truncate"
                        >
                          {hit.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">经度 / Longitude</label>
                    <input 
                      type="number" 
                      step="any"
                      required 
                      value={manualProjData.coordinates?.[1] ?? ''} 
                      onChange={(e) => setManualProjData({...manualProjData, coordinates: [manualProjData.coordinates?.[0] ?? 0, parseFloat(e.target.value) || 0]})} 
                      placeholder="13.40" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">纬度 / Latitude</label>
                    <input 
                      type="number" 
                      step="any"
                      required 
                      value={manualProjData.coordinates?.[0] ?? ''} 
                      onChange={(e) => setManualProjData({...manualProjData, coordinates: [parseFloat(e.target.value) || 0, manualProjData.coordinates?.[1] ?? 0]})} 
                      placeholder="52.52" 
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">项目状态 / Status</label>
                  <select 
                    value={manualProjData.status} 
                    onChange={(e) => setManualProjData({...manualProjData, status: e.target.value as any})} 
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 px-6 font-bold text-sm focus:outline-none focus:border-red-500 appearance-none"
                  >
                    <option value="待启动">待启动 / Pending</option>
                    <option value="进行中">进行中 / In Progress</option>
                    <option value="已完成">已完成 / Completed</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">项目描述 / Project Description</label>
            <textarea 
              value={manualProjData.description || ''} 
              onChange={(e) => setManualProjData({...manualProjData, description: e.target.value})} 
              placeholder="简述项目背景、设计理念与核心目标..." 
              className="w-full bg-gray-50 border border-gray-100 rounded-[2rem] py-6 px-8 font-medium text-sm focus:outline-none focus:border-red-500 h-32 resize-none leading-relaxed" 
            />
          </div>

          <div className="pt-6">
            <button type="submit" className="w-full bg-black text-white py-6 rounded-2xl font-black text-xs uppercase tracking-[0.4em] shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-4 group">
              <Save size={20} className="group-hover:scale-110 transition-transform" /> 确认并发布项目 / Publish Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualProjectModal;
