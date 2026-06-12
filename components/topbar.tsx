"use client";

import { useState } from "react";
import { Moon, Sun, Bell, LogOut, ChevronDown, Search, User } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme";
import { cn } from "./ui";

const mockNotifications = [
  { id: "1", title: "Document pending",   desc: "Upload Aadhaar for CAR-2026-0145", time: "1h ago",  unread: true  },
  { id: "2", title: "Status changed",     desc: "PL-2026-0139 moved to Approved",   time: "3h ago",  unread: true  },
  { id: "3", title: "Follow-up due",      desc: "CAR-2026-0140 — call customer",    time: "1d ago",  unread: false },
];

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = mockNotifications.filter((n) => n.unread).length;
  const initials = user ? (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "") : "··";

  return (
    <header className="h-14 sticky top-0 z-10 flex items-center gap-2 px-5 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
        <input placeholder="Search cases or customers…" className="input-base pl-8 text-xs h-8 bg-surface-2 border-border" />
      </div>

      <div className="flex items-center gap-0.5 ml-auto">
        <button onClick={toggle} className="size-8 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="relative">
          <button onClick={() => { setNotifOpen((o) => !o); setMenuOpen(false); }} className="size-8 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors relative">
            <Bell className="size-4" />
            {unread > 0 && <span className="absolute top-1 right-1 size-[7px] rounded-full bg-danger border border-background" />}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 mt-1 w-72 z-20 card p-0 overflow-hidden animate-slideUp">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <p className="text-sm font-semibold">Notifications</p>
                  {unread > 0 && <span className="text-xs bg-primary-subtle text-primary px-2 py-0.5 rounded-full font-medium">{unread} new</span>}
                </div>
                <div className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
                  {mockNotifications.map((n) => (
                    <div key={n.id} className={cn("flex gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer", n.unread && "bg-primary-subtle/20")}>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-muted">{n.desc}</p>
                      </div>
                      <span className="text-[10px] text-muted whitespace-nowrap">{n.time}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-border">
                  <Link href="/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-primary hover:underline font-medium">View all →</Link>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative ml-1">
          <button onClick={() => { setMenuOpen((o) => !o); setNotifOpen(false); }} className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-lg hover:bg-surface-2 transition-colors">
            <span className="size-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[11px] font-bold uppercase">{initials}</span>
            <span className="text-xs font-medium hidden sm:block text-foreground-secondary">{user?.firstName}</span>
            <ChevronDown className="size-3 text-muted" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 mt-1 w-48 z-20 card p-1.5 animate-slideUp">
                <div className="px-3 py-2 mb-1 border-b border-border">
                  <p className="text-[13px] font-semibold truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-secondary hover:bg-surface-2 transition-colors">
                  <User className="size-3.5" /> Profile
                </Link>
                <div className="border-t border-border mt-1 pt-1">
                  <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-danger-subtle transition-colors">
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
