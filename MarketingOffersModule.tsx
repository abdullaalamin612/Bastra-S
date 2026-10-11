import React, { useState, useEffect } from 'react';
import { Flame, Plus, Clock, Tag, Calendar, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { adminFetch } from '../adminApi';

interface TimerOfferItem {
  id: string;
  offer_name: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_time: string;
  end_time: string;
  target_type: 'entire_store' | 'category' | 'product' | 'variant';
  target_ids: string;
  min_order_amount: number;
  status: string;
}

interface MarketingOffersModuleProps {
  initialTab?: 'timer_offers' | 'coupons' | 'campaigns';
}

export const MarketingOffersModule: React.FC<MarketingOffersModuleProps> = ({ initialTab = 'timer_offers' }) => {
  const { showToast } = useShop();
  const [activeTab, setActiveTab] = useState<'timer_offers' | 'coupons'>(
    initialTab === 'coupons' ? 'coupons' : 'timer_offers'
  );

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab === 'coupons' ? 'coupons' : 'timer_offers');
    }
  }, [initialTab]);
  const [timerOffers, setTimerOffers] = useState<TimerOfferItem[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for new Timer Offer
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [newOffer, setNewOffer] = useState({
    offerName: '',
    title: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 15,
    startTime: new Date().toISOString().slice(0, 16),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    targetType: 'entire_store' as 'entire_store' | 'category' | 'product',
    minOrderAmount: 0,
  });

  const fetchMarketingData = async () => {
    try {
      const [resOffers, resCoupons] = await Promise.all([
        adminFetch('/api/admin/timer-offers'),
        adminFetch('/api/admin/coupons'),
      ]);
      const dataOffers = await resOffers.json();
      const dataCoupons = await resCoupons.json();

      if (dataOffers.success) setTimerOffers(dataOffers.offers || []);
      if (dataCoupons.success) setCoupons(dataCoupons.coupons || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketingData();
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.offerName || !newOffer.title || !newOffer.discountValue) {
      showToast('সকল তথ্য পূরণ করা আবশ্যক');
      return;
    }

    try {
      const res = await adminFetch('/api/admin/timer-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOffer),
      });
      const data = await res.json();
      if (data.success) {
        showToast('নতুন টাইমার অফার সফলভাবে সক্রিয় হয়েছে!');
        setIsOfferModalOpen(false);
        fetchMarketingData();
      } else {
        showToast(data.error || 'অফার তৈরিতে ত্রুটি');
      }
    } catch (err) {
      showToast('সার্ভার এরর');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-stone-200">
        <div>
          <div className="flex items-center gap-2 text-stone-900 font-bold text-lg">
            <Flame className="w-5 h-5 text-amber-600" />
            <h1>মার্কেটিং, টাইমার অফার ও কুপন (Campaigns & Promotions)</h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            কাউন্টডাউন ফ্ল্যাশ সেল, নির্দিষ্ট ক্যাটাগরি প্রমোশন ও আনঅথরাইজড স্ট্যাকিং প্রটেকশন রুলস।
          </p>
        </div>

        <button
          onClick={() => setIsOfferModalOpen(true)}
          className="bg-stone-900 hover:bg-black text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন টাইমার অফার তৈরি করুন</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 bg-white px-5 rounded-t-xl gap-6">
        <button
          onClick={() => setActiveTab('timer_offers')}
          className={`py-3.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'timer_offers' ? 'border-amber-700 text-amber-800' : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          কাউন্টডাউন টাইমার অফার ({timerOffers.length})
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`py-3.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'coupons' ? 'border-amber-700 text-amber-800' : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          কুপন কোড তালিকা ({coupons.length})
        </button>
      </div>

      {/* Timer Offers Content */}
      {activeTab === 'timer_offers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {timerOffers.map((off) => (
            <div key={off.id} className="bg-white p-5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 font-bold">{off.id}</span>
                  <h3 className="font-bold text-stone-900 text-sm mt-0.5">{off.offer_name}</h3>
                  <p className="text-xs text-amber-800 font-medium">{off.title}</p>
                </div>
                <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                  {off.discount_type === 'percentage' ? `${off.discount_value}% ছাড়` : `৳${off.discount_value} ছাড়`}
                </span>
              </div>

              <p className="text-stone-600 text-xs">{off.description}</p>

              <div className="bg-stone-50 p-3 rounded-lg text-xs space-y-1.5 border border-stone-100">
                <div className="flex items-center justify-between text-stone-600">
                  <span>টার্গেট স্কোপ:</span>
                  <strong className="text-stone-900 capitalize">{off.target_type.replace('_', ' ')}</strong>
                </div>
                <div className="flex items-center justify-between text-stone-600">
                  <span>মেয়াদ শেষ:</span>
                  <strong className="text-stone-900 font-mono">{new Date(off.end_time).toLocaleString('bn-BD')}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {off.status}
                </span>
                <span className="text-[11px] text-stone-400">প্রমোশন ইঞ্জিন: কোনো ডাবল স্ট্যাকিং অনুমোদিত নয়</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coupons Content */}
      {activeTab === 'coupons' && (
        <div className="bg-white rounded-b-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500 border-b border-stone-200 uppercase font-medium">
              <tr>
                <th className="py-3 px-4">কুপন কোড</th>
                <th className="py-3 px-4">ছাড়ের বিবরণ</th>
                <th className="py-3 px-4">ন্যূনতম অর্ডার</th>
                <th className="py-3 px-4 text-center">ব্যবহার হয়েছে</th>
                <th className="py-3 px-4">মেয়াদ</th>
                <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="py-3.5 px-4 font-mono font-bold text-stone-900">{c.code}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-stone-800">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : `৳${c.discount_value}`}
                    </span>
                    <span className="text-stone-500 text-[11px] block">{c.description}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono">৳{c.min_order_amount}</td>
                  <td className="py-3.5 px-4 text-center font-bold text-stone-800">{c.used_count || 0} বার</td>
                  <td className="py-3.5 px-4 font-mono text-stone-600">{c.expiry_date}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Timer Offer Modal */}
      {isOfferModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-stone-200 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-bold text-stone-900 text-base">নতুন ফ্ল্যাশ সেল / টাইমার অফার</h2>
              <button onClick={() => setIsOfferModalOpen(false)} className="text-stone-400 hover:text-stone-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">ক্যাম্পেইনের নাম *</label>
                <input
                  type="text"
                  required
                  value={newOffer.offerName || ''}
                  onChange={(e) => setNewOffer({ ...newOffer, offerName: e.target.value })}
                  placeholder="যেমন: উইকএন্ড মেগা সেল"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none focus:border-stone-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">ব্যানার শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={newOffer.title || ''}
                  onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
                  placeholder="যেমন: সকল তাঁতের লুঙ্গি ও পাঞ্জাবিতে ১৫% ফ্ল্যাট ছাড়"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none focus:border-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ছাড়ের ধরন</label>
                  <select
                    value={newOffer.discountType || 'percentage'}
                    onChange={(e) => setNewOffer({ ...newOffer, discountType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none bg-white font-medium"
                  >
                    <option value="percentage">শতাংশ (%)</option>
                    <option value="fixed">নির্দিষ্ট টাকা (৳)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">ছাড়ের পরিমাণ *</label>
                  <input
                    type="number"
                    required
                    value={newOffer.discountValue ?? 0}
                    onChange={(e) => setNewOffer({ ...newOffer, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none focus:border-stone-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">শুরুর তারিখ ও সময়</label>
                  <input
                    type="datetime-local"
                    value={newOffer.startTime || ''}
                    onChange={(e) => setNewOffer({ ...newOffer, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none focus:border-stone-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">সমাপ্তির তারিখ ও সময়</label>
                  <input
                    type="datetime-local"
                    value={newOffer.endTime || ''}
                    onChange={(e) => setNewOffer({ ...newOffer, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none focus:border-stone-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">টার্গেট স্কোপ</label>
                <select
                  value={newOffer.targetType || 'all'}
                  onChange={(e) => setNewOffer({ ...newOffer, targetType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs outline-none bg-white font-medium"
                >
                  <option value="entire_store">পুরো স্টোরের সকল পণ্য (Entire Store)</option>
                  <option value="category">নির্দিষ্ট ক্যাটাগরি (পাঞ্জাবি / শাড়ি)</option>
                  <option value="product">নির্দিষ্ট প্রোডাক্ট (Featured Product)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-lg text-stone-600 font-semibold text-xs hover:bg-stone-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-black text-white rounded-lg font-semibold text-xs cursor-pointer"
                >
                  ক্যাম্পেইন শুরু করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
