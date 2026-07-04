"use client";

import { forwardRef, createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, XCircle, AlertTriangle, Info, Loader2, Search, Inbox } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ── Button ──────────────────────────────────────────────────────────
type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type BtnSize = "xs" | "sm" | "md" | "lg";
const btnVariants: Record<BtnVariant, string> = {
  primary:   "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary: "bg-surface border border-border text-foreground hover:bg-surface-2",
  danger:    "bg-danger text-white hover:opacity-90",
  ghost:     "text-foreground-secondary hover:bg-surface-2",
  outline:   "border border-primary text-primary hover:bg-primary-subtle",
};
const btnSizes: Record<BtnSize, string> = {
  xs: "h-6 px-2 text-[11px]", sm: "h-7 px-3 text-xs", md: "h-9 px-4 text-sm", lg: "h-10 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean }>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref} disabled={disabled || loading}
      className={cn("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none select-none", btnVariants[variant], btnSizes[size], className)}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("input-base", className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn("input-base !h-auto py-2 resize-none", className)} {...props} />
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn("input-base pr-8 cursor-pointer", className)} {...props}>{children}</select>
  )
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[12px] font-medium text-foreground-secondary mb-1.5 uppercase tracking-wide", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-5", className)} {...props} />;
}

// ── Badge ────────────────────────────────────────────────────────────
export type BadgeTone = "success" | "danger" | "warning" | "info" | "neutral" | "purple" | "orange";
const badgeTones: Record<BadgeTone, string> = {
  success: "bg-success-subtle text-success border-success-border",
  danger:  "bg-danger-subtle text-danger border-danger-border",
  warning: "bg-warning-subtle text-warning border-warning-border",
  info:    "bg-info-subtle text-info border-info-border",
  neutral: "bg-surface-3 text-foreground-secondary border-border",
  purple:  "bg-purple-subtle text-purple border-purple-border",
  orange:  "bg-orange-subtle text-orange border-orange-border",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: BadgeTone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", badgeTones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80 shrink-0" />}
      {children}
    </span>
  );
}

export type CaseStatus = string;
const CORE_STATUS_TONES: Record<string, BadgeTone> = {
  "Draft": "neutral", "Sales": "info", "Pending": "warning", "In Credit": "purple",
  "Incomplete": "orange", "Approved": "success",
  "Disbursed": "success", "Hold": "warning", "Rejected": "danger", "Cancelled": "neutral",
};
export function CaseStatusBadge({ status }: { status: string }) {
  return <Badge tone={CORE_STATUS_TONES[status] ?? "neutral"} dot>{status}</Badge>;
}

// ── Skeleton ────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-surface-3 rounded-md animate-skeleton", className)} />;
}

// ── Empty State ─────────────────────────────────────────────────────
export function EmptyState({ icon: Icon = Inbox, title, description, action }: { icon?: React.ElementType; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <div className="size-12 rounded-2xl bg-surface-3 grid place-items-center mb-3">
        <Icon className="size-6 text-muted" />
      </div>
      <p className="font-semibold text-foreground-secondary">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────
import { useEffect } from "react";
export function Modal({ open, onClose, title, description, size = "md", children }: { open: boolean; onClose: () => void; title?: string; description?: string; size?: "sm" | "md" | "lg" | "xl"; children: React.ReactNode }) {
  const sizeClass = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" }[size];
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (!open) return null;
  const content = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] animate-fadeIn" onClick={onClose} />
      <div className={cn("relative w-full card animate-slideUp p-0 overflow-hidden", sizeClass)}>
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-border">
            <div>
              {title && <h2 className="font-semibold text-base">{title}</h2>}
              {description && <p className="text-sm text-muted mt-1">{description}</p>}
            </div>
            <button onClick={onClose} className="size-7 grid place-items-center rounded-lg text-muted hover:bg-surface-2 transition-colors ml-4 shrink-0"><X className="size-3.5" /></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

// ── Drawer ───────────────────────────────────────────────────────────
export function Drawer({ open, onClose, title, description, size = "lg", children }: { open: boolean; onClose: () => void; title?: string; description?: string; size?: "sm" | "md" | "lg" | "xl"; children: React.ReactNode }) {
  const sizeClass = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-xl", xl: "max-w-2xl" }[size];
  useEffect(() => { if (open) document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, [open]);
  if (!open) return null;
  const content = (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px] animate-fadeIn" onClick={onClose} />
      <div className={cn("relative w-full h-full bg-surface border-l border-border flex flex-col animate-drawerIn shadow-2xl", sizeClass)}>
        {(title || description) && (
          <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
            <div className="min-w-0">
              {title && <h2 className="font-semibold text-base">{title}</h2>}
              {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="size-7 grid place-items-center rounded-lg text-muted hover:bg-surface-2 transition-colors ml-4 shrink-0"><X className="size-3.5" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

// ── Toast ────────────────────────────────────────────────────────────
export type ToastType = "success" | "error" | "warning" | "info";
interface ToastItem { id: string; type: ToastType; message: string; }
const ToastContext = createContext<(type: ToastType, message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);
const toastIcons: Record<ToastType, React.ElementType> = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const toastStyles: Record<ToastType, string> = {
  success: "border-success-border text-success",
  error:   "border-danger-border text-danger",
  warning: "border-warning-border text-warning",
  info:    "border-info-border text-info",
};
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const Icon = toastIcons[t.type];
          return (
            <div key={t.id} className={cn("flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg text-sm font-medium max-w-sm pointer-events-auto animate-toastIn bg-surface/95", toastStyles[t.type])}>
              <Icon className="size-4 shrink-0" />
              <span className="text-foreground">{t.message}</span>
              <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="ml-auto text-muted"><X className="size-3.5" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange, className }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void; className?: string }) {
  return (
    <div className={cn("flex border-b border-border", className)}>
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors", t.id === active ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
          {t.label}
          {t.count !== undefined && <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", t.id === active ? "bg-primary-subtle text-primary" : "bg-surface-3 text-muted")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Search Input ─────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = "Search…", className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="!pl-8 bg-surface-2 focus:bg-surface transition-colors" />
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, total, limit, onPage, onLimit }: { page: number; totalPages: number; total: number; limit: number; onPage: (p: number) => void; onLimit: (l: number) => void }) {
  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
      <div className="flex items-center gap-2 text-muted text-xs">
        <Select className="!h-7 !w-20 text-xs" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
          {[10,25,50].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <span>{start}–{end} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="xs" disabled={page<=1} onClick={() => onPage(page-1)}>‹</Button>
        <span className="px-2 text-xs text-foreground-secondary">{page}/{totalPages}</span>
        <Button variant="ghost" size="xs" disabled={page>=totalPages} onClick={() => onPage(page+1)}>›</Button>
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────
export function KpiCard({ label, value, icon: Icon, accent = "text-primary", sub }: { label: string; value: React.ReactNode; icon?: React.ElementType; accent?: string; sub?: string; }) {
  return (
    <div className="card p-4 flex flex-col gap-2 animate-fadeIn">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</span>
        {Icon && <Icon className={cn("size-4", accent)} />}
      </div>
      <p className={cn("text-2xl font-bold tracking-tight font-mono", accent)}>{value}</p>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, tone = "primary", size = "md", showLabel }: { value: number; max?: number; tone?: "primary" | "success" | "warning" | "danger"; size?: "sm" | "md"; showLabel?: boolean }) {
  const pct = Math.min(100, Math.round((value/max)*100));
  const colorClass = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className="flex items-center gap-2">
      <div className={cn("flex-1 rounded-full bg-surface-3 overflow-hidden", size === "sm" ? "h-1.5" : "h-2")}>
        <div className={cn("h-full rounded-full transition-all duration-500", colorClass)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="text-xs text-muted w-9 text-right">{pct}%</span>}
    </div>
  );
}

// ── Activity Timeline ─────────────────────────────────────────────────
export function Timeline({ items }: { items: { label: string; time: string; user?: string; note?: string }[] }) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
      {items.map((item, i) => (
        <div key={i} className="relative animate-fadeIn" style={{ animationDelay: `${i*50}ms` }}>
          <div className="absolute -left-[18px] size-3.5 rounded-full bg-primary-subtle border-2 border-primary mt-0.5" />
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              {item.user && <p className="text-xs text-muted">by {item.user}</p>}
              {item.note && <p className="text-xs bg-surface-2 rounded px-2 py-1 mt-0.5">{item.note}</p>}
            </div>
            <span className="text-[11px] text-muted whitespace-nowrap">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
