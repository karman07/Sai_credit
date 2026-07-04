"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Plus, Check, Clock, Minus, Download, Pencil, Trash2, ChevronDown, ChevronRight, X, Search } from "lucide-react";
import {
  Button, Badge, Tabs, SectionHeader, Pagination, Modal, Input, Label, Select,
  EmptyState, Skeleton, useToast, type BadgeTone, CaseStatusBadge,
} from "../../../components/ui";
import {
  payoutApi, banksApi, casesApi, formSchemasApi,
  type PayoutRecord, type Bank, type LoanCase, type LinkedCase,
  type SectionDef, type FieldDef,
} from "../../../lib/api";

// ── Chart helpers ─────────────────────────────────────────────────────────────

const PC = {
  primary: "#6683FF",
  success: "#22C55E",
  warning: "#F59E0B",
  orange:  "#F97316",
  teal:    "#14B8A6",
  slate:   "#94A3B8",
  purple:  "#A855F7",
};

function PayoutChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[130px] border border-border">
      {label && <p className="font-semibold mb-1.5 border-b border-border pb-1.5 text-foreground-secondary">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mt-1">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.fill ?? p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">₹{Number(p.value).toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}

function CountChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card text-xs p-3 shadow-2xl min-w-[120px] border border-border">
      {label && <p className="font-semibold mb-1.5 border-b border-border pb-1.5 text-foreground-secondary">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mt-1">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-full shrink-0" style={{ background: p.fill ?? p.color }} />
            {p.name}
          </span>
          <span className="font-bold tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusTone: Record<string, BadgeTone> = {
  Received: "success", Pending: "warning", "Not Applicable": "neutral",
};
const statusIcon: Record<string, React.ElementType> = {
  Received: Check, Pending: Clock, "Not Applicable": Minus,
};
function fmt(n?: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

// ── Form type ─────────────────────────────────────────────────────────────────

// ── Dynamic field renderer ────────────────────────────────────────────────────

function PayoutDynField({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === "select") {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {field.options.map((o) => <option key={o}>{o}</option>)}
      </Select>
    );
  }
  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-2 h-10 cursor-pointer">
        <input type="checkbox" checked={value === "true"} onChange={(e) => onChange(e.target.checked ? "true" : "false")} className="size-4 rounded accent-primary" />
        <span className="text-sm">{value === "true" ? "Yes" : "No"}</span>
      </label>
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "tel" ? "tel" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

// ── Form type ─────────────────────────────────────────────────────────────────

type Form = {
  businessMonth: string; invoiceDate: string;
  bankId: string; company: string;
  volumeCases: string; linkedCases: LinkedCase[];
  invoiceStatus: string; invoiceNumber: string; invoiceAmount: string;
  commission: string; cgstAmount: string; sgstAmount: string; totalAmount: string;
  payoutStatus: string; payoutDate: string; remarks: string;
  customFields: Record<string, string>;
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
  customFields: {},
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
    customFields: Object.fromEntries(
      Object.entries(r.customFields ?? {}).map(([k, v]) => [k, String(v ?? "")])
    ),
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
    customFields: f.customFields,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PayoutPage() {
  const toast = useToast();
  const [allRows, setAllRows] = useState<PayoutRecord[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [allCases, setAllCases] = useState<LoanCase[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [activeMonth, setActiveMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 15;
  const [payoutSections, setPayoutSections] = useState<SectionDef[]>([]);

  // Modal
  const [formOpen, setFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<PayoutRecord | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [saving, setSaving] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PayoutRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rowsRes, monthsRes, banksRes, casesRes, schemaRes] = await Promise.all([
        payoutApi.list(),
        payoutApi.months(),
        banksApi.list(),
        casesApi.list({ limit: 1000, status: "Disbursed" }),
        formSchemasApi.get("payout").catch(() => null),
      ]);
      setAllRows(rowsRes.data);
      setBanks(banksRes.data);
      setAllCases(casesRes.data as unknown as LoanCase[]);
      const sorted = monthsRes.data.sort().reverse();
      setMonths(sorted);
      if (schemaRes) setPayoutSections(schemaRes.data.sections);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const rows = activeMonth === "all" ? allRows : allRows.filter(r => r.businessMonth === activeMonth);
  const paged = rows.slice((page - 1) * limit, page * limit);

  const totalCommission = rows.reduce((a, r) => a + (r.commission || 0), 0);
  const totalCgst       = rows.reduce((a, r) => a + (r.cgstAmount || 0), 0);
  const totalSgst       = rows.reduce((a, r) => a + (r.sgstAmount || 0), 0);
  const totalGst        = rows.reduce((a, r) => a + (r.gstAmount || 0), 0);
  const totalAmt        = rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

  const monthTabs = [
    { id: "all", label: "All Months", count: allRows.length },
    ...months.map(m => ({ id: m, label: m, count: allRows.filter(r => r.businessMonth === m).length })),
  ];

  // ── Case selector helpers ─────────────────────────────────────────────────

  // Only show disbursed cases from the selected bank (if bank selected)
  const filteredCases = useMemo(() => {
    const bankId = form.bankId;
    const q = caseSearch.toLowerCase();
    return allCases.filter(c => {
      const matchBank = !bankId || c.bankId === bankId;
      const matchSearch = !q
        || c.caseCode.toLowerCase().includes(q)
        || `${c.customer.firstName} ${c.customer.lastName}`.toLowerCase().includes(q);
      return matchBank && matchSearch;
    });
  }, [allCases, form.bankId, caseSearch]);

  const linkedIds = useMemo(() => new Set(form.linkedCases.map(l => l.caseId)), [form.linkedCases]);

  function toggleCase(c: LoanCase) {
    setForm(f => {
      const linked = f.linkedCases;
      const exists = linked.some(l => l.caseId === c._id);
      const updated = exists
        ? linked.filter(l => l.caseId !== c._id)
        : [...linked, {
            caseId: c._id,
            caseCode: c.caseCode,
            customerName: `${c.customer.firstName} ${c.customer.lastName}`,
            loanAmount: c.loanAmount,
          }];
      return { ...f, linkedCases: updated, volumeCases: String(updated.length) };
    });
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  function setField<K extends keyof Form>(key: K, val: Form[K]) {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (["commission", "cgstAmount", "sgstAmount"].includes(key as string)) return recalc(updated);
      return updated;
    });
  }

  function generateInvoiceNumber() {
    const month = form.businessMonth || thisMonth();
    // Count existing records for this month to get next sequence number
    const existing = allRows.filter(r => r.businessMonth === month);
    const seq = String(existing.length + 1).padStart(3, "0");
    // Convert YYYY-MM → financial year shorthand e.g. 2026-06 → 26-27
    const [yr, mo] = month.split("-").map(Number);
    const fyStart = mo >= 4 ? yr : yr - 1;
    const fyEnd = String(fyStart + 1).slice(-2);
    const fyStr = `${fyStart}-${fyEnd}`;
    setField("invoiceNumber", `SAI/${fyStr}/${seq}`);
  }

  function openAdd() {
    setEditRecord(null);
    setForm({ ...BLANK, businessMonth: thisMonth(), invoiceDate: today() });
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
    if (!form.businessMonth) { toast("error", "Business month is required"); return; }
    setSaving(true);
    try {
      const body = formToBody(form, banks);
      if (editRecord) {
        const { data } = await payoutApi.update(editRecord._id, body);
        setAllRows(prev => prev.map(r => r._id === data._id ? data : r));
        toast("success", "Record updated");
      } else {
        const { data } = await payoutApi.create(body);
        setAllRows(prev => [data, ...prev]);
        setMonths(prev => prev.includes(data.businessMonth) ? prev : [data.businessMonth, ...prev].sort().reverse());
        toast("success", "Record added");
      }
      setFormOpen(false);
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await payoutApi.delete(deleteTarget._id);
      setAllRows(prev => prev.filter(r => r._id !== deleteTarget._id));
      toast("success", "Record deleted");
      setDeleteTarget(null);
    } catch (e: any) {
      toast("error", e.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function toggleExpand(id: string) {
    setExpandedRows(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Payout Management"
        description="Track monthly commission invoices and payout status per bank"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm"><Download className="size-3.5" /> Export</Button>
            <Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Record</Button>
          </div>
        }
      />

      {/* Summary */}
      {!loading && allRows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Commission",   val: totalCommission, cls: "" },
            { label: "CGST + SGST", val: null, cls: "text-muted", sub: `${fmt(totalCgst)} + ${fmt(totalSgst)}` },
            { label: "Total GST",   val: totalGst, cls: "text-orange" },
            { label: "Total Payout",val: totalAmt, cls: "text-primary" },
          ].map(s => (
            <div key={s.label} className="card p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted">{s.label}</p>
              <p className={`text-lg font-bold font-mono ${s.cls}`}>{s.sub ?? fmt(s.val ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      {!loading && allRows.length > 0 && (() => {
        // Monthly commission + payout volume bar chart data
        const monthlyChart = months.slice(0, 8).reverse().map((m) => {
          const mRows = allRows.filter((r) => r.businessMonth === m);
          return {
            month: m.slice(5),
            Commission: mRows.reduce((a, r) => a + (r.commission || 0), 0),
            "Total Payout": mRows.reduce((a, r) => a + (r.totalAmount || 0), 0),
          };
        });

        // Invoice status pie
        const invCounts: Record<string, number> = {};
        allRows.forEach((r) => { invCounts[r.invoiceStatus] = (invCounts[r.invoiceStatus] ?? 0) + 1; });
        const invPie = Object.entries(invCounts).map(([label, value], i) => ({
          label, value,
          color: [PC.warning, PC.primary, PC.success, PC.slate][i % 4],
        }));

        // Payout status pie
        const payCounts: Record<string, number> = {};
        allRows.forEach((r) => { payCounts[r.payoutStatus] = (payCounts[r.payoutStatus] ?? 0) + 1; });
        const payPie = Object.entries(payCounts).map(([label, value]) => ({
          label, value,
          color: label === "Received" ? PC.success : label === "Pending" ? PC.warning : PC.slate,
        }));

        const totalAll = allRows.length;

        return (
          <div className="grid lg:grid-cols-3 gap-4">

            {/* Monthly commission bar */}
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Monthly Commission vs Payout</p>
                <span className="text-[11px] text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">₹ in actuals</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyChart} barSize={18} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip content={<PayoutChartTip />} cursor={{ fill: "var(--primary-subtle, rgba(102,131,255,0.06))" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="Commission" fill={PC.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Total Payout" fill={PC.teal} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status pies */}
            <div className="card flex flex-col gap-4">
              {/* Invoice status */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Invoice Status</p>
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={invPie} cx="50%" cy="50%" innerRadius={28} outerRadius={44}
                        paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {invPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {invPie.map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs">
                        <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-foreground-secondary flex-1 truncate">{s.label}</span>
                        <span className="font-semibold tabular-nums">{s.value}</span>
                        <span className="text-muted w-7 text-right">{Math.round((s.value / totalAll) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Payout status */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Payout Status</p>
                <div className="flex items-center gap-3">
                  <ResponsiveContainer width={90} height={90}>
                    <PieChart>
                      <Pie data={payPie} cx="50%" cy="50%" innerRadius={28} outerRadius={44}
                        paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {payPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v}`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 flex-1">
                    {payPie.map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5 text-xs">
                        <span className="size-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="text-foreground-secondary flex-1 truncate">{s.label}</span>
                        <span className="font-semibold tabular-nums">{s.value}</span>
                        <span className="text-muted w-7 text-right">{Math.round((s.value / totalAll) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Month tabs */}
      {monthTabs.length > 1 && (
        <Tabs tabs={monthTabs} active={activeMonth} onChange={m => { setActiveMonth(m); setPage(1); }} />
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Month</th>
                <th>Invoice Date</th>
                <th>Company / Bank</th>
                <th>Cases</th>
                <th>Invoice #</th>
                <th>Status</th>
                <th>Commission</th>
                <th>CGST</th>
                <th>SGST</th>
                <th>GST</th>
                <th>Total</th>
                <th>Payout</th>
                <th>Payout Date</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 15 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={15}>
                    <EmptyState
                      title={activeMonth !== "all" ? `No records for ${activeMonth}` : "No payout records yet"}
                      description="Add your first payout record above."
                      action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Record</Button>}
                    />
                  </td>
                </tr>
              ) : paged.map(r => {
                const StatusIcon = statusIcon[r.payoutStatus] ?? Minus;
                const cgst = r.cgstAmount ?? 0;
                const sgst = r.sgstAmount ?? 0;
                const isExpanded = expandedRows.has(r._id);
                const hasLinked = (r.linkedCases ?? []).length > 0;
                return (
                  <>
                    <tr key={r._id} className="group">
                      <td>
                        {hasLinked && (
                          <button onClick={() => toggleExpand(r._id)} className="size-6 grid place-items-center rounded hover:bg-surface-2 text-muted transition-colors">
                            {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          </button>
                        )}
                      </td>
                      <td className="font-mono text-xs font-semibold text-muted">{r.businessMonth}</td>
                      <td className="text-xs text-muted whitespace-nowrap">{fmtDate(r.invoiceDate)}</td>
                      <td>
                        <p className="text-sm font-medium">{r.company ?? "—"}</p>
                        <p className="text-xs text-muted">{r.bankName ?? "—"}</p>
                      </td>
                      <td className="text-center">
                        <Badge tone={hasLinked ? "info" : "neutral"}>{r.volumeCases}</Badge>
                      </td>
                      <td className="text-xs font-mono text-muted">{r.invoiceNumber ?? "—"}</td>
                      <td>
                        <Badge tone={r.invoiceStatus === "Submitted" ? "success" : r.invoiceStatus === "Draft" ? "warning" : "neutral"}>
                          {r.invoiceStatus}
                        </Badge>
                      </td>
                      <td className="font-mono text-sm font-semibold">{fmt(r.commission)}</td>
                      <td className="font-mono text-xs text-muted">{fmt(cgst)}</td>
                      <td className="font-mono text-xs text-muted">{fmt(sgst)}</td>
                      <td className="font-mono text-xs text-orange">{fmt(r.gstAmount)}</td>
                      <td className="font-mono font-bold text-sm text-primary">{fmt(r.totalAmount)}</td>
                      <td>
                        <Badge tone={statusTone[r.payoutStatus] ?? "neutral"} dot>
                          <StatusIcon className="size-3 mr-0.5" />{r.payoutStatus}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted whitespace-nowrap">{fmtDate(r.payoutDate)}</td>
                      <td>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(r)} className="size-6 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Pencil className="size-3.5" /></button>
                          <button onClick={() => setDeleteTarget(r)} className="size-6 grid place-items-center rounded hover:bg-danger/10 text-muted hover:text-danger transition-colors"><Trash2 className="size-3.5" /></button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded linked cases */}
                    {isExpanded && hasLinked && (
                      <tr key={`${r._id}-expanded`} className="bg-surface-2/60">
                        <td colSpan={15} className="px-6 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Linked Cases ({r.linkedCases.length})</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {r.linkedCases.map(lc => (
                              <div key={lc.caseId} className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-border">
                                <div className="min-w-0">
                                  <p className="text-xs font-mono font-semibold text-primary">{lc.caseCode}</p>
                                  <p className="text-[11px] text-muted truncate">{lc.customerName ?? "—"}</p>
                                  {lc.loanAmount && <p className="text-[10px] text-muted font-mono">{fmt(lc.loanAmount)}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {/* Total row */}
              {!loading && rows.length > 0 && (
                <tr className="bg-surface-2 font-semibold border-t-2 border-border">
                  <td colSpan={7} className="text-right text-xs uppercase tracking-wide text-muted pr-4">
                    {activeMonth === "all" ? "Grand Total" : `${activeMonth} Total`}
                  </td>
                  <td className="font-mono font-bold">{fmt(totalCommission)}</td>
                  <td className="font-mono text-xs text-muted">{fmt(totalCgst)}</td>
                  <td className="font-mono text-xs text-muted">{fmt(totalSgst)}</td>
                  <td className="font-mono text-xs text-orange">{fmt(totalGst)}</td>
                  <td className="font-mono font-bold text-primary">{fmt(totalAmt)}</td>
                  <td colSpan={3} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(rows.length / limit))} total={rows.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editRecord ? "Edit Payout Record" : "Add Payout Record"} size="lg">
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          {/* Basic info row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Business Month *</Label>
              <Input value={form.businessMonth} onChange={e => setField("businessMonth", e.target.value)} placeholder="YYYY-MM" />
            </div>
            <div>
              <Label>Invoice Date *</Label>
              <Input type="date" value={form.invoiceDate} onChange={e => setField("invoiceDate", e.target.value)} />
            </div>
            <div>
              <Label>Bank</Label>
              <Select value={form.bankId} onChange={e => { setField("bankId", e.target.value); setForm(f => ({ ...f, linkedCases: [], volumeCases: "0" })); }}>
                <option value="">Select bank…</option>
                {banks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company} onChange={e => setField("company", e.target.value)} />
            </div>
          </div>

          {/* Case selector */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-2 border-b border-border">
              <div>
                <p className="text-xs font-semibold">
                  Linked Cases
                  {form.linkedCases.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                      {form.linkedCases.length}
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted">
                  {form.bankId ? "Showing disbursed cases for selected bank" : "Select a bank to filter cases"}
                </p>
              </div>
              {form.linkedCases.length > 0 && (
                <button onClick={() => setForm(f => ({ ...f, linkedCases: [], volumeCases: "0" }))} className="text-xs text-danger hover:underline">Clear all</button>
              )}
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
                <input
                  value={caseSearch}
                  onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Search by case code or customer…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Case list */}
            <div className="max-h-48 overflow-y-auto divide-y divide-border">
              {filteredCases.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted">
                  {form.bankId ? "No disbursed cases for this bank" : "Select a bank above to see cases"}
                </div>
              ) : filteredCases.slice(0, 50).map(c => {
                const checked = linkedIds.has(c._id);
                return (
                  <label key={c._id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-2 transition-colors ${checked ? "bg-primary/5" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCase(c)} className="size-4 rounded accent-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-primary">{c.caseCode}</span>
                        <span className="text-xs font-medium truncate">{c.customer.firstName} {c.customer.lastName}</span>
                        <CaseStatusBadge status={c.status} />
                      </div>
                      {c.loanAmount && <p className="text-[10px] text-muted font-mono">{fmt(c.loanAmount)}</p>}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Selected summary */}
            {form.linkedCases.length > 0 && (
              <div className="px-3 py-2 bg-primary/5 border-t border-border flex flex-wrap gap-1.5">
                {form.linkedCases.map(lc => (
                  <span key={lc.caseId} className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold bg-primary text-white rounded px-1.5 py-0.5">
                    {lc.caseCode}
                    <button onClick={() => toggleCase({ _id: lc.caseId } as LoanCase)} className="hover:opacity-70"><X className="size-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Invoice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Invoice Status</Label>
              <Select value={form.invoiceStatus} onChange={e => setField("invoiceStatus", e.target.value)}>
                {["Draft", "Submitted", "Not Submitted"].map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label>Invoice Number</Label>
              <div className="flex gap-1.5">
                <Input
                  value={form.invoiceNumber}
                  onChange={e => setField("invoiceNumber", e.target.value)}
                  placeholder="e.g. SAI/2026-27/001"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={generateInvoiceNumber}
                  className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors whitespace-nowrap"
                  title="Auto-generate invoice number"
                >
                  Auto
                </button>
              </div>
              {form.invoiceNumber && (
                <p className="text-[10px] text-muted mt-0.5 font-mono">{form.invoiceNumber}</p>
              )}
            </div>
            <div>
              <Label>Invoice Amount (₹)</Label>
              <Input type="number" min="0" value={form.invoiceAmount} onChange={e => setField("invoiceAmount", e.target.value)} />
            </div>
            <div>
              <Label>Commission (₹)</Label>
              <Input type="number" min="0" value={form.commission} onChange={e => setField("commission", e.target.value)} />
            </div>
          </div>

          {/* GST breakdown */}
          <div className="border border-border rounded-xl p-3 space-y-2 bg-surface-2/40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">GST Breakdown</p>
              <button
                type="button"
                className="text-[11px] text-primary hover:underline font-medium"
                onClick={() => {
                  const commission = Number(form.commission) || 0;
                  const cgst = Math.round(commission * 0.09);
                  setForm(f => recalc({ ...f, cgstAmount: String(cgst), sgstAmount: String(cgst) }));
                }}
              >
                Auto-fill @ 9% + 9% from commission
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>CGST (₹) @ 9%</Label>
                <Input type="number" min="0" value={form.cgstAmount} onChange={e => setField("cgstAmount", e.target.value)} />
              </div>
              <div>
                <Label>SGST (₹) @ 9%</Label>
                <Input type="number" min="0" value={form.sgstAmount} onChange={e => setField("sgstAmount", e.target.value)} />
              </div>
              <div>
                <Label>Total GST (₹)</Label>
                <Input readOnly value={String((Number(form.cgstAmount) || 0) + (Number(form.sgstAmount) || 0))} className="bg-surface-3 text-muted cursor-not-allowed" />
              </div>
            </div>
          </div>

          {/* Total + Payout */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total Amount (₹)</Label>
              <Input type="number" min="0" value={form.totalAmount} onChange={e => setField("totalAmount", e.target.value)} />
              <p className="text-[10px] text-muted mt-0.5">Commission + CGST + SGST</p>
            </div>
            <div>
              <Label>Payout Status</Label>
              <Select value={form.payoutStatus} onChange={e => setField("payoutStatus", e.target.value)}>
                {["Pending", "Received", "Not Applicable"].map(s => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label>Payout Date</Label>
              <Input type="date" value={form.payoutDate} onChange={e => setField("payoutDate", e.target.value)} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={form.remarks} onChange={e => setField("remarks", e.target.value)} placeholder="Optional notes" />
            </div>
          </div>

          {/* Custom fields from Form Builder */}
          {payoutSections.flatMap(sec => sec.fields.filter(f => !f.isCore && f.isActive)).length > 0 && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Additional Fields</p>
              <div className="grid grid-cols-2 gap-3">
                {payoutSections.flatMap(sec => sec.fields.filter(f => !f.isCore && f.isActive)).map(field => (
                  <div key={field.key} className={field.type === "boolean" ? "col-span-2" : ""}>
                    <Label>{field.label}{field.required && <span className="text-danger ml-0.5">*</span>}</Label>
                    <PayoutDynField
                      field={field}
                      value={form.customFields[field.key] ?? field.defaultValue ?? ""}
                      onChange={v => setForm(f => ({ ...f, customFields: { ...f.customFields, [field.key]: v } }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4 mt-4">
          <Button variant="secondary" size="sm" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={saveForm}>{editRecord ? "Save Changes" : "Add Record"}</Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Record" size="sm">
        <p className="text-sm text-foreground-secondary mb-4">
          Delete payout record for <span className="font-semibold text-foreground">{deleteTarget?.bankName ?? "this bank"}</span> ({deleteTarget?.businessMonth})? This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button size="sm" variant="danger" loading={deleting} onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
