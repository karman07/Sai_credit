"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, ChevronDown, ChevronUp, X,
  ChevronLeft, ChevronRight, CheckCircle2,
  Users, UserCheck, Sun, CalendarDays, Palmtree,
  TrendingDown, AlertCircle, Plus, Trash2, RefreshCw,
  Gift, Receipt, Briefcase, TrendingUp, MinusCircle,
} from "lucide-react";
import {
  payrollApi, attendanceApi, leavesApi, claimsApi,
  type UserPayrollOverview, type AttendanceRecord, type Leave,
  type LeaveBalance, type Incentive, type AdditionalDeduction, type Claim,
} from "../../../lib/api";
import { Button, Input, Label } from "../../../components/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function nowMonth() { return new Date().toISOString().slice(0, 7); }
function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function workingDaysInMonth(month: string): number {
  const [y, mo] = month.split("-").map(Number);
  const total = new Date(y, mo, 0).getDate();
  let count = 0;
  for (let d = 1; d <= total; d++) {
    if (new Date(y, mo - 1, d).getDay() !== 0) count++;
  }
  return count;
}
// Mirrors the backend computePay formula: LOP = basic - earned, earned = basic * effectiveDays / workingDays
function calcLop(basic: number, present: number, half: number, paidLeave: number, month: string) {
  const wd = workingDaysInMonth(month);
  if (!wd || !basic) return 0;
  const earned = basic * (present + half * 0.5 + paidLeave) / wd;
  return Math.max(0, Math.round(basic - earned));
}

// ── Attendance calendar ───────────────────────────────────────────────────────

const ATT_COLORS: Record<string, string> = {
  present: "bg-green-500", half_day: "bg-blue-400",
  on_leave: "bg-purple-400", absent: "bg-red-500", holiday: "bg-orange-300",
};
const ATT_LABELS: Record<string, string> = {
  present: "Present", half_day: "Half Day",
  on_leave: "On Leave", absent: "Absent", holiday: "Holiday",
};

function MiniCalendar({ month, records, leaves }: {
  month: string; records: AttendanceRecord[]; leaves: Leave[];
}) {
  const [y, mo] = month.split("-").map(Number);
  const total = new Date(y, mo, 0).getDate();
  const offset = new Date(y, mo - 1, 1).getDay();
  const today = new Date().toISOString().slice(0, 10);

  const attMap = new Map(records.map((r) => [r.date, r.status]));
  const leaveMap = new Map<string, string>();
  for (const lv of leaves) {
    if (lv.status !== "approved") continue;
    const cur = new Date(lv.startDate + "T00:00:00Z");
    const end = new Date(lv.endDate + "T00:00:00Z");
    while (cur <= end) {
      leaveMap.set(cur.toISOString().slice(0, 10), lv.type);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-[9px] font-bold text-muted pb-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />;
          const dt = `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const status = attMap.get(dt);
          const lvType = leaveMap.get(dt);
          const isToday = dt === today;
          const isFuture = dt > today;
          const isSunday = new Date(y, mo - 1, d).getDay() === 0;
          let bg = "bg-surface-2";
          let dot = "";
          if (status) { bg = ""; dot = ATT_COLORS[status] ?? "bg-gray-400"; }
          else if (lvType) { bg = ""; dot = "bg-purple-400"; }
          else if (isSunday) bg = "bg-orange-50";
          return (
            <div
              key={d}
              title={status ? ATT_LABELS[status] : lvType ? `Leave (${lvType})` : isSunday ? "Sunday off" : ""}
              className={`aspect-square rounded flex flex-col items-center justify-center text-[9px] font-medium
                ${isToday ? "ring-1 ring-primary" : ""} ${isFuture ? "opacity-30" : ""} ${bg}`}
            >
              {dot ? (
                <><span className={`size-1.5 rounded-full ${dot} mb-0.5`} /><span className={status === "absent" ? "text-red-600" : ""}>{d}</span></>
              ) : isSunday ? (
                <><Sun className="size-2 text-orange-400 mb-0.5" /><span className="text-orange-400">{d}</span></>
              ) : (
                <span className={isFuture ? "text-muted/40" : "text-muted"}>{d}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {Object.entries(ATT_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <span className={`size-2 rounded-full ${ATT_COLORS[k]}`} />
            <span className="text-[9px] text-muted">{v}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-purple-400" />
          <span className="text-[9px] text-muted">Leave</span>
        </div>
      </div>
    </div>
  );
}

// ── Editable list (incentives or deductions) ──────────────────────────────────

function EditableAdjustmentList({
  items, onChange, addLabel,
}: {
  items: { reason: string; amount: number }[];
  onChange: (items: { reason: string; amount: number }[]) => void;
  addLabel: string;
}) {
  function add() { onChange([...items, { reason: "", amount: 0 }]); }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function update(i: number, field: "reason" | "amount", val: string) {
    onChange(items.map((x, idx) =>
      idx === i ? { ...x, [field]: field === "amount" ? parseFloat(val) || 0 : val } : x
    ));
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted">None yet. Click add below.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            value={item.reason}
            onChange={(e) => update(i, "reason", e.target.value)}
            placeholder="Reason…"
            className="flex-1 text-xs"
          />
          <div className="relative w-24 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-xs pointer-events-none">₹</span>
            <Input
              type="number"
              value={item.amount || ""}
              onChange={(e) => update(i, "amount", e.target.value)}
              placeholder="0"
              className="w-full !pl-6 text-xs"
            />
          </div>
          <button
            onClick={() => remove(i)}
            className="size-7 flex items-center justify-center rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-xs font-medium text-primary hover:text-primary-hover inline-flex items-center gap-1"
      >
        <Plus className="size-3" /> {addLabel}
      </button>
    </div>
  );
}

// ── Attendance + Backfill Panel ───────────────────────────────────────────────

function AttendancePanel({ month, onDone }: { month: string; onDone: () => void }) {
  const [date, setDate] = useState(yesterday());
  const [running, setRunning] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [result, setResult] = useState<{ marked: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  async function runSingle() {
    setRunning(true); setResult(null); setError("");
    try { const r = await attendanceApi.autoMarkAbsent(date); setResult(r.data); onDone(); }
    catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setRunning(false); }
  }

  async function runBackfill() {
    setBackfilling(true); setResult(null); setError("");
    try { const r = await attendanceApi.backfillMonth(month); setResult(r.data); onDone(); }
    catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setBackfilling(false); }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="size-8 rounded-lg bg-red-100 grid place-items-center">
            <UserCheck className="size-4 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold">Auto-Mark Absent</p>
            <p className="text-[11px] text-muted">Marks staff with no check-in, no leave, and no holiday as Absent</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <Input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setDate(e.target.value); setResult(null); }}
            className="w-36 text-sm"
          />
          <Button variant="outline" size="sm" onClick={runSingle} loading={running}
            className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50">
            <UserCheck className="size-3.5" /> Run
          </Button>
          <Button variant="outline" size="sm" onClick={runBackfill} loading={backfilling}
            className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50">
            <RefreshCw className="size-3.5" /> Backfill {fmtMonth(month)}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {result && (
        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Done — <span className="font-semibold">{result.marked} marked absent</span>, {result.skipped} skipped
        </p>
      )}
    </div>
  );
}

// ── Mark Paid Modal ───────────────────────────────────────────────────────────

function MarkPaidModal({ record, month, netPay, onClose, onDone }: {
  record: UserPayrollOverview; month: string; netPay: number;
  onClose: () => void; onDone: () => void;
}) {
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setSaving(true); setError("");
    try {
      let id = record.payroll?._id;
      if (!id) { const r = await payrollApi.generate({ userId: record.user._id, month }); id = r.data._id; }
      await payrollApi.update(id, { status: "paid", paidAt } as any);
      onDone();
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base">Confirm Payment</h2>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
          <p className="font-semibold">{record.user.firstName} {record.user.lastName}</p>
          <p className="text-xs text-green-700 opacity-80">Net Pay (all adjustments included)</p>
          <p className="text-lg font-bold">{fmt(netPay)}</p>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div className="space-y-1.5">
          <Label>Payment Date</Label>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full" />
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="md" className="flex-1" loading={saving} onClick={confirm}>Confirm Paid</Button>
        </div>
      </div>
    </div>
  );
}

// ── Employee Card ─────────────────────────────────────────────────────────────

function EmployeeCard({ record, month, onMarkPaid, onRefresh }: {
  record: UserPayrollOverview;
  month: string;
  onMarkPaid: (netPay: number) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [attRecords, setAttRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Incentives edit state
  const [incentives, setIncentives] = useState<Incentive[]>([]);
  const [editIncentives, setEditIncentives] = useState(false);
  const [savingInc, setSavingInc] = useState(false);
  const [incError, setIncError] = useState("");

  // Additional deductions edit state
  const [deductions, setDeductions] = useState<AdditionalDeduction[]>([]);
  const [editDeductions, setEditDeductions] = useState(false);
  const [savingDed, setSavingDed] = useState(false);
  const [dedError, setDedError] = useState("");

  const { user, attendance, payroll, cases } = record;
  const wDays = workingDaysInMonth(month);
  const perDay = wDays > 0 && user.basicSalary > 0 ? Math.round(user.basicSalary / wDays) : 0;

  // Authoritative values from payroll record if it exists; compute otherwise
  const lopDeduction = payroll ? payroll.lopDeduction : calcLop(user.basicSalary, attendance.present, attendance.halfDay, 0, month);
  const incentivesTotal = payroll ? payroll.incentives.reduce((s, i) => s + i.amount, 0) : 0;
  const addlDeductionsTotal = payroll ? (payroll.additionalDeductions ?? []).reduce((s, d) => s + d.amount, 0) : 0;
  const reimbTotal = payroll ? payroll.reimbursementTotal : 0;
  const netPay = payroll
    ? payroll.netPay
    : Math.max(0, user.basicSalary - lopDeduction);
  const isPaid = payroll?.status === "paid";

  useEffect(() => {
    if (!open) return;
    setDetailLoading(true);
    Promise.all([
      attendanceApi.list({ userId: user._id, month, limit: 31 }),
      leavesApi.list({ userId: user._id, month, limit: 20 }),
      leavesApi.balance(user._id),
      claimsApi.list({ userId: user._id, month, status: "approved", limit: 20 } as any),
    ])
      .then(([att, lv, bal, cl]) => {
        setAttRecords(att.data.records);
        setLeaves(lv.data.leaves);
        setBalance(bal.data);
        setClaims(cl.data.claims);
        setIncentives(payroll?.incentives ?? []);
        setDeductions((payroll as any)?.additionalDeductions ?? []);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [open, user._id, month, payroll]);

  async function syncPayroll() {
    setSyncing(true);
    try {
      await payrollApi.generateForUser(user._id, month);
      onRefresh();
    } catch { /* non-fatal */ }
    finally { setSyncing(false); }
  }

  async function saveAdjustments(type: "incentives" | "deductions") {
    const isSavingInc = type === "incentives";
    if (isSavingInc) { setSavingInc(true); setIncError(""); }
    else { setSavingDed(true); setDedError(""); }
    try {
      let pid = payroll?._id;
      if (!pid) { const r = await payrollApi.generate({ userId: user._id, month }); pid = r.data._id; }
      const body = isSavingInc ? { incentives } : { additionalDeductions: deductions };
      await payrollApi.update(pid, body as any);
      if (isSavingInc) setEditIncentives(false);
      else setEditDeductions(false);
      onRefresh();
    } catch (e: any) {
      if (isSavingInc) setIncError(e.message ?? "Failed");
      else setDedError(e.message ?? "Failed");
    } finally {
      if (isSavingInc) setSavingInc(false);
      else setSavingDed(false);
    }
  }

  const approvedLeaves = leaves.filter(
    (l) => l.status === "approved" &&
      (l.startDate.slice(0, 7) === month || l.endDate.slice(0, 7) === month)
  );
  const claimsTotal = claims.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="card overflow-hidden">
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="size-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-muted transition-colors shrink-0"
        >
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>

        {/* Avatar */}
        <div className="size-9 rounded-xl bg-primary/10 grid place-items-center font-bold text-primary text-sm shrink-0">
          {user.firstName[0]}{user.lastName[0]}
        </div>

        {/* Name + attendance chips */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{user.firstName} {user.lastName}</p>
            {user.employeeCode && (
              <span className="text-[10px] font-mono text-muted bg-surface-2 px-1.5 py-0.5 rounded">{user.employeeCode}</span>
            )}
            <span className="text-[10px] text-muted capitalize bg-surface-2 px-1.5 py-0.5 rounded">{user.role.replace(/_/g, " ")}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-green-600 font-medium">{attendance.present}P</span>
            {attendance.halfDay > 0 && <span className="text-[11px] text-blue-600 font-medium">{attendance.halfDay}HD</span>}
            <span className="text-[11px] text-purple-600 font-medium">{attendance.onLeave}L</span>
            <span className={`text-[11px] font-medium ${attendance.absent > 0 ? "text-red-500" : "text-muted"}`}>{attendance.absent}A</span>
            {lopDeduction > 0 && <span className="text-[11px] text-red-500 font-medium">· −{fmt(lopDeduction)}</span>}
            {incentivesTotal > 0 && <span className="text-[11px] text-green-600 font-medium">· +{fmt(incentivesTotal)} bonus</span>}
            {addlDeductionsTotal > 0 && <span className="text-[11px] text-red-400 font-medium">· −{fmt(addlDeductionsTotal)} extra</span>}
          </div>
        </div>

        {/* Salary summary — desktop */}
        <div className="hidden md:flex items-center gap-4 shrink-0 text-center">
          <div>
            <p className="text-xs font-bold">{fmt(user.basicSalary)}</p>
            <p className="text-[10px] text-muted">Basic</p>
          </div>
          <div>
            <p className={`text-xs font-bold ${lopDeduction > 0 ? "text-red-500" : "text-muted"}`}>
              {lopDeduction > 0 ? `−${fmt(lopDeduction)}` : "—"}
            </p>
            <p className="text-[10px] text-muted">Deduction</p>
          </div>
          {incentivesTotal > 0 && (
            <div>
              <p className="text-xs font-bold text-green-600">+{fmt(incentivesTotal)}</p>
              <p className="text-[10px] text-muted">Incentive</p>
            </div>
          )}
          {reimbTotal > 0 && (
            <div>
              <p className="text-xs font-bold text-blue-600">+{fmt(reimbTotal)}</p>
              <p className="text-[10px] text-muted">Reimb.</p>
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-primary">{fmt(netPay)}</p>
            <p className="text-[10px] text-muted">Net Pay</p>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 ml-1 flex items-center gap-2">
          {/* Sync button — regenerates payroll to pick up latest attendance/reimbursements */}
          <button
            onClick={syncing ? undefined : syncPayroll}
            title="Sync payroll (recalculates with latest attendance & reimbursements)"
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-2 hover:text-primary transition-colors"
          >
            <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          </button>

          {isPaid ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-green-50 text-green-700 border border-green-200">
                <CheckCircle2 className="size-3.5" /> Paid
              </span>
              {payroll?.paidAt && (
                <span className="text-[10px] text-muted">
                  {new Date(payroll.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          ) : (
            <Button
              variant="primary" size="sm"
              onClick={() => onMarkPaid(netPay)}
              className="gap-1.5 text-xs !px-3"
              disabled={user.basicSalary === 0 && reimbTotal === 0}
            >
              <IndianRupee className="size-3.5" /> Mark Paid
            </Button>
          )}
        </div>
      </div>

      {/* ── Expanded ── */}
      {open && (
        <div className="border-t border-border px-4 pb-5 pt-4">
          {detailLoading ? (
            <p className="text-xs text-muted py-6 text-center">Loading details…</p>
          ) : (
            <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">

              {/* ── LEFT: Calendar + Attendance chips only ── */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                  <CalendarDays className="size-3" /> Attendance — {fmtMonth(month)}
                </p>
                <MiniCalendar month={month} records={attRecords} leaves={leaves} />

                {/* Attendance stat chips */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    ["Working",  wDays,               ""],
                    ["Present",  attendance.present,   "text-green-600"],
                    ["Half Day", attendance.halfDay,   "text-blue-500"],
                    ["On Leave", attendance.onLeave,   "text-purple-600"],
                    ["Absent",   attendance.absent,    "text-red-600"],
                    ["Per Day",  user.basicSalary > 0 ? fmt(perDay) : "—", "text-muted"],
                  ] as [string, number | string, string][]).map(([l, v, c]) => (
                    <div key={l} className="text-center border border-border rounded-lg py-2 px-1">
                      <p className={`font-bold text-sm ${c}`}>{v}</p>
                      <p className="text-muted text-[10px]">{l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── RIGHT: Salary + Cases + Leaves + Reimbursements + Incentives + Deductions ── */}
              <div className="space-y-4">

                {/* Salary breakdown */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                    <TrendingDown className="size-3" /> Salary Breakdown
                    {payroll && <span className="ml-auto text-[10px] font-normal text-green-600 normal-case tracking-normal">✓ synced</span>}
                  </p>
                  <div className="rounded-xl border border-border bg-surface-2/40 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-muted">
                      <span>Basic Salary</span>
                      <span className="font-mono">{fmt(user.basicSalary)}</span>
                    </div>
                    {wDays > 0 && user.basicSalary > 0 && (
                      <div className="flex justify-between text-xs text-muted/60">
                        <span>{wDays} working days · {fmt(perDay)}/day</span>
                      </div>
                    )}
                    {/* LOP — single authoritative line; split only when no payroll record yet */}
                    {payroll ? (
                      lopDeduction > 0 && (
                        <div className="flex justify-between text-xs text-red-600">
                          <span>Loss of Pay ({attendance.absent}A{attendance.halfDay > 0 ? ` + ${attendance.halfDay}HD` : ""})</span>
                          <span>−{fmt(lopDeduction)}</span>
                        </div>
                      )
                    ) : (
                      <>
                        {attendance.absent > 0 && perDay > 0 && (
                          <div className="flex justify-between text-xs text-red-600">
                            <span>Absent × {attendance.absent}d</span>
                            <span>~−{fmt(Math.round(perDay * attendance.absent))}</span>
                          </div>
                        )}
                        {attendance.halfDay > 0 && perDay > 0 && (
                          <div className="flex justify-between text-xs text-orange-600">
                            <span>Half Day × {attendance.halfDay} (×0.5)</span>
                            <span>~−{fmt(Math.round(perDay * attendance.halfDay * 0.5))}</span>
                          </div>
                        )}
                      </>
                    )}
                    {incentivesTotal > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Incentives / Bonuses</span>
                        <span>+{fmt(incentivesTotal)}</span>
                      </div>
                    )}
                    {reimbTotal > 0 && (
                      <div className="flex justify-between text-xs text-blue-600">
                        <span>Reimbursements</span>
                        <span>+{fmt(reimbTotal)}</span>
                      </div>
                    )}
                    {addlDeductionsTotal > 0 && (
                      <div className="flex justify-between text-xs text-red-500">
                        <span>Additional Deductions</span>
                        <span>−{fmt(addlDeductionsTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                      <span>Net Pay</span>
                      <span className="text-primary font-mono">{fmt(netPay)}</span>
                    </div>
                  </div>
                </div>

                {/* Cases summary — compact 4-chip row */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                    <Briefcase className="size-3" /> Cases Summary
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      ["Total",       cases.total,      "text-foreground",  Briefcase   ],
                      ["In Progress", cases.inProgress, "text-blue-600",    TrendingUp  ],
                      ["Disbursed",   cases.disbursed,  "text-green-600",   CheckCircle2],
                      ["Rejected",    cases.rejected,   "text-red-500",     TrendingDown],
                    ] as [string, number, string, any][]).map(([label, val, color, Icon]) => (
                      <div key={label} className="rounded-xl border border-border py-2.5 px-2 flex flex-col items-center gap-1">
                        <Icon className={`size-3.5 ${color}`} />
                        <p className={`text-base font-bold leading-none ${color}`}>{val}</p>
                        <p className="text-[9px] text-muted text-center leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Leave balance */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                    <Palmtree className="size-3" /> Leave Balance
                  </p>
                  {balance ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-border p-3 text-center">
                          <p className="text-base font-bold text-blue-600">{balance.annualLeaveQuota}</p>
                          <p className="text-[10px] text-muted">Annual</p>
                        </div>
                        <div className="rounded-xl border border-border p-3 text-center">
                          <p className="text-base font-bold text-orange-500">{balance.usedPaidDays}</p>
                          <p className="text-[10px] text-muted">Used</p>
                        </div>
                        <div className="rounded-xl border border-border p-3 text-center">
                          <p className="text-base font-bold text-green-600">{balance.leaveBalance}</p>
                          <p className="text-[10px] text-muted">Balance</p>
                        </div>
                      </div>
                      {balance.pendingCount > 0 && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                          <AlertCircle className="size-3.5 shrink-0" />
                          {balance.pendingCount} leave request{balance.pendingCount !== 1 ? "s" : ""} pending
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted">No leave balance data.</p>
                  )}
                </div>

                {/* Approved leaves this month */}
                {approvedLeaves.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Leaves This Month</p>
                    <div className="space-y-1.5">
                      {approvedLeaves.map((l) => (
                        <div key={l._id} className="flex items-center gap-2 text-xs bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                          <span className="size-2 rounded-full bg-purple-400 shrink-0" />
                          <span className="font-medium capitalize">{l.type} Leave</span>
                          <span className="text-muted">
                            {l.startDate.slice(0, 10)}
                            {l.startDate.slice(0, 10) !== l.endDate.slice(0, 10) && ` → ${l.endDate.slice(0, 10)}`}
                          </span>
                          <span className="ml-auto font-medium text-purple-700">{l.totalDays}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reimbursements */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2 flex items-center gap-1.5">
                    <Receipt className="size-3" /> Reimbursements (Approved)
                  </p>
                  {claims.length === 0 ? (
                    <p className="text-xs text-muted">No approved claims this month.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {claims.map((c) => (
                        <div key={c._id} className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <span className="size-2 rounded-full bg-blue-400 shrink-0" />
                          <span className="font-medium capitalize">{c.type}</span>
                          <span className="text-muted truncate max-w-[110px]">{c.description}</span>
                          <span className="ml-auto font-bold text-blue-700">{fmt(c.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5 px-1">
                        <span className="text-muted">Total</span>
                        <span className="text-blue-700">{fmt(claimsTotal)}</span>
                      </div>
                      {payroll && Math.abs(payroll.reimbursementTotal - claimsTotal) > 1 && (
                        <p className="text-[11px] text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                          <RefreshCw className="size-3 shrink-0" />
                          Payroll was generated before this reimbursement — click ↺ Sync to update net pay.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Incentives ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                      <Gift className="size-3" /> Incentives / Bonuses
                    </p>
                    {!editIncentives && !isPaid && (
                      <button
                        onClick={() => { setEditIncentives(true); setIncentives(payroll?.incentives ?? []); }}
                        className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
                      >
                        <Plus className="size-3" /> Add / Edit
                      </button>
                    )}
                  </div>

                  {editIncentives ? (
                    <div className="space-y-3">
                      <EditableAdjustmentList
                        items={incentives}
                        onChange={setIncentives}
                        addLabel="Add Incentive"
                      />
                      {incError && <p className="text-xs text-red-600">{incError}</p>}
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setEditIncentives(false); setIncError(""); }}>Cancel</Button>
                        <Button variant="primary" size="sm" className="flex-1" loading={savingInc} onClick={() => saveAdjustments("incentives")}>Save</Button>
                      </div>
                    </div>
                  ) : (payroll?.incentives ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No incentives this month.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(payroll?.incentives ?? []).map((inc, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                          <span className="size-2 rounded-full bg-green-500 shrink-0" />
                          <span className="font-medium">{inc.reason}</span>
                          <span className="ml-auto font-bold text-green-700">+{fmt(inc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Additional Deductions ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                      <MinusCircle className="size-3" /> Additional Deductions
                    </p>
                    {!editDeductions && !isPaid && (
                      <button
                        onClick={() => { setEditDeductions(true); setDeductions((payroll as any)?.additionalDeductions ?? []); }}
                        className="text-xs font-semibold text-red-600 hover:text-red-700 inline-flex items-center gap-1"
                      >
                        <Plus className="size-3" /> Add / Edit
                      </button>
                    )}
                  </div>

                  {editDeductions ? (
                    <div className="space-y-3">
                      <EditableAdjustmentList
                        items={deductions}
                        onChange={setDeductions}
                        addLabel="Add Deduction"
                      />
                      {dedError && <p className="text-xs text-red-600">{dedError}</p>}
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1" onClick={() => { setEditDeductions(false); setDedError(""); }}>Cancel</Button>
                        <Button variant="primary" size="sm" className="flex-1" loading={savingDed} onClick={() => saveAdjustments("deductions")}>Save</Button>
                      </div>
                    </div>
                  ) : ((payroll as any)?.additionalDeductions ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No additional deductions.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {((payroll as any)?.additionalDeductions ?? []).map((d: AdditionalDeduction, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <span className="size-2 rounded-full bg-red-400 shrink-0" />
                          <span className="font-medium">{d.reason}</span>
                          <span className="ml-auto font-bold text-red-600">−{fmt(d.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-semibold border-t border-border pt-1.5 px-1">
                        <span className="text-muted">Total Deducted</span>
                        <span className="text-red-600">−{fmt(addlDeductionsTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const [overview, setOverview] = useState<UserPayrollOverview[]>([]);
  const [month, setMonth] = useState(nowMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markPaidTarget, setMarkPaidTarget] = useState<{ record: UserPayrollOverview; netPay: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await payrollApi.overview(month); setOverview(r.data); }
    catch { setError("Failed to load payroll data"); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const totalBasic = overview.reduce((s, r) => s + r.user.basicSalary, 0);
  const totalDeduction = overview.reduce((s, r) =>
    s + (r.payroll ? r.payroll.lopDeduction : calcLop(r.user.basicSalary, r.attendance.present, r.attendance.halfDay, 0, month)), 0);
  const totalNet = overview.reduce((s, r) =>
    s + (r.payroll ? r.payroll.netPay : Math.max(0, r.user.basicSalary - calcLop(r.user.basicSalary, r.attendance.present, r.attendance.halfDay, 0, month))), 0);
  const paidCount = overview.filter((r) => r.payroll?.status === "paid").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Payroll</h1>
        <p className="text-sm text-muted mt-0.5">
          Salary overview · attendance deductions · incentives · reimbursements · cases
        </p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <AttendancePanel month={month} onDone={load} />

      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth(prevMonth(month))}
          className="size-9 flex items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-2 transition-colors">
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="font-semibold text-base">{fmtMonth(month)}</p>
          {month === nowMonth() && <p className="text-xs text-primary font-medium">Current Month</p>}
        </div>
        <button onClick={() => setMonth(nextMonth(month))} disabled={month >= nowMonth()}
          className="size-9 flex items-center justify-center rounded-xl border border-border text-muted hover:bg-surface-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted flex items-center gap-1.5"><Users className="size-3" /> Total Staff</p>
          <p className="text-2xl font-bold mt-1">{overview.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted flex items-center gap-1.5"><IndianRupee className="size-3" /> Total Basic</p>
          <p className="text-xl font-bold mt-1">{fmt(totalBasic)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted flex items-center gap-1.5"><TrendingDown className="size-3" /> Deductions</p>
          <p className={`text-xl font-bold mt-1 ${totalDeduction > 0 ? "text-red-500" : "text-muted"}`}>
            {totalDeduction > 0 ? `−${fmt(totalDeduction)}` : "₹0"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted flex items-center gap-1.5"><CheckCircle2 className="size-3" /> Net Payable</p>
          <p className="text-xl font-bold mt-1 text-primary">{fmt(totalNet)}</p>
        </div>
      </div>

      {/* Payment progress */}
      {overview.length > 0 && (
        <div className="card p-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted">Payments made this month</span>
              <span className="font-semibold">{paidCount} / {overview.length} paid</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${(paidCount / overview.length) * 100}%` }} />
            </div>
          </div>
          {paidCount === overview.length && <CheckCircle2 className="size-5 text-green-500 shrink-0" />}
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="p-10 text-center text-sm text-muted">Loading payroll data…</div>
      ) : overview.length === 0 ? (
        <div className="card p-10 text-center">
          <Users className="size-10 text-muted/40 mx-auto mb-3" />
          <p className="text-sm text-muted">No active staff found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {overview.map((record) => (
            <EmployeeCard
              key={record.user._id}
              record={record}
              month={month}
              onMarkPaid={(netPay) => setMarkPaidTarget({ record, netPay })}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {markPaidTarget && (
        <MarkPaidModal
          record={markPaidTarget.record}
          month={month}
          netPay={markPaidTarget.netPay}
          onClose={() => setMarkPaidTarget(null)}
          onDone={() => { setMarkPaidTarget(null); load(); }}
        />
      )}
    </div>
  );
}
