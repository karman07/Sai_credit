"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { FileText, CheckCircle2, XCircle, Clock, Users2, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import { KpiCard, CaseStatusBadge, Skeleton, EmptyState, type CaseStatus } from "../../../components/ui";
import { casesApi, usersApi, type LoanCase, type TeamMember } from "../../../lib/api";

const C = {
  primary: "#0F766E",
  success: "#22C55E",
  warning: "#F59E0B",
  danger:  "#EF4444",
  purple:  "#A855F7",
  teal:    "#14B8A6",
  orange:  "#F97316",
  sky:     "#38BDF8",
  slate:   "#94A3B8",
};

const STATUS_COLORS: Record<string, string> = {
  Sales:       C.sky,
  Pending:     C.warning,
  "In Credit": C.purple,
  Approved:    C.teal,
  Disbursed:   C.success,
  Hold:        C.orange,
  Rejected:    C.danger,
  Incomplete:  "#CBD5E1",
  Cancelled:   C.slate,
  Draft:       C.slate,
};

const PIPELINE_STATUSES: CaseStatus[] = ["Sales", "Pending", "In Credit", "Approved", "Disbursed"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[120px] border border-border">
      {label && <p className="font-semibold mb-1.5 border-b border-border pb-1.5 text-foreground-secondary">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mt-1">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.fill ?? p.stroke ?? p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  useEffect(() => {
    Promise.all([
      casesApi.list({ limit: 500 }),
      usersApi.myTeam(),
    ])
      .then(([c, t]) => { setCases(c.data as unknown as LoanCase[]); setTeam(t.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalCases = cases.length;
  const inProgress = cases.filter((c) => !["Disbursed", "Rejected", "Cancelled"].includes(c.status)).length;
  const disbursedMTD = cases.filter((c) => {
    if (c.status !== "Disbursed") return false;
    const d = new Date(c.disbursementDate ?? c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const rejectedMTD = cases.filter((c) => {
    if (c.status !== "Rejected") return false;
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const pipeline = useMemo(() =>
    PIPELINE_STATUSES.map((s) => ({ label: s, count: cases.filter((c) => c.status === s).length, color: STATUS_COLORS[s] })),
    [cases],
  );

  const monthlyData = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return {
        month: MONTH_NAMES[d.getMonth()],
        "New Cases": cases.filter((c) => c.createdAt.slice(0, 7) === m).length,
        Disbursed:   cases.filter((c) => c.status === "Disbursed" && (c.disbursementDate ?? c.createdAt).slice(0, 7) === m).length,
      };
    }),
    [cases],
  );

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    cases.forEach((c) => { counts[c.status] = (counts[c.status] ?? 0) + 1; });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? C.slate }));
  }, [cases]);

  const followUps = cases.filter((c) => ["Incomplete", "Approved", "Pending"].includes(c.status)).slice(0, 5);
  const recentCases = [...cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  const followUpAction = (status: string) =>
    status === "Incomplete" ? "Documents requested — awaiting upload"
    : status === "Approved"  ? "Approved — follow up for disbursement"
    : "Pending — check status with bank";

  return (
    <div className="space-y-5 animate-fadeIn">

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{greeting}, {user?.firstName ?? "Coordinator"} 👋</h1>
          <p className="text-sm text-muted mt-0.5">
            {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <KpiCard label="Team Cases"      value={String(totalCases)}   icon={FileText}     accent="text-primary" sub="All time"   />
            <KpiCard label="In Progress"     value={String(inProgress)}   icon={Clock}        accent="text-warning" sub="Active"     />
            <KpiCard label="Disbursed (MTD)" value={String(disbursedMTD)} icon={CheckCircle2} accent="text-success" sub={monthLabel} />
            <KpiCard label="Rejected"        value={String(rejectedMTD)}  icon={XCircle}      accent="text-danger"  sub="This month" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="size-4 text-primary" />
            <p className="text-sm font-semibold">6-Month Team Activity</p>
            <div className="ml-auto flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full inline-block" style={{ background: C.primary }} />New Cases</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full inline-block" style={{ background: C.success }} />Disbursed</span>
            </div>
          </div>
          {loading ? <Skeleton className="h-48 rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <defs>
                  <linearGradient id="gPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="New Cases" stroke={C.primary} strokeWidth={2.5} fill="url(#gPrimary)" dot={false} activeDot={{ r: 4, fill: C.primary, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="Disbursed" stroke={C.success} strokeWidth={2.5} fill="url(#gSuccess)" dot={false} activeDot={{ r: 4, fill: C.success, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">Status Mix</p>
          {loading ? <Skeleton className="h-48 rounded-lg" /> : statusData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted">
              <FileText className="size-8 opacity-20" /><p className="text-xs">No cases yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={148}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v} cases`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-1">
                {statusData.slice(0, 5).map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-foreground-secondary flex-1 truncate">{s.label}</span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                    <span className="text-muted tabular-nums w-7 text-right">{totalCases > 0 ? `${Math.round((s.value / totalCases) * 100)}%` : "—"}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-4">Team Pipeline</p>
        {loading ? <Skeleton className="h-36 rounded-lg" /> : (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={pipeline} barSize={40} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--surface-3, rgba(0,0,0,0.04))" }} />
              <Bar dataKey="count" name="Cases" radius={[6, 6, 0, 0]}>
                {pipeline.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Your Sales Reps */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Your Sales Reps</p>
              <p className="text-xs text-muted">{loading ? "Loading…" : `${team.length} rep${team.length !== 1 ? "s" : ""} assigned to you`}</p>
            </div>
            <Users2 className="size-4 text-primary" />
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : team.length === 0 ? (
            <EmptyState title="No reps assigned yet" description="Ask your admin to assign sales reps to you." />
          ) : (
            <div className="divide-y divide-border-subtle">
              {team.map((m) => (
                <div key={m._id} className="flex items-center gap-3 px-5 py-3">
                  <span className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold shrink-0">
                    {m.firstName[0]}{m.lastName[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.firstName} {m.lastName}</p>
                    <p className="text-xs text-muted truncate">{m.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Follow-up Required</p>
              <p className="text-xs text-muted">{loading ? "Loading…" : `${followUps.length} case${followUps.length !== 1 ? "s" : ""} need attention`}</p>
            </div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
          ) : followUps.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">All caught up! No follow-ups needed.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {followUps.map((f) => (
                <div key={f._id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors">
                  <CaseStatusBadge status={f.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{f.customer.firstName} {f.customer.lastName}</p>
                    <p className="text-xs text-muted truncate">{followUpAction(f.status)}</p>
                  </div>
                  <span className="text-xs text-primary shrink-0 font-medium">{f.caseCode}</span>
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-border">
            <Link href="/cases" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              View all cases <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><p className="font-semibold text-sm">Recent Cases</p></div>
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
          ) : recentCases.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted">No cases yet.</div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {recentCases.map((c) => (
                <div key={c._id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors">
                  <span className="font-mono text-xs text-primary font-semibold shrink-0">{c.caseCode}</span>
                  <p className="text-sm flex-1 truncate">{c.customer.firstName} {c.customer.lastName}</p>
                  <CaseStatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
          <div className="px-5 py-3 border-t border-border">
            <Link href="/cases" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              View all cases <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
