"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard, FileText, Wallet, Building2, ShieldCheck,
  Bell, User, ChevronLeft, ChevronRight, Compass,
  CalendarDays, Receipt, Palmtree, Wallet as PayslipIcon,
} from "lucide-react";
import { cn } from "./ui";
import { notificationsApi } from "../lib/api";

const NAV = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Team",
    items: [
      { label: "Cases", href: "/cases", icon: FileText },
      { label: "Payout Management", href: "/payout", icon: Wallet },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Banks & Dealers", href: "/banks-dealers", icon: Building2 },
      { label: "Insurance",       href: "/insurance",     icon: ShieldCheck },
    ],
  },
  {
    title: "My HR",
    items: [
      { label: "Attendance", href: "/attendance", icon: CalendarDays },
      { label: "My Leaves",  href: "/leaves",     icon: Palmtree },
      { label: "My Claims",  href: "/claims",     icon: Receipt },
      { label: "Payslips",   href: "/payslips",   icon: PayslipIcon },
    ],
  },
  {
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "My Profile",    href: "/profile",       icon: User },
    ],
  },
];

type NavItem = { label: string; icon: React.ElementType; href: string };

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const { data } = await notificationsApi.unreadCount();
      setNotifUnread(data.count);
    } catch {}
  }, []);

  useEffect(() => {
    refreshUnread();
    const iv = setInterval(refreshUnread, 30000);
    return () => clearInterval(iv);
  }, [refreshUnread]);

  return (
    <aside className={cn(
      "shrink-0 h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-[56px]" : "w-[210px]",
    )}>
      <div className={cn("h-14 flex items-center border-b border-sidebar-border", collapsed ? "justify-center" : "gap-2.5 px-4")}>
        <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Compass className="size-3.5" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-[13px] block leading-tight">Sai Credit Solutions</span>
            <span className="text-[10px] text-muted block leading-tight">Coordinator Portal</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && !collapsed && (
              <p className="px-2 pt-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted/70">{section.title}</p>
            )}
            {section.title && collapsed && <div className="mt-3 mb-1.5 mx-2 h-px bg-border" />}
            {(section.items as NavItem[]).map((navItem) => {
              const active = pathname === navItem.href || pathname.startsWith(navItem.href + "/");
              const badge = navItem.href === "/notifications" ? notifUnread : 0;
              return (
                <Link
                  key={navItem.href} href={navItem.href}
                  title={collapsed ? navItem.label : undefined}
                  className={cn(
                    "flex items-center h-8 rounded-md transition-all group relative",
                    collapsed ? "justify-center" : "gap-2.5 px-2.5",
                    active ? "bg-sidebar-active text-sidebar-active-text" : "text-foreground-secondary hover:bg-surface-2/70 hover:text-foreground",
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
                  <span className="relative shrink-0">
                    <navItem.icon className="size-[15px]" />
                    {badge > 0 && collapsed && (
                      <span className="absolute -top-0.5 -right-0.5 size-[7px] rounded-full bg-danger border border-sidebar" />
                    )}
                  </span>
                  {!collapsed && <span className="text-[13px] font-medium truncate">{navItem.label}</span>}
                  {badge > 0 && !collapsed && (
                    <span className="ml-auto text-[10px] font-bold bg-danger text-white rounded-full px-1.5 py-0.5 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                      {navItem.label}{badge > 0 ? ` (${badge})` : ""}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn("w-full flex items-center h-8 rounded-md text-muted hover:bg-surface-2 transition-colors", collapsed ? "justify-center" : "gap-2 px-2.5")}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /><span className="text-xs font-medium">Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
