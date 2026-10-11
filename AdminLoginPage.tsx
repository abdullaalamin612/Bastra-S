import React, { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { Shield, Lock, Eye, EyeOff, KeyRound, UserCheck, ArrowLeft, Store } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { adminLogin, navigateToHome } = useShop();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!identifier.trim()) {
      setErrorMessage('অনুগ্রহ করে এডমিন ইমেইল অথবা মোবাইল নম্বর প্রদান করুন');
      return;
    }
    if (!password.trim()) {
      setErrorMessage('অনুগ্রহ করে এডমিন পাসওয়ার্ড প্রদান করুন');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminLogin(password, identifier.trim());
      setIsSubmitting(false);
      if (!res.success) {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || 'লগইন ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col justify-between p-4 sm:p-6 selection:bg-amber-500 selection:text-stone-950">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <button
          onClick={navigateToHome}
          className="flex items-center gap-2 text-xs font-bold text-stone-400 hover:text-amber-400 bg-stone-900/80 hover:bg-stone-900 border border-stone-800 px-4 py-2 rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ওয়েবসাইটে ফিরে যান (Storefront)</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <Store className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-stone-300">BASTRA SHOILY</span>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-stone-900/90 backdrop-blur-md rounded-3xl border border-stone-800 p-7 sm:p-9 shadow-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <span>🔐</span>
                <span>Admin Login</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                বাস্ত্র শৈলী এডমিন পোর্টাল
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                অনুমোদিত ক্রেডেনশিয়াল দিয়ে এডমিন কন্ট্রোল সেন্টারে প্রবেশ করুন
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Admin Email or Mobile */}
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Email অথবা Mobile Number</span>
              </label>
              <input
                id="admin-page-identifier-input"
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="admin@bastrashoily.com অথবা 01XXXXXXXXX"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoFocus
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono transition-colors"
              />
            </div>

            {/* Admin Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password</span>
                </label>
                <span className="text-[10px] text-stone-400">নিরাপদ ইনপুট</span>
              </div>

              <div className="relative">
                <input
                  id="admin-page-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono transition-colors tracking-widest"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1 rounded-lg transition-colors cursor-pointer"
                  title={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 animate-ping" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              id="admin-page-submit-button"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-bold text-xs rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer disabled:opacity-50 mt-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isSubmitting ? 'যাচাই করা হচ্ছে...' : 'Login'}</span>
            </button>
          </form>

          {/* Security Notice */}
          <div className="pt-3 border-t border-stone-800 text-center">
            <p className="text-[11px] text-stone-400 leading-relaxed">
              🔐 প্রতিটি এডমিন সেশন সার্ভার-সাইড ক্রিপ্টোগ্রাফিক সেশন টোকেন ও পারমিশন দ্বারা সুরক্ষিত।
            </p>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-xs text-stone-400 py-3">
        &copy; {new Date().getFullYear()} বাস্ত্র শৈলী (BASTRA SHOILY). সর্বস্বত্ব সংরক্ষিত।
      </div>
    </div>
  );
};
