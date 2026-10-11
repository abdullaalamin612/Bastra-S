import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Boxes,
  Users,
  Compass,
  FileText,
  Sliders,
  Settings,
  Store,
  LogOut,
  Bell,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Tag,
  Truck,
  ShieldCheck,
  Building2,
  MessageSquareWarning,
  CheckSquare,
  BarChart3,
  Bot,
  Menu,
  X,
  CreditCard,
  UserCheck,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  Code,
  Image,
  BookOpen,
  MessageSquare,
  Sparkles,
  Clock,
  RotateCcw,
  Star,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  // 1. STORE
  | 'products'
  | 'categories'
  | 'inventory'
  | 'orders'
  | 'returns_refunds'
  | 'customers'
  | 'reviews'
  // 2. OPERATIONS & B2B
  | 'wholesale'
  | 'complaints'
  | 'tasks'
  | 'customer_alerts'
  // 3. SALES & FINANCE
  | 'payments'
  | 'reports'
  | 'coupons'
  // 4. MARKETING
  | 'campaigns'
  | 'timer_offers'
  | 'landing_pages'
  | 'gtm_pixel'
  | 'product_feed'
  // 5. CUSTOMER SERVICE
  | 'customer_messages'
  | 'notifications'
  | 'ai_assistant'
  // 6. CONTENT
  | 'banners'
  | 'menus'
  | 'offers'
  | 'cms_pages'
  | 'order_guides'
  | 'videos'
  | 'brand_stories'
  | 'homepage_sections'
  // 7. ANALYTICS
  | 'analytics_sales'
  | 'analytics_products'
  | 'analytics_customers'
  | 'analytics_marketing'
  | 'analytics_inventory'
  // 8. SETTINGS & SECURITY
  | 'store_settings'
  | 'payment_settings'
  | 'courier_settings'
  | 'admin_users'
  | 'roles_permissions'
  | 'ai_settings'
  | 'integrations'
  | 'audit_logs'
  | 'backup_database'
  | 'system_settings';

interface AdminLayoutProps {
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  activeTab,
  setActiveTab,
  children,
}) => {
  const {
    navigateToHome,
    orders,
    products,
    currentUser,
    toastMessage,
    adminLogout,
    requireAdminPasswordChange,
    changeAdminPassword,
  } = useShop();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(3);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    if (['products', 'categories', 'inventory', 'orders', 'returns_refunds', 'customers', 'reviews'].includes(activeTab)) return 'store';
    if (['wholesale', 'complaints', 'tasks', 'customer_alerts'].includes(activeTab)) return 'operations';
    if (['payments', 'reports', 'coupons'].includes(activeTab)) return 'finance';
    if (['campaigns', 'timer_offers', 'landing_pages', 'gtm_pixel', 'product_feed'].includes(activeTab)) return 'marketing';
    if (['customer_messages', 'notifications', 'ai_assistant'].includes(activeTab)) return 'customer_service';
    if (['banners', 'menus', 'offers', 'cms_pages', 'order_guides', 'videos', 'brand_stories', 'homepage_sections'].includes(activeTab)) return 'content';
    if (['analytics_sales', 'analytics_products', 'analytics_customers', 'analytics_marketing', 'analytics_inventory'].includes(activeTab)) return 'analytics';
    if (['store_settings', 'payment_settings', 'courier_settings', 'admin_users', 'roles_permissions', 'ai_settings', 'integrations', 'audit_logs', 'backup_database', 'system_settings'].includes(activeTab)) return 'settings';
    return null;
  });

  // Change Password Modal State
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('সবগুলো ঘর পূরণ করুন');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('নতুন পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না');
      return;
    }
    setIsSubmittingPassword(true);
    try {
      const res = await changeAdminPassword(oldPassword, newPassword);
      if (res && res.success) {
        setIsChangePasswordModalOpen(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(res?.message || 'পাসওয়ার্ড পরিবর্তনে ত্রুটি হয়েছে');
      }
    } catch {
      setPasswordError('সার্ভার এরর: পাসওয়ার্ড পরিবর্তন করা যায়নি');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const pendingOrdersCount = orders.filter((o) => o.orderStatus === 'pending').length;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length;

  // Auto-expand section when activeTab changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      return;
    }
    if (['products', 'categories', 'inventory', 'orders', 'returns_refunds', 'customers', 'reviews'].includes(activeTab)) {
      setExpandedSection('store');
    } else if (['wholesale', 'complaints', 'tasks', 'customer_alerts'].includes(activeTab)) {
      setExpandedSection('operations');
    } else if (['payments', 'reports', 'coupons'].includes(activeTab)) {
      setExpandedSection('finance');
    } else if (['campaigns', 'timer_offers', 'landing_pages', 'gtm_pixel', 'product_feed'].includes(activeTab)) {
      setExpandedSection('marketing');
    } else if (['customer_messages', 'notifications', 'ai_assistant'].includes(activeTab)) {
      setExpandedSection('customer_service');
    } else if (['banners', 'menus', 'offers', 'cms_pages', 'order_guides', 'videos', 'brand_stories', 'homepage_sections'].includes(activeTab)) {
      setExpandedSection('content');
    } else if (['analytics_sales', 'analytics_products', 'analytics_customers', 'analytics_marketing', 'analytics_inventory'].includes(activeTab)) {
      setExpandedSection('analytics');
    } else if (['store_settings', 'payment_settings', 'courier_settings', 'admin_users', 'roles_permissions', 'ai_settings', 'integrations', 'audit_logs', 'backup_database', 'system_settings'].includes(activeTab)) {
      setExpandedSection('settings');
    }
  }, [activeTab]);

  // Tab Permission Requirements Map for Role-Based Sidebar Navigation (BUG 12)
  const TAB_PERMISSION_MAP: Partial<Record<AdminTab, string[]>> = {
    dashboard: [],
    products: ['products.view', 'products.edit'],
    categories: ['products.view'],
    inventory: ['products.view'],
    orders: ['orders.view'],
    returns_refunds: ['orders.view'],
    customers: ['customers.view', 'orders.view'],
    reviews: ['products.view'],
    wholesale: ['wholesale.view', 'orders.view'],
    complaints: ['orders.view'],
    tasks: ['settings.manage'],
    customer_alerts: ['orders.view'],
    payments: ['payments.view', 'payments.manage'],
    reports: ['reports.view'],
    coupons: ['marketing.manage'],
    campaigns: ['marketing.manage'],
    timer_offers: ['marketing.manage'],
    landing_pages: ['marketing.manage'],
    gtm_pixel: ['marketing.manage'],
    product_feed: ['marketing.manage'],
    customer_messages: ['orders.view'],
    notifications: ['orders.view'],
    ai_assistant: ['settings.manage'],
    banners: ['marketing.manage'],
    menus: ['marketing.manage'],
    offers: ['marketing.manage'],
    cms_pages: ['marketing.manage'],
    order_guides: ['marketing.manage'],
    videos: ['marketing.manage'],
    brand_stories: ['marketing.manage'],
    homepage_sections: ['marketing.manage'],
    analytics_sales: ['reports.view'],
    analytics_products: ['reports.view'],
    analytics_customers: ['reports.view', 'orders.view'],
    analytics_marketing: ['reports.view', 'marketing.manage'],
    analytics_inventory: ['reports.view'],
    store_settings: ['settings.manage'],
    payment_settings: ['settings.manage', 'payments.manage'],
    courier_settings: ['settings.manage'],
    admin_users: ['admins.manage'],
    roles_permissions: ['admins.manage'],
    ai_settings: ['settings.manage'],
    integrations: ['settings.manage'],
    audit_logs: ['admins.manage'],
    backup_database: ['admins.manage'],
    system_settings: ['settings.manage'],
  };

  const isTabPermitted = (tabId: AdminTab): boolean => {
    if (!currentUser) return true;
    if (currentUser.role === 'super_admin') return true;
    const required = TAB_PERMISSION_MAP[tabId];
    if (!required || required.length === 0) return true;

    const userPerms: string[] = (currentUser as any).permissions
      ? (typeof (currentUser as any).permissions === 'string'
          ? JSON.parse((currentUser as any).permissions)
          : (currentUser as any).permissions)
      : [];

    if (userPerms.includes('all') || userPerms.includes('*')) return true;

    return required.some((reqPerm) => userPerms.includes(reqPerm) || userPerms.includes(reqPerm.split('.')[0] + '.*'));
  };

  const adminName = currentUser?.name || 'Admin User';
  const adminEmail = currentUser?.email || 'admin@bastrashoily.com';
  const adminRoleDisplay = currentUser?.role === 'super_admin'
    ? 'Super Admin'
    : (currentUser?.role === 'product_manager'
        ? 'Product Manager'
        : (currentUser?.role === 'order_manager'
            ? 'Order Manager'
            : (currentUser?.role || 'Admin Staff')));
  const adminInitial = (adminName ? adminName.charAt(0) : 'A').toUpperCase();

  const rawNavSections = [
    {
      id: 'store',
      number: '১',
      title: 'STORE',
      banglaTitle: 'স্টোর ও পণ্য',
      icon: Store,
      badge: pendingOrdersCount + lowStockCount,
      items: [
        { id: 'products' as AdminTab, label: 'Products & Variants', banglaLabel: 'Products & Variants', icon: Package },
        { id: 'categories' as AdminTab, label: 'Categories', banglaLabel: 'Categories', icon: Layers },
        { id: 'inventory' as AdminTab, label: 'Inventory', banglaLabel: 'Inventory', icon: Boxes, badge: lowStockCount },
        { id: 'orders' as AdminTab, label: 'Orders', banglaLabel: 'Orders', icon: ShoppingCart, badge: pendingOrdersCount },
        { id: 'returns_refunds' as AdminTab, label: 'Returns & Refunds', banglaLabel: 'Returns & Refunds', icon: AlertTriangle, isSubChild: true },
        { id: 'customers' as AdminTab, label: 'Customers', banglaLabel: 'Customers', icon: Users },
        { id: 'reviews' as AdminTab, label: 'Reviews', banglaLabel: 'Reviews', icon: Star },
      ],
    },
    {
      id: 'operations',
      number: '২',
      title: 'OPERATIONS & B2B',
      banglaTitle: 'অপারেশনস ও B2B',
      icon: Building2,
      badge: unreadNotifications,
      items: [
        { id: 'wholesale' as AdminTab, label: 'Wholesale & Bulk Orders', banglaLabel: 'Wholesale & Bulk Orders', icon: Building2 },
        { id: 'complaints' as AdminTab, label: 'Complaints & Tickets', banglaLabel: 'Complaints & Tickets', icon: MessageSquareWarning },
        { id: 'tasks' as AdminTab, label: 'Internal Tasks', banglaLabel: 'Internal Tasks', icon: CheckSquare },
        { id: 'customer_alerts' as AdminTab, label: 'Customer Messages & Alerts', banglaLabel: 'Customer Messages & Alerts', icon: Bell, badge: unreadNotifications },
      ],
    },
    {
      id: 'finance',
      number: '৩',
      title: 'SALES & FINANCE',
      banglaTitle: 'সেলস ও ফাইন্যান্স',
      icon: CreditCard,
      items: [
        { id: 'payments' as AdminTab, label: 'Payments & Transactions', banglaLabel: 'Payments & Transactions', icon: CreditCard },
        { id: 'reports' as AdminTab, label: 'Business Reports', banglaLabel: 'Business Reports', icon: BarChart3 },
        { id: 'coupons' as AdminTab, label: 'Coupons & Discounts', banglaLabel: 'Coupons & Discounts', icon: Tag },
      ],
    },
    {
      id: 'marketing',
      number: '৪',
      title: 'MARKETING',
      banglaTitle: 'মার্কেটিং',
      icon: Flame,
      items: [
        { id: 'campaigns' as AdminTab, label: 'Campaigns', banglaLabel: 'Campaigns', icon: Flame },
        { id: 'timer_offers' as AdminTab, label: 'Timer Offers', banglaLabel: 'Timer Offers', icon: Clock },
        { id: 'landing_pages' as AdminTab, label: 'Landing Pages', banglaLabel: 'Landing Pages', icon: Layers },
        { id: 'gtm_pixel' as AdminTab, label: 'GTM / FB Pixel', banglaLabel: 'GTM / FB Pixel', icon: Code },
        { id: 'product_feed' as AdminTab, label: 'Product Feed', banglaLabel: 'Product Feed', icon: FileText },
      ],
    },
    {
      id: 'customer_service',
      number: '৫',
      title: 'CUSTOMER SERVICE',
      banglaTitle: 'কাস্টমার সার্ভিস',
      icon: Users,
      badge: unreadNotifications,
      items: [
        { id: 'customer_messages' as AdminTab, label: 'Customer Messages', banglaLabel: 'Customer Messages', icon: MessageSquare },
        { id: 'notifications' as AdminTab, label: 'Notifications', banglaLabel: 'Notifications', icon: Bell, badge: unreadNotifications },
        { id: 'ai_assistant' as AdminTab, label: 'AI Assistant', banglaLabel: 'AI Assistant', icon: Bot },
      ],
    },
    {
      id: 'content',
      number: '৬',
      title: 'CONTENT',
      banglaTitle: 'কনটেন্ট',
      icon: Compass,
      items: [
        { id: 'banners' as AdminTab, label: 'Banners', banglaLabel: 'Banners', icon: Image },
        { id: 'menus' as AdminTab, label: 'Menus', banglaLabel: 'Menus', icon: Compass },
        { id: 'offers' as AdminTab, label: 'Offers', banglaLabel: 'Offers', icon: Tag },
        { id: 'cms_pages' as AdminTab, label: 'CMS Pages', banglaLabel: 'CMS Pages', icon: FileText },
        { id: 'order_guides' as AdminTab, label: 'Order Guides', banglaLabel: 'Order Guides', icon: BookOpen },
        { id: 'videos' as AdminTab, label: 'Videos', banglaLabel: 'Videos', icon: Sparkles },
        { id: 'brand_stories' as AdminTab, label: 'Brand Stories', banglaLabel: 'ব্র্যান্ড স্টোরিজ', icon: Award },
        { id: 'homepage_sections' as AdminTab, label: 'Homepage Sections', banglaLabel: 'Homepage Sections', icon: Layers },
      ],
    },
    {
      id: 'analytics',
      number: '৭',
      title: 'ANALYTICS',
      banglaTitle: 'অ্যানালিটিক্স',
      icon: BarChart3,
      items: [
        { id: 'analytics_sales' as AdminTab, label: 'Sales Analytics', banglaLabel: 'Sales Analytics', icon: BarChart3 },
        { id: 'analytics_products' as AdminTab, label: 'Product Analytics', banglaLabel: 'Product Analytics', icon: Package },
        { id: 'analytics_customers' as AdminTab, label: 'Customer Analytics', banglaLabel: 'Customer Analytics', icon: Users },
        { id: 'analytics_marketing' as AdminTab, label: 'Marketing Analytics', banglaLabel: 'Marketing Analytics', icon: Flame },
        { id: 'analytics_inventory' as AdminTab, label: 'Inventory Analytics', banglaLabel: 'Inventory Analytics', icon: Boxes },
      ],
    },
    {
      id: 'settings',
      number: '৮',
      title: 'SETTINGS & SECURITY',
      banglaTitle: 'সেটিংস ও সিকিউরিটি',
      icon: Settings,
      items: [
        { id: 'store_settings' as AdminTab, label: 'Store Settings', banglaLabel: 'Store Settings', icon: Sliders },
        { id: 'payment_settings' as AdminTab, label: 'Payment Settings', banglaLabel: 'Payment Settings', icon: CreditCard },
        { id: 'courier_settings' as AdminTab, label: 'Courier Settings', banglaLabel: 'Courier Settings', icon: Truck },
        { id: 'admin_users' as AdminTab, label: 'Admin Users', banglaLabel: 'Admin Users', icon: Users },
        { id: 'roles_permissions' as AdminTab, label: 'Roles & Permissions', banglaLabel: 'Roles & Permissions', icon: ShieldCheck },
        { id: 'ai_settings' as AdminTab, label: 'AI Settings', banglaLabel: 'AI Settings', icon: Bot },
        { id: 'integrations' as AdminTab, label: 'Integrations', banglaLabel: 'Integrations', icon: Code },
        { id: 'audit_logs' as AdminTab, label: 'Audit Logs', banglaLabel: 'Audit Logs', icon: FileText },
        { id: 'backup_database' as AdminTab, label: 'Backup & Database', banglaLabel: 'Backup & Database', icon: Boxes },
        { id: 'system_settings' as AdminTab, label: 'System Settings', banglaLabel: 'System Settings', icon: Settings },
      ],
    },
  ];

  // Filter sections and items based on logged in admin permissions (BUG 12)
  const navSections = rawNavSections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => isTabPermitted(item.id)),
    }))
    .filter((sec) => sec.items.length > 0);

  const getPageTitle = () => {
    if (activeTab === 'dashboard') return 'ড্যাশবোর্ড ও ওভারভিউ';
    for (const sec of navSections) {
      const match = sec.items.find((i) => i.id === activeTab);
      if (match) return `${match.banglaLabel} (${sec.title})`;
    }
    return 'এডমিন কন্ট্রোল প্যানেল';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col md:flex-row text-stone-900 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-stone-900 text-white px-4 py-3 rounded-lg shadow-2xl border border-stone-700 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Left Sidebar (Section 75.1) */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 w-72 bg-white text-stone-900 flex flex-col shrink-0 border-r border-stone-200 transition-transform duration-200 h-screen ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-800 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              ব
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-xs tracking-tight">বস্ত্র শৈলী এডমিন</h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-semibold">
                PRODUCTION ADMIN
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-stone-500 hover:text-stone-800 p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Storefront Return Quick Button */}
        <div className="p-3">
          <button
            onClick={navigateToHome}
            className="w-full py-2 px-3 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-800 border border-stone-200 font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Store className="w-3.5 h-3.5 text-amber-700" />
            <span>লাইভ ওয়েবসাইট দেখুন</span>
          </button>
        </div>

        {/* Navigation items - 8 Collapsible Main Sections */}
        <nav className="flex-1 px-3 py-1 space-y-1.5 overflow-y-auto">
          {/* 🏠 DASHBOARD (Direct Link at Top) */}
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setExpandedSection(null);
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-amber-800 text-white shadow-sm shadow-amber-800/20'
                : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-amber-200' : 'text-stone-500'}`} />
              <span>ড্যাশবোর্ড (Dashboard)</span>
            </div>
          </button>

          {/* 8 Expandable Sections */}
          {navSections.map((sec) => {
            const isExpanded = expandedSection === sec.id;
            const hasActiveChild = sec.items.some((it) => it.id === activeTab);
            const SecIcon = sec.icon;

            return (
              <div key={sec.id} className="rounded-xl overflow-hidden border border-stone-100/80 bg-stone-50/40">
                {/* Main Section Header */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSection((prev) => (prev === sec.id ? null : sec.id));
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-all cursor-pointer select-none ${
                    hasActiveChild && !isExpanded
                      ? 'bg-amber-100/70 text-amber-950 border-l-3 border-amber-800'
                      : 'text-stone-800 hover:bg-stone-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <SecIcon className={`w-4 h-4 shrink-0 ${hasActiveChild ? 'text-amber-800' : 'text-stone-500'}`} />
                    <span className="truncate">
                      <span className="font-mono text-amber-800 mr-1 text-[11px]">{sec.number}.</span>
                      {sec.banglaTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {sec.badge !== undefined && sec.badge > 0 && !isExpanded && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-800 text-white font-mono">
                        {sec.badge}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-amber-800' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Sub-items (Visible when expanded) */}
                {isExpanded && (
                  <div className="pl-3 pr-1.5 py-1 space-y-0.5 bg-white/70 border-t border-stone-100">
                    {sec.items.map((item: any) => {
                      const ItemIcon = item.icon;
                      const isActive = activeTab === item.id;
                      const isSub = Boolean(item.isSubChild);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            isSub ? 'ml-3 w-[calc(100%-0.75rem)] border-l-2 border-amber-300/80 pl-2 text-[11px]' : ''
                          } ${
                            isActive
                              ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200/80 shadow-2xs'
                              : 'text-stone-600 hover:bg-stone-100/70 hover:text-stone-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isSub ? (
                              <span className="text-amber-600 font-mono text-[10px]">↳</span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />
                            )}
                            <ItemIcon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-800' : 'text-stone-400'}`} />
                            <span className="truncate">{item.banglaLabel}</span>
                          </div>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono ${
                                isActive ? 'bg-amber-800 text-white' : 'bg-stone-200 text-stone-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer info (Dynamic Admin Identity - BUG 13) */}
        <div className="p-3 border-t border-stone-200 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt={adminName} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center font-bold text-xs text-stone-700">
                {adminInitial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-stone-800 truncate">{adminName}</p>
              <p className="text-[10px] text-emerald-700 font-medium">● {adminRoleDisplay}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Section 75.1 TOP ADMIN HEADER) */}
        <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-stone-400 font-medium">
                <span>এডমিন</span>
                <span>/</span>
                <span className="text-stone-700 font-semibold">{getPageTitle()}</span>
              </div>
              <h1 className="text-base font-bold text-stone-900 tracking-tight">{getPageTitle()}</h1>
            </div>
          </div>

          {/* Quick Actions (Section 75.1) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={navigateToHome}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>ওয়েবসাইট</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>অর্ডারস</span>
              {pendingOrdersCount > 0 && (
                <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {pendingOrdersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>ইনভেন্টরি</span>
              {lowStockCount > 0 && (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('complaints')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'complaints'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <MessageSquareWarning className="w-3.5 h-3.5" />
              <span>অভিযোগ</span>
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'tasks'
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>টাস্ক</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors cursor-pointer"
              title="নোটিফিকেশন ও মেসেজ"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-600 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* Profile Menu Dropdown (Dynamic Admin Identity - BUG 13) */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
              >
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt={adminName} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center font-bold text-xs">
                    {adminInitial}
                  </div>
                )}
                <span className="text-xs font-semibold text-stone-800 hidden sm:inline">{adminName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1 text-xs z-50">
                  <div className="px-4 py-2 border-b border-stone-100">
                    <p className="font-bold text-stone-900 truncate">{adminName}</p>
                    <p className="text-[11px] text-stone-400 truncate">{adminEmail}</p>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      {adminRoleDisplay}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('system_settings');
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-stone-50 text-stone-700 cursor-pointer"
                  >
                    আমার প্রোফাইল ও ভূমিকা
                  </button>
                  <button
                    onClick={() => {
                      setIsChangePasswordModalOpen(true);
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-900 font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>পাসওয়ার্ড পরিবর্তন করুন</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('system_settings');
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-stone-50 text-stone-700 cursor-pointer"
                  >
                    অডিট লগ ও লগইন হিস্ট্রি
                  </button>
                  <div className="border-t border-stone-100 my-1" />
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      adminLogout();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>লগ আউট</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Security Warning Banner for Default/Temporary Password */}
        {requireAdminPasswordChange && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-950 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>নিরাপত্তা সতর্কবার্তা:</strong> আপনি ডিফল্ট/অস্থায়ী পাসওয়ার্ড দিয়ে লগইন করেছেন। প্রোডাকশন সুরক্ষার জন্য অবিলম্বে নতুন পাসওয়ার্ড সেট করুন।
              </span>
            </div>
            <button
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              পাসওয়ার্ড পরিবর্তন করুন
            </button>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Password Change Modal */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="bg-stone-900 text-white p-6 relative">
              <button
                onClick={() => {
                  if (!requireAdminPasswordChange) {
                    setIsChangePasswordModalOpen(false);
                    setShowOldPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }
                }}
                className={`absolute top-5 right-5 p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer ${
                  requireAdminPasswordChange ? 'hidden' : ''
                }`}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">এডমিন পাসওয়ার্ড পরিবর্তন</h3>
                  <p className="text-xs text-stone-400">নিরাপদ ও শক্তিশালী পাসওয়ার্ড সেট করুন</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
              {requireAdminPasswordChange && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>সিস্টেম সুরক্ষার জন্য ডিফল্ট পাসওয়ার্ড পরিবর্তন করা বাধ্যতামূলক।</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  বর্তমান পাসওয়ার্ড (Current Password)
                </label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="বর্তমান পাসওয়ার্ড লিখুন"
                    required
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    title={showOldPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  নতুন পাসওয়ার্ড (New Password)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড"
                    required
                    minLength={6}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    title={showNewPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  নতুন পাসওয়ার্ড নিশ্চিত করুন (Confirm Password)
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পুনরায় নতুন পাসওয়ার্ড লিখুন"
                    required
                    minLength={6}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    title={showConfirmPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                {!requireAdminPasswordChange && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangePasswordModalOpen(false);
                      setShowOldPassword(false);
                      setShowNewPassword(false);
                      setShowConfirmPassword(false);
                    }}
                    className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                  >
                    বাতিল
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {isSubmittingPassword ? 'সংরক্ষণ হচ্ছে...' : 'পাসওয়ার্ড আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
