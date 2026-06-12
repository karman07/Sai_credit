"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Filter, X, Eye, FileText, Calendar, Building2, Users, MapPin, Banknote, UserCheck, CheckCircle2, AlertCircle, UploadCloud, Pencil, Trash2, Edit2 } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Drawer, Tabs,
  Select, Input, Label, Modal, Pagination, EmptyState, Timeline,
  Skeleton, useToast, type CaseStatus,
} from "../../../components/ui";
import {
  casesApi, banksApi, dealersApi, coordinatorsApi, usersApi, mastersApi,
  CASE_STATUSES, PRODUCTS, LOAN_TYPES, API_BASE,
  type LoanCase, type Bank, type Dealer, type Coordinator, type Activity,
  type PageMeta, type SalesUser, type DocumentType,
} from "../../../lib/api";

function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"; }

type EditForm = {
  firstName: string; lastName: string; fatherName: string; contact: string; altContact: string;
  location: string; pinCode: string; residentialStatus: string;
  product: string; loanType: string; vehicleModel: string; regNumber: string;
  loanAmount: string; bankId: string; bankBranch: string; bmName: string; bmContact: string; bankExecutive: string;
  dealerId: string; payoutPct: string; coordinatorId: string; remarks: string;
};

export default function CasesPage() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bankFilter, setBankFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [coordinatorFilter, setCoordinatorFilter] = useState("");
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

  // Status change
  const [statusChanging, setStatusChanging] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
    location: "", pinCode: "", residentialStatus: "",
    product: "", loanType: "", vehicleModel: "", regNumber: "",
    loanAmount: "", bankId: "", bankBranch: "", bmName: "", bmContact: "", bankExecutive: "",
    dealerId: "", payoutPct: "", coordinatorId: "", remarks: "",
  });
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

  // Document Edit state
  const [editDocData, setEditDocData] = useState<{ id: string; fileName: string; remarks: string } | null>(null);

  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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
        coordinatorId: coordinatorFilter || undefined,
      });
      setCases(data as unknown as LoanCase[]);
      if (m) setMeta(m);
      loadStats();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load cases");
    } finally { setLoading(false); }
  }, [page, limit, search, statusFilter, bankFilter, productFilter, coordinatorFilter, toast, loadStats]);

  const loadRef = useCallback(async () => {
    try {
      const [bl, dl, cl, ul, dtl] = await Promise.all([
        banksApi.list(), dealersApi.list(), coordinatorsApi.list(),
        usersApi.list("sales_executive"), mastersApi.list("document-types"),
      ]);
      setBanks(bl.data); setDealers(dl.data); setCoordinators(cl.data);
      setSalesUsers(ul.data); setDocTypes(dtl.data.filter((d: any) => d.isActive));
    } catch (e: any) { toast("error", "Failed to load references"); }
  }, [toast]);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => { load(); }, [load]);

  async function openDrawer(c: LoanCase) {
    setDrawerCase(c); setDrawerTab("overview");
    try { const { data } = await casesApi.activities(c._id); setActivities(data as unknown as Activity[]); }
    catch { setActivities([]); }
  }

  async function reloadDrawer(id: string) {
    try {
      const { data } = await casesApi.get(id); setDrawerCase(data);
      const { data: act } = await casesApi.activities(id); setActivities(act as unknown as Activity[]);
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
    } catch (e: any) { toast("error", e.message ?? "Failed to change status"); }
    finally { setStatusChanging(false); }
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
      pinCode: c.customer.pinCode ?? "", residentialStatus: c.customer.residentialStatus ?? "",
      product: c.product ?? "", loanType: (c as any).loanType ?? "",
      vehicleModel: (c as any).vehicleModel ?? "", regNumber: (c as any).regNumber ?? "",
      loanAmount: c.loanAmount ? String(c.loanAmount) : "",
      bankId: c.bankId ?? "", bankBranch: c.bankBranch ?? "",
      bmName: c.bmName ?? "", bmContact: c.bmContact ?? "", bankExecutive: c.bankExecutive ?? "",
      dealerId: c.dealerId ?? "", payoutPct: c.payoutPct !== undefined ? String(c.payoutPct) : "",
      coordinatorId: c.coordinatorId ?? "", remarks: c.remarks ?? "",
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
          pinCode: editForm.pinCode || undefined, residentialStatus: editForm.residentialStatus || undefined,
        },
        product: editForm.product || undefined, loanType: editForm.loanType || undefined,
        vehicleModel: editForm.vehicleModel || undefined, regNumber: editForm.regNumber || undefined,
        loanAmount: editForm.loanAmount ? Number(editForm.loanAmount) : undefined,
        bankId: editForm.bankId || undefined, bankBranch: editForm.bankBranch || undefined,
        bmName: editForm.bmName || undefined, bmContact: editForm.bmContact || undefined,
        bankExecutive: editForm.bankExecutive || undefined,
        dealerId: editForm.dealerId || undefined,
        payoutPct: editForm.payoutPct ? Number(editForm.payoutPct) : undefined,
        coordinatorId: editForm.coordinatorId || undefined, remarks: editForm.remarks || undefined,
      });
      setDrawerCase(data);
      toast("success", "Case updated successfully");
      setEditOpen(false);
      load(); reloadDrawer(drawerCase._id);
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

  const hasFilters = bankFilter || productFilter || coordinatorFilter;
  const statusTabs = [
    { id: "All", label: "All", count: meta.total },
    ...CASE_STATUSES.map((s) => ({ id: s, label: s, count: statusCounts[s] ?? 0 })),
  ];
  const allSelected = cases.length > 0 && cases.every((c) => selectedIds.has(c._id));
  function toggleAll() {
    if (allSelected) { const n = new Set(selectedIds); cases.forEach((c) => n.delete(c._id)); setSelectedIds(n); }
    else { const n = new Set(selectedIds); cases.forEach((c) => n.add(c._id)); setSelectedIds(n); }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Header — no New Case button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted mt-0.5">Track and manage all loan cases</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="size-3.5" /> Export</Button>
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
          {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setBankFilter(""); setProductFilter(""); setCoordinatorFilter(""); }}><X className="size-3" /> Clear</Button>}
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
                {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label>Coordinator</Label>
              <Select className="!h-8 text-xs" value={coordinatorFilter} onChange={(e) => { setCoordinatorFilter(e.target.value); setPage(1); }}>
                <option value="">All Coordinators</option>
                {coordinators.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
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
                <th>Bank</th><th>Loan Amount</th><th>Status</th><th>Disbursed</th><th>Coordinator</th><th>Assigned To</th><th>Actions</th>
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
                  <td><CaseStatusBadge status={c.status} /></td>
                  <td className="text-xs text-muted">{fmtDate(c.disbursementDate)}</td>
                  <td className="text-xs text-foreground-secondary">{c.coordinatorName ?? "—"}</td>
                  <td className="text-xs font-medium">
                    {c.assignedToName
                      ? <span className="flex items-center gap-1 text-foreground-secondary"><UserCheck className="size-3 text-teal" />{c.assignedToName}</span>
                      : <span className="text-muted/60">Unassigned</span>}
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
                      { label: "Loan Amount", value: fmt(drawerCase.loanAmount), icon: Banknote },
                      { label: "Bank", value: drawerCase.bankName ?? "—", icon: Building2 },
                      { label: "Dealer", value: drawerCase.dealerName ?? "—", icon: Building2 },
                      { label: "Coordinator", value: drawerCase.coordinatorName ?? "—", icon: Users },
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
                <div className="animate-fadeIn text-sm text-muted text-center py-12">
                  RTO records for this case appear in the RTO Tracker page.
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
          <div><Label>New Status</Label><Select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>{CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></div>
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
              <div><Label>Location</Label><Input value={editForm.location} onChange={(e) => setEditForm(p => ({ ...p, location: e.target.value }))} placeholder="City / Area" /></div>
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
              <div><Label>Loan Amount</Label><Input type="number" value={editForm.loanAmount} onChange={(e) => setEditForm(p => ({ ...p, loanAmount: e.target.value }))} placeholder="0" /></div>
              <div><Label>Vehicle Model</Label><Input value={editForm.vehicleModel} onChange={(e) => setEditForm(p => ({ ...p, vehicleModel: e.target.value }))} placeholder="e.g. Swift Dzire" /></div>
              <div><Label>Reg Number</Label><Input value={editForm.regNumber} onChange={(e) => setEditForm(p => ({ ...p, regNumber: e.target.value }))} placeholder="e.g. DL01AB1234" /></div>
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
                <Label>Dealer</Label>
                <Select value={editForm.dealerId} onChange={(e) => setEditForm(p => ({ ...p, dealerId: e.target.value }))}>
                  <option value="">Select dealer…</option>
                  {dealers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                </Select>
              </div>
              <div><Label>Payout %</Label><Input type="number" min="0" max="100" value={editForm.payoutPct} onChange={(e) => setEditForm(p => ({ ...p, payoutPct: e.target.value }))} placeholder="0" /></div>
              <div>
                <Label>Coordinator</Label>
                <Select value={editForm.coordinatorId} onChange={(e) => setEditForm(p => ({ ...p, coordinatorId: e.target.value }))}>
                  <option value="">Select coordinator…</option>
                  {coordinators.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
              </div>
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
    </div>
  );
}
