"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Check, Clock, Minus, Download } from "lucide-react";
import {
  Button, Badge, Tabs, SectionHeader, Pagination, Modal, Input, Label, Select,
  EmptyState, Skeleton, useToast, type BadgeTone,
} from "../../../components/ui";
import { payoutApi, banksApi, type PayoutRecord, type Bank } from "../../../lib/api";

const statusTone: Record<string, BadgeTone> = {
  "Received": "success", "Pending": "warning", "Not Applicable": "neutral",
};
const statusIcon: Record<string, React.ElementType> = {
  "Received": Check, "Pending": Clock, "Not Applicable": Minus,
};
function fmt(n: number) { return n ? `₹${n.toLocaleString("en-IN")}` : "—"; }

export default function PayoutPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PayoutRecord[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [activeMonth, setActiveMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const [form, setForm] = useState({
    businessMonth: "", bankId: "", company: "SAI Finance",
    volumeCases: "", invoiceStatus: "Draft", invoiceAmount: "",
    commission: "", gstAmount: "", totalAmount: "", payoutStatus: "Pending", remarks: "",
  });

  const loadMonths = useCallback(async () => {
    try {
      const { data } = await payoutApi.months();
      const sorted = data.sort().reverse();
      setMonths(sorted);
      if (sorted.length > 0) setActiveMonth(sorted[0]);
    } catch {}
  }, []);

  const loadRows = useCallback(async (month: string) => {
    if (!month) return;
    try {
      setLoading(true);
      const { data } = await payoutApi.list(month);
      setRows(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load payout records");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMonths();
    banksApi.list().then(({ data }) => setBanks(data)).catch(() => {});
  }, [loadMonths]);

  useEffect(() => { if (activeMonth) loadRows(activeMonth); }, [activeMonth, loadRows]);

  async function save() {
    if (!form.businessMonth) { toast("error", "Month is required"); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        volumeCases: Number(form.volumeCases) || 0,
        invoiceAmount: Number(form.invoiceAmount) || 0,
        commission: Number(form.commission) || 0,
        gstAmount: Number(form.gstAmount) || 0,
        totalAmount: Number(form.totalAmount) || 0,
      };
      await payoutApi.create(body);
      toast("success", "Payout record added");
      setAddOpen(false);
      if (form.businessMonth === activeMonth) loadRows(activeMonth);
      else { loadMonths(); setActiveMonth(form.businessMonth); }
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const paged = rows.slice((page - 1) * limit, page * limit);
  const totalCommission = rows.reduce((a, r) => a + (r.commission || 0), 0);
  const totalGst = rows.reduce((a, r) => a + (r.gstAmount || 0), 0);
  const totalAmt = rows.reduce((a, r) => a + (r.totalAmount || 0), 0);

  const monthTabs = months.map((m) => ({ id: m, label: m }));

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Payout Management"
        description="Track monthly commission invoices and payout status per bank"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm"><Download className="size-3.5" /> Export</Button>
            <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-3.5" /> Add Record</Button>
          </div>
        }
      />

      {months.length > 0 && (
        <Tabs tabs={monthTabs} active={activeMonth} onChange={(m) => { setActiveMonth(m); setPage(1); }} />
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th><th>Bank</th><th>Vol. Cases</th><th>Invoice Status</th>
                <th>Commission</th><th>GST</th><th>Total</th><th>Payout Status</th><th>Payout Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 9 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={9}><EmptyState title={activeMonth ? `No payout records for ${activeMonth}` : "No records yet"} description="Add your first payout record above." /></td></tr>
              ) : paged.map((r) => {
                const StatusIcon = statusIcon[r.payoutStatus] ?? Minus;
                return (
                  <tr key={r._id}>
                    <td className="text-sm font-medium">{r.company ?? "SAI Finance"}</td>
                    <td className="font-semibold text-sm">{r.bankName ?? "—"}</td>
                    <td className="font-mono font-bold text-sm">{r.volumeCases}</td>
                    <td><Badge tone={r.invoiceStatus === "Submitted" ? "success" : r.invoiceStatus === "Draft" ? "warning" : "neutral"}>{r.invoiceStatus}</Badge></td>
                    <td className="font-mono text-sm">{fmt(r.commission)}</td>
                    <td className="font-mono text-xs text-muted">{fmt(r.gstAmount)}</td>
                    <td className="font-mono font-bold text-sm">{fmt(r.totalAmount)}</td>
                    <td>
                      <Badge tone={statusTone[r.payoutStatus] ?? "neutral"} dot>
                        <StatusIcon className="size-3" /> {r.payoutStatus}
                      </Badge>
                    </td>
                    <td className="text-xs text-muted">{r.payoutDate ? new Date(r.payoutDate).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                );
              })}
              {!loading && rows.length > 0 && (
                <tr className="bg-surface-2 font-semibold border-t-2 border-border">
                  <td colSpan={4} className="text-right text-xs uppercase tracking-wide text-muted pr-4">Month Total</td>
                  <td className="font-mono font-bold">{fmt(totalCommission)}</td>
                  <td className="font-mono text-muted">{fmt(totalGst)}</td>
                  <td className="font-mono font-bold text-primary">{fmt(totalAmt)}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(rows.length / limit))} total={rows.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Payout Record" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Business Month *</Label><Input value={form.businessMonth} onChange={(e) => setForm((p) => ({ ...p, businessMonth: e.target.value }))} placeholder="YYYY-MM (e.g. 2026-06)" /></div>
          <div>
            <Label>Bank</Label>
            <Select value={form.bankId} onChange={(e) => setForm((p) => ({ ...p, bankId: e.target.value }))}>
              <option value="">Select bank…</option>
              {banks.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </Select>
          </div>
          <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} /></div>
          <div><Label>Volume (Cases)</Label><Input type="number" value={form.volumeCases} onChange={(e) => setForm((p) => ({ ...p, volumeCases: e.target.value }))} /></div>
          <div>
            <Label>Invoice Status</Label>
            <Select value={form.invoiceStatus} onChange={(e) => setForm((p) => ({ ...p, invoiceStatus: e.target.value }))}>
              {["Draft", "Submitted", "Not Submitted"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <div><Label>Commission (₹)</Label><Input type="number" value={form.commission} onChange={(e) => setForm((p) => ({ ...p, commission: e.target.value }))} /></div>
          <div><Label>GST (₹)</Label><Input type="number" value={form.gstAmount} onChange={(e) => setForm((p) => ({ ...p, gstAmount: e.target.value }))} /></div>
          <div><Label>Total Amount (₹)</Label><Input type="number" value={form.totalAmount} onChange={(e) => setForm((p) => ({ ...p, totalAmount: e.target.value }))} /></div>
          <div>
            <Label>Payout Status</Label>
            <Select value={form.payoutStatus} onChange={(e) => setForm((p) => ({ ...p, payoutStatus: e.target.value }))}>
              {["Pending", "Received", "Not Applicable"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <div><Label>Remarks</Label><Input value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} /></div>
          <div className="col-span-2 flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>Add Record</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
