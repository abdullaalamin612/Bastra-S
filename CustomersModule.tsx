import React, { useState } from 'react';
import { useShop } from '../../context/ShopContext';
import { Customer } from '../../types';
import {
  Users,
  Search,
  Download,
  Phone,
  Mail,
  ShoppingBasket,
  DollarSign,
  Ban,
  CheckCircle,
  Clock,
  MapPin,
  MessageSquare,
} from 'lucide-react';

export const CustomersModule: React.FC = () => {
  const { customers = [], orders = [], updateCustomer, showToast } = useShop();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerNoteInput, setCustomerNoteInput] = useState('');

  const safeCustomers = Array.isArray(customers) ? customers : [];

  const filteredCustomers = safeCustomers.filter(
    (c) =>
      (c?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c?.phone || '').includes(searchQuery) ||
      (c?.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleToggleBlock = (cust: Customer) => {
    const newStatus = cust.status === 'blocked' ? 'active' : 'blocked';
    updateCustomer({ ...cust, status: newStatus });
    if (selectedCustomer && selectedCustomer.id === cust.id) {
      setSelectedCustomer({ ...selectedCustomer, status: newStatus });
    }
    showToast(`কাস্টমার স্ট্যাটাস পরিবর্তন করা হয়েছে: ${newStatus}`);
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const updatedNotes = selectedCustomer.notes
      ? `${selectedCustomer.notes}\n• ${customerNoteInput.trim()}`
      : `• ${customerNoteInput.trim()}`;
    updateCustomer({ ...selectedCustomer, notes: updatedNotes });
    setSelectedCustomer({ ...selectedCustomer, notes: updatedNotes });
    setCustomerNoteInput('');
    showToast('কাস্টমার নোট সংরক্ষণ করা হয়েছে।');
  };

  const handleExportCSV = () => {
    const headers = 'ID,Name,Phone,Email,Total Orders,Total Spent,Status,Last Order\n';
    const rows = filteredCustomers
      .map(
        (c) =>
          `"${c.id || ''}","${c.name || ''}","${c.phone || ''}","${c.email || ''}",${c.totalOrders || 0},${c.totalSpent || 0},"${c.status || 'active'}","${c.lastOrderDate || c.registrationDate || ''}"`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bastra_shoily_customers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('কাস্টমার ডাটা ডাউনলোড সম্পন্ন হয়েছে।');
  };

  // Orders for selected customer
  const customerOrders = selectedCustomer
    ? (Array.isArray(orders) ? orders : []).filter(
        (o) =>
          (selectedCustomer.phone && o.customerPhone === selectedCustomer.phone) ||
          (selectedCustomer.name && o.customerName === selectedCustomer.name)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-stone-900">
            গ্রাহক তালিকা ও বিবরণ (Customer Directory & CRM)
          </h2>
          <p className="text-xs text-stone-500">
            মোট ক্রয় হিসাব, অর্ডার ইতিহাস, ইন্টারনাল নোট ও ব্লক/আনব্লক সুবিধা
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>কাস্টমার এক্সপোর্ট (CSV)</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="গ্রাহকের নাম, মোবাইল নম্বর বা ইমেইল দিয়ে খুঁজুন..."
          className="w-full bg-white border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600"
        />
        <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Table List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-bold uppercase border-b border-stone-200">
                  <th className="p-3">গ্রাহক</th>
                  <th className="p-3">মোবাইল ও ইমেইল</th>
                  <th className="p-3">মোট অর্ডার</th>
                  <th className="p-3">মোট ক্রয় (Spent)</th>
                  <th className="p-3">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-400">
                      কোনো গ্রাহক পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((cust) => {
                    const isSelected = selectedCustomer?.id === cust.id;
                    const isBlocked = cust.status === 'blocked';
                    return (
                      <tr
                        key={cust.id}
                        onClick={() => setSelectedCustomer(cust)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-50/80 font-medium' : 'hover:bg-stone-50'
                        }`}
                      >
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                            {(cust?.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-stone-900">{cust?.name || 'নামবিহীন গ্রাহক'}</p>
                            <p className="text-[10px] text-stone-400">
                              যুক্ত: {String(cust?.joinedDate || cust?.registrationDate || 'সম্প্রতি').split(' ')[0]}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="p-3">
                        <p className="font-mono text-stone-800">{cust?.phone || '-'}</p>
                        {cust?.email && <p className="text-[10px] text-stone-500">{cust.email}</p>}
                      </td>

                      <td className="p-3 font-bold text-stone-900">{cust?.totalOrders || 0} টি</td>

                      <td className="p-3 font-black text-amber-900">৳{cust?.totalSpent || 0}</td>

                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isBlocked ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {cust?.status || 'active'}
                        </span>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customer Detail Inspector (lg:col-span-5) */}
        <div className="lg:col-span-5">
          {selectedCustomer ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-5 sticky top-24">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-stone-900 text-amber-400 font-black text-sm flex items-center justify-center">
                    {(selectedCustomer?.name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-sm">{selectedCustomer?.name || 'গ্রাহক'}</h3>
                    <p className="text-xs text-stone-500">{selectedCustomer?.phone || ''}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleBlock(selectedCustomer)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    selectedCustomer.status === 'blocked'
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{selectedCustomer.status === 'blocked' ? 'Unblock' : 'Block User'}</span>
                </button>
              </div>

              {/* Stats overview */}
              <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">মোট অর্ডার</span>
                  <span className="font-black text-stone-900 text-base">
                    {selectedCustomer.totalOrders} টি
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">মোট কেনাকাটা</span>
                  <span className="font-black text-amber-900 text-base">
                    ৳{selectedCustomer.totalSpent}
                  </span>
                </div>
              </div>

              {/* Customer Order History */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase">
                  অর্ডার ইতিহাস ({customerOrders.length})
                </span>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {customerOrders.length > 0 ? (
                    customerOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 text-xs flex justify-between items-center"
                      >
                        <div>
                          <span className="font-mono font-bold text-stone-900">#{ord.id}</span>
                          <span className="text-[10px] text-stone-400 block">{ord.orderDate || (ord as any).order_date || ''}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-stone-900">৳{ord.total}</span>
                          <span className="text-[10px] block uppercase text-amber-700 font-semibold">
                            {ord.orderStatus}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400">কোনো পূর্ববর্তী অর্ডার পাওয়া যায়নি।</p>
                  )}
                </div>
              </div>

              {/* Customer Internal CRM Notes */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>ইন্টারনাল কাস্টমার নোট</span>
                </span>
                {selectedCustomer.notes && (
                  <div className="p-2.5 bg-amber-50 rounded-xl text-xs text-stone-700 border border-amber-200 whitespace-pre-line">
                    {selectedCustomer.notes}
                  </div>
                )}
                <form onSubmit={handleSaveNote} className="flex gap-2">
                  <input
                    type="text"
                    value={customerNoteInput || ''}
                    onChange={(e) => setCustomerNoteInput(e.target.value)}
                    placeholder="নোট লিখুন (যেমন: নিয়মিত প্রিমিয়াম ক্রেতা)..."
                    className="flex-1 bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold"
                  >
                    যোগ
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-400">
              <Users className="w-8 h-8 mx-auto text-stone-300 mb-2" />
              <p className="text-xs font-bold text-stone-600">বিস্তারিত দেখতে যেকোনো কাস্টমার নির্বাচন করুন</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
