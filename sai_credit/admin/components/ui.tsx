"use client";

import { forwardRef, createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { X, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, CheckCircle2, Info, XCircle, Loader2, Search, Inbox } from "lucide-react";

// ── Utility ──────────────────────────────────────────────────────────────────
export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ═══════════════════════════════════════════════════════════════════
// BUTTON
// ═══════════════════════════════════════════════════════════════════
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "xs" | "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm active:opacity-90",
  secondary: "bg-surface border border-border text-foreground hover:bg-surface-2 active:bg-surface-3",
  danger:    "bg-danger text-white hover:opacity-90 active:opacity-80",
  ghost:     "text-foreground-secondary hover:bg-surface-2 active:bg-surface-3",
  outline:   "border border-primary text-primary hover:bg-primary-subtle active:bg-primary-subtle",
};
const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[11px]",
  sm: "h-7 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
  }
>(({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none",
      buttonVariants[variant],
      buttonSizes[size],
      className,
    )}
    {...props}
  >
    {loading && <Loader2 className="size-3.5 animate-spin shrink-0" />}
    {children}
  </button>
));
Button.displayName = "Button";

// ═══════════════════════════════════════════════════════════════════
// INPUT / TEXTAREA / SELECT
// ═══════════════════════════════════════════════════════════════════
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("input-base", className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("input-base !h-auto py-2 resize-none", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn("input-base pr-8 cursor-pointer", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

// ═══════════════════════════════════════════════════════════════════
// LABEL
// ═══════════════════════════════════════════════════════════════════
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-[12px] font-medium text-foreground-secondary mb-1.5 uppercase tracking-wide", className)} {...props} />
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARD
// ═══════════════════════════════════════════════════════════════════
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...props} />;
}

// ═══════════════════════════════════════════════════════════════════
// BADGE / STATUS BADGE
// ═══════════════════════════════════════════════════════════════════
export type BadgeTone =
  | "success" | "danger" | "warning" | "info" | "neutral"
  | "purple" | "orange" | "teal" | "indigo" | "pink";

const badgeTones: Record<BadgeTone, string> = {
  success: "bg-success-subtle text-success border-success-border",
  danger:  "bg-danger-subtle text-danger border-danger-border",
  warning: "bg-warning-subtle text-warning border-warning-border",
  info:    "bg-info-subtle text-info border-info-border",
  neutral: "bg-surface-3 text-foreground-secondary border-border",
  purple:  "bg-purple-subtle text-purple border-purple-border",
  orange:  "bg-orange-subtle text-orange border-orange-border",
  teal:    "bg-teal-subtle text-teal border-teal-border",
  indigo:  "bg-[#EEF2FF] text-[#3730A3] border-[#C7D2FE] dark:bg-[#141430] dark:text-[#A5B4FC] dark:border-[#312E81]",
  pink:    "bg-[#FDF2F8] text-[#9D174D] border-[#FBCFE8] dark:bg-[#1A0812] dark:text-[#F9A8D4] dark:border-[#831843]",
};

export function Badge({ tone = "neutral", dot, className, children }: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
      badgeTones[tone],
      className,
    )}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80 shrink-0" />}
      {children}
    </span>
  );
}

// Case-status specific badge
export type CaseStatus =
  | "Sales" | "Pending" | "In Credit" | "Approved"
  | "Disbursed" | "Hold" | "Rejected" | "Cancelled";

const caseStatusTones: Record<CaseStatus, BadgeTone> = {
  "Sales":     "info",
  "Pending":   "warning",
  "In Credit": "purple",
  "Approved":  "teal",
  "Disbursed": "success",
  "Hold":      "orange",
  "Rejected":  "danger",
  "Cancelled": "neutral",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={caseStatusTones[status]} dot>{status}</Badge>;
}

export function toneFor(color?: string): BadgeTone {
  switch (color) {
    case "green": return "success";
    case "red": return "danger";
    case "amber": case "yellow": return "warning";
    case "blue": return "info";
    case "indigo": return "indigo";
    case "purple": return "purple";
    case "orange": return "orange";
    case "teal": return "teal";
    default: return "neutral";
  }
}

// ═══════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-surface-3 rounded-md animate-skeleton", className)} />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-border-subtle">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4 rounded", c === 0 ? "w-32" : c === cols - 1 ? "w-16" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="size-14 rounded-2xl bg-surface-3 grid place-items-center mb-4">
        <Icon className="size-7 text-muted" />
      </div>
      <p className="font-semibold text-foreground-secondary">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SORTABLE TABLE HEADER
// ═══════════════════════════════════════════════════════════════════
export type SortDir = "asc" | "desc" | null;

export function SortableTh({
  label,
  col,
  sort,
  onSort,
  className,
}: {
  label: string;
  col: string;
  sort: { col: string; dir: SortDir };
  onSort: (col: string) => void;
  className?: string;
}) {
  const active = sort.col === col;
  return (
    <th
      className={cn("cursor-pointer select-none group", className)}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-muted group-hover:text-foreground-secondary transition-colors">
          {active ? (
            sort.dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-40" />
          )}
        </span>
      </span>
    </th>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════
export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  onLimit,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
  onLimit: (l: number) => void;
}) {
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
      <div className="flex items-center gap-2 text-muted">
        <span>Rows per page</span>
        <Select
          className="!h-7 !w-20 text-xs"
          value={limit}
          onChange={(e) => onLimit(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <span>{start}–{end} of {total.toLocaleString("en-IN")}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => onPage(1)}>«</Button>
        <Button variant="ghost" size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</Button>
        <span className="px-3 text-xs text-foreground-secondary">{page} / {totalPages}</span>
        <Button variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</Button>
        <Button variant="ghost" size="xs" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>»</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DRAWER (slide-over panel)
// ═══════════════════════════════════════════════════════════════════
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = "max-w-2xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  width?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] animate-fadeIn"
        onClick={onClose}
      />
      <div className={cn(
        "absolute inset-y-0 right-0 w-full bg-surface flex flex-col shadow-2xl animate-slideIn",
        width,
      )}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div>
            {title && <h2 className="font-semibold text-lg tracking-tight">{title}</h2>}
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <X className="size-4" />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL (centered dialog)
// ═══════════════════════════════════════════════════════════════════
export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  const sizeClass = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" }[size];

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] animate-fadeIn" onClick={onClose} />
      <div className={cn("relative w-full card animate-slideUp p-0 overflow-hidden", sizeClass)}>
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              {title && <h2 className="font-semibold text-base">{title}</h2>}
              {description && <p className="text-sm text-muted mt-1">{description}</p>}
            </div>
            <button onClick={onClose} className="size-7 grid place-items-center rounded-md text-muted hover:bg-surface-2 transition-colors ml-4 shrink-0">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CONFIRM DIALOG
// ═══════════════════════════════════════════════════════════════════
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "danger",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <div className={cn("size-10 rounded-full grid place-items-center shrink-0",
            variant === "danger" ? "bg-danger-subtle" : "bg-primary-subtle"
          )}>
            <AlertTriangle className={cn("size-5", variant === "danger" ? "text-danger" : "text-primary")} />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            {description && <p className="text-sm text-muted mt-1">{description}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant} size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════════════
export type ToastType = "success" | "error" | "warning" | "info";
interface ToastItem { id: string; type: ToastType; message: string; }

const ToastContext = createContext<(type: ToastType, message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

const toastIcons: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};
const toastStyles: Record<ToastType, string> = {
  success: "border-success-border bg-success-subtle text-success",
  error:   "border-danger-border bg-danger-subtle text-danger",
  warning: "border-warning-border bg-warning-subtle text-warning",
  info:    "border-info-border bg-info-subtle text-info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = toastIcons[t.type];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur text-sm font-medium max-w-sm pointer-events-auto animate-toastIn",
                "bg-surface/95",
                toastStyles[t.type],
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="text-foreground">{t.message}</span>
              <button
                onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}
                className="ml-auto text-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════
export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex border-b border-border", className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            t.id === active
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              t.id === active ? "bg-primary-subtle text-primary" : "bg-surface-3 text-muted",
            )}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEARCH INPUT
// ═══════════════════════════════════════════════════════════════════
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// KPI CARD (animated number)
// ═══════════════════════════════════════════════════════════════════
export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "text-primary",
  sub,
  trend,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  accent?: string;
  sub?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <div className="card p-4 flex flex-col gap-2 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
        {Icon && <Icon className={cn("size-4 shrink-0", accent)} />}
      </div>
      <p className={cn("text-2xl font-bold tracking-tight font-mono", accent)}>{value}</p>
      {(sub || trend) && (
        <div className="flex items-center gap-2">
          {sub && <span className="text-xs text-muted">{sub}</span>}
          {trend && (
            <span className={cn("text-xs font-medium", trend.up ? "text-success" : "text-danger")}>
              {trend.up ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FILTER CHIP
// ═══════════════════════════════════════════════════════════════════
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-primary-subtle border-primary text-primary"
          : "bg-surface border-border text-foreground-secondary hover:bg-surface-2",
      )}
    >
      {label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════
export function ProgressBar({
  value,
  max = 100,
  tone = "primary",
  size = "md",
  showLabel,
}: {
  value: number;
  max?: number;
  tone?: "primary" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colorClass = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger:  "bg-danger",
  }[tone];

  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 rounded-full bg-surface-3 overflow-hidden", size === "sm" ? "h-1.5" : "h-2")}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-muted w-9 text-right">{pct}%</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION HEADER
// ═══════════════════════════════════════════════════════════════════
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY TIMELINE
// ═══════════════════════════════════════════════════════════════════
export function Timeline({ items }: {
  items: { label: string; time: string; user?: string; note?: string }[];
}) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      {items.map((item, i) => (
        <div key={i} className="relative animate-fadeIn" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="absolute -left-[18px] size-3.5 rounded-full bg-primary-subtle border-2 border-primary mt-0.5" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              {item.user && <p className="text-xs text-muted">by {item.user}</p>}
              {item.note && <p className="text-xs text-foreground-secondary mt-0.5 bg-surface-2 rounded px-2 py-1">{item.note}</p>}
            </div>
            <span className="text-[11px] text-muted whitespace-nowrap shrink-0">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
