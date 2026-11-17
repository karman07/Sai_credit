import { API_BASE, formSchemasApi, type LoanCase } from "./api";
import { customKeys, xlCell, xlDate, type XlsxSheet } from "./excel";

const dateTime = (d?: string) => { if (!d) return ""; const t = new Date(d); return isNaN(t.getTime()) ? "" : t.toLocaleString("en-IN"); };
const fullName = (c: LoanCase) => `${c.customer.firstName} ${c.customer.lastName}`.trim();
export type CustomDef = { key: string; label: string; active: boolean; core?: boolean };

/**
 * Everything Form Builder says about one kind of record, in Form Builder order: built-in ("core") fields
 * (so a hidden or renamed one is reflected in the export) and custom fields (so every defined field gets a
 * column, even one nobody has filled in yet). "case" = the New Case form plus all product forms.
 */
export async function loadCustomDefs(scope: "case"): Promise<CustomDef[]> {
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
