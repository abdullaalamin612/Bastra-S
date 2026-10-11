import React, { useState, useEffect } from 'react';
import { useShop } from '../../context/ShopContext';
import { FooterConfig, FooterLinkItem, FooterPolicyItem, FooterContactItem } from '../../types';
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
  FileText,
  Eye,
  ChevronRight,
} from 'lucide-react';

const PRESET_ROUTES = [
  { label: 'হোম পেজ (Home)', value: 'home' },
  { label: 'কিভাবে অর্ডার করবেন? (How to Order)', value: 'guide' },
  { label: 'কাপড়ের যত্ন ও ভিডিও গাইড (Fabric Care)', value: 'clothing-guide' },
  { label: 'অর্ডার ট্র্যাকিং (Order Tracking)', value: 'tracking' },
  { label: 'এডমিন প্যানেল (Admin Panel)', value: 'admin' },
  { label: 'তাঁতের লুঙ্গি কালেকশন (Lungi)', value: 'lungi' },
  { label: 'জামদানি ও তাঁতের শাড়ি (Saree)', value: 'saree' },
  { label: 'প্রিমিয়াম পাঞ্জাবি (Panjabi)', value: 'panjabi' },
  { label: 'থ্রি-পিস কালেকশন (Three-Piece)', value: 'three-piece' },
  { label: 'কম্বড কটন টি-শার্ট (T-Shirt)', value: 't-shirt' },
  { label: 'অন্যান্য / কাস্টম লিংক', value: 'custom' },
];

export const FooterManagementModule: React.FC = () => {
  const { footerConfig, updateFooterConfig, showToast } = useShop();

  const [formConfig, setFormConfig] = useState<FooterConfig>(footerConfig);
  const [activeSection, setActiveSection] = useState<'all' | 'links' | 'policies' | 'contacts' | 'social'>('all');

  // Sync when context changes
  useEffect(() => {
    setFormConfig({
      ...footerConfig,
      quickLinks: footerConfig.quickLinks || [],
      policies: footerConfig.policies || [],
      contactItems: footerConfig.contactItems || [],
    });
  }, [footerConfig]);

  // Save all footer settings
  const handleSaveAll = () => {
    updateFooterConfig(formConfig);
    showToast('ফুটারের সকল লিংক, পলিসি ও যোগাযোগ তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
  };

  // --- QUICK LINKS ACTIONS ---
  const handleAddLink = () => {
    const newLink: FooterLinkItem = {
      id: `ql-${Date.now()}`,
      title: 'নতুন লিংক',
      url: 'home',
      isActive: true,
    };
    setFormConfig((prev) => ({
      ...prev,
      quickLinks: [...(prev.quickLinks || []), newLink],
    }));
  };

  const handleUpdateLink = (id: string, updates: Partial<FooterLinkItem>) => {
    setFormConfig((prev) => ({
      ...prev,
      quickLinks: (prev.quickLinks || []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  };

  const handleDeleteLink = (id: string) => {
    setFormConfig((prev) => ({
      ...prev,
      quickLinks: (prev.quickLinks || []).filter((l) => l.id !== id),
    }));
  };

  // --- POLICIES ACTIONS ---
  const handleAddPolicy = () => {
    const newPolicy: FooterPolicyItem = {
      id: `pol-${Date.now()}`,
      title: 'নতুন পলিসির নাম',
      content: 'এখানে বিস্তারিত পলিসি এবং গ্রাহক সেবা নির্দেশিকা লিখুন...',
      isActive: true,
    };
    setFormConfig((prev) => ({
      ...prev,
      policies: [...(prev.policies || []), newPolicy],
    }));
  };

  const handleUpdatePolicy = (id: string, updates: Partial<FooterPolicyItem>) => {
    setFormConfig((prev) => ({
      ...prev,
      policies: (prev.policies || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const handleDeletePolicy = (id: string) => {
    setFormConfig((prev) => ({
      ...prev,
      policies: (prev.policies || []).filter((p) => p.id !== id),
    }));
  };

  // --- CONTACTS ACTIONS ---
  const handleAddContact = () => {
    const newContact: FooterContactItem = {
      id: `cnt-${Date.now()}`,
      type: 'phone',
      label: 'নতুন যোগাযোগ ক্ষেত্র',
      value: '+880 1890-000000',
      link: '',
      isActive: true,
    };
    setFormConfig((prev) => ({
      ...prev,
      contactItems: [...(prev.contactItems || []), newContact],
    }));
  };

  const handleUpdateContact = (id: string, updates: Partial<FooterContactItem>) => {
    setFormConfig((prev) => ({
      ...prev,
      contactItems: (prev.contactItems || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const handleDeleteContact = (id: string) => {
    setFormConfig((prev) => ({
      ...prev,
      contactItems: (prev.contactItems || []).filter((c) => c.id !== id),
    }));
  };

  const currentLinks = formConfig.quickLinks || [];
  const currentPolicies = formConfig.policies || [];
  const currentContacts = formConfig.contactItems || [];

  return (
    <div className="space-y-6">
      {/* Module Header with Save Action */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              ফুটার সম্পূর্ণ কন্ট্রোল (Footer Link, Policy & Contact Manager)
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            ওয়েবসাইটের নিচের ফুটারের প্রয়োজনীয় লিংক, নীতিমালা ও শর্তাবলী, যোগাযোগ তথ্য এবং সোশ্যাল মিডিয়া আইকন অ্যাড, এডিট ও ডিলিট করুন।
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer active:scale-95 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>সকল ফুটার পরিবর্তন সংরক্ষণ করুন</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
        {[
          { id: 'all', label: 'সকল ফুটার সেকশন' },
          { id: 'links', label: `প্রয়োজনীয় লিংক (${currentLinks.length})` },
          { id: 'policies', label: `নীতিমালা ও শর্তাবলী (${currentPolicies.length})` },
          { id: 'contacts', label: `যোগাযোগ করুন (${currentContacts.length})` },
          { id: 'social', label: 'সোশ্যাল মিডিয়া ছোট আইকন' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSection === tab.id
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-700 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. QUICK LINKS SECTION */}
      {(activeSection === 'all' || activeSection === 'links') && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-amber-600" />
                <span>প্রয়োজনীয় লিংক (Quick Links)</span>
              </h3>
              <p className="text-xs text-stone-500">
                ফুটারের ২য় কলামে প্রদর্শিত লিংকগুলো পরিবর্তন, নতুন লিংক অ্যাড অথবা ডিলিট করুন
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddLink}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>নতুন লিংক যোগ করুন</span>
            </button>
          </div>

          {currentLinks.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              কোনো প্রয়োজনীয় লিংক নেই। "নতুন লিংক যোগ করুন" বাটনে ক্লিক করুন।
            </div>
          ) : (
            <div className="space-y-3">
              {currentLinks.map((link, idx) => (
                <div
                  key={link.id}
                  className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3 transition-all hover:border-amber-300"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-stone-400 shrink-0">
                    <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-[11px]">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                      লিংকের নাম (Title)
                    </label>
                    <input
                      type="text"
                      value={link.title}
                      onChange={(e) => handleUpdateLink(link.id, { title: e.target.value })}
                      placeholder="যেমন: কিভাবে অর্ডার করবেন?"
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-bold text-stone-800"
                    />
                  </div>

                  {/* Preset Selector */}
                  <div className="w-full md:w-56">
                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                      গন্তব্য প্রিসেট (Quick Route)
                    </label>
                    <select
                      value={
                        PRESET_ROUTES.some((p) => p.value === link.url)
                          ? link.url
                          : 'custom'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== 'custom') {
                          handleUpdateLink(link.id, { url: val });
                        }
                      }}
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800 font-medium"
                    >
                      {PRESET_ROUTES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom URL or Route */}
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                      URL বা রুট পাথ
                    </label>
                    <input
                      type="text"
                      value={link.url}
                      onChange={(e) => handleUpdateLink(link.id, { url: e.target.value })}
                      placeholder="যেমন: guide অথবা https://..."
                      className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-700"
                    />
                  </div>

                  {/* Active Toggle & Delete */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-4 shrink-0">
                    <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={link.isActive !== false}
                        onChange={(e) => handleUpdateLink(link.id, { isActive: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>সক্রিয়</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDeleteLink(link.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="লিংক মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. POLICIES & TERMS SECTION */}
      {(activeSection === 'all' || activeSection === 'policies') && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>নীতিমালা ও শর্তাবলী (Policies & Terms)</span>
              </h3>
              <p className="text-xs text-stone-500">
                ফুটারের ৩য় কলামের প্রতিটি পলিসি এডিট, নতুন শর্তাবলী অ্যাড ও ডিলিট করুন (ক্লিক করলে বিস্তারিত পপআপে দেখাবে)
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPolicy}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>নতুন পলিসি যোগ করুন</span>
            </button>
          </div>

          {currentPolicies.length === 0 ? (
            <div className="text-center py-8 text-stone-400 text-xs">
              কোনো পলিসি নেই। "নতুন পলিসি যোগ করুন" বাটনে ক্লিক করুন।
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {currentPolicies.map((policy, idx) => (
                <div
                  key={policy.id}
                  className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5 space-y-3 transition-all hover:border-amber-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-stone-800">
                        {policy.title || 'শিরোনামবিহীন পলিসি'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={policy.isActive !== false}
                          onChange={(e) =>
                            handleUpdatePolicy(policy.id, { isActive: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>সক্রিয়</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="পলিসি মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                        পলিসির শিরোনাম (Title)
                      </label>
                      <input
                        type="text"
                        value={policy.title}
                        onChange={(e) => handleUpdatePolicy(policy.id, { title: e.target.value })}
                        placeholder="যেমন: রিটার্ন ও এক্সচেঞ্জ পলিসি"
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-bold text-stone-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                        বিস্তারিত বিবরণ ও শর্তাবলী (পপআপে যা প্রদর্শিত হবে)
                      </label>
                      <textarea
                        rows={3}
                        value={policy.content}
                        onChange={(e) =>
                          handleUpdatePolicy(policy.id, { content: e.target.value })
                        }
                        placeholder="পলিসির সম্পূর্ণ শর্তাবলী ও নিয়মাবলি এখানে লিখুন..."
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-700 leading-relaxed font-sans"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. CONTACT INFORMATION SECTION */}
      {(activeSection === 'all' || activeSection === 'contacts') && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
            <div>
              <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>যোগাযোগ করুন (Contact Information)</span>
              </h3>
              <p className="text-xs text-stone-500">
                ফুটারের ৪র্থ কলামের ঠিকানা, ফোন, হেল্পলাইন, ইমেইল ও অন্যান্য যোগাযোগ ফিল্ড যোগ ও সম্পাদন করুন
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddContact}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>নতুন যোগাযোগ ফিল্ড যোগ করুন</span>
            </button>
          </div>

          {/* Quick Primary Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                প্রধান অফিস ও শোরুমের ঠিকানা
              </label>
              <input
                type="text"
                value={formConfig.address}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="বাস্ত্র শৈলি ভবন, মিরপুর রোড, ঢাকা"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                প্রধান ফোন / হেল্পলাইন নম্বর
              </label>
              <input
                type="text"
                value={formConfig.phone}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+880 1890-123456"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                সাপোর্ট ইমেইল এড্রেস
              </label>
              <input
                type="email"
                value={formConfig.email}
                onChange={(e) => setFormConfig((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="support@bastrashoily.com"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800"
              />
            </div>
          </div>

          {/* Dynamic Additional Contacts */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-stone-700">কাস্টম যোগাযোগ আইটেমসমূহ:</h4>
            {currentContacts.map((contact, idx) => (
              <div
                key={contact.id}
                className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3"
              >
                {/* Type */}
                <div className="w-full md:w-36">
                  <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                    ধরন (Type)
                  </label>
                  <select
                    value={contact.type}
                    onChange={(e) =>
                      handleUpdateContact(contact.id, { type: e.target.value as any })
                    }
                    className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 font-medium"
                  >
                    <option value="address">ঠিকানা (Address)</option>
                    <option value="phone">ফোন (Phone)</option>
                    <option value="email">ইমেইল (Email)</option>
                    <option value="whatsapp">হোয়াটসঅ্যাপ (WhatsApp)</option>
                    <option value="other">অন্যান্য (Other)</option>
                  </select>
                </div>

                {/* Label */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                    লেবেল (Label)
                  </label>
                  <input
                    type="text"
                    value={contact.label}
                    onChange={(e) => handleUpdateContact(contact.id, { label: e.target.value })}
                    placeholder="যেমন: হেল্পলাইন বা শোরুম শাখা"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-bold text-stone-800"
                  />
                </div>

                {/* Value */}
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                    মান / নম্বর / ঠিকানা (Value)
                  </label>
                  <input
                    type="text"
                    value={contact.value}
                    onChange={(e) => handleUpdateContact(contact.id, { value: e.target.value })}
                    placeholder="যেমন: +880 1890-123456"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs text-stone-800"
                  />
                </div>

                {/* Link */}
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] uppercase font-bold text-stone-500 mb-1">
                    ক্লিক লিংক (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={contact.link || ''}
                    onChange={(e) => handleUpdateContact(contact.id, { link: e.target.value })}
                    placeholder="যেমন: tel:+8801890..."
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-mono text-stone-600"
                  />
                </div>

                {/* Delete */}
                <div className="flex items-center justify-end pt-2 md:pt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteContact(contact.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SOCIAL MEDIA ICONS (Clean Small Icons Only, No Text) */}
      {(activeSection === 'all' || activeSection === 'social') && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="pb-4 border-b border-stone-100">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <Share2Icon className="w-4 h-4 text-amber-600" />
              <span>সোশ্যাল মিডিয়া লিংক (ছোট আইকন, কোনো লেখা ছাড়া)</span>
            </h3>
            <p className="text-xs text-stone-500">
              গ্রাহকের অনুরোধ অনুযায়ী ফুটারে কোনো টেক্সট লেখা (যেমন FB, IG, YT) থাকবে না, শুধুমাত্র মার্জিত ছোট আইকন থাকবে।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Facebook */}
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#1877F2] text-white flex items-center justify-center">
                  <Facebook className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-800">Facebook URL</span>
              </div>
              <input
                type="text"
                value={formConfig.facebookUrl || ''}
                onChange={(e) =>
                  setFormConfig((prev) => ({ ...prev, facebookUrl: e.target.value }))
                }
                placeholder="https://facebook.com/..."
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-700"
              />
            </div>

            {/* YouTube */}
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FF0000] text-white flex items-center justify-center">
                  <Youtube className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-800">YouTube Channel URL</span>
              </div>
              <input
                type="text"
                value={formConfig.youtubeUrl || ''}
                onChange={(e) =>
                  setFormConfig((prev) => ({ ...prev, youtubeUrl: e.target.value }))
                }
                placeholder="https://youtube.com/@..."
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-700"
              />
            </div>

            {/* Instagram */}
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#E4405F] text-white flex items-center justify-center">
                  <Instagram className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-800">Instagram Profile URL</span>
              </div>
              <input
                type="text"
                value={formConfig.instagramUrl || ''}
                onChange={(e) =>
                  setFormConfig((prev) => ({ ...prev, instagramUrl: e.target.value }))
                }
                placeholder="https://instagram.com/..."
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-700"
              />
            </div>

            {/* WhatsApp */}
            <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#25D366] text-white flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-800">WhatsApp Link / Number</span>
              </div>
              <input
                type="text"
                value={formConfig.whatsappUrl || ''}
                onChange={(e) =>
                  setFormConfig((prev) => ({ ...prev, whatsappUrl: e.target.value }))
                }
                placeholder="https://wa.me/8801890..."
                className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-stone-700"
              />
            </div>
          </div>

          {/* Live Preview of small icons */}
          <div className="bg-stone-900 text-stone-200 p-4 rounded-xl flex items-center justify-between">
            <div className="text-xs">
              <span className="text-amber-400 font-bold block">লাইভ ফুটার প্রিভিউ:</span>
              <span className="text-stone-400">ওয়েবসাইটে যেভাবে ছোট আইকন হিসেবে দেখাবে (কোনো লেখা নেই):</span>
            </div>
            <div className="flex items-center gap-2.5">
              {formConfig.facebookUrl && (
                <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                  <Facebook className="w-4 h-4 text-blue-400" />
                </div>
              )}
              {formConfig.youtubeUrl && (
                <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                  <Youtube className="w-4 h-4 text-rose-500" />
                </div>
              )}
              {formConfig.instagramUrl && (
                <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                  <Instagram className="w-4 h-4 text-pink-400" />
                </div>
              )}
              {formConfig.whatsappUrl && (
                <div className="w-8 h-8 rounded-lg bg-stone-800 text-white flex items-center justify-center shadow-xs">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. ABOUT US & COPYRIGHT TEXT */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-stone-100">
          <h3 className="text-sm font-black text-stone-900">
            ফুটার ব্র্যান্ড পরিচিতি ও কপিরাইট টেক্সট
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
              ১ম কলামের ব্র্যান্ড পরিচিতি (About Us)
            </label>
            <textarea
              rows={3}
              value={formConfig.aboutUs}
              onChange={(e) => setFormConfig((prev) => ({ ...prev, aboutUs: e.target.value }))}
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
              কপিরাইট বার্তা (Copyright Notice)
            </label>
            <textarea
              rows={3}
              value={formConfig.copyrightText || ''}
              onChange={(e) => setFormConfig((prev) => ({ ...prev, copyrightText: e.target.value }))}
              placeholder="বাস্ত্র শৈলি (BASTRA SHOILY). সর্বস্বত্ব সংরক্ষিত।"
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-800 leading-relaxed"
            />
          </div>
        </div>
      </div>

      {/* Bottom Sticky Save Bar */}
      <div className="sticky bottom-4 z-20 bg-stone-900/95 backdrop-blur-sm text-white p-4 rounded-2xl border border-stone-700 shadow-xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">পরিবর্তনগুলো সেভ করলেই হোম পেজ ও ওয়েবসাইটের ফুটারে লাইভ আপডেট হবে</span>
          <span className="sm:hidden">হোম পেজে লাইভ আপডেট হবে</span>
        </div>

        <button
          type="button"
          onClick={handleSaveAll}
          className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer active:scale-95 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>সকল ফুটার পরিবর্তন সংরক্ষণ করুন</span>
        </button>
      </div>
    </div>
  );
};

function Share2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className || 'w-4 h-4'}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
