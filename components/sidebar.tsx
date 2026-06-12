"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FilePlus, FileText, Building2, ShieldCheck,
  Clipboard, CreditCard, Bell, User, ChevronLeft, ChevronRight, Leaf,
} from "lucide-react";
import { cn } from "./ui";

const NAV = [
  { items: [{ label: "Dashboard",      href: "/dashboard",     icon: LayoutDashboard }] },
  {
    title: "Cases",
    items: [
      { label: "New Lead",             href: "/new-lead",       icon: FilePlus },
      { label: "My Cases",             href: "/cases",          icon: FileText },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Banks & Dealers",      href: "/banks-dealers",  icon: Building2 },
      { label: "Insurance Entry",      href: "/insurance",      icon: ShieldCheck },
      { label: "RTO Checklist",        href: "/rto-checklist",  icon: Clipboard },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payout Status",        href: "/payout",         icon: CreditCard },
    ],
  },
  {
    items: [
      { label: "Notifications",        href: "/notifications",  icon: Bell },
      { label: "My Profile",           href: "/profile",        icon: User },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "shrink-0 h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-[56px]" : "w-[210px]",
    )}>
      <div className={cn("h-14 flex items-center border-b border-sidebar-border", collapsed ? "justify-center" : "gap-2.5 px-4")}>
        <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Leaf className="size-3.5" />
        </div>
        {!collapsed && (
          <div>
            <span className="font-bold text-[13px] block leading-tight">Sai Credit Solutions</span>
            <span className="text-[10px] text-muted block leading-tight">Sales Portal</span>
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
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href} href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center h-8 rounded-md transition-all group relative",
                    collapsed ? "justify-center" : "gap-2.5 px-2.5",
                    active ? "bg-sidebar-active text-sidebar-active-text" : "text-foreground-secondary hover:bg-surface-2/70 hover:text-foreground",
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
                  <item.icon className="size-[15px] shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium truncate">{item.label}</span>}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                      {item.label}
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
