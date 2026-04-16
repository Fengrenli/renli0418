'use client';

import React from 'react';

export type MobileScrollCardItem = {
  id: string;
  title: string;
  progressLabel: string;
  imageSrc: string;
  imageAlt: string;
};

const MOCK_CARDS: MobileScrollCardItem[] = [
  {
    id: '1',
    title: '小龙坎 · 法兰克福旗舰店',
    progressLabel: '施工图深化 68%',
    imageSrc: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    imageAlt: '餐饮门店室内',
  },
  {
    id: '2',
    title: '吼堂 · 海外物料标准库',
    progressLabel: 'BIM 建模 42%',
    imageSrc: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    imageAlt: '办公与协作空间',
  },
  {
    id: '3',
    title: '杨国福 · 东南亚供应链节点',
    progressLabel: '现场勘测 已完成',
    imageSrc: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    imageAlt: '餐厅环境',
  },
  {
    id: '4',
    title: '大龙燚 · 欧洲首店筹备',
    progressLabel: '方案评审 15%',
    imageSrc: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80',
    imageAlt: '高端餐饮空间',
  },
];

interface MobileScrollCardsProps {
  items?: MobileScrollCardItem[];
  className?: string;
}

/**
 * 横向 Scroll Snap 卡片（移动端「苹果风」滑动）。
 * 当前仓库为 Vite + React：使用原生 img；迁移 Next.js 时可改为 next/image。
 */
const MobileScrollCards: React.FC<MobileScrollCardsProps> = ({
  items = MOCK_CARDS,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div
        className={
          'flex snap-x snap-mandatory gap-4 overflow-x-auto px-[7.5%] pb-3 ' +
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        }
      >
        {items.map((card) => (
          <article
            key={card.id}
            className={
              'w-[85vw] max-w-sm shrink-0 snap-center overflow-hidden rounded-2xl ' +
              'bg-white shadow-lg ring-1 ring-black/5'
            }
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-100">
              <img
                src={card.imageSrc}
                alt={card.imageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="space-y-2 bg-white px-4 py-4">
              <h3 className="text-base font-bold leading-snug text-gray-900">{card.title}</h3>
              <span className="inline-flex items-center rounded-full bg-[#E1251B]/10 px-3 py-1 text-xs font-semibold text-[#E1251B]">
                {card.progressLabel}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default MobileScrollCards;
