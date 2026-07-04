"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, LogIn, LogOut, Calendar, Timer } from "lucide-react";
import { attendanceApi, type AttendanceRecord, type AttendanceSummary } from "../../../lib/api";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present:  { label: "Present",  color: "text-green-600 bg-green-50 border-green-200" },
  absent:   { label: "Absent",   color: "text-red-600 bg-red-50 border-red-200" },
  half_day: { label: "Half Day", color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  on_leave: { label: "On Leave", color: "text-blue-600 bg-blue-50 border-blue-200" },
  holiday:  { label: "Holiday",  color: "text-purple-600 bg-purple-50 border-purple-200" },
};

function pad(n: number) { return String(n).padStart(2, "0"); }

function fmtTime(iso?: string) {
  if (!iso) return "--:--";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

function nowMonth() { return new Date().toISOString().slice(0, 7); }

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [month, setMonth] = useState(nowMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, s] = await Promise.all([
        attendanceApi.list({ month, limit: 31 }),
        attendanceApi.summary(month),
      ]);
      setRecords(r.data.records);
      setSummary(s.data);
    } catch {
      setError("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const isToday = month === new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">My Attendance</h1>
          <p className="text-sm text-muted mt-0.5">Track your daily attendance and work hours</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="input text-sm"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Live Clock */}
      {isToday && (
        <div className="card p-5 flex items-center gap-3">
          <div className="size-12 rounded-xl bg-primary/10 grid place-items-center shrink-0">
            <Clock className="size-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-mono font-bold tabular-nums">
              {pad(clock.getHours())}:{pad(clock.getMinutes())}:{pad(clock.getSeconds())}
            </p>
            <p className="text-xs text-muted">
              {clock.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
      )}

      {/* Monthly Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Present",    val: summary.present,       color: "text-green-600" },
            { label: "Half Day",   val: summary.halfDay,       color: "text-yellow-600" },
            { label: "Absent",     val: summary.absent,        color: "text-red-600" },
            { label: "On Leave",   val: summary.onLeave,       color: "text-blue-600" },
            { label: "Holiday",    val: summary.holiday,       color: "text-purple-600" },
            { label: "Work Hours", val: `${summary.totalWorkHours}h`, color: "text-foreground" },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily Records */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Calendar className="size-4 text-muted" />
          <h2 className="font-semibold text-sm">Daily Log — {month}</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading…</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">No attendance records for this month</div>
        ) : (
          <div className="divide-y divide-border">
            {records.map((r) => {
              const s = STATUS_LABELS[r.status] ?? { label: r.status, color: "text-muted bg-surface-2 border-border" };
              return (
                <div key={r._id} className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/40 transition-colors">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium">{fmtDate(r.date)}</p>
                    <p className="text-xs text-muted">{r.date}</p>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border ${s.color}`}>
                    {s.label}
                  </span>
                  <div className="flex items-center gap-3 text-sm text-muted ml-2">
                    {r.clockIn && (
                      <span className="flex items-center gap-1">
                        <LogIn className="size-3.5" /> {fmtTime(r.clockIn)}
                      </span>
                    )}
                    {r.clockOut && (
                      <span className="flex items-center gap-1">
                        <LogOut className="size-3.5" /> {fmtTime(r.clockOut)}
                      </span>
                    )}
                    {r.workHours > 0 && (
                      <span className="flex items-center gap-1">
                        <Timer className="size-3.5" /> {r.workHours}h
                      </span>
                    )}
                  </div>
                  {r.note && <p className="ml-auto text-xs text-muted italic truncate max-w-[180px]">{r.note}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
