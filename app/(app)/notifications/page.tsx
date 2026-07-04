"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, ShieldCheck, FileText, Clock, Check, CheckCircle2, RefreshCw, Plus, EyeOff } from "lucide-react";
import { Button, Badge, Tabs, SectionHeader, Skeleton, EmptyState, useToast, type BadgeTone } from "../../../components/ui";
import { notificationsApi, type AppNotification } from "../../../lib/api";

const TYPE_META: Record<string, { label: string; icon: React.ElementType; tone: BadgeTone }> = {
  insurance_reminder: { label: "Insurance",  icon: ShieldCheck,   tone: "danger"   },
  stagnant_case:      { label: "Stagnant",   icon: Clock,         tone: "warning"  },
  rto_complete:       { label: "RTO",        icon: CheckCircle2,  tone: "success"  },
  pipeline_complete:  { label: "Disbursed",  icon: CheckCircle2,  tone: "teal"     },
  document:           { label: "Document",   icon: FileText,      tone: "orange"   },
  new_case:           { label: "New Case",   icon: Plus,          tone: "info"     },
  default:            { label: "Alert",      icon: Bell,          tone: "neutral"  },
};

function getMeta(type: string) {
  return TYPE_META[type] ?? TYPE_META.default;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [tab, setTab] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list(100);
      setNotifications(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function toggleRead(n: AppNotification) {
    try {
      if (n.isRead) {
        await notificationsApi.markUnread(n._id);
        setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, isRead: false } : x));
      } else {
        await notificationsApi.markRead(n._id);
        setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, isRead: true } : x));
      }
    } catch {}
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast("success", "All notifications marked as read");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to mark all read");
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const typeGroups: Record<string, number> = {};
  for (const n of notifications) {
    typeGroups[n.type] = (typeGroups[n.type] ?? 0) + 1;
  }

  const filtered = notifications.filter(n => {
    if (tab === "all") return true;
    if (tab === "unread") return !n.isRead;
    return n.type === tab;
  });

  const knownTypes = Object.keys(TYPE_META).filter(t => t !== "default" && (typeGroups[t] ?? 0) > 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Notifications"
        description="System alerts for insurance reminders, stagnant cases, and pipeline events"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            {unreadCount > 0 && (
              <Button size="sm" loading={markingAll} onClick={markAllRead}>
                <Check className="size-3.5" /> Mark all read
              </Button>
            )}
          </div>
        }
      />

      {/* Type summary */}
      <div className={`grid gap-3 grid-cols-2 sm:grid-cols-${Math.min(4, Math.max(2, knownTypes.length + 1))}`}>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Total</span>
          <Badge tone="neutral">{notifications.length}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Unread</span>
          <Badge tone={unreadCount > 0 ? "danger" : "success"}>{unreadCount}</Badge>
        </div>
        {knownTypes.map(type => {
          const meta = getMeta(type);
          const count = typeGroups[type] ?? 0;
          if (!count) return null;
          return (
            <button
              key={type}
              onClick={() => setTab(type)}
              className={`card p-3 text-left transition-all hover:shadow-md ${tab === type ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <meta.icon className="size-4 text-muted" />
                <Badge tone={meta.tone}>{count}</Badge>
              </div>
              <p className="text-xs font-medium">{meta.label}</p>
            </button>
          );
        })}
      </div>

      <Tabs
        tabs={[
          { id: "all",    label: "All",    count: notifications.length },
          { id: "unread", label: "Unread", count: unreadCount },
          ...knownTypes.map(type => ({
            id: type,
            label: getMeta(type).label,
            count: typeGroups[type] ?? 0,
          })),
        ]}
        active={tab}
        onChange={setTab}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex items-center justify-center h-32">
          <EmptyState title="No notifications" description="You're all caught up." />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const meta = getMeta(n.type);
            const Icon = meta.icon;
            return (
              <div
                key={n._id}
                className={`card p-4 flex gap-4 transition-all animate-fadeIn ${
                  !n.isRead ? "border-l-4 border-l-primary bg-primary/5" : ""
                }`}
              >
                <div className="size-9 rounded-full grid place-items-center shrink-0 mt-0.5 bg-surface-2">
                  <Icon className="size-4 text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${!n.isRead ? "text-foreground" : "text-foreground-secondary"}`}>
                        {n.title}
                      </p>
                      {!n.isRead && <span className="size-1.5 rounded-full bg-primary shrink-0" />}
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-muted whitespace-nowrap">{timeAgo(n.createdAt)}</span>
                      <button
                        onClick={() => toggleRead(n)}
                        title={n.isRead ? "Mark as unread" : "Mark as read"}
                        className="size-6 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                      >
                        {n.isRead ? <EyeOff className="size-3.5" /> : <Check className="size-3.5" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">{n.message}</p>
                  {n.caseCode && (
                    <div className="mt-2">
                      <a href="/cases" className="text-xs text-primary hover:underline font-medium">
                        View {n.caseCode} →
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
