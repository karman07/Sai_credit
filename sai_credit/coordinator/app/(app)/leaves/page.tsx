"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, CheckCircle2, XCircle, Clock, CalendarOff, CalendarDays,
  X, Trash2, Sun, Briefcase, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "../../../components/ui";
import { leavesApi, type Leave, type LeaveBalance } from "../../../lib/api";

// ── Types / constants ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:   { label: "Pending",   icon: Clock,        color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  approved:  { label: "Approved",  icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "text-red-600 bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", icon: CalendarOff,  color: "text-muted bg-surface-2 border-border" },
};

const ATT_CONFIG: Record<string, { color: string; label: string }> = {
  present:  { color: "bg-green-500",  label: "Present" },
  half_day: { color: "bg-blue-400",   label: "Half Day" },
  on_leave: { color: "bg-purple-400", label: "On Leave" },
  absent:   { color: "bg-red-400",    label: "Absent" },
};

const LEAVE_TYPES = [
  { value: "casual",  label: "Casual Leave",  paid: true  },
  { value: "sick",    label: "Sick Leave",     paid: true  },
  { value: "earned",  label: "Earned Leave",   paid: true  },
  { value: "unpaid",  label: "Unpaid Leave",   paid: false },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun
}

const DOW_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_NAMES  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Monthly attendance calendar ───────────────────────────────────────────────

function AttCalendar({ records, weeklyOffDays }: { records: { date: string; status: string }[]; weeklyOffDays: number[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.toISOString().slice(0, 10);

  const totalDays = daysInMonth(year, month);
  const firstDow  = firstDayOfMonth(year, month); // 0=Sun

  const attMap = new Map(records.map((r) => [r.date, r.status]));

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
        Attendance — {monthLabel}
      </p>
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-semibold pb-1 ${weeklyOffDays.includes(i) ? "text-orange-500" : "text-muted"}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dt = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isToday     = dt === today;
          const dayOfWeek   = new Date(year, month - 1, d).getDay();
          const isWeeklyOff = weeklyOffDays.includes(dayOfWeek);
          const isFuture    = dt > today;
          const status      = attMap.get(dt);
          const attCfg      = status ? ATT_CONFIG[status] : null;

          return (
            <div
              key={d}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium
                ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                ${isWeeklyOff ? "bg-orange-50 text-orange-500" : isFuture ? "text-muted/40" : "text-foreground"}
                ${!isWeeklyOff && !isFuture && !attCfg ? "bg-surface-2" : ""}
              `}
            >
              {isWeeklyOff ? (
                <>
                  <Sun className="size-3 mb-0.5" />
                  <span className="text-[9px]">{d}</span>
                </>
              ) : attCfg ? (
                <>
                  <span className={`size-2 rounded-full ${attCfg.color} mb-0.5`} />
                  <span>{d}</span>
                </>
              ) : (
                <span>{d}</span>
              )}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(ATT_CONFIG).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${v.color}`} />
            <span className="text-[10px] text-muted">{v.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <Sun className="size-2.5 text-orange-500" />
          <span className="text-[10px] text-muted">Weekly Off</span>
        </div>
      </div>
    </div>
  );
}

// ── Leave balance cards ───────────────────────────────────────────────────────

function BalanceCards({ bal }: { bal: LeaveBalance }) {
  const pct = bal.annualLeaveQuota > 0
    ? Math.min(100, (bal.leaveBalance / bal.annualLeaveQuota) * 100)
    : 0;
  const barColor = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Annual leave balance */}
      <div className="card p-4 sm:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">Annual Paid Leave</p>
            <p className="text-3xl font-bold mt-0.5">
              {bal.leaveBalance}
              <span className="text-base font-medium text-muted"> / {bal.annualLeaveQuota} days</span>
            </p>
            <p className="text-xs text-muted mt-0.5">{bal.usedPaidDays} used · {bal.leaveBalance} remaining</p>
          </div>
          <div className="size-14 rounded-full grid place-items-center bg-primary/10">
            <CalendarDays className="size-6 text-primary" />
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-muted mt-1.5">
          {bal.pendingCount > 0 && `${bal.pendingCount} pending request${bal.pendingCount !== 1 ? "s" : ""} · `}
          Resets every calendar year
        </p>
      </div>

      {/* Weekly off */}
      <div className="card p-4 flex flex-col justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted">Weekly Off</p>
          <div className="flex items-center gap-2 mt-2">
            <Sun className="size-5 text-orange-500" />
            <p className="font-semibold text-sm">
              {bal.weeklyOffDays.map((d) => DOW_NAMES[d]).join(", ")}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted mt-3">
          Absences on weekly off days don't count toward salary deductions.
        </p>
      </div>
    </div>
  );
}

// ── Leave type selector ───────────────────────────────────────────────────────

function LeaveTypeCard({
  type, selected, onSelect, balance,
}: { type: typeof LEAVE_TYPES[0]; selected: boolean; onSelect: () => void; balance: number }) {
  const insufficient = type.paid && balance <= 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={insufficient}
      className={`relative p-3 rounded-xl border-2 text-left transition-all w-full disabled:opacity-50 disabled:cursor-not-allowed
        ${selected ? "border-primary bg-primary/8" : "border-border hover:border-primary/40 bg-transparent"}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${selected ? "text-primary" : ""}`}>{type.label}</span>
        {type.paid ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Paid</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-semibold">Unpaid</span>
        )}
      </div>
      {type.paid && (
        <p className="text-[10px] text-muted mt-0.5">{balance} days available</p>
      )}
      {insufficient && (
        <p className="text-[10px] text-red-500 mt-0.5">No balance remaining</p>
      )}
    </button>
  );
}

// ── Apply leave modal ─────────────────────────────────────────────────────────

function ApplyLeaveModal({
  balance,
  onClose,
  onDone,
}: { balance: number; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    type: "casual", startDate: todayStr(), endDate: todayStr(), reason: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedType = LEAVE_TYPES.find((t) => t.value === form.type)!;
  const days = (() => {
    const diff = new Date(form.endDate).getTime() - new Date(form.startDate).getTime();
    return diff < 0 ? 0 : Math.round(diff / 86400000) + 1;
  })();
  const warning = selectedType.paid && days > balance;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.reason.trim()) { setError("Reason is required"); return; }
    if (new Date(form.endDate) < new Date(form.startDate)) { setError("End date cannot be before start date"); return; }
    setSubmitting(true); setError("");
    try {
      await leavesApi.create(form);
      onDone();
    } catch (err: any) { setError(err.message ?? "Failed to submit leave"); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Apply for Leave</h2>
            <p className="text-xs text-muted mt-0.5">Request will be sent to admin for approval</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {/* Leave type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map((t) => (
                <LeaveTypeCard
                  key={t.value}
                  type={t}
                  selected={form.type === t.value}
                  onSelect={() => setForm((f) => ({ ...f, type: t.value }))}
                  balance={balance}
                />
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">From</label>
              <input type="date" value={form.startDate} min={todayStr()}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="input w-full text-sm" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">To</label>
              <input type="date" value={form.endDate} min={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="input w-full text-sm" required />
            </div>
          </div>

          {/* Duration preview */}
          {days > 0 && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 border ${warning ? "bg-yellow-50 border-yellow-200" : "bg-primary/8 border-primary/20"}`}>
              {warning ? <AlertTriangle className="size-4 text-yellow-600 shrink-0" /> : <CalendarDays className="size-4 text-primary shrink-0" />}
              <p className={`text-sm font-medium ${warning ? "text-yellow-700" : "text-primary"}`}>
                {days} day{days !== 1 ? "s" : ""} of {selectedType.label}
                {warning && " — exceeds your remaining balance"}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Reason</label>
            <textarea placeholder="Briefly describe the reason…" rows={3}
              value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              className="input w-full text-sm resize-none" required minLength={5} />
          </div>

          {/* Unpaid note */}
          {!selectedType.paid && (
            <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 border border-border">
              <Info className="size-4 text-muted shrink-0 mt-0.5" />
              <p className="text-xs text-muted">Unpaid leave will cause a salary deduction of {days} day{days !== 1 ? "s" : ""} worth of wages when payroll is processed.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2.5 pt-1">
            <Button type="button" variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" size="md" className="flex-1" loading={submitting}>Submit Request</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeavesPage() {
  const [leaves, setLeaves]           = useState<Leave[]>([]);
  const [total, setTotal]             = useState(0);
  const [balance, setBalance]         = useState<LeaveBalance | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [showForm, setShowForm]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [leavesRes, balRes] = await Promise.all([
        leavesApi.list(filterStatus ? { status: filterStatus } : undefined),
        leavesApi.balance(),
      ]);
      setLeaves(leavesRes.data.leaves);
      setTotal(leavesRes.data.total);
      setBalance(balRes.data);
    } catch { setError("Failed to load leave data"); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    try { await leavesApi.cancel(id); await load(); }
    catch (e: any) { setError(e.message ?? "Failed to cancel leave"); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Leave Portal</h1>
          <p className="text-sm text-muted mt-0.5">Track your leave balance, weekly offs, and attendance</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="size-4" /> Apply for Leave
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Balance cards */}
      {balance && <BalanceCards bal={balance} />}

      {/* Attendance calendar */}
      {balance && <AttCalendar records={balance.currentMonthAttendance} weeklyOffDays={balance.weeklyOffDays} />}

      {/* Filters + list */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-sm flex-1">Leave History</h2>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted">Loading…</div>
          ) : leaves.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarOff className="size-10 text-muted/40 mx-auto mb-3" />
              <p className="text-sm text-muted">No leave requests yet</p>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} className="mt-3">
                Apply for your first leave
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {leaves.map((l) => {
                const cfg  = STATUS_CONFIG[l.status];
                const Icon = cfg.icon;
                const isPaid = l.type !== "unpaid";
                return (
                  <div key={l._id} className="flex items-start gap-4 px-4 py-4 hover:bg-surface-2/40">
                    <div className="size-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 mt-0.5">
                      <CalendarDays className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm capitalize">{l.type} Leave</span>
                        {isPaid
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-semibold">Paid</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted font-semibold">Unpaid</span>
                        }
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1 ${cfg.color}`}>
                          <Icon className="size-3" /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {new Date(l.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(l.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}<span className="font-medium text-foreground">{l.totalDays} day{l.totalDays !== 1 ? "s" : ""}</span>
                        {!isPaid && <span className="text-red-500"> · salary deducted</span>}
                      </p>
                      <p className="text-xs text-muted mt-0.5 truncate">{l.reason}</p>
                      {l.reviewNote && <p className="text-xs italic text-muted/70 mt-0.5">"{l.reviewNote}"</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted">{new Date(l.createdAt).toLocaleDateString("en-IN")}</p>
                      {l.status === "pending" && (
                        <button
                          onClick={() => handleCancel(l._id)}
                          className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 ml-auto"
                        >
                          <Trash2 className="size-3" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && balance && (
        <ApplyLeaveModal
          balance={balance.leaveBalance}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
