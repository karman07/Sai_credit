"use client";

import { useState, useEffect } from "react";
import {
  Bell, FileText, TrendingUp, Clock, CheckCircle2, XCircle,
  IndianRupee, Award, CalendarCheck, CalendarX, Receipt, ReceiptText,
} from "lucide-react";
import { notificationsApi, type Notification } from "../../../lib/api";
import { cn } from "../../../components/ui";

type NotifCategory = "all" | "unread" | "hr" | "case";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const HR_TYPES = new Set([
  "leave_approved", "leave_rejected",
  "claim_approved", "claim_rejected",
  "payroll_paid", "incentive_added",
]);

function isHR(type: string) { return HR_TYPES.has(type); }

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bg: string; text: string }> = {
  leave_approved:   { icon: CalendarCheck, bg: "bg-green-100",  text: "text-green-700" },
  leave_rejected:   { icon: CalendarX,     bg: "bg-red-100",    text: "text-red-600" },
  claim_approved:   { icon: Receipt,       bg: "bg-green-100",  text: "text-green-700" },
  claim_rejected:   { icon: ReceiptText,   bg: "bg-red-100",    text: "text-red-600" },
  payroll_paid:     { icon: IndianRupee,   bg: "bg-blue-100",   text: "text-blue-700" },
  incentive_added:  { icon: Award,         bg: "bg-yellow-100", text: "text-yellow-700" },
  insurance_reminder: { icon: Bell,        bg: "bg-orange-100", text: "text-orange-700" },
  pipeline_complete:  { icon: CheckCircle2, bg: "bg-green-100", text: "text-green-700" },
  rto_complete:       { icon: CheckCircle2, bg: "bg-green-100", text: "text-green-700" },
  stagnant_case:      { icon: Clock,        bg: "bg-yellow-100", text: "text-yellow-700" },
  general:            { icon: Bell,         bg: "bg-surface-2",  text: "text-muted" },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["general"];
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<NotifCategory>("all");

  async function load() {
    setLoading(true);
    try {
      const res = await notificationsApi.list(100);
      setNotifications(res.data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: string) {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications((prev) => prev.map((n) => n._id === id ? { ...n, isRead: true } : n));
  }

  useEffect(() => { load(); }, []);

  const unread    = notifications.filter((n) => !n.isRead);
  const hrItems   = notifications.filter((n) => isHR(n.type));
  const caseItems = notifications.filter((n) => !isHR(n.type));

  const tabs: { id: NotifCategory; label: string; count: number }[] = [
    { id: "all",    label: "All",      count: notifications.length },
    { id: "unread", label: "Unread",   count: unread.length },
    { id: "hr",     label: "HR & Pay", count: hrItems.length },
    { id: "case",   label: "Cases",    count: caseItems.length },
  ];

  const filtered =
    tab === "all"    ? notifications :
    tab === "unread" ? unread :
    tab === "hr"     ? hrItems :
    caseItems;

  return (
    <div className="space-y-5 animate-fadeIn max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted mt-0.5">{unread.length} unread</p>
        </div>
        {unread.length > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full",
                tab === t.id ? "bg-primary text-white" : "bg-surface-2 text-muted"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="card flex items-center justify-center h-28">
            <p className="text-sm text-muted">Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center h-28 gap-2">
            <Bell className="size-8 text-muted/30" />
            <p className="text-sm text-muted">No notifications here.</p>
          </div>
        ) : filtered.map((n) => {
          const cfg  = getConfig(n.type);
          const Icon = cfg.icon;
          return (
            <button
              key={n._id}
              onClick={() => !n.isRead && markRead(n._id)}
              className={cn(
                "w-full text-left card p-4 flex gap-3 transition-colors hover:bg-surface-2/40",
                !n.isRead && "border-l-4 border-l-primary bg-primary-subtle/10"
              )}
            >
              <div className={`size-9 rounded-full grid place-items-center shrink-0 ${cfg.bg} ${cfg.text}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {!n.isRead && <span className="size-2 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.message}</p>
                {n.caseCode && (
                  <span className="text-xs text-primary font-medium mt-1 block">{n.caseCode}</span>
                )}
              </div>
              <span className="text-[11px] text-muted shrink-0 mt-0.5">
                {timeAgo(n.createdAt)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
