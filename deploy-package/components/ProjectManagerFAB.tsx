'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface ProjectManagerFABProps {
  /** 负责人姓名 */
  name?: string;
  /** 职位 */
  role?: string;
  /** 头像 URL */
  avatarUrl?: string;
  /** 飞书链接 */
  feishuUrl?: string;
  /** WhatsApp 完整链接，如 https://wa.me/86138xxxx */
  whatsappUrl?: string;
  className?: string;
}

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80&fit=crop&crop=face';

/**
 * 右下角「项目管家」悬浮按钮：展开联系人卡片（飞书 / WhatsApp）。
 */
const ProjectManagerFAB: React.FC<ProjectManagerFABProps> = ({
  name = '项目管家 · 张晨',
  role = '海外交付负责人',
  avatarUrl = DEFAULT_AVATAR,
  feishuUrl = '#',
  whatsappUrl = 'https://wa.me/',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className={`fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3 ${className}`}>
      <div
        className={
          'origin-bottom-right transition-all duration-300 ease-out ' +
          (open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0')
        }
      >
        <div
          className={
            'w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border border-white/10 ' +
            'bg-white/95 shadow-2xl shadow-black/20 backdrop-blur-md'
          }
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-[#E1251B]/20"
              width={48}
              height={48}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-gray-900">{name}</div>
              <div className="truncate text-xs text-gray-500">{role}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col gap-2 p-4">
            <a
              href={feishuUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-xl bg-[#3370ff] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#2860e1]"
            >
              飞书直连
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#1ebe5b]"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'relative flex h-14 w-14 items-center justify-center rounded-full bg-[#E1251B] ' +
          'text-white shadow-lg shadow-[#E1251B]/40 ring-4 ring-[#E1251B]/25 ' +
          'animate-pulse transition hover:scale-105 hover:shadow-xl hover:shadow-[#E1251B]/50 ' +
          'focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2'
        }
        aria-expanded={open}
        aria-label={open ? '关闭项目管家' : '打开项目管家'}
      >
        <MessageCircle size={26} strokeWidth={2} />
        <span className="pointer-events-none absolute inset-0 rounded-full bg-white/20 blur-md" />
      </button>
    </div>
  );
};

export default ProjectManagerFAB;
