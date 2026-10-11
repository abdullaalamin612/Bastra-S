import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Logo } from './Logo';
import {
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  ArrowUpRight,
  X,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Clock,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { FooterLinkItem, FooterPolicyItem, FooterContactItem } from '../types';

export const Footer: React.FC = () => {
  const {
    footerConfig,
    navigateToHome,
    navigateToCmsGuide,
    navigateToClothingGuide,
    navigateToTracking,
    navigateToCategory,
  } = useShop();

  const [activePolicyModal, setActivePolicyModal] = useState<{
    title: string;
    content: string;
  } | null>(null);

  // Quick links fallback (Admin Panel completely excluded)
  const quickLinks: FooterLinkItem[] =
    footerConfig.quickLinks && footerConfig.quickLinks.length > 0
      ? footerConfig.quickLinks.filter(
          (l) => l.isActive !== false && l.url !== 'admin' && !l.title.includes('এডমিন')
        )
      : [
          { id: 'ql-1', title: 'হোম পেজ', url: 'home', isActive: true },
          { id: 'ql-2', title: 'কিভাবে অর্ডার করবেন?', url: 'guide', isActive: true },
          { id: 'ql-3', title: 'কাপড়ের যত্ন ও ভিডিও গাইড', url: 'clothing-guide', isActive: true },
          { id: 'ql-4', title: 'অর্ডার ট্র্যাকিং', url: 'tracking', isActive: true },
        ];

  // Policies fallback
  const policies: FooterPolicyItem[] =
    footerConfig.policies && footerConfig.policies.length > 0
      ? footerConfig.policies.filter((p) => p.isActive !== false)
      : [
          {
            id: 'pol-1',
            title: 'রিটার্ন ও এক্সচেঞ্জ পলিসি',
            content: footerConfig.returnPolicy || 'পণ্য পাওয়ার ৭ দিনের মধ্যে যেকোনো ত্রুটি বা সাইজ পরিবর্তনের জন্য সহজ এক্সচেঞ্জ ও রিটার্ন পলিসি প্রযোজ্য।',
            isActive: true,
          },
          {
            id: 'pol-2',
            title: 'শিপিং ও ডেলিভারি তথ্য',
            content: footerConfig.shippingPolicy || 'সিরাজগঞ্জের ভিতর মাত্র ৳70, সিরাজগঞ্জের বাইরে ৳130 (২০০০ টাকার বেশি অর্ডারে ফ্রি শিপিং)।',
            isActive: true,
          },
          {
            id: 'pol-3',
            title: 'ব্যবহারের শর্তাবলী',
            content: footerConfig.termsAndConditions || 'অর্ডার প্লেস করার ২৪-৪৮ ঘণ্টার মধ্যে কনফার্মেশন কল করা হবে।',
            isActive: true,
          },
          {
            id: 'pol-4',
            title: 'গোপনীয়তা নীতি',
            content: footerConfig.privacyPolicy || 'গ্রাহকের ব্যক্তিগত তথ্য সম্পূর্ণ সুরক্ষিত এবং তৃতীয় পক্ষের সাথে শেয়ার করা হয় না।',
            isActive: true,
          },
        ];

  const handleLinkClick = (url: string) => {
    if (!url) return;
    const cleanUrl = url.trim();

    if (cleanUrl === 'home' || cleanUrl === '/') {
      navigateToHome();
    } else if (cleanUrl === 'guide' || cleanUrl === 'how-to-order') {
      navigateToCmsGuide();
    } else if (cleanUrl === 'clothing-guide' || cleanUrl === 'care-guide') {
      navigateToClothingGuide();
    } else if (cleanUrl === 'tracking' || cleanUrl === 'track-order') {
      navigateToTracking();
    } else if (['lungi', 'saree', 'panjabi', 'three-piece', 't-shirt'].includes(cleanUrl.toLowerCase())) {
      navigateToCategory(cleanUrl.toLowerCase());
    } else if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      window.open(cleanUrl, '_blank', 'noreferrer');
    } else {
      navigateToHome();
    }
  };

  const showroomAddress = footerConfig.address || 'বাস্ত্র শৈলি ভবন, শাহজাদপুর, সিরাজগঞ্জ, বাংলাদেশ';
  const helplinePhone = footerConfig.phone || '+880 1864-528488';
  const supportEmail = footerConfig.email || 'bastrashoily@gmail.com';

  return (
    <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Exactly 3 Columns Side-by-Side (পাশাপাশি ৩টি কলাম, উপরে নিচে নয়) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-6 lg:gap-10 items-start">
          {/* Column 1: Brand, About & Social Media */}
          <div className="space-y-2 sm:space-y-3">
            <div className="scale-90 sm:scale-100 origin-left">
              <Logo variant="light" />
            </div>
            <p className="text-[11px] sm:text-xs text-stone-400 leading-relaxed line-clamp-4 sm:line-clamp-none">
              {footerConfig.aboutUs ||
                'বাস্ত্র শৈলি (BASTRA SHOILY) বাংলাদেশের ঐতিহ্যবাহী তাঁত শিল্প ও আধুনিক পোশাকের অন্যতম নির্ভরযোগ্য প্ল্যাটফর্ম।'}
            </p>

            {/* Social Media */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {footerConfig.facebookUrl && (
                <a
                  href={footerConfig.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-stone-800 hover:bg-[#1877F2] text-stone-300 hover:text-white flex items-center justify-center transition-all shadow-xs"
                  aria-label="Facebook"
                  title="Facebook"
                >
                  <Facebook className="w-3.5 h-3.5" />
                </a>
              )}
              {footerConfig.youtubeUrl && (
                <a
                  href={footerConfig.youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-stone-800 hover:bg-[#FF0000] text-stone-300 hover:text-white flex items-center justify-center transition-all shadow-xs"
                  aria-label="YouTube"
                  title="YouTube"
                >
                  <Youtube className="w-3.5 h-3.5" />
                </a>
              )}
              {footerConfig.instagramUrl && (
                <a
                  href={footerConfig.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-stone-800 hover:bg-[#E4405F] text-stone-300 hover:text-white flex items-center justify-center transition-all shadow-xs"
                  aria-label="Instagram"
                  title="Instagram"
                >
                  <Instagram className="w-3.5 h-3.5" />
                </a>
              )}
              {footerConfig.whatsappUrl && (
                <a
                  href={footerConfig.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-stone-800 hover:bg-[#25D366] text-stone-300 hover:text-white flex items-center justify-center transition-all shadow-xs"
                  aria-label="WhatsApp"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Links & Policies */}
          <div className="space-y-2 sm:space-y-3">
            <h4 className="text-white font-bold text-xs sm:text-sm border-l-2 border-amber-500 pl-2">
              প্রয়োজনীয় লিংক
            </h4>
            <div className="flex flex-col gap-1.5 text-[11px] sm:text-xs text-stone-300">
              {quickLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => handleLinkClick(link.url)}
                  className="hover:text-amber-400 transition-colors text-left flex items-center gap-1 cursor-pointer group"
                >
                  <ChevronRight className="w-2.5 h-2.5 text-stone-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  <span className="truncate">{link.title}</span>
                </button>
              ))}
              {policies.map((policy) => (
                <button
                  key={policy.id}
                  onClick={() =>
                    setActivePolicyModal({
                      title: policy.title,
                      content: policy.content,
                    })
                  }
                  className="hover:text-amber-400 transition-colors flex items-center gap-1 text-left cursor-pointer group"
                >
                  <ChevronRight className="w-2.5 h-2.5 text-stone-500 group-hover:text-amber-400 transition-colors shrink-0" />
                  <span className="truncate">{policy.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Column 3: Contact Us (যোগাযোগ করুন) */}
          <div className="space-y-2 sm:space-y-3">
            <h4 className="text-white font-bold text-xs sm:text-sm border-l-2 border-amber-500 pl-2">
              যোগাযোগ
            </h4>
            <div className="space-y-2 text-[11px] sm:text-xs text-stone-400">
              {/* Showroom & Head Office */}
              <div className="flex items-start gap-1.5">
                <div className="p-1 rounded-md bg-stone-800 text-amber-400 shrink-0 mt-0.5">
                  <MapPin className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400">শোরুম</p>
                  <p className="text-stone-300 leading-snug line-clamp-3">
                    {showroomAddress}
                  </p>
                </div>
              </div>

              {/* Helpline */}
              <div className="flex items-start gap-1.5">
                <div className="p-1 rounded-md bg-stone-800 text-amber-400 shrink-0 mt-0.5">
                  <Phone className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400">হেল্পলাইন</p>
                  <a
                    href={`tel:${helplinePhone.replace(/[\s-]/g, '')}`}
                    className="text-stone-300 hover:text-amber-400 font-semibold block transition-colors truncate"
                  >
                    {helplinePhone}
                  </a>
                </div>
              </div>

              {/* Email Support */}
              <div className="flex items-start gap-1.5">
                <div className="p-1 rounded-md bg-stone-800 text-amber-400 shrink-0 mt-0.5">
                  <Mail className="w-3 h-3" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400">ইমেইল</p>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="text-stone-300 hover:text-amber-400 block transition-colors truncate"
                  >
                    {supportEmail}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <p>
            © 2026 বাস্ত্র শৈলি (BASTRA SHOILY). সর্বস্বত্ব সংরক্ষিত।
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-stone-400">বাংলাদেশের ঐতিহ্য ও আধুনিকতার বিশ্বস্ত মেলবন্ধন।</span>
          </div>
        </div>
      </div>

      {/* Policy Details Modal */}
      {activePolicyModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 relative animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <button
              onClick={() => setActivePolicyModal(null)}
              className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-stone-900 mb-3 pr-8">{activePolicyModal.title}</h3>
            <div className="overflow-y-auto flex-1 pr-1 text-sm text-stone-600 leading-relaxed whitespace-pre-line">
              {activePolicyModal.content}
            </div>
            <div className="mt-6 pt-3 border-t border-stone-100 text-right">
              <button
                onClick={() => setActivePolicyModal(null)}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
