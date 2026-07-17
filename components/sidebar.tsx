"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import {
  LayoutDashboard, FileText, Users, Building2, Car, CreditCard,
  ShieldCheck, Clipboard, BarChart3, UserCog, Bell, Mail,
  ChevronLeft, ChevronRight, Banknote, Database,
  ChevronDown, ChevronUp, Map, MapPin,
  CalendarDays, Receipt, Palmtree, IndianRupee, Sliders, ListOrdered, Tags,
} from "lucide-react";
import { cn } from "./ui";
import { notificationsApi } from "../lib/api";

// ── Catalog sub-items definition ──────────────────────────────────────────────

type CatalogEntry =
  | { kind: "sep"; group: string }
  | { kind: "item"; slug: string; label: string; icon: React.ElementType; dot: string };

const CATALOG_ENTRIES: CatalogEntry[] = [
  { kind: "sep",  group: "Insurance & Finance" },
  { kind: "item", slug: "insurance-companies", label: "Insurance Companies", icon: ShieldCheck, dot: "bg-blue-500" },
  { kind: "sep",  group: "Vehicles" },
  { kind: "item", slug: "vehicle-types",       label: "Vehicle Types",       icon: Car,         dot: "bg-green-500" },
  { kind: "sep",  group: "Geography" },
  { kind: "item", slug: "states",              label: "States",              icon: Map,         dot: "bg-orange-500" },
  { kind: "item", slug: "cities",              label: "Cities",              icon: MapPin,      dot: "bg-orange-500" },
  { kind: "sep",  group: "Documents" },
  { kind: "item", slug: "document-types",      label: "Document Types",      icon: FileText,    dot: "bg-neutral-400" },
  { kind: "sep",  group: "Form Options" },
  { kind: "item", slug: "enum-sets",           label: "Enum Sets",           icon: ListOrdered, dot: "bg-violet-500"  },
  { kind: "sep",  group: "Loan Operations" },
  { kind: "item", slug: "case-statuses",        label: "Case Statuses",       icon: Tags,        dot: "bg-sky-500"     },
];

// ── Catalog dropdown (needs useSearchParams → wrap in Suspense) ───────────────

function CatalogDropdownInner({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const isOnMasters = pathname.startsWith("/masters");
  const activeSlug = isOnMasters ? (params.get("type") ?? "insurance-companies") : "";
  const [open, setOpen] = useState(isOnMasters);

  // Auto-open when user navigates to /masters from outside
  useEffect(() => { if (isOnMasters) setOpen(true); }, [isOnMasters]);

  if (collapsed) {
    return (
      <Link
        href="/masters"
        title="Data Catalog"
        className={cn(
          "flex items-center justify-center h-8 rounded-md transition-all duration-100 relative group",
          isOnMasters
            ? "bg-sidebar-active text-sidebar-active-text"
            : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
        )}
      >
        {isOnMasters && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
        <Database className="size-[15px] shrink-0" />
        <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
          Data Catalog
        </span>
      </Link>
    );
  }

  return (
    <div>
      {/* Header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center h-8 rounded-md transition-all duration-100 relative gap-2.5 px-2.5",
          isOnMasters
            ? "bg-sidebar-active text-sidebar-active-text"
            : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
        )}
      >
        {isOnMasters && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
        <Database className="size-[15px] shrink-0" />
        <span className="text-[13px] font-medium truncate flex-1 text-left">Data Catalog</span>
        {open
          ? <ChevronUp className="size-3 shrink-0 opacity-60" />
          : <ChevronDown className="size-3 shrink-0 opacity-60" />}
      </button>

      {/* Dropdown items */}
      {open && (
        <div className="mt-0.5 ml-3 pl-2.5 border-l border-border space-y-0.5">
          {CATALOG_ENTRIES.map((entry, i) => {
            if (entry.kind === "sep") {
              return (
                <p key={i} className="text-[9px] font-bold uppercase tracking-widest text-muted/60 px-1 pt-2 pb-0.5 first:pt-1">
                  {entry.group}
                </p>
              );
            }
            const isActive = activeSlug === entry.slug;
            return (
              <Link
                key={entry.slug}
                href={`/masters?type=${entry.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 rounded-full shrink-0", isActive ? "bg-primary" : entry.dot)} />
                <entry.icon className={cn("size-3 shrink-0", isActive ? "text-primary" : "text-muted")} />
                <span className="truncate">{entry.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CatalogDropdown({ collapsed }: { collapsed: boolean }) {
  return (
    <Suspense fallback={
      <div className={cn(
        "flex items-center h-8 rounded-md text-foreground-secondary gap-2.5",
        collapsed ? "justify-center" : "px-2.5",
      )}>
        <Database className="size-[15px] shrink-0" />
        {!collapsed && <span className="text-[13px] font-medium">Data Catalog</span>}
      </div>
    }>
      <CatalogDropdownInner collapsed={collapsed} />
    </Suspense>
  );
}

// ── Regular nav sections ───────────────────────────────────────────────────────

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
      { label: "Cases",        href: "/cases",        icon: FileText  },
      { label: "Customers",    href: "/customers",    icon: Users     },
      { label: "Banks & NBFCs",href: "/banks",        icon: Building2 },
      { label: "Dealers",      href: "/dealers",      icon: Car       },
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
      { label: "Insurance Leads", href: "/insurance-leads", icon: Users      },
      { label: "Insurance MIS",   href: "/insurance-mis",   icon: ShieldCheck },
      { label: "RTO & Documents", href: "/rto-tracker",     icon: Clipboard   },
    ],
  },
  {
    title: "Analytics",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "HR & Payroll",
    items: [
      { label: "Payroll",        href: "/payroll",       icon: IndianRupee  },
      { label: "Attendance",     href: "/attendance",    icon: CalendarDays },
      { label: "Leaves",         href: "/leaves",        icon: Palmtree     },
      { label: "Leave Policy",   href: "/leave-policy",  icon: Sliders      },
      { label: "Claims",         href: "/claims",        icon: Receipt      },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users & Roles",  href: "/users",         icon: UserCog },
      { label: "Notifications",  href: "/notifications", icon: Bell    },
      { label: "Mail Templates", href: "/mail-templates",icon: Mail    },
    ],
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

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
      collapsed ? "w-[56px]" : "w-[220px]",
    )}>
      {/* Logo */}
      <div className={cn(
        "h-14 flex items-center border-b border-sidebar-border shrink-0",
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
              const badge = item.href === "/notifications" ? notifUnread : (item.badge ?? 0);
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
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
                  <span className="relative shrink-0">
                    <item.icon className="size-[15px]" />
                    {badge > 0 && collapsed && (
                      <span className="absolute -top-0.5 -right-0.5 size-[7px] rounded-full bg-danger border border-sidebar" />
                    )}
                  </span>
                  {!collapsed && (
                    <span className="text-[13px] font-medium truncate">{item.label}</span>
                  )}
                  {badge > 0 && !collapsed && (
                    <span className="ml-auto text-[10px] font-bold bg-danger text-white rounded-full px-1.5 py-0.5 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {collapsed && (
                    <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                      {item.label}{badge > 0 ? ` (${badge})` : ""}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Configuration section — inject after Finance */}
            {section.title === "Finance" && (() => {
              const fbActive = pathname.startsWith("/form-builder");
              return (
                <div className="mb-1">
                  {!collapsed && (
                    <p className="px-2 pt-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted/70">
                      Configuration
                    </p>
                  )}
                  {collapsed && <div className="mt-3 mb-1.5 mx-2 h-px bg-border" />}
                  <CatalogDropdown collapsed={collapsed} />
                  <Link
                    href="/form-builder"
                    title={collapsed ? "Form Builder" : undefined}
                    className={cn(
                      "flex items-center h-8 rounded-md transition-all duration-100 relative group mt-0.5",
                      collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                      fbActive
                        ? "bg-sidebar-active text-sidebar-active-text"
                        : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {fbActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />}
                    <Sliders className="size-[15px] shrink-0" />
                    {!collapsed && <span className="text-[13px] font-medium truncate">Form Builder</span>}
                    {collapsed && (
                      <span className="absolute left-full ml-2 px-2 py-1 bg-surface border border-border rounded-md text-xs text-foreground font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg z-50">
                        Form Builder
                      </span>
                    )}
                  </Link>
                </div>
              );
            })()}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
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
