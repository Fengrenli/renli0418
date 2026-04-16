'use client';

import React, { useEffect, useState } from 'react';

interface CyberLoadingCardProps {
  /** 目标百分比 0–100 */
  targetPercent?: number;
  /** 底部说明文案 */
  caption?: string;
  className?: string;
}

/**
 * 赛博朋克风加载卡片：数字滚动 + 霓虹进度条。
 */
const CyberLoadingCard: React.FC<CyberLoadingCardProps> = ({
  targetPercent = 75,
  caption = '吼堂海外物料标准库 - BIM建模构建中...',
  className = '',
}) => {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const cap = Math.min(100, Math.max(0, targetPercent));
    const duration = 2200;
    const start = performance.now();

    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(cap * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetPercent]);

  const pct = Math.min(100, Math.max(0, targetPercent));
  const widthPct = Math.min(value, pct);

  return (
    <div
      className={
        `max-w-md rounded-2xl border border-cyan-500/40 bg-black/50 p-6 shadow-[0_0_24px_rgba(34,211,238,0.15)] ` +
        `backdrop-blur-md ${className}`
      }
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-[0.2em] text-cyan-400/90">SYNC</span>
        <div className="font-mono text-4xl font-black tabular-nums text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">
          {value}
          <span className="text-2xl text-cyan-400/80">%</span>
        </div>
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-900/80 ring-1 ring-fuchsia-500/30">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)] transition-[width] duration-150 ease-out"
          style={{ width: `${widthPct}%` }}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-gray-300">
        {caption}
        <span className="ml-0.5 inline-block w-2 animate-pulse bg-cyan-400 align-middle" style={{ height: '1em' }} />
      </p>
    </div>
  );
};

export default CyberLoadingCard;
