import type { FieldDef, FormSchema, LoanCase, SectionDef } from "./api";

/**
 * The New Case / Edit Case forms are built entirely from the Form Builder schema. Every field is addressed by its
 * Form Builder key (built-in "core" keys like `bank` or `loanAmount`, and custom keys), and all values live in one
 * flat string map. These helpers translate between that map and a case.
 */
export type CaseValues = Record<string, string>;

type Ctx = {
  banks: { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string }[];
  dealers: { _id: string; name: string }[];
};

const num = (v: string | undefined) => (v === undefined || v.trim() === "" || isNaN(Number(v)) ? undefined : Number(v));
const yes = (v: string | undefined) => (v === undefined || v === "" ? undefined : /^(yes|true|1)$/i.test(v.trim()));
const present = (v: unknown) => !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));

/** Built-in fields that are yes/no. */
export const BOOLEAN_CORE = new Set(["hypothecation", "nocRequired", "ebillOwner"]);
/** Built-in fields that hold a number. */
export const NUMBER_CORE = new Set(["challanCount", "loanAmount", "payoutPct"]);

/** Sections with only active fields, each sorted by Form Builder order (sections with nothing visible are dropped). */
export function visibleSections(schema: FormSchema | null | undefined): SectionDef[] {
  return (schema?.sections ?? [])
    .map((s) => ({ ...s, fields: [...s.fields].filter((f) => f.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) }))
    .filter((s) => s.fields.length > 0);
}

/** Every visible field of the form, in the order it is shown, plus product-specific fields. */
export function visibleFields(schema: FormSchema | null | undefined, productFields: FieldDef[] = []): FieldDef[] {
  return [...visibleSections(schema).flatMap((s) => s.fields), ...productFields.filter((f) => f.isActive !== false)];
}

/** A case's current values keyed by Form Builder field key. */
export function valuesFromCase(c: LoanCase): CaseValues {
  const a = c as any;
  const b = (v: boolean | undefined) => (v === undefined || v === null ? "" : v ? "Yes" : "No");
  const s = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  const out: CaseValues = {
    firstName: s(c.customer?.firstName), lastName: s(c.customer?.lastName), fatherName: s(c.customer?.fatherName),
    contact: s(c.customer?.contact), altContact: s(c.customer?.altContact), state: s(c.customer?.state),
    location: s(c.customer?.location), residentialStatus: s(c.customer?.residentialStatus), ebillOwner: b(c.customer?.ebillOwner),
    product: s(c.product), loanType: s(c.loanType), firm: s(c.firm), vehicleModel: s(c.vehicleModel), regNumber: s(c.regNumber),
    ownerSerial: s(c.ownerSerial), existingInsurer: s(c.existingInsurer), hypothecation: b(c.hypothecation), nocRequired: b(c.nocRequired),
    challanCount: s(c.challanCount), loanAmount: s(c.loanAmount), bank: s(c.bankId), branch: s(c.bankBranch), bmName: s(c.bmName),
    bmContact: s(c.bmContact), executive: s(c.bankExecutive), dealer: s(c.dealerId), payoutPct: s(a.payoutPct),
  };
  for (const [k, v] of Object.entries(c.customFields ?? {})) if (!(k in out) || !present(out[k])) out[k] = typeof v === "object" ? JSON.stringify(v) : s(v);
  return out;
}

/** Form Builder default values for a brand-new form. */
export function defaultValues(schema: FormSchema | null | undefined, productFields: FieldDef[] = []): CaseValues {
  const out: CaseValues = {};
  for (const f of visibleFields(schema, productFields)) {
    if (!f.defaultValue) continue;
    // A default that is no longer one of the field's options would put a stale value on a new form.
    if (f.options?.length && !f.options.includes(f.defaultValue) && f.type !== "text") continue;
    out[f.key] = f.defaultValue;
  }
  return out;
}

/** Picking a bank also fills its branch / manager / executive (as the forms always did), without touching other fields. */
export function applyChange(values: CaseValues, key: string, value: string, ctx: Ctx): CaseValues {
  const next = { ...values, [key]: value };
  if (key === "bank") {
    const b = ctx.banks.find((x) => x._id === value);
    next.branch = b?.branch ?? ""; next.bmName = b?.bmName ?? ""; next.bmContact = b?.bmContact ?? ""; next.executive = b?.executive ?? "";
  }
  return next;
}

/** The first problem with the form, or null. A name and phone are always needed; the rest only if Form Builder says "required". */
export function firstMissing(values: CaseValues, schema: FormSchema | null | undefined, productFields: FieldDef[] = [], skip: string[] = []): string | null {
  const fields = visibleFields(schema, productFields);
  const shown = new Set(fields.map((f) => f.key));
  if (!skip.includes("firstName") && !present(values.firstName)) return "First name is required";
  if (!skip.includes("contact") && !present(values.contact)) return "Contact number is required";
  for (const f of fields) {
    if (!f.required || skip.includes(f.key)) continue;
    if (!present(values[f.key])) return `${f.label} is required`;
  }
  void shown;
  return null;
}

/**
 * Turns form values into a create/update payload. Only fields that are visible in Form Builder are sent, so a
 * hidden field is never written. For an update pass `base` (the case being edited): untouched data is preserved.
 */
export function buildCasePayload(
  values: CaseValues, schema: FormSchema | null | undefined, productFields: FieldDef[], ctx: Ctx, base?: LoanCase,
): Record<string, any> {
  const fields = visibleFields(schema, productFields);
  const core = fields.filter((f) => f.isCore);
  const has = (k: string) => core.some((f) => f.key === k);
  const v = (k: string) => (has(k) ? values[k] : undefined);
  const txt = (k: string) => { const x = v(k); return x !== undefined && x.trim() !== "" ? x.trim() : undefined; };

  const customer: Record<string, any> = { ...(base?.customer ?? {}) };
  for (const k of ["firstName", "lastName", "fatherName", "contact", "altContact", "state", "location", "residentialStatus"]) {
    if (has(k)) { const t = txt(k); if (t !== undefined) customer[k] = t; else if (base) delete customer[k]; }
  }
  // A name and phone always travel with the case, even when the form builder hides those inputs.
  if (!present(customer.firstName) && present(values.firstName)) customer.firstName = values.firstName.trim();
  if (!present(customer.contact) && present(values.contact)) customer.contact = values.contact.trim();
  if (has("ebillOwner")) { const b = yes(values.ebillOwner); if (b !== undefined) customer.ebillOwner = b; }

  // A bank/dealer that is no longer in the pick-lists (e.g. deactivated) keeps its link when the form leaves it unchanged.
  const bank = has("bank")
    ? ctx.banks.find((b) => b._id === values.bank) ?? (present(values.bank) && base?.bankId === values.bank ? { _id: base.bankId, name: base.bankName } : undefined)
    : undefined;
  const dealer = has("dealer")
    ? ctx.dealers.find((d) => d._id === values.dealer) ?? (present(values.dealer) && base?.dealerId === values.dealer ? { _id: base.dealerId, name: base.dealerName } : undefined)
    : undefined;

  const body: Record<string, any> = {
    customer,
    product: txt("product"), loanType: txt("loanType"), vehicleModel: txt("vehicleModel"), regNumber: txt("regNumber"),
    ownerSerial: txt("ownerSerial"), existingInsurer: txt("existingInsurer"), firm: txt("firm"),
    hypothecation: has("hypothecation") ? yes(values.hypothecation) : undefined,
    nocRequired: has("nocRequired") ? yes(values.nocRequired) : undefined,
    challanCount: has("challanCount") ? num(values.challanCount) : undefined,
    loanAmount: has("loanAmount") ? num(values.loanAmount) : undefined,
    bankId: bank ? bank._id : undefined, bankName: bank?.name, bankBranch: txt("branch"), bmName: txt("bmName"),
    bmContact: txt("bmContact"), bankExecutive: txt("executive"),
    dealerId: dealer ? dealer._id : undefined, dealerName: dealer?.name,
    payoutPct: has("payoutPct") ? num(values.payoutPct) : undefined,
  };

  const custom: Record<string, any> = { ...(base?.customFields ?? {}) };
  for (const f of fields.filter((x) => !x.isCore)) {
    const raw = values[f.key];
    if (!present(raw)) { if (base) delete custom[f.key]; continue; }
    custom[f.key] = f.type === "number" && num(raw) !== undefined ? Number(raw) : raw;
  }
  if (Object.keys(custom).length) body.customFields = custom;
  else if (base) body.customFields = {};

  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return body;
}
