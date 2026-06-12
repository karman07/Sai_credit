"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  Badge, Select, SearchInput, SectionHeader, Pagination, EmptyState, ProgressBar, Skeleton,
  Button, useToast,
} from "../../../components/ui";
import { rtoApi, type RTORecord } from "../../../lib/api";

const CHECK_FIELDS = [
  { key: "rtoOwnership", label: "RTO Ownership" },
  { key: "hypothecation", label: "Hypothecation" },
  { key: "bankNoc", label: "Bank NOC" },
  { key: "challanClearance", label: "Challan Clearance" },
  { key: "aadhaarMatch", label: "Aadhaar Match" },
] as const;

type StatusVal = "Received" | "Pending" | "Not Required";
const statusToneMap: Record<StatusVal, string> = {
  Received: "bg-success-subtle text-success border-success-border",
  Pending: "bg-warning-subtle text-warning border-warning-border",
  "Not Required": "bg-surface-3 text-muted border-border",
};

function progress(r: RTORecord) {
  const fields = CHECK_FIELDS.map((f) => r[f.key as keyof RTORecord] as string);
  const done = fields.filter((s) => s === "Received").length;
  const applicable = fields.filter((s) => s !== "Not Required").length;
  const pct = applicable > 0 ? Math.round((done / applicable) * 100) : 100;
  return { done, total: applicable, pct };
}

export default function RTOTrackerPage() {
  const toast = useToast();
  const [records, setRecords] = useState<RTORecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const limit = 10;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await rtoApi.list();
      setRecords(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load RTO records");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setExpanded((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const filtered = records.filter((r) => {
    const q = search.toLowerCase();
    return !q || (r.caseCode ?? "").toLowerCase().includes(q) || (r.customerName ?? "").toLowerCase().includes(q);
  });
  const paged = filtered.slice((page - 1) * limit, page * limit);

  const completeCount = records.filter((r) => progress(r).pct === 100).length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="RTO & Documentation Tracker"
        description="Track RTO compliance checklists per case"
        action={<Button variant="secondary" size="sm" onClick={load}><RefreshCw className="size-3.5" /> Refresh</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">Total Records</span><Badge tone="neutral">{records.length}</Badge></div>
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">Fully Complete</span><Badge tone="success">{completeCount}</Badge></div>
        <div className="card p-3 flex items-center justify-between"><span className="text-xs text-muted">In Progress</span><Badge tone="warning">{records.length - completeCount}</Badge></div>
      </div>

      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search case ID or customer…" className="w-64" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : paged.length === 0 ? (
        <EmptyState title="No RTO records found" description="Records are created when cases are processed." />
      ) : (
        <div className="space-y-2">
          {paged.map((r) => {
            const { done, total, pct } = progress(r);
            const isOpen = expanded.has(r._id);
            const tone = pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger";
            return (
              <div key={r._id} className="card p-0 overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-2 transition-colors"
                  onClick={() => toggle(r._id)}
                >
                  {isOpen ? <ChevronDown className="size-4 text-muted shrink-0" /> : <ChevronRight className="size-4 text-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-semibold">{r.caseCode ?? "—"}</span>
                      <span className="text-sm font-medium">{r.customerName ?? "—"}</span>
                    </div>
                    <div className="mt-1"><ProgressBar value={pct} tone={tone} size="sm" /></div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge tone={tone as any}>{done}/{total} complete</Badge>
                    <span className="text-xs text-muted font-mono">{pct}%</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {CHECK_FIELDS.map((f) => {
                        const val = (r[f.key as keyof RTORecord] ?? "Pending") as StatusVal;
                        return (
                          <div key={f.key} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-2">
                            <span className="text-xs font-medium text-foreground-secondary">{f.label}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusToneMap[val] ?? ""}`}>{val}</span>
                          </div>
                        );
                      })}
                      {r.nocHoldAmt > 0 && (
                        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-2">
                          <span className="text-xs font-medium text-foreground-secondary">NOC Hold Amt</span>
                          <span className="text-xs font-mono font-semibold">₹{r.nocHoldAmt.toLocaleString("en-IN")}</span>
                        </div>
                      )}
                    </div>
                    {r.aadhaarMismatchNote && (
                      <p className="mt-3 text-xs text-warning bg-warning-subtle rounded px-3 py-2">⚠ Aadhaar mismatch: {r.aadhaarMismatchNote}</p>
                    )}
                    {r.remarks && <p className="mt-2 text-xs text-muted bg-surface-2 rounded px-3 py-2">{r.remarks}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / limit))} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
    </div>
  );
}
