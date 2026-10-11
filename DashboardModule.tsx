import React from 'react';
import { useShop } from '../../context/ShopContext';
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  AlertTriangle,
  Users,
  Tag,
  Flame,
  ArrowUpRight,
  Eye,
  FileText,
  DollarSign,
  MapPin,
} from 'lucide-react';

interface DashboardModuleProps {
  onNavigateToOrders: () => void;
  onNavigateToProducts: () => void;
  onNavigateToInventory: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  onNavigateToOrders,
  onNavigateToProducts,
  onNavigateToInventory,
}) => {
  const { orders, products, customers, coupons, offerConfig, openInvoiceModal } = useShop();

  // Metric calculations
  const totalOrders = orders.length;
  const totalSales = orders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  // Today's orders & sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter((o) => {
    const d = o?.orderDate || (o as any)?.order_date || '';
    return typeof d === 'string' && (d.startsWith(todayStr) || d.includes(todayStr));
  });
  const todaySales = todayOrders
    .filter((o) => o.orderStatus !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const pendingOrders = orders.filter((o) => (o.orderStatus || (o as any).order_status) === 'pending');
  const processingOrders = orders.filter(
    (o) => {
      const st = o.orderStatus || (o as any).order_status;
      return st === 'processing' || st === 'confirmed';
    }
  );
  const deliveredOrders = orders.filter((o) => (o.orderStatus || (o as any).order_status) === 'delivered');
  const cancelledOrders = orders.filter((o) => (o.orderStatus || (o as any).order_status) === 'cancelled');

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
  const outOfStockProducts = products.filter((p) => p.stock <= 0);

  const totalCustomers = customers.length;
  const activeCoupons = coupons.filter((c) => c.status === 'active').length;

  // Recent 5 orders
  const recentOrders = [...orders]
    .sort((a, b) => {
      const timeB = new Date(b?.orderDate || (b as any)?.order_date || 0).getTime();
      const timeA = new Date(a?.orderDate || (a as any)?.order_date || 0).getTime();
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    })
    .slice(0, 5);

  // Recent 4 customers
  const recentCustomers = [...customers].slice(0, 4);

  // Analytics by District
  const districtCounts: Record<string, number> = {};
  orders.forEach((o) => {
    districtCounts[o.district] = (districtCounts[o.district] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* 1. Metric Stats Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-5 rounded-lg border border-[#EAEAEA] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#A1A1A1] uppercase tracking-[0.2em]">আজকের সেলস</span>
            <div className="w-7 h-7 rounded-md bg-[#F5F5F5] text-[#1A1A1A] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-semibold text-[#1A1A1A]">৳{todaySales.toLocaleString()}</h3>
            <p className="text-[11px] text-[#717171] mt-0.5">
              আজকের অর্ডার: <strong className="text-[#1A1A1A] font-medium">{todayOrders.length} টি</strong>
            </p>
          </div>
        </div>

        {/* Total Sales */}
        <div className="bg-white p-5 rounded-lg border border-[#EAEAEA] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#A1A1A1] uppercase tracking-[0.2em]">সর্বমোট সেলস</span>
            <div className="w-7 h-7 rounded-md bg-[#F5F5F5] text-[#1A1A1A] flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-semibold text-[#1A1A1A]">৳{totalSales.toLocaleString()}</h3>
            <p className="text-[11px] text-[#717171] mt-0.5">
              মোট কার্যকর অর্ডার: <strong className="text-[#1A1A1A] font-medium">{totalOrders} টি</strong>
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div
          onClick={onNavigateToOrders}
          className="bg-white p-5 rounded-lg border border-[#EAEAEA] flex flex-col justify-between cursor-pointer hover:border-[#1A1A1A] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#A1A1A1] uppercase tracking-[0.2em]">পেন্ডিং অর্ডার</span>
            <div className="w-7 h-7 rounded-md bg-[#F5F5F5] text-[#1A1A1A] flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-semibold text-[#1A1A1A]">{pendingOrders.length}</h3>
            <p className="text-[11px] text-[#717171] mt-0.5">কনফার্মেশনের অপেক্ষায়</p>
          </div>
        </div>

        {/* Low & Out of Stock */}
        <div
          onClick={onNavigateToInventory}
          className="bg-white p-5 rounded-lg border border-[#EAEAEA] flex flex-col justify-between cursor-pointer hover:border-[#1A1A1A] transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-[#A1A1A1] uppercase tracking-[0.2em]">স্টক সতর্কতা</span>
            <div className="w-7 h-7 rounded-md bg-[#F5F5F5] text-[#1A1A1A] flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-semibold text-rose-600">{lowStockProducts.length}</span>
              <p className="text-[11px] text-[#717171]">লো স্টক</p>
            </div>
            <div className="text-right">
              <span className="text-lg font-semibold text-[#1A1A1A]">{outOfStockProducts.length}</span>
              <p className="text-[11px] text-[#717171]">স্টক আউট</p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">প্রসেসিং</p>
          <p className="text-base font-semibold text-[#1A1A1A] mt-1">{processingOrders.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">ডেলিভার্ড</p>
          <p className="text-base font-semibold text-emerald-600 mt-1">{deliveredOrders.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">বাতিলকৃত</p>
          <p className="text-base font-semibold text-[#A1A1A1] mt-1">{cancelledOrders.length}</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">মোট প্রোডাক্ট</p>
          <p className="text-base font-semibold text-[#1A1A1A] mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">মোট কাস্টমার</p>
          <p className="text-base font-semibold text-[#1A1A1A] mt-1">{totalCustomers}</p>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-[#EAEAEA] text-center">
          <p className="text-[10px] text-[#A1A1A1] uppercase tracking-wider font-semibold">কুপন / অফার</p>
          <p className="text-base font-semibold text-[#1A1A1A] mt-1">
            {activeCoupons} / {offerConfig.isActive ? '১' : '০'}
          </p>
        </div>
      </div>

      {/* Recent Orders Table & Recent Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Orders (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-[#EAEAEA] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-3">
            <div>
              <h3 className="font-medium text-[#1A1A1A] text-sm">সাম্প্রতিক অর্ডারসমূহ (Recent Orders)</h3>
              <p className="text-xs text-[#717171] font-light">সর্বশেষ ৫টি অর্ডারের তথ্য</p>
            </div>
            <button
              onClick={onNavigateToOrders}
              className="text-xs text-[#1A1A1A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>সকল অর্ডার</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F5F5F5] text-[#717171] uppercase text-[10px] tracking-wider border-b border-[#EAEAEA]">
                  <th className="p-2.5">অর্ডার আইডি</th>
                  <th className="p-2.5">গ্রাহক</th>
                  <th className="p-2.5">তারিখ</th>
                  <th className="p-2.5">মূল্য</th>
                  <th className="p-2.5">পেমেন্ট</th>
                  <th className="p-2.5">স্ট্যাটাস</th>
                  <th className="p-2.5 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[#FBFBFB] transition-colors">
                    <td className="p-2.5 font-mono font-medium text-[#1A1A1A]">#{order.id}</td>
                    <td className="p-2.5">
                      <p className="font-medium text-[#1A1A1A]">{order.customerName}</p>
                      <p className="text-[11px] text-[#A1A1A1]">{order.customerPhone}</p>
                    </td>
                    <td className="p-2.5 text-[#717171]">
                      {((order.orderDate || (order as any).order_date || '').split(' ')[0]) || '—'}
                    </td>
                    <td className="p-2.5 font-semibold text-[#1A1A1A]">৳{order.total}</td>
                    <td className="p-2.5">
                      <span className="uppercase text-[10px] text-[#717171]">
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${
                          order.orderStatus === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : order.orderStatus === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : order.orderStatus === 'processing'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-[#F5F5F5] text-[#1A1A1A] border border-[#EAEAEA]'
                        }`}
                      >
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        onClick={() => openInvoiceModal(order)}
                        className="p-1 hover:bg-[#F5F5F5] text-[#717171] rounded hover:text-[#1A1A1A] transition-colors cursor-pointer"
                        title="Print / View Invoice"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recent Customers & District Sales (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Customers */}
          <div className="bg-white rounded-lg border border-[#EAEAEA] p-5 space-y-4">
            <h3 className="font-medium text-[#1A1A1A] text-sm">নতুন কাস্টমার (Recent Customers)</h3>
            <div className="space-y-3">
              {recentCustomers.map((cust) => (
                <div key={cust.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white font-medium flex items-center justify-center text-[11px]">
                      {cust.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{cust.name}</p>
                      <p className="text-[11px] text-[#A1A1A1]">{cust.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#1A1A1A]">৳{cust.totalSpent}</p>
                    <p className="text-[10px] text-[#A1A1A1]">{cust.totalOrders} টি অর্ডার</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* District Distribution (25. Analytics) */}
          <div className="bg-white rounded-lg border border-[#EAEAEA] p-5 space-y-3">
            <h3 className="font-medium text-[#1A1A1A] text-sm flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1A1A1A]" />
              <span>জেলা ভিত্তিক বিশ্লেষণ</span>
            </h3>
            <div className="space-y-2.5 text-xs">
              {Object.entries(districtCounts).map(([dist, count]) => {
                const percentage = Math.round((count / (orders.length || 1)) * 100);
                return (
                  <div key={dist} className="space-y-1">
                    <div className="flex justify-between text-[#717171]">
                      <span>{dist}</span>
                      <span className="font-medium text-[#1A1A1A]">
                        {count} টি ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#F5F5F5] h-1 rounded-full overflow-hidden">
                      <div className="bg-[#1A1A1A] h-full rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
