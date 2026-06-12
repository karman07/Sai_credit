"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw } from "lucide-react";
import {
  Button, Badge, SearchInput, SectionHeader, Pagination, Modal, Input, Label, Select,
  EmptyState, Skeleton, useToast, type BadgeTone,
} from "../../../components/ui";
import { insuranceApi, casesApi, type InsuranceMIS, type LoanCase } from "../../../lib/api";

function daysUntil(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  return Math.round((end.getTime() - now.getTime()) / 86400000);
}
function expiryTone(days: number): BadgeTone {
  if (days < 0 || days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "success";
}
function expiryLabel(days: number) {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d left`;
}

export default function InsuranceMISPage() {
  const toast = useToast();
  const [records, setRecords] = useState<InsuranceMIS[]>([]);
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterExpiry, setFilterExpiry] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [form, setForm] = useState({
    caseId: "", caseCode: "", customerName: "", vehicleModel: "",
    insurer: "", ownerType: "Individual", startDate: "", endDate: "",
    holdAmount: "", renewal: false,
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ins, cas] = await Promise.all([
        insuranceApi.list(),
        casesApi.list({ status: "Disbursed", limit: 200 }),
      ]);
      setRecords(ins.data);
      setCases(cas.data as unknown as LoanCase[]);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load insurance records");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function handleCaseSelect(caseId: string) {
    const c = cases.find((x) => x._id === caseId);
    if (c) {
      setForm((p) => ({
        ...p, caseId,
        caseCode: c.caseCode,
        customerName: `${c.customer.firstName} ${c.customer.lastName}`,
        vehicleModel: c.vehicleModel ?? "",
      }));
    } else {
      setForm((p) => ({ ...p, caseId, caseCode: "", customerName: "", vehicleModel: "" }));
    }
  }

  async function save() {
    if (!form.insurer || !form.startDate || !form.endDate) {
      toast("error", "Insurer, start date, and end date are required");
      return;
    }
    setSaving(true);
    try {
      const { data } = await insuranceApi.create({ ...form, holdAmount: Number(form.holdAmount) || 0 });
      setRecords((p) => [data, ...p]);
      toast("success", "Insurance record added");
      setAddOpen(false);
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (r.customerName ?? "").toLowerCase().includes(q) || (r.caseCode ?? "").toLowerCase().includes(q);
    const days = daysUntil(r.endDate);
    const matchExpiry =
      filterExpiry === "all" ? true :
      filterExpiry === "30"  ? days <= 30 :
      filterExpiry === "60"  ? days <= 60 :
      filterExpiry === "expired" ? days < 0 : true;
    return matchSearch && matchExpiry;
  });
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Insurance MIS"
        description="Track active insurance policies and upcoming renewals"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" /> Add Entry</Button>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Active",   value: records.length,                                          tone: "info" as BadgeTone },
          { label: "Expired",        value: records.filter((r) => daysUntil(r.endDate) < 0).length,   tone: "danger" as BadgeTone },
          { label: "Expiring ≤30d",  value: records.filter((r) => { const d = daysUntil(r.endDate); return d >= 0 && d <= 30; }).length, tone: "warning" as BadgeTone },
          { label: "Renewal Tagged", value: records.filter((r) => r.renewal).length,                  tone: "success" as BadgeTone },
        ].map((s) => (
          <div key={s.label} className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">{s.label}</span>
            <Badge tone={s.tone}>{s.value}</Badge>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-3 border-b border-border flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Search customer or case ID…" className="w-64" />
          <Select className="w-40 !h-8 text-xs" value={filterExpiry} onChange={(e) => { setFilterExpiry(e.target.value); setPage(1); }}>
            <option value="all">All expiry</option>
            <option value="expired">Expired</option>
            <option value="30">Expiring ≤30d</option>
            <option value="60">Expiring ≤60d</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th><th>Customer</th><th>Vehicle</th><th>Insurer</th>
                <th>Owner Type</th><th>Start</th><th>End</th><th>Hold Amt</th><th>Expiry</th><th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 10 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={10}><EmptyState title="No insurance records" description="Add your first entry above." /></td></tr>
              ) : paged.map((r) => {
                const days = daysUntil(r.endDate);
                return (
                  <tr key={r._id}>
                    <td className="font-mono text-xs text-primary font-semibold">{r.caseCode ?? "—"}</td>
                    <td className="text-sm font-medium">{r.customerName ?? "—"}</td>
                    <td className="text-xs text-foreground-secondary">{r.vehicleModel ?? "—"}</td>
                    <td className="text-sm">{r.insurer}</td>
                    <td><Badge tone={r.ownerType === "Financer" ? "purple" : "info"}>{r.ownerType}</Badge></td>
                    <td className="text-xs text-muted">{new Date(r.startDate).toLocaleDateString("en-IN")}</td>
                    <td className="text-xs text-muted">{new Date(r.endDate).toLocaleDateString("en-IN")}</td>
                    <td className="font-mono text-xs">₹{(r.holdAmount || 0).toLocaleString("en-IN")}</td>
                    <td><Badge tone={expiryTone(days)} dot>{expiryLabel(days)}</Badge></td>
                    <td>{r.renewal ? <Badge tone="success" dot>Tagged</Badge> : <span className="text-muted text-xs">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / limit))} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Insurance Entry" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Link to Case (optional)</Label>
            <Select value={form.caseId} onChange={(e) => handleCaseSelect(e.target.value)}>
              <option value="">Select disbursed case…</option>
              {cases.map((c) => <option key={c._id} value={c._id}>{c.caseCode} — {c.customer.firstName} {c.customer.lastName}</option>)}
            </Select>
          </div>
          <div><Label>Customer Name</Label><Input value={form.customerName} onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))} placeholder="Customer name" /></div>
          <div><Label>Vehicle Model</Label><Input value={form.vehicleModel} onChange={(e) => setForm((p) => ({ ...p, vehicleModel: e.target.value }))} placeholder="Model / Reg. No." /></div>
          <div><Label>Insurer *</Label><Input value={form.insurer} onChange={(e) => setForm((p) => ({ ...p, insurer: e.target.value }))} placeholder="e.g. ICICI Lombard" /></div>
          <div>
            <Label>Owner Type</Label>
            <Select value={form.ownerType} onChange={(e) => setForm((p) => ({ ...p, ownerType: e.target.value }))}>
              <option>Individual</option><option>Financer</option>
            </Select>
          </div>
          <div><Label>Start Date *</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} /></div>
          <div><Label>End Date *</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} /></div>
          <div><Label>Hold Amount (₹)</Label><Input type="number" value={form.holdAmount} onChange={(e) => setForm((p) => ({ ...p, holdAmount: e.target.value }))} placeholder="0" /></div>
          <div className="flex items-center gap-2 mt-6">
            <input type="checkbox" id="renewal" checked={form.renewal} onChange={(e) => setForm((p) => ({ ...p, renewal: e.target.checked }))} className="rounded" />
            <label htmlFor="renewal" className="text-sm font-medium">Tag for Renewal</label>
          </div>
          <div className="col-span-2 flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>Add Entry</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
