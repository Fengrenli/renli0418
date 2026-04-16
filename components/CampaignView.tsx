
import React, { useState } from 'react';
import { ArrowRight, ChevronDown, CheckCircle2 } from 'lucide-react';
import { Lead } from '../types';

interface CampaignViewProps {
  onBack: () => void;
  lang: 'cn' | 'en' | 'de';
}

const CampaignView: React.FC<CampaignViewProps> = ({ onBack, lang }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    budget: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const content = {
    cn: {
      initiative: "Global Initiative",
      title1: "REDESIGN",
      title2: "THE FUTURE.",
      title3: "WITH US.",
      subtitle: "与我们一起重塑未来",
      badge: "Iconic Global Landmarks. Free Design Campaign.",
      p1: "Join an elite circle of visionary investors. We are transforming global urban aesthetics through our international franchise expansion initiative. Your city is next.",
      p2: "Focusing on New York, Paris, Dubai, Beijing, and Cologne.",
      formTitle: "Campaign Application",
      formId: "RLYS-2026-FORM",
      labelContact: "Contact Information",
      labelDetails: "Strategic Details",
      phName: "Full Name / 姓名",
      phEmail: "Email Address / 邮箱地址",
      phPhone: "Phone / 电话",
      phCity: "Preferred Store City / 意向开店城市",
      phBudget: "Investment Budget / 投资预算",
      submit: "Get Information / 获取信息",
      alert: "申请已提交，我们将尽快与您联系！",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      locations: "Global Locations",
      successTitle: "Submission Received",
      successDesc: "Our strategic team will review your application and contact you within 48 hours."
    },
    en: {
      initiative: "Global Initiative",
      title1: "REDESIGN",
      title2: "THE FUTURE.",
      title3: "WITH US.",
      subtitle: "Redesign the Future with Us",
      badge: "Iconic Global Landmarks. Free Design Campaign.",
      p1: "Join an elite circle of visionary investors. We are transforming global urban aesthetics through our international franchise expansion initiative. Your city is next.",
      p2: "Focusing on New York, Paris, Dubai, Beijing, and Cologne.",
      formTitle: "Campaign Application",
      formId: "RLYS-2026-FORM",
      labelContact: "Contact Information",
      labelDetails: "Strategic Details",
      phName: "Full Name",
      phEmail: "Email Address",
      phPhone: "Phone Number",
      phCity: "Preferred Store City",
      phBudget: "Investment Budget",
      submit: "Get Information",
      alert: "Application submitted! We will contact you soon.",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      locations: "Global Locations",
      successTitle: "Submission Received",
      successDesc: "Our strategic team will review your application and contact you within 48 hours."
    },
    de: {
      initiative: "Globale Initiative",
      title1: "DIE ZUKUNFT",
      title2: "NEU",
      title3: "GESTALTEN.",
      subtitle: "Gestalten Sie mit uns die Zukunft neu",
      badge: "Ikonische Wahrzeichen. Kostenlose Design-Kampagne.",
      p1: "Schließen Sie sich einem elitären Kreis visionärer Investoren an. Wir transformieren die globale urbane Ästhetik durch unsere internationale Franchise-Expansionsinitiative. Ihre Stadt ist die nächste.",
      p2: "Fokus auf New York, Paris, Dubai, Peking und Köln.",
      formTitle: "Kampagnen-Bewerbung",
      formId: "RLYS-2026-FORMULAR",
      labelContact: "Kontaktinformationen",
      labelDetails: "Strategische Details",
      phName: "Vollständiger Name",
      phEmail: "E-Mail-Adresse",
      phPhone: "Telefonnummer",
      phCity: "Bevorzugte Stadt für das Geschäft",
      phBudget: "Investitionsbudget",
      submit: "Informationen anfordern",
      alert: "Bewerbung abgeschickt! Wir werden Sie bald kontaktieren.",
      privacy: "Datenschutz",
      terms: "Nutzungsbedingungen",
      locations: "Globale Standorte",
      successTitle: "Bewerbung eingegangen",
      successDesc: "Unser strategisches Team wird Ihre Bewerbung prüfen und Sie innerhalb von 48 Stunden kontaktieren."
    }
  }[lang];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone || !formData.city || !formData.budget) {
      setError('所有字段都不能为空');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/submit-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: formData.name,
          email: formData.email,
          phone: formData.phone,
          preferred_city: formData.city,
          investment_budget: formData.budget
        }),
      });

      const result = await response.json();

      if (response.ok && (result.code === 200 || result.code === 0)) {
        setSubmitted(true);
      } else {
        setError(result.msg || '提交失败，请重试');
      }
    } catch (err) {
      console.error('Submission error:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col pt-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center flex-1 pb-40">
        
        {/* Left Side: Text Content */}
        <div className="space-y-12 animate-in fade-in slide-in-from-left duration-700">
          <div>
            <span className="text-[#E1251B] text-xs font-black tracking-[0.4em] uppercase">{content.initiative}</span>
            <h1 className="text-7xl md:text-8xl font-black leading-[0.9] tracking-tighter mt-4">
              {content.title1}<br />
              {content.title2}<br />
              <span className="text-[#E1251B]">{content.title3}</span>
            </h1>
            <h2 className="text-4xl md:text-5xl font-black mt-6 leading-tight">{content.subtitle}</h2>
          </div>

          <div className="space-y-6">
            <p className="text-[#E1251B] text-2xl font-black">
              {content.badge}
            </p>
            <div className="max-w-md space-y-4">
              <p className="text-gray-500 font-medium leading-relaxed border-l-2 border-[#E1251B] pl-8 py-2 text-lg">
                {content.p1}
              </p>
              <p className="text-gray-400 text-sm italic font-bold">
                {content.p2}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Application Form */}
        <div className="relative group animate-in fade-in slide-in-from-right duration-700">
          <div className="absolute top-4 left-4 w-full h-full bg-[#E1251B] -z-10 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
          
          <div className="bg-white border-2 border-black p-10 md:p-14 shadow-2xl min-h-[600px] flex flex-col justify-center">
            {submitted ? (
              <div className="text-center space-y-8 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-green-500/10">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">{content.successTitle}</h3>
                  <p className="text-gray-500 font-medium">{content.successDesc}</p>
                </div>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="px-8 py-3 border border-black font-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-all"
                >
                  Back to Form
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-14">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">{content.formTitle}</h3>
                  <span className="text-xs text-gray-300 font-black tracking-widest">{content.formId}</span>
                </div>

                <form className="space-y-10" onSubmit={handleSubmit}>
                  {error && (
                    <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold">
                      {error}
                    </div>
                  )}
                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none block">{content.labelContact}</label>
                    <input 
                      type="text" 
                      required
                      disabled={isSubmitting}
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder={content.phName}
                      className="w-full border border-gray-100 bg-gray-50/50 p-5 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <input 
                        type="email" 
                        required
                        disabled={isSubmitting}
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder={content.phEmail}
                        className="w-full border border-gray-100 bg-gray-50/50 p-5 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                      />
                      <input 
                        type="tel" 
                        required
                        disabled={isSubmitting}
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder={content.phPhone}
                        className="w-full border border-gray-100 bg-gray-50/50 p-5 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest leading-none block">{content.labelDetails}</label>
                    <input 
                      type="text" 
                      required
                      disabled={isSubmitting}
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      placeholder={content.phCity}
                      className="w-full border border-gray-100 bg-gray-50/50 p-5 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                    />
                    <input 
                      type="text" 
                      required
                      disabled={isSubmitting}
                      value={formData.budget}
                      onChange={(e) => setFormData({...formData, budget: e.target.value})}
                      placeholder={content.phBudget}
                      className="w-full border border-gray-100 bg-gray-50/50 p-5 font-bold text-sm focus:outline-none focus:border-black focus:bg-white transition-all disabled:opacity-50"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#E1251B] text-white p-7 font-black text-xs uppercase tracking-widest flex items-center justify-between hover:bg-black transition-all group/btn shadow-xl shadow-red-500/10 disabled:opacity-50"
                  >
                    <div className="flex flex-col items-start leading-none gap-1">
                      <span className="text-sm">{isSubmitting ? 'Submitting...' : content.submit}</span>
                    </div>
                    <ArrowRight size={24} className="group-hover/btn:translate-x-3 transition-transform" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="bg-black text-white py-6 px-10 flex flex-col md:flex-row justify-between items-center text-xs font-black uppercase tracking-[0.3em] mt-auto">
        <p>© 2026 RENLIYESHENG.NET GLOBAL DESIGN INITIATIVE. ALL RIGHTS RESERVED.</p>
        <div className="flex gap-10 mt-6 md:mt-0">
          <a href="#" className="hover:text-[#E1251B] transition-colors">{content.privacy}</a>
          <a href="#" className="hover:text-[#E1251B] transition-colors">{content.terms}</a>
          <a href="#" className="hover:text-[#E1251B] transition-colors">{content.locations}</a>
        </div>
      </footer>
    </div>
  );
};

export default CampaignView;
