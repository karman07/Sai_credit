"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText, IndianRupee, TrendingUp, CheckCircle2, AlertTriangle,
  ArrowUpRight, Building2, AlertCircle, Filter, X, LineChart as LineChartIcon,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import { KpiCard, CaseStatusBadge, Badge, Card, Skeleton, Select, Label, Button, type CaseStatus } from "../../../components/ui";
import { DateRangePicker, type DateRange } from "../../../components/DateRangePicker";
import { useAuth } from "../../../lib/auth-context";
import {
  casesApi, banksApi, mastersApi,
  type DashboardStats, type LoanCase, type CaseTrendPoint, type Bank, type MasterItem,
} from "../../../lib/api";

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  primary:  "#6683FF",
  success:  "#22C55E",
  warning:  "#F59E0B",
  danger:   "#EF4444",
  purple:   "#A855F7",
  teal:     "#14B8A6",
  orange:   "#F97316",
  sky:      "#38BDF8",
  slate:    "#94A3B8",
};

const PRODUCT_COLORS = [C.primary, C.success, C.warning, C.purple, C.teal, C.orange, C.sky];

const STATUS_META: Record<string, { color: string; label: string }> = {
  "Sales":     { color: C.sky,     label: "Sales"     },
  "Pending":   { color: C.warning, label: "Pending"   },
  "In Credit": { color: C.purple,  label: "In Credit" },
  "Approved":  { color: C.teal,    label: "Approved"  },
  "Disbursed": { color: C.success, label: "Disbursed" },
  "Hold":      { color: C.orange,  label: "Hold"      },
  "Rejected":  { color: C.danger,  label: "Rejected"  },
  "Incomplete":{ color: "#CBD5E1", label: "Incomplete"},
  "Cancelled": { color: C.slate,   label: "Cancelled" },
};

const PIPELINE_STAGES: CaseStatus[] = ["Sales", "Pending", "In Credit", "Approved", "Disbursed"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLakhs(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function Counter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const inc = target / 50;
    const t = setInterval(() => {
      cur = Math.min(cur + inc, target);
      setVal(Math.floor(cur));
      if (cur >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target]);
  return <>{prefix}{val.toLocaleString("en-IN")}{suffix}</>;
}

// ── Custom chart tooltip ───────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[130px]">
      {label && <p className="font-semibold text-foreground-secondary mb-2 pb-1.5 border-b border-border">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.fill ?? p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── SVG ring metric ───────────────────────────────────────────────────────────

function RingMetric({ value, label, color, max = 100 }: { value: number; label: string; color: string; max?: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }}
        />
        <text x="38" y="43" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">
          {value}%
        </text>
      </svg>
      <p className="text-[11px] text-muted font-medium text-center leading-tight">{label}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function fmtRangeShort(from: string, to: string) {
  const f = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `${f(from)} – ${f(to)}`;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<LoanCase[]>([]);
  const [trend, setTrend] = useState<CaseTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>({ from: isoDaysAgo(30), to: isoDaysAgo(0) });
  const [productFilter, setProductFilter] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [groupBy, setGroupBy] = useState<"day" | "month">("day");
  const [filterOpen, setFilterOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [products, setProducts] = useState<MasterItem[]>([]);

  const hasFilters = !!(productFilter || bankFilter);
  const statsFilters = useMemo(() => ({
    from: dateRange.from, to: dateRange.to,
    product: productFilter || undefined,
    bankId: bankFilter || undefined,
  }), [dateRange, productFilter, bankFilter]);

  useEffect(() => {
    banksApi.list().then(({ data }) => setBanks(data)).catch(() => {});
    mastersApi.list("products").then(({ data }) => setProducts(data.filter((p: any) => p.isActive))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, casesRes] = await Promise.all([
        casesApi.stats(statsFilters),
        casesApi.list({ limit: 8, page: 1 }),
      ]);
      setStats(statsRes.data);
      setRecentCases(casesRes.data as unknown as LoanCase[]);
    } catch { /* show empty state */ }
    finally { setLoading(false); }
  }, [statsFilters]);

  const loadTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      const { data } = await casesApi.trend({ ...statsFilters, groupBy });
      setTrend(data);
    } catch { /* show empty state */ }
    finally { setTrendLoading(false); }
  }, [statsFilters, groupBy]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTrend(); }, [loadTrend]);

  const greeting = new Date().getHours() < 12 ? "Good morning"
    : new Date().getHours() < 17 ? "Good afternoon"
    : "Good evening";

  // Derived data
  const breakdown = stats?.statusBreakdown ?? {};
  const totalCases   = Object.values(breakdown).reduce((s: number, v) => s + (v as number), 0);
  const disbursed    = breakdown["Disbursed"] ?? 0;
  const rejected     = breakdown["Rejected"]  ?? 0;
  const holdCount    = breakdown["Hold"]      ?? 0;
  const convRate     = totalCases > 0 ? Math.round((disbursed / totalCases) * 100) : 0;
  const rejRate      = totalCases > 0 ? Math.round((rejected  / totalCases) * 100) : 0;

  const funnelData = PIPELINE_STAGES.map((s) => ({
    status: s,
    count:  breakdown[s] ?? 0,
    color:  STATUS_META[s].color,
  }));
  const maxFunnel = Math.max(...funnelData.map((s) => s.count), 1);

  const trendChartData = useMemo(() =>
    trend.map((t) => ({
      date: t.date,
      label: groupBy === "month"
        ? new Date(`${t.date}-01`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
        : new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      leads: t.leads,
      disbursed: t.disbursed,
      volume: parseFloat((t.volume / 100_000).toFixed(2)),
    })),
    [trend, groupBy],
  );
  const trendHasData = trendChartData.some((t) => t.leads > 0 || t.disbursed > 0);

  const bankChartData = useMemo(() =>
    (stats?.bankWise ?? []).map((b) => ({
      bank:   b._id ?? "Unknown",
      cases:  b.count,
      volume: parseFloat(((b.volume ?? 0) / 100_000).toFixed(2)),
    })),
    [stats],
  );

  const productData = useMemo(() =>
    (stats?.productMix ?? [])
      .filter((p) => p._id)
      .map((p, i) => ({ name: p._id, value: p.count, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] })),
    [stats],
  );

  const statusDistData = Object.entries(breakdown)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => ({ label: k, count: v as number, color: STATUS_META[k]?.color ?? C.slate }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {greeting}, {user?.firstName ?? "Admin"}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success" dot>Live</Badge>
          <button
            onClick={() => { load(); loadTrend(); }}
            className="text-xs text-muted hover:text-foreground-secondary transition-colors"
            title="Refresh"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────── */}
      <Card className="!p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant={filterOpen ? "outline" : "secondary"} size="sm" onClick={() => setFilterOpen((o) => !o)}>
            <Filter className="size-3.5" /> Filters
            {hasFilters && <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">!</span>}
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setProductFilter(""); setBankFilter(""); }}>
              <X className="size-3" /> Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-md border border-border overflow-hidden text-[11px] font-semibold">
            <button
              onClick={() => setGroupBy("day")}
              className={`px-2.5 py-1.5 transition-colors ${groupBy === "day" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
            >
              Daily
            </button>
            <button
              onClick={() => setGroupBy("month")}
              className={`px-2.5 py-1.5 transition-colors border-l border-border ${groupBy === "month" ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
            >
              Monthly
            </button>
          </div>
        </div>
        {filterOpen && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border animate-fadeIn">
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label>Product</Label>
              <Select className="!h-8 text-xs" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
                <option value="">All Products</option>
                {products.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label>Bank</Label>
              <Select className="!h-8 text-xs" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
                <option value="">All Banks</option>
                {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
            </div>
          </div>
        )}
      </Card>

      {/* ── KPI Row ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard
            label="Total Leads"    icon={FileText}      accent="text-primary"
            value={<Counter target={stats?.totalLeads ?? 0} />}
            sub={fmtRangeShort(dateRange.from, dateRange.to)}
          />
          <KpiCard
            label="Active Cases"   icon={TrendingUp}    accent="text-purple"
            value={<Counter target={stats?.activeCases ?? 0} />}
            sub="In pipeline"
          />
          <KpiCard
            label="Disbursed"      icon={CheckCircle2}  accent="text-success"
            value={<Counter target={stats?.disbursedMTD ?? 0} />}
            sub={fmtRangeShort(dateRange.from, dateRange.to)}
          />
          <KpiCard
            label="Volume Disbursed" icon={IndianRupee}  accent="text-teal"
            value={fmtLakhs(stats?.disbursedMTDAmount ?? 0)}
            sub={fmtRangeShort(dateRange.from, dateRange.to)}
          />
          <KpiCard
            label="On Hold"        icon={AlertTriangle} accent="text-warning"
            value={<Counter target={holdCount} />}
            sub="Needs attention"
          />
        </div>
      )}

      {/* ── Trend Charts: Cases Over Time + Disbursement Volume ──── */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Cases Over Time — leads vs disbursed, single count axis */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold">Cases Over Time</p>
          </div>
          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: C.primary }} />Leads Created</span>
            <span className="flex items-center gap-1.5 text-muted"><span className="size-2 rounded-full" style={{ background: C.success }} />Disbursed</span>
          </div>
          {trendLoading ? (
            <div className="h-[220px] flex items-center justify-center"><Skeleton className="h-40 w-full rounded-lg" /></div>
          ) : !trendHasData ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-muted">
              <LineChartIcon className="size-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No case activity in this period</p>
                <p className="text-xs mt-0.5">Try widening the date range</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                <Line type="monotone" dataKey="leads" name="Leads Created" stroke={C.primary} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="disbursed" name="Disbursed" stroke={C.success} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Disbursement Volume — single series, ₹L axis */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Disbursement Volume</p>
            <span className="text-[11px] text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full font-medium">
              ₹ Lakhs
            </span>
          </div>
          {trendLoading ? (
            <div className="h-[220px] flex items-center justify-center"><Skeleton className="h-40 w-full rounded-lg" /></div>
          ) : !trendHasData ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-muted">
              <IndianRupee className="size-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No disbursements in this period</p>
                <p className="text-xs mt-0.5">Try widening the date range</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.teal} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={C.teal} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis unit="L" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="volume" name="Volume (₹L)" stroke={C.teal} strokeWidth={2} fill="url(#volumeFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Charts Row: Bank + Product Mix ───────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Bank-wise volume — horizontal bar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold">Bank-wise Disbursement</p>
            <span className="text-[11px] text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full font-medium">
              Volume in ₹ Lakhs
            </span>
          </div>
          {bankChartData.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-muted">
              <Building2 className="size-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No disbursement data</p>
                <p className="text-xs mt-0.5">Data appears once loans are disbursed</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, bankChartData.length * 46)}>
              <BarChart
                data={bankChartData}
                layout="vertical"
                barSize={20}
                margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number" unit="L"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="bank" width={72}
                  tick={{ fontSize: 11, fill: "var(--foreground-secondary)", fontWeight: 500 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<ChartTip />} cursor={{ fill: "var(--primary-subtle)" }} />
                <Bar dataKey="volume" name="Volume (₹L)" fill={C.primary} radius={[0, 5, 5, 0]}>
                  {bankChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${228 + i * 18}, ${90 - i * 5}%, ${60 - i * 2}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Product Mix — donut */}
        <Card>
          <p className="text-sm font-semibold mb-4">Product Mix</p>
          {productData.length === 0 ? (
            <div className="h-52 flex flex-col items-center justify-center gap-2.5 text-muted">
              <TrendingUp className="size-10 opacity-20" />
              <div className="text-center">
                <p className="text-sm font-medium">No product data</p>
                <p className="text-xs mt-0.5">Create cases to see distribution</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={productData}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={76}
                    paddingAngle={2} dataKey="value"
                    strokeWidth={0}
                  >
                    {productData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v} cases`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-1">
                {productData.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-foreground-secondary flex-1 truncate">{p.name}</span>
                    <span className="font-semibold tabular-nums">{p.value}</span>
                    <span className="text-muted tabular-nums w-8 text-right">
                      {totalCases > 0 ? `${Math.round((p.value / totalCases) * 100)}%` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Case Pipeline Funnel ─────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <p className="text-sm font-semibold">Case Pipeline</p>
          <Badge tone="info" dot>Live</Badge>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted">
            <span className="tabular-nums">{totalCases} total</span>
            <span className="w-px h-3 bg-border" />
            <span className="tabular-nums text-success font-medium">{disbursed} disbursed</span>
          </div>
        </div>
        <div className="flex items-end gap-3">
          {funnelData.map((s) => {
            const h = Math.max(Math.round((s.count / maxFunnel) * 100) + 20, 28);
            const pct = totalCases > 0 ? Math.round((s.count / totalCases) * 100) : 0;
            return (
              <div key={s.status} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-center">
                  <p className="text-base font-bold tabular-nums">{s.count}</p>
                  <p className="text-[10px] text-muted tabular-nums">{pct}%</p>
                </div>
                <div
                  className="w-full rounded-t-lg transition-all duration-700 opacity-90 hover:opacity-100"
                  style={{ height: `${h}px`, background: s.color }}
                />
                <CaseStatusBadge status={s.status} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Bottom Row: Recent Cases + Metrics ───────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Recent Cases */}
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold">Recent Cases</p>
            <a href="/cases" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              View all <ArrowUpRight className="size-3" />
            </a>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded" />)}
            </div>
          ) : recentCases.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="size-10 text-muted opacity-20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted">No cases yet</p>
              <p className="text-xs text-muted mt-1">Create your first loan case to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((c) => (
                    <tr key={c._id}>
                      <td className="font-mono text-xs text-primary font-medium">{c.caseCode}</td>
                      <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                      <td className="text-xs text-foreground-secondary">{c.product ?? "—"}</td>
                      <td className="font-mono text-xs font-semibold tabular-nums">
                        {c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td><CaseStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Right sidebar — rings + status breakdown */}
        <div className="space-y-4">

          {/* Performance rings */}
          <Card>
            <p className="text-sm font-semibold mb-4">Performance Metrics</p>
            <div className="flex justify-around">
              <RingMetric value={convRate} label="Conversion Rate" color={C.success} />
              <RingMetric value={rejRate}  label="Rejection Rate"  color={C.danger}  />
            </div>
            <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-lg font-bold tabular-nums text-success">{disbursed}</p>
                <p className="text-[11px] text-muted">Disbursed</p>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-danger">{rejected}</p>
                <p className="text-[11px] text-muted">Rejected</p>
              </div>
            </div>
          </Card>

          {/* Status distribution */}
          <Card>
            <p className="text-sm font-semibold mb-3">Status Distribution</p>
            {statusDistData.length === 0 ? (
              <div className="py-6 text-center">
                <AlertCircle className="size-8 text-muted opacity-20 mx-auto mb-2" />
                <p className="text-xs text-muted">No cases yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {statusDistData.map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ background: s.color }}
                    />
                    <span className="text-xs text-foreground-secondary flex-1 truncate">{s.label}</span>
                    <div className="w-20 h-1.5 rounded-full bg-surface-3 shrink-0">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          background: s.color,
                          width: `${totalCases > 0 ? Math.round((s.count / totalCases) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted w-5 text-right tabular-nums shrink-0">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
