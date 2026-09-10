"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Filter, X, Eye, FileText, Calendar, Building2, Users, MapPin, Banknote, UserCheck, CheckCircle2, AlertCircle, UploadCloud, Pencil, Trash2, Edit2, Info, Save, Upload, ExternalLink } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Drawer, Tabs,
  Select, Input, Label, Modal, Pagination, EmptyState, Timeline,
  Skeleton, useToast, type CaseStatus,
} from "../../../components/ui";
import {
  casesApi, banksApi, dealersApi, usersApi, mastersApi, formSchemasApi, customersApi,
  CASE_STATUSES, RTO_STATUSES, LOAN_TYPES, FIRMS, VEHICLE_PRODUCTS, API_BASE, PIPELINE_STAGES, RTO_OWNERSHIP_TYPES,
  rtoApi,
  type LoanCase, type Bank, type Dealer, type Activity, type Customer,
  type PageMeta, type SalesUser, type DocumentType, type PipelineItem, type RTORecord,
  type MasterItem, type FieldDef,
} from "../../../lib/api";

function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"; }
function isVehicleProduct(product?: string) { return !!product && VEHICLE_PRODUCTS.includes(product); }

function ProductDynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  const cls = "w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm focus:ring-1 focus:ring-primary focus:outline-none";
  if (field.type === "select") return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="">—</option>
      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (field.type === "boolean") return (
    <select value={value} onChange={e => onChange(e.target.value)} className={cls}>
      <option value="">—</option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
  if (field.type === "date") return <input type="date" value={value} onChange={e => onChange(e.target.value)} className={cls} />;
  if (field.type === "number") return <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className={cls} />;
}

/** Converts a form's raw string customFields values into properly-typed values for submission. */
function buildCustomFieldsPayload(fields: FieldDef[], values: Record<string, string>): Record<string, any> | undefined {
  const out: Record<string, any> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (raw === undefined || raw === "") continue;
    out[f.key] = f.type === "number" ? Number(raw) : raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// ── RTO drawer form helpers ───────────────────────────────────────────────────
const CHECKLIST_OPTS = ["Pending", "Received", "Not Required"] as const;
const STAGE_OPTS     = ["Pending", "Done"] as const;

type RTODrawerForm = {
  status: string;
  rtoOwnershipType: string; rtoOwnership: string; rtoReceiving: boolean;
  challanCheck: string; bankNocCheck: string; insuranceCheck: string;
  hypothecation: string; aadhaarMatch: string; aadhaarMismatchNote: string;
  nocHoldAmt: string; pendingDocuments: string[];
  verification: string; approval: string; approvalDate: string;
  insuranceEndorsement: string; balancePayment: string; remarks: string;
};

const BLANK_RTO: RTODrawerForm = {
  status: "Pending",
  rtoOwnershipType: "Banker", rtoOwnership: "Pending", rtoReceiving: false,
  challanCheck: "Pending", bankNocCheck: "Pending", insuranceCheck: "Pending",
  hypothecation: "Pending", aadhaarMatch: "Pending", aadhaarMismatchNote: "",
  nocHoldAmt: "0", pendingDocuments: [],
  verification: "Pending", approval: "Pending", approvalDate: "",
  insuranceEndorsement: "Pending", balancePayment: "0", remarks: "",
};

function rtoRecordToForm(r: RTORecord): RTODrawerForm {
  return {
    status:              r.status ?? "Pending",
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
    pendingDocuments:    r.pendingDocuments ?? [],
    verification:        r.verification ?? "Pending",
    approval:            r.approval ?? "Pending",
    approvalDate:        r.approvalDate ? r.approvalDate.substring(0, 10) : "",
    insuranceEndorsement: r.insuranceEndorsement ?? "Pending",
    balancePayment:      String(r.balancePayment ?? 0),
    remarks:             r.remarks ?? "",
  };
}

function rtoFormToBody(f: RTODrawerForm, c: { caseCode: string; customer: { firstName: string; lastName?: string } }) {
  return {
    caseCode:            c.caseCode,
    customerName:        `${c.customer.firstName} ${c.customer.lastName ?? ""}`.trim(),
    status:              f.status,
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
    pendingDocuments:    f.pendingDocuments,
    verification:        f.verification,
    approval:            f.approval,
    approvalDate:        f.approvalDate || undefined,
    insuranceEndorsement: f.insuranceEndorsement,
    balancePayment:      Number(f.balancePayment) || 0,
    remarks:             f.remarks || undefined,
  };
}

type EditForm = {
  firstName: string; lastName: string; fatherName: string; contact: string; altContact: string;
  location: string; state: string; pinCode: string; residentialStatus: string;
  product: string; loanType: string; firm: string; vehicleModel: string; regNumber: string;
  loanAmount: string; bankId: string; bankBranch: string; bmName: string; bmContact: string; bankExecutive: string;
  dealerId: string; payoutPct: string; remarks: string;
  customFields: Record<string, string>;
};

export default function CasesPage() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [products, setProducts] = useState<MasterItem[]>([]);
  const [newCaseProductFields, setNewCaseProductFields] = useState<FieldDef[]>([]);
  const [editProductFields, setEditProductFields] = useState<FieldDef[]>([]);

  // Fetches a product's extra-fields schema by name, returning [] for vehicle
  // products with no custom fields configured (or none at all).
  async function loadProductFields(productName: string): Promise<FieldDef[]> {
    const p = products.find(x => x.name === productName);
    if (!p?.code) return [];
    try {
      const { data } = await formSchemasApi.get(`product-fields:${p.code.toLowerCase()}`);
      return data.sections.flatMap(s => s.fields.filter(f => f.isActive));
    } catch {
      return [];
    }
  }

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bankFilter, setBankFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [firmFilter, setFirmFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // UI state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerCase, setDrawerCase] = useState<LoanCase | null>(null);
  const [drawerTab, setDrawerTab] = useState("overview");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("Sales");
  const [statusGuideOpen, setStatusGuideOpen] = useState(false);

  // Status change
  const [statusChanging, setStatusChanging] = useState(false);

  // New Case modal
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newCaseForm, setNewCaseForm] = useState<EditForm & { status: string }>({
    firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
    location: "", state: "", pinCode: "", residentialStatus: "",
    product: "", loanType: "", firm: "", vehicleModel: "", regNumber: "",
    loanAmount: "", bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
    dealerId: "", payoutPct: "", remarks: "", status: "Sales", customFields: {},
  });
  const [newCaseSaving, setNewCaseSaving] = useState(false);

  // Existing-customer search (New Case modal)
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
    setNewCaseForm(p => ({
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

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
    location: "", state: "", pinCode: "", residentialStatus: "",
    product: "", loanType: "", firm: "", vehicleModel: "", regNumber: "",
    loanAmount: "", bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
    dealerId: "", payoutPct: "", remarks: "", customFields: {},
  });
  const [editSaving, setEditSaving] = useState(false);

  // Inline "add new dealer" from either New Case or Edit Case modal
  const [addDealerOpen, setAddDealerOpen] = useState(false);
  const [newDealer, setNewDealer] = useState({ name: "", contact: "", location: "", address: "" });
  const [savingDealer, setSavingDealer] = useState(false);
  const [dealerTarget, setDealerTarget] = useState<"new" | "edit">("new");

  function openAddDealer(target: "new" | "edit") {
    setDealerTarget(target);
    setNewDealer({ name: "", contact: "", location: "", address: "" });
    setAddDealerOpen(true);
  }

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
      if (dealerTarget === "new") setNewCaseForm(p => ({ ...p, dealerId: data._id }));
      else setEditForm(p => ({ ...p, dealerId: data._id }));
      setAddDealerOpen(false);
      toast("success", `Dealer "${data.name}" added`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to add dealer");
    } finally {
      setSavingDealer(false);
    }
  }

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

  // Document Edit state
  const [editDocData, setEditDocData] = useState<{ id: string; fileName: string; remarks: string } | null>(null);

  // Pipeline state
  const [pipelineSaving, setPipelineSaving] = useState<string | null>(null);

  // RTO state
  const [drawerRTO, setDrawerRTO] = useState<RTORecord | null>(null);
  const [rtoForm, setRtoForm] = useState<RTODrawerForm>({ ...BLANK_RTO });
  const [rtoSaving, setRtoSaving] = useState(false);
  const [rtoSlipUploading, setRtoSlipUploading] = useState(false);

  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [customStatuses, setCustomStatuses] = useState<{ name: string; colorClass?: string }[]>([]);
  const [customRtoStatuses, setCustomRtoStatuses] = useState<{ name: string; colorClass?: string }[]>([]);

  const loadStats = useCallback(async () => {
    try { const { data } = await casesApi.stats(); setStatusCounts(data.statusBreakdown ?? {}); } catch {}
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, meta: m } = await casesApi.listWithMeta({
        page, limit, search: search || undefined,
        status: statusFilter !== "All" ? statusFilter : undefined,
        bankId: bankFilter || undefined,
        product: productFilter || undefined,
        firm: firmFilter || undefined,
      });
      setCases(data as unknown as LoanCase[]);
      if (m) setMeta(m);
      loadStats();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load cases");
    } finally { setLoading(false); }
  }, [page, limit, search, statusFilter, bankFilter, productFilter, firmFilter, toast, loadStats]);

  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);

  const loadRef = useCallback(async () => {
    try {
      const [bl, dl, ul, dtl, citl, stl, csl, rsl, pl] = await Promise.all([
        banksApi.list(), dealersApi.list(),
        usersApi.list({ role: "sales_executive" }), mastersApi.list("document-types"),
        mastersApi.list("cities"), mastersApi.list("states"),
        mastersApi.list("case-statuses"), mastersApi.list("rto-statuses").catch(() => ({ data: [] })),
        mastersApi.list("products").catch(() => ({ data: [] })),
      ]);
      setBanks(bl.data); setDealers(dl.data);
      setSalesUsers(ul.data); setDocTypes(dtl.data.filter((d: any) => d.isActive));
      setCities([...new Set<string>(citl.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort());
      setStates([...new Set<string>(stl.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort());
      setCustomStatuses(csl.data.filter((d: any) => d.isActive).map((d: any) => ({ name: d.name, colorClass: d.colorClass })));
      setCustomRtoStatuses(rsl.data.filter((d: any) => d.isActive).map((d: any) => ({ name: d.name, colorClass: d.colorClass })));
      setProducts(pl.data.filter((d: any) => d.isActive));
    } catch (e: any) { toast("error", "Failed to load references"); }
  }, [toast]);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setRtoForm(drawerRTO ? rtoRecordToForm(drawerRTO) : { ...BLANK_RTO }); }, [drawerRTO]);

  useEffect(() => {
    if (!newCaseForm.product || products.length === 0) { setNewCaseProductFields([]); return; }
    loadProductFields(newCaseForm.product).then(setNewCaseProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCaseForm.product, products]);

  useEffect(() => {
    if (!editForm.product || products.length === 0) { setEditProductFields([]); return; }
    loadProductFields(editForm.product).then(setEditProductFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editForm.product, products]);

  async function openDrawer(c: LoanCase) {
    setDrawerCase(c); setDrawerTab("overview"); setDrawerRTO(null);
    const [actRes, rtoRes] = await Promise.allSettled([
      casesApi.activities(c._id),
      rtoApi.list(c._id),
    ]);
    setActivities(actRes.status === "fulfilled" ? (actRes.value.data as unknown as Activity[]) : []);
    setDrawerRTO(rtoRes.status === "fulfilled" ? (rtoRes.value.data[0] ?? null) : null);
  }

  async function reloadDrawer(id: string) {
    try {
      const [caseRes, actRes, rtoRes] = await Promise.allSettled([
        casesApi.get(id),
        casesApi.activities(id),
        rtoApi.list(id),
      ]);
      if (caseRes.status === "fulfilled") setDrawerCase(caseRes.value.data);
      setActivities(actRes.status === "fulfilled" ? (actRes.value.data as unknown as Activity[]) : []);
      setDrawerRTO(rtoRes.status === "fulfilled" ? (rtoRes.value.data[0] ?? null) : null);
    } catch {}
  }

  // ── Status change (admin, any → any) ──────────────────────────────
  async function changeStatus(newStatus: string) {
    if (!drawerCase || newStatus === drawerCase.status) return;
    setStatusChanging(true);
    try {
      const { data } = await casesApi.updateStatus(drawerCase._id, { status: newStatus });
      setDrawerCase(data);
      toast("success", `Status changed to ${newStatus}`);
      load();
      casesApi.activities(drawerCase._id).then(r => setActivities(r.data as unknown as Activity[])).catch(() => {});
    } catch (e: any) { toast("error", e.message ?? "Failed to change status"); }
    finally { setStatusChanging(false); }
  }

  // ── Pipeline stage toggle ──────────────────────────────────────────
  async function togglePipelineStage(stage: string, current: PipelineItem | undefined) {
    if (!drawerCase) return;
    const next = !current || current.status === "Pending" ? "Done" : "Pending";
    setPipelineSaving(stage);
    try {
      const { data } = await casesApi.updatePipelineStage(drawerCase._id, stage, { status: next });
      setDrawerCase(data);
      if (data.status === "Disbursed" && drawerCase.status !== "Disbursed") {
        toast("success", "All stages complete — case auto-disbursed!");
        load();
      }
    } catch (e: any) { toast("error", e.message ?? "Failed to update stage"); }
    finally { setPipelineSaving(null); }
  }

  async function saveRTO() {
    if (!drawerCase) return;
    setRtoSaving(true);
    try {
      const { data } = await rtoApi.upsertByCase(drawerCase._id, rtoFormToBody(rtoForm, drawerCase));
      setDrawerRTO(data);
      toast("success", "RTO saved");
    } catch (e: any) { toast("error", e.message ?? "Failed to save RTO"); }
    finally { setRtoSaving(false); }
  }

  async function uploadRTOSlip(file: File) {
    if (!drawerRTO) { toast("error", "Save RTO details first before uploading the slip"); return; }
    setRtoSlipUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await rtoApi.uploadSlip(drawerRTO._id, fd);
      setDrawerRTO(data);
      toast("success", "RTO slip uploaded");
    } catch (e: any) { toast("error", e.message ?? "Upload failed"); }
    finally { setRtoSlipUploading(false); }
  }

  // ── Assign case ────────────────────────────────────────────────────
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
      load();
    } catch (e: any) { toast("error", e.message ?? "Failed to assign"); }
  }

  // ── Edit case ──────────────────────────────────────────────────────
  function openEditModal(c: LoanCase) {
    setEditForm({
      firstName: c.customer.firstName ?? "", lastName: c.customer.lastName ?? "",
      fatherName: c.customer.fatherName ?? "", contact: c.customer.contact ?? "",
      altContact: c.customer.altContact ?? "", location: c.customer.location ?? "",
      state: c.customer.state ?? "",
      pinCode: c.customer.pinCode ?? "", residentialStatus: c.customer.residentialStatus ?? "",
      product: c.product ?? "", loanType: (c as any).loanType ?? "", firm: (c as any).firm ?? "",
      vehicleModel: (c as any).vehicleModel ?? "", regNumber: (c as any).regNumber ?? "",
      loanAmount: c.loanAmount ? String(c.loanAmount) : "",
      bankId: c.bankId ?? "", bankBranch: c.bankBranch ?? "",
      bmName: c.bmName ?? "", bmContact: c.bmContact ?? "", bankExecutive: c.bankExecutive ?? "",
      dealerId: c.dealerId ?? "", payoutPct: c.payoutPct !== undefined ? String(c.payoutPct) : "",
      remarks: c.remarks ?? "",
      customFields: Object.fromEntries(Object.entries(c.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")])),
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
          state: editForm.state || undefined,
          pinCode: editForm.pinCode || undefined, residentialStatus: editForm.residentialStatus || undefined,
        },
        product: editForm.product || undefined, loanType: editForm.loanType || undefined, firm: editForm.firm || undefined,
        vehicleModel: editForm.vehicleModel || undefined, regNumber: editForm.regNumber || undefined,
        loanAmount: editForm.loanAmount ? Number(editForm.loanAmount) : undefined,
        bankId: editForm.bankId || undefined, bankBranch: editForm.bankBranch || undefined,
        bmName: editForm.bmName || undefined, bmContact: editForm.bmContact || undefined,
        bankExecutive: editForm.bankExecutive || undefined,
        dealerId: editForm.dealerId || undefined,
        payoutPct: editForm.payoutPct ? Number(editForm.payoutPct) : undefined,
        remarks: editForm.remarks || undefined,
        customFields: buildCustomFieldsPayload(editProductFields, editForm.customFields),
      });
      setDrawerCase(data);
      toast("success", "Case updated successfully");
      setEditOpen(false);
      load(); reloadDrawer(drawerCase._id);
    } catch (e: any) { toast("error", e.message ?? "Failed to update case"); }
    finally { setEditSaving(false); }
  }

  // ── New Case ───────────────────────────────────────────────────────
  async function saveNewCase() {
    const f = newCaseForm;
    if (!f.firstName.trim()) { toast("error", "First name is required"); return; }
    if (!f.contact.trim()) { toast("error", "Contact number is required"); return; }
    setNewCaseSaving(true);
    try {
      await casesApi.create({
        status: f.status || "Sales",
        customer: {
          firstName: f.firstName, lastName: f.lastName || undefined,
          fatherName: f.fatherName || undefined, contact: f.contact,
          altContact: f.altContact || undefined, location: f.location || undefined,
          state: f.state || undefined, pinCode: f.pinCode || undefined,
          residentialStatus: f.residentialStatus || undefined,
        },
        product: f.product || undefined, loanType: f.loanType || undefined, firm: f.firm || undefined,
        vehicleModel: f.vehicleModel || undefined, regNumber: f.regNumber || undefined,
        loanAmount: f.loanAmount ? Number(f.loanAmount) : undefined,
        bankId: f.bankId || undefined, bankBranch: f.bankBranch || undefined,
        bmName: f.bmName || undefined, bmContact: f.bmContact || undefined,
        bankExecutive: f.bankExecutive || undefined,
        dealerId: f.dealerId || undefined,
        payoutPct: f.payoutPct ? Number(f.payoutPct) : undefined,
        remarks: f.remarks || undefined,
        customFields: buildCustomFieldsPayload(newCaseProductFields, f.customFields),
      });
      toast("success", "Case created successfully");
      setNewCaseOpen(false);
      setNewCaseForm({
        firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
        location: "", state: "", pinCode: "", residentialStatus: "",
        product: "", loanType: "", firm: "", vehicleModel: "", regNumber: "",
        loanAmount: "", bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
        dealerId: "", payoutPct: "", remarks: "", status: "Sales", customFields: {},
      });
      clearSelectedCustomer();
      load();
    } catch (e: any) { toast("error", e.message ?? "Failed to create case"); }
    finally { setNewCaseSaving(false); }
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
      load(); reloadDrawer(drawerCase._id);
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
      load(); reloadDrawer(drawerCase._id);
    } catch (e: any) { toast("error", e.message ?? "Upload failed"); }
    finally { setUpSaving(false); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!drawerCase || !confirm("Are you sure you want to delete this document?")) return;
    try {
      const { data } = await casesApi.deleteDoc(drawerCase._id, docId);
      setDrawerCase(data); toast("success", "Document deleted");
      load(); reloadDrawer(drawerCase._id);
    } catch (e: any) { toast("error", e.message ?? "Failed to delete document"); }
  }

  async function handleEditDocSubmit() {
    if (!drawerCase || !editDocData) return;
    try {
      const { data } = await casesApi.editDoc(drawerCase._id, editDocData.id, {
        fileName: editDocData.fileName,
        remarks: editDocData.remarks,
      });
      setDrawerCase(data); toast("success", "Document updated");
      setEditDocData(null);
      load(); reloadDrawer(drawerCase._id);
    } catch (e: any) { toast("error", e.message ?? "Failed to update document"); }
  }

  async function resolveRequest(reqId: string) {
    if (!drawerCase) return;
    try {
      const { data } = await casesApi.resolveDocRequest(drawerCase._id, reqId);
      setDrawerCase(data); toast("success", "Request resolved");
      load(); reloadDrawer(drawerCase._id);
    } catch (e: any) { toast("error", e.message ?? "Failed to resolve"); }
  }

  const hasFilters = bankFilter || productFilter || firmFilter;
  const allStatuses: string[] = [
    ...CASE_STATUSES,
    ...customStatuses.filter((c) => !CASE_STATUSES.includes(c.name as any)).map((c) => c.name),
  ];
  const customStatusColorMap: Record<string, string | undefined> = Object.fromEntries(
    customStatuses.map((c) => [c.name, c.colorClass])
  );
  const allRtoStatuses: string[] = [
    ...RTO_STATUSES,
    ...customRtoStatuses.filter((c) => !(RTO_STATUSES as string[]).includes(c.name)).map((c) => c.name),
  ];
  const customRtoStatusColorMap: Record<string, string | undefined> = Object.fromEntries(
    customRtoStatuses.map((c) => [c.name, c.colorClass])
  );
  const statusTabs = [
    { id: "All", label: "All", count: meta.total },
    ...allStatuses.map((s) => ({ id: s, label: s, count: statusCounts[s] ?? 0 })),
  ];
  const allSelected = cases.length > 0 && cases.every((c) => selectedIds.has(c._id));
  function toggleAll() {
    if (allSelected) { const n = new Set(selectedIds); cases.forEach((c) => n.delete(c._id)); setSelectedIds(n); }
    else { const n = new Set(selectedIds); cases.forEach((c) => n.add(c._id)); setSelectedIds(n); }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted mt-0.5">Track and manage all loan cases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"><Download className="size-3.5" /> Export</Button>
          <Button size="sm" onClick={() => { clearSelectedCustomer(); setNewCaseOpen(true); }}><FileText className="size-3.5" /> New Case</Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary-subtle border border-primary/20 rounded-lg animate-fadeIn">
          <span className="text-sm font-medium text-primary">{selectedIds.size} selected</span>
          <Button variant="outline" size="xs" onClick={() => setBulkModalOpen(true)}>Update Status</Button>
          <Button variant="ghost" size="xs" onClick={() => setSelectedIds(new Set())} className="ml-auto"><X className="size-3" /> Clear</Button>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border flex-wrap">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name or case ID…" className="w-64" />
          <Button variant={filterOpen ? "outline" : "secondary"} size="sm" onClick={() => setFilterOpen((o) => !o)}>
            <Filter className="size-3.5" /> Filters
            {hasFilters && <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">!</span>}
          </Button>
          {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setBankFilter(""); setProductFilter(""); setFirmFilter(""); }}><X className="size-3" /> Clear</Button>}
          <button
            onClick={() => setStatusGuideOpen(true)}
            title="How statuses work"
            className="ml-auto size-7 grid place-items-center rounded-full text-muted hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <Info className="size-4" />
          </button>
        </div>

        {filterOpen && (
          <div className="flex flex-wrap gap-3 px-4 py-3 bg-surface-2 border-b border-border animate-fadeIn">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label>Bank</Label>
              <Select className="!h-8 text-xs" value={bankFilter} onChange={(e) => { setBankFilter(e.target.value); setPage(1); }}>
                <option value="">All Banks</option>
                {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label>Product</Label>
              <Select className="!h-8 text-xs" value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}>
                <option value="">All Products</option>
                {products.map((p) => <option key={p._id} value={p.name}>{p.name}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[180px]">
              <Label>Firm</Label>
              <Select className="!h-8 text-xs" value={firmFilter} onChange={(e) => { setFirmFilter(e.target.value); setPage(1); }}>
                <option value="">All Firms</option>
                {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Tabs tabs={statusTabs} active={statusFilter} onChange={(id) => { setStatusFilter(id); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" /></th>
                <th>Case ID</th><th>Date</th><th>Customer</th><th>Product</th>
                <th>Bank</th><th>Loan Amount</th><th>Status</th><th>Disbursed</th><th>Assigned To</th><th>Coordinator</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 12 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : cases.length === 0 ? (
                <tr><td colSpan={12}><EmptyState icon={FileText} title="No cases found" description="Try adjusting the filters or search term." /></td></tr>
              ) : cases.map((c) => (
                <tr
                  key={c._id} className="cursor-pointer" onClick={() => openDrawer(c)}
                  style={{ borderLeft: c.status === "Incomplete" ? "3px solid var(--orange)" : undefined }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(c._id)} onChange={() => { const n = new Set(selectedIds); n.has(c._id) ? n.delete(c._id) : n.add(c._id); setSelectedIds(n); }} className="cursor-pointer" />
                  </td>
                  <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                  <td className="text-xs text-muted">{fmtDate(c.date)}</td>
                  <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                  <td className="text-xs text-foreground-secondary">{c.product}</td>
                  <td className="text-xs text-foreground-secondary">{c.bankName ?? "—"}</td>
                  <td className="font-mono text-xs font-semibold">{fmt(c.loanAmount)}</td>
                  <td><CaseStatusBadge status={c.status} colorClass={customStatusColorMap[c.status]} /></td>
                  <td className="text-xs text-muted">{fmtDate(c.disbursementDate)}</td>
                  <td className="text-xs font-medium">
                    {c.assignedToName
                      ? <span className="flex items-center gap-1 text-foreground-secondary"><UserCheck className="size-3 text-teal" />{c.assignedToName}</span>
                      : <span className="text-muted/60">Unassigned</span>}
                  </td>
                  <td className="text-xs font-medium">
                    {c.coordinatorName
                      ? <span className="flex items-center gap-1 text-foreground-secondary"><UserCheck className="size-3 text-primary" />{c.coordinatorName}</span>
                      : <span className="text-muted/60">—</span>}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openDrawer(c)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Eye className="size-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={meta.page} totalPages={meta.totalPages || 1} total={meta.total} limit={meta.limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} />
      </div>

      {/* ── Case detail drawer ─────────────────────────────────────── */}
      <Drawer
        open={!!drawerCase}
        onClose={() => setDrawerCase(null)}
        title={drawerCase?.caseCode ?? ""}
        subtitle={drawerCase ? `${drawerCase.customer.firstName} ${drawerCase.customer.lastName} · ${drawerCase.product}` : undefined}
        width="max-w-3xl"
      >
        {drawerCase && (
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
                  {/* Status + Assign row */}
                  <div className="flex items-end justify-between gap-4">
                    {/* Status change — admin can pick any */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Status</p>
                      <div className="flex items-center gap-2">
                        <CaseStatusBadge status={drawerCase.status} colorClass={customStatusColorMap[drawerCase.status]} />
                        <Select
                          className="h-7 text-xs w-36"
                          value={drawerCase.status}
                          onChange={(e) => changeStatus(e.target.value)}
                          disabled={statusChanging}
                        >
                          {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                    </div>

                    {/* Assign + Edit */}
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
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Coordinator</p>
                        <p className="h-8 flex items-center text-sm font-medium">
                          {drawerCase.coordinatorName ?? <span className="text-muted/60">—</span>}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => openEditModal(drawerCase)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                    </div>
                  </div>

                  {/* Fields grid — matching screenshot style */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {[
                      { label: "Customer", value: `${drawerCase.customer.firstName} ${drawerCase.customer.lastName}`, icon: Users },
                      { label: "Contact", value: drawerCase.customer.contact, icon: Users },
                      { label: "Product", value: drawerCase.product ?? "—", icon: FileText },
                      { label: "Firm", value: drawerCase.firm ?? "—", icon: Building2 },
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
                            isDone
                              ? "bg-teal border-teal text-white"
                              : "border-border hover:border-primary"
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
                                    <a href={doc.url.startsWith('http') ? doc.url : API_BASE.replace('/api/v1', '') + doc.url} target="_blank" rel="noreferrer" className="hover:underline">
                                      {doc.fileName}
                                    </a>
                                  ) : (
                                    doc.fileName
                                  )}
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
              {drawerTab === "rto" && (
                <div className="animate-fadeIn space-y-5">
                  {/* ── Status ── */}
                  <section className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">RTO Status</p>
                    <div className="flex items-center gap-3">
                      <Select className="w-64" value={rtoForm.status} onChange={e => setRtoForm(f => ({ ...f, status: e.target.value }))}>
                        {allRtoStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                      <CaseStatusBadge status={rtoForm.status} colorClass={customRtoStatusColorMap[rtoForm.status]} />
                    </div>
                  </section>

                  {/* ── Ownership ── */}
                  <section className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Ownership</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Ownership Type</Label>
                        <Select value={rtoForm.rtoOwnershipType} onChange={e => setRtoForm(f => ({ ...f, rtoOwnershipType: e.target.value }))}>
                          {RTO_OWNERSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label>RTO Ownership</Label>
                        <Select value={rtoForm.rtoOwnership} onChange={e => setRtoForm(f => ({ ...f, rtoOwnership: e.target.value }))}>
                          {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="rto-recv" checked={rtoForm.rtoReceiving} onChange={e => setRtoForm(f => ({ ...f, rtoReceiving: e.target.checked }))} className="size-4 rounded" />
                      <label htmlFor="rto-recv" className="text-sm font-medium cursor-pointer">RTO Receiving</label>
                    </div>
                  </section>

                  {/* ── Document Checklist ── */}
                  <section className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Document Checklist</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ["challanCheck",   "Challan Check"],
                        ["bankNocCheck",   "Bank NOC"],
                        ["insuranceCheck", "Insurance Check"],
                        ["hypothecation",  "Hypothecation"],
                        ["aadhaarMatch",   "Aadhaar Match"],
                      ] as [keyof RTODrawerForm, string][]).map(([key, label]) => (
                        <div key={key}>
                          <Label>{label}</Label>
                          <Select value={rtoForm[key] as string} onChange={e => setRtoForm(f => ({ ...f, [key]: e.target.value }))}>
                            {CHECKLIST_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                          </Select>
                        </div>
                      ))}
                      <div>
                        <Label>Aadhaar Mismatch Note</Label>
                        <Input value={rtoForm.aadhaarMismatchNote} onChange={e => setRtoForm(f => ({ ...f, aadhaarMismatchNote: e.target.value }))} placeholder="Optional note" />
                      </div>
                    </div>
                  </section>

                  {/* ── Pending Docs + Financials ── */}
                  <section className="space-y-3">
                    <div>
                      <Label>Pending Documents</Label>
                      <div className="grid grid-cols-2 gap-1.5 mt-1 max-h-36 overflow-y-auto border border-border rounded-md p-2 bg-surface">
                        {docTypes.map(dt => {
                          const checked = rtoForm.pendingDocuments.includes(dt.name);
                          return (
                            <label key={dt._id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-surface-2 select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => setRtoForm(f => ({
                                  ...f,
                                  pendingDocuments: checked
                                    ? f.pendingDocuments.filter(x => x !== dt.name)
                                    : [...f.pendingDocuments, dt.name],
                                }))}
                              />
                              {dt.name}
                            </label>
                          );
                        })}
                        {docTypes.length === 0 && <p className="text-xs text-muted col-span-2 py-1">No document types configured.</p>}
                      </div>
                      {rtoForm.pendingDocuments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rtoForm.pendingDocuments.map(name => (
                            <span key={name} className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning-subtle text-warning border border-warning-border">
                              {name}
                              <button type="button" onClick={() => setRtoForm(f => ({ ...f, pendingDocuments: f.pendingDocuments.filter(x => x !== name) }))} className="ml-0.5 hover:text-red-500">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>NOC Hold (₹)</Label>
                        <Input type="number" value={rtoForm.nocHoldAmt} onChange={e => setRtoForm(f => ({ ...f, nocHoldAmt: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Balance Payment (₹)</Label>
                        <Input type="number" value={rtoForm.balancePayment} onChange={e => setRtoForm(f => ({ ...f, balancePayment: e.target.value }))} />
                      </div>
                    </div>
                  </section>

                  {/* ── Verification & Approval ── */}
                  <section className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Verification & Approval</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Verification</Label>
                        <Select value={rtoForm.verification} onChange={e => setRtoForm(f => ({ ...f, verification: e.target.value }))}>
                          {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label>Approval</Label>
                        <Select value={rtoForm.approval} onChange={e => setRtoForm(f => ({ ...f, approval: e.target.value }))}>
                          {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                      <div>
                        <Label>Approval Date</Label>
                        <Input type="date" value={rtoForm.approvalDate} onChange={e => setRtoForm(f => ({ ...f, approvalDate: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Insurance Endorsement</Label>
                        <Select value={rtoForm.insuranceEndorsement} onChange={e => setRtoForm(f => ({ ...f, insuranceEndorsement: e.target.value }))}>
                          {STAGE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                      </div>
                    </div>
                  </section>

                  {/* ── RTO Slip ── */}
                  <section className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">RTO Slip</p>
                    <div className="flex items-center gap-3 flex-wrap">
                      {drawerRTO?.rtoSlipUrl ? (
                        <a href={drawerRTO.rtoSlipUrl.startsWith("http") ? drawerRTO.rtoSlipUrl : API_BASE.replace("/api/v1", "") + drawerRTO.rtoSlipUrl}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                          <ExternalLink className="size-3.5" /> {drawerRTO.rtoSlipFileName ?? "View Slip"}
                        </a>
                      ) : (
                        <span className="text-xs text-muted italic">No slip uploaded</span>
                      )}
                      <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${rtoSlipUploading ? "opacity-50 pointer-events-none" : "border-border hover:border-primary hover:text-primary"}`}>
                        <Upload className="size-3" />
                        {rtoSlipUploading ? "Uploading…" : "Upload Slip"}
                        <input type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) uploadRTOSlip(f); }} />
                      </label>
                    </div>
                  </section>

                  {/* ── Remarks + Save ── */}
                  <section>
                    <Label>Remarks</Label>
                    <textarea
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[60px] mb-3"
                      value={rtoForm.remarks}
                      onChange={e => setRtoForm(f => ({ ...f, remarks: e.target.value }))}
                      placeholder="Optional remarks"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" loading={rtoSaving} onClick={saveRTO}>
                        <Save className="size-3.5" /> {drawerRTO ? "Update RTO" : "Save RTO"}
                      </Button>
                    </div>
                  </section>
                </div>
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

      {/* ── Bulk Status Update ─────────────────────────────────────── */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Bulk Update Status" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">Update status for {selectedIds.size} selected cases.</p>
          <div><Label>New Status</Label><Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>{allStatuses.map((s) => <option key={s}>{s}</option>)}</Select></div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setBulkModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => { setBulkModalOpen(false); setSelectedIds(new Set()); }}>Update {selectedIds.size} Cases</Button>
          </div>
        </div>
      </Modal>

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
          <div>
            <Label>Document Type *</Label>
            <Select value={upDocType} onChange={(e) => setUpDocType(e.target.value)}>
              <option value="">Select document type...</option>
              {docTypes.map((dt) => <option key={dt._id} value={dt.name}>{dt.name}</option>)}
            </Select>
          </div>
          <div>
            <Label>File Name *</Label>
            <Input value={upFileName} onChange={(e) => setUpFileName(e.target.value)} placeholder="e.g. aadhaar_card.pdf" />
          </div>
          <div>
            <Label>File *</Label>
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

      {/* ── Edit Case Modal (full details) ────────────────────────── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Case Details" size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">

          {/* Customer */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Customer Information</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>First Name *</Label><Input value={editForm.firstName} onChange={(e) => setEditForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" /></div>
              <div><Label>Last Name *</Label><Input value={editForm.lastName} onChange={(e) => setEditForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" /></div>
              <div><Label>Father's Name</Label><Input value={editForm.fatherName} onChange={(e) => setEditForm(p => ({ ...p, fatherName: e.target.value }))} placeholder="Father's name" /></div>
              <div><Label>Contact *</Label><Input value={editForm.contact} onChange={(e) => setEditForm(p => ({ ...p, contact: e.target.value }))} placeholder="+91…" /></div>
              <div><Label>Alt Contact</Label><Input value={editForm.altContact} onChange={(e) => setEditForm(p => ({ ...p, altContact: e.target.value }))} placeholder="Alt number" /></div>
              <div>
                <Label>State</Label>
                <Select value={editForm.state} onChange={(e) => setEditForm(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select state…</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>City</Label>
                {cities.length > 0 ? (
                  <Select value={editForm.location} onChange={(e) => setEditForm(p => ({ ...p, location: e.target.value }))}>
                    <option value="">Select city…</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
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

          {/* Loan Details */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Loan Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Firm</Label>
                <Select value={editForm.firm} onChange={(e) => setEditForm(p => ({ ...p, firm: e.target.value }))}>
                  <option value="">Select…</option>
                  {FIRMS.map(f => <option key={f}>{f}</option>)}
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select value={editForm.product} onChange={(e) => setEditForm(p => ({ ...p, product: e.target.value }))}>
                  <option value="">Select…</option>
                  {products.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                </Select>
              </div>
              <div><Label>Loan Amount</Label><Input type="number" value={editForm.loanAmount} onChange={(e) => setEditForm(p => ({ ...p, loanAmount: e.target.value }))} placeholder="0" /></div>
              {isVehicleProduct(editForm.product) && (
                <>
                  <div>
                    <Label>Loan Type</Label>
                    <Select value={editForm.loanType} onChange={(e) => setEditForm(p => ({ ...p, loanType: e.target.value }))}>
                      <option value="">Select…</option>
                      {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div><Label>Vehicle Model</Label><Input value={editForm.vehicleModel} onChange={(e) => setEditForm(p => ({ ...p, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" /></div>
                  <div><Label>Reg Number</Label><Input value={editForm.regNumber} onChange={(e) => setEditForm(p => ({ ...p, regNumber: e.target.value }))} placeholder="e.g. DL01AB1234" /></div>
                </>
              )}
              {editProductFields.map(field => (
                <div key={field.key}>
                  <Label>{field.label}</Label>
                  <ProductDynField
                    field={field}
                    value={editForm.customFields[field.key] ?? ""}
                    onChange={v => setEditForm(p => ({ ...p, customFields: { ...p.customFields, [field.key]: v } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bank & Dealer */}
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
              <div><Label>Branch</Label><Input value={editForm.bankBranch} onChange={(e) => setEditForm(p => ({ ...p, bankBranch: e.target.value }))} placeholder="Branch name" /></div>
              <div><Label>BM Name</Label><Input value={editForm.bmName} onChange={(e) => setEditForm(p => ({ ...p, bmName: e.target.value }))} placeholder="Business Manager" /></div>
              <div><Label>BM Contact</Label><Input value={editForm.bmContact} onChange={(e) => setEditForm(p => ({ ...p, bmContact: e.target.value }))} placeholder="+91…" /></div>
              <div><Label>Bank Executive</Label><Input value={editForm.bankExecutive} onChange={(e) => setEditForm(p => ({ ...p, bankExecutive: e.target.value }))} placeholder="Executive name" /></div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Dealer</Label>
                  <button type="button" onClick={() => openAddDealer("edit")} className="text-[11px] font-semibold text-primary hover:underline">
                    + Add new dealer
                  </button>
                </div>
                <Select value={editForm.dealerId} onChange={(e) => setEditForm(p => ({ ...p, dealerId: e.target.value }))}>
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>Payout %</Label><Input type="number" min="0" max="100" value={editForm.payoutPct} onChange={(e) => setEditForm(p => ({ ...p, payoutPct: e.target.value }))} placeholder="0" /></div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[70px] mt-1"
              value={editForm.remarks} onChange={(e) => setEditForm(p => ({ ...p, remarks: e.target.value }))}
              placeholder="Any additional remarks..."
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button size="sm" loading={editSaving} onClick={saveEdit}>Save Changes</Button>
        </div>
      </Modal>

      {/* Edit Document Modal */}
      <Modal open={!!editDocData} onClose={() => setEditDocData(null)} title="Edit Document" size="sm">
        {editDocData && (
          <div className="space-y-4">
            <div>
              <Label>File Name</Label>
              <Input value={editDocData.fileName} onChange={(e) => setEditDocData({ ...editDocData, fileName: e.target.value })} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={editDocData.remarks} onChange={(e) => setEditDocData({ ...editDocData, remarks: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setEditDocData(null)}>Cancel</Button>
              <Button size="sm" onClick={handleEditDocSubmit}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Status guide dialog */}
      <Modal open={statusGuideOpen} onClose={() => setStatusGuideOpen(false)} title="Case Status Reference" size="xl">
        <div className="space-y-4">
          {/* Flow strip */}
          <div className="rounded-lg bg-surface-2 border border-border px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Main Flow</p>
            <div className="flex items-center flex-wrap gap-1">
              {["Draft", "Sales", "Pending", "In Credit", "Approved", "Disbursed"].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-1">
                  <CaseStatusBadge status={s as CaseStatus} />
                  {i < arr.length - 1 && <span className="text-muted text-xs">→</span>}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2">
              Side exits available from most stages: &nbsp;
              <span className="font-mono">Incomplete ↔ Pending</span> &nbsp;·&nbsp;
              <span className="font-mono">Hold · Rejected · Cancelled</span>
            </p>
          </div>

          {/* Status cards — 2 columns */}
          <div className="grid grid-cols-2 gap-2">
            {STATUS_GUIDE.map((s) => (
              <div key={s.status} className="flex gap-3 p-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors">
                <span className={`mt-1 shrink-0 size-2 rounded-full ${s.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-sm leading-tight">{s.status}</p>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${s.chip}`}>{s.tag}</span>
                  </div>
                  <p className="text-xs text-muted leading-snug">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ── New Case Modal ─────────────────────────────────────────── */}
      <Modal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} title="New Case" size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">

          {/* Status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Initial Status</p>
            <div className="w-48">
              <Label>Status</Label>
              <Select value={newCaseForm.status} onChange={(e) => setNewCaseForm(p => ({ ...p, status: e.target.value }))}>
                {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>

          {/* Customer */}
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

            <div className="grid grid-cols-3 gap-3">
              <div><Label>First Name *</Label><Input value={newCaseForm.firstName} onChange={(e) => setNewCaseForm(p => ({ ...p, firstName: e.target.value }))} placeholder="First name" /></div>
              <div><Label>Last Name</Label><Input value={newCaseForm.lastName} onChange={(e) => setNewCaseForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Last name" /></div>
              <div><Label>Father's Name</Label><Input value={newCaseForm.fatherName} onChange={(e) => setNewCaseForm(p => ({ ...p, fatherName: e.target.value }))} placeholder="Father's name" /></div>
              <div><Label>Contact *</Label><Input value={newCaseForm.contact} onChange={(e) => setNewCaseForm(p => ({ ...p, contact: e.target.value }))} placeholder="+91…" /></div>
              <div><Label>Alt Contact</Label><Input value={newCaseForm.altContact} onChange={(e) => setNewCaseForm(p => ({ ...p, altContact: e.target.value }))} placeholder="Alt number" /></div>
              <div>
                <Label>State</Label>
                <Select value={newCaseForm.state} onChange={(e) => setNewCaseForm(p => ({ ...p, state: e.target.value }))}>
                  <option value="">Select state…</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label>City</Label>
                {cities.length > 0 ? (
                  <Select value={newCaseForm.location} onChange={(e) => setNewCaseForm(p => ({ ...p, location: e.target.value }))}>
                    <option value="">Select city…</option>
                    {cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                ) : (
                  <Input value={newCaseForm.location} onChange={(e) => setNewCaseForm(p => ({ ...p, location: e.target.value }))} placeholder="City / Area" />
                )}
              </div>
              <div><Label>Pin Code</Label><Input value={newCaseForm.pinCode} onChange={(e) => setNewCaseForm(p => ({ ...p, pinCode: e.target.value }))} placeholder="6-digit PIN" /></div>
              <div>
                <Label>Residential Status</Label>
                <Select value={newCaseForm.residentialStatus} onChange={(e) => setNewCaseForm(p => ({ ...p, residentialStatus: e.target.value }))}>
                  <option value="">Select…</option>
                  <option>Own</option><option>Rented</option><option>Family Owned</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Loan Details */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Loan Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Firm</Label>
                <Select value={newCaseForm.firm} onChange={(e) => setNewCaseForm(p => ({ ...p, firm: e.target.value }))}>
                  <option value="">Select…</option>
                  {FIRMS.map(f => <option key={f}>{f}</option>)}
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select value={newCaseForm.product} onChange={(e) => setNewCaseForm(p => ({ ...p, product: e.target.value }))}>
                  <option value="">Select…</option>
                  {products.map(p => <option key={p._id} value={p.name}>{p.name}</option>)}
                </Select>
              </div>
              <div><Label>Loan Amount</Label><Input type="number" value={newCaseForm.loanAmount} onChange={(e) => setNewCaseForm(p => ({ ...p, loanAmount: e.target.value }))} placeholder="0" /></div>
              {isVehicleProduct(newCaseForm.product) && (
                <>
                  <div>
                    <Label>Loan Type</Label>
                    <Select value={newCaseForm.loanType} onChange={(e) => setNewCaseForm(p => ({ ...p, loanType: e.target.value }))}>
                      <option value="">Select…</option>
                      {LOAN_TYPES.map(t => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div><Label>Vehicle Model</Label><Input value={newCaseForm.vehicleModel} onChange={(e) => setNewCaseForm(p => ({ ...p, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" /></div>
                  <div><Label>Reg Number</Label><Input value={newCaseForm.regNumber} onChange={(e) => setNewCaseForm(p => ({ ...p, regNumber: e.target.value }))} placeholder="e.g. DL01AB1234" /></div>
                </>
              )}
              {newCaseProductFields.map(field => (
                <div key={field.key}>
                  <Label>{field.label}</Label>
                  <ProductDynField
                    field={field}
                    value={newCaseForm.customFields[field.key] ?? ""}
                    onChange={v => setNewCaseForm(p => ({ ...p, customFields: { ...p.customFields, [field.key]: v } }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bank & Dealer */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Bank & Dealer</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Bank</Label>
                <Select value={newCaseForm.bankId} onChange={(e) => setNewCaseForm(p => ({ ...p, bankId: e.target.value }))}>
                  <option value="">Select bank…</option>
                  {banks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </Select>
              </div>
              <div><Label>Branch</Label><Input value={newCaseForm.bankBranch} onChange={(e) => setNewCaseForm(p => ({ ...p, bankBranch: e.target.value }))} placeholder="Branch name" /></div>
              <div><Label>BM Name</Label><Input value={newCaseForm.bmName} onChange={(e) => setNewCaseForm(p => ({ ...p, bmName: e.target.value }))} placeholder="Business Manager" /></div>
              <div><Label>BM Contact</Label><Input value={newCaseForm.bmContact} onChange={(e) => setNewCaseForm(p => ({ ...p, bmContact: e.target.value }))} placeholder="+91…" /></div>
              <div><Label>Bank Executive</Label><Input value={newCaseForm.bankExecutive} onChange={(e) => setNewCaseForm(p => ({ ...p, bankExecutive: e.target.value }))} placeholder="Executive name" /></div>
              <div>
                <div className="flex items-center justify-between">
                  <Label>Dealer</Label>
                  <button type="button" onClick={() => openAddDealer("new")} className="text-[11px] font-semibold text-primary hover:underline">
                    + Add new dealer
                  </button>
                </div>
                <Select value={newCaseForm.dealerId} onChange={(e) => setNewCaseForm(p => ({ ...p, dealerId: e.target.value }))}>
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>Payout %</Label><Input type="number" min="0" max="100" value={newCaseForm.payoutPct} onChange={(e) => setNewCaseForm(p => ({ ...p, payoutPct: e.target.value }))} placeholder="0" /></div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <Label>Remarks</Label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:ring-1 focus:ring-primary focus:outline-none min-h-[70px] mt-1"
              value={newCaseForm.remarks} onChange={(e) => setNewCaseForm(p => ({ ...p, remarks: e.target.value }))}
              placeholder="Any additional remarks..."
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setNewCaseOpen(false)}>Cancel</Button>
          <Button size="sm" loading={newCaseSaving} onClick={saveNewCase}>Create Case</Button>
        </div>
      </Modal>

      {/* ── Add New Dealer Modal (inline from New Case / Edit Case) ──── */}
      <Modal open={addDealerOpen} onClose={() => setAddDealerOpen(false)} title="Add New Dealer" size="sm">
        <div className="space-y-3">
          <div>
            <Label>Dealer Name *</Label>
            <Input value={newDealer.name} onChange={(e) => setNewDealer(f => ({ ...f, name: e.target.value }))} placeholder="e.g. City Motors Pvt Ltd" />
          </div>
          <div>
            <Label>Contact</Label>
            <Input value={newDealer.contact} onChange={(e) => setNewDealer(f => ({ ...f, contact: e.target.value }))} placeholder="+91…" />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={newDealer.location} onChange={(e) => setNewDealer(f => ({ ...f, location: e.target.value }))} placeholder="City / Area" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={newDealer.address} onChange={(e) => setNewDealer(f => ({ ...f, address: e.target.value }))} placeholder="Full address" />
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

const STATUS_GUIDE = [
  { status: "Draft",      dot: "bg-neutral-400",  tag: "Start",    chip: "bg-neutral-100 text-neutral-500",     note: "Case saved but not yet submitted. Incomplete info is allowed." },
  { status: "Sales",      dot: "bg-blue-400",     tag: "Active",   chip: "bg-blue-50 text-blue-600",            note: "Submitted by sales, awaiting review by the operations team." },
  { status: "Pending",    dot: "bg-yellow-400",   tag: "Active",   chip: "bg-yellow-50 text-yellow-700",        note: "Under review by operations or credit. Awaiting further action." },
  { status: "In Credit",  dot: "bg-purple-400",   tag: "Active",   chip: "bg-purple-50 text-purple-600",        note: "File sent to the bank's credit department for sanctioning." },
  { status: "Incomplete", dot: "bg-orange-400",   tag: "Action",   chip: "bg-orange-50 text-orange-600",        note: "Documents missing or deficient. Sales must upload and resubmit." },
  { status: "Approved",   dot: "bg-green-400",    tag: "Active",   chip: "bg-green-50 text-green-700",          note: "Loan sanctioned by the bank. Awaiting disbursement." },
  { status: "Disbursed",  dot: "bg-emerald-500",  tag: "Closed",   chip: "bg-emerald-50 text-emerald-700",      note: "Loan disbursed to the customer. Case closed successfully." },
  { status: "Hold",       dot: "bg-amber-400",    tag: "Paused",   chip: "bg-amber-50 text-amber-700",          note: "Case on hold — awaiting info, legal clearance, or bank decision." },
  { status: "Rejected",   dot: "bg-red-400",      tag: "Closed",   chip: "bg-red-50 text-red-600",              note: "Loan declined by the bank or credit team. No further action." },
  { status: "Cancelled",  dot: "bg-neutral-300",  tag: "Closed",   chip: "bg-neutral-100 text-neutral-500",     note: "Case withdrawn by the customer or cancelled by the sales team." },
];
