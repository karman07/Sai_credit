"use client";

import { useState, useEffect } from "react";
import { FileText, CheckCircle2, XCircle, Clock, Bell, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth-context";
import { KpiCard, CaseStatusBadge, Badge, type CaseStatus } from "../../../components/ui";

const PIPELINE: { label: CaseStatus; count: number }[] = [
  { label: "Sales",     count: 6  },
  { label: "Pending",   count: 4  },
  { label: "In Credit", count: 3  },
  { label: "Approved",  count: 2  },
  { label: "Disbursed", count: 8  },
];

const FOLLOW_UPS = [
  { id: "CAR-2026-0147", customer: "Priya Sharma", action: "Submit bank NOC", status: "Approved" as CaseStatus },
  { id: "CAR-2026-0145", customer: "Sunita Devi",  action: "Call customer for Aadhaar update", status: "Pending" as CaseStatus },
  { id: "PL-2026-0139",  customer: "Meera Gupta",  action: "Check credit status with Axis", status: "In Credit" as CaseStatus },
];

const ACTIVITY = [
  { text: "CAR-2026-0148 disbursed by HDFC",       time: "2h ago",   tone: "success" as const },
  { text: "Raj Kumar documents uploaded",           time: "3h ago",   tone: "info" as const    },
  { text: "CAR-2026-0147 moved to Approved",        time: "5h ago",   tone: "success" as const },
  { text: "BT-2026-0144 put on Hold by bank",       time: "1d ago",   tone: "warning" as const },
  { text: "New lead created: Mohan Lal",            time: "1d ago",   tone: "neutral" as const },
];

export default function SalesDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{greeting}, {user?.firstName ?? "Sales"} 👋</h1>
          <p className="text-sm text-muted mt-0.5">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Link href="/new-lead" className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus className="size-3.5" /> New Lead
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="My Cases" value="23" icon={FileText} accent="text-primary" sub="All time" />
        <KpiCard label="In Progress" value="13" icon={Clock} accent="text-warning" sub="Active" />
        <KpiCard label="Disbursed (MTD)" value="8" icon={CheckCircle2} accent="text-success" sub="Jun 2026" />
        <KpiCard label="Rejected" value="2" icon={XCircle} accent="text-danger" sub="This month" />
      </div>

      {/* Pipeline strip */}
      <div className="card p-5">
        <p className="text-sm font-semibold mb-4">My Pipeline</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {PIPELINE.map((stage) => (
            <div key={stage.label} className="flex-1 min-w-[90px] flex flex-col items-center gap-2">
              <div className="text-2xl font-bold font-mono text-foreground">{stage.count}</div>
              <CaseStatusBadge status={stage.label} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 mt-3">
          {PIPELINE.map((stage, i) => (
            <div key={stage.label} className="flex-1 h-1.5 rounded-full bg-primary/20 relative overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(10, 100 - i * 14)}%` }} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Follow-up list */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-sm">Today's Follow-ups</p>
              <p className="text-xs text-muted">{FOLLOW_UPS.length} actions pending</p>
            </div>
            <Bell className="size-4 text-warning" />
          </div>
          <div className="divide-y divide-border-subtle">
            {FOLLOW_UPS.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors">
                <CaseStatusBadge status={f.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{f.customer}</p>
                  <p className="text-xs text-muted truncate">{f.action}</p>
                </div>
                <Link href="/cases" className="text-xs text-primary hover:underline shrink-0 font-medium">{f.id}</Link>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border">
            <Link href="/cases" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
              View all cases <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Activity feed */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-semibold text-sm">Recent Activity</p>
          </div>
          <div className="divide-y divide-border-subtle">
            {ACTIVITY.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors">
                <span className={`size-2 rounded-full shrink-0 ${
                  a.tone === "success" ? "bg-success" :
                  a.tone === "warning" ? "bg-warning" :
                  a.tone === "info"    ? "bg-info"    : "bg-muted"
                }`} />
                <p className="text-sm flex-1">{a.text}</p>
                <span className="text-[11px] text-muted whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
