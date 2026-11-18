"use client";

import { SchemaCaseForm, type CaseFormCtx } from "../../../components/SchemaCaseForm";
import { buildCasePayload, defaultValues, firstMissing, valuesFromCase, type CaseValues } from "../../../lib/caseForm";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Filter, FileText, Eye, MessageSquare, AlertCircle, UploadCloud, Edit2, Trash2, CheckCircle2, X, FileWarning } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Modal, Drawer, Label, Textarea,
  Tabs, Pagination, EmptyState, Skeleton, useToast, type CaseStatus, Input, PhoneInput, Select, cn
} from "../../../components/ui";
import { ExportButton } from "../../../components/ExportButton";
import { CaseFilterPanel, useCaseFacets } from "../../../components/CaseFilterPanel";
import { EMPTY_FILTERS, filtersToQuery, type CaseFilters } from "../../../lib/caseFilters";
import { buildCaseSheets, loadCustomDefs } from "../../../lib/exportSheets";
import {
  casesApi, mastersApi, banksApi, dealersApi, formSchemasApi, customersApi,
  VEHICLE_PRODUCTS, API_BASE, FIRMS, LOAN_TYPES, CASE_STATUSES,
  type LoanCase, type FormSchema, type PageMeta, type Bank, type Dealer, type FieldDef, type Customer,
} from "../../../lib/api";
import { FileFieldInput } from "../../../components/FileFieldInput";
import { CaseChatThread } from "../../../components/CaseChatThread";
import { coreFields } from "../../../lib/coreFields";


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

function FilePicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <input ref={ref} type="file" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {file ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/8 border border-primary/30 rounded-lg">
          <CheckCircle2 className="size-4 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium truncate flex-1">{file.name}</span>
          <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = ""; }} className="text-muted hover:text-danger transition-colors shrink-0">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="w-full flex flex-col items-center gap-1.5 px-3 py-4 border-2 border-dashed border-border rounded-lg text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">
          <UploadCloud className="size-5" />
          <span className="text-xs font-medium">Click to choose file</span>
        </button>
      )}
    </div>
  );
}

export default function TeamCasesPage() {
  return (
    <Suspense>
      <TeamCasesPageInner />
    </Suspense>
  );
}

function TeamCasesPageInner() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  // Filters: `filters` drives the query; the search box is debounced through `searchText`.
  const [filters, setFilters] = useState<CaseFilters>(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState("");
  const facets = useCaseFacets();
  const statusTab = filters.status.length === 0 ? "All" : filters.status.length === 1 ? filters.status[0] : "";
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchText]);
  const applyFilters = (f: CaseFilters) => { setFilters(f); setSearchText(f.search); setPage(1); };
  const [detailCase, setDetailCase] = useState<LoanCase | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [remarkCase, setRemarkCase] = useState<LoanCase | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 25;

  const [docTypes, setDocTypes] = useState<any[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [caseSchema, setCaseSchema] = useState<FormSchema | null>(null);
  const cf = coreFields(caseSchema);
  // Bumped whenever Form Builder is re-read, so product-specific fields refresh too.
  const [schemaTick, setSchemaTick] = useState(0);

  const [upDocType, setUpDocType] = useState("");
  const [upFileName, setUpFileName] = useState("");
  const [upRemarks, setUpRemarks] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upSaving, setUpSaving] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const [editDocData, setEditDocData] = useState<{ id: string; fileName: string; remarks: string } | null>(null);

  // Request docs
  const [reqDocsOpen, setReqDocsOpen] = useState(false);
  const [reqDocTypes, setReqDocTypes] = useState<string[]>([]);
  const [reqRemarks, setReqRemarks] = useState("");
  const [reqSaving, setReqSaving] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<CaseValues>({});
  const [editSaving, setEditSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [editProductFields, setEditProductFields] = useState<FieldDef[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [customStatuses, setCustomStatuses] = useState<{ name: string; colorClass?: string }[]>([]);

  // New Case modal
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseSaving, setNewCaseSaving] = useState(false);
  const [newCaseProductFields, setNewCaseProductFields] = useState<FieldDef[]>([]);
  const [newCaseStatus, setNewCaseStatus] = useState("Sales");
  const [newCaseValues, setNewCaseValues] = useState<CaseValues>({});
  const resetNewCase = () => { setNewCaseStatus("Sales"); setNewCaseValues(defaultValues(caseSchema, [])); };

  // "Find Existing Customer" — search by phone/name before creating a new case,
  // so a coordinator can tell whether this is a repeat customer.
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (customerQuery.trim().length < 2) { setCustomerResults([]); return; }
    setCustomerSearching(true);
    const t = setTimeout(() => {
      customersApi.list({ search: customerQuery.trim(), limit: 8 })
        .then(({ data }) => setCustomerResults(data))
        .catch(() => setCustomerResults([]))
        .finally(() => setCustomerSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  function selectExistingCustomer(c: Customer) {
    setSelectedCustomer(c);
    setNewCaseValues((p) => ({
      ...p,
      firstName: c.firstName, lastName: c.lastName ?? "",
      contact: c.phone, altContact: c.alternatePhone ?? "",
    }));
    setCustomerDropdownOpen(false);
    setCustomerQuery(`${c.firstName} ${c.lastName ?? ""}`.trim());
  }

  function clearSelectedCustomer() {
    setSelectedCustomer(null);
    setCustomerQuery("");
    setCustomerResults([]);
  }

  // Custom fields added via Form Builder on the "New Case" form itself (not tied
  // to a specific product) — e.g. extra fields under Customer / Loan / Bank sections.
  const genericCustomFields: FieldDef[] = (caseSchema?.sections ?? []).flatMap((s) =>
    s.fields.filter((f) => !f.isCore && f.isActive),
  );

  // Built-in statuses are now seeded into the case-statuses catalog alongside
  // custom ones, so this list is already complete and in the admin's chosen
  // drag-and-drop order — CASE_STATUSES is only a fallback if the catalog
  // hasn't loaded yet.
  // De-duplicated: the catalog can list the same status name twice (built-in + custom).
  const allStatuses: string[] = [...new Set(customStatuses.length > 0 ? customStatuses.map((c) => c.name) : CASE_STATUSES)];
  const customStatusColorMap: Record<string, string | undefined> = Object.fromEntries(
    customStatuses.map((c) => [c.name, c.colorClass]),
  );

  // Inline "add new dealer" from the edit form or the New Case modal
  const [addDealerOpen, setAddDealerOpen] = useState<null | "edit" | "new">(null);
  const [newDealer, setNewDealer] = useState({ name: "", contact: "", location: "", address: "" });
  const [savingDealer, setSavingDealer] = useState(false);
  const [insurerOptions, setInsurerOptions] = useState<string[]>([]);
  const ctxFor = (mode: "edit" | "new"): CaseFormCtx => ({
    products, banks, dealers, states, cities, insurers: insurerOptions, onAddDealer: () => setAddDealerOpen(mode),
  });

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
      if (addDealerOpen === "new") {
        setNewCaseValues((v) => ({ ...v, dealer: data._id }));
      } else {
        setEditValues((v) => ({ ...v, dealer: data._id }));
      }
      setNewDealer({ name: "", contact: "", location: "", address: "" });
      setAddDealerOpen(null);
      toast("success", `Dealer "${data.name}" added`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to add dealer");
    } finally {
      setSavingDealer(false);
    }
  }

  /** Builds the export workbook for a filter set — every matching case, not just the visible page. */
  const loadExportSheets = async (f?: CaseFilters) => {
    const { data } = await casesApi.list(filtersToQuery(f ?? filters, { page: 1, limit: 10000 }));
    return buildCaseSheets(data as unknown as LoanCase[], await loadCustomDefs("case"));
  };

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

  useEffect(() => {
    mastersApi.list("document-types").then(({ data }) => setDocTypes(data.filter((d: any) => d.isActive))).catch(() => {});
    mastersApi.list("products").then(({ data }) => setProducts(data.filter((d: any) => d.isActive))).catch(() => {});
    banksApi.list().then(({ data }) => setBanks(data)).catch(() => {});
    dealersApi.list().then(({ data }) => setDealers(data)).catch(() => {});
    formSchemasApi.get("new-case").then(({ data }) => setCaseSchema(data)).catch(() => {});
    mastersApi.list("cities").then(({ data }) => setCities([...new Set<string>(data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort())).catch(() => {});
    mastersApi.list("states").then(({ data }) => setStates([...new Set<string>(data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort())).catch(() => {});
    mastersApi.list("insurance-companies").then(({ data }) => setInsurerOptions(data.filter((d: any) => d.isActive).map((d: any) => d.name))).catch(() => {});
    mastersApi.list("case-statuses").then(({ data }) => setCustomStatuses(data.filter((d: any) => d.isActive).map((d: any) => ({ name: d.name, colorClass: d.colorClass })))).catch(() => {});
  }, []);

  // Fetches a product's extra-fields schema by name.
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

  useEffect(() => {
    if (!editValues.product || products.length === 0) { setEditProductFields([]); return; }
    loadProductFields(editValues.product).then(setEditProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editValues.product, products, schemaTick]);

  useEffect(() => {
    if (!newCaseValues.product || products.length === 0) { setNewCaseProductFields([]); return; }
    loadProductFields(newCaseValues.product).then(setNewCaseProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCaseValues.product, products, schemaTick]);

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
      setCases((prev) => prev.map((c) => (c._id === data._id ? data : c)));
      toast("success", "Case updated");
      setEditMode(false);
    } catch (e: any) {
      toast("error", e.message ?? "Update failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveNewCase() {
    const problem = firstMissing(newCaseValues, caseSchema, newCaseProductFields);
    if (problem) { toast("error", problem); return; }
    setNewCaseSaving(true);
    try {
      await casesApi.create({ status: newCaseStatus || "Sales", ...buildCasePayload(newCaseValues, caseSchema, newCaseProductFields, { banks, dealers }) } as any);
      toast("success", "Case created");
      setNewCaseOpen(false);
      resetNewCase();
      clearSelectedCustomer();
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to create case");
    } finally {
      setNewCaseSaving(false);
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

  async function handleRequestDocs() {
    if (!detailCase) return;
    if (reqDocTypes.length === 0) { toast("error", "Select at least one document type"); return; }
    if (!reqRemarks.trim()) { toast("error", "Remarks are required"); return; }
    setReqSaving(true);
    try {
      const { data } = await casesApi.requestDocs(detailCase._id, { docTypes: reqDocTypes, remarks: reqRemarks });
      setDetailCase(data);
      toast("success", "Document request sent");
      setReqDocsOpen(false); setReqDocTypes([]); setReqRemarks("");
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to send request");
    } finally {
      setReqSaving(false);
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

  async function resolveRequest(reqId: string) {
    if (!detailCase) return;
    try {
      const { data } = await casesApi.resolveDocRequest(detailCase._id, reqId);
      setDetailCase(data);
      toast("success", "Request marked as done");
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to resolve request");
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

  // Re-read Form Builder every time a case dialog opens, so a hidden field or changed dropdown options show up
  // without reloading the page (the schema is otherwise only fetched once when the page loads).
  const caseDialogOpen = editMode || newCaseOpen;
  useEffect(() => {
    if (!caseDialogOpen) return;
    formSchemasApi.get("new-case").then(({ data }) => { setCaseSchema(data); setSchemaTick((t) => t + 1); }).catch(() => {});
  }, [caseDialogOpen]);

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Team Cases</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total} cases across your assigned sales reps and the ones you've created</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            label="Export" title="Export cases" storageKey="cases" filename="cases-export"
            loadSheets={loadExportSheets}
            filters={{ initial: filters, facets, hide: ["coordinatorId"] }}
          />
          <Button size="sm" onClick={() => { resetNewCase(); clearSelectedCustomer(); setNewCaseOpen(true); }}>
            <FileText className="size-3.5" /> New Case
          </Button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-border">
          <CaseFilterPanel
            value={{ ...filters, search: searchText }}
            onChange={applyFilters}
            onSearchChange={setSearchText}
            facets={facets}
            hide={["coordinatorId"]}
          />
        </div>
        <div className="overflow-x-auto">
          <Tabs tabs={["All", ...allStatuses].map((s) => ({ id: s, label: s }))} active={statusTab} onChange={(s) => applyFilters({ ...filters, status: s === "All" ? [] : [s] })} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th><th>Date</th><th>Customer</th><th>Sales Rep</th><th>Product</th>
                <th>Bank</th><th>Loan Amount</th><th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : cases.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={FileText} title="No cases yet" description="Cases from your assigned sales reps will appear here, or create one yourself with New Case." /></td></tr>
              ) : cases.map((c) => (
                <tr key={c._id} className="cursor-pointer" onClick={() => openDetail(c)}
                  style={{ borderLeft: c.status === "Incomplete" ? "3.5px solid var(--orange)" : undefined }}>
                  <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                  <td className="text-xs text-muted">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td className="text-sm">
                    <div className="font-medium">{c.customer.firstName} {c.customer.lastName}</div>
                    {c.customer.contact && <div className="text-[11px] text-muted font-mono">{c.customer.contact}</div>}
                  </td>
                  <td className="text-xs text-foreground-secondary">{c.assignedToName ?? "—"}</td>
                  <td className="text-xs text-foreground-secondary">{c.product}</td>
                  <td className="text-xs text-foreground-secondary">{c.bankName ?? "—"}</td>
                  <td className="font-mono text-xs font-semibold">{c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td><CaseStatusBadge status={c.status} colorClass={customStatusColorMap[c.status]} /></td>
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
        subtitle={detailCase ? `${detailCase.customer.firstName} ${detailCase.customer.lastName} · ${detailCase.product}` : undefined}
        width="max-w-3xl"
      >
        {detailCase && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-2">
                <CaseStatusBadge status={detailCase.status} colorClass={customStatusColorMap[detailCase.status]} />
                <Select value={detailCase.status} onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
                  className="h-7 text-xs py-0 w-36 bg-surface border-border">
                  {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="xs" variant="secondary" onClick={() => setReqDocsOpen(true)}>
                  <FileWarning className="size-3.5" /> Request Docs
                </Button>
                <button onClick={() => setDetailTab("overview")}
                  className={cn("px-3 py-1 text-xs font-semibold rounded-md transition-colors", detailTab === "overview" ? "bg-primary text-white" : "bg-surface-2 hover:bg-surface-3 text-foreground-secondary")}>
                  Overview
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

            {detailTab === "overview" && (
              <div className="space-y-4">
                {editMode ? (
                  <div className="space-y-5">
                    <SchemaCaseForm schema={caseSchema} productFields={editProductFields} values={editValues} setValues={setEditValues} ctx={ctxFor("edit")} />
                    <div className="flex gap-2 justify-end pt-1 border-t border-border">
                      <Button variant="secondary" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                      <Button size="sm" loading={editSaving} onClick={saveEdit}>Save Changes</Button>
                    </div>
                  </div>
                ) : (
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
                            {detailCase.assignedToName && <div><Label>Sales Rep</Label><p className="text-sm font-medium mt-0.5">{detailCase.assignedToName}</p></div>}
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
                          ["Firm", detailCase.firm ?? "—"],
                          ["Loan Amount", detailCase.loanAmount ? `₹${detailCase.loanAmount.toLocaleString("en-IN")}` : "—"],
                          ["Bank", detailCase.bankName ?? "—"],
                          ["Dealer", detailCase.dealerName ?? "—"],
                          ["Sales Rep", detailCase.assignedToName ?? "—"],
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

            {detailTab === "documents" && (
              <div className="space-y-5">
                {detailCase.status === "Incomplete" && (
                  <div className="p-3 bg-orange-subtle border border-orange-border rounded-lg flex items-start gap-2.5">
                    <AlertCircle className="size-4 text-orange shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-orange uppercase tracking-wide">Documents Requested</h4>
                      <p className="text-xs text-foreground-secondary">Waiting on the sales rep to upload the missing documents.</p>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Requested Documents</h3>
                  {!detailCase.docRequests || detailCase.docRequests.filter(r => !r.isResolved).length === 0 ? (
                    <p className="text-xs text-muted italic">No pending requests.</p>
                  ) : (
                    <div className="space-y-2">
                      {detailCase.docRequests.filter(r => !r.isResolved).map((req) => (
                        <div key={req._id} className="p-3 bg-orange-subtle border border-orange-border rounded-lg">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {req.docTypes.map(t => <Badge key={t} tone="orange">{t}</Badge>)}
                            </div>
                            <Button size="xs" variant="secondary" onClick={() => resolveRequest(req._id)}>Mark Done</Button>
                          </div>
                          <p className="text-xs font-medium text-foreground-secondary">{req.remarks}</p>
                          <p className="text-[10px] text-muted mt-1">Requested by {req.requestedByName} · {new Date(req.requestedAt).toLocaleDateString("en-IN")}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {detailCase.docRequests && detailCase.docRequests.some(r => r.isResolved) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Resolved Requests</p>
                    <div className="space-y-2">
                      {detailCase.docRequests.filter(r => r.isResolved).map((req) => (
                        <div key={req._id} className="p-2.5 bg-surface-2 border border-border rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <p className="text-[10px] text-muted line-through">{req.docTypes.join(", ")}</p>
                            <p className="text-xs text-muted">{req.remarks}</p>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                            <CheckCircle2 className="size-3.5" /> Done
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

      {/* Request Documents modal */}
      <Modal open={reqDocsOpen} onClose={() => setReqDocsOpen(false)} title="Request Documents" description="Ask the sales rep for missing documents." size="md">
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
              {docTypes.length === 0 && <p className="text-xs text-muted col-span-2 py-1">No document types configured.</p>}
            </div>
          </div>
          <div>
            <Label>Remarks / Instructions *</Label>
            <Textarea value={reqRemarks} onChange={(e) => setReqRemarks(e.target.value)} rows={3} placeholder="Explain what is missing or required…" />
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setReqDocsOpen(false)}>Cancel</Button>
            <Button size="sm" loading={reqSaving} onClick={handleRequestDocs}>Send Request</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add New Dealer Modal (inline from case edit or New Case) ──── */}
      <Modal open={!!addDealerOpen} onClose={() => setAddDealerOpen(null)} title="Add New Dealer" size="sm">
        <div className="space-y-3">
          <div>
            <Label>Dealer Name *</Label>
            <Input value={newDealer.name} onChange={(e) => setNewDealer((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. City Motors Pvt Ltd" />
          </div>
          <div>
            <Label>Contact</Label>
            <PhoneInput value={newDealer.contact} onChange={(v) => setNewDealer((f) => ({ ...f, contact: v }))} />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={newDealer.location} onChange={(e) => setNewDealer((f) => ({ ...f, location: e.target.value }))} placeholder="City / Area" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={newDealer.address} onChange={(e) => setNewDealer((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setAddDealerOpen(null)}>Cancel</Button>
            <Button size="sm" loading={savingDealer} onClick={saveNewDealer}>Add Dealer</Button>
          </div>
        </div>
      </Modal>

      {/* ── New Case Modal ──────────────────────────────────────────── */}
      <Modal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} title="New Case" size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Initial Status</p>
            <div className="w-48">
              <Label>Status</Label>
              <Select value={newCaseStatus} onChange={(e) => setNewCaseStatus(e.target.value)}>
                {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Customer Information</p>

            <div className="mb-3 relative">
              <Label>Find Existing Customer</Label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    <p className="text-xs text-muted">
                      <span className="font-mono text-primary">{selectedCustomer.customerCode}</span>
                      {" · "}{selectedCustomer.phone}
                      {" · "}{selectedCustomer.totalCases} case{selectedCustomer.totalCases !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button type="button" onClick={clearSelectedCustomer} className="text-xs text-danger hover:underline shrink-0">Change</button>
                </div>
              ) : (
                <>
                  <Input
                    value={customerQuery}
                    onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                    placeholder="Search by name or phone to reuse an existing customer…"
                  />
                  {customerDropdownOpen && customerQuery.trim().length >= 2 && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
                      {customerSearching ? (
                        <p className="px-3 py-2 text-xs text-muted">Searching…</p>
                      ) : customerResults.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted">No matching customers — a new one will be created.</p>
                      ) : (
                        customerResults.map((c) => (
                          <button
                            type="button"
                            key={c._id}
                            onMouseDown={() => selectExistingCustomer(c)}
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
                  <p className="text-[10px] text-muted mt-1">Leave blank to create a brand-new customer.</p>
                </>
              )}
            </div>

          </div>

          <SchemaCaseForm schema={caseSchema} productFields={newCaseProductFields} values={newCaseValues} setValues={setNewCaseValues} ctx={ctxFor("new")} />
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setNewCaseOpen(false)}>Cancel</Button>
          <Button size="sm" loading={newCaseSaving} onClick={saveNewCase}>Create Case</Button>
        </div>
      </Modal>
    </div>
  );
}
