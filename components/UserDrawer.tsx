"use client";

import { useEffect, useState } from "react";
import { X, Mail, Phone, Calendar, Briefcase, CheckCircle2, Clock, XCircle, AlertCircle, Ban } from "lucide-react";
import { Badge, CaseStatusBadge, type CaseStatus } from "./ui";
import { api, type AdminUser, type LoanCase } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────

interface Props {
  user: AdminUser | null;
  onClose: () => void;
}

// ── Status groupings ───────────────────────────────────────────────

const GROUPS = [
  { label: "Active",     icon: Clock,         tone: "info"    as const, statuses: ["Sales", "Pending", "In Credit", "Approved"] },
  { label: "Incomplete", icon: AlertCircle,   tone: "warning" as const, statuses: ["Incomplete", "Draft"] },
  { label: "Hold",       icon: AlertCircle,   tone: "orange"  as const, statuses: ["Hold"] },
  { label: "Disbursed",  icon: CheckCircle2,  tone: "success" as const, statuses: ["Disbursed"] },
  { label: "Rejected",   icon: XCircle,       tone: "danger"  as const, statuses: ["Rejected"] },
  { label: "Cancelled",  icon: Ban,           tone: "neutral" as const, statuses: ["Cancelled"] },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin", sales_executive: "Sales", owner: "Owner",
  operations: "Operations", telecaller: "Telecaller", relationship_manager: "Rel. Manager",
};
const ROLE_TONE: Record<string, "info" | "success" | "purple" | "orange" | "neutral"> = {
  admin: "info", sales_executive: "success", owner: "purple",
  operations: "orange", telecaller: "neutral", relationship_manager: "neutral",
};

// ── Component ──────────────────────────────────────────────────────

export function UserDrawer({ user, onClose }: Props) {
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api
      .get<LoanCase[]>("/cases", { assignedTo: user._id, limit: 200 })
      .then((r) => setCases(r.data))
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  // Counts per group
  const groupCounts = GROUPS.map((g) => ({
    ...g,
    count: cases.filter((c) => g.statuses.includes(c.status)).length,
    items: cases.filter((c) => g.statuses.includes(c.status)),
  }));

  const totalCases = cases.length;
  const disbursedAmount = cases
    .filter((c) => c.status === "Disbursed")
    .reduce((sum, c) => sum + (c.loanAmount ?? 0), 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-[520px] bg-surface border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">User Details</h2>
          <button
            onClick={onClose}
            className="size-8 grid place-items-center rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile card */}
          <div className="p-5 border-b border-border space-y-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-full bg-primary/10 text-primary font-bold text-lg grid place-items-center shrink-0">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base">{user.firstName} {user.lastName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={ROLE_TONE[user.role] ?? "neutral"}>
                    {ROLE_LABEL[user.role] ?? user.role}
                  </Badge>
                  <Badge tone={user.isActive ? "success" : "neutral"} dot>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Mail className="size-3.5 shrink-0 text-muted" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-foreground-secondary">
                  <Phone className="size-3.5 shrink-0 text-muted" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Calendar className="size-3.5 shrink-0 text-muted" />
                <span>Joined {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground-secondary">
                <Briefcase className="size-3.5 shrink-0 text-muted" />
                <span>{totalCases} case{totalCases !== 1 ? "s" : ""} assigned</span>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
            <StatCell label="Total Cases" value={totalCases} />
            <StatCell label="Disbursed" value={groupCounts.find((g) => g.label === "Disbursed")?.count ?? 0} tone="success" />
            <StatCell
              label="Volume"
              value={disbursedAmount > 0 ? `₹${(disbursedAmount / 100000).toFixed(1)}L` : "—"}
              tone="info"
            />
          </div>

          {/* Case groups */}
          <div className="p-5 space-y-5">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-surface-2 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : totalCases === 0 ? (
              <p className="text-sm text-muted text-center py-8">No cases assigned to this user.</p>
            ) : (
              groupCounts.filter((g) => g.count > 0).map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <g.icon className="size-3.5 text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">{g.label}</span>
                    <span className="ml-auto text-xs font-bold">{g.count}</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.items.map((c) => (
                      <CaseRow key={c._id} case={c} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function StatCell({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const valueClass =
    tone === "success" ? "text-success" :
    tone === "info"    ? "text-primary"  : "text-foreground";
  return (
    <div className="flex flex-col items-center py-3 px-2 text-center">
      <span className={`text-lg font-bold leading-none ${valueClass}`}>{value}</span>
      <span className="text-[10px] text-muted mt-1">{label}</span>
    </div>
  );
}

function CaseRow({ case: c }: { case: LoanCase }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-surface-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-semibold text-primary">{c.caseCode}</p>
        <p className="text-xs text-foreground-secondary truncate">
          {c.customer.firstName} {c.customer.lastName}
          {c.bankName ? ` · ${c.bankName}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <CaseStatusBadge status={c.status as CaseStatus} />
        {c.loanAmount ? (
          <span className="text-[10px] text-muted">₹{c.loanAmount.toLocaleString("en-IN")}</span>
        ) : null}
      </div>
    </div>
  );
}
