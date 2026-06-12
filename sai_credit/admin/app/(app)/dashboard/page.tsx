"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, IndianRupee, TrendingUp, CheckCircle2, AlertTriangle, ArrowUpRight } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { KpiCard, CaseStatusBadge, Badge, Card, Skeleton, type CaseStatus } from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";
import { casesApi, type DashboardStats, type LoanCase } from "../../../lib/api";

const PRODUCT_COLORS = ["#6683FF", "#4ADE80", "#FBBF24", "#F87171", "#A78BFA", "#2DD4BF"];

function Counter({ target, prefix = "", suffix = "" }: { target: number; prefix?: string; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let current = 0;
    const increment = target / 56;
    const timer = setInterval(() => {
      current = Math.min(current + increment, target);
      setVal(Math.floor(current));
      if (current >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <>{prefix}{val.toLocaleString("en-IN")}{suffix}</>;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-2.5 shadow-xl space-y-1 min-w-[100px]">
      {label && <p className="font-semibold text-foreground-secondary mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="text-muted">{p.name ?? "Value"}</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCases, setRecentCases] = useState<LoanCase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, casesRes] = await Promise.all([
        casesApi.stats(),
        casesApi.list({ limit: 7, page: 1 }),
      ]);
      setStats(statsRes.data);
      setRecentCases((casesRes.data as unknown as LoanCase[]));
    } catch {
      // show empty state gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  const funnelStages: { label: string; status: CaseStatus; count: number; color: string }[] = [
    { label: "Sales",     status: "Sales",     count: stats?.statusBreakdown?.["Sales"] ?? 0,      color: "#38BDF8" },
    { label: "Pending",   status: "Pending",   count: stats?.statusBreakdown?.["Pending"] ?? 0,    color: "#FBBF24" },
    { label: "In Credit", status: "In Credit", count: stats?.statusBreakdown?.["In Credit"] ?? 0,  color: "#A78BFA" },
    { label: "Approved",  status: "Approved",  count: stats?.statusBreakdown?.["Approved"] ?? 0,   color: "#2DD4BF" },
    { label: "Disbursed", status: "Disbursed", count: stats?.statusBreakdown?.["Disbursed"] ?? 0,  color: "#4ADE80" },
  ];
  const maxFunnel = Math.max(...funnelStages.map((s) => s.count), 1);

  const bankChartData = (stats?.bankWise ?? []).map((b) => ({ bank: b._id?.split(" ")[0] ?? b._id, disbursed: b.count }));
  const productChartData = (stats?.productMix ?? []).map((p, i) => ({ name: p._id, value: p.count, color: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }));

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{greeting}, {user?.firstName ?? "Admin"}</h1>
        <p className="text-sm text-muted mt-0.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <KpiCard label="Total Leads"      value={<Counter target={stats?.totalLeads ?? 0} />}   icon={FileText}     accent="text-primary"  sub="All time" />
          <KpiCard label="Disbursed (MTD)"  value={<Counter target={stats?.disbursedMTD ?? 0} />} icon={CheckCircle2} accent="text-success"  sub="This month" />
          <KpiCard label="Payout (MTD)"     value={`₹${((stats?.disbursedMTDAmount ?? 0) / 100000).toFixed(1)}L`} icon={IndianRupee} accent="text-teal" sub="Disbursed volume" />
          <KpiCard label="Active Cases"     value={<Counter target={stats?.activeCases ?? 0} />}  icon={TrendingUp}   accent="text-purple"   sub="In pipeline" />
          <KpiCard label="Hold Cases"       value={<Counter target={stats?.statusBreakdown?.["Hold"] ?? 0} />} icon={AlertTriangle} accent="text-warning" sub="Needs attention" />
        </div>
      )}

      {/* Funnel */}
      <Card>
        <p className="text-sm font-semibold mb-4 flex items-center gap-2">Case Pipeline <Badge tone="info" dot>Live</Badge></p>
        <div className="flex items-end gap-2">
          {funnelStages.map((s, i) => {
            const h = Math.round((s.count / maxFunnel) * 80) + 12;
            return (
              <div key={s.status} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[11px] font-bold text-foreground-secondary">{s.count}</span>
                <div className="w-full rounded-t-md transition-all duration-700" style={{ height: `${h}px`, background: s.color, opacity: 1 - i * 0.06 }} />
                <CaseStatusBadge status={s.status} />
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <p className="text-sm font-semibold mb-4">Bank-wise Disbursement</p>
          {bankChartData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bankChartData} barSize={28} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="bank" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--primary-subtle)" }} />
                <Bar dataKey="disbursed" name="Cases" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-4">Product Mix</p>
          {productChartData.length === 0 ? (
            <div className="h-[160px] flex items-center justify-center text-sm text-muted">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={productChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                    {productChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {productChartData.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="text-foreground-secondary flex-1">{p.name}</span>
                    <span className="font-semibold text-foreground">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <p className="text-sm font-semibold">Recent Cases</p>
            <a href="/cases" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">View all <ArrowUpRight className="size-3" /></a>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : recentCases.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No cases yet. Create your first case above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Case ID</th><th>Customer</th><th>Product</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {recentCases.map((c) => (
                    <tr key={c._id}>
                      <td className="font-mono text-xs text-primary font-medium">{c.caseCode}</td>
                      <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                      <td className="text-xs text-foreground-secondary">{c.product}</td>
                      <td className="font-mono text-xs font-semibold">{c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}</td>
                      <td><CaseStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <p className="text-sm font-semibold mb-4">Status Distribution</p>
          <div className="space-y-2.5">
            {funnelStages.map((s) => (
              <div key={s.status} className="flex items-center gap-3">
                <CaseStatusBadge status={s.status} />
                <div className="flex-1 h-1.5 rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all duration-500" style={{ background: s.color, width: `${Math.round((s.count / maxFunnel) * 100)}%` }} />
                </div>
                <span className="text-xs font-mono text-muted w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
