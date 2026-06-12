"use client";

import { useState } from "react";
import { BarChart3, Download, FileText, IndianRupee, ShieldCheck, Users, Building2, TrendingUp } from "lucide-react";
import { Button, Badge, Input, Label, SectionHeader, Pagination } from "../../../components/ui";

interface ReportType {
  id: string; title: string; description: string;
  icon: React.ElementType; accent: string;
}

const REPORT_TYPES: ReportType[] = [
  { id: "disbursement", title: "Disbursement Report", description: "All disbursed loans by bank, product, and coordinator", icon: IndianRupee, accent: "text-success" },
  { id: "rejection",    title: "Rejection Analysis",  description: "Rejected case breakdown with reason classification",  icon: TrendingUp,  accent: "text-danger" },
  { id: "payout",       title: "Payout Reconciliation", description: "Commission vs received payout matching",           icon: BarChart3,   accent: "text-primary" },
  { id: "insurance",    title: "Insurance Expiry",    description: "Upcoming and expired insurance policy list",         icon: ShieldCheck, accent: "text-warning" },
  { id: "coordinator",  title: "Coordinator Performance", description: "Case count, conversion, and disbursement per coordinator", icon: Users, accent: "text-purple" },
  { id: "bank",         title: "Bank Performance",    description: "Volume and approval rate per lending partner",       icon: Building2,   accent: "text-info" },
];

const PREVIEW_DATA: Record<string, { headers: string[]; rows: string[][] }> = {
  disbursement: {
    headers: ["Case ID", "Customer", "Bank", "Product", "Amount", "Date"],
    rows: [
      ["CAR-2026-0148", "Raj Kumar",    "HDFC",  "Car Loan",  "₹8,50,000",  "12 Jun 2026"],
      ["CAR-2026-0142", "Mohan Lal",    "IDFC",  "Car Loan",  "₹7,80,000",  "09 Jun 2026"],
      ["TW-2026-0141",  "Anita Roy",    "Bajaj", "Two Wheeler","₹1,20,000", "08 Jun 2026"],
      ["CAR-2026-0135", "Suresh Babu",  "Kotak", "Car Loan",  "₹11,00,000", "05 Jun 2026"],
    ],
  },
  rejection: {
    headers: ["Case ID", "Customer", "Bank", "Reason", "Date"],
    rows: [
      ["CAR-2026-0143", "Deepa Nair",  "HDFC",  "Low CIBIL score",     "09 Jun 2026"],
      ["PL-2026-0131",  "Kiran Kumar", "Axis",  "Income mismatch",     "04 Jun 2026"],
      ["BT-2026-0124",  "Ramesh Das",  "SBI",   "Existing loan burden","01 Jun 2026"],
    ],
  },
  payout: {
    headers: ["Bank", "Invoice Amt", "Received", "Pending", "Month"],
    rows: [
      ["HDFC",  "₹1,50,450", "₹1,50,450", "—",          "Jun 2026"],
      ["Kotak", "₹1,11,510", "₹1,11,510", "—",          "Jun 2026"],
      ["Axis",  "₹86,730",   "—",          "₹86,730",   "Jun 2026"],
    ],
  },
  insurance: {
    headers: ["Case ID", "Customer", "Insurer", "Expiry Date", "Days Left"],
    rows: [
      ["CAR-2026-0101", "Raj Kumar",    "ICICI Lombard", "14 Jun 2026", "2 days"],
      ["CAR-2026-0071", "Deepa Nair",   "HDFC Ergo",     "21 Jun 2026", "9 days"],
      ["CAR-2026-0098", "Priya Sharma", "HDFC Ergo",     "19 May 2026", "Expired"],
    ],
  },
  coordinator: {
    headers: ["Coordinator", "Total Cases", "Disbursed", "Conversion %", "Disbursed Amt"],
    rows: [
      ["Arjun Mehta",  "24", "19", "79%", "₹2.1Cr"],
      ["Kavya Reddy",  "19", "14", "73%", "₹1.7Cr"],
      ["Sanjay Kumar", "16", "11", "68%", "₹1.4Cr"],
    ],
  },
  bank: {
    headers: ["Bank", "Total Cases", "Approved", "Disbursed", "Rejected", "Approval %"],
    rows: [
      ["HDFC",  "48", "42", "38", "6",  "87%"],
      ["Kotak", "35", "30", "27", "5",  "85%"],
      ["Axis",  "29", "23", "21", "6",  "79%"],
    ],
  },
};

export default function ReportsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("2026-06-01");
  const [dateTo, setDateTo] = useState("2026-06-30");
  const [generated, setGenerated] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  const preview = selected ? PREVIEW_DATA[selected] : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      <SectionHeader
        title="Reports"
        description="Generate and export reports for compliance, analysis, and performance review"
      />

      {/* Report type selector */}
      <div>
        <p className="text-sm font-semibold mb-3">Select Report Type</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.id}
              onClick={() => { setSelected(r.id); setGenerated(false); }}
              className={`card p-4 text-left transition-all hover:shadow-md ${
                selected === r.id
                  ? "border-primary bg-primary-subtle ring-1 ring-primary"
                  : "hover:border-primary/40"
              }`}
            >
              <r.icon className={`size-5 mb-2 ${r.accent}`} />
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-xs text-muted mt-1 leading-relaxed">{r.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Date range + generate */}
      {selected && (
        <div className="card flex items-end gap-4 flex-wrap animate-fadeIn">
          <div>
            <Label>From Date</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label>To Date</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => setGenerated(true)}>
            <BarChart3 className="size-3.5" /> Generate Report
          </Button>
          {generated && (
            <Button variant="secondary">
              <Download className="size-3.5" /> Export to Excel
            </Button>
          )}
          {generated && (
            <Button variant="secondary">
              <FileText className="size-3.5" /> Export to PDF
            </Button>
          )}
        </div>
      )}

      {/* Preview table */}
      {generated && preview && (
        <div className="card p-0 overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <p className="font-semibold text-sm">{REPORT_TYPES.find((r) => r.id === selected)?.title}</p>
              <p className="text-xs text-muted">{dateFrom} to {dateTo} · {preview.rows.length} records</p>
            </div>
            <Badge tone="success" dot>Preview</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>{preview.headers.map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className={j === 0 ? "font-mono text-xs text-primary font-semibold" : "text-sm"}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={1} total={preview.rows.length} limit={limit} onPage={setPage} onLimit={() => {}} />
        </div>
      )}

      {!selected && (
        <div className="card flex items-center justify-center h-32 text-sm text-muted">
          Select a report type above to get started
        </div>
      )}
    </div>
  );
}
