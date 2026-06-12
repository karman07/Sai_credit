"use client";

import { useState, useRef, useEffect } from "react";
import { Moon, Sun, Bell, LogOut, ChevronDown, Search, Settings, User } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme";
import { cn } from "./ui";

const ROLE_LABELS: Record<string, string> = {
  owner:      "Owner",
  admin:      "Administrator",
  operations: "Operations",
  manager:    "Manager",
  auditor:    "Auditor",
};

const mockNotifications = [
  { id: "1", type: "payout",    title: "Payout overdue",         desc: "HDFC Bank — Jun invoice pending", time: "2h ago",   unread: true },
  { id: "2", type: "insurance", title: "Insurance expiring",     desc: "3 policies expire within 30 days", time: "5h ago",   unread: true },
  { id: "3", type: "document",  title: "Document missing",       desc: "Raj Kumar — Aadhaar address mismatch", time: "1d ago", unread: true },
  { id: "4", type: "stagnant",  title: "Case stagnant",          desc: "CAR-2026-0112 no update in 7 days", time: "2d ago",  unread: false },
];

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const unread = mockNotifications.filter((n) => n.unread).length;

  const initials = user
    ? (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
    : "··";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="h-14 sticky top-0 z-10 flex items-center gap-2 px-5 bg-background/85 backdrop-blur-md border-b border-border">
      {/* Global search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
        <input
          ref={searchRef}
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder="Search cases, customers…"
          className="input-base pl-8 pr-12 text-xs h-8 bg-surface-2 border-border"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted bg-surface-3 border border-border rounded px-1 pointer-events-none hidden sm:block">
          ⌘K
        </kbd>
      </div>

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
            {unread > 0 && (
              <span className="absolute top-1 right-1 size-[7px] rounded-full bg-danger border border-background" />
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-1 w-80 z-20 card p-0 overflow-hidden animate-slideUp">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unread > 0 && (
                    <span className="text-xs bg-primary-subtle text-primary px-2 py-0.5 rounded-full font-medium">
                      {unread} new
                    </span>
                  )}
                </div>
                <div className="divide-y divide-border-subtle max-h-80 overflow-y-auto">
                  {mockNotifications.map((n) => (
                    <div key={n.id} className={cn(
                      "flex gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer",
                      n.unread && "bg-primary-subtle/30",
                    )}>
                      <div className={cn(
                        "size-8 rounded-full grid place-items-center shrink-0 mt-0.5",
                        n.type === "payout"    && "bg-warning-subtle text-warning",
                        n.type === "insurance" && "bg-danger-subtle text-danger",
                        n.type === "document"  && "bg-orange-subtle text-orange",
                        n.type === "stagnant"  && "bg-surface-3 text-muted",
                      )}>
                        <Bell className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", n.unread && "text-foreground")}>{n.title}</p>
                        <p className="text-xs text-muted truncate">{n.desc}</p>
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap shrink-0">{n.time}</span>
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
