"use client";

import { useState } from "react";
import { Bell, ShieldCheck, FileText, AlertTriangle, Clock, Check, X } from "lucide-react";
import { Button, Badge, Tabs, SectionHeader, type BadgeTone } from "../../../components/ui";

type NType = "payout" | "insurance" | "stagnant" | "document";

interface Notification {
  id: string; type: NType; title: string; description: string;
  time: string; caseId?: string; unread: boolean;
}

const ALL: Notification[] = [
  { id: "n1",  type: "payout",    title: "Payout Overdue — HDFC",          description: "Jun 2026 invoice has not been cleared by HDFC Bank. Amount: ₹1,50,450",            time: "2 hours ago",   caseId: undefined,        unread: true  },
  { id: "n2",  type: "insurance", title: "Insurance Expiring — Raj Kumar",  description: "Policy for CAR-2026-0101 expires in 2 days (14 Jun 2026). Renewal required.",      time: "3 hours ago",   caseId: "CAR-2026-0101",  unread: true  },
  { id: "n3",  type: "document",  title: "Aadhaar Mismatch — Amit Singh",   description: "Address on Aadhaar does not match loan application for CAR-2026-0146.",            time: "5 hours ago",   caseId: "CAR-2026-0146",  unread: true  },
  { id: "n4",  type: "stagnant",  title: "Case Stagnant — Vikram Patel",    description: "BT-2026-0144 has had no status update in 7 days. Last status: In Credit.",         time: "1 day ago",     caseId: "BT-2026-0144",   unread: false },
  { id: "n5",  type: "insurance", title: "Insurance Expiring — Deepa Nair", description: "Policy for CAR-2026-0071 expires in 9 days (21 Jun 2026).",                        time: "1 day ago",     caseId: "CAR-2026-0071",  unread: true  },
  { id: "n6",  type: "payout",    title: "Payout Overdue — Axis Bank",      description: "Jun 2026 invoice pending for Axis Bank. Amount: ₹86,730",                          time: "2 days ago",    caseId: undefined,        unread: false },
  { id: "n7",  type: "document",  title: "Bank NOC Missing — Sunita Devi",  description: "Bank NOC has not been submitted for CAR-2026-0145. Case approval blocked.",        time: "2 days ago",    caseId: "CAR-2026-0145",  unread: false },
  { id: "n8",  type: "stagnant",  title: "Case Stagnant — Meera Gupta",     description: "PL-2026-0139 has had no status update in 10 days. Follow-up required.",            time: "3 days ago",    caseId: "PL-2026-0139",   unread: false },
  { id: "n9",  type: "insurance", title: "Insurance Expired — Priya Sharma", description: "Policy for CAR-2026-0098 expired 24 days ago. Immediate renewal required.",        time: "4 days ago",    caseId: "CAR-2026-0098",  unread: false },
  { id: "n10", type: "payout",    title: "Invoice Received — Kotak Bank",   description: "Kotak Mahindra payout for Jun 2026 has been received. Amount: ₹1,11,510",          time: "5 days ago",    caseId: undefined,        unread: false },
];

const TYPE_META: Record<NType, { label: string; icon: React.ElementType; tone: BadgeTone }> = {
  payout:    { label: "Payout",    icon: AlertTriangle, tone: "warning"  },
  insurance: { label: "Insurance", icon: ShieldCheck,   tone: "danger"   },
  document:  { label: "Document",  icon: FileText,      tone: "orange"   },
  stagnant:  { label: "Stagnant",  icon: Clock,         tone: "neutral"  },
};

export default function NotificationsPage() {
  const [tab, setTab] = useState("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [readAll, setReadAll] = useState(false);

  const visible = ALL.filter((n) => !dismissed.has(n.id));
  const filtered = tab === "all" ? visible : tab === "unread" ? visible.filter((n) => n.unread) : visible.filter((n) => n.type === tab);
  const unreadCount = visible.filter((n) => n.unread).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Notifications"
        description="System alerts for payouts, insurance, documents, and stagnant cases"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setReadAll(true)}>
              <Check className="size-3.5" /> Mark all read
            </Button>
          </div>
        }
      />

      {/* Type summary */}
      <div className="grid grid-cols-4 gap-3">
        {(Object.entries(TYPE_META) as [NType, typeof TYPE_META[NType]][]).map(([type, meta]) => {
          const count = visible.filter((n) => n.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setTab(type)}
              className={`card p-3 text-left transition-all hover:shadow-md ${tab === type ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <meta.icon className={`size-4 text-${meta.tone}`} />
                <Badge tone={meta.tone}>{count}</Badge>
              </div>
              <p className="text-xs font-medium">{meta.label}</p>
            </button>
          );
        })}
      </div>

      <Tabs
        tabs={[
          { id: "all",       label: "All",         count: visible.length },
          { id: "unread",    label: "Unread",      count: unreadCount },
          { id: "payout",    label: "Payout",      count: visible.filter((n) => n.type === "payout").length },
          { id: "insurance", label: "Insurance",   count: visible.filter((n) => n.type === "insurance").length },
          { id: "document",  label: "Documents",   count: visible.filter((n) => n.type === "document").length },
          { id: "stagnant",  label: "Stagnant",    count: visible.filter((n) => n.type === "stagnant").length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card flex items-center justify-center h-32">
            <p className="text-sm text-muted">No notifications in this category.</p>
          </div>
        ) : filtered.map((n) => {
          const meta = TYPE_META[n.type];
          const Icon = meta.icon;
          const isUnread = n.unread && !readAll;
          return (
            <div
              key={n.id}
              className={`card p-4 flex gap-4 transition-all animate-fadeIn ${
                isUnread ? "border-l-4 border-l-primary bg-primary-subtle/20" : ""
              }`}
            >
              <div className={`size-9 rounded-full grid place-items-center shrink-0 mt-0.5 bg-${meta.tone}-subtle text-${meta.tone}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${isUnread ? "text-foreground" : "text-foreground-secondary"}`}>
                      {n.title}
                    </p>
                    {isUnread && <span className="size-1.5 rounded-full bg-primary" />}
                  </div>
                  <span className="text-[11px] text-muted whitespace-nowrap shrink-0">{n.time}</span>
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.description}</p>
                {n.caseId && (
                  <div className="mt-2">
                    <a href={`/cases`} className="text-xs text-primary hover:underline font-medium">
                      View {n.caseId} →
                    </a>
                  </div>
                )}
              </div>
              <button
                onClick={() => setDismissed((d) => new Set([...d, n.id]))}
                className="size-6 grid place-items-center rounded text-muted hover:bg-surface-2 hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
