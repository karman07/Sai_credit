"use client";

import { useState } from "react";
import { Bell, FileText, TrendingUp, Clock, X } from "lucide-react";
import { Badge, Tabs } from "../../../components/ui";
import { cn } from "../../../components/ui";

const NOTIFICATIONS = [
  { id: "n1", type: "document",  title: "Document pending",    desc: "Upload Aadhaar for CAR-2026-0145 to proceed.", time: "1h ago",  unread: true,  caseId: "CAR-2026-0145" },
  { id: "n2", type: "status",    title: "Status updated",      desc: "PL-2026-0139 moved to Approved by credit team.", time: "3h ago",  unread: true,  caseId: "PL-2026-0139" },
  { id: "n3", type: "followup",  title: "Follow-up due",       desc: "Call Vikram Patel — BT-2026-0144 is on Hold.", time: "5h ago",  unread: true,  caseId: "BT-2026-0144" },
  { id: "n4", type: "status",    title: "Case disbursed",      desc: "Raj Kumar's CAR-2026-0148 has been disbursed.", time: "1d ago",  unread: false, caseId: "CAR-2026-0148" },
  { id: "n5", type: "document",  title: "Documents approved",  desc: "All docs for CAR-2026-0147 are verified.", time: "2d ago",  unread: false, caseId: "CAR-2026-0147" },
];

const TYPE_ICON = { document: FileText, status: TrendingUp, followup: Clock };
const TYPE_ICON_CLASS: Record<string, string> = {
  document: "bg-warning-subtle text-warning",
  status:   "bg-success-subtle text-success",
  followup: "bg-info-subtle text-info",
};

export default function NotificationsPage() {
  const [tab, setTab] = useState("all");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = NOTIFICATIONS.filter((n) => !dismissed.has(n.id));
  const filtered = tab === "all" ? visible : tab === "unread" ? visible.filter((n) => n.unread) : visible.filter((n) => n.type === tab);

  return (
    <div className="space-y-5 animate-fadeIn max-w-2xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted mt-0.5">{visible.filter((n) => n.unread).length} unread alerts</p>
      </div>

      <Tabs
        tabs={[
          { id: "all",      label: "All",       count: visible.length },
          { id: "unread",   label: "Unread",    count: visible.filter((n) => n.unread).length },
          { id: "document", label: "Documents", count: visible.filter((n) => n.type === "document").length },
          { id: "status",   label: "Status",    count: visible.filter((n) => n.type === "status").length },
          { id: "followup", label: "Follow-up", count: visible.filter((n) => n.type === "followup").length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card flex items-center justify-center h-28">
            <p className="text-sm text-muted">No notifications here.</p>
          </div>
        ) : filtered.map((n) => {
          const Icon = TYPE_ICON[n.type as keyof typeof TYPE_ICON];
          return (
            <div key={n.id} className={cn("card p-4 flex gap-3 animate-fadeIn", n.unread && "border-l-4 border-l-primary bg-primary-subtle/20")}>
              <div className={`size-8 rounded-full grid place-items-center shrink-0 ${TYPE_ICON_CLASS[n.type]}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.unread && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted mt-0.5">{n.desc}</p>
                {n.caseId && <a href="/cases" className="text-xs text-primary hover:underline font-medium mt-1 block">View {n.caseId} →</a>}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-[11px] text-muted">{n.time}</span>
                <button onClick={() => setDismissed((d) => new Set([...d, n.id]))} className="size-5 grid place-items-center rounded text-muted hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
