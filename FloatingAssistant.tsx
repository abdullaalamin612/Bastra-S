import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import {
  MoreHorizontal,
  Bot,
  MessageCircle,
  X,
  Sparkles,
  Send,
} from 'lucide-react';

export const FloatingAssistant: React.FC = () => {
  const { openAiAssistant, generalSettings } = useShop();
  const [isOpen, setIsOpen] = useState(false);

  const handleWhatsAppClick = () => {
    const phone = generalSettings.whatsappNumber?.replace(/[^0-9]/g, '') || '8801864528488';
    const text = encodeURIComponent('আসসালামু আলাইকুম! বাস্ত্র শৈলী থেকে পণ্য কিনতে ও বিস্তারিত জানতে যোগাযোগ করছি।');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    setIsOpen(false);
  };

  const handleMessengerClick = () => {
    const fbUrl = generalSettings.facebookUrl || 'https://facebook.com/bastrashoily';
    // If it's facebook URL, navigate to m.me or FB page
    const pageHandle = fbUrl.split('/').filter(Boolean).pop() || 'bastrashoily';
    window.open(`https://m.me/${pageHandle}`, '_blank');
    setIsOpen(false);
  };

  const handleAiClick = () => {
    setIsOpen(false);
    openAiAssistant();
  };

  return (
    <div id="floating-support-container" className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-end">
      {/* Backdrop when menu is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs sm:hidden"
        />
      )}

      {/* Expanded 3 Options Menu */}
      {isOpen && (
        <div
          id="floating-options-menu"
          className="mb-3 z-40 flex flex-col items-end gap-2.5 animate-in slide-in-from-bottom-5 fade-in duration-200"
        >
          {/* Option 1: AI Agent */}
          <button
            onClick={handleAiClick}
            className="flex items-center gap-3 bg-stone-900 hover:bg-black text-white px-4 py-2.5 rounded-2xl shadow-xl border border-stone-700 transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          >
            <div className="text-right">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-end gap-1">
                <span>AI সহকারী (বাস্ত্র শৈলী)</span>
                <Sparkles className="w-3 h-3 text-amber-400" />
              </div>
              <div className="text-[10px] text-stone-400">সাইজ, দাম ও তাৎক্ষণিক সহায়তা</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 group-hover:bg-amber-500 group-hover:text-stone-950 transition-colors shrink-0">
              <Bot className="w-5 h-5" />
            </div>
          </button>

          {/* Option 2: WhatsApp */}
          <button
            onClick={handleWhatsAppClick}
            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          >
            <div className="text-right">
              <div className="text-xs font-bold">হোয়াটসঅ্যাপ (WhatsApp)</div>
              <div className="text-[10px] text-emerald-100">সরাসরি চ্যাট ও ছবি পাঠান</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-5 h-5 fill-white text-emerald-600" />
            </div>
          </button>

          {/* Option 3: Messenger */}
          <button
            onClick={handleMessengerClick}
            className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          >
            <div className="text-right">
              <div className="text-xs font-bold">মেসেঞ্জার (Messenger)</div>
              <div className="text-[10px] text-blue-100">ফেসবুক পেজে বার্তা দিন</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
              <Send className="w-4 h-4 fill-white text-blue-600 rotate-45" />
            </div>
          </button>
        </div>
      )}

      {/* Main Single Floating Action Button */}
      <button
        id="main-floating-trigger-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="কাস্টমার সাপোর্ট ও এআই সহকারী"
        className={`relative z-40 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 cursor-pointer ${
          isOpen
            ? 'bg-stone-800 rotate-90 scale-95 shadow-stone-800/40'
            : 'bg-amber-600 hover:bg-amber-500 hover:scale-105 active:scale-95 shadow-amber-600/50'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MoreHorizontal className="w-7 h-7 stroke-[2.5]" />
            {/* Pulsing indicator ring */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </>
        )}
      </button>
    </div>
  );
};
