import { API_BASE, formSchemasApi, type InsuranceMIS, type LoanCase, type PayoutRecord, type RTORecord } from "./api";
import { customKeys, xlCell, xlDate, type XlsxSheet } from "./excel";

const dateTime = (d?: string) => { if (!d) return ""; const t = new Date(d); return isNaN(t.getTime()) ? "" : t.toLocaleString("en-IN"); };
const fullName = (c: LoanCase) => `${c.customer.firstName} ${c.customer.lastName}`.trim();
export type CustomDef = { key: string; label: string; active: boolean; core?: boolean };

/**
 * Everything Form Builder says about one kind of record, in Form Builder order: built-in ("core") fields
 * (so a hidden or renamed one is reflected in the export) and custom fields (so every defined field gets a
 * column, even one nobody has filled in yet). "case" = the New Case form plus all product forms.
 */
export async function loadCustomDefs(scope: "case" | "payout" | "insurance" | "rto"): Promise<CustomDef[]> {
  try {
    const { data } = await formSchemasApi.list();
    const match = (id: string) => (scope === "case" ? id === "new-case" || id.startsWith("product-fields:") : id === scope);
    const defs = new Map<string, CustomDef>();
    for (const form of data) {
      if (!match(form.formId)) continue;
      const sections = [...form.sections].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      for (const sec of sections) {
        const fields = [...sec.fields].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        for (const f of fields) {
          const key = f.isCore ? "core:" + f.key : f.key;
          if (defs.has(key)) continue;
          defs.set(key, { key: f.key, label: f.label, active: f.isActive !== false, core: !!f.isCore });
        }
      }
    }
    return [...defs.values()];
  } catch {
    return []; // fall back to the custom keys found in the data rather than failing the export
  }
}

/**
 * Export columns for custom fields, driven by Form Builder: every active custom field in Form Builder order,
 * labelled as Form Builder labels it. A hidden or deleted field is not exported. Only if the schema could not be
 * loaded at all do we fall back to whatever custom keys hold data.
 */
export function customColumns(items: { customFields?: Record<string, any> }[], defs: CustomDef[]) {
  const custom = defs.filter((d) => !d.core);
  const keys = defs.length ? custom.filter((d) => d.active).map((d) => d.key) : customKeys(items);
  const labelOf = new Map(custom.map((d) => [d.key, d.label]));
  return { keys, head: (k: string) => labelOf.get(k) ?? k };
}

export type Spec<T> = { key?: string; label: string; get: (r: T) => any };

/**
 * Columns for one table. A spec with a Form Builder `key` follows the schema (dropped when hidden there,
 * headed with the label Form Builder gives it); a spec without one is always-present system data.
 */
export function resolveSpecs<T>(specs: Spec<T>[], defs: CustomDef[]): Spec<T>[] {
  const core = new Map(defs.filter((d) => d.core).map((d) => [d.key, d]));
  return specs
    .filter((s) => !s.key || core.get(s.key)?.active !== false)
    .map((s) => (s.key && core.get(s.key)?.label?.trim() ? { ...s, label: core.get(s.key)!.label.trim() } : s));
}

/** A custom-field value as a cell; uploaded files become full download links instead of bare "/uploads/…" paths. */
export function customCell(v: unknown): string | number {
  return typeof v === "string" && v.startsWith("/uploads/") ? link(v) : xlCell(v);
}


const yn = (v: unknown) => xlCell(v);
/** Built-in case columns. `key` ties a column to its Form Builder field so hiding/renaming there carries through. */
const CASE_SPECS: Spec<LoanCase>[] = [
  { label: "Case ID", get: (c) => c.caseCode },
  { label: "Date", get: (c) => xlDate(c.date) },
  { label: "Status", get: (c) => c.status },
  { label: "Customer", get: (c) => fullName(c) },
  { key: "fatherName", label: "Father's Name", get: (c) => c.customer.fatherName ?? "" },
  { key: "contact", label: "Phone", get: (c) => c.customer.contact ?? "" },
  { key: "altContact", label: "Alt Phone", get: (c) => c.customer.altContact ?? "" },
  { key: "location", label: "City", get: (c) => c.customer.location ?? "" },
  { key: "state", label: "State", get: (c) => c.customer.state ?? "" },
  { key: "district", label: "District", get: (c) => c.customer.district ?? "" },
  { key: "pinCode", label: "Pin Code", get: (c) => c.customer.pinCode ?? "" },
  { key: "residentialStatus", label: "Residential Status", get: (c) => c.customer.residentialStatus ?? "" },
  { key: "ebillOwner", label: "E-Bill Owner", get: (c) => yn(c.customer.ebillOwner) },
  { key: "product", label: "Product", get: (c) => c.product ?? "" },
  { key: "loanType", label: "Loan Type", get: (c) => c.loanType ?? "" },
  { key: "firm", label: "Firm", get: (c) => c.firm ?? "" },
  { key: "vehicleModel", label: "Vehicle Model", get: (c) => c.vehicleModel ?? "" },
  { key: "regNumber", label: "Reg. Number", get: (c) => c.regNumber ?? "" },
  { key: "ownerSerial", label: "Owner Serial", get: (c) => c.ownerSerial ?? "" },
  { key: "existingInsurer", label: "Existing Insurer", get: (c) => c.existingInsurer ?? "" },
  { key: "hypothecation", label: "Hypothecation", get: (c) => yn(c.hypothecation) },
  { key: "nocRequired", label: "NOC Required", get: (c) => yn(c.nocRequired) },
  { key: "challanCount", label: "Challans", get: (c) => c.challanCount ?? 0 },
  { key: "loanAmount", label: "Loan Amount", get: (c) => c.loanAmount ?? 0 },
  { key: "bank", label: "Bank", get: (c) => c.bankName ?? "" },
  { key: "branch", label: "Branch", get: (c) => c.bankBranch ?? "" },
  { key: "bmName", label: "BM Name", get: (c) => c.bmName ?? "" },
  { key: "bmContact", label: "BM Contact", get: (c) => c.bmContact ?? "" },
  { key: "executive", label: "Bank Executive", get: (c) => c.bankExecutive ?? "" },
  { key: "dealer", label: "Dealer", get: (c) => c.dealerName ?? "" },
  { key: "payoutPct", label: "Payout %", get: (c) => c.payoutPct ?? 0 },
  { label: "Disbursed On", get: (c) => xlDate(c.disbursementDate) },
  { label: "Assigned To", get: (c) => c.assignedToName ?? "" },
  { label: "Coordinator", get: (c) => (c as any).coordinatorName ?? "" },
  { label: "Documents Uploaded", get: (c) => (c.documents ?? []).length },
  { label: "Open Doc Requests", get: (c) => (c.docRequests ?? []).filter((d) => !d.isResolved).length },
  { label: "Total Doc Requests", get: (c) => (c.docRequests ?? []).length },
  { label: "Document Names", get: (c) => (c.documents ?? []).map((d) => `${d.docType}: ${d.fileName}`).join("; ") },
  { key: "remarks", label: "Remarks", get: (c) => c.remarks ?? "" },
  { label: "Created On", get: (c) => xlDate(c.createdAt) },
];

const PAYOUT_SPECS: Spec<PayoutRecord>[] = [
  { key: "businessMonth", label: "Month", get: (r) => r.businessMonth },
  { label: "Bank", get: (r) => r.bankName ?? "" },
  { key: "company", label: "Company", get: (r) => r.company ?? "" },
  { key: "invoiceDate", label: "Invoice Date", get: (r) => xlDate(r.invoiceDate) },
  { key: "invoiceNumber", label: "Invoice No.", get: (r) => r.invoiceNumber ?? "" },
  { key: "invoiceStatus", label: "Invoice Status", get: (r) => r.invoiceStatus },
  { label: "Cases", get: (r) => r.volumeCases },
  { label: "Linked Cases", get: (r) => (r.linkedCases ?? []).map((c) => c.caseCode).join(", ") },
  { key: "invoiceAmount", label: "Invoice Amount", get: (r) => r.invoiceAmount },
  { key: "commission", label: "Commission", get: (r) => r.commission },
  { key: "cgstAmount", label: "CGST", get: (r) => r.cgstAmount },
  { key: "sgstAmount", label: "SGST", get: (r) => r.sgstAmount },
  { label: "GST", get: (r) => r.gstAmount },
  { key: "totalAmount", label: "Total", get: (r) => r.totalAmount },
  { key: "payoutStatus", label: "Payout Status", get: (r) => r.payoutStatus },
  { key: "payoutDate", label: "Payout Date", get: (r) => xlDate(r.payoutDate) },
  { key: "remarks", label: "Remarks", get: (r) => r.remarks ?? "" },
  { label: "Created On", get: (r) => xlDate(r.createdAt) },
];

const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
const INSURANCE_SPECS: Spec<InsuranceMIS>[] = [
  { label: "Case ID", get: (e) => e.caseCode ?? "" },
  { key: "customerName", label: "Customer", get: (e) => e.customerName ?? "" },
  { label: "Customer Email", get: (e) => e.customerEmail ?? "" },
  { key: "vehicleModel", label: "Vehicle", get: (e) => e.vehicleModel ?? "" },
  { key: "insurer", label: "Insurer", get: (e) => e.insurer },
  { key: "policyId", label: "Policy", get: (e) => e.policyName ?? "" },
  { key: "coverageType", label: "Coverage", get: (e) => e.coverageType ?? "" },
  { key: "vehicleType", label: "Vehicle Type", get: (e) => e.vehicleType ?? "" },
  { key: "ownerType", label: "Owner Type", get: (e) => e.ownerType },
  { key: "premiumAmount", label: "Premium", get: (e) => e.premiumAmount },
  { key: "insuredName", label: "Insured Name", get: (e) => e.insuredName ?? "" },
  { key: "agentName", label: "Agent", get: (e) => e.agentName ?? "" },
  { key: "startDate", label: "Start Date", get: (e) => xlDate(e.startDate) },
  { key: "endDate", label: "End Date", get: (e) => xlDate(e.endDate) },
  { label: "Days Left", get: (e) => daysLeft(e.endDate) },
  { key: "reminderDate", label: "Reminder Date", get: (e) => xlDate(e.reminderDate) },
  { key: "holdAmount", label: "Hold Amount", get: (e) => e.holdAmount },
  { key: "renewal", label: "Renewal Tagged", get: (e) => (e.renewal ? "Yes" : "No") },
  { label: "Times Renewed", get: (e) => (e.renewalHistory ?? []).length },
  { label: "Last Renewed", get: (e) => xlDate(e.lastRenewedAt) },
  { label: "Active", get: (e) => (e.isActive ? "Yes" : "No") },
  { label: "Created By", get: (e) => e.createdByName ?? "" },
  { label: "Created On", get: (e) => xlDate(e.createdAt) },
];

const link = (url?: string) => (url ? (url.startsWith("http") ? url : API_BASE.replace("/api/v1", "") + url) : "");

/**
 * Every case field as spreadsheet sheets: "Cases" (all core fields, every custom field, each pipeline
 * stage's status/date/user/remarks), plus "Documents" and "Document Requests" with one row per item.
 */
export function buildCaseSheets(rows: LoanCase[], defs: CustomDef[] = []): XlsxSheet[] {
  const cc = customColumns(rows, defs);
  const ck = cc.keys;
  const stages = [...new Set(rows.flatMap((c) => (c.pipeline ?? []).map((p) => p.stage)))];
  const stageHead = stages.flatMap((st) => [`${st} — Status`, `${st} — Done On`, `${st} — Done By`, `${st} — Remarks`]);
  const cs = resolveSpecs(CASE_SPECS, defs);

  return [
    {
      name: "Cases",
      headers: [...cs.map((x) => x.label), ...stageHead, ...ck.map(cc.head)],
      rows: rows.map((c) => [
        ...cs.map((x) => x.get(c)),
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
export function buildPayoutSheets(records: PayoutRecord[], defs: CustomDef[] = []): XlsxSheet[] {
  const ps = resolveSpecs(PAYOUT_SPECS, defs);
  const cc = customColumns(records, defs);
  const ck = cc.keys;
  return [
    {
      name: "Payouts",
      headers: [...ps.map((x) => x.label), ...ck.map(cc.head)],
      rows: records.map((r) => [...ps.map((x) => x.get(r)), ...ck.map((k) => customCell(r.customFields?.[k]))]),
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
export function buildInsuranceSheets(records: InsuranceMIS[], defs: CustomDef[] = []): XlsxSheet[] {
  const ins = resolveSpecs(INSURANCE_SPECS, defs);
  const cc = customColumns(records, defs);
  const ck = cc.keys;
  return [
    {
      name: "Insurance",
      headers: [...ins.map((x) => x.label), ...ck.map(cc.head)],
      rows: records.map((e) => [...ins.map((x) => x.get(e)), ...ck.map((k) => customCell(e.customFields?.[k]))]),
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

type RtoRow = { c: LoanCase; r?: RTORecord | null };
const RTO_SPECS = (progress: (r?: RTORecord | null) => number): Spec<RtoRow>[] => [
  { label: "Case ID", get: ({ c }) => c.caseCode },
  { label: "Customer", get: ({ c }) => fullName(c) },
  { label: "Phone", get: ({ c }) => c.customer.contact ?? "" },
  { label: "Vehicle", get: ({ c }) => c.vehicleModel ?? "" },
  { label: "Reg. Number", get: ({ c }) => c.regNumber ?? "" },
  { label: "Bank", get: ({ c }) => c.bankName ?? "" },
  { label: "Dealer", get: ({ c }) => c.dealerName ?? "" },
  { label: "Sales Rep", get: ({ c }) => c.assignedToName ?? "" },
  { label: "RTO Status", get: ({ r }) => r?.status ?? "Not started" },
  { label: "Progress %", get: ({ r }) => progress(r) },
  { label: "RTO Owner", get: ({ r }) => r?.rtoOwnerName ?? "" },
  { label: "Open Doc Requests", get: ({ r }) => (r?.docRequests ?? []).filter((d) => !d.isResolved).length },
  { label: "Total Doc Requests", get: ({ r }) => (r?.docRequests ?? []).length },
  { label: "Completed On", get: ({ r }) => xlDate(r?.completedAt) },
  { key: "rtoOwnershipType", label: "Ownership Type", get: ({ r }) => r?.rtoOwnershipType ?? "" },
  { key: "rtoOwnership", label: "RTO Ownership", get: ({ r }) => r?.rtoOwnership ?? "" },
  { key: "rtoReceiving", label: "RTO Receiving", get: ({ r }) => (r ? (r.rtoReceiving ? "Yes" : "No") : "") },
  { key: "challanCheck", label: "Challan Check", get: ({ r }) => r?.challanCheck ?? "" },
  { key: "bankNocCheck", label: "Bank NOC", get: ({ r }) => r?.bankNocCheck ?? "" },
  { key: "nocHoldAmt", label: "NOC Hold (₹)", get: ({ r }) => r?.nocHoldAmt ?? "" },
  { key: "insuranceCheck", label: "Insurance Check", get: ({ r }) => r?.insuranceCheck ?? "" },
  { key: "hypothecation", label: "Hypothecation", get: ({ r }) => r?.hypothecation ?? "" },
  { key: "aadhaarMatch", label: "Aadhaar Match", get: ({ r }) => r?.aadhaarMatch ?? "" },
  { key: "aadhaarMismatchNote", label: "Aadhaar Mismatch Note", get: ({ r }) => r?.aadhaarMismatchNote ?? "" },
  { key: "pendingDocuments", label: "Pending Documents", get: ({ r }) => (r?.pendingDocuments ?? []).join(", ") },
  { key: "balancePayment", label: "Balance Payment (₹)", get: ({ r }) => r?.balancePayment ?? "" },
  { key: "verification", label: "Verification", get: ({ r }) => r?.verification ?? "" },
  { key: "approval", label: "Approval", get: ({ r }) => r?.approval ?? "" },
  { key: "approvalDate", label: "Approval Date", get: ({ r }) => xlDate(r?.approvalDate) },
  { key: "insuranceEndorsement", label: "Insurance Endorsement", get: ({ r }) => r?.insuranceEndorsement ?? "" },
  { label: "RTO Slip", get: ({ r }) => r?.rtoSlipFileName ?? "" },
  { key: "remarks", label: "Remarks", get: ({ r }) => r?.remarks ?? "" },
];

/** One row per case: the RTO form's fields exactly as Form Builder defines them (hidden = left out, renamed = renamed, custom fields included), plus a column per RTO stage. */
export function buildRtoSheets(items: RtoRow[], defs: CustomDef[], progress: (r?: RTORecord | null) => number): XlsxSheet[] {
  const specs = resolveSpecs(RTO_SPECS(progress), defs);
  const stageNames = [...new Set(items.flatMap(({ r }) => (r?.stages ?? []).map((st) => st.name)))];
  const cc = customColumns(items.map(({ r }) => ({ customFields: r?.customFields })), defs);
  return [{
    name: "RTO",
    headers: [...specs.map((x) => x.label), ...stageNames, ...cc.keys.map(cc.head)],
    rows: items.map((it) => {
      const byName = new Map((it.r?.stages ?? []).map((st) => [st.name, st.status]));
      return [...specs.map((x) => x.get(it)), ...stageNames.map((n) => byName.get(n) ?? ""), ...cc.keys.map((k) => customCell(it.r?.customFields?.[k]))];
    }),
  }];
}
