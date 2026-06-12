"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Download, Filter, X, Eye, FileText, Calendar, Building2, Users, MapPin, Banknote } from "lucide-react";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Drawer, Tabs,
  Select, Input, Label, Modal, Pagination, EmptyState, Timeline,
  Skeleton, useToast, type CaseStatus,
} from "../../../components/ui";
import {
  casesApi, banksApi, dealersApi, coordinatorsApi,
  CASE_STATUSES, PRODUCTS,
  type LoanCase, type Bank, type Dealer, type Coordinator, type Activity,
  type PageMeta,
} from "../../../lib/api";

function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function fmtDate(d?: string) { return d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"; }

export default function CasesPage() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);

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
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newForm, setNewForm] = useState({ firstName: "", lastName: "", contact: "", product: "Car Loan", loanAmount: "", bankId: "", coordinatorId: "" });
  const [saving, setSaving] = useState(false);

  // Status counts from current page (server paginates so counts reflect all)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

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
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter, bankFilter, productFilter, coordinatorFilter, toast]);

  const loadRef = useCallback(async () => {
    const [bl, dl, cl] = await Promise.all([banksApi.list(), dealersApi.list(), coordinatorsApi.list()]);
    setBanks(bl.data); setDealers(dl.data); setCoordinators(cl.data);
  }, []);

  useEffect(() => { loadRef(); }, [loadRef]);
  useEffect(() => { load(); }, [load]);

  async function openDrawer(c: LoanCase) {
    setDrawerCase(c); setDrawerTab("overview");
    try {
      const { data } = await casesApi.activities(c._id);
      setActivities(data as unknown as Activity[]);
    } catch { setActivities([]); }
  }

  async function createCase() {
    if (!newForm.firstName || !newForm.contact) { toast("error", "Name and contact are required"); return; }
    setSaving(true);
    try {
      const { data } = await casesApi.create({
        customer: { firstName: newForm.firstName, lastName: newForm.lastName, contact: newForm.contact },
        product: newForm.product,
        loanAmount: Number(newForm.loanAmount) || 0,
        bankId: newForm.bankId || undefined,
        coordinatorId: newForm.coordinatorId || undefined,
      });
      toast("success", `Case ${(data as any).caseCode} created`);
      setNewCaseOpen(false);
      setNewForm({ firstName: "", lastName: "", contact: "", product: "Car Loan", loanAmount: "", bankId: "", coordinatorId: "" });
      load();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to create case");
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted mt-0.5">Track and manage all loan cases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm"><Download className="size-3.5" /> Export</Button>
          <Button size="sm" onClick={() => setNewCaseOpen(true)}><Plus className="size-3.5" /> New Case</Button>
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
          <Tabs tabs={[{ id: "All", label: "All", count: meta.total }, ...CASE_STATUSES.map((s) => ({ id: s, label: s, count: 0 }))]} active={statusFilter} onChange={(id) => { setStatusFilter(id); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="cursor-pointer" /></th>
                <th>Case ID</th><th>Date</th><th>Customer</th><th>Product</th>
                <th>Bank</th><th>Loan Amount</th><th>Status</th><th>Disbursed</th><th>Coordinator</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 11 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : cases.length === 0 ? (
                <tr><td colSpan={11}><EmptyState icon={FileText} title="No cases found" description="Try adjusting the filters or search term." /></td></tr>
              ) : cases.map((c) => (
                <tr key={c._id} className="cursor-pointer" onClick={() => openDrawer(c)}>
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

      {/* Case detail drawer */}
      <Drawer open={!!drawerCase} onClose={() => setDrawerCase(null)} title={drawerCase?.caseCode ?? ""} subtitle={drawerCase ? `${drawerCase.customer.firstName} ${drawerCase.customer.lastName} · ${drawerCase.product}` : undefined} width="max-w-3xl">
        {drawerCase && (
          <div>
            <Tabs tabs={[{ id: "overview", label: "Overview" }, { id: "bank", label: "Bank & Dealer" }, { id: "documents", label: "Documents" }, { id: "rto", label: "RTO" }, { id: "activity", label: "Activity" }]} active={drawerTab} onChange={setDrawerTab} />
            <div className="p-5">
              {drawerTab === "overview" && (
                <div className="space-y-4 animate-fadeIn">
                  <CaseStatusBadge status={drawerCase.status} />
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Customer", value: `${drawerCase.customer.firstName} ${drawerCase.customer.lastName}`, icon: Users },
                      { label: "Contact", value: drawerCase.customer.contact, icon: Users },
                      { label: "Product", value: drawerCase.product, icon: FileText },
                      { label: "Loan Amount", value: fmt(drawerCase.loanAmount), icon: Banknote },
                      { label: "Bank", value: drawerCase.bankName ?? "—", icon: Building2 },
                      { label: "Dealer", value: drawerCase.dealerName ?? "—", icon: Building2 },
                      { label: "Coordinator", value: drawerCase.coordinatorName ?? "—", icon: Users },
                      { label: "Location", value: drawerCase.customer.location ?? "—", icon: MapPin },
                      { label: "Entry Date", value: fmtDate(drawerCase.date), icon: Calendar },
                      { label: "Disbursal Date", value: fmtDate(drawerCase.disbursementDate), icon: Calendar },
                    ].map((f) => (
                      <div key={f.label} className="space-y-1">
                        <Label>{f.label}</Label>
                        <div className="flex items-center gap-1.5">
                          <f.icon className="size-3.5 text-muted shrink-0" />
                          <span className="text-sm font-medium">{f.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {drawerCase.remarks && <div className="p-3 bg-surface-2 rounded-lg text-sm text-muted">{drawerCase.remarks}</div>}
                </div>
              )}
              {drawerTab === "bank" && (
                <div className="space-y-3 animate-fadeIn">
                  {[
                    ["Bank Name", drawerCase.bankName],
                    ["Branch", drawerCase.bankBranch],
                    ["BM Name", drawerCase.bmName],
                    ["BM Contact", drawerCase.bmContact],
                    ["Executive", drawerCase.bankExecutive],
                    ["Dealer", drawerCase.dealerName],
                    ["Payout %", drawerCase.payoutPct !== undefined ? `${drawerCase.payoutPct}%` : undefined],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-xs text-muted">{label as string}</span>
                      <span className="text-sm font-medium">{value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
              {drawerTab === "documents" && (
                <div className="animate-fadeIn">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <FileText className="size-8 text-muted mx-auto mb-2" />
                    <p className="text-sm font-medium">Drop files here or click to upload</p>
                    <p className="text-xs text-muted mt-1">PDF, JPG, PNG up to 10MB</p>
                    <Button variant="secondary" size="sm" className="mt-3">Browse Files</Button>
                  </div>
                </div>
              )}
              {drawerTab === "rto" && (
                <div className="animate-fadeIn text-sm text-muted text-center py-8">
                  RTO records for this case appear in the RTO Tracker page.
                </div>
              )}
              {drawerTab === "activity" && (
                <div className="animate-fadeIn">
                  {activities.length === 0 ? (
                    <EmptyState title="No activity yet" />
                  ) : (
                    <Timeline items={activities.map((a) => ({ label: a.description, time: new Date(a.createdAt).toLocaleString("en-IN"), user: a.createdByName, note: a.note }))} />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

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

      <Modal open={newCaseOpen} onClose={() => setNewCaseOpen(false)} title="New Case" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>First Name *</Label><Input value={newForm.firstName} onChange={(e) => setNewForm((p) => ({ ...p, firstName: e.target.value }))} placeholder="First name" /></div>
          <div><Label>Last Name</Label><Input value={newForm.lastName} onChange={(e) => setNewForm((p) => ({ ...p, lastName: e.target.value }))} placeholder="Last name" /></div>
          <div><Label>Contact *</Label><Input value={newForm.contact} onChange={(e) => setNewForm((p) => ({ ...p, contact: e.target.value }))} placeholder="+91 XXXXX XXXXX" /></div>
          <div>
            <Label>Product</Label>
            <Select value={newForm.product} onChange={(e) => setNewForm((p) => ({ ...p, product: e.target.value }))}>
              {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </div>
          <div><Label>Loan Amount</Label><Input type="number" value={newForm.loanAmount} onChange={(e) => setNewForm((p) => ({ ...p, loanAmount: e.target.value }))} placeholder="0" /></div>
          <div>
            <Label>Bank</Label>
            <Select value={newForm.bankId} onChange={(e) => setNewForm((p) => ({ ...p, bankId: e.target.value }))}>
              <option value="">Select bank…</option>
              {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Coordinator</Label>
            <Select value={newForm.coordinatorId} onChange={(e) => setNewForm((p) => ({ ...p, coordinatorId: e.target.value }))}>
              <option value="">Select coordinator…</option>
              {coordinators.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="col-span-2 flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={() => setNewCaseOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={createCase}>Create Case</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
