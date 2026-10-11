import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Logo } from './Logo';
import {
  ShoppingBasket,
  Search,
  ChevronDown,
  Menu,
  X,
  Truck,
  PhoneCall,
  ShieldCheck,
  HelpCircle,
  Video,
  User,
  MoreVertical,
  ArrowLeft,
  Lock,
  Ruler,
  MessageCircle,
  Package,
  LogOut,
  Sparkles,
} from 'lucide-react';

export function isExactAdminUrl(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim().toLowerCase();
  let clean = trimmed.replace(/^https?:\/\//, '');
  clean = clean.replace(/^www\./, '');
  clean = clean.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return clean === 'bastrashoily.com/admin' || clean === 'bastrashoily.com/admin/login';
}

export const Header: React.FC = () => {
  const {
    navMenus,
    navigateToHome,
    navigateToCategory,
    navigateToTracking,
    navigateToAdmin,
    navigateToCmsGuide,
    navigateToClothingGuide,
    currentView,
    cartCount,
    cartSubtotal,
    setIsCartOpen,
    products,
    navigateToProduct,
    currentCustomer,
    customerLogout,
    openCustomerAuthModal,
    openCustomerAccountModal,
    navigateBack,
    isAdminAuthenticated,
    openSizeGuideModal,
    language,
    toggleLanguage,
    generalSettings,
    footerConfig,
    deliveryConfig,
  } = useShop();

  const helplinePhone = footerConfig?.phone || generalSettings?.phone || '+880 1864-528488';
  const whatsappUrl = footerConfig?.whatsappUrl || `https://wa.me/${(generalSettings?.whatsappNumber || '8801864528488').replace(/[^0-9]/g, '')}`;

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMobileDropdown, setActiveMobileDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const isAdminSearch = isExactAdminUrl(searchQuery);

  const filteredProducts = (!isAdminSearch && searchQuery.trim())
    ? products
        .filter(
          (p) =>
            p.status === 'active' &&
            (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.banglaName.includes(searchQuery) ||
              p.subCategory.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .slice(0, 5)
    : [];

  const handleDesktopSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isAdminSearch) {
        setSearchQuery('');
        navigateToAdmin();
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/25 backdrop-blur-[3px] border-b border-stone-200/30 shadow-xs transition-all">
      {/* Top Banner Bar - Slim & Translucent */}
      <div className="bg-stone-900/80 backdrop-blur-xs text-stone-300 text-[11px] py-1 px-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="hidden sm:inline">সারা দেশে ক্যাশ অন ডেলিভারি</span>
            <span className="text-stone-600 hidden sm:inline">•</span>
            <span className="text-amber-300 font-medium">৳{(deliveryConfig?.freeDeliveryThreshold ?? 2000).toLocaleString()} টাকার বেশি অর্ডারে ফ্রি ডেলিভারি</span>
          </div>

          <div className="flex items-center gap-2.5 text-[11px] ml-auto">
            <a
              href={`tel:${helplinePhone.replace(/[\s-]/g, '')}`}
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5 hidden md:flex"
            >
              <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
              <span>{helplinePhone}</span>
            </a>
            <span className="text-stone-700 hidden md:inline">|</span>

            {/* Language Switcher Button (Bn / En) */}
            <button
              id="header-lang-switch-btn"
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-[11px] font-bold border border-stone-700 transition-all cursor-pointer shadow-xs active:scale-95"
              title={language === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}
            >
              <span className={language === 'bn' ? 'text-amber-400 font-extrabold' : 'text-stone-400 font-normal'}>
                বাং
              </span>
              <span className="text-stone-600">/</span>
              <span className={language === 'en' ? 'text-amber-400 font-extrabold' : 'text-stone-400 font-normal'}>
                EN
              </span>
            </button>

            {/* 3-Dot More Menu Button (Size Guide, Tracking, WhatsApp) */}
            <div className="relative">
              <button
                id="header-three-dot-menu-btn"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isMoreMenuOpen
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700'
                }`}
                title="আরও অপশন ও মেনু (More Menu)"
              >
                <MoreVertical className="w-4 h-4" />
                <span className="text-[11px] hidden sm:inline">মেনু</span>
              </button>

              {/* 3-Dot Dropdown */}
              {isMoreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMoreMenuOpen(false)}
                  />
                  <div
                    id="three-dot-dropdown-menu"
                    className="absolute right-0 top-full mt-2 w-56 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl p-2 z-50 text-stone-200 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
                  >
                    {/* Track Order */}
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        navigateToTracking();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5 text-stone-400" />
                      <span>অর্ডার ট্র্যাক করুন</span>
                    </button>

                    {/* How to Order Guide */}
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        navigateToCmsGuide();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
                      <span>কীভাবে অর্ডার করবেন</span>
                    </button>

                    {/* Size Guide */}
                    <button
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        openSizeGuideModal('Lungi');
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-stone-800 hover:text-stone-100 transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Ruler className="w-3.5 h-3.5 text-amber-400" />
                      <span>সাইজ গাইড (Size Guide)</span>
                    </button>

                    {/* WhatsApp Direct */}
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsMoreMenuOpen(false)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-emerald-950/60 hover:text-emerald-300 transition-colors flex items-center gap-2.5 cursor-pointer text-emerald-400"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp সহায়তা</span>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Bar - Ultra Compact Height & Translucent */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-11 sm:h-13 gap-2 sm:gap-3">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 text-stone-700 hover:bg-stone-100/80 rounded-xl"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Logo & Universal Back Navigation */}
          <div className="flex items-center gap-2">
            {/* Universal Back Button beside Logo when not on home page */}
            {currentView !== 'home' && (
              <button
                id="header-back-button"
                onClick={navigateBack}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-100/90 hover:bg-stone-200 active:scale-95 text-stone-800 text-[11px] font-bold transition-all cursor-pointer border border-stone-200"
                title="পূর্বের পেজে ফিরে যান (Back)"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline">পেছনে</span>
              </button>
            )}

            <div className="cursor-pointer" onClick={navigateToHome}>
              <Logo />
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-0.5 xl:gap-1.5">
            <button
              onClick={navigateToHome}
              className={`px-3 py-1.5 text-xs xl:text-sm font-semibold rounded-xl transition-colors ${
                currentView === 'home'
                  ? 'text-amber-800 font-bold bg-amber-50'
                  : 'text-stone-700 hover:text-amber-800 hover:bg-stone-50'
              }`}
            >
              হোম (Home)
            </button>

            {/* Dynamic Categories Dropdown Menus configured from Admin */}
            {navMenus
              .filter((menu) => menu.isActive)
              .sort((a, b) => a.order - b.order)
              .map((menu) => (
                <div key={menu.id} className="relative group py-1">
                  <button
                    onClick={() => navigateToCategory(menu.mainCategory.toLowerCase())}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs xl:text-sm font-semibold text-stone-700 hover:text-amber-800 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    <span>{menu.label}</span>
                    <span className="text-[11px] text-stone-500 font-normal">({menu.banglaLabel})</span>
                    <ChevronDown className="w-3.5 h-3.5 text-stone-400 group-hover:rotate-180 transition-transform duration-200" />
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute top-full left-0 w-64 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                    <div className="bg-white rounded-2xl border border-stone-200 p-2 space-y-1 shadow-xl">
                      {menu.items
                        .filter((item) => item.isActive)
                        .sort((a, b) => a.order - b.order)
                        .map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              if (item.categorySlug) {
                                navigateToCategory(item.categorySlug);
                              } else {
                                navigateToCategory(item.url.replace('/category/', ''));
                              }
                            }}
                            className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm text-stone-700 hover:bg-amber-50 hover:text-amber-900 transition-colors flex items-center justify-between group/item"
                          >
                            <div>
                              <span className="font-bold block">{item.label}</span>
                              <span className="text-xs text-stone-500">{item.banglaLabel}</span>
                            </div>
                            <span className="text-xs text-amber-600 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all">
                              →
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              ))}

            <button
              onClick={navigateToCmsGuide}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors ${
                currentView === 'how_to_order'
                  ? 'text-amber-800 font-bold bg-amber-50'
                  : 'text-stone-700 hover:text-amber-800 hover:bg-stone-50'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>অর্ডার নির্দেশিকা</span>
            </button>

            <button
              onClick={navigateToClothingGuide}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors ${
                currentView === 'clothing_guide'
                  ? 'text-amber-800 font-bold bg-amber-50'
                  : 'text-stone-700 hover:text-amber-800 hover:bg-stone-50'
              }`}
            >
              <Video className="w-4 h-4 text-amber-600" />
              <span>ভিডিও গাইড</span>
            </button>
          </nav>

          {/* Right Actions: Search & Cart */}
          <div className="flex items-center gap-3">
            {/* Search Input on Desktop */}
            <div className="relative hidden md:block w-56 xl:w-72">
              <input
                id="desktop-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleDesktopSearchKeyDown}
                placeholder="লুঙ্গি, শাড়ি বা পাঞ্জাবি খুঁজুন..."
                className="w-full bg-stone-100/80 border border-stone-200 rounded-full pl-10 pr-4 py-2 text-xs sm:text-sm text-stone-800 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-all placeholder:text-stone-400"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5 pointer-events-none" />

              {/* Search Dropdown Results */}
              {searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-stone-200 p-2 z-50 shadow-xl max-h-96 overflow-y-auto">
                  {isAdminSearch ? (
                    <div
                      id="desktop-search-admin-direct-link"
                      onClick={() => {
                        setSearchQuery('');
                        navigateToAdmin();
                      }}
                      className="flex items-center gap-3 p-3 bg-stone-900 text-white hover:bg-stone-800 rounded-xl cursor-pointer transition-colors border border-amber-500/40"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                        🔐
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-400">Admin Login এ প্রবেশ করুন</p>
                        <p className="text-[11px] text-stone-300">Enter চাপুন অথবা ক্লিক করে এডমিন পেজে যান</p>
                      </div>
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          navigateToProduct(p.slug);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 p-2 hover:bg-amber-50 rounded-xl cursor-pointer transition-colors"
                      >
                        <img
                          src={p.mainImage}
                          alt={p.name}
                          className="w-12 h-12 object-cover rounded-lg shrink-0 border border-stone-200"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-stone-800 truncate">{p.name}</p>
                          <p className="text-xs text-stone-500 truncate">{p.banglaName}</p>
                          <p className="text-xs font-bold text-amber-800">৳{p.discountPrice || p.price}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-500 p-4 text-center">কোনো পণ্য পাওয়া যায়নি</p>
                  )}
                </div>
              )}
            </div>

            {/* Customer Account Button (Visible on Mobile and Desktop) */}
            <button
              id="header-customer-account-btn"
              onClick={() => (currentCustomer ? openCustomerAccountModal() : openCustomerAuthModal('login'))}
              className="flex p-2 text-stone-700 hover:text-amber-700 hover:bg-stone-100 rounded-full transition-colors relative cursor-pointer"
              aria-label="Customer Account"
              title={currentCustomer ? `আমার একাউন্ট: ${currentCustomer.name}` : (language === 'bn' ? 'লগইন / রেজিস্টার করুন' : 'Login / Register')}
            >
              <User className="w-5 h-5" />
              {currentCustomer && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </button>

            {/* Cart Button (Desktop Only) */}
            <button
              id="header-cart-drawer-trigger"
              onClick={() => setIsCartOpen(true)}
              className="hidden md:flex relative items-center gap-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-4 py-2.5 rounded-full shadow-md shadow-amber-900/20 transition-all active:scale-95"
              aria-label="View shopping basket"
            >
              <div className="relative">
                <ShoppingBasket className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2.5 bg-stone-900 text-amber-300 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex flex-col text-left text-xs leading-tight">
                <span className="text-amber-200 text-[10px] uppercase font-bold">{language === 'bn' ? 'ঝুড়ি' : 'Basket'}</span>
                <span className="font-bold">৳{cartSubtotal}</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg">
          <button
            onClick={() => {
              navigateToHome();
              setIsMobileMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-xl font-bold text-stone-800 hover:bg-amber-50"
          >
            হোম (Home)
          </button>

          {navMenus
            .filter((m) => m.isActive)
            .map((menu) => (
              <div key={menu.id} className="border-b border-stone-100 pb-2">
                <button
                  onClick={() =>
                    setActiveMobileDropdown(activeMobileDropdown === menu.id ? null : menu.id)
                  }
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-stone-800"
                >
                  <span>
                    {menu.label} <span className="text-xs text-stone-500 font-normal">({menu.banglaLabel})</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-400 transition-transform ${
                      activeMobileDropdown === menu.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {activeMobileDropdown === menu.id && (
                  <div className="pl-4 pt-1 space-y-1">
                    {menu.items
                      .filter((it) => it.isActive)
                      .map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (item.categorySlug) {
                              navigateToCategory(item.categorySlug);
                            } else {
                              navigateToCategory(item.url.replace('/category/', ''));
                            }
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-stone-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg"
                        >
                          {item.label} ({item.banglaLabel})
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}

          <button
            onClick={() => {
              navigateToCmsGuide();
              setIsMobileMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>কিভাবে অর্ডার করবেন?</span>
          </button>

          <button
            onClick={() => {
              navigateToClothingGuide();
              setIsMobileMenuOpen(false);
            }}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 hover:bg-amber-50 hover:text-amber-800 flex items-center gap-2"
          >
            <Video className="w-4 h-4 text-amber-600" />
            <span>বস্ত্র শৈলি তথ্য ও ভিডিও</span>
          </button>

          <div className="pt-2 space-y-2">
            {/* Mobile Language Switcher */}
            <div className="flex items-center justify-between p-3 bg-stone-100 rounded-xl">
              <span className="text-xs font-bold text-stone-700">ভাষা / Language</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-stone-200 shadow-2xs">
                <button
                  onClick={() => {
                    if (language !== 'bn') toggleLanguage();
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    language === 'bn' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  onClick={() => {
                    if (language !== 'en') toggleLanguage();
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                    language === 'en' ? 'bg-amber-600 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
