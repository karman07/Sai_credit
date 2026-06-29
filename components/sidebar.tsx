"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, FileText, Building2, ShieldCheck,
  Bell, User, ChevronLeft, ChevronRight, Leaf, Users,
  CalendarDays, Receipt, Palmtree, ChevronDown, IndianRupee,
} from "lucide-react";
import { cn } from "./ui";

const NAV = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    title: "Cases",
    items: [
      {
        label: "Cases",
        icon: FileText,
        dropdown: [
          { label: "My Cases",  href: "/cases" },
          { label: "All Cases", href: "/cases?all=true" },
        ],
      },
      { label: "Customers", href: "/customers", icon: Users },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Insurance Leads", href: "/insurance-leads", icon: Users     },
      { label: "Banks & Dealers", href: "/banks-dealers",   icon: Building2 },
      { label: "Insurance Entry", href: "/insurance",       icon: ShieldCheck },
    ],
  },
  {
    title: "My HR",
    items: [
      { label: "Attendance",   href: "/attendance", icon: CalendarDays },
      { label: "My Leaves",    href: "/leaves",     icon: Palmtree },
      { label: "My Claims",    href: "/claims",     icon: Receipt },
      { label: "My Payslips",  href: "/payslips",   icon: IndianRupee },
    ],
  },
  {
    items: [
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "My Profile",    href: "/profile",       icon: User },
    ],
  },
];

type DropdownItem = { label: string; href: string };
type NavItem = {
  label: string;
  icon: React.ElementType;
  href?: string;
  dropdown?: DropdownItem[];
};

function DropdownNavItem({ item, collapsed }: { item: NavItem & { dropdown: DropdownItem[] }; collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentHref = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");

  const isChildActive = item.dropdown.some((d) => {
    const [dPath, dQuery] = d.href.split("?");
    if (dQuery) {
      return pathname === dPath && searchParams.toString() === dQuery;
    }
    return pathname === dPath && !searchParams.get("all");
  });

  const [open, setOpen] = useState(isChildActive);

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center justify-center h-8 w-full rounded-md transition-all relative",
            isChildActive ? "bg-sidebar-active text-sidebar-active-text" : "text-foreground-secondary hover:bg-surface-2/70 hover:text-foreground",
          )}
        >
          {isChildActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
          <item.icon className="size-[15px] shrink-0" />
        </button>
        <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block">
          <div className="bg-surface border border-border rounded-md shadow-lg py-1 min-w-[140px]">
            <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted/70">{item.label}</p>
            {item.dropdown.map((d) => {
              const [dPath, dQuery] = d.href.split("?");
              const active = dQuery
                ? pathname === dPath && searchParams.toString() === dQuery
                : pathname === dPath && !searchParams.get("all");
              return (
                <Link key={d.href} href={d.href}
                  className={cn("block px-3 py-1.5 text-xs font-medium transition-colors", active ? "text-primary" : "text-foreground-secondary hover:text-foreground hover:bg-surface-2")}>
                  {d.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 h-8 rounded-md transition-all relative",
          isChildActive ? "bg-sidebar-active text-sidebar-active-text" : "text-foreground-secondary hover:bg-surface-2/70 hover:text-foreground",
        )}
      >
        {isChildActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
        <item.icon className="size-[15px] shrink-0" />
        <span className="text-[13px] font-medium truncate flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="ml-[26px] mt-0.5 space-y-0.5 border-l border-border pl-2.5">
          {item.dropdown.map((d) => {
            const [dPath, dQuery] = d.href.split("?");
            const active = dQuery
              ? pathname === dPath && searchParams.toString() === dQuery
              : pathname === dPath && !searchParams.get("all");
            return (
              <Link key={d.href} href={d.href}
                className={cn(
                  "flex items-center h-7 rounded-md px-2 text-[12.5px] font-medium transition-all relative",
                  active ? "text-primary bg-primary/8" : "text-foreground-secondary hover:text-foreground hover:bg-surface-2/70",
                )}>
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-r-full bg-primary" />}
                {d.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
              if ((item as NavItem).dropdown) {
                return (
                  <DropdownNavItem key={item.label} item={item as NavItem & { dropdown: DropdownItem[] }} collapsed={collapsed} />
                );
              }
              const navItem = item as NavItem & { href: string };
              const active = pathname === navItem.href || (navItem.href !== "/dashboard" && pathname.startsWith(navItem.href));
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
                  <navItem.icon className="size-[15px] shrink-0" />
                  {!collapsed && <span className="text-[13px] font-medium truncate">{navItem.label}</span>}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                      {navItem.label}
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
