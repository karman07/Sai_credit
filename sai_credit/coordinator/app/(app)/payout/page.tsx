"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { Plus, Check, Clock, Minus, Pencil, Trash2, ChevronDown, ChevronRight, X, Search } from "lucide-react";
import {
  Button, Badge, Tabs, SectionHeader, Pagination, Modal, Input, Label, Select,
  EmptyState, Skeleton, useToast, type BadgeTone, ConfirmDialog,
} from "../../../components/ui";
import {
  payoutApi, banksApi, casesApi,
  type PayoutRecord, type Bank, type LoanCase, type LinkedCase,
} from "../../../lib/api";

function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

const statusTone: Record<string, BadgeTone> = {
  Received: "success", Pending: "warning", "Not Applicable": "neutral",
  Submitted: "success", Draft: "warning", "Not Submitted": "neutral",
};
const statusIcon: Record<string, React.ElementType> = {
  Received: Check, Pending: Clock, "Not Applicable": Minus,
};

type Form = {
  businessMonth: string; invoiceDate: string;
  bankId: string; company: string;
  volumeCases: string; linkedCases: LinkedCase[];
  invoiceStatus: string; invoiceNumber: string; invoiceAmount: string;
  commission: string; cgstAmount: string; sgstAmount: string; totalAmount: string;
  payoutStatus: string; payoutDate: string; remarks: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

const BLANK: Form = {
  businessMonth: thisMonth(), invoiceDate: today(),
  bankId: "", company: "SAI Credit Solutions",
  volumeCases: "0", linkedCases: [],
  invoiceStatus: "Draft", invoiceNumber: "", invoiceAmount: "0",
  commission: "0", cgstAmount: "0", sgstAmount: "0", totalAmount: "0",
  payoutStatus: "Pending", payoutDate: "", remarks: "",
};

function recordToForm(r: PayoutRecord): Form {
  const cgst = r.cgstAmount ?? Math.round((r.gstAmount ?? 0) / 2);
  const sgst = r.sgstAmount ?? Math.round((r.gstAmount ?? 0) / 2);
  return {
    businessMonth: r.businessMonth,
    invoiceDate: r.invoiceDate ? r.invoiceDate.substring(0, 10) : today(),
    bankId: r.bankId ?? "",
    company: r.company ?? "SAI Credit Solutions",
    volumeCases: String(r.volumeCases ?? 0),
    linkedCases: r.linkedCases ?? [],
    invoiceStatus: r.invoiceStatus ?? "Draft",
    invoiceNumber: r.invoiceNumber ?? "",
    invoiceAmount: String(r.invoiceAmount ?? 0),
    commission: String(r.commission ?? 0),
    cgstAmount: String(cgst),
    sgstAmount: String(sgst),
    totalAmount: String(r.totalAmount ?? 0),
    payoutStatus: r.payoutStatus ?? "Pending",
    payoutDate: r.payoutDate ? r.payoutDate.substring(0, 10) : "",
    remarks: r.remarks ?? "",
  };
}

function recalc(f: Form): Form {
  const commission = Number(f.commission) || 0;
  const cgst = Number(f.cgstAmount) || 0;
  const sgst = Number(f.sgstAmount) || 0;
  return { ...f, totalAmount: String(commission + cgst + sgst) };
}

function formToBody(f: Form, banks: Bank[]) {
  const bank = banks.find(b => b._id === f.bankId);
  const cgst = Number(f.cgstAmount) || 0;
  const sgst = Number(f.sgstAmount) || 0;
  return {
    businessMonth: f.businessMonth,
    invoiceDate: f.invoiceDate || undefined,
    bankId: f.bankId || undefined,
    bankName: bank?.name,
    company: f.company || undefined,
    volumeCases: f.linkedCases.length || Number(f.volumeCases) || 0,
    linkedCases: f.linkedCases,
    invoiceStatus: f.invoiceStatus,
    invoiceNumber: f.invoiceNumber || undefined,
    invoiceAmount: Number(f.invoiceAmount) || 0,
    commission: Number(f.commission) || 0,
    cgstAmount: cgst,
    sgstAmount: sgst,
    gstAmount: cgst + sgst,
    totalAmount: Number(f.totalAmount) || 0,
    payoutStatus: f.payoutStatus,
    payoutDate: f.payoutDate || undefined,
    remarks: f.remarks || undefined,
  };
}

export default function PayoutPage() {
  const toast = useToast();
  const [allRows, setAllRows] = useState<PayoutRecord[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [teamCases, setTeamCases] = useState<LoanCase[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [activeMonth, setActiveMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 15;

  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayoutRecord | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<PayoutRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rowsRes, monthsRes, banksRes, casesRes] = await Promise.all([
        payoutApi.list(),
        payoutApi.months(),
        banksApi.list(),
        casesApi.list({ limit: 1000, status: "Disbursed" }),
      ]);
      setAllRows(rowsRes.data);
      setBanks(banksRes.data);
      setTeamCases(casesRes.data as unknown as LoanCase[]);
      setMonths(monthsRes.data.sort().reverse());
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const rows = activeMonth === "all" ? allRows : allRows.filter(r => r.businessMonth === activeMonth);
  const paged = rows.slice((page - 1) * limit, page * limit);

  const totalCommission = rows.reduce((a, r) => a + (r.commission || 0), 0);
  const totalGst        = rows.reduce((a, r) => a + (r.gstAmount || 0), 0);
  const totalAmt        = rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

  const monthTabs = [
    { id: "all", label: "All Months", count: allRows.length },
    ...months.map(m => ({ id: m, label: m, count: allRows.filter(r => r.businessMonth === m).length })),
  ];

  const filteredCases = useMemo(() => {
    const bankId = form.bankId;
    const q = caseSearch.toLowerCase();
    return teamCases.filter(c => {
      const matchBank = !bankId || c.bankId === bankId;
      const matchSearch = !q
        || c.caseCode.toLowerCase().includes(q)
        || `${c.customer.firstName} ${c.customer.lastName}`.toLowerCase().includes(q);
      return matchBank && matchSearch;
    });
  }, [teamCases, form.bankId, caseSearch]);

  const linkedIds = useMemo(() => new Set(form.linkedCases.map(l => l.caseId)), [form.linkedCases]);

  function toggleCase(c: LoanCase) {
    setForm(f => {
      const exists = f.linkedCases.some(l => l.caseId === c._id);
      const updated = exists
        ? f.linkedCases.filter(l => l.caseId !== c._id)
        : [...f.linkedCases, { caseId: c._id, caseCode: c.caseCode, customerName: `${c.customer.firstName} ${c.customer.lastName}`, loanAmount: c.loanAmount }];
      return { ...f, linkedCases: updated, volumeCases: String(updated.length) };
    });
  }

  function openCreate() {
    setEditRecord(null);
    setForm(BLANK);
    setCaseSearch("");
    setFormOpen(true);
  }

  function openEdit(r: PayoutRecord) {
    setEditRecord(r);
    setForm(recordToForm(r));
    setCaseSearch("");
    setFormOpen(true);
  }

  async function saveForm() {
    setSaving(true);
    try {
      const body = formToBody(form, banks);
      if (editRecord) {
        await payoutApi.update(editRecord._id, body);
        toast("success", "Payout record updated");
      } else {
        await payoutApi.create(body);
        toast("success", "Payout record created");
      }
      setFormOpen(false);
      loadData();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await payoutApi.delete(deleteTarget._id);
      toast("success", "Payout record deleted");
      setDeleteTarget(null);
      loadData();
    } catch (e: any) {
      toast("error", e.message ?? "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Payout Management"
        description="Track bank commissions, invoices, and payout status."
        action={<Button size="sm" onClick={openCreate}><Plus className="size-3.5" /> New Payout Record</Button>}
      />

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Commission</p>
          <p className="text-xl font-bold mt-1 font-mono text-primary">{fmt(totalCommission)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total GST</p>
          <p className="text-xl font-bold mt-1 font-mono">{fmt(totalGst)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Total Payout</p>
          <p className="text-xl font-bold mt-1 font-mono text-success">{fmt(totalAmt)}</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Tabs tabs={monthTabs} active={activeMonth} onChange={(m) => { setActiveMonth(m); setPage(1); }} />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Month</th><th>Bank</th><th>Cases</th><th>Commission</th><th>GST</th><th>Total</th>
                <th>Invoice</th><th>Payout</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No payout records" description="Add a payout record for your team's disbursed cases." /></td></tr>
              ) : paged.map((r) => {
                const InvIcon = statusIcon[r.invoiceStatus];
                const PayIcon = statusIcon[r.payoutStatus];
                const expanded = expandedRows.has(r._id);
                return (
                  <Fragment key={r._id}>
                    <tr className="cursor-pointer" onClick={() => toggleExpand(r._id)}>
                      <td>{expanded ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronRight className="size-3.5 text-muted" />}</td>
                      <td className="font-mono text-xs">{r.businessMonth}</td>
                      <td className="text-sm font-medium">{r.bankName ?? "—"}</td>
                      <td className="text-xs">{r.volumeCases}</td>
                      <td className="font-mono text-xs font-semibold">{fmt(r.commission)}</td>
                      <td className="font-mono text-xs">{fmt(r.gstAmount)}</td>
                      <td className="font-mono text-xs font-semibold text-success">{fmt(r.totalAmount)}</td>
                      <td><Badge tone={statusTone[r.invoiceStatus] ?? "neutral"} dot>{InvIcon && <InvIcon className="size-3" />}{r.invoiceStatus}</Badge></td>
                      <td><Badge tone={statusTone[r.payoutStatus] ?? "neutral"} dot>{PayIcon && <PayIcon className="size-3" />}{r.payoutStatus}</Badge></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Pencil className="size-3.5" /></button>
                          <button onClick={() => setDeleteTarget(r)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-danger transition-colors"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={10} className="bg-surface-2 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><Label>Invoice Number</Label><p className="text-sm font-medium mt-0.5">{r.invoiceNumber ?? "—"}</p></div>
                            <div><Label>Invoice Date</Label><p className="text-sm font-medium mt-0.5">{fmtDate(r.invoiceDate)}</p></div>
                            <div><Label>Payout Date</Label><p className="text-sm font-medium mt-0.5">{fmtDate(r.payoutDate)}</p></div>
                            <div><Label>Company</Label><p className="text-sm font-medium mt-0.5">{r.company ?? "—"}</p></div>
                          </div>
                          {r.remarks && <p className="text-xs text-muted mt-3 italic">{r.remarks}</p>}
                          {r.linkedCases?.length > 0 && (
                            <div className="mt-3">
                              <Label>Linked Cases ({r.linkedCases.length})</Label>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {r.linkedCases.map((lc) => (
                                  <Badge key={lc.caseId} tone="teal">{lc.caseCode}{lc.customerName ? ` · ${lc.customerName}` : ""}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(rows.length / limit))} total={rows.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      {/* ── Create / Edit modal ── */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editRecord ? "Edit Payout Record" : "New Payout Record"} size="xl">
        <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Basics</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Business Month *</Label><Input type="month" value={form.businessMonth} onChange={(e) => setForm(f => ({ ...f, businessMonth: e.target.value }))} /></div>
              <div><Label>Bank / NBFC *</Label>
                <Select value={form.bankId} onChange={(e) => setForm(f => ({ ...f, bankId: e.target.value }))}>
                  <option value="">Select bank…</option>
                  {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </Select>
              </div>
              <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} /></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Invoice</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Invoice Date</Label><Input type="date" value={form.invoiceDate} onChange={(e) => setForm(f => ({ ...f, invoiceDate: e.target.value }))} /></div>
              <div><Label>Invoice Number</Label><Input value={form.invoiceNumber} onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
              <div><Label>Invoice Status</Label>
                <Select value={form.invoiceStatus} onChange={(e) => setForm(f => ({ ...f, invoiceStatus: e.target.value }))}>
                  <option>Draft</option><option>Submitted</option><option>Not Submitted</option>
                </Select>
              </div>
              <div><Label>Invoice Amount (₹)</Label><Input type="number" min="0" value={form.invoiceAmount} onChange={(e) => setForm(f => ({ ...f, invoiceAmount: e.target.value }))} /></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Commission &amp; GST</p>
            <div className="grid grid-cols-4 gap-3">
              <div><Label>Commission (₹)</Label><Input type="number" min="0" value={form.commission} onChange={(e) => setForm(f => recalc({ ...f, commission: e.target.value }))} /></div>
              <div><Label>CGST (₹)</Label><Input type="number" min="0" value={form.cgstAmount} onChange={(e) => setForm(f => recalc({ ...f, cgstAmount: e.target.value }))} /></div>
              <div><Label>SGST (₹)</Label><Input type="number" min="0" value={form.sgstAmount} onChange={(e) => setForm(f => recalc({ ...f, sgstAmount: e.target.value }))} /></div>
              <div><Label>Total (₹)</Label><Input disabled value={form.totalAmount} className="font-semibold text-success" /></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">Payout</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Payout Status</Label>
                <Select value={form.payoutStatus} onChange={(e) => setForm(f => ({ ...f, payoutStatus: e.target.value }))}>
                  <option>Pending</option><option>Received</option><option>Not Applicable</option>
                </Select>
              </div>
              <div><Label>Payout Date</Label><Input type="date" value={form.payoutDate} onChange={(e) => setForm(f => ({ ...f, payoutDate: e.target.value }))} /></div>
              <div className="col-span-3"><Label>Remarks</Label><Input value={form.remarks} onChange={(e) => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes…" /></div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 pb-1 border-b border-border">
              Linked Cases ({form.linkedCases.length}) <span className="font-normal normal-case text-muted/70">— your team's disbursed cases</span>
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
              <Input value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} placeholder="Search case ID or customer…" className="!pl-8" />
            </div>
            <div className="max-h-52 overflow-y-auto border border-border rounded-md divide-y divide-border-subtle">
              {filteredCases.length === 0 ? (
                <p className="text-xs text-muted italic p-3">No disbursed cases found for your team.</p>
              ) : filteredCases.map((c) => {
                const checked = linkedIds.has(c._id);
                return (
                  <label key={c._id} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-surface-2 select-none">
                    <input type="checkbox" checked={checked} onChange={() => toggleCase(c)} />
                    <span className="font-mono text-primary font-semibold">{c.caseCode}</span>
                    <span className="flex-1 truncate">{c.customer.firstName} {c.customer.lastName}</span>
                    <span className="text-muted">{fmt(c.loanAmount)}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t border-border pt-4">
            <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={saveForm}>{editRecord ? "Save Changes" : "Create Record"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete payout record?"
        description={`This will permanently remove the ${deleteTarget?.businessMonth} record for ${deleteTarget?.bankName ?? "this bank"}.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
