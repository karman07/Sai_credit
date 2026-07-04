"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun, Bell, LogOut, ChevronDown, Settings, User, Check } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme";
import { cn } from "./ui";
import { notificationsApi, type AppNotification } from "../lib/api";

const ROLE_LABELS: Record<string, string> = {
  owner:      "Owner",
  admin:      "Administrator",
  operations: "Operations",
  manager:    "Manager",
  auditor:    "Auditor",
};

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

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifs = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationsApi.list(5),
        notificationsApi.unreadCount(),
      ]);
      setNotifications(listRes.data);
      setUnreadCount(countRes.data.count);
    } catch {}
  }, []);

  useEffect(() => {
    loadNotifs();
    const iv = setInterval(loadNotifs, 60000);
    return () => clearInterval(iv);
  }, [loadNotifs]);

  const initials = user
    ? (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
    : "··";

  async function markAllRead(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  }

  return (
    <header className="h-14 sticky top-0 z-10 flex items-center gap-2 px-5 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-0.5 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="size-8 grid place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          title="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-[16px]" /> : <Moon className="size-[16px]" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }}
            className="size-8 grid place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors relative"
          >
            <Bell className="size-[16px]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border border-background leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-1 w-80 z-20 card p-0 overflow-hidden animate-slideUp">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notifications</p>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <>
                        <span className="text-xs bg-primary-subtle text-primary px-2 py-0.5 rounded-full font-medium">
                          {unreadCount} new
                        </span>
                        <button onClick={markAllRead} className="size-6 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors" title="Mark all read">
                          <Check className="size-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted">No notifications</div>
                  ) : notifications.map((n) => (
                    <div key={n._id} className={cn(
                      "flex gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer",
                      !n.isRead && "bg-primary/5",
                    )}>
                      <div className="size-8 rounded-full grid place-items-center shrink-0 mt-0.5 bg-surface-2">
                        <Bell className="size-3.5 text-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", !n.isRead && "text-foreground")}>{n.title}</p>
                        <p className="text-xs text-muted truncate">{n.message}</p>
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-border">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View all notifications →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative ml-1">
          <button
            onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }}
            className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-md hover:bg-surface-2 transition-colors"
          >
            <span className="size-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold uppercase">
              {initials}
            </span>
            <span className="text-xs font-medium hidden sm:block text-foreground-secondary">
              {user?.firstName}
            </span>
            <ChevronDown className="size-3 text-muted" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-52 z-20 card p-1.5 animate-slideUp">
                <div className="px-3 py-2 mb-1 border-b border-border">
                  <p className="text-[13px] font-semibold truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                  <p className="text-[10px] text-muted mt-0.5">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground-secondary hover:bg-surface-2 transition-colors"
                >
                  <User className="size-3.5" /> Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-foreground-secondary hover:bg-surface-2 transition-colors"
                >
                  <Settings className="size-3.5" /> Settings
                </Link>
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-danger hover:bg-danger-subtle transition-colors"
                  >
                    <LogOut className="size-3.5" /> Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
