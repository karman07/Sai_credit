"use client";

import { useState, useCallback } from "react";
import {
  BarChart3, Download, IndianRupee, ShieldCheck, Building2,
  TrendingUp, AlertCircle, RefreshCw,
} from "lucide-react";
import {
  Button, Badge, Input, Label, SectionHeader, Pagination,
  EmptyState, Skeleton, useToast, type BadgeTone,
} from "../../../components/ui";
import {
  casesApi, payoutApi, insuranceApi, ApiError,
  type LoanCase, type PayoutRecord, type InsuranceMIS,
} from "../../../lib/api";

interface ReportType {
  id: string; title: string; description: string;
  icon: React.ElementType; accent: string;
}

const REPORT_TYPES: ReportType[] = [
  { id: "disbursement", title: "Disbursement Report",   description: "All disbursed loans by bank, product, and dealer",  icon: IndianRupee, accent: "text-success"  },
  { id: "rejection",    title: "Rejection Analysis",    description: "Rejected case breakdown with reason classification", icon: TrendingUp,  accent: "text-danger"   },
  { id: "payout",       title: "Payout Reconciliation", description: "Commission vs received payout matching",             icon: BarChart3,   accent: "text-primary"  },
  { id: "insurance",    title: "Insurance Expiry",      description: "Upcoming and expired insurance policy list",         icon: ShieldCheck, accent: "text-warning"  },
  { id: "bank",         title: "Bank Performance",      description: "Volume and approval rate per lending partner",       icon: Building2,   accent: "text-info"     },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtAmt = (n?: number) => (n ? `₹${n.toLocaleString("en-IN")}` : "—");
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const daysDiff = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

function inRange(dateStr: string | undefined, from: string, to: string) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

function downloadCSV(headers: string[], rows: (string | number)[][], filename: string) {
  const lines = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "danger" | "warning" | "neutral" }) {
  const accent = tone === "success" ? "border-l-success" : tone === "danger" ? "border-l-danger" : tone === "warning" ? "border-l-warning" : "border-l-primary";
  return (
    <div className={`card p-4 border-l-4 ${accent}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Report data union ─────────────────────────────────────────────────────────

type BankRow = { bank: string; total: number; approved: number; disbursed: number; rejected: number; pct: number };

type ReportData =
  | { type: "disbursement"; cases: LoanCase[] }
  | { type: "rejection";    cases: LoanCase[] }
  | { type: "payout";       records: PayoutRecord[] }
  | { type: "insurance";    records: InsuranceMIS[] }
  | { type: "bank";         rows: BankRow[] };

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ReportsPage() {
  const [selected, setSelected]   = useState<string | null>(null);
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dateTo, setDateTo]       = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [data, setData]           = useState<ReportData | null>(null);
  const [page, setPage]           = useState(1);
  const toast                     = useToast();

  const generate = useCallback(async () => {
    if (!selected) return;
    setLoading(true); setError(null); setData(null); setPage(1);
    try {
      if (selected === "disbursement") {
        const { data: cases } = await casesApi.list({ status: "Disbursed", limit: 500, showAll: true });
        setData({ type: "disbursement", cases: cases.filter((c) => inRange(c.disbursementDate, dateFrom, dateTo)) });

      } else if (selected === "rejection") {
        const { data: cases } = await casesApi.list({ status: "Rejected", limit: 500, showAll: true });
        setData({ type: "rejection", cases: cases.filter((c) => inRange(c.createdAt, dateFrom, dateTo)) });

      } else if (selected === "payout") {
        const { data: records } = await payoutApi.list();
        const fromM = dateFrom.slice(0, 7), toM = dateTo.slice(0, 7);
        setData({ type: "payout", records: records.filter((r) => r.businessMonth >= fromM && r.businessMonth <= toM) });

      } else if (selected === "insurance") {
        const { data: records } = await insuranceApi.list();
        setData({ type: "insurance", records: records.filter((r) => inRange(r.endDate, dateFrom, dateTo)) });

      } else if (selected === "bank") {
        const { data: cases } = await casesApi.list({ limit: 1000, showAll: true });
        const filtered = cases.filter((c) => inRange(c.createdAt, dateFrom, dateTo));
        const map = new Map<string, BankRow>();
        for (const c of filtered) {
          const bank = c.bankName?.trim() || "Unknown";
          if (bank === "Unknown") continue;
          const row = map.get(bank) ?? { bank, total: 0, approved: 0, disbursed: 0, rejected: 0, pct: 0 };
          row.total++;
          if (c.status === "Approved") row.approved++;
          if (c.status === "Disbursed") row.disbursed++;
          if (c.status === "Rejected") row.rejected++;
          map.set(bank, row);
        }
        const rows = Array.from(map.values())
          .map((r) => ({ ...r, pct: r.total > 0 ? Math.round(((r.approved + r.disbursed) / r.total) * 100) : 0 }))
          .sort((a, b) => b.total - a.total);
        setData({ type: "bank", rows });
      }
    } catch (e: any) {
      const isAuth = e instanceof ApiError && e.status === 401;
      setError(isAuth
        ? "Session expired. Please refresh the page or log in again."
        : (e.message ?? "Failed to generate report"),
      );
    } finally {
      setLoading(false);
    }
  }, [selected, dateFrom, dateTo]);

  const exportCSV = () => {
    if (!data) return;
    const rt = REPORT_TYPES.find((r) => r.id === selected)!;
    const fname = `${rt.id}-${dateFrom}-to-${dateTo}.csv`;

    if (data.type === "disbursement") {
      downloadCSV(
        ["Case ID", "Customer", "Bank", "Product", "Loan Amount", "Disbursement Date"],
        data.cases.map((c) => [c.caseCode, `${c.customer.firstName} ${c.customer.lastName}`, c.bankName ?? "", c.product ?? "", c.loanAmount ?? 0, fmtDate(c.disbursementDate)]),
        fname,
      );
    } else if (data.type === "rejection") {
      downloadCSV(
        ["Case ID", "Customer", "Bank", "Product", "Remarks", "Date"],
        data.cases.map((c) => [c.caseCode, `${c.customer.firstName} ${c.customer.lastName}`, c.bankName ?? "", c.product ?? "", c.remarks ?? "", fmtDate(c.createdAt)]),
        fname,
      );
    } else if (data.type === "payout") {
      downloadCSV(
        ["Bank", "Month", "Invoice Amt", "Commission", "Total Amt", "Invoice Status", "Payout Status"],
        data.records.map((r) => [r.bankName ?? "", r.businessMonth, r.invoiceAmount, r.commission, r.totalAmount, r.invoiceStatus, r.payoutStatus]),
        fname,
      );
    } else if (data.type === "insurance") {
      downloadCSV(
        ["Case ID", "Customer", "Insurer", "Policy", "End Date", "Days Left", "Owner"],
        data.records.map((r) => [r.caseCode ?? "", r.customerName ?? "", r.insurer, r.policyName ?? "", fmtDate(r.endDate), daysDiff(r.endDate), r.ownerType]),
        fname,
      );
    } else if (data.type === "bank") {
      downloadCSV(
        ["Bank", "Total Cases", "Approved", "Disbursed", "Rejected", "Approval %"],
        data.rows.map((r) => [r.bank, r.total, r.approved, r.disbursed, r.rejected, `${r.pct}%`]),
        fname,
      );
    }
    toast("success", "CSV exported successfully");
  };

  // ── Summary stats ───────────────────────────────────────────────────────────

  const renderStats = () => {
    if (!data) return null;

    if (data.type === "disbursement") {
      const total = data.cases.reduce((s, c) => s + (c.loanAmount ?? 0), 0);
      const avg   = data.cases.length ? total / data.cases.length : 0;
      const banks = new Set(data.cases.map((c) => c.bankName).filter(Boolean)).size;
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Cases Disbursed"  value={String(data.cases.length)} tone="success" />
          <StatCard label="Total Amount"     value={fmtAmt(total)} tone="success" />
          <StatCard label="Avg Loan Amount"  value={fmtAmt(Math.round(avg))} />
          <StatCard label="Banks Involved"   value={String(banks)} />
        </div>
      );
    }

    if (data.type === "rejection") {
      const banks   = new Set(data.cases.map((c) => c.bankName).filter(Boolean)).size;
      const prodMap = data.cases.reduce<Record<string, number>>((acc, c) => {
        if (c.product) acc[c.product] = (acc[c.product] ?? 0) + 1;
        return acc;
      }, {});
      const [topProd, topCount] = Object.entries(prodMap).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Cases Rejected"       value={String(data.cases.length)} tone="danger" />
          <StatCard label="Banks"                value={String(banks)} />
          <StatCard label="Top Rejected Product" value={topProd} sub={topCount ? `${topCount} cases` : undefined} tone="warning" />
        </div>
      );
    }

    if (data.type === "payout") {
      const invoiced = data.records.reduce((s, r) => s + (r.invoiceAmount ?? 0), 0);
      const received = data.records.filter((r) => r.payoutStatus === "Received").reduce((s, r) => s + (r.totalAmount ?? 0), 0);
      const pending  = invoiced - received;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Total Invoiced" value={fmtAmt(invoiced)} />
          <StatCard label="Received"       value={fmtAmt(received)} tone="success" />
          <StatCard label="Pending"        value={fmtAmt(Math.max(0, pending))} tone={pending > 0 ? "warning" : "neutral"} />
        </div>
      );
    }

    if (data.type === "insurance") {
      const expired = data.records.filter((r) => daysDiff(r.endDate) < 0).length;
      const soon    = data.records.filter((r) => { const d = daysDiff(r.endDate); return d >= 0 && d <= 30; }).length;
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Total Policies"    value={String(data.records.length)} />
          <StatCard label="Expired"           value={String(expired)}  tone="danger"   />
          <StatCard label="Expiring ≤ 30 Days" value={String(soon)} tone="warning" />
        </div>
      );
    }

    if (data.type === "bank") {
      const totalCases = data.rows.reduce((s, r) => s + r.total, 0);
      const best = [...data.rows].sort((a, b) => b.pct - a.pct)[0];
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard label="Total Cases"       value={String(totalCases)} />
          <StatCard label="Banks Tracked"     value={String(data.rows.length)} />
          <StatCard label="Best Approval Rate" value={best ? `${best.pct}%` : "—"} sub={best?.bank} tone="success" />
        </div>
      );
    }
    return null;
  };

  // ── Table ───────────────────────────────────────────────────────────────────

  const paginate = <T,>(arr: T[]) => arr.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = (n: number) => Math.max(1, Math.ceil(n / PAGE_SIZE));

  const INVOICE_TONE: Record<string, BadgeTone> = { Draft: "neutral", Sent: "info", Paid: "success" };
  const PAYOUT_TONE:  Record<string, BadgeTone> = { Received: "success", Pending: "warning", "Not Received": "danger" };

  const renderTable = () => {
    if (!data) return null;

    if (data.type === "disbursement") {
      const rows = paginate(data.cases);
      return (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Case ID</th><th>Customer</th><th>Bank</th><th>Product</th><th>Loan Amount</th><th>Disbursement Date</th>
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                    <td className="font-medium">{c.customer.firstName} {c.customer.lastName}</td>
                    <td>{c.bankName ?? "—"}</td>
                    <td>{c.product ?? "—"}</td>
                    <td className="font-semibold tabular-nums">{fmtAmt(c.loanAmount)}</td>
                    <td className="tabular-nums">{fmtDate(c.disbursementDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages(data.cases.length)} total={data.cases.length} limit={PAGE_SIZE} onPage={setPage} onLimit={() => {}} />
        </>
      );
    }

    if (data.type === "rejection") {
      const rows = paginate(data.cases);
      return (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Case ID</th><th>Customer</th><th>Bank</th><th>Product</th><th>Remarks / Reason</th><th>Date</th>
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                    <td className="font-medium">{c.customer.firstName} {c.customer.lastName}</td>
                    <td>{c.bankName ?? "—"}</td>
                    <td>{c.product ?? "—"}</td>
                    <td className="text-sm text-muted max-w-xs truncate">{c.remarks || "—"}</td>
                    <td className="tabular-nums">{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages(data.cases.length)} total={data.cases.length} limit={PAGE_SIZE} onPage={setPage} onLimit={() => {}} />
        </>
      );
    }

    if (data.type === "payout") {
      const rows = paginate(data.records);
      return (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Bank</th><th>Month</th><th>Invoice Amt</th><th>Commission</th><th>Total Amt</th><th>Invoice Status</th><th>Payout Status</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="font-semibold">{r.bankName ?? "—"}</td>
                    <td className="tabular-nums">{r.businessMonth}</td>
                    <td className="tabular-nums">{fmtAmt(r.invoiceAmount)}</td>
                    <td className="tabular-nums">{fmtAmt(r.commission)}</td>
                    <td className="font-semibold tabular-nums">{fmtAmt(r.totalAmount)}</td>
                    <td><Badge tone={INVOICE_TONE[r.invoiceStatus] ?? "neutral"}>{r.invoiceStatus}</Badge></td>
                    <td><Badge tone={PAYOUT_TONE[r.payoutStatus]  ?? "neutral"}>{r.payoutStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages(data.records.length)} total={data.records.length} limit={PAGE_SIZE} onPage={setPage} onLimit={() => {}} />
        </>
      );
    }

    if (data.type === "insurance") {
      const rows = paginate(data.records);
      return (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Case ID</th><th>Customer</th><th>Insurer</th><th>Policy</th><th>End Date</th><th>Status</th><th>Owner</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const days  = daysDiff(r.endDate);
                  const tone: BadgeTone = days < 0 ? "danger" : days <= 7 ? "warning" : "success";
                  const label = days < 0 ? "Expired" : days === 0 ? "Today" : `${days}d left`;
                  return (
                    <tr key={r._id}>
                      <td className="font-mono text-xs text-primary font-semibold">{r.caseCode ?? "—"}</td>
                      <td className="font-medium">{r.customerName ?? "—"}</td>
                      <td>{r.insurer}</td>
                      <td>{r.policyName ?? "—"}</td>
                      <td className="tabular-nums">{fmtDate(r.endDate)}</td>
                      <td><Badge tone={tone}>{label}</Badge></td>
                      <td>{r.ownerType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages(data.records.length)} total={data.records.length} limit={PAGE_SIZE} onPage={setPage} onLimit={() => {}} />
        </>
      );
    }

    if (data.type === "bank") {
      const rows = paginate(data.rows);
      return (
        <>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr>
                <th>Bank</th><th>Total Cases</th><th>Approved</th><th>Disbursed</th><th>Rejected</th><th>Approval %</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const tone: BadgeTone = r.pct >= 80 ? "success" : r.pct >= 60 ? "warning" : "danger";
                  return (
                    <tr key={r.bank}>
                      <td className="font-semibold">{r.bank}</td>
                      <td className="tabular-nums">{r.total}</td>
                      <td className="tabular-nums">{r.approved}</td>
                      <td className="tabular-nums">{r.disbursed}</td>
                      <td className="tabular-nums">{r.rejected}</td>
                      <td><Badge tone={tone}>{r.pct}%</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages(data.rows.length)} total={data.rows.length} limit={PAGE_SIZE} onPage={setPage} onLimit={() => {}} />
        </>
      );
    }
    return null;
  };

  const totalRecords = !data ? 0
    : data.type === "bank" ? data.rows.length
    : data.type === "payout" || data.type === "insurance" ? data.records.length
    : data.cases.length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <SectionHeader
        title="Reports"
        description="Generate and export reports for compliance, analysis, and performance review"
      />

      {/* Report type selector */}
      <div>
        <p className="text-sm font-semibold mb-3">Select Report Type</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelected(r.id); setData(null); setError(null); }}
              className={`card p-4 text-left transition-all hover:shadow-md ${
                selected === r.id
                  ? "border-primary bg-primary-subtle ring-1 ring-primary"
                  : "hover:border-primary/40"
              }`}
            >
              <r.icon className={`size-5 mb-2 ${r.accent}`} />
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-xs text-muted mt-1 leading-relaxed">{r.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters + actions */}
      {selected && (
        <div className="card px-5 py-4 flex items-center gap-3 flex-wrap animate-fadeIn">
          {/* Date range group */}
          <div className="flex items-center gap-0 rounded-md border border-border overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface border-r border-border">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">From</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="!border-0 !shadow-none !ring-0 !bg-transparent w-36 text-sm font-medium p-0 h-auto"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-surface">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">To</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="!border-0 !shadow-none !ring-0 !bg-transparent w-36 text-sm font-medium p-0 h-auto"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={generate} loading={loading}>
              <BarChart3 className="size-3.5" /> Generate
            </Button>
            {data && !loading && (
              <Button variant="secondary" onClick={exportCSV}>
                <Download className="size-3.5" /> Export CSV
              </Button>
            )}
          </div>

          {data && !loading && (
            <span className="ml-auto text-xs text-muted tabular-nums">
              {totalRecords} record{totalRecords !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex gap-3 items-center">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
            <div className="p-4 space-y-2.5">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="card flex items-start gap-3 border-danger/40 bg-danger/5 animate-fadeIn">
          <AlertCircle className="size-5 text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Failed to generate report</p>
            <p className="text-xs text-muted mt-0.5">{error}</p>
          </div>
          {error.includes("Session expired") ? (
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="shrink-0">
              <RefreshCw className="size-3.5" /> Reload
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={generate} className="shrink-0">
              <RefreshCw className="size-3.5" /> Retry
            </Button>
          )}
        </div>
      )}

      {/* Summary stats */}
      {!loading && data && renderStats()}

      {/* Results table */}
      {!loading && data && (
        <div className="card p-0 overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold text-sm">
                {REPORT_TYPES.find((r) => r.id === selected)?.title}
              </p>
              <p className="text-xs text-muted">
                {fmtDate(dateFrom)} — {fmtDate(dateTo)} · {totalRecords} record{totalRecords !== 1 ? "s" : ""}
              </p>
            </div>
            <Badge tone="success" dot>Live Data</Badge>
          </div>

          {totalRecords === 0
            ? (
              <EmptyState
                title="No records found"
                description="No data matches the selected date range. Try widening the period."
              />
            )
            : renderTable()
          }
        </div>
      )}

      {/* Initial empty state */}
      {!selected && (
        <div className="card flex items-center justify-center h-32 text-sm text-muted">
          Select a report type above to get started
        </div>
      )}
    </div>
  );
}
