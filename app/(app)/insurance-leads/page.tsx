"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Plus, X, Phone, Car, RefreshCw,
  ChevronDown, ChevronRight, Edit2, Search, Calendar,
} from "lucide-react";
import { insuranceLeadsApi, type InsuranceLead } from "../../../lib/api";
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

function LeadForm({ initial, onSave, onClose }: {
  initial?: Partial<InsuranceLead>;
  onSave: (data: Partial<InsuranceLead>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({
    firstName: "", lastName: "", contact: "", altContact: "",
    vehicleType: "", vehicleModel: "", regNumber: "", vehicleYear: "",
    existingInsurer: "", policyExpiryDate: "", location: "", state: "",
    status: "new", source: "other", remarks: "", followUpDate: "",
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
      // strip empty optional fields
      const optional = ["altContact","vehicleType","vehicleModel","regNumber","vehicleYear",
        "existingInsurer","policyExpiryDate","followUpDate","location","state","remarks"];
      for (const k of optional) if (!body[k]) delete body[k];
      if (body.vehicleYear) body.vehicleYear = parseInt(body.vehicleYear, 10);
      await onSave(body);
    } catch (e: any) { setError(e.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-surface z-10">
          <h2 className="font-bold text-base">{initial?._id ? "Edit Lead" : "Add Insurance Lead"}</h2>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Contact */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Contact</p>
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
                <Label>Phone *</Label>
                <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Alt. Phone</Label>
                <Input value={form.altContact} onChange={(e) => set("altContact", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Area / Location</Label>
                <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => set("state", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Vehicle */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Vehicle & Current Insurance</p>
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
                <Label>Reg. Number</Label>
                <Input placeholder="PB-XX-XXXX" value={form.regNumber} onChange={(e) => set("regNumber", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" placeholder="2020" value={form.vehicleYear} onChange={(e) => set("vehicleYear", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Existing Insurer</Label>
                <Input placeholder="Current insurance company" value={form.existingInsurer} onChange={(e) => set("existingInsurer", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Policy Expiry</Label>
                <Input type="date" value={form.policyExpiryDate?.slice(0, 10) ?? ""} onChange={(e) => set("policyExpiryDate", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Lead */}
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
              <div className="col-span-2 space-y-1.5">
                <Label>Follow-up Date</Label>
                <Input type="date" value={form.followUpDate?.slice(0, 10) ?? ""} onChange={(e) => set("followUpDate", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Remarks</Label>
                <textarea
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Notes, call summary, interest level…"
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

// ── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({ lead, onEdit, onStatusChange }: {
  lead: InsuranceLead;
  onEdit: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const expiryDays = lead.policyExpiryDate
    ? Math.round((new Date(lead.policyExpiryDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded((o) => !o)} className="size-7 flex items-center justify-center text-muted hover:bg-surface-2 rounded-lg shrink-0">
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
            {expiryDays !== null && (
              <span className={`flex items-center gap-1 ${expiryDays < 0 ? "text-red-500" : expiryDays < 30 ? "text-orange-500" : ""}`}>
                <Calendar className="size-3" />
                {expiryDays < 0 ? `Expired ${Math.abs(expiryDays)}d ago` : `Expires in ${expiryDays}d`}
              </span>
            )}
          </div>
        </div>

        <select
          value={lead.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-xs rounded-lg border border-border bg-surface px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {STATUS_OPTIONS.filter((o) => o.value !== "converted").map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={onEdit} className="size-8 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-primary">
          <Edit2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface-2/30 grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Vehicle</p>
            {lead.vehicleType  && <p><span className="text-muted">Type:</span> {lead.vehicleType}</p>}
            {lead.vehicleModel && <p><span className="text-muted">Model:</span> {lead.vehicleModel}</p>}
            {lead.regNumber    && <p><span className="text-muted">Reg:</span> {lead.regNumber}</p>}
            {lead.existingInsurer && <p><span className="text-muted">Insurer:</span> {lead.existingInsurer}</p>}
            {lead.policyExpiryDate && <p><span className="text-muted">Expiry:</span> {fmtDate(lead.policyExpiryDate)}</p>}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">Details</p>
            <p><span className="text-muted">Source:</span> {SOURCE_OPTIONS.find((s) => s.value === lead.source)?.label ?? lead.source}</p>
            {lead.location && <p><span className="text-muted">Location:</span> {lead.location}{lead.state ? `, ${lead.state}` : ""}</p>}
            {lead.followUpDate && <p><span className="text-muted">Follow-up:</span> {fmtDate(lead.followUpDate)}</p>}
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editLead, setEditLead] = useState<InsuranceLead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await insuranceLeadsApi.list({ status: statusFilter || undefined, search: search || undefined });
      setLeads(r.data.leads);
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<InsuranceLead>) {
    if (editLead) { await insuranceLeadsApi.update(editLead._id, data); }
    else { await insuranceLeadsApi.create(data); }
    setAddOpen(false); setEditLead(null); load();
  }

  async function handleStatusChange(id: string, status: string) {
    await insuranceLeadsApi.update(id, { status } as any);
    setLeads((prev) => prev.map((l) => l._id === id ? { ...l, status: status as any } : l));
  }

  const counts = {
    total:      leads.length,
    new:        leads.filter((l) => l.status === "new").length,
    contacted:  leads.filter((l) => l.status === "contacted").length,
    interested: leads.filter((l) => l.status === "interested").length,
    converted:  leads.filter((l) => l.status === "converted").length,
    lost:       leads.filter((l) => l.status === "lost").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Insurance Leads</h1>
          <p className="text-sm text-muted mt-0.5">Track vehicle insurance prospects</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 shrink-0">
          <Plus className="size-3.5" /> Add Lead
        </Button>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {([
          ["Total",      counts.total,      "text-foreground" ],
          ["New",        counts.new,        "text-blue-600"   ],
          ["Contacted",  counts.contacted,  "text-yellow-600" ],
          ["Interested", counts.interested, "text-orange-600" ],
          ["Converted",  counts.converted,  "text-green-600"  ],
          ["Lost",       counts.lost,       "text-red-500"    ],
        ] as [string, number, string][]).map(([l, v, c]) => (
          <button
            key={l}
            onClick={() => setStatusFilter(l === "Total" ? "" : l.toLowerCase())}
            className={`bg-surface border border-border rounded-xl p-3 text-center transition-all hover:border-primary/40 ${
              (l === "Total" ? !statusFilter : statusFilter === l.toLowerCase()) ? "ring-2 ring-primary" : ""
            }`}
          >
            <p className={`text-xl font-bold ${c}`}>{v}</p>
            <p className="text-[10px] text-muted">{l}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
          <Input
            placeholder="Search name, contact, vehicle…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">All</option>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-10 text-center text-sm text-muted">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <ShieldCheck className="size-10 text-muted/30 mx-auto mb-3" />
          <p className="font-medium">No leads yet</p>
          <p className="text-sm text-muted mt-1">Start tracking insurance prospects by adding a lead</p>
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
              onStatusChange={(s) => handleStatusChange(lead._id, s)}
            />
          ))}
        </div>
      )}

      {(addOpen || editLead) && (
        <LeadForm
          initial={editLead ?? undefined}
          onSave={handleSave}
          onClose={() => { setAddOpen(false); setEditLead(null); }}
        />
      )}
    </div>
  );
}
