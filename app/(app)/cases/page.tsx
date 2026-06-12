"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Eye, MessageSquare } from "lucide-react";
import Link from "next/link";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Modal, Label, Textarea,
  Tabs, Pagination, EmptyState, Skeleton, useToast, type CaseStatus,
} from "../../../components/ui";
import { casesApi, CASE_STATUSES, type LoanCase, type PageMeta } from "../../../lib/api";

const STATUS_TABS = ["All", ...CASE_STATUSES];

export default function MyCasesPage() {
  const toast = useToast();
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [detailCase, setDetailCase] = useState<LoanCase | null>(null);
  const [remarkCase, setRemarkCase] = useState<LoanCase | null>(null);
  const [remark, setRemark] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 25;

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

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Cases</h1>
          <p className="text-sm text-muted mt-0.5">{meta.total} total cases</p>
        </div>
        <Link href="/new-lead">
          <Button size="sm"><Plus className="size-3.5" /> New Lead</Button>
        </Link>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, ID, or reg…" className="w-64" />
        </div>

        <div className="overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map((s) => ({ id: s, label: s }))}
            active={statusTab}
            onChange={(s) => { setStatusTab(s); setPage(1); }}
          />
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
                <tr key={c._id} className="cursor-pointer" onClick={() => setDetailCase(c)}>
                  <td className="font-mono text-xs text-primary font-semibold">{c.caseCode}</td>
                  <td className="text-xs text-muted">{new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                  <td className="font-medium text-sm">{c.customer.firstName} {c.customer.lastName}</td>
                  <td className="text-xs text-foreground-secondary">{c.product}</td>
                  <td className="text-xs text-foreground-secondary">{c.bankName ?? "—"}</td>
                  <td className="font-mono text-xs font-semibold">{c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}</td>
                  <td><CaseStatusBadge status={c.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDetailCase(c)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Eye className="size-3.5" /></button>
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

      {/* Case detail */}
      <Modal open={!!detailCase} onClose={() => setDetailCase(null)} title={detailCase?.caseCode ?? ""} size="lg">
        {detailCase && (
          <div className="space-y-4">
            <div className="flex items-center gap-2"><CaseStatusBadge status={detailCase.status} /></div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Customer", `${detailCase.customer.firstName} ${detailCase.customer.lastName}`],
                ["Contact", detailCase.customer.contact],
                ["Product", detailCase.product],
                ["Loan Amount", detailCase.loanAmount ? `₹${detailCase.loanAmount.toLocaleString("en-IN")}` : "—"],
                ["Bank", detailCase.bankName ?? "—"],
                ["Dealer", detailCase.dealerName ?? "—"],
                ["Coordinator", detailCase.coordinatorName ?? "—"],
                ["Location", detailCase.customer.location ?? "—"],
                ["Disbursed", detailCase.disbursementDate ? new Date(detailCase.disbursementDate).toLocaleDateString("en-IN") : "—"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <Label>{label as string}</Label>
                  <p className="text-sm font-medium mt-0.5">{value as string}</p>
                </div>
              ))}
            </div>
            {detailCase.remarks && <div className="p-3 bg-surface-2 rounded-lg text-sm text-muted">{detailCase.remarks}</div>}
          </div>
        )}
      </Modal>

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
    </div>
  );
}
