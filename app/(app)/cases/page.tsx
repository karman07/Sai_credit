"use client";

import { SchemaCaseForm, type CaseFormCtx } from "../../../components/SchemaCaseForm";
import { applyChange, buildCasePayload, defaultValues, firstMissing, valuesFromCase, type CaseValues } from "../../../lib/caseForm";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Plus, Eye, MessageSquare, AlertCircle, UploadCloud, Edit2, Trash2, CheckCircle2, X, Phone, User, Search, Building2 } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Modal, Drawer, Label, Textarea,
  Tabs, Pagination, EmptyState, Skeleton, useToast, type CaseStatus, Input, PhoneInput, Select, cn
} from "../../../components/ui";
import {
  casesApi, customersApi, mastersApi, banksApi, dealersApi, formSchemasApi, onlyDigits,
  LOAN_TYPES, RESIDENTIAL_STATUSES, FIRMS, VEHICLE_PRODUCTS, API_BASE,
  type LoanCase, type FormSchema, type PageMeta, type Bank, type Dealer, type SalesCustomer, type FieldDef,
} from "../../../lib/api";
import { FileFieldInput } from "../../../components/FileFieldInput";
import { CaseChatThread } from "../../../components/CaseChatThread";
import { ExportButton } from "../../../components/ExportButton";
import { CaseFilterPanel, useCaseFacets } from "../../../components/CaseFilterPanel";
import { EMPTY_FILTERS, filtersToQuery, type CaseFilters } from "../../../lib/caseFilters";
import { buildCaseSheets, loadCustomDefs } from "../../../lib/exportSheets";
import { coreFields } from "../../../lib/coreFields";

const STATUS_TABS = ["All", "Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];

function isVehicleProduct(product?: string) { return !!product && VEHICLE_PRODUCTS.includes(product); }

function ProductDynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === "select") {
    return (
      <Select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </Select>
    );
  }
  if (field.type === "boolean") {
    return (
      <Select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Select…</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </Select>
    );
  }
  if (field.type === "date") return <Input type="date" value={value} onChange={e => onChange(e.target.value)} />;
  if (field.type === "number") return <Input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
  if (field.type === "file") return <FileFieldInput value={value} onChange={onChange} />;
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
}

function buildCustomFieldsPayload(fields: FieldDef[], values: Record<string, string>): Record<string, any> | undefined {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (raw === undefined || raw === "") continue;
    out[f.key] = f.type === "number" ? Number(raw) : raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

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
  return (
    <Suspense>
      <MyCasesPageInner />
    </Suspense>
  );
}

function MyCasesPageInner() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  // Filters: `filters` drives the query; the search box is debounced through `searchText`.
  const [filters, setFilters] = useState<CaseFilters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const facets = useCaseFacets();
  const statusTab = filters.status.length === 0 ? "All" : filters.status.length === 1 ? filters.status[0] : "";
  const [detailCase, setDetailCase] = useState<LoanCase | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [remarkCase, setRemarkCase] = useState<LoanCase | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchText]);
  const applyFilters = (f: CaseFilters) => { setFilters(f); setSearchText(f.search); setPage(1); };
  const limit = 25;

  // Reference data
  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [caseSchema, setCaseSchema] = useState<FormSchema | null>(null);
  const cf = coreFields(caseSchema);

  // Bumped whenever Form Builder is re-read, so product-specific fields refresh too.
  const [schemaTick, setSchemaTick] = useState(0);
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [insurerOptions, setInsurerOptions] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [leadProductFields, setLeadProductFields] = useState<FieldDef[]>([]);
  const [editProductFields, setEditProductFields] = useState<FieldDef[]>([]);

  // Custom fields added via Form Builder on the "New Case" form itself (not tied
  // to a specific product) — e.g. extra fields under Customer / Loan / Bank sections.
  const genericCustomFields: FieldDef[] = (caseSchema?.sections ?? []).flatMap((s) =>
    s.fields.filter((f) => !f.isCore && f.isActive),
  );

  async function loadProductFields(productName: string): Promise<FieldDef[]> {
    const p = products.find((x) => x.name === productName);
    if (!p?.code) return [];
    try {
      const { data } = await formSchemasApi.get(`product-fields:${p.code.toLowerCase()}`);
      return data.sections.flatMap((s) => s.fields.filter((f) => f.isActive));
    } catch {
      return [];
    }
  }

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
  const [phoneResults, setPhoneResults] = useState<SalesCustomer[]>([]);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [leadValues, setLeadValues] = useState<CaseValues>({});
  const [creatingLead, setCreatingLead] = useState(false);

  // Inline "add new dealer" from the lead wizard
  const [addDealerOpen, setAddDealerOpen] = useState(false);
  const [newDealer, setNewDealer] = useState({ name: "", contact: "", location: "", address: "" });
  const [savingDealer, setSavingDealer] = useState(false);
  const formCtx: CaseFormCtx = {
    products, banks, dealers, states: stateOptions, cities: cityOptions, insurers: insurerOptions,
    onAddDealer: () => setAddDealerOpen(true),
  };

  async function saveNewDealer() {
    if (!newDealer.name.trim()) { toast("error", "Dealer name is required"); return; }
    setSavingDealer(true);
    try {
      const { data } = await dealersApi.create({
        name: newDealer.name.trim(),
        contact: newDealer.contact || undefined,
        location: newDealer.location || undefined,
        address: newDealer.address || undefined,
      });
      setDealers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setLeadValues((v) => ({ ...v, dealer: data._id }));
      setNewDealer({ name: "", contact: "", location: "", address: "" });
      setAddDealerOpen(false);
      toast("success", `Dealer "${data.name}" added`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to add dealer");
    } finally {
      setSavingDealer(false);
    }
  }

  function openNewLead() {
    setLeadPhone(""); setFoundCustomer(null); setPhoneChecked(false);
    setPhoneResults([]); setPhoneDropdownOpen(false);
    setLeadValues({});
    setLeadStep("phone");
  }

  function closeNewLead() {
    setLeadStep(null);
    const params = new URLSearchParams(window.location.search);
    if (params.has("new-lead")) {
      params.delete("new-lead");
      const qs = params.toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
  }

  // Live search-as-you-type by name or phone, while on the phone step
  useEffect(() => {
    if (leadStep !== "phone" || leadPhone.trim().length < 2) { setPhoneResults([]); return; }
    setPhoneSearching(true);
    const t = setTimeout(() => {
      customersApi.list({ search: leadPhone.trim(), limit: 8 })
        .then(({ data }) => setPhoneResults(data as unknown as SalesCustomer[]))
        .catch(() => setPhoneResults([]))
        .finally(() => setPhoneSearching(false));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadPhone, leadStep]);

  // Starts the case form for a phone number (and the matching customer, if there is one).
  function startLead(phone: string, found: SalesCustomer | null) {
    setLeadPhone(phone);
    setFoundCustomer(found);
    setLeadValues({
      ...defaultValues(caseSchema, []),
      contact: phone,
      ...(found ? { firstName: found.firstName, lastName: found.lastName, altContact: found.alternatePhone ?? "" } : {}),
    });
    setPhoneDropdownOpen(false);
    setPhoneChecked(true);
    setLeadStep("details");
  }

  function selectFoundCustomer(c: SalesCustomer) { startLead(c.phone, c); }

  async function lookupPhone() {
    const phone = leadPhone.trim();
    if (!phone) return;
    setLookingUp(true);
    try {
      const { data } = await customersApi.list({ search: phone, limit: 5 });
      const match = (data as unknown as SalesCustomer[]).find(
        (c) => c.phone === phone || c.phone?.replace(/\D/g, "").endsWith(phone.replace(/\D/g, ""))
      );
      if (match) { setLookingUp(false); startLead(match.phone, match); return; }
      if (!/^\d{7,15}$/.test(onlyDigits(phone))) {
        // The search box doubles as "name or phone" — with no match this must be a new customer's phone number.
        toast("error", "No matching customer found. Enter a valid phone number (digits only) to create a new lead.");
        setLookingUp(false);
        return;
      }
      setLookingUp(false);
      startLead(onlyDigits(phone), null);
      return;
    } catch {
      setLookingUp(false);
      if (/^\d{7,15}$/.test(onlyDigits(phone))) startLead(onlyDigits(phone), null);
    }
  }

  async function createLead() {
    const problem = firstMissing(leadValues, caseSchema, leadProductFields);
    if (problem) { toast("error", problem); return; }
    setCreatingLead(true);
    try {
      await casesApi.create(buildCasePayload(leadValues, caseSchema, leadProductFields, { banks, dealers }) as any);
      toast("success", "Lead created successfully");
      closeNewLead();
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to create lead");
    } finally {
      setCreatingLead(false);
    }
  }

  // Edit overview state
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<CaseValues>({});
  const [editSaving, setEditSaving] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, meta: m } = await casesApi.list(filtersToQuery(filters, { page, limit }));
      setCases(data as unknown as LoanCase[]);
      if (m) setMeta(m);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, toast]);

  useEffect(() => { load(); }, [load]);

  // Deep-link support: /cases?caseId=... (used by notifications) opens that case directly.
  // Reacts to the search param itself (not just mount) so clicking a notification while
  // already on this page — a client-side navigation, not a fresh page load — still opens it.
  const searchParams = useSearchParams();
  const deepLinkCaseId = searchParams.get("caseId");
  useEffect(() => {
    if (!deepLinkCaseId) return;
    casesApi.get(deepLinkCaseId).then(({ data }) => openDetail(data)).catch(() => {
      toast("error", "That case could not be opened — it may have been removed or you may not have access to it.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkCaseId]);

  // Deep-link support: /cases?new-lead=true (used by the Dashboard's "New Lead"
  // button) opens the same New Lead flow used here, so there is only one.
  const deepLinkNewLead = searchParams.get("new-lead");
  useEffect(() => {
    if (deepLinkNewLead !== "true") return;
    openNewLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkNewLead]);

  useEffect(() => {
    mastersApi.list("document-types").then(({ data }) => setDocTypes(data.filter((d: any) => d.isActive))).catch(() => {});
    mastersApi.list("states").then(({ data }) => setStateOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("cities").then(({ data }) => setCityOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("insurance-companies").then(({ data }) => setInsurerOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("products").then(({ data }) => setProducts(data.filter((d: any) => d.isActive))).catch(() => {});
    banksApi.list().then(({ data }) => setBanks(data)).catch(() => {});
    dealersApi.list().then(({ data }) => setDealers(data)).catch(() => {});
    formSchemasApi.get("new-case").then(({ data }) => setCaseSchema(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!leadValues.product || products.length === 0) { setLeadProductFields([]); return; }
    loadProductFields(leadValues.product).then(setLeadProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadValues.product, products, schemaTick]);

  useEffect(() => {
    if (!editValues.product || products.length === 0) { setEditProductFields([]); return; }
    loadProductFields(editValues.product).then(setEditProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editValues.product, products, schemaTick]);

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
    setEditValues(valuesFromCase(c));
    setEditMode(true);
  }

  async function saveEdit() {
    if (!detailCase) return;
    const problem = firstMissing(editValues, caseSchema, editProductFields);
    if (problem) { toast("error", problem); return; }
    setEditSaving(true);
    try {
      const body = buildCasePayload(editValues, caseSchema, editProductFields, { banks, dealers }, detailCase);
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

  // Re-read Form Builder every time a case dialog opens, so a hidden field or changed dropdown options show up
  // without reloading the page (the schema is otherwise only fetched once when the page loads).
  const caseDialogOpen = editMode || leadStep !== null;
  useEffect(() => {
    if (!caseDialogOpen) return;
    formSchemasApi.get("new-case").then(({ data }) => { setCaseSchema(data); setSchemaTick((t) => t + 1); }).catch(() => {});
  }, [caseDialogOpen]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Cases</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total} total cases</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            label="Export" title="Export my cases" storageKey="cases" filename="my-cases"
            loadSheets={async (f) => {
              const { data } = await casesApi.list(filtersToQuery(f ?? filters, { page: 1, limit: 10000 }));
              return buildCaseSheets(data as unknown as LoanCase[], await loadCustomDefs("case"));
            }}
            filters={{ initial: filters, facets, hide: ["assignedTo", "coordinatorId"] }}
          />
          <Button size="sm" onClick={openNewLead}><Plus className="size-3.5" /> New Lead</Button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-border">
          <CaseFilterPanel
            value={{ ...filters, search: searchText }}
            onChange={applyFilters}
            onSearchChange={setSearchText}
            facets={facets}
            hide={["assignedTo", "coordinatorId"]}
          />
        </div>
        <div className="overflow-x-auto">
          <Tabs tabs={STATUS_TABS.map((s) => ({ id: s, label: s }))} active={statusTab} onChange={(s) => applyFilters({ ...filters, status: s === "All" ? [] : [s] })} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th><th>Date</th><th>Customer</th><th>Product</th>
                <th>Bank</th><th>Loan Amount</th><th>Coordinator</th><th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : cases.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={FileText} title="No cases found" description="Create your first lead using the New Lead button." /></td></tr>
              ) : cases.map((c) => (
                <tr key={c._id} className="cursor-pointer" onClick={() => openDetail(c)}
                  style={{ borderLeft: c.status === "Incomplete" ? "3.5px solid var(--orange)" : undefined }}>
                  <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                  <td className="text-xs text-muted">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                  <td className="text-xs text-foreground-secondary">{c.product}</td>
                  <td className="text-xs text-foreground-secondary">{c.bankName ?? "—"}</td>
                  <td className="font-mono text-xs font-semibold">{c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td className="text-xs text-foreground-secondary">{c.coordinatorName ?? "—"}</td>
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
                <button onClick={() => { setDetailTab("chat"); setEditMode(false); }}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-colors", detailTab === "chat" ? "bg-primary text-white" : "bg-surface-2 hover:bg-surface-3 text-foreground-secondary")}>
                  Chat
                </button>
              </div>
            </div>

            {/* ── Overview tab ── */}
            {detailTab === "overview" && (
              <div className="space-y-4">
                {editMode ? (
                  /* ── Edit form — built entirely from Form Builder ── */
                  <div className="space-y-5">
                    <SchemaCaseForm schema={caseSchema} productFields={editProductFields} values={editValues} setValues={setEditValues} ctx={formCtx} />
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
                            {detailCase.firm && <div><Label>Firm</Label><p className="text-sm font-medium mt-0.5">{detailCase.firm}</p></div>}
                            {detailCase.assignedToName && <div><Label>Assigned To</Label><p className="text-sm font-medium mt-0.5">{detailCase.assignedToName}</p></div>}
                            <div><Label>Coordinator</Label><p className="text-sm font-medium mt-0.5">{detailCase.coordinatorName ?? "Unassigned"}</p></div>
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
                          ["Coordinator", detailCase.coordinatorName ?? "Unassigned"],
                          ["Disbursed", detailCase.disbursementDate ? new Date(detailCase.disbursementDate).toLocaleDateString("en-IN") : "—"],
                        ].map(([label, value]) => (
                          <div key={label as string}>
                            <Label>{label as string}</Label>
                            <p className="text-sm font-medium mt-0.5">{value as string}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {detailCase.remarks && cf.show("remarks") && <div className="p-3 bg-surface-2 rounded-lg text-sm text-muted">{detailCase.remarks}</div>}
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

            {detailTab === "chat" && (
              <CaseChatThread caseId={detailCase._id} height="460px" />
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
        onClose={closeNewLead}
        title="New Lead"
        description="Check for an existing customer before creating a case."
        size="lg"
      >
        <div className="space-y-5">
          {/* Step 1 — Phone lookup */}
          {leadStep === "phone" && (
            <div className="space-y-4">
              <div className="space-y-1.5 relative">
                <Label>Customer Name or Phone Number</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted pointer-events-none" />
                    <Input
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      onFocus={() => setPhoneDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setPhoneDropdownOpen(false), 150)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupPhone(); } }}
                      placeholder="Search by name or phone…"
                      className="!pl-9"
                      autoFocus
                    />
                  </div>
                  <Button loading={lookingUp} onClick={lookupPhone} disabled={!leadPhone.trim()}>
                    <Search className="size-4" /> Check
                  </Button>
                </div>
                <p className="text-xs text-muted">We'll check if this customer already exists in the system.</p>

                {phoneDropdownOpen && leadPhone.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                    {phoneSearching ? (
                      <p className="px-3 py-2 text-xs text-muted">Searching…</p>
                    ) : phoneResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted">No matches yet — keep typing or press Check.</p>
                    ) : (
                      phoneResults.map((c) => (
                        <button
                          type="button"
                          key={c._id}
                          onMouseDown={() => selectFoundCustomer(c)}
                          className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-0"
                        >
                          <p className="text-sm font-medium">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-muted">
                            <span className="font-mono text-primary">{c.customerCode}</span>
                            {" · "}{c.phone}
                            {" · "}{c.totalCases} case{c.totalCases !== 1 ? "s" : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <Button variant="secondary" size="sm" onClick={closeNewLead}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Step 2 — the case form, exactly as Form Builder defines it */}
          {leadStep === "details" && (
            <div className="space-y-4">
              <SchemaCaseForm
                schema={caseSchema} productFields={leadProductFields} values={leadValues} setValues={setLeadValues} ctx={formCtx}
                readOnly={["contact"]}
                lead={
                  foundCustomer ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-success-subtle rounded-lg border border-success-border">
                      <CheckCircle2 className="size-4 text-success shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">Existing customer — {foundCustomer.firstName} {foundCustomer.lastName}</p>
                        <p className="text-xs text-muted">{foundCustomer.phone} · {foundCustomer.customerCode} · {foundCustomer.totalCases} case{foundCustomer.totalCases !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-warning-subtle rounded-lg border border-warning-border">
                      <User className="size-4 text-warning shrink-0" />
                      <p className="text-sm font-semibold text-warning">New customer — {leadPhone}</p>
                    </div>
                  )
                }
              />
              <div className="flex gap-2 justify-between pt-1 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => { setLeadStep("phone"); setPhoneChecked(false); }}>← Back</Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={closeNewLead}>Cancel</Button>
                  <Button size="sm" loading={creatingLead} onClick={createLead}>Create Lead</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Add New Dealer Modal (inline from the lead wizard) ─────────── */}
      <Modal open={addDealerOpen} onClose={() => setAddDealerOpen(false)} title="Add New Dealer" size="sm">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Dealer Name *</Label>
            <Input value={newDealer.name} onChange={(e) => setNewDealer((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. City Motors Pvt Ltd" />
          </div>
          <div className="space-y-1.5">
            <Label>Contact</Label>
            <PhoneInput value={newDealer.contact} onChange={(v) => setNewDealer((f) => ({ ...f, contact: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={newDealer.location} onChange={(e) => setNewDealer((f) => ({ ...f, location: e.target.value }))} placeholder="City / Area" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={newDealer.address} onChange={(e) => setNewDealer((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setAddDealerOpen(false)}>Cancel</Button>
            <Button size="sm" loading={savingDealer} onClick={saveNewDealer}>Add Dealer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
