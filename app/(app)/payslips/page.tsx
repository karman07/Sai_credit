"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IndianRupee, FileText, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, Calendar, TrendingDown,
} from "lucide-react";
import { payslipsApi, type PayrollRecord } from "../../../lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft:     "text-yellow-600 bg-yellow-50 border-yellow-200",
  processed: "text-blue-600 bg-blue-50 border-blue-200",
  paid:      "text-green-600 bg-green-50 border-green-200",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function Row({ label, value, bold, red, green }: { label: string; value: string; bold?: boolean; red?: boolean; green?: boolean }) {
  return (
    <div className={`flex justify-between text-sm py-1.5 ${bold ? "font-semibold border-t border-border mt-1 pt-2.5" : ""}`}>
      <span className={bold ? "text-foreground" : "text-muted"}>{label}</span>
      <span className={bold ? (green ? "text-green-600" : "text-foreground") : red ? "text-red-500" : green ? "text-green-600" : "text-foreground"}>{value}</span>
    </div>
  );
}

// ── Paid banner ───────────────────────────────────────────────────────────────

function PaidBanner({ p }: { p: PayrollRecord }) {
  if (p.status !== "paid") return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-green-50 border border-green-200 px-5 py-4 mb-2">
      <div className="size-10 rounded-full bg-green-500 grid place-items-center shrink-0">
        <CheckCircle2 className="size-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-green-800">Salary Credited</p>
        <p className="text-sm text-green-700">
          {fmt(p.netPay)} was credited to your account
          {p.paidAt ? ` on ${new Date(p.paidAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
          {p.remarks ? ` • ${p.remarks}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xl font-bold text-green-700">{fmt(p.netPay)}</p>
        <p className="text-xs text-green-600">Net Pay</p>
      </div>
    </div>
  );
}

// ── Payslip card ──────────────────────────────────────────────────────────────

function PayslipCard({ p }: { p: PayrollRecord }) {
  const [open, setOpen] = useState(false);
  const incentiveTotal   = p.incentives.reduce((s, i) => s + i.amount, 0);
  const dailyWage        = p.workingDaysInMonth > 0 ? p.basicSalary / p.workingDaysInMonth : 0;
  const deductedDays     = p.lwpDays ?? p.absentDays;

  return (
    <div className="card overflow-hidden">
      {/* Paid banner shown inside card */}
      {p.status === "paid" && open && (
        <div className="px-4 pt-4">
          <PaidBanner p={p} />
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-4 px-4 py-4 hover:bg-surface-2/40 transition-colors text-left"
      >
        <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${p.status === "paid" ? "bg-green-100" : "bg-primary/10"}`}>
          {p.status === "paid"
            ? <CheckCircle2 className="size-5 text-green-600" />
            : <IndianRupee className="size-5 text-primary" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{p.month}</p>
            {p.status === "paid" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-200">Paid</span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {p.presentDays}P · {p.absentDays}A · {p.halfDays}HD
            {deductedDays > 0 && <span className="text-red-500"> · {deductedDays} LWP day{deductedDays !== 1 ? "s" : ""} deducted</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-base">{fmt(p.netPay)}</p>
          <span className={`mt-0.5 inline-block px-2 py-0.5 text-xs font-medium rounded-full border capitalize ${STATUS_COLORS[p.status] ?? ""}`}>
            {p.status}
          </span>
        </div>
        {open ? <ChevronUp className="size-4 text-muted shrink-0" /> : <ChevronDown className="size-4 text-muted shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-5 pt-3 space-y-4">
          {/* Daily wage info */}
          {dailyWage > 0 && (
            <div className="rounded-xl bg-surface-2 px-4 py-2.5 flex items-center gap-3 border border-border">
              <Calendar className="size-4 text-muted shrink-0" />
              <div className="flex-1 text-xs text-muted">
                Daily wage rate: <span className="font-semibold text-foreground">{fmt(dailyWage)}/day</span>
                {" "}({p.workingDaysInMonth} working days this month)
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Earnings */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Earnings</p>
              <Row label="Basic Salary" value={fmt(p.basicSalary)} />
              {([
                ["HRA",              p.hra],
                ["Travel Allowance", p.travelAllowance],
                ["DA (Dearness)",    p.da],
                ["Medical Allowance",p.medicalAllowance],
                ["Other Allowance",  p.otherAllowance],
              ] as [string, number | undefined][]).filter(([, v]) => v && v > 0).map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm py-1.5 pl-3 border-l-2 border-blue-200">
                  <span className="text-blue-600">{l}</span>
                  <span className="text-blue-600 font-mono">+{fmt(v!)}</span>
                </div>
              ))}
              {p.incentives.map((inc, i) => (
                <Row key={i} label={`↑ ${inc.reason}`} value={fmt(inc.amount)} green />
              ))}
              {p.reimbursementTotal > 0 && (
                <Row label="Reimbursements" value={fmt(p.reimbursementTotal)} green />
              )}
              <Row label="Gross Pay" value={fmt(p.grossPay)} bold />
            </div>

            {/* Deductions */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Deductions</p>
              {p.lopDeduction > 0 ? (
                <>
                  <Row
                    label={`Loss of Pay — ${deductedDays} absent day${deductedDays !== 1 ? "s" : ""}`}
                    value={`−${fmt(p.lopDeduction)}`}
                    red
                  />
                  <div className="mt-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-2 flex items-start gap-2">
                    <TrendingDown className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-700">
                      {fmt(dailyWage)} × {deductedDays} absent day{deductedDays !== 1 ? "s" : ""} = {fmt(p.lopDeduction)} deducted
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted py-1">No deductions this month</p>
              )}
              <Row label="Net Pay" value={fmt(p.netPay)} bold green />
            </div>
          </div>

          {/* Attendance breakdown */}
          <div className="border-t border-border pt-3 grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
            {([
              ["Working Days", p.workingDaysInMonth, ""],
              ["Present",      p.presentDays,        "text-green-600"],
              ["Half Days",    p.halfDays,            "text-blue-600"],
              ["Absent/LWP",  deductedDays,           "text-red-500"],
              ["On Leave",    p.leaveDays,             "text-purple-600"],
            ] as [string, number, string][]).map(([label, val, color]) => (
              <div key={label} className="text-center border border-border rounded-lg py-2">
                <p className={`font-bold text-base ${color}`}>{val}</p>
                <p className="text-muted text-[10px]">{label}</p>
              </div>
            ))}
          </div>

          {p.remarks && <p className="text-xs text-muted italic">Remarks: {p.remarks}</p>}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PayslipsPage() {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await payslipsApi.list({ limit: 24 });
      setPayrolls(res.data.payrolls);
      setTotal(res.data.total);
    } catch { setError("Failed to load payslips"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const latest      = payrolls[0];
  const paidSlips   = payrolls.filter((p) => p.status === "paid").length;
  const totalEarned = payrolls.filter((p) => p.status === "paid").reduce((s, p) => s + p.netPay, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">My Payslips</h1>
        <p className="text-sm text-muted mt-0.5">Monthly salary breakdown with attendance & deductions</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Latest paid banner — shown prominently if most recent is paid */}
      {latest?.status === "paid" && !loading && (
        <PaidBanner p={latest} />
      )}

      {/* If latest is not yet paid — show a pending note */}
      {latest && latest.status !== "paid" && !loading && (
        <div className="flex items-center gap-3 rounded-2xl bg-yellow-50 border border-yellow-200 px-5 py-4">
          <Clock className="size-5 text-yellow-600 shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">Salary Pending</p>
            <p className="text-sm text-yellow-700">
              Your {latest.month} salary of {fmt(latest.netPay)} is{" "}
              {latest.status === "processed" ? "processed and awaiting payment" : "being prepared"}.
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      {payrolls.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs text-muted">Latest Net Pay</p>
            <p className="text-2xl font-bold mt-1 text-primary">{fmt(latest?.netPay ?? 0)}</p>
            <p className="text-xs text-muted mt-1">{latest?.month}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">Slips Received</p>
            <p className="text-2xl font-bold mt-1 text-green-600">{paidSlips}</p>
            <p className="text-xs text-muted mt-1">of {total} total</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-muted">Total Earned (YTD)</p>
            <p className="text-xl font-bold mt-1">{fmt(totalEarned)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-muted">Loading payslips…</div>
      ) : payrolls.length === 0 ? (
        <div className="card p-10 text-center">
          <FileText className="size-10 text-muted/40 mx-auto mb-3" />
          <p className="text-sm text-muted">No payslips available yet</p>
          <p className="text-xs text-muted mt-1">Your admin will generate payslips monthly</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payrolls.map((p) => <PayslipCard key={p._id} p={p} />)}
        </div>
      )}
    </div>
  );
}
