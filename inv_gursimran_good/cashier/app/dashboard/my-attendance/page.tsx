'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  getProfile, getMyAttendance, getMyAttendanceStats, checkSessionExpiry,
  type UserProfile, type StaffAttendanceRecord,
} from '../../../lib/api';

const STATUS_MAP: Record<string, { label: string; textColor: string; dotColor: string }> = {
  present:    { label: 'Present',  textColor: 'text-emerald-600', dotColor: 'bg-emerald-500' },
  absent:     { label: 'Absent',   textColor: 'text-red-500',     dotColor: 'bg-red-500'     },
  'half-day': { label: 'Half Day', textColor: 'text-amber-500',   dotColor: 'bg-amber-400'   },
  'on-leave': { label: 'On Leave', textColor: 'text-blue-500',    dotColor: 'bg-blue-400'    },
};

const STAT_COLORS: Record<string, string> = {
  Present:    'text-emerald-600',
  Absent:     'text-red-500',
  'Half Day': 'text-amber-500',
  'On Leave': 'text-blue-500',
};

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfWeek(year: number, month: number) { return new Date(year, month, 1).getDay(); }

export default function MyAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  useEffect(() => {
    if (checkSessionExpiry()) return;
    const sessionStr = localStorage.getItem('cashier_session');
    if (!sessionStr) { router.replace('/login'); return; }
    getProfile()
      .then(async (profile) => {
        setUser(profile);
        const startDate = new Date(viewYear, viewMonth, 1).toISOString();
        const endDate = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
        const [recs, sts] = await Promise.all([
          getMyAttendance(profile._id, startDate, endDate),
          getMyAttendanceStats(profile._id, viewMonth, viewYear),
        ]);
        setRecords(recs);
        setStats(sts);
      })
      .catch(() => { localStorage.removeItem('cashier_session'); router.replace('/login'); })
      .finally(() => setLoading(false));
  }, [viewYear, viewMonth, router]);

  const recordMap: Record<string, StaffAttendanceRecord> = {};
  records.forEach(r => {
    const key = new Date(r.date).toISOString().split('T')[0];
    recordMap[key] = r;
  });

  const totalDays = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  function navMonth(dir: 1 | -1) {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  }

  if (loading) return (
    
      <div className="flex h-full items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-[#5A0F1A]/20 border-t-[#5A0F1A] rounded-full animate-spin" />
      </div>
    
  );

  return (
    
      <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8 bg-white min-h-full">

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">My Attendance</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">
            Your attendance is recorded automatically each time you sign in.
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Present',  value: stats.present  },
              { label: 'Absent',   value: stats.absent   },
              { label: 'Half Day', value: stats.halfDay  },
              { label: 'On Leave', value: stats.onLeave  },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{s.label}</p>
                <p className={`text-3xl font-black ${STAT_COLORS[s.label]}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar */}
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-slate-100">
            <button onClick={() => navMonth(-1)} className="p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-700">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-base font-black text-slate-900">{monthName}</h2>
            <button onClick={() => navMonth(1)} disabled={viewYear === now.getFullYear() && viewMonth === now.getMonth()} className="p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-700 disabled:opacity-30">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 p-4 gap-1.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: totalDays }).map((_, idx) => {
              const day = idx + 1;
              const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = recordMap[dateKey];
              const status = record?.status;
              const cfg = status ? STATUS_MAP[status] : null;
              const isToday = dateKey === now.toISOString().split('T')[0];
              const isFuture = new Date(dateKey) > now;

              return (
                <div key={day} className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all ${isToday ? 'ring-2 ring-[#5A0F1A] ring-offset-1' : ''} bg-white`}>
                  <span className={`text-sm font-bold leading-none ${
                    isFuture ? 'text-slate-200'
                    : isToday ? 'text-[#5A0F1A] font-black'
                    : cfg ? cfg.textColor + ' font-black'
                    : 'text-slate-400'
                  }`}>{day}</span>
                  {cfg && <span className={`w-1.5 h-1.5 rounded-full mt-1 ${cfg.dotColor}`} />}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-8 py-4 border-t border-slate-50">
            {Object.entries(STATUS_MAP).map(([, cfg]) => (
              <div key={cfg.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.textColor}`}>{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today's sign-in */}
        {(() => {
          const todayKey = now.toISOString().split('T')[0];
          const todayRecord = recordMap[todayKey];
          if (!todayRecord) return null;
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Check-In */}
              <div className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex items-center gap-5 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-[#5A0F1A] flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-[#5A0F1A] uppercase tracking-widest mb-1">Check-In Time</p>
                  <p className="text-lg font-black text-slate-900">
                    {todayRecord.check_in
                      ? new Date(todayRecord.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : 'Recorded'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Recorded at sign in</p>
                </div>
              </div>

              {/* Check-Out */}
              <div className="bg-white border border-slate-100 rounded-[1.5rem] p-6 flex items-center gap-5 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-slate-500" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Check-Out Time</p>
                  <p className="text-lg font-black text-slate-900">
                    {todayRecord.check_out
                      ? new Date(todayRecord.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : 'Not Recorded'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Recorded when you sign out</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    
  );
}
