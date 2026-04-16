import React from 'react';
import { MessageCircle, QrCode, Send, Loader2 } from 'lucide-react';
import type { ProjectLocation } from '../types';
import {
  collectFeishuSupportContacts,
  feishuP2pChatAppLink,
  mapFeishuApiMembersToSupportContacts,
} from '../utils/feishuContact';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface CustomerSupportButtonProps {
  lang: 'cn' | 'en' | 'de';
  /** 保留兼容；飞书列表仅使用服务端拉取的组织全员通讯录 */
  projects?: ProjectLocation[];
}

const CustomerSupportButton: React.FC<CustomerSupportButtonProps> = ({ lang, projects = [] }) => {
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  const [feishuExpanded, setFeishuExpanded] = React.useState(false);
  /** 飞书通讯录加载结果说明（避免一律提示「权限」误导） */
  const [feishuNotice, setFeishuNotice] = React.useState<string | null>(null);

  const content = {
    cn: {
      title: '客户支持',
      whatsapp: 'WhatsApp',
      wechat: '微信',
      feishu: '飞书',
      feishuSub: '飞书组织内联系人',
      scan: '扫码添加微信',
      scanWa: '扫码添加 WhatsApp',
      message: '您好，我需要咨询项目相关信息',
      feishuPick: '选择联系人',
      feishuLoading: '正在加载飞书通讯录…',
      feishuTimeout:
        '加载超时。若成员很多，可在 .env 设置 FEISHU_MEMBERS_MAX_PAGES=60，或关闭 FEISHU_MEMBERS_MERGE_FIND_BY_DEPT 后重试。',
      feishuNet: '网络异常，请稍后重试。',
      feishuZero:
        '飞书返回 0 名成员。请查看运行 npm run dev 的终端里 [feishu-members-all] 日志，并确认应用具备通讯录权限。',
    },
    en: {
      title: 'Customer Support',
      whatsapp: 'WhatsApp',
      wechat: 'WeChat',
      feishu: 'Feishu (Lark)',
      feishuSub: 'Feishu org contacts',
      scan: 'Scan to add WeChat',
      scanWa: 'Scan to add WhatsApp',
      message: 'Hello, I need to consult about project information',
      feishuPick: 'Choose a contact',
      feishuLoading: 'Loading Feishu directory…',
      feishuTimeout: 'Timed out. Try FEISHU_MEMBERS_MAX_PAGES=60 or disable FEISHU_MEMBERS_MERGE_FIND_BY_DEPT in .env.',
      feishuNet: 'Network error. Please retry.',
      feishuZero: 'Feishu returned 0 users. Check server logs and app contact permissions.',
    },
    de: {
      title: 'Kundensupport',
      whatsapp: 'WhatsApp',
      wechat: 'WeChat',
      feishu: 'Feishu (Lark)',
      feishuSub: 'Feishu-Organisation',
      scan: 'Scannen Sie, um WeChat hinzuzufügen',
      scanWa: 'WhatsApp per QR hinzufügen',
      message: 'Hallo, ich muss mich über Projektinformationen beraten lassen',
      feishuPick: 'Kontakt wählen',
      feishuLoading: 'Feishu-Verzeichnis wird geladen…',
      feishuTimeout: 'Zeitüberschreitung. FEISHU_MEMBERS_MAX_PAGES=60 oder FEISHU_MEMBERS_MERGE_FIND_BY_DEPT=0 setzen.',
      feishuNet: 'Netzwerkfehler. Bitte erneut versuchen.',
      feishuZero: 'Feishu lieferte 0 Benutzer. Server-Logs und Berechtigungen prüfen.',
    },
  }[lang];

  /** undefined = 尚未拉取；[] = 已拉取但无数据 */
  const [feishuDirectoryRows, setFeishuDirectoryRows] = React.useState<
    { userId?: string; name?: string; jobTitle?: string }[] | undefined
  >(undefined);
  const [feishuDirectoryLoading, setFeishuDirectoryLoading] = React.useState(false);

  const feishuContacts = React.useMemo(() => {
    if (feishuDirectoryRows === undefined) return [];
    const fromApi = mapFeishuApiMembersToSupportContacts(feishuDirectoryRows);
    if (fromApi.length > 0) return fromApi;
    /** 组织通讯录拉不到时，恢复为项目内已保存的飞书联系人（与早期行为一致） */
    return collectFeishuSupportContacts(projects);
  }, [feishuDirectoryRows, projects]);

  React.useEffect(() => {
    if (!isPanelOpen) {
      setFeishuExpanded(false);
      setFeishuNotice(null);
      setFeishuDirectoryRows(undefined);
      return;
    }

    let cancelled = false;
    setFeishuDirectoryLoading(true);
    setFeishuNotice(null);
    void (async () => {
      try {
        const res = await fetchWithTimeout('/api/feishu-members-all', { timeoutMs: 300000 });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          code?: number;
          msg?: string;
          data?: unknown;
        };
        if (cancelled) return;
        const list = json?.data;
        const listOk = Array.isArray(list);
        const accepted =
          res.ok &&
          listOk &&
          (json.success === true || json.code === 200 || (res.ok && listOk && json.success !== false));
        if (accepted) {
          setFeishuDirectoryRows(list as { userId?: string; name?: string; jobTitle?: string }[]);
          if (list.length === 0) {
            const hasSaved = collectFeishuSupportContacts(projects).length > 0;
            setFeishuNotice(
              hasSaved
                ? null
                : json.msg && String(json.msg).trim() && json.msg !== 'success'
                  ? String(json.msg)
                  : content.feishuZero,
            );
          }
        } else {
          setFeishuDirectoryRows([]);
          setFeishuNotice(String(json?.msg || `HTTP ${res.status}`));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setFeishuDirectoryRows([]);
          const aborted = e instanceof Error && e.name === 'AbortError';
          setFeishuNotice(aborted ? content.feishuTimeout : content.feishuNet);
        }
      } finally {
        if (!cancelled) setFeishuDirectoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isPanelOpen, projects, lang]);

  const handleWhatsAppClick = () => {
    const phoneNumber = '8613667649732';
    const message = encodeURIComponent(content.message);
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const openFeishuChat = (openId: string) => {
    window.open(feishuP2pChatAppLink(openId), '_blank', 'noopener,noreferrer');
  };

  const handleFeishuRowClick = () => {
    if (feishuDirectoryLoading) return;
    if (feishuContacts.length === 0) return;
    if (feishuContacts.length === 1) {
      openFeishuChat(feishuContacts[0].openId);
      return;
    }
    setFeishuExpanded((v) => !v);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        <button
          type="button"
          className="w-16 h-16 bg-[#E1251B] rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-black transition-all duration-300"
          id="support-button"
          aria-expanded={isPanelOpen}
          aria-controls="support-panel"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          <MessageCircle size={24} />
        </button>

        <div
          className={`absolute bottom-full right-0 mb-4 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl p-4 border border-gray-100 transition-all duration-300 transform ${isPanelOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-4'}`}
          id="support-panel"
          role="dialog"
          aria-label={content.title}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">{content.title}</h3>
            <div className="w-2 h-2 bg-[#E1251B] rounded-full animate-pulse" aria-hidden />
          </div>

          {feishuNotice && (
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 leading-snug">
              {feishuNotice}
            </p>
          )}

          <button
            type="button"
            onClick={handleWhatsAppClick}
            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-green-50 transition-all mb-3 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0">
                <MessageCircle size={16} />
              </div>
              <span className="text-sm font-bold text-gray-700 truncate">{content.whatsapp}</span>
            </div>
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold group-hover:bg-green-600 transition-colors shrink-0">
              {'>'}
            </div>
          </button>

          <div className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white shrink-0">
                <QrCode size={16} />
              </div>
              <span className="text-sm font-bold text-gray-700 truncate">{content.wechat}</span>
            </div>
            <div className="relative group">
              <button
                type="button"
                className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold group-hover:bg-green-700 transition-colors"
                aria-label={content.scan}
              >
                ?
              </button>
              <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 w-[min(100vw-2rem,280px)] bg-black text-white text-xs p-3 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 z-10">
                <div className="flex gap-3 justify-center">
                  <div className="w-[112px] shrink-0 flex flex-col items-center">
                    <div className="w-[112px] h-[112px] flex items-center justify-center bg-white rounded p-1">
                      <img src="/whatsapp-qr.png" alt="WhatsApp QR" className="max-w-full max-h-full object-contain" loading="lazy" />
                    </div>
                    <p className="text-center mt-1 font-bold text-[10px] leading-tight">{content.scanWa}</p>
                  </div>
                  <div className="w-[112px] shrink-0 flex flex-col items-center">
                    <div className="w-[112px] h-[112px] flex items-center justify-center bg-white rounded p-1">
                      <img
                        src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=WeChat QR code for Feng Renli from Chengdu, Sichuan, with WeChat logo in the center, black and white QR code on white background&image_size=square"
                        alt="WeChat QR Code"
                        className="max-w-full max-h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-center mt-1 font-bold text-[10px] leading-tight">{content.scan}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFeishuRowClick}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${feishuDirectoryLoading || feishuContacts.length === 0 ? 'bg-gray-100 opacity-80' : 'bg-gray-50 hover:bg-blue-50'}`}
          >
            <div className="flex items-center gap-3 min-w-0 text-left">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: '#3370FF' }}
              >
                <Send size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-700 truncate">{content.feishu}</div>
                <div className="text-[10px] text-gray-500 font-medium truncate">{content.feishuSub}</div>
              </div>
            </div>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: '#3370FF' }}
            >
              {feishuContacts.length > 1 ? (feishuExpanded ? '−' : '+') : '>'}
            </div>
          </button>

          {isPanelOpen && feishuDirectoryLoading && (
            <p className="text-[10px] text-gray-400 mt-1.5 px-1 flex items-center gap-1.5">
              <Loader2 className="animate-spin shrink-0" size={12} aria-hidden />
              <span>{content.feishuLoading}</span>
            </p>
          )}

          {feishuExpanded && feishuContacts.length > 1 && (
            <div className="mt-2 max-h-[min(70vh,22rem)] overflow-y-auto custom-scrollbar border border-gray-100 rounded-xl bg-white">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1">{content.feishuPick}</p>
              <ul className="pb-1">
                {feishuContacts.map((c) => (
                  <li key={c.openId}>
                    <button
                      type="button"
                      onClick={() => openFeishuChat(c.openId)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs font-bold text-gray-800 border-t border-gray-50 first:border-t-0"
                    >
                      <span className="block truncate">{c.name}</span>
                      {(c.role || c.projectName) && (
                        <span className="block text-[10px] font-medium text-gray-500 truncate">
                          {c.role?.trim() || c.projectName}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerSupportButton;
