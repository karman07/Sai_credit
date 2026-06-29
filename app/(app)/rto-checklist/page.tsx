"use client";

import { useState, useEffect, useCallback } from "react";
import { Save, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Label, ProgressBar, Badge } from "../../../components/ui";
import {
  casesApi, rtoApi, formSchemasApi,
  type LoanCase, type RTORecord, type FieldDef, type SectionDef,
} from "../../../lib/api";

const VEHICLE_PRODUCTS = ["Car Loan", "Truck", "Two Wheeler"];
const CHECKLIST_OPTS   = ["Pending", "Received", "Not Required"] as const;
const STAGE_OPTS       = ["Pending", "Done"] as const;
const OWNERSHIP_TYPES  = ["Banker", "Dealer", "Sai Credit Solutions"] as const;

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
    rtoOwnershipType:    (r as any).rtoOwnershipType ?? "Banker",
    rtoOwnership:        r.rtoOwnership ?? "Pending",
    rtoReceiving:        (r as any).rtoReceiving ?? false,
    challanCheck:        r.challanCheck ?? "Pending",
    bankNocCheck:        (r as any).bankNocCheck ?? "Pending",
    insuranceCheck:      (r as any).insuranceCheck ?? "Pending",
    hypothecation:       r.hypothecation ?? "Pending",
    aadhaarMatch:        r.aadhaarMatch ?? "Pending",
    aadhaarMismatchNote: r.aadhaarMismatchNote ?? "",
    nocHoldAmt:          String((r as any).nocHoldAmt ?? 0),
    pendingDocuments:    ((r as any).pendingDocuments ?? []).join(", "),
    verification:        (r as any).verification ?? "Pending",
    approval:            (r as any).approval ?? "Pending",
    approvalDate:        (r as any).approvalDate ? String((r as any).approvalDate).substring(0, 10) : "",
    insuranceEndorsement: (r as any).insuranceEndorsement ?? "Pending",
    balancePayment:      String((r as any).balancePayment ?? 0),
    remarks:             r.remarks ?? "",
    customFields:        Object.fromEntries(
      Object.entries((r as any).customFields ?? {}).map(([k, v]) => [k, String(v ?? "")]),
    ),
  };
}

function calcProgress(f: RTOForm) {
  const checklist = [f.rtoOwnership, f.challanCheck, f.bankNocCheck, f.insuranceCheck, f.hypothecation, f.aadhaarMatch];
  const applicable = checklist.filter(v => v && v !== "Not Required").length;
  const done       = checklist.filter(v => v === "Received").length;
  const stagesDone = [f.verification, f.approval, f.insuranceEndorsement].filter(v => v === "Done").length;
  const total      = applicable + 3;
  const completed  = done + stagesDone;
  return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function DynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const base = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
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
      <div className="flex items-center gap-2 mt-1">
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded" />
        <span className="text-sm">{field.label}</span>
      </div>
    );
  }
  if (field.type === "date") return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={base} />;
  if (field.type === "number") return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={base} />;
}

interface CaseRow { loanCase: LoanCase; rtoRecord: RTORecord | null; }

export default function RTOChecklistPage() {
  const [rows, setRows]         = useState<CaseRow[]>([]);
  const [forms, setForms]       = useState<Record<string, RTOForm>>({});
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseRes, rtoRes, schemaRes] = await Promise.all([
        casesApi.list({ limit: 500 }),
        rtoApi.list(),
        formSchemasApi.get("rto"),
      ]);

      setSections(schemaRes.data.sections);

      const allCases = (caseRes.data as any as LoanCase[]).filter(
        c => VEHICLE_PRODUCTS.includes(c.product),
      );
      const rtoMap = new Map<string, RTORecord>();
      for (const r of rtoRes.data) {
        const rid = (r as any).caseId;
        if (rid) rtoMap.set(rid, r);
      }

      const merged: CaseRow[] = allCases.map(c => ({
        loanCase: c, rtoRecord: rtoMap.get(c._id) ?? null,
      }));
      setRows(merged);

      const initForms: Record<string, RTOForm> = {};
      for (const { loanCase: c, rtoRecord: r } of merged) {
        initForms[c._id] = r ? rtoToForm(r) : { ...BLANK };
      }
      setForms(initForms);

      if (merged.length > 0) setExpanded(new Set([merged[0].loanCase._id]));
    } catch (e: any) {
      setError(e.message ?? "Failed to load RTO data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function schemaLabel(fieldKey: string, fallback: string): string {
    for (const sec of sections) {
      const f = sec.fields.find(f => f.key === fieldKey && f.isCore);
      if (f) return f.label;
    }
    return fallback;
  }

  function sectionTitle(sectionId: string, fallback: string): string {
    return sections.find(s => s.id === sectionId)?.title ?? fallback;
  }

  function customFieldsForSection(sectionId: string): FieldDef[] {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return [];
    return sec.fields.filter(f => !f.isCore && f.isActive);
  }

  function toggle(caseId: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(caseId) ? n.delete(caseId) : n.add(caseId); return n; });
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
    const { loanCase: c } = row;
    const f = forms[c._id];
    if (!f) return;
    setSaving(c._id);
    try {
      const body = {
        caseCode:     c.caseCode,
        customerName: `${c.customer.firstName} ${c.customer.lastName}`,
        rtoOwnershipType: f.rtoOwnershipType,
        rtoOwnership:     f.rtoOwnership,
        rtoReceiving:     f.rtoReceiving,
        challanCheck:     f.challanCheck,
        bankNocCheck:     f.bankNocCheck,
        insuranceCheck:   f.insuranceCheck,
        hypothecation:    f.hypothecation,
        aadhaarMatch:     f.aadhaarMatch,
        aadhaarMismatchNote: f.aadhaarMismatchNote || undefined,
        nocHoldAmt:       Number(f.nocHoldAmt) || 0,
        pendingDocuments: f.pendingDocuments.split(",").map(s => s.trim()).filter(Boolean),
        verification:     f.verification,
        approval:         f.approval,
        approvalDate:     f.approvalDate || undefined,
        insuranceEndorsement: f.insuranceEndorsement,
        balancePayment:   Number(f.balancePayment) || 0,
        remarks:          f.remarks || undefined,
        customFields:     f.customFields,
      };
      const { data } = await rtoApi.upsertByCase(c._id, body);
      setRows(prev => prev.map(r => r.loanCase._id === c._id ? { ...r, rtoRecord: data } : r));
    } catch (e: any) {
      alert(e.message ?? "Failed to save");
    } finally {
      setSaving(null);
    }
  }

  const inp = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-2 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl card p-4 border-danger-border bg-danger-subtle">
        <p className="text-sm text-danger font-medium">{error}</p>
        <button onClick={load} className="mt-2 text-xs text-primary underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadeIn max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RTO / Document Checklist</h1>
          <p className="text-sm text-muted mt-0.5">Track compliance for your vehicle loan cases</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mt-1">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {rows.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-muted text-sm">No vehicle loan cases found.</p>
        </div>
      )}

      {rows.map(row => {
        const { loanCase: c, rtoRecord: r } = row;
        const caseId   = c._id;
        const f        = forms[caseId] ?? BLANK;
        const isOpen   = expanded.has(caseId);
        const { completed, total, pct } = calcProgress(f);
        const isSaving = saving === caseId;

        return (
          <div key={caseId} className="card p-0 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2 transition-colors"
              onClick={() => toggle(caseId)}
            >
              {isOpen ? <ChevronDown className="size-4 text-muted shrink-0" /> : <ChevronRight className="size-4 text-muted shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-primary font-semibold">{c.caseCode}</span>
                  <span className="text-sm font-medium">{c.customer.firstName} {c.customer.lastName}</span>
                  <Badge tone="neutral">{c.product}</Badge>
                  {c.vehicleModel && <span className="text-xs text-muted">· {c.vehicleModel}</span>}
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={pct} tone={pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger"} size="sm" />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs font-semibold text-primary">{pct}%</span>
                <p className="text-[11px] text-muted">{completed}/{total} done</p>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border p-4 space-y-5 bg-surface-2/30 animate-fadeIn">

                {/* ── Ownership ── */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("ownership", "Ownership")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{schemaLabel("rtoOwnershipType", "Ownership Type")}</Label>
                      <select value={f.rtoOwnershipType} onChange={e => setField(caseId, "rtoOwnershipType", e.target.value)} className={inp}>
                        {OWNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>{schemaLabel("rtoOwnership", "RTO Ownership")}</Label>
                      <select value={f.rtoOwnership} onChange={e => setField(caseId, "rtoOwnership", e.target.value)} className={inp}>
                        {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <input type="checkbox" id={`recv-${caseId}`} checked={f.rtoReceiving} onChange={e => setField(caseId, "rtoReceiving", e.target.checked)} className="size-4 rounded" />
                      <label htmlFor={`recv-${caseId}`} className="text-sm font-medium cursor-pointer">{schemaLabel("rtoReceiving", "RTO Receiving")}</label>
                    </div>
                    {customFieldsForSection("ownership").map(field => (
                      <div key={field.key} className={field.type === "boolean" ? "col-span-2" : ""}>
                        <Label>{field.label}</Label>
                        <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Document Checklist ── */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("document-checklist", "Document Checklist")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["challanCheck",   "Challan Check"],
                      ["bankNocCheck",   "Bank NOC"],
                      ["insuranceCheck", "Insurance Check"],
                      ["hypothecation",  "Hypothecation"],
                      ["aadhaarMatch",   "Aadhaar Match"],
                    ] as const).map(([key, fallback]) => (
                      <div key={key}>
                        <Label>{schemaLabel(key, fallback)}</Label>
                        <select value={f[key]} onChange={e => setField(caseId, key, e.target.value)} className={inp}>
                          {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <Label>{schemaLabel("aadhaarMismatchNote", "Aadhaar Mismatch Note")}</Label>
                      <input value={f.aadhaarMismatchNote} onChange={e => setField(caseId, "aadhaarMismatchNote", e.target.value)} placeholder="Optional note" className={inp} />
                    </div>
                    {customFieldsForSection("document-checklist").map(field => (
                      <div key={field.key} className={field.type === "boolean" ? "col-span-2" : ""}>
                        <Label>{field.label}</Label>
                        <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Financials ── */}
                <section className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{schemaLabel("nocHoldAmt", "NOC Hold (₹)")}</Label>
                    <input type="number" value={f.nocHoldAmt} onChange={e => setField(caseId, "nocHoldAmt", e.target.value)} className={inp} />
                  </div>
                  <div>
                    <Label>{schemaLabel("balancePayment", "Balance Payment (₹)")}</Label>
                    <input type="number" value={f.balancePayment} onChange={e => setField(caseId, "balancePayment", e.target.value)} className={inp} />
                  </div>
                  <div className="col-span-2">
                    <Label>{schemaLabel("pendingDocuments", "Pending Documents")}</Label>
                    <input value={f.pendingDocuments} onChange={e => setField(caseId, "pendingDocuments", e.target.value)} placeholder="RC, Form 35, Insurance…" className={inp} />
                  </div>
                </section>

                {/* ── Verification & Approval ── */}
                <section className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("verification-approval", "Verification & Approval")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      ["verification",        "Verification"],
                      ["approval",            "Approval"],
                      ["insuranceEndorsement","Insurance Endorsement"],
                    ] as const).map(([key, fallback]) => (
                      <div key={key}>
                        <Label>{schemaLabel(key, fallback)}</Label>
                        <select value={f[key]} onChange={e => setField(caseId, key, e.target.value)} className={inp}>
                          {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                    <div>
                      <Label>{schemaLabel("approvalDate", "Approval Date")}</Label>
                      <input type="date" value={f.approvalDate} onChange={e => setField(caseId, "approvalDate", e.target.value)} className={inp} />
                    </div>
                    {customFieldsForSection("verification-approval").map(field => (
                      <div key={field.key} className={field.type === "boolean" ? "col-span-2" : ""}>
                        <Label>{field.label}</Label>
                        <DynField field={field} value={f.customFields[field.key] ?? field.defaultValue ?? ""} onChange={v => setCustomField(caseId, field.key, v)} />
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Remarks + Save ── */}
                <section className="space-y-2">
                  <Label>{schemaLabel("remarks", "Remarks")}</Label>
                  <textarea
                    className={`${inp} min-h-[56px] resize-y`}
                    value={f.remarks}
                    onChange={e => setField(caseId, "remarks", e.target.value)}
                    placeholder="Optional remarks"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => save(row)}
                      disabled={!!saving}
                      className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Save className="size-3.5" />
                      {isSaving ? "Saving…" : r ? "Update RTO" : "Save RTO"}
                    </button>
                  </div>
                </section>

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
