"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Users, Building2, Car, CreditCard,
  ShieldCheck, Clipboard, BarChart3, UserCog, Bell, Settings,
  ChevronLeft, ChevronRight, Banknote, PanelLeft, Database,
} from "lucide-react";
import { cn } from "./ui";

interface NavItem { label: string; href: string; icon: React.ElementType; badge?: number }
interface NavSection { title?: string; items: NavItem[] }

const sections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Loan Operations",
    items: [
      { label: "Cases", href: "/cases", icon: FileText },
      { label: "Coordinators", href: "/coordinators", icon: Users },
      { label: "Banks & NBFCs", href: "/banks", icon: Building2 },
      { label: "Dealers", href: "/dealers", icon: Car },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Payout Management", href: "/payout", icon: Banknote },
    ],
  },
  {
    title: "Compliance",
    items: [
      { label: "Insurance MIS", href: "/insurance-mis", icon: ShieldCheck },
      { label: "RTO & Documents", href: "/rto-tracker", icon: Clipboard },
    ],
  },
  {
    title: "Master Data",
    items: [
      { label: "Document Types", href: "/document-types", icon: Database },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users & Roles", href: "/users", icon: UserCog },
      { label: "Notifications", href: "/notifications", icon: Bell },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "shrink-0 h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-[56px]" : "w-[220px]",
    )}>
      {/* Logo */}
      <div className={cn(
        "h-14 flex items-center border-b border-sidebar-border",
        collapsed ? "justify-center px-0" : "gap-2.5 px-4",
      )}>
        <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center shrink-0">
          <CreditCard className="size-3.5" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="font-bold text-[13px] leading-tight block">SAI Credit</span>
            <span className="text-[10px] text-muted leading-tight block">Admin Portal</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
        {sections.map((section, i) => (
          <div key={i} className="mb-1">
            {section.title && !collapsed && (
              <p className="px-2 pt-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted/70">
                {section.title}
              </p>
            )}
            {section.title && collapsed && <div className="mt-3 mb-1.5 mx-2 h-px bg-border" />}
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center h-8 rounded-md transition-all duration-100 relative group",
                    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                    active
                      ? "bg-sidebar-active text-sidebar-active-text"
                      : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />
                  )}
                  <item.icon className="size-[15px] shrink-0" />
                  {!collapsed && (
                    <span className="text-[13px] font-medium truncate">{item.label}</span>
                  )}
                  {item.badge && !collapsed && (
                    <span className="ml-auto text-[10px] font-bold bg-danger text-white rounded-full px-1.5 py-0.5 leading-none">
                      {item.badge}
                    </span>
                  )}
                  {/* Tooltip when collapsed */}
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

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center h-8 rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors",
            collapsed ? "justify-center" : "gap-2 px-2.5",
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : (
            <>
              <ChevronLeft className="size-4" />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
