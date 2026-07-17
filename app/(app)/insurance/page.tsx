"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Plus, Car, RefreshCw, Trash2, Calendar, IndianRupee, RotateCw } from "lucide-react";
import {
  Button, Badge, Input, Label, Select, Modal, EmptyState, Skeleton,
  useToast, Tabs, SearchInput, type BadgeTone,
} from "../../../components/ui";
import { InsuranceEntryFields } from "../../../components/InsuranceEntryFields";
import {
  insuranceApi, insurancePoliciesApi, casesApi, mastersApi, formSchemasApi,
  INSURANCE_OWNER_TYPES,
  type InsuranceMIS, type InsurancePolicy, type LoanCase, type SectionDef, type FieldDef,
} from "../../../lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysUntil(endDate: string) {
  return Math.round((new Date(endDate).getTime() - Date.now()) / 86400000);
}
function statusTone(days: number): BadgeTone {
  if (days < 0) return "danger";
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "success";
}
function statusLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days <= 30) return `Expiring in ${days}d`;
  return `Active · ${days}d left`;
}
function coverageTone(type?: string): BadgeTone {
  if (type === "Comprehensive") return "info";
  if (type === "Third Party") return "warning";
  if (type === "Own Damage") return "orange";
  return "neutral";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const toast = useToast();
  const [tab, setTab] = useState("active");

  const [entries, setEntries] = useState<InsuranceMIS[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [insurerOptions, setInsurerOptions] = useState<string[]>([]);
  const [insSections, setInsSections] = useState<SectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<InsuranceMIS | null>(null);
  const [renewTarget, setRenewTarget] = useState<InsuranceMIS | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ins, pol, cas, mast, schema] = await Promise.all([
        insuranceApi.list(),
        insurancePoliciesApi.list(),
        casesApi.list({ limit: 300 }),
        mastersApi.list("insurance-companies"),
        formSchemasApi.get("insurance"),
      ]);
      const sorted = [...ins.data].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
      setEntries(sorted);
      setPolicies(pol.data);
      setCases(cas.data as unknown as LoanCase[]);
      setInsurerOptions(mast.data.filter((d) => d.isActive).map((d) => d.name));
      setInsSections(schema.data.sections);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load insurance entries");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Tab buckets
  const tabBuckets = {
    active:   entries.filter((e) => { const d = daysUntil(e.endDate); return d > 60; }),
    expiring: entries.filter((e) => { const d = daysUntil(e.endDate); return d >= 0 && d <= 60; }),
    expired:  entries.filter((e) => daysUntil(e.endDate) < 0),
    all:      entries,
  };

  const tabEntries = tabBuckets[tab as keyof typeof tabBuckets] ?? entries;
  const q = search.toLowerCase();
  const filtered = tabEntries.filter((e) =>
    !q || (e.customerName ?? "").toLowerCase().includes(q) ||
    (e.caseCode ?? "").toLowerCase().includes(q) ||
    e.insurer.toLowerCase().includes(q) ||
    (e.policyName ?? "").toLowerCase().includes(q)
  );

  async function handleDelete(id: string) {
    try {
      await insuranceApi.delete(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
      toast("success", "Entry removed");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to remove");
    }
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Insurance Entries</h1>
          <p className="text-sm text-muted mt-0.5">Insurance policies logged across all loan cases</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setEditEntry(null); setAddOpen(true); }}>
            <Plus className="size-3.5" /> Add Insurance
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",         value: entries.length,              tone: "info"    as BadgeTone },
            { label: "Active",        value: tabBuckets.active.length,    tone: "success" as BadgeTone },
            { label: "Expiring Soon", value: tabBuckets.expiring.length,  tone: "warning" as BadgeTone },
            { label: "Expired",       value: tabBuckets.expired.length,   tone: "danger"  as BadgeTone },
          ].map((s) => (
            <div key={s.label} className="card p-3 flex items-center justify-between">
              <span className="text-xs text-muted">{s.label}</span>
              <Badge tone={s.tone}>{s.value}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + search */}
      <div className="flex items-center gap-3">
        <Tabs
          tabs={[
            { id: "active",   label: "Active",        count: tabBuckets.active.length },
            { id: "expiring", label: "Expiring Soon", count: tabBuckets.expiring.length },
            { id: "expired",  label: "Expired",       count: tabBuckets.expired.length },
            { id: "all",      label: "All",           count: entries.length },
          ]}
          active={tab}
          onChange={setTab}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search…"
          className="w-48 ml-auto"
        />
      </div>

      {/* Entries list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShieldCheck}
            title={search ? "No matches" : "No insurance entries"}
            description={search ? "Try a different search." : "Add insurance details for a loan case."}
            action={!search ? <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" /> Add Insurance</Button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e, i) => (
            <InsuranceCard
              key={e._id}
              entry={e}
              index={i}
              onEdit={() => { setEditEntry(e); setAddOpen(true); }}
              onDelete={() => handleDelete(e._id)}
              onRenew={() => setRenewTarget(e)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {addOpen && (
        <EntryModal
          entry={editEntry}
          policies={policies}
          cases={cases}
          insurerOptions={insurerOptions}
          agentOptions={[...new Set(entries.map(r => r.agentName).filter((a): a is string => !!a))].sort()}
          sections={insSections}
          onClose={() => { setAddOpen(false); setEditEntry(null); }}
          onSaved={(rec) => {
            if (editEntry) {
              setEntries((prev) => {
                const updated = prev.map((x) => x._id === rec._id ? rec : x);
                return [...updated].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
              });
            } else {
              setEntries((prev) =>
                [...prev, rec].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
              );
            }
            setAddOpen(false);
            setEditEntry(null);
          }}
        />
      )}

      {/* Renew modal */}
      {renewTarget && (
        <RenewModal
          entry={renewTarget}
          onClose={() => setRenewTarget(null)}
          onSaved={(rec) => {
            setEntries((prev) => prev.map((x) => x._id === rec._id ? rec : x));
            setRenewTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── Insurance Entry Card ──────────────────────────────────────────────────────

function InsuranceCard({
  entry: e, index, onEdit, onDelete, onRenew,
}: {
  entry: InsuranceMIS; index: number;
  onEdit: () => void; onDelete: () => void; onRenew: () => void;
}) {
  const days = daysUntil(e.endDate);
  const tone = statusTone(days);

  return (
    <div
      className={`card p-4 animate-fadeIn transition-shadow hover:shadow-md ${days < 0 ? "opacity-80" : ""}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${tone === "success" ? "bg-success/10" : tone === "warning" ? "bg-warning/10" : "bg-danger/10"}`}>
            <ShieldCheck className={`size-5 ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-danger"}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {e.caseCode && (
                <span className="font-mono text-xs text-primary font-semibold">{e.caseCode}</span>
              )}
              <span className="font-semibold text-sm truncate">{e.customerName ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-muted">{e.insurer}</span>
              {e.policyName && (
                <>
                  <span className="text-xs text-muted">·</span>
                  <span className="text-xs text-foreground-secondary">{e.policyName}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={tone} dot>{statusLabel(days)}</Badge>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {e.coverageType && <Badge tone={coverageTone(e.coverageType)}>{e.coverageType}</Badge>}
        {e.vehicleModel && (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-foreground-secondary">
            <Car className="size-2.5" />{e.vehicleModel}
          </span>
        )}
        <Badge tone="neutral">{e.ownerType}</Badge>
        {e.renewal && <Badge tone="success" dot>Renewal Tagged</Badge>}
        {!!e.renewalHistory?.length && (
          <Badge tone="success">Renewed{e.renewalHistory.length > 1 ? ` ×${e.renewalHistory.length}` : ""}</Badge>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 mt-3 pt-3 border-t border-border">
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide flex items-center gap-1">
            <Calendar className="size-3" />Start
          </p>
          <p className="text-sm font-medium mt-0.5">{fmtDate(e.startDate)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide flex items-center gap-1">
            <Calendar className="size-3" />End
          </p>
          <p className="text-sm font-medium mt-0.5">{fmtDate(e.endDate)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide flex items-center gap-1">
            <IndianRupee className="size-3" />Premium
          </p>
          <p className="text-sm font-bold font-mono mt-0.5">{e.premiumAmount > 0 ? `₹${e.premiumAmount.toLocaleString("en-IN")}` : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wide flex items-center gap-1">
            <IndianRupee className="size-3" />Hold
          </p>
          <p className="text-sm font-bold font-mono mt-0.5">{e.holdAmount > 0 ? `₹${e.holdAmount.toLocaleString("en-IN")}` : "—"}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-border justify-end">
        <Button variant="secondary" size="sm" onClick={onRenew} className="text-success hover:bg-success/10">
          <RotateCw className="size-3.5" /> Renew
        </Button>
        <Button variant="secondary" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="secondary" size="sm" onClick={onDelete} className="text-danger hover:bg-danger/10">
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Renew Modal ────────────────────────────────────────────────────────────────

function addYears(dateStr: string, years: number) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function RenewModal({
  entry, onClose, onSaved,
}: {
  entry: InsuranceMIS;
  onClose: () => void;
  onSaved: (rec: InsuranceMIS) => void;
}) {
  const toast = useToast();
  const currentEndDate = entry.endDate.slice(0, 10);
  const [newEndDate, setNewEndDate] = useState(addYears(currentEndDate, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = newEndDate > currentEndDate;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setError("New end date must be after the current end date");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { data } = await insuranceApi.update(entry._id, { endDate: newEndDate });
      toast("success", "Policy renewed — admins and the customer will be emailed");
      onSaved(data);
    } catch (e: any) {
      setError(e.message ?? "Renewal failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Renew Policy" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-foreground-secondary space-y-0.5">
          <p><span className="text-muted">Customer:</span> {entry.customerName ?? "—"}</p>
          <p><span className="text-muted">Insurer:</span> {entry.insurer}</p>
          <p><span className="text-muted">Current end date:</span> {new Date(entry.endDate).toLocaleDateString("en-IN")}</p>
        </div>

        <div>
          <Label>New End Date <span className="text-danger">*</span></Label>
          <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={currentEndDate} required />
          <div className="flex gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => setNewEndDate(addYears(currentEndDate, 1))}
              className="text-xs px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 text-foreground-secondary transition-colors"
            >
              +1 year
            </button>
            <button
              type="button"
              onClick={() => setNewEndDate(addYears(currentEndDate, 2))}
              className="text-xs px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 text-foreground-secondary transition-colors"
            >
              +2 years
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}

        <p className="text-xs text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
          This will be recorded as a renewal and emailed to admins and the customer (if an email is on file).
        </p>

        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" loading={saving} disabled={!isValid}>Confirm Renewal</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Entry Modal ────────────────────────────────────────────────────────────────

function InsDynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const cls = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
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

function EntryModal({
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
    customerEmail: entry?.customerEmail ?? "",
    vehicleModel: entry?.vehicleModel ?? "",
    insurer: entry?.insurer ?? "",
    coverageType: entry?.coverageType ?? "",
    insuredName: entry?.insuredName ?? "",
    agentName: entry?.agentName ?? "",
    premiumAmount: entry?.premiumAmount?.toString() ?? "",
    ownerType: entry?.ownerType ?? "Bank",
    startDate: entry?.startDate ? entry.startDate.slice(0, 10) : "",
    endDate: entry?.endDate ? entry.endDate.slice(0, 10) : "",
    reminderDate: entry?.reminderDate ? entry.reminderDate.slice(0, 10) : "",
    holdAmount: entry?.holdAmount?.toString() ?? "",
    renewal: entry?.renewal ?? false,
    customFields: Object.fromEntries(Object.entries((entry as any)?.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")])) as Record<string, string>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function sf<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const selectedPolicy = policies.find((p) => p._id === form.policyId);

  function handlePolicySelect(policyId: string) {
    const p = policies.find((x) => x._id === policyId);
    if (p) {
      const startDate = form.startDate || new Date().toISOString().slice(0, 10);
      const endMs = new Date(startDate).getTime() + (p.tenure ?? 12) * 30 * 86400000;
      const endDate = new Date(endMs).toISOString().slice(0, 10);
      setForm((f) => ({
        ...f,
        policyId,
        insurer: p.insurer,
        coverageType: p.coverageType,
        premiumAmount: p.premiumAmount.toString(),
        startDate,
        endDate,
      }));
    } else {
      setForm((f) => ({ ...f, policyId }));
    }
  }

  function handleCaseSelect(caseId: string) {
    const c = cases.find((x) => x._id === caseId);
    if (c) {
      const customerName = `${c.customer.firstName} ${c.customer.lastName}`;
      setForm((f) => ({
        ...f,
        caseId,
        customerName,
        insuredName: f.insuredName || customerName,
        vehicleModel: (c as any).vehicleModel ?? f.vehicleModel,
      }));
    } else {
      setForm((f) => ({ ...f, caseId }));
    }
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
        ...form,
        policyId: form.policyId || undefined,
        policyName: selectedPolicy?.name,
        caseId: form.caseId || undefined,
        premiumAmount: Number(form.premiumAmount) || 0,
        holdAmount: Number(form.holdAmount) || 0,
        customFields: form.customFields,
      };
      let res: { data: InsuranceMIS };
      if (isEdit) {
        res = await insuranceApi.update(entry!._id, body);
        toast("success", "Entry updated");
      } else {
        res = await insuranceApi.create(body);
        toast("success", "Insurance entry added");
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Insurance Entry" : "Add Insurance Entry"} size="lg">
      <form onSubmit={submit} className="space-y-4">

        {/* Policy selector box */}
        {policies.length > 0 && (
          <div className="rounded-xl border border-border bg-surface-2 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Select from Policy Catalog</p>
            <Select value={form.policyId} onChange={(e) => handlePolicySelect(e.target.value)}>
              <option value="">Choose a policy (optional)…</option>
              {policies.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.insurer} · {p.coverageType} · ₹{p.premiumAmount.toLocaleString("en-IN")}
                </option>
              ))}
            </Select>
            {selectedPolicy && (
              <div className="flex gap-2 flex-wrap">
                <Badge tone="info">{selectedPolicy.insurer}</Badge>
                <Badge tone={coverageTone(selectedPolicy.coverageType)}>{selectedPolicy.coverageType}</Badge>
                <Badge tone="neutral">₹{selectedPolicy.premiumAmount.toLocaleString("en-IN")} premium</Badge>
                <Badge tone="neutral">{selectedPolicy.tenure}m tenure</Badge>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Case link */}
          <div className="col-span-2">
            <Label>Link to Case (optional)</Label>
            <Select value={form.caseId} onChange={(e) => handleCaseSelect(e.target.value)}>
              <option value="">Select a case…</option>
              {cases.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.caseCode} — {c.customer.firstName} {c.customer.lastName}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Customer Name</Label>
            <Input value={form.customerName} onChange={(e) => sf("customerName", e.target.value)} placeholder="Auto-filled from case" />
          </div>
          <div>
            <Label>Customer Email</Label>
            <Input type="email" value={form.customerEmail} onChange={(e) => sf("customerEmail", e.target.value)} placeholder="For expiry reminder emails" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Vehicle Model</Label>
            <Input value={form.vehicleModel} onChange={(e) => sf("vehicleModel", e.target.value)} placeholder="Model / Reg. No." />
          </div>
        </div>

        {/* Shared core fields — kept in sync with admin's Add Insurance Entry / Convert to Insurance MIS dialogs */}
        <InsuranceEntryFields
          form={form}
          onChange={sf}
          ownerTypeOptions={INSURANCE_OWNER_TYPES}
          insurerOptions={insurerOptions}
          agentOptions={agentOptions}
          insuredNameOptions={form.customerName ? [form.customerName] : []}
        />

        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input type="checkbox" checked={form.renewal} onChange={(e) => sf("renewal", e.target.checked)} className="rounded" />
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

        {error && (
          <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" loading={saving}>
            {isEdit ? "Save Changes" : "Add Entry"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
