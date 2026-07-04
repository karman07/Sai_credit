"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Plus, X, Phone, Car, RefreshCw,
  TrendingUp, CheckCircle2, XCircle, Users, Search,
  ChevronDown, ChevronRight, Calendar, Edit2, Trash2,
} from "lucide-react";
import {
  insuranceLeadsApi, usersApi,
  type InsuranceLead, type InsuranceLeadStats, type ConvertLeadBody,
} from "../../../lib/api";
import { Button, Input, Label, Select, Badge, type BadgeTone } from "../../../components/ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "new",        label: "New",        tone: "info"    as BadgeTone },
  { value: "contacted",  label: "Contacted",  tone: "warning" as BadgeTone },
  { value: "interested", label: "Interested", tone: "orange"  as BadgeTone },
  { value: "converted",  label: "Converted",  tone: "success" as BadgeTone },
  { value: "lost",       label: "Lost",       tone: "danger"  as BadgeTone },
];
const SOURCE_OPTIONS = [
  { value: "walk_in",  label: "Walk-In"  },
  { value: "referral", label: "Referral" },
  { value: "campaign", label: "Campaign" },
  { value: "online",   label: "Online"   },
  { value: "other",    label: "Other"    },
];

function statusTone(s: string): BadgeTone {
  return STATUS_OPTIONS.find((o) => o.value === s)?.tone ?? "neutral";
}
function statusLabel(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Lead Form ─────────────────────────────────────────────────────────────────

function LeadForm({ initial, users, onSave, onClose }: {
  initial?: Partial<InsuranceLead>;
  users: { _id: string; firstName: string; lastName: string }[];
  onSave: (data: Partial<InsuranceLead>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({
    firstName: "", lastName: "", contact: "", altContact: "",
    vehicleType: "", vehicleModel: "", regNumber: "", vehicleYear: "",
    existingInsurer: "", policyExpiryDate: "", location: "", state: "", city: "",
    status: "new", source: "other", remarks: "", followUpDate: "", assignedTo: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const body: Record<string, any> = { ...form };
      if (!body.assignedTo) delete body.assignedTo;
      if (!body.altContact) delete body.altContact;
      if (!body.vehicleType) delete body.vehicleType;
      if (!body.vehicleModel) delete body.vehicleModel;
      if (!body.regNumber) delete body.regNumber;
      if (!body.vehicleYear) delete body.vehicleYear;
      else body.vehicleYear = parseInt(body.vehicleYear, 10);
      if (!body.existingInsurer) delete body.existingInsurer;
      if (!body.policyExpiryDate) delete body.policyExpiryDate;
      if (!body.followUpDate) delete body.followUpDate;
      if (!body.location) delete body.location;
      if (!body.state) delete body.state;
      if (!body.city) delete body.city;
      if (!body.remarks) delete body.remarks;
      await onSave(body);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="font-bold text-base">{initial?._id ? "Edit Lead" : "Add Insurance Lead"}</h2>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Contact */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Contact Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Primary Contact *</Label>
                <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Alternate Contact</Label>
                <Input value={form.altContact} onChange={(e) => set("altContact", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="Area / Town" value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Vehicle & Insurance</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vehicle Type</Label>
                <Select value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)}>
                  <option value="">Select…</option>
                  {["Car", "Truck", "Two Wheeler", "Commercial", "Other"].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Model</Label>
                <Input placeholder="e.g. Swift Dzire" value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Registration Number</Label>
                <Input placeholder="PB-XX-XXXX" value={form.regNumber} onChange={(e) => set("regNumber", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Year</Label>
                <Input type="number" placeholder="e.g. 2020" value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Existing Insurer</Label>
                <Input placeholder="Current insurance company" value={form.existingInsurer} onChange={(e) => set("existingInsurer", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Policy Expiry Date</Label>
                <Input type="date" value={form.policyExpiryDate?.slice(0, 10) ?? ""} onChange={(e) => set("policyExpiryDate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Lead details */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Lead Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onChange={(e) => set("source", e.target.value)}>
                  {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Follow-up Date</Label>
                <Input type="date" value={form.followUpDate?.slice(0, 10) ?? ""} onChange={(e) => set("followUpDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                <Select value={form.assignedTo?._id ?? form.assignedTo ?? ""} onChange={(e) => set("assignedTo", e.target.value)}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Remarks</Label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Any additional notes…"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2.5 pt-1">
            <Button variant="secondary" size="md" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" className="flex-1" type="submit" loading={saving}>
              {initial?._id ? "Save Changes" : "Add Lead"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Convert Modal ─────────────────────────────────────────────────────────────

function ConvertModal({ lead, onClose, onDone }: {
  lead: InsuranceLead;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({
    premiumAmount: "", insurer: lead.existingInsurer ?? "",
    coverageType: "Comprehensive", insuredName: `${lead.firstName} ${lead.lastName}`,
    agentName: "", startDate: "", endDate: "", ownerType: "Sai Credit",
    holdAmount: "", reminderDate: "", policyName: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const body: ConvertLeadBody = {
        premiumAmount: parseFloat(form.premiumAmount),
        insurer: form.insurer,
        startDate: form.startDate,
        endDate: form.endDate,
        coverageType: form.coverageType,
        insuredName: form.insuredName,
        agentName: form.agentName || undefined,
        ownerType: form.ownerType,
        holdAmount: form.holdAmount ? parseFloat(form.holdAmount) : undefined,
        reminderDate: form.reminderDate || undefined,
        policyName: form.policyName || undefined,
      };
      await insuranceLeadsApi.convert(lead._id, body);
      onDone();
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-bold text-base">Convert to Insurance MIS</h2>
            <p className="text-xs text-muted mt-0.5">{lead.leadCode} · {lead.firstName} {lead.lastName}</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Insurer *</Label>
              <Input value={form.insurer} onChange={(e) => set("insurer", e.target.value)} required placeholder="Insurance company name" />
            </div>
            <div className="space-y-1.5">
              <Label>Policy Name</Label>
              <Input value={form.policyName} onChange={(e) => set("policyName", e.target.value)} placeholder="e.g. Comprehensive 1+5" />
            </div>
            <div className="space-y-1.5">
              <Label>Coverage Type</Label>
              <Select value={form.coverageType} onChange={(e) => set("coverageType", e.target.value)}>
                {["Comprehensive", "Third Party", "Own Damage"].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Premium Amount (₹) *</Label>
              <Input type="number" required value={form.premiumAmount} onChange={(e) => set("premiumAmount", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Hold Amount (₹)</Label>
              <Input type="number" value={form.holdAmount} onChange={(e) => set("holdAmount", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Policy Start Date *</Label>
              <Input type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Policy End Date *</Label>
              <Input type="date" required value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Insured Name</Label>
              <Input value={form.insuredName} onChange={(e) => set("insuredName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Agent Name</Label>
              <Input value={form.agentName} onChange={(e) => set("agentName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Owner Type</Label>
              <Select value={form.ownerType} onChange={(e) => set("ownerType", e.target.value)}>
                {["Bank", "Sai Credit", "Dealer"].map((v) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reminder Date</Label>
              <Input type="date" value={form.reminderDate} onChange={(e) => set("reminderDate", e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2.5 pt-1">
            <Button variant="secondary" size="md" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="md" className="flex-1" type="submit" loading={saving}>
              <ShieldCheck className="size-3.5" /> Convert Lead
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, onEdit, onConvert, onDelete, onStatusChange }: {
  lead: InsuranceLead;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expiryDays = lead.policyExpiryDate
    ? Math.round((new Date(lead.policyExpiryDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((o) => !o)} className="size-7 flex items-center justify-center text-muted hover:bg-surface-2 rounded-lg transition-colors shrink-0">
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>

        <div className="size-9 rounded-xl bg-primary/10 grid place-items-center font-bold text-primary text-sm shrink-0">
          {lead.firstName[0]}{lead.lastName[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{lead.firstName} {lead.lastName}</span>
            <span className="text-[10px] text-muted font-mono bg-surface-2 px-1.5 py-0.5 rounded">{lead.leadCode}</span>
            <Badge tone={statusTone(lead.status)}>{statusLabel(lead.status)}</Badge>
            {lead.convertedMisId && <Badge tone="success">Converted</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-muted">
            <span className="flex items-center gap-1"><Phone className="size-3" />{lead.contact}</span>
            {lead.vehicleModel && <span className="flex items-center gap-1"><Car className="size-3" />{lead.vehicleModel}</span>}
            {lead.existingInsurer && <span>{lead.existingInsurer}</span>}
            {expiryDays !== null && (
              <span className={expiryDays < 0 ? "text-red-500" : expiryDays < 30 ? "text-orange-500" : ""}>
                {expiryDays < 0 ? `Expired ${Math.abs(expiryDays)}d ago` : `Expires in ${expiryDays}d`}
              </span>
            )}
          </div>
        </div>

        {/* Quick status change */}
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-xs rounded-lg border border-border bg-surface px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div className="flex items-center gap-1 shrink-0">
          {lead.status !== "converted" && lead.status !== "lost" && (
            <Button variant="primary" size="sm" onClick={onConvert} className="gap-1 text-xs !px-2.5">
              <ShieldCheck className="size-3" /> Convert
            </Button>
          )}
          <button onClick={onEdit} className="size-8 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-primary transition-colors">
            <Edit2 className="size-3.5" />
          </button>
          <button onClick={onDelete} className="size-8 flex items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-red-500 transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface-2/30 grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Contact</p>
            <p className="font-medium">{lead.firstName} {lead.lastName}</p>
            <p className="text-muted">{lead.contact}</p>
            {lead.altContact && <p className="text-muted">{lead.altContact}</p>}
            {lead.location && <p className="text-muted">{lead.location}{lead.state ? `, ${lead.state}` : ""}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Vehicle</p>
            {lead.vehicleType  && <p><span className="text-muted">Type:</span> {lead.vehicleType}</p>}
            {lead.vehicleModel && <p><span className="text-muted">Model:</span> {lead.vehicleModel}</p>}
            {lead.regNumber    && <p><span className="text-muted">Reg:</span> {lead.regNumber}</p>}
            {lead.vehicleYear  && <p><span className="text-muted">Year:</span> {lead.vehicleYear}</p>}
            {lead.existingInsurer && <p><span className="text-muted">Insurer:</span> {lead.existingInsurer}</p>}
            {lead.policyExpiryDate && <p><span className="text-muted">Expiry:</span> {fmtDate(lead.policyExpiryDate)}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Lead Info</p>
            <p><span className="text-muted">Source:</span> {SOURCE_OPTIONS.find((s) => s.value === lead.source)?.label ?? lead.source}</p>
            {lead.assignedTo && <p><span className="text-muted">Assigned:</span> {(lead.assignedTo as any).firstName} {(lead.assignedTo as any).lastName}</p>}
            {lead.followUpDate && <p><span className="text-muted">Follow-up:</span> {fmtDate(lead.followUpDate)}</p>}
            {lead.convertedAt && <p><span className="text-muted">Converted on:</span> {fmtDate(lead.convertedAt)}</p>}
            {lead.remarks && <p className="text-muted mt-1 text-xs">{lead.remarks}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InsuranceLeadsPage() {
  const [leads, setLeads] = useState<InsuranceLead[]>([]);
  const [stats, setStats] = useState<InsuranceLeadStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<InsuranceLead | null>(null);
  const [convertLead, setConvertLead] = useState<InsuranceLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s, u] = await Promise.all([
        insuranceLeadsApi.list({ status: statusFilter || undefined, search: search || undefined, limit: 100 }),
        insuranceLeadsApi.stats(),
        usersApi.list({ limit: 100 }),
      ]);
      setLeads(r.data.leads);
      setStats(s.data);
      setUsers(u.data);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<InsuranceLead>) {
    if (editLead) { await insuranceLeadsApi.update(editLead._id, data); }
    else { await insuranceLeadsApi.create(data); }
    setAddOpen(false); setEditLead(null); load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Archive this lead?")) return;
    await insuranceLeadsApi.delete(id); load();
  }

  async function handleStatusChange(id: string, status: string) {
    await insuranceLeadsApi.update(id, { status } as any);
    setLeads((prev) => prev.map((l) => l._id === id ? { ...l, status: status as any } : l));
    if (stats) load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Insurance Leads</h1>
          <p className="text-sm text-muted mt-0.5">Track prospects and convert them to insurance policies</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="size-3.5" /> Add Lead
        </Button>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {([
            ["Total",      stats.total,      "text-foreground",  ""],
            ["New",        stats.new,        "text-blue-600",    ""],
            ["Contacted",  stats.contacted,  "text-yellow-600",  ""],
            ["Interested", stats.interested, "text-orange-600",  ""],
            ["Converted",  stats.converted,  "text-green-600",   ""],
            ["Lost",       stats.lost,       "text-red-500",     ""],
          ] as [string, number, string, string][]).map(([l, v, c]) => (
            <button
              key={l}
              onClick={() => setStatusFilter(l === "Total" ? "" : l.toLowerCase())}
              className={`card p-3 text-center transition-all hover:border-primary/40 ${
                (l === "Total" ? !statusFilter : statusFilter === l.toLowerCase()) ? "ring-2 ring-primary border-primary" : ""
              }`}
            >
              <p className={`text-xl font-bold ${c}`}>{v}</p>
              <p className="text-[10px] text-muted">{l}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <Input
            placeholder="Search by name, contact, vehicle…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-10 text-center text-sm text-muted">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="card p-12 text-center">
          <ShieldCheck className="size-10 text-muted/30 mx-auto mb-3" />
          <p className="font-medium">No leads found</p>
          <p className="text-sm text-muted mt-1">Add your first insurance lead to get started</p>
          <Button variant="primary" size="sm" className="mt-4 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add Lead
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadCard
              key={lead._id}
              lead={lead}
              onEdit={() => setEditLead(lead)}
              onConvert={() => setConvertLead(lead)}
              onDelete={() => handleDelete(lead._id)}
              onStatusChange={(s) => handleStatusChange(lead._id, s)}
            />
          ))}
        </div>
      )}

      {(addOpen || editLead) && (
        <LeadForm
          initial={editLead ?? undefined}
          users={users}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditLead(null); }}
        />
      )}
      {convertLead && (
        <ConvertModal
          lead={convertLead}
          onClose={() => setConvertLead(null)}
          onDone={() => { setConvertLead(null); load(); }}
        />
      )}
    </div>
  );
}
