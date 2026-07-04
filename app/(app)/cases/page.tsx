"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Plus, Eye, MessageSquare, AlertCircle, UploadCloud, Edit2, Trash2, CheckCircle2, X, Phone, User, Search } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Modal, Drawer, Label, Textarea,
  Tabs, Pagination, EmptyState, Skeleton, useToast, type CaseStatus, Input, Select, cn
} from "../../../components/ui";
import {
  casesApi, customersApi, mastersApi, banksApi, dealersApi, formSchemasApi,
  PRODUCTS, LOAN_TYPES, RESIDENTIAL_STATUSES, API_BASE,
  type LoanCase, type FormSchema, type PageMeta, type Bank, type Dealer, type SalesCustomer,
} from "../../../lib/api";

const STATUS_TABS = ["All", "Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];

// ── Schema-driven field value resolver ────────────────────────────────────────

const CORE_KEY_MAP: Record<string, (c: LoanCase) => string | undefined> = {
  firstName:         (c) => c.customer.firstName,
  lastName:          (c) => c.customer.lastName,
  fatherName:        (c) => c.customer.fatherName,
  contact:           (c) => c.customer.contact,
  altContact:        (c) => c.customer.altContact,
  state:             (c) => c.customer.state,
  location:          (c) => c.customer.location,
  residentialStatus: (c) => c.customer.residentialStatus,
  ebillOwner:        (c) => c.customer.ebillOwner != null ? (c.customer.ebillOwner ? "Yes" : "No") : undefined,
  product:           (c) => c.product,
  loanType:          (c) => c.loanType,
  vehicleModel:      (c) => c.vehicleModel,
  regNumber:         (c) => c.regNumber,
  ownerSerial:       (c) => c.ownerSerial,
  existingInsurer:   (c) => c.existingInsurer,
  hypothecation:     (c) => c.hypothecation != null ? (c.hypothecation ? "Yes" : "No") : undefined,
  nocRequired:       (c) => c.nocRequired != null ? (c.nocRequired ? "Yes" : "No") : undefined,
  challanCount:      (c) => c.challanCount != null ? String(c.challanCount) : undefined,
  loanAmount:        (c) => c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : undefined,
  bank:              (c) => c.bankName,
  branch:            (c) => c.bankBranch,
  bmName:            (c) => c.bmName,
  bmContact:         (c) => c.bmContact,
  executive:         (c) => c.bankExecutive,
  dealer:            (c) => c.dealerName,
  payoutPct:         (c) => c.payoutPct != null ? `${c.payoutPct}%` : undefined,
};

function getCaseFieldValue(c: LoanCase, key: string): string | undefined {
  if (key in CORE_KEY_MAP) {
    const val = CORE_KEY_MAP[key](c);
    return val != null && val !== "" ? val : undefined;
  }
  const cf = c.customFields?.[key];
  if (cf == null || cf === "") return undefined;
  return typeof cf === "boolean" ? (cf ? "Yes" : "No") : String(cf);
}

// ── Styled file picker ─────────────────────────────────────────────────────────

function FilePicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input
        ref={ref}
        type="file"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/30 rounded-lg">
          <CheckCircle2 className="size-4 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium truncate flex-1">{file.name}</span>
          <button
            type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = ""; }}
            className="text-muted hover:text-danger transition-colors shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full flex flex-col items-center gap-1.5 px-3 py-4 border-2 border-dashed border-border rounded-lg text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
        >
          <UploadCloud className="size-5" />
          <span className="text-xs font-medium">Click to choose file</span>
        </button>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MyCasesPage() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [detailCase, setDetailCase] = useState<LoanCase | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [remarkCase, setRemarkCase] = useState<LoanCase | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Reference data
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [caseSchema, setCaseSchema] = useState<FormSchema | null>(null);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [insurerOptions, setInsurerOptions] = useState<string[]>([]);

  // Upload state
  const [upDocType, setUpDocType] = useState("");
  const [upFileName, setUpFileName] = useState("");
  const [upRemarks, setUpRemarks] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upSaving, setUpSaving] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  // Edit doc state
  const [editDocData, setEditDocData] = useState<{ id: string; fileName: string; remarks: string } | null>(null);

  // New Lead flow
  type LeadStep = "phone" | "customer" | "details";
  const [leadStep, setLeadStep] = useState<LeadStep | null>(null);
  const [leadPhone, setLeadPhone] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<SalesCustomer | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);
  const [leadCustomer, setLeadCustomer] = useState({ firstName: "", lastName: "", fatherName: "", altContact: "", location: "", residentialStatus: "" });
  const [leadCase, setLeadCase] = useState({ product: "", loanType: "", loanAmount: "", bankId: "", dealerId: "", vehicleModel: "", regNumber: "", date: new Date().toISOString().slice(0, 10) });
  const [creatingLead, setCreatingLead] = useState(false);

  function openNewLead() {
    setLeadPhone(""); setFoundCustomer(null); setPhoneChecked(false);
    setLeadCustomer({ firstName: "", lastName: "", fatherName: "", altContact: "", location: "", residentialStatus: "" });
    setLeadCase({ product: "", loanType: "", loanAmount: "", bankId: "", dealerId: "", vehicleModel: "", regNumber: "", date: new Date().toISOString().slice(0, 10) });
    setLeadStep("phone");
  }

  async function lookupPhone() {
    const phone = leadPhone.trim();
    if (!phone) return;
    setLookingUp(true);
    try {
      const { data } = await customersApi.list({ search: phone, limit: 5 });
      const match = (data as unknown as SalesCustomer[]).find(
        (c) => c.phone === phone || c.phone?.replace(/\D/g, "").endsWith(phone.replace(/\D/g, ""))
      );
      setFoundCustomer(match ?? null);
      if (match) {
        setLeadCustomer({ firstName: match.firstName, lastName: match.lastName, fatherName: "", altContact: match.alternatePhone ?? "", location: "", residentialStatus: "" });
      }
    } catch {
      setFoundCustomer(null);
    } finally {
      setLookingUp(false);
      setPhoneChecked(true);
      setLeadStep("customer");
    }
  }

  async function createLead() {
    setCreatingLead(true);
    try {
      const bank = banks.find((b) => b._id === leadCase.bankId);
      const dealer = dealers.find((d) => d._id === leadCase.dealerId);
      await casesApi.create({
        date: leadCase.date,
        product: leadCase.product || "Car Loan",
        loanType: leadCase.loanType || undefined,
        loanAmount: leadCase.loanAmount ? Number(leadCase.loanAmount) : undefined,
        bankId: leadCase.bankId || undefined,
        bankName: bank?.name,
        dealerId: leadCase.dealerId || undefined,
        dealerName: dealer?.name,
        vehicleModel: leadCase.vehicleModel || undefined,
        regNumber: leadCase.regNumber || undefined,
        customer: {
          firstName: leadCustomer.firstName,
          lastName: leadCustomer.lastName,
          contact: leadPhone.trim(),
          altContact: leadCustomer.altContact || undefined,
          fatherName: leadCustomer.fatherName || undefined,
          location: leadCustomer.location || undefined,
          residentialStatus: leadCustomer.residentialStatus || undefined,
        },
      });
      toast("success", "Lead created successfully");
      setLeadStep(null);
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to create lead");
    } finally {
      setCreatingLead(false);
    }
  }

  // Edit overview state
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    // Customer
    firstName: "", lastName: "", fatherName: "",
    contact: "", altContact: "", state: "", location: "", residentialStatus: "",
    // Case
    product: "", loanType: "", loanAmount: "",
    vehicleModel: "", regNumber: "", ownerSerial: "", existingInsurer: "",
    // Bank
    bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
    // Dealer
    dealerId: "", payoutPct: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, meta: m } = await casesApi.list({
        page, limit,
        search: search || undefined,
        status: statusTab !== "All" ? statusTab : undefined,
      });
      setCases(data as unknown as LoanCase[]);
      if (m) setMeta(m);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusTab, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    mastersApi.list("document-types").then(({ data }) => setDocTypes(data.filter((d: any) => d.isActive))).catch(() => {});
    mastersApi.list("states").then(({ data }) => setStateOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("cities").then(({ data }) => setCityOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("insurance-companies").then(({ data }) => setInsurerOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    banksApi.list().then(({ data }) => setBanks(data)).catch(() => {});
    dealersApi.list().then(({ data }) => setDealers(data)).catch(() => {});
    formSchemasApi.get("new-case").then(({ data }) => setCaseSchema(data)).catch(() => {});
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function openDetail(c: LoanCase) {
    setDetailTab("overview");
    setEditMode(false);
    setDetailCase(c);
  }

  async function reloadDetail(id: string) {
    try {
      const { data } = await casesApi.get(id);
      setDetailCase(data);
    } catch {}
  }

  function enterEditMode(c: LoanCase) {
    setEditForm({
      firstName: c.customer.firstName ?? "", lastName: c.customer.lastName ?? "",
      fatherName: c.customer.fatherName ?? "", contact: c.customer.contact ?? "",
      altContact: c.customer.altContact ?? "", state: c.customer.state ?? "",
      location: c.customer.location ?? "", residentialStatus: c.customer.residentialStatus ?? "",
      product: c.product ?? "", loanType: c.loanType ?? "",
      loanAmount: c.loanAmount?.toString() ?? "",
      vehicleModel: c.vehicleModel ?? "", regNumber: c.regNumber ?? "",
      ownerSerial: c.ownerSerial ?? "", existingInsurer: c.existingInsurer ?? "",
      bankId: c.bankId ?? "", bankBranch: c.bankBranch ?? "",
      bmName: c.bmName ?? "", bmContact: c.bmContact ?? "", bankExecutive: c.bankExecutive ?? "",
      dealerId: c.dealerId ?? "", payoutPct: c.payoutPct?.toString() ?? "",
    });
    setEditMode(true);
  }

  async function saveEdit() {
    if (!detailCase) return;
    setEditSaving(true);
    try {
      const bank = banks.find((b) => b._id === editForm.bankId);
      const dealer = dealers.find((d) => d._id === editForm.dealerId);
      const body: Record<string, any> = {
        product: editForm.product || undefined,
        loanType: editForm.loanType || undefined,
        loanAmount: editForm.loanAmount ? Number(editForm.loanAmount) : undefined,
        vehicleModel: editForm.vehicleModel || undefined,
        regNumber: editForm.regNumber || undefined,
        ownerSerial: editForm.ownerSerial || undefined,
        existingInsurer: editForm.existingInsurer || undefined,
        bankId: editForm.bankId || undefined,
        bankName: bank?.name,
        bankBranch: editForm.bankBranch || undefined,
        bmName: editForm.bmName || undefined,
        bmContact: editForm.bmContact || undefined,
        bankExecutive: editForm.bankExecutive || undefined,
        dealerId: editForm.dealerId || undefined,
        dealerName: dealer?.name,
        payoutPct: editForm.payoutPct ? Number(editForm.payoutPct) : undefined,
        customer: {
          ...detailCase.customer,
          firstName: editForm.firstName || detailCase.customer.firstName,
          lastName: editForm.lastName || detailCase.customer.lastName,
          fatherName: editForm.fatherName || undefined,
          contact: editForm.contact || detailCase.customer.contact,
          altContact: editForm.altContact || undefined,
          state: editForm.state || undefined,
          location: editForm.location || undefined,
          residentialStatus: editForm.residentialStatus || undefined,
        },
      };
      const { data } = await casesApi.update(detailCase._id, body);
      setDetailCase(data);
      setCases((prev) => prev.map((c) => c._id === data._id ? data : c));
      toast("success", "Case updated");
      setEditMode(false);
    } catch (e: any) {
      toast("error", e.message ?? "Update failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitRemark() {
    if (!remarkCase || !remark.trim()) return;
    setRemarkSaving(true);
    try {
      await casesApi.updateStatus(remarkCase._id, { status: remarkCase.status, note: remark });
      toast("success", "Remark saved");
      setRemarkCase(null);
      setRemark("");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to save remark");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function handleUploadDoc() {
    if (!detailCase) return;
    if (!upDocType) { toast("error", "Select document type"); return; }
    if (!upFileName.trim()) { toast("error", "File name is required"); return; }
    if (!upFile) { toast("error", "Please select a file"); return; }
    setUpSaving(true);
    try {
      const formData = new FormData();
      formData.append("docType", upDocType);
      formData.append("fileName", upFileName);
      if (upRemarks) formData.append("remarks", upRemarks);
      formData.append("file", upFile);
      const { data } = await casesApi.uploadDoc(detailCase._id, formData);
      setDetailCase(data);
      toast("success", "Document uploaded");
      setUpDocType(""); setUpFileName(""); setUpRemarks(""); setUpFile(null);
      load(); reloadDetail(detailCase._id);
    } catch (e: any) {
      toast("error", e.message ?? "Upload failed");
    } finally {
      setUpSaving(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!detailCase || !confirm("Delete this document?")) return;
    try {
      const { data } = await casesApi.deleteDoc(detailCase._id, docId);
      setDetailCase(data);
      toast("success", "Document deleted");
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to delete");
    }
  }

  async function handleEditDocSubmit() {
    if (!detailCase || !editDocData) return;
    try {
      const { data } = await casesApi.editDoc(detailCase._id, editDocData.id, {
        fileName: editDocData.fileName,
        remarks: editDocData.remarks,
      });
      setDetailCase(data);
      toast("success", "Document updated");
      setEditDocData(null);
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update");
    }
  }

  async function handleStatusChange(status: CaseStatus) {
    if (!detailCase) return;
    try {
      const { data } = await casesApi.updateStatus(detailCase._id, { status });
      setDetailCase(data);
      toast("success", "Status updated");
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update status");
    }
  }

  async function submitVerification() {
    if (!detailCase) return;
    setSubmittingVerification(true);
    try {
      const { data } = await casesApi.submitForVerification(detailCase._id);
      setDetailCase(data);
      toast("success", "Submitted for verification");
      load(); reloadDetail(detailCase._id);
    } catch (e: any) {
      toast("error", e.message ?? "Submission failed");
    } finally {
      setSubmittingVerification(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Cases</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total} total cases</p>
        </div>
        <Button size="sm" onClick={openNewLead}><Plus className="size-3.5" /> New Lead</Button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, ID, or reg…" className="w-64" />
        </div>
        <div className="overflow-x-auto">
          <Tabs tabs={STATUS_TABS.map((s) => ({ id: s, label: s }))} active={statusTab} onChange={(s) => { setStatusTab(s); setPage(1); }} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th><th>Date</th><th>Customer</th><th>Product</th>
                <th>Bank</th><th>Loan Amount</th><th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : cases.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon={FileText} title="No cases found" description="Create your first lead using the New Lead button." /></td></tr>
              ) : cases.map((c) => (
                <tr key={c._id} className="cursor-pointer" onClick={() => openDetail(c)}
                  style={{ borderLeft: c.status === "Incomplete" ? "3.5px solid var(--orange)" : undefined }}>
                  <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                  <td className="text-xs text-muted">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                  <td className="text-xs text-foreground-secondary">{c.product}</td>
                  <td className="text-xs text-foreground-secondary">{c.bankName ?? "—"}</td>
                  <td className="font-mono text-xs font-semibold">{c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td><CaseStatusBadge status={c.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(c)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Eye className="size-3.5" /></button>
                      <button onClick={() => { setRemarkCase(c); setRemark(""); }} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><MessageSquare className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={meta.page} totalPages={meta.totalPages || 1} total={meta.total} limit={meta.limit} onPage={setPage} onLimit={() => {}} />
      </div>

      {/* ── Case Detail Drawer ── */}
      <Drawer
        open={!!detailCase}
        onClose={() => { setDetailCase(null); setEditMode(false); }}
        title={detailCase?.caseCode ?? ""}
        description={detailCase ? `${detailCase.customer.firstName} ${detailCase.customer.lastName} · ${detailCase.product}` : undefined}
        size="xl"
      >
        {detailCase && (
          <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                {detailCase.status === "Draft" || detailCase.status === "Sales" ? (
                  <Select value={detailCase.status} onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
                    className="h-7 text-xs py-0 w-40 bg-surface border-border">
                    {detailCase.status === "Draft" && <option value="Draft">Draft</option>}
                    {detailCase.status === "Draft" && <option value="Sales">Sales</option>}
                    {detailCase.status === "Sales" && <option value="Sales">Sales</option>}
                    <option value="Pending">Pending</option>
                    <option value="Hold">Hold</option>
                    <option value="Cancelled">Cancelled</option>
                  </Select>
                ) : (
                  <CaseStatusBadge status={detailCase.status} />
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setDetailTab("overview")}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-colors", detailTab === "overview" ? "bg-primary text-white" : "bg-surface-2 hover:bg-surface-3 text-foreground-secondary")}>
                  Overview
                </button>
                <button onClick={() => { setDetailTab("pipeline"); setEditMode(false); }}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-colors", detailTab === "pipeline" ? "bg-primary text-white" : "bg-surface-2 hover:bg-surface-3 text-foreground-secondary")}>
                  Pipeline
                </button>
                <button onClick={() => { setDetailTab("documents"); setEditMode(false); }}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-colors", detailTab === "documents" ? "bg-primary text-white" : "bg-surface-2 hover:bg-surface-3 text-foreground-secondary")}>
                  Documents {detailCase.docRequests?.filter(r => !r.isResolved).length > 0 && <span className="ml-1 px-1 bg-orange text-white rounded-full text-[9px]">!</span>}
                </button>
              </div>
            </div>

            {/* ── Overview tab ── */}
            {detailTab === "overview" && (
              <div className="space-y-4">
                {editMode ? (
                  /* ── Edit form ── */
                  <div className="space-y-5">
                    {/* Customer */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">Customer</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>First Name</Label><Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
                        <div><Label>Last Name</Label><Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
                        <div><Label>Father's Name</Label><Input value={editForm.fatherName} onChange={(e) => setEditForm((f) => ({ ...f, fatherName: e.target.value }))} /></div>
                        <div><Label>Contact</Label><Input value={editForm.contact} onChange={(e) => setEditForm((f) => ({ ...f, contact: e.target.value }))} /></div>
                        <div><Label>Alt Contact</Label><Input value={editForm.altContact} onChange={(e) => setEditForm((f) => ({ ...f, altContact: e.target.value }))} /></div>
                        <div><Label>State</Label>
                          <Select value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                            <option value="">Select state…</option>
                            {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                        <div><Label>Location</Label>
                          <Select value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}>
                            <option value="">Select city…</option>
                            {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                          </Select>
                        </div>
                        <div><Label>Residential Status</Label>
                          <Select value={editForm.residentialStatus} onChange={(e) => setEditForm((f) => ({ ...f, residentialStatus: e.target.value }))}>
                            <option value="">Select…</option>
                            {RESIDENTIAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </Select>
                        </div>
                      </div>
                    </div>
                    {/* Case / Loan */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">Loan Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Product</Label>
                          <Select value={editForm.product} onChange={(e) => setEditForm((f) => ({ ...f, product: e.target.value }))}>
                            <option value="">Select product…</option>
                            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                          </Select>
                        </div>
                        <div><Label>Loan Type</Label>
                          <Select value={editForm.loanType} onChange={(e) => setEditForm((f) => ({ ...f, loanType: e.target.value }))}>
                            <option value="">Select type…</option>
                            {LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}
                          </Select>
                        </div>
                        <div><Label>Loan Amount (₹)</Label><Input type="number" min="0" value={editForm.loanAmount} onChange={(e) => setEditForm((f) => ({ ...f, loanAmount: e.target.value }))} placeholder="e.g. 850000" /></div>
                        <div><Label>Vehicle Model</Label><Input value={editForm.vehicleModel} onChange={(e) => setEditForm((f) => ({ ...f, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" /></div>
                        <div><Label>Reg. Number</Label><Input value={editForm.regNumber} onChange={(e) => setEditForm((f) => ({ ...f, regNumber: e.target.value }))} placeholder="e.g. HR05AB1234" /></div>
                        <div><Label>Owner Serial</Label><Input value={editForm.ownerSerial} onChange={(e) => setEditForm((f) => ({ ...f, ownerSerial: e.target.value }))} placeholder="1st, 2nd…" /></div>
                        <div className="col-span-2"><Label>Existing Insurer</Label>
                          <Select value={editForm.existingInsurer} onChange={(e) => setEditForm((f) => ({ ...f, existingInsurer: e.target.value }))}>
                            <option value="">Select insurer…</option>
                            {insurerOptions.map((ins) => <option key={ins} value={ins}>{ins}</option>)}
                          </Select>
                        </div>
                      </div>
                    </div>
                    {/* Bank */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">Bank / NBFC</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Label>Bank / NBFC</Label>
                          <Select value={editForm.bankId} onChange={(e) => setEditForm((f) => ({ ...f, bankId: e.target.value }))}>
                            <option value="">Select bank…</option>
                            {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                          </Select>
                        </div>
                        <div><Label>Branch</Label><Input value={editForm.bankBranch} onChange={(e) => setEditForm((f) => ({ ...f, bankBranch: e.target.value }))} /></div>
                        <div><Label>BM Name</Label><Input value={editForm.bmName} onChange={(e) => setEditForm((f) => ({ ...f, bmName: e.target.value }))} /></div>
                        <div><Label>BM Contact</Label><Input value={editForm.bmContact} onChange={(e) => setEditForm((f) => ({ ...f, bmContact: e.target.value }))} /></div>
                        <div><Label>Bank Executive</Label><Input value={editForm.bankExecutive} onChange={(e) => setEditForm((f) => ({ ...f, bankExecutive: e.target.value }))} /></div>
                      </div>
                    </div>
                    {/* Dealer */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">Dealer</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Dealer</Label>
                          <Select value={editForm.dealerId} onChange={(e) => setEditForm((f) => ({ ...f, dealerId: e.target.value }))}>
                            <option value="">Select dealer…</option>
                            {dealers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                          </Select>
                        </div>
                        <div><Label>Payout %</Label><Input type="number" min="0" max="100" step="0.1" value={editForm.payoutPct} onChange={(e) => setEditForm((f) => ({ ...f, payoutPct: e.target.value }))} placeholder="e.g. 1.5" /></div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1 border-t border-border">
                      <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button size="sm" loading={editSaving} onClick={saveEdit}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
                  /* ── Read view — schema-driven ── */
                  <>
                    {caseSchema ? (
                      <div className="space-y-5">
                        {caseSchema.sections.map((section) => {
                          const active = section.fields.filter((f) => f.isActive !== false);
                          if (active.length === 0) return null;
                          return (
                            <div key={section.id} className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">{section.title}</p>
                              <div className="grid grid-cols-2 gap-3">
                                {active.map((field) => (
                                  <div key={field.key}>
                                    <Label>{field.label}</Label>
                                    <p className="text-sm font-medium mt-0.5">{getCaseFieldValue(detailCase, field.key) ?? "—"}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">Case Info</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div><Label>Case ID</Label><p className="text-sm font-medium mt-0.5 font-mono text-primary">{detailCase.caseCode}</p></div>
                            <div><Label>Date</Label><p className="text-sm font-medium mt-0.5">{new Date(detailCase.date).toLocaleDateString("en-IN")}</p></div>
                            {detailCase.assignedToName && <div><Label>Assigned To</Label><p className="text-sm font-medium mt-0.5">{detailCase.assignedToName}</p></div>}
                            {detailCase.disbursementDate && <div><Label>Disbursed On</Label><p className="text-sm font-medium mt-0.5">{new Date(detailCase.disbursementDate).toLocaleDateString("en-IN")}</p></div>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          ["Customer", `${detailCase.customer.firstName} ${detailCase.customer.lastName}`],
                          ["Contact", detailCase.customer.contact],
                          ["Product", detailCase.product],
                          ["Loan Amount", detailCase.loanAmount ? `₹${detailCase.loanAmount.toLocaleString("en-IN")}` : "—"],
                          ["Bank", detailCase.bankName ?? "—"],
                          ["Dealer", detailCase.dealerName ?? "—"],
                          ["Location", detailCase.customer.location ?? "—"],
                          ...(detailCase.vehicleModel ? [["Vehicle", detailCase.vehicleModel + (detailCase.regNumber ? ` · ${detailCase.regNumber}` : "")]] : []),
                          ["Disbursed", detailCase.disbursementDate ? new Date(detailCase.disbursementDate).toLocaleDateString("en-IN") : "—"],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <Label>{label as string}</Label>
                            <p className="text-sm font-medium mt-0.5">{value as string}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {detailCase.remarks && <div className="p-3 bg-surface-2 rounded-lg text-sm text-muted">{detailCase.remarks}</div>}
                    <div className="flex justify-end pt-1 border-t border-border">
                      <Button variant="secondary" size="sm" onClick={() => enterEditMode(detailCase)}>
                        <Edit2 className="size-3.5" /> Edit Details
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Pipeline tab ── */}
            {detailTab === "pipeline" && (
              <div className="space-y-2">
                <p className="text-xs text-muted mb-3">Approval pipeline stages for this case.</p>
                {!detailCase.pipeline || detailCase.pipeline.length === 0 ? (
                  <p className="text-sm text-muted italic">No pipeline data available.</p>
                ) : (
                  detailCase.pipeline.map((item) => (
                    <div key={item.stage} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      item.status === "Done" ? "bg-success-subtle border-success-border" :
                      item.status === "NA" ? "bg-surface-2 border-border opacity-60" :
                      "bg-surface border-border"
                    )}>
                      <div className={cn(
                        "size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        item.status === "Done" ? "bg-success" : "border-2 border-border"
                      )}>
                        {item.status === "Done" && <CheckCircle2 className="size-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", item.status === "NA" && "line-through text-muted")}>{item.stage}</p>
                        {item.doneAt && (
                          <p className="text-xs text-muted mt-0.5">
                            {new Date(item.doneAt).toLocaleDateString("en-IN")}
                            {item.doneByName ? ` · ${item.doneByName}` : ""}
                          </p>
                        )}
                        {item.remarks && <p className="text-xs text-muted/80 mt-0.5 italic">{item.remarks}</p>}
                      </div>
                      <Badge tone={item.status === "Done" ? "success" : "neutral"}>{item.status}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Documents tab ── */}
            {detailTab === "documents" && (
              <div className="space-y-5">
                {detailCase.status === "Incomplete" && (
                  <div className="p-3 bg-orange-subtle border border-orange-border rounded-lg flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-orange shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-orange uppercase tracking-wide">Action Required: Documents Requested</h4>
                      <p className="text-xs text-foreground-secondary">Upload the missing documents below, then click "Submit for Verification".</p>
                    </div>
                  </div>
                )}

                {detailCase.status === "Incomplete" && (
                  <div className="flex justify-end">
                    <Button size="sm" loading={submittingVerification} onClick={submitVerification}>Submit for Verification</Button>
                  </div>
                )}

                {/* Requested Documents */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Requested Documents</h3>
                  {!detailCase.docRequests || detailCase.docRequests.filter(r => !r.isResolved).length === 0 ? (
                    <p className="text-xs text-muted italic">No pending requests.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailCase.docRequests.filter(r => !r.isResolved).map((req) => (
                        <div key={req._id} className="p-3 bg-orange-subtle border border-orange-border rounded-lg">
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {req.docTypes.map(t => <Badge key={t} tone="orange">{t}</Badge>)}
                          </div>
                          <p className="text-xs font-medium text-foreground-secondary">{req.remarks}</p>
                          <p className="text-[10px] text-muted mt-1">Requested by Admin · {new Date(req.requestedAt).toLocaleDateString("en-IN")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Form */}
                <div className="p-4 bg-surface-2 border border-border rounded-lg space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-secondary flex items-center gap-1.5">
                    <UploadCloud className="size-4 text-primary" /> Upload Document
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Document Type *</Label>
                      <Select value={upDocType} onChange={(e) => setUpDocType(e.target.value)}>
                        <option value="">Select type…</option>
                        {docTypes.map((dt) => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label>File Name *</Label>
                      <Input value={upFileName} onChange={(e) => setUpFileName(e.target.value)} placeholder="e.g. pan_card.jpg" />
                    </div>
                    <div>
                      <Label>Remarks</Label>
                      <Input value={upRemarks} onChange={(e) => setUpRemarks(e.target.value)} placeholder="Any notes…" />
                    </div>
                    <div>
                      <Label>File *</Label>
                      <FilePicker file={upFile} onChange={setUpFile} />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button size="xs" loading={upSaving} onClick={handleUploadDoc}>Upload File</Button>
                  </div>
                </div>

                {/* Uploaded list */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Uploaded Files</h3>
                  {!detailCase.documents || detailCase.documents.length === 0 ? (
                    <p className="text-xs text-muted italic">No documents uploaded yet.</p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-border text-xs">
                        <thead className="bg-surface-2">
                          <tr>
                            <th className="px-3 py-1.5 text-left font-semibold">Type</th>
                            <th className="px-3 py-1.5 text-left font-semibold">File</th>
                            <th className="px-3 py-1.5 text-left font-semibold">Remarks</th>
                            <th className="px-3 py-1.5 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-surface">
                          {detailCase.documents.map((doc) => (
                            <tr key={doc._id}>
                              <td className="px-3 py-1.5 font-medium">{doc.docType}</td>
                              <td className="px-3 py-1.5 font-mono text-primary max-w-[150px] truncate">
                                {doc.url ? (
                                  <a href={doc.url.startsWith("http") ? doc.url : API_BASE.replace("/api/v1", "") + doc.url} target="_blank" rel="noreferrer" className="hover:underline">
                                    {doc.fileName}
                                  </a>
                                ) : doc.fileName}
                              </td>
                              <td className="px-3 py-1.5 text-muted max-w-[180px] truncate" title={doc.remarks}>{doc.remarks ?? "—"}</td>
                              <td className="px-3 py-1.5 text-right space-x-2">
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
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* Remark modal */}
      <Modal open={!!remarkCase} onClose={() => setRemarkCase(null)} title={`Add Remark — ${remarkCase?.caseCode}`} size="sm">
        <div className="space-y-4">
          <div><Label>Your Remark</Label><Textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={4} placeholder="Enter your remark or update note…" /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setRemarkCase(null)}>Cancel</Button>
            <Button size="sm" loading={remarkSaving} onClick={submitRemark} disabled={!remark.trim()}>Save Remark</Button>
          </div>
        </div>
      </Modal>

      {/* Edit doc modal */}
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

      {/* ── New Lead Modal ───────────────────────────────────────────── */}
      <Modal
        open={leadStep !== null}
        onClose={() => setLeadStep(null)}
        title="New Lead"
        description="Check for an existing customer before creating a case."
        size="md"
      >
        <div className="space-y-5">
          {/* Step 1 — Phone lookup */}
          {leadStep === "phone" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Customer Phone Number</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                    <Input
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupPhone(); } }}
                      placeholder="e.g. 9876543210"
                      className="!pl-9"
                      autoFocus
                    />
                  </div>
                  <Button loading={lookingUp} onClick={lookupPhone} disabled={!leadPhone.trim()}>
                    <Search className="size-4" /> Check
                  </Button>
                </div>
                <p className="text-xs text-muted">We'll check if this customer already exists in the system.</p>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" size="sm" onClick={() => setLeadStep(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Step 2 — Customer confirmation */}
          {leadStep === "customer" && (
            <div className="space-y-4">
              {/* Existing customer found */}
              {foundCustomer ? (
                <div className="rounded-xl border border-success-border bg-success-subtle p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-success shrink-0" />
                    <p className="text-sm font-semibold text-success">Existing customer found</p>
                  </div>
                  <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{foundCustomer.firstName} {foundCustomer.lastName}</p>
                      <span className="text-xs font-mono text-primary">{foundCustomer.customerCode}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1"><Phone className="size-3" />{foundCustomer.phone}</span>
                      <span>{foundCustomer.totalCases} case{foundCustomer.totalCases !== 1 ? "s" : ""}</span>
                      {foundCustomer.latestCaseStatus && (
                        <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border capitalize">{foundCustomer.latestCaseStatus}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-success/80">Customer details are pre-filled. Proceed to enter case details.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-warning-border bg-warning-subtle p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="size-5 text-warning shrink-0" />
                    <p className="text-sm font-semibold text-warning">New customer — {leadPhone}</p>
                  </div>
                  <p className="text-xs text-warning/80">No existing customer found for this number. Fill in the details below.</p>
                </div>
              )}

              {/* Customer detail form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input
                      value={leadCustomer.firstName}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input
                      value={leadCustomer.lastName}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Father's Name <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                    <Input
                      value={leadCustomer.fatherName}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, fatherName: e.target.value }))}
                      placeholder="Father's name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Alt. Phone <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                    <Input
                      value={leadCustomer.altContact}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, altContact: e.target.value }))}
                      placeholder="Alternate number"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                    <Input
                      value={leadCustomer.location}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, location: e.target.value }))}
                      placeholder="City / Area"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Residential Status <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                    <Select
                      value={leadCustomer.residentialStatus}
                      onChange={(e) => setLeadCustomer((f) => ({ ...f, residentialStatus: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      <option>Own</option>
                      <option>Rented</option>
                      <option>Family Owned</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-between pt-1">
                <Button variant="ghost" size="sm" onClick={() => { setLeadStep("phone"); setPhoneChecked(false); }}>← Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setLeadStep(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => setLeadStep("details")}
                    disabled={!leadCustomer.firstName.trim() || !leadCustomer.lastName.trim()}
                  >
                    Next: Case Details →
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Case details */}
          {leadStep === "details" && (
            <div className="space-y-4">
              {/* Customer summary strip */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-primary-subtle rounded-lg border border-primary/20">
                <div className="size-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-bold shrink-0">
                  {leadCustomer.firstName[0]}{leadCustomer.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{leadCustomer.firstName} {leadCustomer.lastName}</p>
                  <p className="text-xs text-muted">{leadPhone} {foundCustomer ? `· ${foundCustomer.customerCode}` : "· New customer"}</p>
                </div>
                {foundCustomer && <CheckCircle2 className="size-4 text-success ml-auto shrink-0" />}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Product</Label>
                  <Select value={leadCase.product} onChange={(e) => setLeadCase((f) => ({ ...f, product: e.target.value }))}>
                    <option value="">Select product…</option>
                    {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Loan Type <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <Select value={leadCase.loanType} onChange={(e) => setLeadCase((f) => ({ ...f, loanType: e.target.value }))}>
                    <option value="">Select type…</option>
                    <option>New</option>
                    <option>Used</option>
                    <option>Refinance</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Loan Amount (₹) <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none pointer-events-none">₹</span>
                    <Input
                      type="number"
                      min="0"
                      value={leadCase.loanAmount}
                      onChange={(e) => setLeadCase((f) => ({ ...f, loanAmount: e.target.value }))}
                      placeholder="e.g. 850000"
                      className="!pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={leadCase.date}
                    onChange={(e) => setLeadCase((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Bank / NBFC <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <Select value={leadCase.bankId} onChange={(e) => setLeadCase((f) => ({ ...f, bankId: e.target.value }))}>
                    <option value="">Select bank…</option>
                    {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Dealer <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <Select value={leadCase.dealerId} onChange={(e) => setLeadCase((f) => ({ ...f, dealerId: e.target.value }))}>
                    <option value="">Select dealer…</option>
                    {dealers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Vehicle Model <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <Input
                    value={leadCase.vehicleModel}
                    onChange={(e) => setLeadCase((f) => ({ ...f, vehicleModel: e.target.value }))}
                    placeholder="e.g. Swift Dzire"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Reg. Number <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                  <Input
                    value={leadCase.regNumber}
                    onChange={(e) => setLeadCase((f) => ({ ...f, regNumber: e.target.value }))}
                    placeholder="e.g. HR05AB1234"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-between pt-1 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setLeadStep("customer")}>← Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setLeadStep(null)}>Cancel</Button>
                  <Button size="sm" loading={creatingLead} onClick={createLead}>
                    Create Lead
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
