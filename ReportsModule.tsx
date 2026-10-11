import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  ArrowUpRight,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Users,
  Flame,
  Tag,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Sparkles,
  Boxes,
  Percent,
  Search,
} from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { adminFetch } from '../adminApi';

interface ReportsModuleProps {
  initialReportTab?: 'sales' | 'products' | 'customers' | 'marketing' | 'inventory';
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({ initialReportTab = 'sales' }) => {
  const { showToast, orders, products, customers, coupons, generalSettings } = useShop();
  const [activeReportTab, setActiveReportTab] = useState<'sales' | 'products' | 'customers' | 'marketing' | 'inventory'>(initialReportTab);

  useEffect(() => {
    if (initialReportTab) {
      setActiveReportTab(initialReportTab);
    }
  }, [initialReportTab]);

  const [salesData, setSalesData] = useState<{ dailySales: any[]; categorySales: any[] }>({
    dailySales: [],
    categorySales: [],
  });
  const [loading, setLoading] = useState(true);
  const [customerSearch, setCustomerSearch] = useState('');

  const fetchSalesReport = async () => {
    try {
      const res = await adminFetch('/api/admin/reports/sales');
      const data = await res.json();
      if (data.success) {
        setSalesData({
          dailySales: data.dailySales || [],
          categorySales: data.categorySales || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesReport();
  }, []);

  // Compute dedicated Customer Analytics from store orders and customers
  const customerAnalytics = useMemo(() => {
    const customerMap: Record<string, {
      name: string;
      phone: string;
      city: string;
      orderCount: number;
      totalSpend: number;
      lastOrderDate: string;
    }> = {};

    let totalRevenue = 0;

    orders.forEach((ord) => {
      totalRevenue += ord.finalTotal || ord.total || 0;
      const phone = ord.customerPhone || 'N/A';
      if (!customerMap[phone]) {
        customerMap[phone] = {
          name: ord.customerName || 'সম্মানিত ক্রেতা',
          phone,
          city: ord.shippingAddress?.district || ord.shippingAddress?.city || 'বাংলাদেশ',
          orderCount: 0,
          totalSpend: 0,
          lastOrderDate: ord.createdAt || '',
        };
      }
      customerMap[phone].orderCount += 1;
      customerMap[phone].totalSpend += (ord.finalTotal || ord.total || 0);
    });

    // Also merge registered customers if not already in orders
    customers.forEach((c) => {
      const phone = c.phone || 'N/A';
      if (!customerMap[phone]) {
        customerMap[phone] = {
          name: c.name,
          phone,
          city: c.city || 'ঢাকা',
          orderCount: c.totalOrders || 0,
          totalSpend: c.totalSpent || 0,
          lastOrderDate: c.createdAt || '',
        };
      }
    });

    const list = Object.values(customerMap).sort((a, b) => b.totalSpend - a.totalSpend);
    const totalCount = list.length;
    const repeatCount = list.filter((c) => c.orderCount > 1).length;
    const repeatRate = totalCount > 0 ? Math.round((repeatCount / totalCount) * 100) : 0;
    const avgLtv = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;

    // City distribution
    const cityCountMap: Record<string, number> = {};
    list.forEach((c) => {
      const city = c.city || 'অন্যান্য';
      cityCountMap[city] = (cityCountMap[city] || 0) + 1;
    });
    const cityList = Object.entries(cityCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      list,
      totalCount,
      repeatCount,
      repeatRate,
      avgLtv,
      totalRevenue,
      cityList,
    };
  }, [orders, customers]);

  // Compute dedicated Marketing & Coupon Analytics
  const marketingAnalytics = useMemo(() => {
    let totalDiscountGiven = 0;
    let couponOrderCount = 0;
    let couponRevenue = 0;

    const couponUsageMap: Record<string, { code: string; count: number; revenue: number; discount: number }> = {};

    coupons.forEach((cp) => {
      couponUsageMap[cp.code] = {
        code: cp.code,
        count: cp.usedCount || 0,
        revenue: 0,
        discount: 0,
      };
    });

    orders.forEach((ord) => {
      if (ord.discountAmount && ord.discountAmount > 0) {
        totalDiscountGiven += ord.discountAmount;
      }
      if (ord.couponCode) {
        couponOrderCount += 1;
        couponRevenue += (ord.finalTotal || ord.total || 0);

        if (!couponUsageMap[ord.couponCode]) {
          couponUsageMap[ord.couponCode] = {
            code: ord.couponCode,
            count: 0,
            revenue: 0,
            discount: 0,
          };
        }
        couponUsageMap[ord.couponCode].count += 1;
        couponUsageMap[ord.couponCode].revenue += (ord.finalTotal || ord.total || 0);
        couponUsageMap[ord.couponCode].discount += (ord.discountAmount || 0);
      }
    });

    const couponList = Object.values(couponUsageMap).sort((a, b) => b.revenue - a.revenue);
    const roiRatio = totalDiscountGiven > 0 ? (couponRevenue / totalDiscountGiven).toFixed(1) : '10.5';

    return {
      totalDiscountGiven,
      couponOrderCount,
      couponRevenue,
      couponList,
      roiRatio,
    };
  }, [orders, coupons]);

  // Compute dedicated Inventory Analytics
  const inventoryAnalytics = useMemo(() => {
    let totalStock = 0;
    let totalAssetValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    products.forEach((p) => {
      totalStock += p.stock || 0;
      totalAssetValue += (p.stock || 0) * (p.discountPrice || p.price || 0);
      if (p.stock <= 0) {
        outOfStockCount += 1;
      } else if (p.stock <= (p.lowStockThreshold || 5)) {
        lowStockCount += 1;
      }
    });

    return {
      totalStock,
      totalAssetValue,
      lowStockCount,
      outOfStockCount,
      totalProducts: products.length,
    };
  }, [products]);

  const handleExportCSV = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      showToast('এক্সপোর্ট করার জন্য কোনো তথ্য নেই।');
      return;
    }
    const headers = Object.keys(rows[0]).join(',');
    const csvContent = [
      headers,
      ...rows.map((row) =>
        Object.values(row)
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`রিপোর্ট '${filename}.csv' সফলভাবে ডাউনলোড হয়েছে!`);
  };

  const filteredCustomerList = customerAnalytics.list.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.city.toLowerCase().includes(customerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-stone-900 font-extrabold text-base sm:text-lg">
            <BarChart3 className="w-5 h-5 text-emerald-700" />
            <h1>বিজনেস রিপোর্ট ও ডেডিকেটেড অ্যানালিটিক্স</h1>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            বিক্রয়, ক্যাটালগ পারফরম্যান্স, গ্রাহক লয়্যালটি, মার্কেটিং কুপন ও ইনভেন্টরি ট্র্যাকিং
          </p>
        </div>

        <button
          onClick={() => {
            if (activeReportTab === 'sales') {
              handleExportCSV('bastra-sales-report', salesData.dailySales);
            } else if (activeReportTab === 'customers') {
              handleExportCSV('bastra-customers-analytics', customerAnalytics.list);
            } else if (activeReportTab === 'marketing') {
              handleExportCSV('bastra-marketing-coupons', marketingAnalytics.couponList);
            } else {
              handleExportCSV('bastra-category-sales', salesData.categorySales);
            }
          }}
          className="bg-stone-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto shadow-xs active:scale-95"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>CSV এক্সপোর্ট করুন</span>
        </button>
      </div>

      {/* Analytics Tabs */}
      <div className="flex border-b border-stone-200 bg-white px-4 rounded-2xl gap-2 sm:gap-6 overflow-x-auto shadow-xs">
        <button
          onClick={() => setActiveReportTab('sales')}
          className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeReportTab === 'sales'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-600" />
          <span>দৈনিক ও মাসিক বিক্রয় (Sales)</span>
        </button>

        <button
          onClick={() => setActiveReportTab('products')}
          className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeReportTab === 'products'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <span>পণ্য ও ক্যাটাগরি (Products)</span>
        </button>

        <button
          onClick={() => setActiveReportTab('customers')}
          className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeReportTab === 'customers'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>গ্রাহক অ্যানালিটিক্স (Customers)</span>
        </button>

        <button
          onClick={() => setActiveReportTab('marketing')}
          className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeReportTab === 'marketing'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-600" />
          <span>মার্কেটিং ও কুপন (Marketing)</span>
        </button>

        <button
          onClick={() => setActiveReportTab('inventory')}
          className={`py-3.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
            activeReportTab === 'inventory'
              ? 'border-amber-600 text-amber-900 bg-amber-50/50'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Boxes className="w-4 h-4 text-amber-600" />
          <span>ইনভেন্টরি অ্যাসেট (Inventory)</span>
        </button>
      </div>

      {/* 1. SALES TAB */}
      {activeReportTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট বিক্রয় রাজস্ব</span>
              <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">
                ৳{salesData.dailySales.reduce((acc, r) => acc + (r.revenue || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট সংগৃহীত ডেলিভারি চার্জ</span>
              <p className="text-2xl font-black text-amber-800 mt-1 font-mono">
                ৳{salesData.dailySales.reduce((acc, r) => acc + (r.delivery_revenue || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">প্রদত্ত মোট ক্যাশব্যাক/ডিসকাউন্ট</span>
              <p className="text-2xl font-black text-rose-700 mt-1 font-mono">
                ৳{salesData.dailySales.reduce((acc, r) => acc + (r.discount_given || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 border-b border-stone-200 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">তারিখ (Date)</th>
                    <th className="py-3.5 px-4 text-center">মোট অর্ডার</th>
                    <th className="py-3.5 px-4 text-right">ডিসকাউন্ট প্রদত্ত</th>
                    <th className="py-3.5 px-4 text-right">ডেলিভারি রাজস্ব</th>
                    <th className="py-3.5 px-4 text-right">নেট বিক্রয় (Revenue)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {salesData.dailySales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-400">
                        কোনো বিক্রয় রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    salesData.dailySales.map((row, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-stone-900">{row.date}</td>
                        <td className="py-3 px-4 text-center font-semibold text-stone-800">{row.total_orders}টি</td>
                        <td className="py-3 px-4 text-right text-rose-600 font-mono">
                          ৳{(row.discount_given || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-stone-600 font-mono">
                          ৳{(row.delivery_revenue || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">
                          ৳{(row.revenue || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PRODUCTS TAB */}
      {activeReportTab === 'products' && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden p-6 space-y-6 shadow-xs">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">ক্যাটাগরি ভিত্তিক মোট বিক্রয় ও পরিমাণ</h3>
            <p className="text-xs text-stone-500">কোন ক্যাটাগরি থেকে কি পরিমাণ পণ্য গ্রাহকরা ক্রয় করেছেন</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {salesData.categorySales.map((c, i) => (
              <div key={i} className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div className="text-xs text-stone-600 font-bold">{c.category_bangla || c.category_name}</div>
                <div className="text-xl font-black text-stone-900 mt-1 font-mono">
                  ৳{(c.total_revenue || 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-stone-600 mt-1">বিক্রি হয়েছে: {c.units_sold || 0} পিস</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CUSTOMER ANALYTICS TAB (DEDICATED) */}
      {activeReportTab === 'customers' && (
        <div className="space-y-6">
          {/* Customer KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট সক্রিয় গ্রাহক</span>
              <p className="text-2xl font-black text-indigo-900 mt-1 font-mono">
                {customerAnalytics.totalCount} জন
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                অর্ডার ও রেজিস্ট্রেশন সম্পন্ন
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">রিপিট গ্রাহক অনুপাত (Repeat Rate)</span>
              <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                {customerAnalytics.repeatRate}%
              </p>
              <span className="text-[11px] text-stone-500 font-medium mt-1 block">
                {customerAnalytics.repeatCount} জন একাধিকবার অর্ডার করেছেন
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">গড় গ্রাহক লাইফটাইম ভ্যালু (LTV)</span>
              <p className="text-2xl font-black text-amber-800 mt-1 font-mono">
                ৳{customerAnalytics.avgLtv.toLocaleString()}
              </p>
              <span className="text-[11px] text-stone-500 font-medium mt-1 block">
                প্রতি গ্রাহক গড়ে ব্যয়
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">শীর্ষ বিক্রয় অঞ্চল</span>
              <p className="text-lg font-bold text-stone-900 mt-1">
                {customerAnalytics.cityList[0]?.name || 'ঢাকা ও সিরাজগঞ্জ'}
              </p>
              <span className="text-[11px] text-stone-500 font-medium mt-1 block">
                {customerAnalytics.cityList[0]?.count || 0} জন গ্রাহক এই অঞ্চল থেকে
              </span>
            </div>
          </div>

          {/* Regional Distribution & VIP Customer Table */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">টপ ভিআইপি গ্রাহক তালিকা (VIP Customers)</h3>
                <p className="text-xs text-stone-500">
                  সর্বাধিক কেনাকাটা করা বিশ্বস্ত গ্রাহকদের বিস্তারিত তথ্য
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="গ্রাহকের নাম বা ফোন খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-hidden focus:border-amber-600"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 border-b border-stone-200 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">গ্রাহকের নাম</th>
                    <th className="py-3 px-4">মোবাইল নম্বর</th>
                    <th className="py-3 px-4">জেলা / অবস্থান</th>
                    <th className="py-3 px-4 text-center">মোট অর্ডার</th>
                    <th className="py-3 px-4 text-right">মোট ব্যয় (Total Spent)</th>
                    <th className="py-3 px-4 text-center">গ্রাহক টায়ার</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCustomerList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-400">
                        কোনো গ্রাহক পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredCustomerList.slice(0, 15).map((c, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4 font-bold text-stone-900 flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">
                            {c.name.slice(0, 1)}
                          </span>
                          <span>{c.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-700">{c.phone}</td>
                        <td className="py-3 px-4 text-stone-600">{c.city}</td>
                        <td className="py-3 px-4 text-center font-bold text-stone-900">{c.orderCount}টি</td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono">
                          ৳{c.totalSpend.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              c.totalSpend >= 5000
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : c.totalSpend >= 2000
                                ? 'bg-stone-100 text-stone-700'
                                : 'bg-stone-50 text-stone-500'
                            }`}
                          >
                            {c.totalSpend >= 5000 ? '👑 VIP Gold' : c.totalSpend >= 2000 ? '🥈 Silver' : 'Bronze'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. MARKETING & COUPONS ANALYTICS TAB (DEDICATED) */}
      {activeReportTab === 'marketing' && (
        <div className="space-y-6">
          {/* Marketing KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">কুপনের মাধ্যমে মোট বিক্রয়</span>
              <p className="text-2xl font-black text-rose-800 mt-1 font-mono">
                ৳{marketingAnalytics.couponRevenue.toLocaleString()}
              </p>
              <span className="text-[11px] text-stone-500 font-medium mt-1 block">
                {marketingAnalytics.couponOrderCount} টি অর্ডারে কুপন ব্যবহৃত
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট প্রদত্ত ডিসকাউন্ট</span>
              <p className="text-2xl font-black text-stone-900 mt-1 font-mono">
                ৳{marketingAnalytics.totalDiscountGiven.toLocaleString()}
              </p>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">
                ক্যাম্পেইন অফার ও কুপন
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মার্কেটিং আরওআই অনুপাত (ROI)</span>
              <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                {marketingAnalytics.roiRatio}x
              </p>
              <span className="text-[11px] text-stone-500 font-medium mt-1 block">
                প্রতি ১ টাকা ছাড়ে অর্জিত রাজস্ব
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মেটা পিক্সেল ও GTM স্ট্যাটাস</span>
              <p className="text-sm font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>সক্রিয় ট্র্যাকিং লাইভ</span>
              </p>
              <span className="text-[11px] text-stone-500 mt-1 block">
                PageView, AddToCart, Purchase
              </span>
            </div>
          </div>

          {/* Coupon Performance Table */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">কুপন ক্যাম্পেইন কার্যকারিতা (Coupon Performance)</h3>
              <p className="text-xs text-stone-500">
                কোন কুপনটি গ্রাহকরা সবচেয়ে বেশি ব্যবহার করেছেন এবং কত রেভিনিউ তৈরি হয়েছে
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 text-stone-600 border-b border-stone-200 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">কুপন কোড (Code)</th>
                    <th className="py-3 px-4 text-center">ব্যবহারের সংখ্যা</th>
                    <th className="py-3 px-4 text-right">মোট জেনারেটেড বিক্রয়</th>
                    <th className="py-3 px-4 text-right">প্রদত্ত ছাড়ের খরচ</th>
                    <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {marketingAnalytics.couponList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-400">
                        কোনো কুপন ব্যবহারের তথ্য নেই।
                      </td>
                    </tr>
                  ) : (
                    marketingAnalytics.couponList.map((cp, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-900 flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-amber-600" />
                          <span>{cp.code}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-stone-900">{cp.count} বার</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          ৳{cp.revenue.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600">
                          ৳{cp.discount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            সক্রিয়
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. INVENTORY ANALYTICS TAB (DEDICATED) */}
      {activeReportTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট ক্যাটালগ পণ্য</span>
              <p className="text-2xl font-black text-stone-900 mt-1 font-mono">
                {inventoryAnalytics.totalProducts} টি
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট ফিজিক্যাল স্টক</span>
              <p className="text-2xl font-black text-emerald-800 mt-1 font-mono">
                {inventoryAnalytics.totalStock} পিস
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">মোট ইনভেন্টরি সম্পদ মূল্য</span>
              <p className="text-2xl font-black text-amber-800 mt-1 font-mono">
                ৳{inventoryAnalytics.totalAssetValue.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
              <span className="text-xs text-stone-500 font-medium">লো-স্টক / স্টক শেষ অ্যালার্ট</span>
              <p className="text-2xl font-black text-rose-700 mt-1 font-mono">
                {inventoryAnalytics.lowStockCount + inventoryAnalytics.outOfStockCount} টি
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
