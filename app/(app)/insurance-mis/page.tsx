"use client";

import { useState, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  Plus, RefreshCw, ShieldCheck, Edit2, Power, Trash2, Car,
} from "lucide-react";

// ── Chart helpers ─────────────────────────────────────────────────────────────

const IC = {
  success: "#22C55E", warning: "#F59E0B", danger: "#EF4444",
  info: "#38BDF8", purple: "#A855F7", teal: "#14B8A6",
  orange: "#F97316", slate: "#94A3B8",
};

function InsTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[110px] border border-border">
      {label && <p className="font-semibold mb-1 border-b border-border pb-1 text-foreground-secondary">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-2 mt-1">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.fill ?? p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
import {
  Button, Badge, SearchInput, SectionHeader, Pagination, Modal, Input, Label, Select,
  EmptyState, Skeleton, useToast, Tabs, type BadgeTone,
} from "../../../components/ui";
import {
  insuranceApi, insurancePoliciesApi, casesApi, mastersApi, formSchemasApi,
  INSURANCE_OWNER_TYPES,
  type InsuranceMIS, type InsurancePolicy, type LoanCase, type SectionDef, type FieldDef,
} from "../../../lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

const COVERAGE_TYPES = ["Comprehensive", "Third Party", "Own Damage"] as const;
const VEHICLE_TYPES = ["Car", "Two Wheeler", "Truck", "Commercial Vehicle", "Other"] as const;

function daysUntil(endDate: string) {
  return Math.round((new Date(endDate).getTime() - Date.now()) / 86400000);
}
function expiryTone(days: number): BadgeTone {
  if (days < 0 || days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "success";
}
function expiryLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d left`;
}
function coverageTone(type?: string): BadgeTone {
  if (type === "Comprehensive") return "info";
  if (type === "Third Party") return "warning";
  if (type === "Own Damage") return "orange";
  return "neutral";
}
function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const toast = useToast();
  const [tab, setTab] = useState<"policies" | "entries">("policies");

  // ── Policy Catalog state ───────────────────────────────────────────────────
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [polLoading, setPolLoading] = useState(true);
  const [polSearch, setPolSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [polFormOpen, setPolFormOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<InsurancePolicy | null>(null);
  const [polDelTarget, setPolDelTarget] = useState<InsurancePolicy | null>(null);

  // ── Entries state ──────────────────────────────────────────────────────────
  const [records, setRecords] = useState<InsuranceMIS[]>([]);
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [entryLoading, setEntryLoading] = useState(true);
  const [entrySearch, setEntrySearch] = useState("");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [filterInsurer, setFilterInsurer] = useState("all");
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<InsuranceMIS | null>(null);
  const [page, setPage] = useState(1);
  const LIMIT = 12;

  const [insurerOptions, setInsurerOptions] = useState<string[]>([]);
  const [insSections, setInsSections] = useState<SectionDef[]>([]);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadPolicies = useCallback(async () => {
    setPolLoading(true);
    try {
      const { data } = await insurancePoliciesApi.list(showInactive);
      setPolicies(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load policies");
    } finally {
      setPolLoading(false);
    }
  }, [toast, showInactive]);

  const loadEntries = useCallback(async () => {
    setEntryLoading(true);
    try {
      const [ins, cas] = await Promise.all([
        insuranceApi.list(),
        casesApi.list({ limit: 500 }),
      ]);
      setRecords(ins.data);
      setCases(cas.data as unknown as LoanCase[]);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load entries");
    } finally {
      setEntryLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => {
    mastersApi.list("insurance-companies").then(({ data }) => {
      setInsurerOptions(data.filter((d) => d.isActive).map((d) => d.name));
    }).catch(() => {});
    formSchemasApi.get("insurance").then(({ data }) => setInsSections(data.sections)).catch(() => {});
  }, []);

  // ── Computed ───────────────────────────────────────────────────────────────

  const filteredPolicies = policies.filter((p) => {
    const q = polSearch.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.insurer.toLowerCase().includes(q);
  });

  const uniqueInsurers = [...new Set(records.map((r) => r.insurer))].sort();
  const filteredEntries = records.filter((r) => {
    const q = entrySearch.toLowerCase();
    const matchSearch = !q || (r.customerName ?? "").toLowerCase().includes(q) || (r.caseCode ?? "").toLowerCase().includes(q) || r.insurer.toLowerCase().includes(q);
    const days = daysUntil(r.endDate);
    const matchExpiry =
      filterExpiry === "all" ? true :
      filterExpiry === "expired" ? days < 0 :
      filterExpiry === "30" ? days >= 0 && days <= 30 :
      filterExpiry === "60" ? days >= 0 && days <= 60 : true;
    const matchInsurer = filterInsurer === "all" || r.insurer === filterInsurer;
    return matchSearch && matchExpiry && matchInsurer;
  });
  const pagedEntries = filteredEntries.slice((page - 1) * LIMIT, page * LIMIT);

  // ── Policy CRUD handlers ───────────────────────────────────────────────────

  async function handleTogglePolicy(p: InsurancePolicy) {
    try {
      await insurancePoliciesApi.toggleStatus(p._id);
      toast("success", `Policy ${p.isActive ? "deactivated" : "activated"}`);
      loadPolicies();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update policy");
    }
  }

  async function handleDeletePolicy() {
    if (!polDelTarget) return;
    try {
      await insurancePoliciesApi.delete(polDelTarget._id);
      toast("success", "Policy removed");
      setPolDelTarget(null);
      loadPolicies();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to remove policy");
    }
  }

  async function handleDeleteEntry(id: string) {
    try {
      await insuranceApi.delete(id);
      setRecords((prev) => prev.filter((r) => r._id !== id));
      toast("success", "Entry removed");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to remove entry");
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total: records.length,
    expired: records.filter((r) => daysUntil(r.endDate) < 0).length,
    soon: records.filter((r) => { const d = daysUntil(r.endDate); return d >= 0 && d <= 30; }).length,
    renewal: records.filter((r) => r.renewal).length,
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Insurance Management"
        description="Manage insurance policy catalog and track active MIS entries"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { loadPolicies(); loadEntries(); }}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
            {tab === "policies" ? (
              <Button size="sm" onClick={() => { setEditPolicy(null); setPolFormOpen(true); }}>
                <Plus className="size-3.5" /> Add Policy
              </Button>
            ) : (
              <Button size="sm" onClick={() => { setEditEntry(null); setAddEntryOpen(true); }}>
                <Plus className="size-3.5" /> Add Entry
              </Button>
            )}
          </div>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Entries", value: stats.total,   tone: "info"    as BadgeTone },
          { label: "Expired",        value: stats.expired, tone: "danger"  as BadgeTone },
          { label: "Expiring ≤30d",  value: stats.soon,    tone: "warning" as BadgeTone },
          { label: "Renewal Tagged", value: stats.renewal, tone: "success" as BadgeTone },
        ].map((s) => (
          <div key={s.label} className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">{s.label}</span>
            <Badge tone={s.tone}>{s.value}</Badge>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: "policies", label: "Policy Catalog", count: policies.filter((p) => p.isActive).length },
          { id: "entries",  label: "All Entries",    count: records.length },
        ]}
        active={tab}
        onChange={(id) => setTab(id as "policies" | "entries")}
      />

      {/* ── Policy Catalog Tab ─────────────────────────────────────────────── */}
      {tab === "policies" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <SearchInput value={polSearch} onChange={setPolSearch} placeholder="Search policies…" className="w-64" />
            <label className="ml-auto flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Show inactive
            </label>
          </div>

          {polLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={ShieldCheck}
                title="No policies found"
                description={polSearch ? "Try a different search." : "Create your first insurance policy above."}
                action={<Button size="sm" onClick={() => setPolFormOpen(true)}><Plus className="size-3.5" /> Add Policy</Button>}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolicies.map((p, i) => (
                <PolicyCard
                  key={p._id}
                  policy={p}
                  index={i}
                  onEdit={() => { setEditPolicy(p); setPolFormOpen(true); }}
                  onToggle={() => handleTogglePolicy(p)}
                  onDelete={() => setPolDelTarget(p)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── All Entries Tab ───────────────────────────────────────────────── */}
      {tab === "entries" && records.length > 0 && (() => {
        // Expiry distribution
        const exp  = records.filter((r) => daysUntil(r.endDate) < 0).length;
        const d30  = records.filter((r) => { const d = daysUntil(r.endDate); return d >= 0 && d <= 30; }).length;
        const d60  = records.filter((r) => { const d = daysUntil(r.endDate); return d > 30 && d <= 60; }).length;
        const act  = records.filter((r) => daysUntil(r.endDate) > 60).length;
        const expiryPie = [
          { label: "Expired",   value: exp,  color: IC.danger  },
          { label: "≤ 30 days", value: d30,  color: IC.warning },
          { label: "≤ 60 days", value: d60,  color: IC.orange  },
          { label: "Active",    value: act,  color: IC.success },
        ].filter((e) => e.value > 0);

        // Coverage type distribution
        const covCounts: Record<string, number> = {};
        records.forEach((r) => { if (r.coverageType) covCounts[r.coverageType] = (covCounts[r.coverageType] ?? 0) + 1; });
        const covColors = [IC.info, IC.warning, IC.purple, IC.teal, IC.orange];
        const covPie = Object.entries(covCounts).map(([label, value], i) => ({
          label, value, color: covColors[i % covColors.length],
        }));

        // Insurer breakdown bar chart
        const insBreakdown: Record<string, number> = {};
        records.forEach((r) => { insBreakdown[r.insurer] = (insBreakdown[r.insurer] ?? 0) + 1; });
        const insBar = Object.entries(insBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([insurer, count]) => ({ insurer: insurer.length > 14 ? insurer.slice(0, 14) + "…" : insurer, count }));

        const total = records.length;

        return (
          <div className="grid lg:grid-cols-3 gap-4 mb-1">
            {/* Expiry donut */}
            <div className="card">
              <p className="text-sm font-semibold mb-3">Expiry Status</p>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={expiryPie} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                    paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {expiryPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expiryPie.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="text-foreground-secondary flex-1">{s.label}</span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                    <span className="text-muted w-7 text-right">{Math.round((s.value / total) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coverage type donut */}
            {covPie.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold mb-3">Coverage Type</p>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={covPie} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                      paddingAngle={2} dataKey="value" strokeWidth={0}>
                      {covPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {covPie.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-foreground-secondary flex-1 truncate">{s.label}</span>
                      <span className="font-semibold tabular-nums">{s.value}</span>
                      <span className="text-muted w-7 text-right">{Math.round((s.value / total) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insurer bar chart */}
            {insBar.length > 0 && (
              <div className="card">
                <p className="text-sm font-semibold mb-3">Top Insurers</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={insBar} layout="vertical" barSize={14} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="insurer" width={80}
                      tick={{ fontSize: 10, fill: "var(--foreground-secondary)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<InsTip />} cursor={{ fill: "var(--primary-subtle, rgba(102,131,255,0.06))" }} />
                    <Bar dataKey="count" name="Policies" radius={[0, 4, 4, 0]}>
                      {insBar.map((_, i) => (
                        <Cell key={i} fill={`hsl(${200 + i * 20}, 80%, ${58 - i * 3}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        );
      })()}

      {tab === "entries" && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 p-3 border-b border-border flex-wrap">
            <SearchInput value={entrySearch} onChange={setEntrySearch} placeholder="Search customer, case or insurer…" className="w-64" />
            <Select className="w-40 !h-8 text-xs" value={filterExpiry} onChange={(e) => { setFilterExpiry(e.target.value); setPage(1); }}>
              <option value="all">All expiry</option>
              <option value="expired">Expired</option>
              <option value="30">Expiring ≤30d</option>
              <option value="60">Expiring ≤60d</option>
            </Select>
            <Select className="w-44 !h-8 text-xs" value={filterInsurer} onChange={(e) => { setFilterInsurer(e.target.value); setPage(1); }}>
              <option value="all">All insurers</option>
              {uniqueInsurers.map((ins) => <option key={ins}>{ins}</option>)}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case / Customer</th>
                  <th>Insured Name</th>
                  <th>Insurer</th>
                  <th>Owner</th>
                  <th>Coverage</th>
                  <th>Period</th>
                  <th>Premium</th>
                  <th>Reminder</th>
                  <th>Expiry</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {entryLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                  ))
                ) : pagedEntries.length === 0 ? (
                  <tr><td colSpan={10}><EmptyState title="No entries" description="Add your first insurance entry above." /></td></tr>
                ) : pagedEntries.map((r) => {
                  const days = daysUntil(r.endDate);
                  const reminderDays = r.reminderDate ? Math.round((new Date(r.reminderDate).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <tr
                      key={r._id}
                      className="cursor-pointer"
                      onClick={() => { setEditEntry(r); setAddEntryOpen(true); }}
                    >
                      <td>
                        <p className="font-mono text-xs text-primary font-semibold">{r.caseCode ?? "—"}</p>
                        <p className="text-xs text-foreground-secondary">{r.customerName ?? "—"}</p>
                      </td>
                      <td className="text-xs text-foreground-secondary">{r.insuredName ?? "—"}</td>
                      <td className="text-sm font-medium">{r.insurer}</td>
                      <td>
                        {r.ownerType ? (
                          <Badge tone="neutral">{r.ownerType}</Badge>
                        ) : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td>
                        {r.coverageType ? (
                          <Badge tone={coverageTone(r.coverageType)}>{r.coverageType}</Badge>
                        ) : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td className="text-xs text-muted whitespace-nowrap">
                        {new Date(r.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                        {" → "}
                        {new Date(r.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="font-mono text-xs">{r.premiumAmount > 0 ? fmt(r.premiumAmount) : "—"}</td>
                      <td>
                        {reminderDays !== null ? (
                          <Badge tone={reminderDays <= 7 ? "warning" : "neutral"}>
                            {new Date(r.reminderDate!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                          </Badge>
                        ) : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td><Badge tone={expiryTone(days)} dot>{expiryLabel(days)}</Badge></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDeleteEntry(r._id)}
                          className="size-7 grid place-items-center rounded hover:bg-danger/10 text-muted hover:text-danger transition-colors"
                          title="Remove entry"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(filteredEntries.length / LIMIT))}
            total={filteredEntries.length}
            limit={LIMIT}
            onPage={setPage}
            onLimit={() => {}}
          />
        </div>
      )}

      {/* ── Policy Form Modal ─────────────────────────────────────────────── */}
      {polFormOpen && (
        <PolicyFormModal
          policy={editPolicy}
          insurerOptions={insurerOptions}
          onClose={() => { setPolFormOpen(false); setEditPolicy(null); }}
          onSaved={() => { setPolFormOpen(false); setEditPolicy(null); loadPolicies(); }}
        />
      )}

      {/* ── Add / Edit Entry Modal ─────────────────────────────────────────── */}
      {addEntryOpen && (
        <EntryFormModal
          entry={editEntry}
          policies={policies.filter((p) => p.isActive)}
          cases={cases}
          insurerOptions={insurerOptions}
          agentOptions={[...new Set(records.map(r => r.agentName).filter((a): a is string => !!a))].sort()}
          sections={insSections}
          onClose={() => { setAddEntryOpen(false); setEditEntry(null); }}
          onSaved={(rec) => {
            if (editEntry) {
              setRecords((prev) => prev.map((r) => r._id === rec._id ? rec : r));
            } else {
              setRecords((prev) => [rec, ...prev]);
            }
            setAddEntryOpen(false);
            setEditEntry(null);
          }}
        />
      )}

      {/* ── Delete Policy Confirm ─────────────────────────────────────────── */}
      {polDelTarget && (
        <Modal open onClose={() => setPolDelTarget(null)} title="Remove Policy" size="sm">
          <p className="text-sm text-foreground-secondary mb-4">
            Are you sure you want to remove{" "}
            <span className="font-semibold text-foreground">{polDelTarget.name}</span>?
            Existing entries linked to this policy will not be affected.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setPolDelTarget(null)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={handleDeletePolicy}>Remove</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Policy Card ────────────────────────────────────────────────────────────────

function PolicyCard({
  policy: p, index, onEdit, onToggle, onDelete,
}: {
  policy: InsurancePolicy; index: number;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  return (
    <div
      className={`card p-4 space-y-3 transition-all animate-fadeIn ${!p.isActive ? "opacity-60" : "hover:shadow-md"}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
            <ShieldCheck className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
            <p className="text-xs text-muted mt-0.5">{p.insurer}</p>
          </div>
        </div>
        <Badge tone={p.isActive ? "success" : "neutral"} dot>{p.isActive ? "Active" : "Inactive"}</Badge>
      </div>

      {/* Coverage + vehicle chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={coverageTone(p.coverageType)}>{p.coverageType}</Badge>
        {p.vehicleTypes.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground-secondary"
          >
            <Car className="size-2.5" />{v}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Premium</p>
          <p className="text-sm font-bold font-mono">₹{p.premiumAmount.toLocaleString("en-IN")}</p>
        </div>
        {p.idvAmount ? (
          <div>
            <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">IDV</p>
            <p className="text-sm font-bold font-mono">₹{p.idvAmount.toLocaleString("en-IN")}</p>
          </div>
        ) : <div />}
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Tenure</p>
          <p className="text-sm font-bold">{p.tenure}m</p>
        </div>
      </div>

      {p.description && (
        <p className="text-xs text-muted leading-snug border-t border-border pt-2 line-clamp-2">{p.description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        <button
          onClick={onEdit}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
          title="Edit"
        >
          <Edit2 className="size-3.5" />
        </button>
        <button
          onClick={onToggle}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
          title={p.isActive ? "Deactivate" : "Activate"}
        >
          <Power className="size-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="size-7 grid place-items-center rounded hover:bg-danger/10 text-muted hover:text-danger transition-colors ml-auto"
          title="Delete"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Policy Form Modal ──────────────────────────────────────────────────────────

function PolicyFormModal({
  policy, insurerOptions, onClose, onSaved,
}: {
  policy: InsurancePolicy | null;
  insurerOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = !!policy;
  const [form, setForm] = useState({
    name: policy?.name ?? "",
    insurer: policy?.insurer ?? "",
    coverageType: policy?.coverageType ?? "Comprehensive",
    vehicleTypes: policy?.vehicleTypes ?? ([] as string[]),
    premiumAmount: policy?.premiumAmount?.toString() ?? "",
    idvAmount: policy?.idvAmount?.toString() ?? "",
    tenure: policy?.tenure?.toString() ?? "12",
    description: policy?.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleVehicle(v: string) {
    setForm((f) => ({
      ...f,
      vehicleTypes: f.vehicleTypes.includes(v)
        ? f.vehicleTypes.filter((x) => x !== v)
        : [...f.vehicleTypes, v],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.insurer || !form.premiumAmount) {
      setError("Name, insurer, and premium are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        insurer: form.insurer,
        coverageType: form.coverageType,
        vehicleTypes: form.vehicleTypes,
        premiumAmount: Number(form.premiumAmount),
        idvAmount: form.idvAmount ? Number(form.idvAmount) : undefined,
        tenure: Number(form.tenure) || 12,
        description: form.description || undefined,
      };
      if (isEdit) {
        await insurancePoliciesApi.update(policy!._id, body);
        toast("success", "Policy updated");
      } else {
        await insurancePoliciesApi.create(body);
        toast("success", "Policy created");
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Policy" : "New Insurance Policy"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Policy Name <span className="text-danger">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. HDFC Ergo Comprehensive" required />
          </div>
          <div>
            <Label>Insurer / Company <span className="text-danger">*</span></Label>
            <Select value={form.insurer} onChange={(e) => setForm((f) => ({ ...f, insurer: e.target.value }))}>
              <option value="">Select insurer…</option>
              {insurerOptions.map((ins) => <option key={ins}>{ins}</option>)}
            </Select>
          </div>

          <div>
            <Label>Coverage Type <span className="text-danger">*</span></Label>
            <Select value={form.coverageType} onChange={(e) => setForm((f) => ({ ...f, coverageType: e.target.value }))}>
              {COVERAGE_TYPES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <Label>Tenure (months)</Label>
            <Input type="number" min="1" max="120" value={form.tenure} onChange={(e) => setForm((f) => ({ ...f, tenure: e.target.value }))} placeholder="12" />
          </div>

          <div>
            <Label>Base Premium (₹) <span className="text-danger">*</span></Label>
            <Input type="number" min="0" value={form.premiumAmount} onChange={(e) => setForm((f) => ({ ...f, premiumAmount: e.target.value }))} placeholder="0" required />
          </div>
          <div>
            <Label>IDV Amount (₹)</Label>
            <Input type="number" min="0" value={form.idvAmount} onChange={(e) => setForm((f) => ({ ...f, idvAmount: e.target.value }))} placeholder="Optional" />
          </div>

          <div className="col-span-2">
            <Label>Vehicle Types</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {VEHICLE_TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVehicle(v)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                    form.vehicleTypes.includes(v)
                      ? "bg-primary text-white border-primary"
                      : "bg-surface-2 text-foreground-secondary border-border hover:border-primary/50"
                  }`}
                >
                  <Car className="size-3" /> {v}
                </button>
              ))}
            </div>
          </div>

          <div className="col-span-2">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional notes about this policy…" />
          </div>
        </div>

        {error && <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" loading={saving}>{isEdit ? "Save Changes" : "Create Policy"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Entry Form Modal ───────────────────────────────────────────────────────────

function InsDynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const cls = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none";
  if (field.type === "select") return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="">—</option>
      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (field.type === "boolean") return (
    <div className="flex items-center gap-2 mt-1">
      <input type="checkbox" checked={value === "true"} onChange={e => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded" />
      <span className="text-sm">{field.label}</span>
    </div>
  );
  if (field.type === "date") return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  if (field.type === "number") return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
}

function EntryFormModal({
  entry, policies, cases, insurerOptions, agentOptions, sections, onClose, onSaved,
}: {
  entry: InsuranceMIS | null;
  policies: InsurancePolicy[];
  cases: LoanCase[];
  insurerOptions: string[];
  agentOptions: string[];
  sections: SectionDef[];
  onClose: () => void;
  onSaved: (rec: InsuranceMIS) => void;
}) {
  const toast = useToast();
  const isEdit = !!entry;
  const [form, setForm] = useState({
    policyId: entry?.policyId ?? "",
    caseId: entry?.caseId ?? "",
    customerName: entry?.customerName ?? "",
    vehicleModel: entry?.vehicleModel ?? "",
    insurer: entry?.insurer ?? "",
    coverageType: entry?.coverageType ?? "",
    vehicleType: entry?.vehicleType ?? "",
    premiumAmount: entry?.premiumAmount?.toString() ?? "",
    ownerType: entry?.ownerType ?? "Bank",
    insuredName: entry?.insuredName ?? "",
    agentName: entry?.agentName ?? "",
    endorsementDate: entry?.endorsement?.date ? entry.endorsement.date.slice(0, 10) : "",
    endorsementNote: entry?.endorsement?.note ?? "",
    reminderDate: entry?.reminderDate ? entry.reminderDate.slice(0, 10) : "",
    startDate: entry?.startDate ? entry.startDate.slice(0, 10) : "",
    endDate: entry?.endDate ? entry.endDate.slice(0, 10) : "",
    holdAmount: entry?.holdAmount?.toString() ?? "",
    renewal: entry?.renewal ?? false,
    customFields: Object.fromEntries(Object.entries(entry?.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")])) as Record<string, string>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEndorsement, setShowEndorsement] = useState(
    !!(entry?.endorsement?.date || entry?.endorsement?.note)
  );

  function handlePolicySelect(policyId: string) {
    const p = policies.find((x) => x._id === policyId);
    if (p) {
      const startDate = form.startDate || new Date().toISOString().slice(0, 10);
      const endMs = new Date(startDate).getTime() + (p.tenure ?? 12) * 30 * 86400000;
      setForm((f) => ({
        ...f, policyId,
        insurer: p.insurer, coverageType: p.coverageType,
        vehicleType: p.vehicleTypes[0] ?? f.vehicleType,
        premiumAmount: p.premiumAmount.toString(),
        startDate, endDate: new Date(endMs).toISOString().slice(0, 10),
      }));
    } else {
      setForm((f) => ({ ...f, policyId }));
    }
  }

  function handleCaseSelect(caseId: string) {
    const c = cases.find((x) => x._id === caseId);
    if (c) {
      setForm((f) => ({
        ...f, caseId,
        customerName: `${c.customer.firstName} ${c.customer.lastName}`,
        vehicleModel: (c as any).vehicleModel ?? f.vehicleModel,
      }));
    } else {
      setForm((f) => ({ ...f, caseId }));
    }
  }

  function sf<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.insurer || !form.startDate || !form.endDate) {
      setError("Insurer, start date, and end date are required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        policyId: form.policyId || undefined,
        caseId: form.caseId || undefined,
        customerName: form.customerName || undefined,
        vehicleModel: form.vehicleModel || undefined,
        insurer: form.insurer,
        coverageType: form.coverageType || undefined,
        vehicleType: form.vehicleType || undefined,
        premiumAmount: Number(form.premiumAmount) || 0,
        ownerType: form.ownerType,
        insuredName: form.insuredName || undefined,
        agentName: form.agentName || undefined,
        endorsement: (form.endorsementDate || form.endorsementNote)
          ? { date: form.endorsementDate || undefined, note: form.endorsementNote || undefined }
          : undefined,
        reminderDate: form.reminderDate || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        holdAmount: Number(form.holdAmount) || 0,
        renewal: form.renewal,
        customFields: form.customFields,
      };
      let res: { data: InsuranceMIS };
      if (isEdit) {
        res = await insuranceApi.update(entry!._id, body);
        toast("success", "Entry updated");
      } else {
        res = await insuranceApi.create(body);
        toast("success", "Entry added");
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const selectedPolicy = policies.find(p => p._id === form.policyId);

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Insurance Entry" : "Add Insurance Entry"} size="lg">
      <form onSubmit={submit}>
        <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-1">

          {/* Row 1: Policy + Case (2 col) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Link to Policy</Label>
              <Select value={form.policyId} onChange={e => handlePolicySelect(e.target.value)}>
                <option value="">Select policy…</option>
                {policies.map(p => (
                  <option key={p._id} value={p._id}>{p.name} — {p.insurer} · {p.coverageType}</option>
                ))}
              </Select>
              {selectedPolicy && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge tone="info">{selectedPolicy.insurer}</Badge>
                  <Badge tone={coverageTone(selectedPolicy.coverageType)}>{selectedPolicy.coverageType}</Badge>
                  <Badge tone="neutral">₹{selectedPolicy.premiumAmount.toLocaleString("en-IN")}</Badge>
                </div>
              )}
            </div>
            <div>
              <Label>Link to Case (optional)</Label>
              <Select value={form.caseId} onChange={e => handleCaseSelect(e.target.value)}>
                <option value="">Select case…</option>
                {cases.map(c => (
                  <option key={c._id} value={c._id}>{c.caseCode} — {c.customer.firstName} {c.customer.lastName}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Row 2: Insurer | Coverage | Owner Type */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Insurer <span className="text-danger">*</span></Label>
              <Select value={form.insurer} onChange={e => sf("insurer", e.target.value)}>
                <option value="">Select…</option>
                {insurerOptions.map(ins => <option key={ins}>{ins}</option>)}
              </Select>
            </div>
            <div>
              <Label>Coverage Type</Label>
              <Select value={form.coverageType} onChange={e => sf("coverageType", e.target.value)}>
                <option value="">Select…</option>
                {COVERAGE_TYPES.map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Owner Type</Label>
              <Select value={form.ownerType} onChange={e => sf("ownerType", e.target.value)}>
                {INSURANCE_OWNER_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </div>
          </div>

          {/* Row 3: Insured Name | Agent | Premium */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Insured Name</Label>
              <Input
                list="ins-insured-opts"
                value={form.insuredName}
                onChange={e => sf("insuredName", e.target.value)}
                placeholder="Select or type…"
              />
              <datalist id="ins-insured-opts">
                {form.customerName && <option value={form.customerName} />}
              </datalist>
            </div>
            <div>
              <Label>Insurance Agent</Label>
              <Input
                list="ins-agent-opts"
                value={form.agentName}
                onChange={e => sf("agentName", e.target.value)}
                placeholder="Select or type…"
              />
              <datalist id="ins-agent-opts">
                {agentOptions.map(a => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div>
              <Label>Premium (₹)</Label>
              <Input type="number" min="0" value={form.premiumAmount} onChange={e => sf("premiumAmount", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Row 4: Customer Name | Vehicle Model | Hold Amount */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Customer Name</Label>
              <Input value={form.customerName} onChange={e => sf("customerName", e.target.value)} placeholder="Auto-filled from case" />
            </div>
            <div>
              <Label>Vehicle Model</Label>
              <Input value={form.vehicleModel} onChange={e => sf("vehicleModel", e.target.value)} placeholder="Model / Reg. No." />
            </div>
            <div>
              <Label>Hold Amount (₹)</Label>
              <Input type="number" min="0" value={form.holdAmount} onChange={e => sf("holdAmount", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Row 5: Start Date | End Date | Reminder */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start Date <span className="text-danger">*</span></Label>
              <Input type="date" value={form.startDate} onChange={e => sf("startDate", e.target.value)} required />
            </div>
            <div>
              <Label>End Date <span className="text-danger">*</span></Label>
              <Input type="date" value={form.endDate} onChange={e => sf("endDate", e.target.value)} required />
            </div>
            <div>
              <Label>Reminder Date</Label>
              <Input type="date" value={form.reminderDate} onChange={e => sf("reminderDate", e.target.value)} />
            </div>
          </div>

          {/* Endorsement toggle */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowEndorsement(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-2 transition-colors"
            >
              <span className="uppercase tracking-widest">Endorsement {showEndorsement ? "" : "(optional)"}</span>
              <span className="text-primary">{showEndorsement ? "Hide ▲" : "Add ▼"}</span>
            </button>
            {showEndorsement && (
              <div className="grid grid-cols-2 gap-3 p-3 border-t border-border">
                <div>
                  <Label>Endorsement Date</Label>
                  <Input type="date" value={form.endorsementDate} onChange={e => sf("endorsementDate", e.target.value)} />
                </div>
                <div>
                  <Label>Endorsement Note</Label>
                  <Input value={form.endorsementNote} onChange={e => sf("endorsementNote", e.target.value)} placeholder="Details…" />
                </div>
              </div>
            )}
          </div>

          {/* Renewal */}
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input type="checkbox" checked={form.renewal} onChange={e => sf("renewal", e.target.checked)} className="rounded" />
            Tag for Renewal
          </label>

          {/* Custom fields from Form Builder */}
          {sections.flatMap(sec => sec.fields.filter(f => !f.isCore && f.isActive)).length > 0 && (
            <div className="border-t border-border pt-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Additional Fields</p>
              <div className="grid grid-cols-2 gap-3">
                {sections.flatMap(sec => sec.fields.filter(f => !f.isCore && f.isActive)).map(field => (
                  <div key={field.key} className={field.type === "boolean" ? "col-span-2" : ""}>
                    <Label>{field.label}{field.required && <span className="text-danger ml-0.5">*</span>}</Label>
                    <InsDynField
                      field={field}
                      value={form.customFields[field.key] ?? field.defaultValue ?? ""}
                      onChange={v => sf("customFields", { ...form.customFields, [field.key]: v })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <div className="mt-3 rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="flex gap-2 justify-end border-t border-border pt-3 mt-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" loading={saving}>{isEdit ? "Save Changes" : "Add Entry"}</Button>
        </div>
      </form>
    </Modal>
  );
}
