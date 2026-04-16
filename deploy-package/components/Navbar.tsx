import React, { useState, useEffect } from 'react';
import { Globe, Sparkles, Menu, X } from 'lucide-react';

interface NavbarProps {
  onNavigate?: (view: 'landing' | 'dashboard' | 'campaign') => void;
  onScrollTo?: (id: string) => void;
  lang: 'cn' | 'en' | 'de';
  setLang: (lang: 'cn' | 'en' | 'de') => void;
}

const Navbar: React.FC<NavbarProps> = React.memo(({ onNavigate, onScrollTo, lang, setLang }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  const handleNavClick = (id: string) => {
    if (onNavigate) onNavigate('landing');
    setMobileOpen(false);
    setTimeout(() => {
      if (onScrollTo) onScrollTo(id);
    }, 100);
  };

  const goView = (v: 'landing' | 'dashboard' | 'campaign') => {
    setMobileOpen(false);
    onNavigate?.(v);
  };

  const navItems = {
    cn: {
      home: "首页",
      brands: "服务品牌",
      campaign: "2026免费设计计划",
      cases: "项目案例",
      about: "关于我们",
      consult: "免费咨询",
      logoTagline: "全球品牌基础设施",
    },
    en: {
      home: "Home",
      brands: "Brands",
      campaign: "2026 Initiative",
      cases: "Case Studies",
      about: "About Us",
      consult: "Consult",
      logoTagline: "Global Brand Infrastructure",
    },
    de: {
      home: "Startseite",
      brands: "Marken",
      campaign: "Initiative 2026",
      cases: "Fallstudien",
      about: "Über uns",
      consult: "Beratung",
      logoTagline: "Globale Markeninfrastruktur",
    },
  }[lang];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${isScrolled || mobileOpen ? 'bg-white/95 backdrop-blur-md shadow-md py-3' : 'bg-transparent py-5'}`}
    >
      <div className="relative z-[110] max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <button
          type="button"
          className="flex flex-col items-start cursor-pointer shrink-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
          onClick={() => {
            setMobileOpen(false);
            onNavigate?.('landing');
          }}
          aria-label={navItems.home}
        >
          <div className="flex items-center space-x-1">
            <span className="text-xl font-extrabold text-[#1A1A1A]">RENLI</span>
            <span className="text-xl font-extrabold text-[#E1251B]">YESHENG</span>
          </div>
          <span className="text-xs tracking-widest text-gray-400 font-bold uppercase leading-none mt-1">
            {navItems.logoTagline}
          </span>
        </button>

        {/* Menu Items — 桌面 */}
        <div className="hidden lg:flex items-center space-x-8 text-xs font-black text-gray-700 uppercase tracking-widest px-4">
          <button type="button" onClick={() => onNavigate?.('landing')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">{navItems.home}</button>
          <button type="button" onClick={() => handleNavClick('services')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">{navItems.brands}</button>
          <button
            type="button"
            onClick={() => onNavigate?.('campaign')}
            className="px-6 py-2 bg-[#1A1A1A] text-white rounded hover:bg-[#E1251B] transition-all flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2"
          >
            <Sparkles size={16} className="text-[#E1251B]" />
            <span>{navItems.campaign}</span>
          </button>
          <button type="button" onClick={() => onNavigate?.('dashboard')} className="hover:text-[#E1251B] transition-colors flex items-center gap-2 group rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">
            <Globe size={16} className="group-hover:rotate-12 transition-transform" /> 
            <span>{navItems.cases}</span>
          </button>
          <button type="button" onClick={() => handleNavClick('about')} className="hover:text-[#E1251B] transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E1251B] focus-visible:ring-offset-2">{navItems.about}</button>
        </div>

        {/* 右侧：桌面 CTA + 语言；窄屏仅 CTA + 汉堡 */}
        <div className="flex items-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => handleNavClick('about')}
            className="hidden sm:inline-flex bg-[#E1251B] text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded shadow-xl hover:bg-[#c11f17] transition-all font-black text-xs uppercase tracking-widest whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white"
          >
            {navItems.consult}
          </button>
          
          <div className="hidden lg:flex items-center space-x-3 text-[11px] font-black uppercase tracking-tighter shrink-0 border-l border-gray-200 pl-6">
            <button 
              type="button"
              onClick={() => setLang('cn')}
              className={`transition-colors py-1 ${lang === 'cn' ? 'text-[#E1251B] border-b border-[#E1251B]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              CN
            </button>
            <button 
              type="button"
              onClick={() => setLang('en')}
              className={`transition-colors py-1 ${lang === 'en' ? 'text-[#E1251B] border-b border-[#E1251B]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              EN
            </button>
            <button 
              type="button"
              onClick={() => setLang('de')}
              className={`transition-colors py-1 ${lang === 'de' ? 'text-[#E1251B] border-b border-[#E1251B]' : 'text-gray-400 hover:text-gray-600'}`}
            >
              DE
            </button>
          </div>

          <button
            type="button"
            className="lg:hidden p-2.5 rounded-lg border border-gray-200 bg-white/80 text-[#1A1A1A] hover:border-[#E1251B] hover:text-[#E1251B] transition-colors"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X size={22} strokeWidth={2.25} /> : <Menu size={22} strokeWidth={2.25} />}
          </button>
        </div>
      </div>

      {/* 移动端全屏菜单 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 top-0 z-[105] pt-[4.25rem] px-4 pb-8 bg-white/98 backdrop-blur-md border-t border-gray-100 shadow-inner overflow-y-auto"
          id="mobile-nav-panel"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-lg mx-auto flex flex-col gap-1 py-4">
            <button
              type="button"
              className="text-left py-3 px-2 text-sm font-black uppercase tracking-widest text-gray-800 border-b border-gray-100 hover:text-[#E1251B]"
              onClick={() => goView('landing')}
            >
              {navItems.home}
            </button>
            <button
              type="button"
              className="text-left py-3 px-2 text-sm font-black uppercase tracking-widest text-gray-800 border-b border-gray-100 hover:text-[#E1251B]"
              onClick={() => handleNavClick('services')}
            >
              {navItems.brands}
            </button>
            <button
              type="button"
              className="text-left py-3 px-2 text-sm font-black uppercase tracking-widest text-white bg-[#1A1A1A] rounded-lg my-1 flex items-center gap-2"
              onClick={() => goView('campaign')}
            >
              <Sparkles size={16} className="text-[#E1251B]" />
              {navItems.campaign}
            </button>
            <button
              type="button"
              className="text-left py-3 px-2 text-sm font-black uppercase tracking-widest text-gray-800 border-b border-gray-100 hover:text-[#E1251B] flex items-center gap-2"
              onClick={() => goView('dashboard')}
            >
              <Globe size={16} />
              {navItems.cases}
            </button>
            <button
              type="button"
              className="text-left py-3 px-2 text-sm font-black uppercase tracking-widest text-gray-800 border-b border-gray-100 hover:text-[#E1251B]"
              onClick={() => handleNavClick('about')}
            >
              {navItems.about}
            </button>
            <button
              type="button"
              className="mt-4 w-full bg-[#E1251B] text-white py-3.5 rounded-lg font-black text-xs uppercase tracking-widest shadow-lg"
              onClick={() => handleNavClick('about')}
            >
              {navItems.consult}
            </button>
            <div className="flex items-center justify-center gap-6 pt-6 text-[12px] font-black uppercase tracking-tighter border-t border-gray-100 mt-2">
              <button type="button" onClick={() => setLang('cn')} className={lang === 'cn' ? 'text-[#E1251B] border-b border-[#E1251B] pb-0.5' : 'text-gray-400'}>CN</button>
              <button type="button" onClick={() => setLang('en')} className={lang === 'en' ? 'text-[#E1251B] border-b border-[#E1251B] pb-0.5' : 'text-gray-400'}>EN</button>
              <button type="button" onClick={() => setLang('de')} className={lang === 'de' ? 'text-[#E1251B] border-b border-[#E1251B] pb-0.5' : 'text-gray-400'}>DE</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

export default Navbar;
