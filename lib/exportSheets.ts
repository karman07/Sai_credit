import { API_BASE, formSchemasApi, type InsuranceMIS, type LoanCase, type PayoutRecord } from "./api";
import { customKeys, xlCell, xlDate, type XlsxSheet } from "./excel";

const dateTime = (d?: string) => { if (!d) return ""; const t = new Date(d); return isNaN(t.getTime()) ? "" : t.toLocaleString("en-IN"); };
const fullName = (c: LoanCase) => `${c.customer.firstName} ${c.customer.lastName}`.trim();
/** Form Builder label for every custom (non-core) field key, so export headers read like the forms do. */
export async function customLabels(): Promise<Record<string, string>> {
  try {
    const { data } = await formSchemasApi.list();
    const labels: Record<string, string> = {};
    for (const form of data) for (const sec of form.sections) for (const f of sec.fields) if (!f.isCore) labels[f.key] ??= f.label;
    return labels;
  } catch {
    return {}; // fall back to the raw field keys rather than failing the export
  }
}
export const customHead = (key: string, labels: Record<string, string>) => labels[key] ?? key;

/** A custom-field value as a cell; uploaded files become full download links instead of bare "/uploads/…" paths. */
export function customCell(v: unknown): string | number {
  return typeof v === "string" && v.startsWith("/uploads/") ? link(v) : xlCell(v);
}

const link = (url?: string) => (url ? (url.startsWith("http") ? url : API_BASE.replace("/api/v1", "") + url) : "");

/**
 * Every case field as spreadsheet sheets: "Cases" (all core fields, every custom field, each pipeline
 * stage's status/date/user/remarks), plus "Documents" and "Document Requests" with one row per item.
 */
export function buildCaseSheets(rows: LoanCase[], labels: Record<string, string> = {}): XlsxSheet[] {
  const ck = customKeys(rows);
  const stages = [...new Set(rows.flatMap((c) => (c.pipeline ?? []).map((p) => p.stage)))];

  return [
    {
      name: "Cases",
      headers: ["Case ID", "Date", "Status", "Customer", "Father's Name", "Phone", "Alt Phone", "City", "State", "District", "Pin Code",
        "Residential Status", "E-Bill Owner", "Product", "Loan Type", "Firm", "Vehicle Model", "Reg. Number", "Owner Serial",
        "Existing Insurer", "Hypothecation", "NOC Required", "Challans", "Loan Amount", "Bank", "Branch", "BM Name", "BM Contact",
        "Bank Executive", "Dealer", "Payout %", "Disbursed On", "Assigned To", "Coordinator", "Documents Uploaded",
        "Open Doc Requests", "Total Doc Requests", "Document Names", "Remarks", "Created On",
        ...stages.flatMap((st) => [`${st} — Status`, `${st} — Done On`, `${st} — Done By`, `${st} — Remarks`]),
        ...ck.map((k) => customHead(k, labels))],
      rows: rows.map((c) => [
        c.caseCode, xlDate(c.date), c.status, fullName(c), c.customer.fatherName ?? "", c.customer.contact ?? "", c.customer.altContact ?? "",
        c.customer.location ?? "", c.customer.state ?? "", c.customer.district ?? "", c.customer.pinCode ?? "",
        c.customer.residentialStatus ?? "", xlCell(c.customer.ebillOwner), c.product ?? "", c.loanType ?? "", c.firm ?? "",
        c.vehicleModel ?? "", c.regNumber ?? "", c.ownerSerial ?? "", c.existingInsurer ?? "", xlCell(c.hypothecation),
        xlCell(c.nocRequired), c.challanCount ?? 0, c.loanAmount ?? 0, c.bankName ?? "", c.bankBranch ?? "", c.bmName ?? "",
        c.bmContact ?? "", c.bankExecutive ?? "", c.dealerName ?? "", c.payoutPct ?? 0, xlDate(c.disbursementDate),
        c.assignedToName ?? "", (c as any).coordinatorName ?? "", (c.documents ?? []).length,
        (c.docRequests ?? []).filter((d) => !d.isResolved).length, (c.docRequests ?? []).length,
        (c.documents ?? []).map((d) => `${d.docType}: ${d.fileName}`).join("; "), c.remarks ?? "", xlDate(c.createdAt),
        ...stages.flatMap((st) => {
          const p = c.pipeline?.find((x) => x.stage === st);
          return [p?.status ?? "", xlDate(p?.doneAt), p?.doneByName ?? "", p?.remarks ?? ""];
        }),
        ...ck.map((k) => customCell(c.customFields?.[k])),
      ]),
    },
    {
      name: "Documents",
      headers: ["Case ID", "Customer", "Document Type", "File Name", "Link", "Remarks", "Uploaded By", "Uploaded On"],
      rows: rows.flatMap((c) => (c.documents ?? []).map((d) => [
        c.caseCode, fullName(c), d.docType, d.fileName, link(d.url), d.remarks ?? "", d.uploadedByName, dateTime(d.uploadedAt),
      ])),
    },
    {
      name: "Document Requests",
      headers: ["Case ID", "Customer", "Documents Requested", "Remarks", "Requested By", "Requested On", "Resolved", "Resolved On"],
      rows: rows.flatMap((c) => (c.docRequests ?? []).map((r) => [
        c.caseCode, fullName(c), r.docTypes.join(", "), r.remarks, r.requestedByName, dateTime(r.requestedAt),
        r.isResolved ? "Yes" : "No", dateTime(r.resolvedAt),
      ])),
    },
  ];
}

/** Every payout field + custom fields, with a second sheet listing each linked case. */
export function buildPayoutSheets(records: PayoutRecord[], labels: Record<string, string> = {}): XlsxSheet[] {
  const ck = customKeys(records);
  return [
    {
      name: "Payouts",
      headers: ["Month", "Bank", "Company", "Invoice Date", "Invoice No.", "Invoice Status", "Cases", "Linked Cases", "Invoice Amount",
        "Commission", "CGST", "SGST", "GST", "Total", "Payout Status", "Payout Date", "Remarks", "Created On", ...ck.map((k) => customHead(k, labels))],
      rows: records.map((r) => [
        r.businessMonth, r.bankName ?? "", r.company ?? "", xlDate(r.invoiceDate), r.invoiceNumber ?? "", r.invoiceStatus, r.volumeCases,
        (r.linkedCases ?? []).map((c) => c.caseCode).join(", "), r.invoiceAmount, r.commission, r.cgstAmount, r.sgstAmount, r.gstAmount,
        r.totalAmount, r.payoutStatus, xlDate(r.payoutDate), r.remarks ?? "", xlDate(r.createdAt), ...ck.map((k) => customCell(r.customFields?.[k])),
      ]),
    },
    {
      name: "Linked Cases",
      headers: ["Month", "Bank", "Invoice No.", "Case ID", "Customer", "Loan Amount"],
      rows: records.flatMap((r) => (r.linkedCases ?? []).map((c) => [
        r.businessMonth, r.bankName ?? "", r.invoiceNumber ?? "", c.caseCode, c.customerName ?? "", c.loanAmount ?? 0,
      ])),
    },
  ];
}

/** Every insurance entry field + custom fields, with a renewal-history sheet. */
export function buildInsuranceSheets(records: InsuranceMIS[], labels: Record<string, string> = {}): XlsxSheet[] {
  const ck = customKeys(records);
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
  return [
    {
      name: "Insurance",
      headers: ["Case ID", "Customer", "Customer Email", "Vehicle", "Insurer", "Policy", "Coverage", "Vehicle Type", "Owner Type", "Premium",
        "Insured Name", "Agent", "Start Date", "End Date", "Days Left", "Reminder Date", "Hold Amount", "Renewal Tagged", "Times Renewed",
        "Last Renewed", "Active", "Created By", "Created On", ...ck.map((k) => customHead(k, labels))],
      rows: records.map((e) => [
        e.caseCode ?? "", e.customerName ?? "", e.customerEmail ?? "", e.vehicleModel ?? "", e.insurer, e.policyName ?? "",
        e.coverageType ?? "", e.vehicleType ?? "", e.ownerType, e.premiumAmount, e.insuredName ?? "", e.agentName ?? "",
        xlDate(e.startDate), xlDate(e.endDate), daysLeft(e.endDate), xlDate(e.reminderDate), e.holdAmount, e.renewal ? "Yes" : "No",
        (e.renewalHistory ?? []).length, xlDate(e.lastRenewedAt), e.isActive ? "Yes" : "No", e.createdByName ?? "", xlDate(e.createdAt),
        ...ck.map((k) => customCell(e.customFields?.[k])),
      ]),
    },
    {
      name: "Renewal History",
      headers: ["Case ID", "Customer", "Insurer", "Renewed On", "Old End Date", "New End Date", "Renewed By"],
      rows: records.flatMap((e) => (e.renewalHistory ?? []).map((h) => [
        e.caseCode ?? "", e.customerName ?? "", e.insurer, xlDate(h.renewedAt), xlDate(h.oldEndDate), xlDate(h.newEndDate), h.renewedByName ?? "",
      ])),
    },
  ];
}
