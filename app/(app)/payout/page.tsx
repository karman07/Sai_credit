"use client";

import { useState, useEffect } from "react";
import { IndianRupee, Lock, Building2 } from "lucide-react";
import { Badge, Skeleton, EmptyState } from "../../../components/ui";
import { payoutApi, type PayoutRecord } from "../../../lib/api";

const INVOICE_TONE: Record<string, "success" | "warning" | "neutral"> = {
  Approved:  "success",
  Submitted: "warning",
  Draft:     "neutral",
};
const PAYOUT_TONE: Record<string, "success" | "warning" | "neutral"> = {
  Received: "success",
  Pending:  "warning",
  "N/A":    "neutral",
};

function fmt(n: number) {
  return n > 0 ? `₹${n.toLocaleString("en-IN")}` : "—";
}

export default function PayoutStatusPage() {
  const [months, setMonths]               = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [records, setRecords]             = useState<PayoutRecord[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    payoutApi.months()
      .then((r) => {
        const ms = r.data;
        setMonths(ms);
        if (ms.length > 0) setSelectedMonth(ms[0]);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    payoutApi.list(selectedMonth)
      .then((r) => setRecords(r.data))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  const totalReceived = records
    .filter((r) => r.payoutStatus === "Received")
    .reduce((a, r) => a + r.totalAmount, 0);
  const totalPending = records
    .filter((r) => r.payoutStatus === "Pending")
    .reduce((a, r) => a + r.commission, 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Payout Status</h1>
        <p className="text-sm text-muted mt-0.5">View-only — contact admin for any discrepancies</p>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-info-border bg-info-subtle text-info text-sm">
        <Lock className="size-4 shrink-0" />
        <span>Payout amounts are managed by the finance team. This page is read-only.</span>
      </div>

      {/* Month tabs */}
      {months.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {months.slice(0, 12).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedMonth === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-foreground-secondary hover:text-foreground border border-border"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Summary strip */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">Received</span>
            <Badge tone="success">{fmt(totalReceived)}</Badge>
          </div>
          <div className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">Pending</span>
            <Badge tone="warning">{fmt(totalPending)}</Badge>
          </div>
          <div className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">Banks</span>
            <Badge tone="neutral">{records.length}</Badge>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={IndianRupee}
            title="No payout data"
            description={
              selectedMonth
                ? `No payout records for ${selectedMonth}.`
                : "No payout months available yet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank / NBFC</th>
                  <th>Cases</th>
                  <th>Invoice Status</th>
                  <th>Commission</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Payout Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 className="size-3.5 text-muted shrink-0" />
                        <span className="font-medium text-sm">{r.bankName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs font-semibold">{r.volumeCases}</td>
                    <td>
                      <Badge tone={INVOICE_TONE[r.invoiceStatus] ?? "neutral"}>
                        {r.invoiceStatus}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs font-semibold">{fmt(r.commission)}</td>
                    <td className="font-mono text-xs text-muted">{fmt(r.gstAmount)}</td>
                    <td className="font-mono text-xs font-bold text-primary">{fmt(r.totalAmount)}</td>
                    <td>
                      <Badge tone={PAYOUT_TONE[r.payoutStatus] ?? "neutral"} dot>
                        {r.payoutStatus}
                      </Badge>
                    </td>
                    <td className="text-xs text-muted">
                      {r.payoutDate
                        ? new Date(r.payoutDate).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
