import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';

export const CustomerAuthModal: React.FC = () => {
  const {
    isCustomerAuthModalOpen,
    closeCustomerAuthModal,
    customerLogin,
    customerRegister,
    authInitialMode,
    customers,
  } = useShop();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Login form state
  const [loginPhoneOrEmail, setLoginPhoneOrEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regDistrict, setRegDistrict] = useState('ঢাকা');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Sync mode with initial mode when opened
  React.useEffect(() => {
    if (isCustomerAuthModalOpen) {
      setMode(authInitialMode);
      setErrorMessage(null);
    }
  }, [isCustomerAuthModalOpen, authInitialMode]);

  if (!isCustomerAuthModalOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!loginPhoneOrEmail.trim()) {
      setErrorMessage('ফোন নম্বর অথবা ইমেইল দিন।');
      return;
    }
    const res = customerLogin(loginPhoneOrEmail, loginPassword);
    if (!res.success) {
      setErrorMessage(res.message);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!regName.trim() || !regPhone.trim()) {
      setErrorMessage('নাম এবং মোবাইল নম্বর অবশ্যই প্রদান করতে হবে।');
      return;
    }
    const res = customerRegister({
      name: regName,
      phone: regPhone,
      email: regEmail,
      address: regAddress,
      district: regDistrict,
    });
    if (!res.success) {
      setErrorMessage(res.message);
    }
  };

  const handleQuickDemoLogin = (phone: string) => {
    setLoginPhoneOrEmail(phone);
    setErrorMessage(null);
    customerLogin(phone);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="bg-stone-900 text-white p-6 sm:p-7 relative">
          <button
            onClick={closeCustomerAuthModal}
            className="absolute top-5 right-5 p-2 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" />
            <span>বাস্ত্র শৈলী গ্রাহক একাউন্ট</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {mode === 'login' ? 'একাউন্টে লগইন করুন' : 'নতুন গ্রাহক নিবন্ধন'}
          </h2>
          <p className="text-stone-300 text-xs mt-1">
            {mode === 'login'
              ? 'অর্ডার ট্র্যাকিং, পূর্বের কেনাকাটা ও দ্রুত চেকআউট সুবিধা পেতে সাইন ইন করুন'
              : 'সহজে অর্ডার করতে এবং ডেলিভারি ঠিকানা সংরক্ষণ করতে একাউন্ট তৈরি করুন'}
          </p>

          {/* Mode Switch Tabs */}
          <div className="flex bg-stone-800 p-1 rounded-xl mt-5 text-xs font-bold">
            <button
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-extrabold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              লগইন (Sign In)
            </button>
            <button
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-amber-500 text-stone-950 shadow-md font-extrabold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              নতুন একাউন্ট (Register)
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  মোবাইল নম্বর অথবা ইমেইল *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginPhoneOrEmail}
                    onChange={(e) => setLoginPhoneOrEmail(e.target.value)}
                    placeholder="e.g. 01711223344 বা ইমেইল"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2.5 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white text-sm"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-stone-700">পাসওয়ার্ড / পিন (ঐচ্ছিক)</label>
                  <span className="text-[11px] text-stone-400">ডিফল্ট: 1234</span>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="পাসওয়ার্ড লিখুন"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-10 py-2.5 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white text-sm"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors cursor-pointer"
                    title={showLoginPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>লগইন করুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Quick Demo Login Helper */}
              {customers.length > 0 && (
                <div className="pt-4 mt-2 border-t border-stone-200">
                  <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 text-center">
                    দ্রুত ডেমো লগইন করতে ক্লিক করুন:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {customers.slice(0, 2).map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => handleQuickDemoLogin(c.phone)}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-amber-50 text-stone-800 rounded-lg text-[11px] border border-stone-300 hover:border-amber-400 transition-colors"
                      >
                        {c.name} ({c.phone})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">আপনার পুরো নাম *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. মোঃ আব্দুল্লাহ"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">মোবাইল নম্বর * (১১ ডিজিট)</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="e.g. 017XXXXXXXX"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                  />
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">ইমেইল (ঐচ্ছিক)</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="e.g. user@gmail.com"
                      className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                    />
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">জেলা *</label>
                  <select
                    value={regDistrict}
                    onChange={(e) => setRegDistrict(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                  >
                    <option value="ঢাকা">ঢাকা</option>
                    <option value="চট্টগ্রাম">চট্টগ্রাম</option>
                    <option value="সিলেট">সিলেট</option>
                    <option value="রাজশাহী">রাজশাহী</option>
                    <option value="খুলনা">খুলনা</option>
                    <option value="বরিশাল">বরিশাল</option>
                    <option value="রংপুর">রংপুর</option>
                    <option value="ময়মনসিংহ">ময়মনসিংহ</option>
                    <option value="কুমিল্লা">কুমিল্লা</option>
                    <option value="গাজীপুর">গাজীপুর</option>
                    <option value="অন্যান্য">অন্যান্য জেলা</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">ডেলিভারি ঠিকানা (বাসা/রোড)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="e.g. বাড়ি ১২, রোড ৪, সেক্টর ৭, উত্তরা"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                  />
                  <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">পাসওয়ার্ড নির্ধারণ করুন</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="কমপক্ষে ৪ সংখ্যার পাসওয়ার্ড দিন"
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-10 py-2 text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-2 text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors cursor-pointer"
                    title={showRegPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-3"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>নিবন্ধন সম্পন্ন করুন</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
