'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

function getNext9AM(): number {
  const now = new Date();
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + IST_OFFSET);
  const next9AM = new Date(nowIST);
  next9AM.setHours(9, 0, 0, 0);
  if (nowIST >= next9AM) next9AM.setDate(next9AM.getDate() + 1);
  return next9AM.getTime() - IST_OFFSET;
}

export default function CashierLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Authentication failed. Check your credentials.');
      }
      const { access_token, user } = await res.json();
      if (user?.role !== 'cashier' && user?.role !== 'admin') {
        throw new Error('Access Denied: This portal is for Cashier accounts only.');
      }
      const expiresAt = getNext9AM();
      const sessionData = {
        token: access_token,
        expiresAt,
        role: user?.role,
        name: user?.name,
        id: user?._id || user?.id,
        branch_id: user?.branch_id,
      };
      localStorage.setItem('cashier_session', JSON.stringify(sessionData));
      // Auto-record attendance on login
      try {
        await fetch(`${API_BASE}/attendance/check-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        });
      } catch (_) { /* best-effort */ }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'System error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#5A0F1A]/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#5A0F1A]/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5A0F1A]/3 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <div className="relative h-28 w-28 bg-gradient-to-br from-[#5A0F1A] to-[#3D0A11] rounded-[2rem] flex items-center justify-center shadow-2xl shadow-[#5A0F1A]/30 overflow-hidden border border-white/10">
            <div className="p-4 w-full h-full flex items-center justify-center">
              <img src="/rkm-logo.png" alt="RKM Logo" className="w-full h-full object-contain brightness-110 drop-shadow-2xl" />
            </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Cashier Portal</h1>
          <p className="text-sm font-medium text-slate-500">RKM Jewellers · Staff Access</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Attendance recorded automatically on sign in
            </span>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-[440px] relative z-10">
        <div className="bg-white py-10 px-8 shadow-xl shadow-slate-200/50 border border-slate-100 rounded-[2.5rem]">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-100 text-[#7A1C2A] text-xs font-bold rounded-2xl px-5 py-4 flex items-center gap-3">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2.5 ml-1">
                  Email Address
                </label>
                <input
                  id="cashier-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#7A1C2A]/10 focus:border-[#7A1C2A] focus:bg-white transition-all"
                  placeholder="cashier@rkmjewellers.com"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-widest font-bold text-slate-400 mb-2.5 ml-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="cashier-password"
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#7A1C2A]/10 focus:border-[#7A1C2A] focus:bg-white transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPass
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      }
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <button
              id="cashier-signin-btn"
              type="submit"
              disabled={loading}
              className="w-full h-[56px] bg-[#5A0F1A] hover:bg-[#7A1C2A] active:scale-[0.98] text-white rounded-2xl shadow-lg shadow-[#5A0F1A]/25 transition-all font-bold uppercase tracking-widest text-xs disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In &amp; Mark Attendance
                </>
              )}
            </button>

            <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest pt-1">
              Protected by RKM Security · Session expires at 9 AM
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
