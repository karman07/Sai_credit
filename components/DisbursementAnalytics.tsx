"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, IndianRupee, TrendingUp, Layers, Trophy } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Skeleton, cn } from "./ui";
import { CaseFilterPanel, useCaseFacets, type FilterHide } from "./CaseFilterPanel";
import { ExportButton } from "./ExportButton";
import { casesApi, type DisbursedAnalytics, type DisbursedBucket } from "../lib/api";
import { EMPTY_FILTERS, filtersToQuery, type CaseFilters } from "../lib/caseFilters";

const COLORS = ["#6683FF", "#22C55E", "#F59E0B", "#A855F7", "#14B8A6", "#F97316", "#38BDF8", "#EF4444", "#94A3B8", "#EAB308"];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function short(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

// ── Date presets ────────────────────────────────────────────────────

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface Preset { id: string; label: string; range: () => [string, string] }
const PRESETS: Preset[] = [
  { id: "month", label: "This month", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth(), 1)), iso(n)]; } },
  { id: "last-month", label: "Last month", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
  { id: "30d", label: "Last 30 days", range: () => { const n = new Date(); return [iso(new Date(n.getTime() - 29 * 86_400_000)), iso(n)]; } },
  { id: "90d", label: "Last 90 days", range: () => { const n = new Date(); return [iso(new Date(n.getTime() - 89 * 86_400_000)), iso(n)]; } },
  { id: "quarter", label: "This quarter", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)), iso(n)]; } },
  { id: "fy", label: "This FY", range: () => { const n = new Date(); const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1; return [iso(new Date(y, 3, 1)), iso(n)]; } },
  { id: "last-fy", label: "Last FY", range: () => { const n = new Date(); const y = (n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1) - 1; return [iso(new Date(y, 3, 1)), iso(new Date(y + 1, 2, 31))]; } },
  { id: "year", label: "This year", range: () => { const n = new Date(); return [iso(new Date(n.getFullYear(), 0, 1)), iso(n)]; } },
  { id: "all", label: "All time", range: () => ["", ""] },
];

// ── Pieces ──────────────────────────────────────────────────────────

function Kpi({ label, value, sub, icon: Icon, delta }: { label: string; value: string; sub?: string; icon: React.ElementType; delta?: number | null }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <span className="size-7 rounded-md bg-primary/10 text-primary grid place-items-center"><Icon className="size-3.5" /></span>
      </div>
      <p className="text-xl font-bold mt-2 tabular-nums">{value}</p>
      <div className="flex items-center gap-2 mt-0.5 min-h-4">
        {delta !== undefined && delta !== null && (
          <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", delta >= 0 ? "text-success" : "text-danger")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </div>
  );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[150px]">
      {label && <p className="font-semibold mb-1.5 pb-1 border-b border-border">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-4 mt-0.5">
          <span className="text-muted">{p.name}</span>
          <span className="font-bold tabular-nums">{p.dataKey === "count" ? p.value : inr(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const DIMENSIONS: { id: keyof DisbursedAnalytics; label: string; hide?: FilterHide }[] = [
  { id: "byBank", label: "Bank" }, { id: "byDealer", label: "Dealer", hide: "dealerId" }, { id: "byRep", label: "Sales rep", hide: "assignedTo" },
  { id: "byCoordinator", label: "Coordinator", hide: "coordinatorId" }, { id: "byProduct", label: "Product" }, { id: "byFirm", label: "Firm" },
  { id: "byLoanType", label: "Loan type" }, { id: "byState", label: "State" }, { id: "byCity", label: "City" },
];

/**
 * Disbursed-amount analytics built from case data: KPIs with period-over-period growth, trend, bank / product /
 * ticket-size charts, and a breakdown by any dimension — all driven by the same filters as the Cases list
 * (bank, dealer, rep, product, state, amount range, …) plus a disbursement date range.
 */
export function DisbursementAnalytics({ hide = [], title = "Disbursement analytics" }: { hide?: FilterHide[]; title?: string }) {
  const facets = useCaseFacets();
  const [preset, setPreset] = useState("fy");
  const [filters, setFilters] = useState<CaseFilters>(() => {
    const [from, to] = PRESETS.find((p) => p.id === "fy")!.range();
    return { ...EMPTY_FILTERS, disbursedFrom: from, disbursedTo: to };
  });
  const [data, setData] = useState<DisbursedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dim, setDim] = useState<(typeof DIMENSIONS)[number]["id"]>("byBank");
  const [grain, setGrain] = useState<"auto" | "month" | "day">("auto");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    casesApi.disbursedAnalytics(filtersToQuery(filters))
      .then(({ data }) => { if (alive) setData(data); })
      .catch((e) => { if (alive) setError(e?.message ?? "Failed to load analytics"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filters]);

  function pickPreset(p: Preset) {
    const [from, to] = p.range();
    setPreset(p.id);
    setFilters((f) => ({ ...f, disbursedFrom: from, disbursedTo: to }));
  }

  const spanDays = filters.disbursedFrom && filters.disbursedTo
    ? (new Date(filters.disbursedTo).getTime() - new Date(filters.disbursedFrom).getTime()) / 86_400_000 + 1
    : Infinity;
  const useDaily = grain === "day" || (grain === "auto" && spanDays <= 62);
  const series = useMemo(() => {
    if (!data) return [];
    return useDaily
      ? data.byDay.map((d) => ({ label: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: d.amount, count: d.count }))
      : data.byMonth.map((m) => ({ label: new Date(m.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "2-digit" }), amount: m.amount, count: m.count }));
  }, [data, useDaily]);

  const growth = data?.previous && data.previous.amount > 0 ? ((data.kpi.amount - data.previous.amount) / data.previous.amount) * 100 : null;
  const rows: DisbursedBucket[] = data ? (data[dim] as DisbursedBucket[]) : [];
  const totalAmount = data?.kpi.amount ?? 0;
  const dims = DIMENSIONS.filter((d) => !d.hide || !hide.includes(d.hide));

  // Export: every breakdown as its own sheet, so the column picker can trim them.
  const loadSheets = async () => {
    if (!data) return [];
    const share = (a: number) => (totalAmount ? `${((a / totalAmount) * 100).toFixed(1)}%` : "");
    const bucketSheet = (name: string, b: DisbursedBucket[]) => ({
      name, headers: [name.replace("By ", ""), "Cases", "Disbursed Amount", "Share of Total"],
      rows: b.map((x) => [x.name, x.count, x.amount, share(x.amount)]),
    });
    return [
      { name: "Summary", headers: ["Metric", "Value"], rows: [
        ["Disbursed amount", data.kpi.amount], ["Cases disbursed", data.kpi.count], ["Average ticket", data.kpi.avgTicket],
        ["Largest case", data.kpi.max], ["Smallest case", data.kpi.min],
        ...(data.previous ? [["Previous period amount", data.previous.amount], ["Previous period cases", data.previous.count]] : []),
        ["From", filters.disbursedFrom || "All time"], ["To", filters.disbursedTo || "All time"],
      ] as (string | number)[][] },
      { name: "By Month", headers: ["Month", "Cases", "Disbursed Amount"], rows: data.byMonth.map((m) => [m.month, m.count, m.amount]) },
      { name: "By Day", headers: ["Date", "Cases", "Disbursed Amount"], rows: data.byDay.map((d) => [d.date, d.count, d.amount]) },
      ...DIMENSIONS.filter((d) => !d.hide || !hide.includes(d.hide)).map((d) => bucketSheet(`By ${d.label}`, data[d.id] as DisbursedBucket[])),
      bucketSheet("By Ticket Size", data.bands),
      { name: "Top Cases", headers: ["Case ID", "Customer", "Bank", "Product", "Loan Amount", "Disbursed On"],
        rows: data.topCases.map((c) => [c.caseCode, c.customer, c.bankName ?? "", c.product ?? "", c.loanAmount ?? 0, c.disbursementDate ? new Date(c.disbursementDate).toLocaleDateString("en-IN") : ""]) },
    ];
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <p className="text-xs text-muted">Built from disbursed cases · {filters.disbursedFrom ? `${filters.disbursedFrom} → ${filters.disbursedTo}` : "all time"}</p>
        </div>
        <ExportButton label="Export analytics" title="Export disbursement analytics" storageKey="disbursement-analytics" filename="disbursement-analytics" loadSheets={loadSheets} />
      </div>

      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id} type="button" onClick={() => pickPreset(p)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                preset === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-surface-2")}
            >{p.label}</button>
          ))}
        </div>
        <CaseFilterPanel
          value={filters}
          onChange={(f) => { if (f.disbursedFrom !== filters.disbursedFrom || f.disbursedTo !== filters.disbursedTo) setPreset("custom"); setFilters(f); }}
          facets={facets}
          hide={["status", "sort", "createdDate", ...hide]}
        />
      </div>

      {error && <div className="card p-4 border-danger-border bg-danger-subtle text-sm text-danger">{error}</div>}

      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : data && (
        <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Disbursed amount" value={short(data.kpi.amount)} sub={inr(data.kpi.amount)} icon={IndianRupee} delta={growth} />
            <Kpi label="Cases disbursed" value={data.kpi.count.toLocaleString("en-IN")} sub={data.previous ? `prev. ${data.previous.count}` : undefined} icon={Layers} />
            <Kpi label="Average ticket" value={short(data.kpi.avgTicket)} sub="per case" icon={TrendingUp} />
            <Kpi label="Largest case" value={short(data.kpi.max)} icon={Trophy} />
            <Kpi label="Smallest case" value={short(data.kpi.min)} icon={Trophy} />
          </div>

          {data.kpi.count === 0 ? (
            <div className="card p-10 text-center text-sm text-muted">No disbursed cases match these filters.</div>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Disbursed amount over time</p>
                  <div className="flex gap-1">
                    {(["auto", "month", "day"] as const).map((g) => (
                      <button key={g} type="button" onClick={() => setGrain(g)}
                        className={cn("rounded px-2 py-0.5 text-[11px] font-medium border", grain === g ? "border-primary text-primary bg-primary/10" : "border-border text-muted")}>
                        {g === "auto" ? "Auto" : g === "month" ? "Monthly" : "Daily"}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="a" tick={{ fontSize: 11 }} tickFormatter={short} width={56} />
                    <YAxis yAxisId="c" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                    <Tooltip content={<Tip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="a" dataKey="amount" name="Amount" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="c" dataKey="count" name="Cases" stroke={COLORS[2]} strokeWidth={2} dot={false} type="monotone" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="card p-4 lg:col-span-2">
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <p className="text-sm font-semibold mr-2">Breakdown by</p>
                    {dims.map((d) => (
                      <button key={d.id} type="button" onClick={() => setDim(d.id)}
                        className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", dim === d.id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-surface-2")}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {rows.length === 0 ? <p className="text-sm text-muted py-6 text-center">No data for this breakdown.</p> : (
                    <>
                      <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 30)}>
                        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={short} />
                          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                          <Tooltip content={<Tip />} />
                          <Bar dataKey="amount" name="Amount" radius={[0, 4, 4, 0]}>
                            {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-muted border-b border-border"><th className="py-1.5 font-semibold">Name</th><th className="font-semibold text-right">Cases</th><th className="font-semibold text-right">Amount</th><th className="font-semibold text-right">Share</th></tr></thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.name} className="border-b border-border/50">
                                <td className="py-1.5 font-medium">{r.name}</td>
                                <td className="text-right tabular-nums">{r.count}</td>
                                <td className="text-right tabular-nums">{inr(r.amount)}</td>
                                <td className="text-right tabular-nums text-muted">{totalAmount ? ((r.amount / totalAmount) * 100).toFixed(1) : 0}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="card p-4">
                    <p className="text-sm font-semibold mb-1">Product mix</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={data.byProduct} dataKey="amount" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                          {data.byProduct.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<Tip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {data.byProduct.map((p, i) => (
                        <span key={p.name} className="flex items-center gap-1 text-[11px] text-muted"><span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{p.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm font-semibold mb-1">Ticket size</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.bands} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={44} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                        <Tooltip content={<Tip />} />
                        <Bar dataKey="count" name="Cases" fill={COLORS[4]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <p className="text-sm font-semibold mb-2">Top 10 disbursed cases</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted border-b border-border"><th className="py-1.5 font-semibold">Case</th><th className="font-semibold">Customer</th><th className="font-semibold">Bank</th><th className="font-semibold">Product</th><th className="font-semibold">Disbursed</th><th className="font-semibold text-right">Amount</th></tr></thead>
                    <tbody>
                      {data.topCases.map((c) => (
                        <tr key={c._id} className="border-b border-border/50">
                          <td className="py-1.5 font-mono text-primary font-semibold">{c.caseCode}</td>
                          <td>{c.customer}</td><td>{c.bankName ?? "—"}</td><td>{c.product ?? "—"}</td>
                          <td className="text-muted">{c.disbursementDate ? new Date(c.disbursementDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}</td>
                          <td className="text-right tabular-nums font-semibold">{inr(c.loanAmount ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
