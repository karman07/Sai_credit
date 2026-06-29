"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Upload, ExternalLink, Save } from "lucide-react";
import {
  Badge, SearchInput, SectionHeader, Pagination, EmptyState, ProgressBar, Skeleton,
  Button, Input, Label, Select, CaseStatusBadge, useToast,
} from "../../../components/ui";
import {
  rtoApi, casesApi, formSchemasApi, API_BASE, RTO_OWNERSHIP_TYPES,
  type RTORecord, type LoanCase, type SectionDef, type FieldDef,
} from "../../../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICLE_PRODUCTS = ["Car Loan", "Truck", "Two Wheeler"];
const CHECKLIST_OPTS   = ["Pending", "Received", "Not Required"] as const;
const STAGE_OPTS       = ["Pending", "Done"] as const;

const statusToneMap: Record<string, string> = {
  Received:       "bg-success-subtle text-success border-success-border",
  Done:           "bg-teal-subtle text-teal border-teal-border",
  Pending:        "bg-warning-subtle text-warning border-warning-border",
  "Not Required": "bg-surface-3 text-muted border-border",
};

function chip(val: string | boolean | undefined) {
  if (val === true)  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-success-subtle text-success border-success-border">Yes</span>;
  if (val === false) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-surface-3 text-muted border-border">No</span>;
  const str = val ?? "Pending";
  const cls = statusToneMap[str] ?? "bg-surface-3 text-muted border-border";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{str}</span>;
}

// ── Form state ────────────────────────────────────────────────────────────────

type RTOForm = {
  rtoOwnershipType: string; rtoOwnership: string; rtoReceiving: boolean;
  challanCheck: string; bankNocCheck: string; insuranceCheck: string;
  hypothecation: string; aadhaarMatch: string; aadhaarMismatchNote: string;
  nocHoldAmt: string; pendingDocuments: string;
  verification: string; approval: string; approvalDate: string;
  insuranceEndorsement: string; balancePayment: string; remarks: string;
  customFields: Record<string, string>;
};

const BLANK: RTOForm = {
  rtoOwnershipType: "Banker", rtoOwnership: "Pending", rtoReceiving: false,
  challanCheck: "Pending", bankNocCheck: "Pending", insuranceCheck: "Pending",
  hypothecation: "Pending", aadhaarMatch: "Pending", aadhaarMismatchNote: "",
  nocHoldAmt: "0", pendingDocuments: "",
  verification: "Pending", approval: "Pending", approvalDate: "",
  insuranceEndorsement: "Pending", balancePayment: "0", remarks: "",
  customFields: {},
};

function rtoToForm(r: RTORecord): RTOForm {
  return {
    rtoOwnershipType:    r.rtoOwnershipType ?? "Banker",
    rtoOwnership:        (r as any).rtoOwnership ?? "Pending",
    rtoReceiving:        r.rtoReceiving ?? false,
    challanCheck:        r.challanCheck ?? "Pending",
    bankNocCheck:        r.bankNocCheck ?? "Pending",
    insuranceCheck:      r.insuranceCheck ?? "Pending",
    hypothecation:       r.hypothecation ?? "Pending",
    aadhaarMatch:        r.aadhaarMatch ?? "Pending",
    aadhaarMismatchNote: r.aadhaarMismatchNote ?? "",
    nocHoldAmt:          String(r.nocHoldAmt ?? 0),
    pendingDocuments:    (r.pendingDocuments ?? []).join(", "),
    verification:        r.verification ?? "Pending",
    approval:            r.approval ?? "Pending",
    approvalDate:        r.approvalDate ? r.approvalDate.substring(0, 10) : "",
    insuranceEndorsement: r.insuranceEndorsement ?? "Pending",
    balancePayment:      String(r.balancePayment ?? 0),
    remarks:             r.remarks ?? "",
    customFields:        Object.fromEntries(
      Object.entries(r.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };
}

function formToBody(f: RTOForm, c: LoanCase) {
  return {
    caseCode:     c.caseCode,
    customerName: `${c.customer.firstName} ${c.customer.lastName}`,
    rtoOwnershipType:    f.rtoOwnershipType,
    rtoOwnership:        f.rtoOwnership,
    rtoReceiving:        f.rtoReceiving,
    challanCheck:        f.challanCheck,
    bankNocCheck:        f.bankNocCheck,
    insuranceCheck:      f.insuranceCheck,
    hypothecation:       f.hypothecation,
    aadhaarMatch:        f.aadhaarMatch,
    aadhaarMismatchNote: f.aadhaarMismatchNote || undefined,
    nocHoldAmt:          Number(f.nocHoldAmt) || 0,
    pendingDocuments:    f.pendingDocuments.split(",").map(s => s.trim()).filter(Boolean),
    verification:        f.verification,
    approval:            f.approval,
    approvalDate:        f.approvalDate || undefined,
    insuranceEndorsement: f.insuranceEndorsement,
    balancePayment:      Number(f.balancePayment) || 0,
    remarks:             f.remarks || undefined,
    customFields:        f.customFields,
  };
}

// ── Progress ──────────────────────────────────────────────────────────────────

function calcProgress(r: Partial<RTORecord> & { rtoOwnership?: string }) {
  const checklist = [
    r.rtoOwnership, r.challanCheck, r.bankNocCheck,
    r.insuranceCheck, r.hypothecation, r.aadhaarMatch,
  ];
  const applicable = checklist.filter(v => v && v !== "Not Required").length;
  const done       = checklist.filter(v => v === "Received").length;
  const stagesDone = [r.verification, r.approval, r.insuranceEndorsement].filter(v => v === "Done").length;
  const total      = applicable + 3;
  const completed  = done + stagesDone;
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}

// ── DynField — renders a custom (non-core) field ──────────────────────────────

function DynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const base = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none";
  if (field.type === "select") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className={base}>
        <option value="">—</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-2 pt-1">
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded" />
        <span className="text-sm">{field.label}</span>
      </div>
    );
  }
  if (field.type === "date") return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={base} />;
  if (field.type === "number") return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base} />;
}

// ── Row type ──────────────────────────────────────────────────────────────────

interface CaseRow { loanCase: LoanCase; rtoRecord: RTORecord | null; }

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RTOTrackerPage() {
  const toast = useToast();
  const [rows, setRows]         = useState<CaseRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [forms, setForms]       = useState<Record<string, RTOForm>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [slipUploading, setSlipUploading] = useState<string | null>(null);
  const [page, setPage]         = useState(1);
  const limit = 15;
  const [sections, setSections] = useState<SectionDef[]>([]);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caseRes, rtoRes, schemaRes] = await Promise.all([
        casesApi.list({ limit: 1000 }),
        rtoApi.list(),
        formSchemasApi.get("rto"),
      ]);

      setSections(schemaRes.data.sections);

      const allCases = (caseRes.data as unknown as LoanCase[]).filter(
        c => VEHICLE_PRODUCTS.includes(c.product),
      );
      const rtoMap = new Map<string, RTORecord>();
      for (const r of rtoRes.data) { if (r.caseId) rtoMap.set(r.caseId, r); }

      const merged: CaseRow[] = allCases.map(c => ({
        loanCase: c, rtoRecord: rtoMap.get(c._id) ?? null,
      }));
      setRows(merged);

      const initForms: Record<string, RTOForm> = {};
      for (const { loanCase: c, rtoRecord: r } of merged) {
        initForms[c._id] = r ? rtoToForm(r) : { ...BLANK };
      }
      setForms(initForms);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // ── Schema helpers ────────────────────────────────────────────────────────────

  function schemaLabel(fieldKey: string, fallback: string): string {
    for (const sec of sections) {
      const f = sec.fields.find(f => f.key === fieldKey && f.isCore);
      if (f) return f.label;
    }
    return fallback;
  }

  function customFieldsForSection(sectionId: string): FieldDef[] {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return [];
    return sec.fields.filter(f => !f.isCore && f.isActive);
  }

  function sectionTitle(sectionId: string, fallback: string): string {
    return sections.find(s => s.id === sectionId)?.title ?? fallback;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function toggle(caseId: string) {
    setExpanded(p => { const n = new Set(p); n.has(caseId) ? n.delete(caseId) : n.add(caseId); return n; });
  }

  function setField<K extends keyof RTOForm>(caseId: string, key: K, val: RTOForm[K]) {
    setForms(prev => ({ ...prev, [caseId]: { ...prev[caseId], [key]: val } }));
  }

  function setCustomField(caseId: string, key: string, val: string) {
    setForms(prev => ({
      ...prev,
      [caseId]: { ...prev[caseId], customFields: { ...prev[caseId].customFields, [key]: val } },
    }));
  }

  async function save(row: CaseRow) {
    const caseId = row.loanCase._id;
    const f = forms[caseId];
    if (!f) return;
    setSaving(caseId);
    try {
      const { data } = await rtoApi.upsertByCase(caseId, formToBody(f, row.loanCase));
      setRows(prev => prev.map(r => r.loanCase._id === caseId ? { ...r, rtoRecord: data } : r));
      toast("success", `RTO saved — ${row.loanCase.caseCode}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function uploadSlip(row: CaseRow, file: File) {
    if (!row.rtoRecord) { toast("error", "Save RTO details first before uploading the slip"); return; }
    setSlipUploading(row.loanCase._id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await rtoApi.uploadSlip(row.rtoRecord._id, fd);
      setRows(prev => prev.map(r => r.loanCase._id === row.loanCase._id ? { ...r, rtoRecord: data } : r));
      toast("success", "RTO slip uploaded");
    } catch (e: any) {
      toast("error", e.message ?? "Upload failed");
    } finally {
      setSlipUploading(null);
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────────

  const filtered = rows.filter(({ loanCase: c, rtoRecord: r }) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || c.caseCode.toLowerCase().includes(q)
      || `${c.customer.firstName} ${c.customer.lastName}`.toLowerCase().includes(q)
      || (c.vehicleModel ?? "").toLowerCase().includes(q);
    const pct = r ? calcProgress({ ...r, rtoOwnership: (r as any).rtoOwnership }).pct : 0;
    const matchStatus =
      filterStatus === "all"      ? true :
      filterStatus === "complete" ? pct === 100 :
      filterStatus === "started"  ? r !== null && pct < 100 :
      filterStatus === "new"      ? r === null : true;
    return matchSearch && matchStatus;
  });

  const paged         = filtered.slice((page - 1) * limit, page * limit);
  const completeCount = rows.filter(({ rtoRecord: r }) => r && calcProgress({ ...r, rtoOwnership: (r as any).rtoOwnership }).pct === 100).length;
  const startedCount  = rows.filter(({ rtoRecord: r }) => r !== null).length;
  const newCount      = rows.filter(({ rtoRecord: r }) => r === null).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="RTO & Documentation Tracker"
        description="All vehicle loan cases — track RTO compliance inline"
        action={<Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />

      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">Total Cases</span><Badge tone="neutral">{rows.length}</Badge></div>
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">Not Started</span><Badge tone="warning">{newCount}</Badge></div>
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">In Progress</span><Badge tone="info">{startedCount - completeCount}</Badge></div>
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">Complete</span><Badge tone="success">{completeCount}</Badge></div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search case, customer, vehicle…" className="w-72" />
        <Select className="!h-8 w-40 text-xs" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="all">All cases</option>
          <option value="new">Not started</option>
          <option value="started">In progress</option>
          <option value="complete">Complete</option>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : paged.length === 0 ? (
        <EmptyState title="No cases found" description="Vehicle loan cases (Car Loan, Truck, Two Wheeler) appear here automatically." />
      ) : (
        <div className="space-y-2">
          {paged.map((row) => {
            const { loanCase: c, rtoRecord: r } = row;
            const caseId   = c._id;
            const f        = forms[caseId] ?? BLANK;
            const isOpen   = expanded.has(caseId);
            const { completed, total, pct } = r
              ? calcProgress({ ...r, rtoOwnership: (r as any).rtoOwnership })
              : { completed: 0, total: 9, pct: 0 };
            const tone     = pct === 100 ? "success" : r ? "warning" : "primary";
            const isSaving = saving === caseId;

            return (
              <div key={caseId} className="card p-0 overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-2 transition-colors"
                  onClick={() => toggle(caseId)}
                >
                  {isOpen ? <ChevronDown className="size-4 text-muted shrink-0" /> : <ChevronRight className="size-4 text-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-primary font-semibold">{c.caseCode}</span>
                      <span className="text-sm font-medium truncate">{c.customer.firstName} {c.customer.lastName}</span>
                      <Badge tone="neutral">{c.product}</Badge>
                      {c.vehicleModel && <span className="text-xs text-muted hidden sm:inline">· {c.vehicleModel}</span>}
                      <CaseStatusBadge status={c.status} />
                    </div>
                    <div className="mt-1.5"><ProgressBar value={pct} tone={tone} size="sm" /></div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {r ? <Badge tone={tone as any}>{completed}/{total} done · {pct}%</Badge> : <Badge tone="neutral">Not started</Badge>}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 animate-fadeIn space-y-5 bg-surface-2/40">

                    {/* ── Ownership ── */}
                    <section className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                        {sectionTitle("ownership", "Ownership")}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <Label>{schemaLabel("rtoOwnershipType", "Ownership Type")}</Label>
                          <Select value={f.rtoOwnershipType} onChange={e => setField(caseId, "rtoOwnershipType", e.target.value)}>
                            {RTO_OWNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>{schemaLabel("rtoOwnership", "RTO Ownership")}</Label>
                          <Select value={f.rtoOwnership} onChange={e => setField(caseId, "rtoOwnership", e.target.value)}>
                            {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-5">
                          <input type="checkbox" id={`recv-${caseId}`} checked={f.rtoReceiving} onChange={e => setField(caseId, "rtoReceiving", e.target.checked)} className="size-4 rounded" />
                          <label htmlFor={`recv-${caseId}`} className="text-sm font-medium cursor-pointer">
                            {schemaLabel("rtoReceiving", "RTO Receiving")}
                          </label>
                        </div>
                        {customFieldsForSection("ownership").map(field => (
                          <div key={field.key}>
                            <Label>{field.label}{field.required && <span className="text-danger ml-0.5">*</span>}</Label>
                            <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* ── Document Checklist ── */}
                    <section className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                        {sectionTitle("document-checklist", "Document Checklist")}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {([
                          ["challanCheck",   "Challan Check"],
                          ["bankNocCheck",   "Bank NOC"],
                          ["insuranceCheck", "Insurance Check"],
                          ["hypothecation",  "Hypothecation"],
                          ["aadhaarMatch",   "Aadhaar Match"],
                        ] as const).map(([key, fallback]) => (
                          <div key={key}>
                            <Label>{schemaLabel(key, fallback)}</Label>
                            <Select value={f[key]} onChange={e => setField(caseId, key, e.target.value)}>
                              {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                          </div>
                        ))}
                        <div>
                          <Label>{schemaLabel("aadhaarMismatchNote", "Aadhaar Mismatch Note")}</Label>
                          <Input value={f.aadhaarMismatchNote} onChange={e => setField(caseId, "aadhaarMismatchNote", e.target.value)} placeholder="Optional note" />
                        </div>
                        {customFieldsForSection("document-checklist").map(field => (
                          <div key={field.key}>
                            <Label>{field.label}{field.required && <span className="text-danger ml-0.5">*</span>}</Label>
                            <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* ── Pending docs + Financials ── */}
                    <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <Label>{schemaLabel("pendingDocuments", "Pending Documents")}</Label>
                        <Input value={f.pendingDocuments} onChange={e => setField(caseId, "pendingDocuments", e.target.value)} placeholder="RC, Form 35, Insurance…" />
                      </div>
                      <div>
                        <Label>{schemaLabel("nocHoldAmt", "NOC Hold (₹)")}</Label>
                        <Input type="number" value={f.nocHoldAmt} onChange={e => setField(caseId, "nocHoldAmt", e.target.value)} />
                      </div>
                      <div>
                        <Label>{schemaLabel("balancePayment", "Balance Payment (₹)")}</Label>
                        <Input type="number" value={f.balancePayment} onChange={e => setField(caseId, "balancePayment", e.target.value)} />
                      </div>
                    </section>

                    {/* ── Verification & Approval ── */}
                    <section className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                        {sectionTitle("verification-approval", "Verification & Approval")}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <Label>{schemaLabel("verification", "Verification")}</Label>
                          <Select value={f.verification} onChange={e => setField(caseId, "verification", e.target.value)}>
                            {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>{schemaLabel("approval", "Approval")}</Label>
                          <Select value={f.approval} onChange={e => setField(caseId, "approval", e.target.value)}>
                            {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                        <div>
                          <Label>{schemaLabel("approvalDate", "Approval Date")}</Label>
                          <Input type="date" value={f.approvalDate} onChange={e => setField(caseId, "approvalDate", e.target.value)} />
                        </div>
                        <div>
                          <Label>{schemaLabel("insuranceEndorsement", "Insurance Endorsement")}</Label>
                          <Select value={f.insuranceEndorsement} onChange={e => setField(caseId, "insuranceEndorsement", e.target.value)}>
                            {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                        {customFieldsForSection("verification-approval").map(field => (
                          <div key={field.key}>
                            <Label>{field.label}{field.required && <span className="text-danger ml-0.5">*</span>}</Label>
                            <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* ── RTO Slip ── */}
                    <section className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">RTO Slip</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        {r?.rtoSlipUrl ? (
                          <a
                            href={r.rtoSlipUrl.startsWith("http") ? r.rtoSlipUrl : API_BASE.replace("/api/v1", "") + r.rtoSlipUrl}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                          >
                            <ExternalLink className="size-3.5" /> {r.rtoSlipFileName ?? "View Slip"}
                          </a>
                        ) : (
                          <span className="text-xs text-muted italic">No slip uploaded</span>
                        )}
                        <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${slipUploading === caseId ? "opacity-50 pointer-events-none" : "border-border hover:border-primary hover:text-primary"}`}>
                          <Upload className="size-3" />
                          {slipUploading === caseId ? "Uploading…" : "Upload Slip"}
                          <input type="file" className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) uploadSlip(row, file); }} />
                        </label>
                      </div>
                    </section>

                    {/* ── Remarks + Save ── */}
                    <section>
                      <Label>{schemaLabel("remarks", "Remarks")}</Label>
                      <textarea
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[56px] mb-3"
                        value={f.remarks}
                        onChange={e => setField(caseId, "remarks", e.target.value)}
                        placeholder="Optional remarks"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" loading={isSaving} onClick={() => save(row)}>
                          <Save className="size-3.5" /> {r ? "Update RTO" : "Save RTO"}
                        </Button>
                      </div>
                    </section>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(filtered.length / limit))}
        total={filtered.length}
        limit={limit}
        onPage={setPage}
        onLimit={() => {}}
      />
    </div>
  );
}
