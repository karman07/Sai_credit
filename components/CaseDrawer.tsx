"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText, Calendar, Building2, Users, MapPin, Banknote,
  CheckCircle2, AlertCircle, UploadCloud, Pencil, Trash2, Edit2,
} from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, Drawer, Tabs,
  Select, Input, Label, Modal, EmptyState, Timeline,
  Skeleton, useToast, type CaseStatus,
} from "./ui";
import {
  casesApi, banksApi, dealersApi, usersApi, mastersApi,
  rtoApi, formSchemasApi, RTO_OWNERSHIP_TYPES,
  CASE_STATUSES, PRODUCTS, LOAN_TYPES, API_BASE, PIPELINE_STAGES,
  type LoanCase, type Bank, type Dealer, type Activity,
  type SalesUser, type DocumentType, type RTORecord, type SectionDef, type FieldDef,
} from "../lib/api";

function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }

// ── RTOTab ─────────────────────────────────────────────────────────────────────

const CHECKLIST_OPTS = ["Pending", "Received", "Not Required"] as const;
const STAGE_OPTS     = ["Pending", "Done"] as const;

type RTOForm = {
  rtoOwnershipType: string; rtoOwnership: string; rtoReceiving: boolean;
  challanCheck: string; bankNocCheck: string; insuranceCheck: string;
  hypothecation: string; aadhaarMatch: string; aadhaarMismatchNote: string;
  nocHoldAmt: string; pendingDocuments: string;
  verification: string; approval: string; approvalDate: string;
  insuranceEndorsement: string; balancePayment: string; remarks: string;
  customFields: Record<string, string>;
};

const RTO_BLANK: RTOForm = {
  rtoOwnershipType: "Banker", rtoOwnership: "Pending", rtoReceiving: false,
  challanCheck: "Pending", bankNocCheck: "Pending", insuranceCheck: "Pending",
  hypothecation: "Pending", aadhaarMatch: "Pending", aadhaarMismatchNote: "",
  nocHoldAmt: "0", pendingDocuments: "",
  verification: "Pending", approval: "Pending", approvalDate: "",
  insuranceEndorsement: "Pending", balancePayment: "0", remarks: "",
  customFields: {},
};

function rtoRecordToForm(r: RTORecord): RTOForm {
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
    customFields:        Object.fromEntries(Object.entries(r.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")])),
  };
}

function RTODynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const cls = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none";
  if (field.type === "select") return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="">—</option>
      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (field.type === "boolean") return (
    <div className="flex items-center gap-2 pt-1">
      <input type="checkbox" checked={value === "true"} onChange={e => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded" />
      <span className="text-sm">{field.label}</span>
    </div>
  );
  if (field.type === "date") return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  if (field.type === "number") return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
}

function RTOTab({ caseId, loanCase }: { caseId: string; loanCase: LoanCase }) {
  const toast = useToast();
  const [record, setRecord]   = useState<RTORecord | null>(null);
  const [form, setForm]       = useState<RTOForm>(RTO_BLANK);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([rtoApi.list(caseId), formSchemasApi.get("rto")])
      .then(([rtoRes, schemaRes]) => {
        if (!alive) return;
        setSections(schemaRes.data.sections);
        const rec = rtoRes.data[0] ?? null;
        setRecord(rec);
        setForm(rec ? rtoRecordToForm(rec) : { ...RTO_BLANK });
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [caseId]);

  function schemaLabel(key: string, fallback: string) {
    for (const sec of sections) {
      const f = sec.fields.find(f => f.key === key && f.isCore);
      if (f) return f.label;
    }
    return fallback;
  }
  function sectionTitle(id: string, fallback: string) {
    return sections.find(s => s.id === id)?.title ?? fallback;
  }
  function customFieldsFor(id: string): FieldDef[] {
    const sec = sections.find(s => s.id === id);
    return sec ? sec.fields.filter(f => !f.isCore && f.isActive) : [];
  }

  function sf<K extends keyof RTOForm>(k: K, v: RTOForm[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }
  function scf(key: string, val: string) {
    setForm(prev => ({ ...prev, customFields: { ...prev.customFields, [key]: val } }));
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        caseCode: loanCase.caseCode,
        customerName: `${loanCase.customer.firstName} ${loanCase.customer.lastName}`,
        rtoOwnershipType: form.rtoOwnershipType,
        rtoOwnership: form.rtoOwnership, rtoReceiving: form.rtoReceiving,
        challanCheck: form.challanCheck, bankNocCheck: form.bankNocCheck,
        insuranceCheck: form.insuranceCheck, hypothecation: form.hypothecation,
        aadhaarMatch: form.aadhaarMatch, aadhaarMismatchNote: form.aadhaarMismatchNote || undefined,
        nocHoldAmt: Number(form.nocHoldAmt) || 0,
        pendingDocuments: form.pendingDocuments.split(",").map(s => s.trim()).filter(Boolean),
        verification: form.verification, approval: form.approval,
        approvalDate: form.approvalDate || undefined,
        insuranceEndorsement: form.insuranceEndorsement,
        balancePayment: Number(form.balancePayment) || 0,
        remarks: form.remarks || undefined,
        customFields: form.customFields,
      };
      const { data } = await rtoApi.upsertByCase(caseId, body);
      setRecord(data);
      toast("success", "RTO saved");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="animate-pulse space-y-2 pt-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-surface-2 rounded" />)}</div>;

  const inp = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none";

  return (
    <div className="animate-fadeIn space-y-5">

      {/* Ownership */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("ownership", "Ownership")}</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>{schemaLabel("rtoOwnershipType", "Ownership Type")}</Label>
            <select value={form.rtoOwnershipType} onChange={e => sf("rtoOwnershipType", e.target.value)} className={inp}>
              {RTO_OWNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label>{schemaLabel("rtoOwnership", "RTO Ownership")}</Label>
            <select value={form.rtoOwnership} onChange={e => sf("rtoOwnership", e.target.value)} className={inp}>
              {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id={`recv-drawer-${caseId}`} checked={form.rtoReceiving} onChange={e => sf("rtoReceiving", e.target.checked)} className="size-4 rounded" />
            <label htmlFor={`recv-drawer-${caseId}`} className="text-sm font-medium cursor-pointer">{schemaLabel("rtoReceiving", "RTO Receiving")}</label>
          </div>
          {customFieldsFor("ownership").map(field => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <RTODynField field={field} value={form.customFields[field.key] ?? ""} onChange={v => scf(field.key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Document Checklist */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("document-checklist", "Document Checklist")}</p>
        <div className="grid grid-cols-3 gap-3">
          {([
            ["challanCheck",   "Challan Check"],
            ["bankNocCheck",   "Bank NOC"],
            ["insuranceCheck", "Insurance Check"],
            ["hypothecation",  "Hypothecation"],
            ["aadhaarMatch",   "Aadhaar Match"],
          ] as const).map(([key, fallback]) => (
            <div key={key}>
              <Label>{schemaLabel(key, fallback)}</Label>
              <select value={form[key]} onChange={e => sf(key, e.target.value)} className={inp}>
                {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          <div>
            <Label>{schemaLabel("aadhaarMismatchNote", "Aadhaar Mismatch Note")}</Label>
            <input value={form.aadhaarMismatchNote} onChange={e => sf("aadhaarMismatchNote", e.target.value)} placeholder="Optional note" className={inp} />
          </div>
          {customFieldsFor("document-checklist").map(field => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <RTODynField field={field} value={form.customFields[field.key] ?? ""} onChange={v => scf(field.key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Pending + Financials */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>{schemaLabel("pendingDocuments", "Pending Documents")}</Label>
          <input value={form.pendingDocuments} onChange={e => sf("pendingDocuments", e.target.value)} placeholder="RC, Form 35…" className={inp} />
        </div>
        <div>
          <Label>{schemaLabel("nocHoldAmt", "NOC Hold (₹)")}</Label>
          <input type="number" value={form.nocHoldAmt} onChange={e => sf("nocHoldAmt", e.target.value)} className={inp} />
        </div>
        <div>
          <Label>{schemaLabel("balancePayment", "Balance Payment (₹)")}</Label>
          <input type="number" value={form.balancePayment} onChange={e => sf("balancePayment", e.target.value)} className={inp} />
        </div>
      </div>

      {/* Verification & Approval */}
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sectionTitle("verification-approval", "Verification & Approval")}</p>
        <div className="grid grid-cols-4 gap-3">
          {([
            ["verification",        "Verification"],
            ["approval",            "Approval"],
            ["insuranceEndorsement","Insurance Endorsement"],
          ] as const).map(([key, fallback]) => (
            <div key={key}>
              <Label>{schemaLabel(key, fallback)}</Label>
              <select value={form[key]} onChange={e => sf(key, e.target.value)} className={inp}>
                {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          ))}
          <div>
            <Label>{schemaLabel("approvalDate", "Approval Date")}</Label>
            <input type="date" value={form.approvalDate} onChange={e => sf("approvalDate", e.target.value)} className={inp} />
          </div>
          {customFieldsFor("verification-approval").map(field => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <RTODynField field={field} value={form.customFields[field.key] ?? ""} onChange={v => scf(field.key, v)} />
            </div>
          ))}
        </div>
      </section>

      {/* Remarks + Save */}
      <div>
        <Label>{schemaLabel("remarks", "Remarks")}</Label>
        <textarea
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[52px] mb-3"
          value={form.remarks}
          onChange={e => sf("remarks", e.target.value)}
          placeholder="Optional remarks"
        />
        <div className="flex justify-end">
          <Button size="sm" loading={saving} onClick={save}>
            {record ? "Update RTO" : "Save RTO"}
          </Button>
        </div>
      </div>
    </div>
  );
}
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
}

type EditForm = {
  firstName: string; lastName: string; fatherName: string; contact: string; altContact: string;
  location: string; state: string; pinCode: string; residentialStatus: string;
  product: string; loanType: string; vehicleModel: string; regNumber: string;
  loanAmount: string; bankId: string; bankBranch: string; bmName: string; bmContact: string; bankExecutive: string;
  dealerId: string; payoutPct: string; remarks: string;
};

const EMPTY_EDIT: EditForm = {
  firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
  location: "", state: "", pinCode: "", residentialStatus: "",
  product: "", loanType: "", vehicleModel: "", regNumber: "",
  loanAmount: "", bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
  dealerId: "", payoutPct: "", remarks: "",
};

interface CaseDrawerProps {
  caseId: string | null;
  onClose: () => void;
  onCaseChange?: () => void;
}

export function CaseDrawer({ caseId, onClose, onCaseChange }: CaseDrawerProps) {
  const toast = useToast();

  // Core state
  const [drawerCase, setDrawerCase] = useState<LoanCase | null>(null);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  // Interaction state
  const [statusChanging, setStatusChanging] = useState(false);
  const [pipelineSaving, setPipelineSaving] = useState<string | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [editSaving, setEditSaving] = useState(false);

  // Doc modals
  const [reqDocsOpen, setReqDocsOpen] = useState(false);
  const [reqDocTypes, setReqDocTypes] = useState<string[]>([]);
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSaving, setReqSaving] = useState(false);

  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [upDocType, setUpDocType] = useState("");
  const [upFileName, setUpFileName] = useState("");
  const [upRemarks, setUpRemarks] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upSaving, setUpSaving] = useState(false);

  const [editDocData, setEditDocData] = useState<{ id: string; fileName: string; remarks: string } | null>(null);

  // Reference data
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [refsLoaded, setRefsLoaded] = useState(false);

  // Load reference data once
  useEffect(() => {
    if (refsLoaded) return;
    Promise.all([
      banksApi.list(), dealersApi.list(),
      usersApi.list({ role: "sales_executive" }), mastersApi.list("document-types"),
      mastersApi.list("cities"), mastersApi.list("states"),
    ]).then(([bl, dl, ul, dtl, citl, stl]) => {
      setBanks(bl.data);
      setDealers(dl.data);
      setSalesUsers(ul.data);
      setDocTypes(dtl.data.filter((d: any) => d.isActive));
      setCities([...new Set<string>(citl.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort());
      setStates([...new Set<string>(stl.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort());
      setRefsLoaded(true);
    }).catch(() => {});
  }, [refsLoaded]);

  // Load case whenever caseId changes
  const loadCase = useCallback(async (id: string) => {
    setLoading(true);
    setDrawerTab("overview");
    try {
      const [{ data: c }, { data: acts }] = await Promise.all([
        casesApi.get(id),
        casesApi.activities(id),
      ]);
      setDrawerCase(c);
      setActivities(acts as unknown as Activity[]);
    } catch {
      toast("error", "Failed to load case");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [toast, onClose]);

  useEffect(() => {
    if (caseId) {
      loadCase(caseId);
    } else {
      setDrawerCase(null);
      setActivities([]);
    }
  }, [caseId, loadCase]);

  async function reload() {
    if (!drawerCase) return;
    try {
      const [{ data: c }, { data: acts }] = await Promise.all([
        casesApi.get(drawerCase._id),
        casesApi.activities(drawerCase._id),
      ]);
      setDrawerCase(c);
      setActivities(acts as unknown as Activity[]);
      onCaseChange?.();
    } catch {}
  }

  // ── Status change ──────────────────────────────────────────────────
  async function changeStatus(newStatus: string) {
    if (!drawerCase || newStatus === drawerCase.status) return;
    setStatusChanging(true);
    try {
      const { data } = await casesApi.updateStatus(drawerCase._id, { status: newStatus });
      setDrawerCase(data);
      toast("success", `Status changed to ${newStatus}`);
      onCaseChange?.();
    } catch (e: any) { toast("error", e.message ?? "Failed to change status"); }
    finally { setStatusChanging(false); }
  }

  // ── Pipeline ───────────────────────────────────────────────────────
  async function togglePipelineStage(stage: string, current: any) {
    if (!drawerCase) return;
    const next = !current || current.status === "Pending" ? "Done" : "Pending";
    setPipelineSaving(stage);
    try {
      const { data } = await casesApi.updatePipelineStage(drawerCase._id, stage, { status: next });
      setDrawerCase(data);
      if (data.status === "Disbursed" && drawerCase.status !== "Disbursed") {
        toast("success", "All stages complete — case auto-disbursed!");
        onCaseChange?.();
      }
    } catch (e: any) { toast("error", e.message ?? "Failed to update stage"); }
    finally { setPipelineSaving(null); }
  }

  // ── Assign ─────────────────────────────────────────────────────────
  async function assignCase(userId: string) {
    if (!drawerCase) return;
    const user = salesUsers.find(u => u._id === userId);
    if (!user) return;
    try {
      const { data } = await casesApi.assign(drawerCase._id, {
        userId: user._id, userName: `${user.firstName} ${user.lastName}`.trim(),
      });
      setDrawerCase(data);
      toast("success", `Assigned to ${user.firstName} ${user.lastName}`);
      onCaseChange?.();
    } catch (e: any) { toast("error", e.message ?? "Failed to assign"); }
  }

  // ── Edit case ──────────────────────────────────────────────────────
  function openEditModal(c: LoanCase) {
    setEditForm({
      firstName: c.customer.firstName ?? "", lastName: c.customer.lastName ?? "",
      fatherName: c.customer.fatherName ?? "", contact: c.customer.contact ?? "",
      altContact: c.customer.altContact ?? "", location: c.customer.location ?? "",
      state: c.customer.state ?? "", pinCode: c.customer.pinCode ?? "",
      residentialStatus: c.customer.residentialStatus ?? "",
      product: c.product ?? "", loanType: (c as any).loanType ?? "",
      vehicleModel: (c as any).vehicleModel ?? "", regNumber: (c as any).regNumber ?? "",
      loanAmount: c.loanAmount ? String(c.loanAmount) : "",
      bankId: c.bankId ?? "", bankBranch: c.bankBranch ?? "",
      bmName: c.bmName ?? "", bmContact: c.bmContact ?? "", bankExecutive: c.bankExecutive ?? "",
      dealerId: c.dealerId ?? "", payoutPct: c.payoutPct !== undefined ? String(c.payoutPct) : "",
      remarks: c.remarks ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!drawerCase) return;
    setEditSaving(true);
    try {
      const { data } = await casesApi.update(drawerCase._id, {
        customer: {
          firstName: editForm.firstName, lastName: editForm.lastName,
          fatherName: editForm.fatherName || undefined, contact: editForm.contact,
          altContact: editForm.altContact || undefined, location: editForm.location || undefined,
          state: editForm.state || undefined, pinCode: editForm.pinCode || undefined,
          residentialStatus: editForm.residentialStatus || undefined,
        },
        product: editForm.product || undefined, loanType: editForm.loanType || undefined,
        vehicleModel: editForm.vehicleModel || undefined, regNumber: editForm.regNumber || undefined,
        loanAmount: editForm.loanAmount ? Number(editForm.loanAmount) : undefined,
        bankId: editForm.bankId || undefined, bankBranch: editForm.bankBranch || undefined,
        bmName: editForm.bmName || undefined, bmContact: editForm.bmContact || undefined,
        bankExecutive: editForm.bankExecutive || undefined,
        dealerId: editForm.dealerId || undefined,
        payoutPct: editForm.payoutPct ? Number(editForm.payoutPct) : undefined,
        remarks: editForm.remarks || undefined,
      });
      setDrawerCase(data);
      toast("success", "Case updated successfully");
      setEditOpen(false);
      reload();
    } catch (e: any) { toast("error", e.message ?? "Failed to update case"); }
    finally { setEditSaving(false); }
  }

  // ── Doc handlers ───────────────────────────────────────────────────
  async function handleRequestDocs() {
    if (!drawerCase) return;
    if (reqDocTypes.length === 0) { toast("error", "Select at least one document type"); return; }
    if (!reqRemarks.trim()) { toast("error", "Remarks are required"); return; }
    setReqSaving(true);
    try {
      const { data } = await casesApi.requestDocs(drawerCase._id, { docTypes: reqDocTypes, remarks: reqRemarks });
      setDrawerCase(data); toast("success", "Documents requested");
      setReqDocsOpen(false); setReqDocTypes([]); setReqRemarks("");
      reload();
    } catch (e: any) { toast("error", e.message ?? "Request failed"); }
    finally { setReqSaving(false); }
  }

  async function handleUploadDoc() {
    if (!drawerCase) return;
    if (!upDocType) { toast("error", "Select document type"); return; }
    if (!upFileName.trim()) { toast("error", "File name is required"); return; }
    if (!upFile) { toast("error", "Please select a file to upload"); return; }
    setUpSaving(true);
    try {
      const formData = new FormData();
      formData.append("docType", upDocType);
      formData.append("fileName", upFileName);
      if (upRemarks) formData.append("remarks", upRemarks);
      formData.append("file", upFile);
      const { data } = await casesApi.uploadDoc(drawerCase._id, formData);
      setDrawerCase(data); toast("success", "Document uploaded");
      setUploadDocOpen(false); setUpDocType(""); setUpFileName(""); setUpRemarks(""); setUpFile(null);
      reload();
    } catch (e: any) { toast("error", e.message ?? "Upload failed"); }
    finally { setUpSaving(false); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!drawerCase || !confirm("Delete this document?")) return;
    try {
      const { data } = await casesApi.deleteDoc(drawerCase._id, docId);
      setDrawerCase(data); toast("success", "Document deleted");
      reload();
    } catch (e: any) { toast("error", e.message ?? "Failed to delete document"); }
  }

  async function handleEditDocSubmit() {
    if (!drawerCase || !editDocData) return;
    try {
      const { data } = await casesApi.editDoc(drawerCase._id, editDocData.id, {
        fileName: editDocData.fileName, remarks: editDocData.remarks,
      });
      setDrawerCase(data); toast("success", "Document updated");
      setEditDocData(null); reload();
    } catch (e: any) { toast("error", e.message ?? "Failed to update document"); }
  }

  async function resolveRequest(reqId: string) {
    if (!drawerCase) return;
    try {
      const { data } = await casesApi.resolveDocRequest(drawerCase._id, reqId);
      setDrawerCase(data); toast("success", "Request resolved");
      reload();
    } catch (e: any) { toast("error", e.message ?? "Failed to resolve"); }
  }

  return (
    <>
      <Drawer
        open={!!caseId}
        onClose={onClose}
        title={drawerCase?.caseCode ?? (loading ? "Loading…" : "")}
        subtitle={drawerCase ? `${drawerCase.customer.firstName} ${drawerCase.customer.lastName} · ${drawerCase.product}` : undefined}
        width="max-w-3xl"
      >
        {loading && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          </div>
        )}

        {!loading && drawerCase && (
          <div>
            <Tabs
              tabs={[
                { id: "overview", label: "Overview" },
                // { id: "pipeline", label: "Pipeline" },
                { id: "bank", label: "Bank & Dealer" },
                { id: "documents", label: "Documents" },
                { id: "rto", label: "RTO" },
                { id: "activity", label: "Activity" },
              ]}
              active={drawerTab} onChange={setDrawerTab}
            />
            <div className="p-5">

              {/* ── Overview ── */}
              {drawerTab === "overview" && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="flex items-end justify-between gap-4">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Status</p>
                      <div className="flex items-center gap-2">
                        <CaseStatusBadge status={drawerCase.status} />
                        <Select
                          className="h-7 text-xs w-36"
                          value={drawerCase.status}
                          onChange={(e) => changeStatus(e.target.value)}
                          disabled={statusChanging}
                        >
                          {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Assign Case To</p>
                        <Select
                          className="h-8 text-sm font-medium w-48"
                          value={drawerCase.assignedTo ?? ""}
                          onChange={(e) => assignCase(e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {salesUsers.map((u) => (
                            <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                          ))}
                        </Select>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(drawerCase)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {[
                      { label: "Customer", value: `${drawerCase.customer.firstName} ${drawerCase.customer.lastName}`, icon: Users },
                      { label: "Contact", value: drawerCase.customer.contact, icon: Users },
                      { label: "Product", value: drawerCase.product ?? "—", icon: FileText },
                      { label: "Loan Amount", value: fmt(drawerCase.loanAmount), icon: Banknote },
                      { label: "Bank", value: drawerCase.bankName ?? "—", icon: Building2 },
                      { label: "Dealer", value: drawerCase.dealerName ?? "—", icon: Building2 },
                      { label: "Location", value: drawerCase.customer.location ?? "—", icon: MapPin },
                      { label: "Entry Date", value: fmtDate(drawerCase.date), icon: Calendar },
                      { label: "Disbursal Date", value: fmtDate(drawerCase.disbursementDate), icon: Calendar },
                    ].map((f) => (
                      <div key={f.label} className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{f.label}</p>
                        <div className="flex items-center gap-1.5">
                          <f.icon className="size-3.5 text-muted shrink-0" />
                          <span className="text-sm font-medium text-foreground">{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {drawerCase.remarks && (
                    <div className="p-3 bg-surface-2 rounded-lg text-sm text-muted">{drawerCase.remarks}</div>
                  )}
                </div>
              )}

              {/* ── Pipeline ── (commented out for now)
              {drawerTab === "pipeline" && (
                <div className="animate-fadeIn space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Loan Pipeline Checklist</p>
                  {PIPELINE_STAGES.map((stage, idx) => {
                    const item = (drawerCase.pipeline ?? []).find(p => p.stage === stage);
                    const isDone = item?.status === "Done";
                    const isNA = item?.status === "NA";
                    const saving = pipelineSaving === stage;
                    return (
                      <div
                        key={stage}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isDone ? "bg-teal-subtle border-teal-border" : isNA ? "bg-surface-2 border-border opacity-60" : "bg-surface border-border"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-muted w-5 text-right">{idx + 1}</span>
                        <button
                          disabled={saving || isNA}
                          onClick={() => togglePipelineStage(stage, item)}
                          className={`flex-shrink-0 size-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isDone ? "bg-teal border-teal text-white" : "border-border hover:border-primary"
                          }`}
                        >
                          {isDone && <CheckCircle2 className="size-3.5" />}
                          {saving && <span className="size-2.5 rounded-full border-2 border-t-transparent border-primary animate-spin block" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${isDone ? "text-teal line-through" : "text-foreground"}`}>{stage}</p>
                          {isDone && item?.doneAt && (
                            <p className="text-[10px] text-muted">Done {fmtDate(item.doneAt)}{item.doneByName ? ` · ${item.doneByName}` : ""}</p>
                          )}
                          {item?.remarks && <p className="text-[10px] text-muted italic mt-0.5">{item.remarks}</p>}
                        </div>
                        {isNA && <Badge tone="neutral">N/A</Badge>}
                      </div>
                    );
                  })}
                  {drawerCase.status === "Disbursed" && (
                    <div className="mt-4 p-3 bg-teal-subtle border border-teal-border rounded-lg text-center">
                      <CheckCircle2 className="size-5 mx-auto mb-1 text-teal" />
                      <p className="text-sm font-semibold text-teal">Case Disbursed</p>
                      {drawerCase.disbursementDate && (
                        <p className="text-[11px] text-muted">{fmtDate(drawerCase.disbursementDate)}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              */}

              {/* ── Bank & Dealer ── */}
              {drawerTab === "bank" && (
                <div className="space-y-0 animate-fadeIn">
                  {[
                    ["Bank Name", drawerCase.bankName],
                    ["Branch", drawerCase.bankBranch],
                    ["BM Name", drawerCase.bmName],
                    ["BM Contact", drawerCase.bmContact],
                    ["Executive", drawerCase.bankExecutive],
                    ["Dealer", drawerCase.dealerName],
                    ["Payout %", drawerCase.payoutPct !== undefined ? `${drawerCase.payoutPct}%` : undefined],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{label as string}</span>
                      <span className="text-sm font-medium text-foreground">{value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Documents ── */}
              {drawerTab === "documents" && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setReqDocsOpen(true)}>
                      <AlertCircle className="size-3.5" /> Request More Documents
                    </Button>
                    <Button size="sm" onClick={() => setUploadDocOpen(true)}>
                      <UploadCloud className="size-3.5" /> Upload Document
                    </Button>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Pending Requests</p>
                    {!drawerCase.docRequests || drawerCase.docRequests.filter(r => !r.isResolved).length === 0 ? (
                      <p className="text-xs text-muted italic">No pending document requests.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {drawerCase.docRequests.filter(r => !r.isResolved).map((req) => (
                          <div key={req._id} className="p-3 bg-orange-subtle border border-orange-border rounded-lg flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                {req.docTypes.map(t => <Badge key={t} tone="orange">{t}</Badge>)}
                              </div>
                              <p className="text-xs font-medium text-foreground-secondary">{req.remarks}</p>
                              <p className="text-[10px] text-muted">Requested by {req.requestedByName} · {fmtDate(req.requestedAt)}</p>
                            </div>
                            <Button size="xs" variant="outline" onClick={() => resolveRequest(req._id)}>Mark Resolved</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Uploaded Documents</p>
                    {!drawerCase.documents || drawerCase.documents.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-6 text-center">
                        <FileText className="size-6 mx-auto mb-1.5 text-muted/50" />
                        <p className="text-xs text-muted">No documents uploaded yet.</p>
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-border text-xs">
                          <thead className="bg-surface-2">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-muted">Doc Type</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted">File Name</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted">Uploaded By</th>
                              <th className="px-3 py-2 text-left font-semibold text-muted">Remarks</th>
                              <th className="px-3 py-2 text-right font-semibold text-muted">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-surface">
                            {drawerCase.documents.map((doc) => (
                              <tr key={doc._id}>
                                <td className="px-3 py-2 font-medium">{doc.docType}</td>
                                <td className="px-3 py-2 font-mono text-primary truncate max-w-[130px]">
                                  {doc.url ? (
                                    <a href={doc.url.startsWith("http") ? doc.url : API_BASE.replace("/api/v1", "") + doc.url} target="_blank" rel="noreferrer" className="hover:underline">
                                      {doc.fileName}
                                    </a>
                                  ) : doc.fileName}
                                </td>
                                <td className="px-3 py-2 text-muted">{doc.uploadedByName} · {fmtDate(doc.uploadedAt)}</td>
                                <td className="px-3 py-2 text-foreground-secondary max-w-[160px] truncate" title={doc.remarks}>{doc.remarks ?? "—"}</td>
                                <td className="px-3 py-2 text-right space-x-2">
                                  <button onClick={() => setEditDocData({ id: doc._id, fileName: doc.fileName, remarks: doc.remarks || "" })} className="text-muted hover:text-primary transition-colors">
                                    <Edit2 className="size-3.5 inline" />
                                  </button>
                                  <button onClick={() => handleDeleteDoc(doc._id)} className="text-muted hover:text-danger transition-colors">
                                    <Trash2 className="size-3.5 inline" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {drawerCase.docRequests && drawerCase.docRequests.some(r => r.isResolved) && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Resolved Requests</p>
                      <div className="space-y-2">
                        {drawerCase.docRequests.filter(r => r.isResolved).map((req) => (
                          <div key={req._id} className="p-2.5 bg-surface-2 border border-border rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <p className="text-[10px] text-muted line-through">{req.docTypes.join(", ")}</p>
                              <p className="text-xs text-muted">{req.remarks}</p>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-teal">
                              <CheckCircle2 className="size-3.5" /> Resolved
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── RTO ── */}
              {drawerTab === "rto" && drawerCase && (
                <RTOTab caseId={drawerCase._id} loanCase={drawerCase} />
              )}

              {/* ── Activity ── */}
              {drawerTab === "activity" && (
                <div className="animate-fadeIn">
                  {activities.length === 0
                    ? <EmptyState title="No activity yet" />
                    : <Timeline items={activities.map((a) => ({ label: a.description, time: new Date(a.createdAt).toLocaleString("en-IN"), user: a.createdByName, note: a.note }))} />}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Request More Documents ─────────────────────────────────── */}
      <Modal open={reqDocsOpen} onClose={() => setReqDocsOpen(false)} title="Request More Documents" size="md">
        <div className="space-y-4">
          <div>
            <Label>Document Types *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5 max-h-40 overflow-y-auto border border-border p-2 rounded-md">
              {docTypes.map((dt) => {
                const checked = reqDocTypes.includes(dt.name);
                return (
                  <label key={dt._id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-surface-2 select-none">
                    <input type="checkbox" checked={checked} onChange={() => setReqDocTypes(prev => checked ? prev.filter(x => x !== dt.name) : [...prev, dt.name])} />
                    {dt.name}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Remarks / Instructions *</Label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none min-h-[80px]"
              placeholder="Explain what is missing or required..."
              value={reqRemarks} onChange={(e) => setReqRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setReqDocsOpen(false)}>Cancel</Button>
            <Button size="sm" loading={reqSaving} onClick={handleRequestDocs}>Send Request</Button>
          </div>
        </div>
      </Modal>

      {/* ── Upload Document ────────────────────────────────────────── */}
      <Modal open={uploadDocOpen} onClose={() => setUploadDocOpen(false)} title="Upload Document" size="md">
        <div className="space-y-4">
          <div><Label>Document Type *</Label>
            <Select value={upDocType} onChange={(e) => setUpDocType(e.target.value)}>
              <option value="">Select document type...</option>
              {docTypes.map((dt) => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
            </Select>
          </div>
          <div><Label>File Name *</Label>
            <Input value={upFileName} onChange={(e) => setUpFileName(e.target.value)} placeholder="e.g. aadhaar_card.pdf" />
          </div>
          <div><Label>File *</Label>
            <Input type="file" onChange={(e) => setUpFile(e.target.files?.[0] || null)} className="pt-1 text-xs" />
          </div>
          <div>
            <Label>Remarks</Label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none min-h-[60px]"
              placeholder="Optional remarks..." value={upRemarks} onChange={(e) => setUpRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
            <Button size="sm" loading={upSaving} onClick={handleUploadDoc}>Upload Document</Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Case ─────────────────────────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Case Details" size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Customer Information</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>First Name *</Label><Input value={editForm.firstName} onChange={(e) => setEditForm(p => ({ ...p, firstName: e.target.value }))} /></div>
              <div><Label>Last Name *</Label><Input value={editForm.lastName} onChange={(e) => setEditForm(p => ({ ...p, lastName: e.target.value }))} /></div>
              <div><Label>Father's Name</Label><Input value={editForm.fatherName} onChange={(e) => setEditForm(p => ({ ...p, fatherName: e.target.value }))} /></div>
              <div><Label>Contact *</Label><Input value={editForm.contact} onChange={(e) => setEditForm(p => ({ ...p, contact: e.target.value }))} /></div>
              <div><Label>Alt Contact</Label><Input value={editForm.altContact} onChange={(e) => setEditForm(p => ({ ...p, altContact: e.target.value }))} /></div>
              <div>
                <Label>State</Label>
                <Select value={editForm.state} onChange={(e) => setEditForm(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select state…</option>
                  {states.map(s => <option key={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>City</Label>
                {cities.length > 0 ? (
                  <Select value={editForm.location} onChange={(e) => setEditForm(p => ({ ...p, location: e.target.value }))}>
                    <option value="">Select city…</option>
                    {cities.map(c => <option key={c}>{c}</option>)}
                  </Select>
                ) : (
                  <Input value={editForm.location} onChange={(e) => setEditForm(p => ({ ...p, location: e.target.value }))} placeholder="City / Area" />
                )}
              </div>
              <div><Label>Pin Code</Label><Input value={editForm.pinCode} onChange={(e) => setEditForm(p => ({ ...p, pinCode: e.target.value }))} placeholder="6-digit PIN" /></div>
              <div>
                <Label>Residential Status</Label>
                <Select value={editForm.residentialStatus} onChange={(e) => setEditForm(p => ({ ...p, residentialStatus: e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Own</option><option>Rented</option><option>Family Owned</option>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Loan Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Product</Label>
                <Select value={editForm.product} onChange={(e) => setEditForm(p => ({ ...p, product: e.target.value }))}>
                  <option value="">Select…</option>
                  {PRODUCTS.map(prod => <option key={prod}>{prod}</option>)}
                </Select>
              </div>
              <div>
                <Label>Loan Type</Label>
                <Select value={editForm.loanType} onChange={(e) => setEditForm(p => ({ ...p, loanType: e.target.value }))}>
                  <option value="">Select…</option>
                  {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
                </Select>
              </div>
              <div><Label>Loan Amount</Label><Input type="number" value={editForm.loanAmount} onChange={(e) => setEditForm(p => ({ ...p, loanAmount: e.target.value }))} /></div>
              <div><Label>Vehicle Model</Label><Input value={editForm.vehicleModel} onChange={(e) => setEditForm(p => ({ ...p, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" /></div>
              <div><Label>Reg Number</Label><Input value={editForm.regNumber} onChange={(e) => setEditForm(p => ({ ...p, regNumber: e.target.value }))} placeholder="e.g. DL01AB1234" /></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Bank & Dealer</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Bank</Label>
                <Select value={editForm.bankId} onChange={(e) => setEditForm(p => ({ ...p, bankId: e.target.value }))}>
                  <option value="">Select bank…</option>
                  {banks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </Select>
              </div>
              <div><Label>Branch</Label><Input value={editForm.bankBranch} onChange={(e) => setEditForm(p => ({ ...p, bankBranch: e.target.value }))} /></div>
              <div><Label>BM Name</Label><Input value={editForm.bmName} onChange={(e) => setEditForm(p => ({ ...p, bmName: e.target.value }))} /></div>
              <div><Label>BM Contact</Label><Input value={editForm.bmContact} onChange={(e) => setEditForm(p => ({ ...p, bmContact: e.target.value }))} /></div>
              <div><Label>Bank Executive</Label><Input value={editForm.bankExecutive} onChange={(e) => setEditForm(p => ({ ...p, bankExecutive: e.target.value }))} /></div>
              <div>
                <Label>Dealer</Label>
                <Select value={editForm.dealerId} onChange={(e) => setEditForm(p => ({ ...p, dealerId: e.target.value }))}>
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>Payout %</Label><Input type="number" min="0" max="100" value={editForm.payoutPct} onChange={(e) => setEditForm(p => ({ ...p, payoutPct: e.target.value }))} /></div>
            </div>
          </div>

          <div>
            <Label>Remarks</Label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[70px] mt-1"
              value={editForm.remarks} onChange={(e) => setEditForm(p => ({ ...p, remarks: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end border-t border-border pt-4 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button size="sm" loading={editSaving} onClick={saveEdit}>Save Changes</Button>
        </div>
      </Modal>

      {/* ── Edit Document ──────────────────────────────────────────── */}
      <Modal open={!!editDocData} onClose={() => setEditDocData(null)} title="Edit Document" size="sm">
        {editDocData && (
          <div className="space-y-4">
            <div><Label>File Name</Label><Input value={editDocData.fileName} onChange={(e) => setEditDocData({ ...editDocData, fileName: e.target.value })} /></div>
            <div><Label>Remarks</Label><Input value={editDocData.remarks} onChange={(e) => setEditDocData({ ...editDocData, remarks: e.target.value })} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setEditDocData(null)}>Cancel</Button>
              <Button size="sm" onClick={handleEditDocSubmit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
