"use client";

import { IndianRupee, Lock, Phone } from "lucide-react";
import { Badge } from "../../../components/ui";

const ROWS = [
  { id: "p1", caseId: "CAR-2026-0148", customer: "Raj Kumar",    bank: "HDFC",  invoiceStatus: "Submitted", commission: "₹8,500", payoutAmt: "₹8,500", payoutDate: "20 Jun 2026", status: "Received" as const,  concern: "+91 98765 43210" },
  { id: "p2", caseId: "CAR-2026-0142", customer: "Mohan Lal",    bank: "IDFC",  invoiceStatus: "Draft",     commission: "₹7,800", payoutAmt: "—",       payoutDate: "—",           status: "Pending" as const,   concern: "+91 43210 98765" },
  { id: "p3", caseId: "TW-2026-0141",  customer: "Anita Roy",    bank: "Bajaj", invoiceStatus: "Submitted", commission: "₹1,200", payoutAmt: "₹1,200", payoutDate: "18 Jun 2026", status: "Received" as const,  concern: "+91 32109 87654" },
  { id: "p4", caseId: "PL-2026-0139",  customer: "Meera Gupta",  bank: "Axis",  invoiceStatus: "—",         commission: "—",      payoutAmt: "—",       payoutDate: "—",           status: "N/A" as const,       concern: "+91 76543 21098" },
];

const STATUS_TONE = { "Received": "success", "Pending": "warning", "N/A": "neutral" } as const;

export default function PayoutStatusPage() {
  const total = ROWS.reduce((a, r) => a + (r.payoutAmt !== "—" ? parseInt(r.payoutAmt.replace(/[₹,]/g, "")) : 0), 0);
  const pending = ROWS.filter((r) => r.status === "Pending").length;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Payout Status</h1>
        <p className="text-sm text-muted mt-0.5">View-only — contact admin for any discrepancies</p>
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-info-border bg-info-subtle text-info text-sm">
        <Lock className="size-4 shrink-0" />
        <span>This page is read-only. Payout amounts are managed by the finance team.</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Total Received</span>
          <Badge tone="success">₹{total.toLocaleString("en-IN")}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Pending Cases</span>
          <Badge tone="warning">{pending}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Total Cases</span>
          <Badge tone="neutral">{ROWS.length}</Badge>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Customer</th>
                <th>Bank</th>
                <th>Invoice Status</th>
                <th>Commission</th>
                <th>Payout Amount</th>
                <th>Payout Date</th>
                <th>Status</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs text-primary font-semibold">{r.caseId}</td>
                  <td className="font-medium text-sm">{r.customer}</td>
                  <td className="text-xs text-foreground-secondary">{r.bank}</td>
                  <td>
                    <Badge tone={r.invoiceStatus === "Submitted" ? "success" : r.invoiceStatus === "Draft" ? "warning" : "neutral"}>
                      {r.invoiceStatus}
                    </Badge>
                  </td>
                  <td className="font-mono text-xs font-semibold">{r.commission}</td>
                  <td className="font-mono text-xs font-semibold text-success">{r.payoutAmt}</td>
                  <td className="text-xs text-muted">{r.payoutDate}</td>
                  <td><Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge></td>
                  <td className="text-xs">
                    <span className="flex items-center gap-1 text-muted"><Phone className="size-3" />{r.concern}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
