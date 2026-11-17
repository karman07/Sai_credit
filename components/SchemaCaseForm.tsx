"use client";

import type { ReactNode } from "react";
import { Input, Label, PhoneInput, Select, Textarea } from "./ui";
import { FileFieldInput } from "./FileFieldInput";
import { BOOLEAN_CORE, NUMBER_CORE, applyChange, visibleSections, type CaseValues } from "../lib/caseForm";
import type { FieldDef, FormSchema } from "../lib/api";

export type CaseFormCtx = {
  products: { name: string }[];
  banks: { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string }[];
  dealers: { _id: string; name: string }[];
  states: string[];
  cities: string[];
  insurers: string[];
  firms?: string[];
  onAddDealer?: () => void;
};

const DEFAULTS: Record<string, string[]> = {
  residentialStatus: ["Own", "Rented", "Family Owned"],
  loanType: ["New", "Used", "Refinance"],
};
const PHONE_CORE = new Set(["contact", "altContact", "bmContact"]);

/**
 * Renders a case form exactly as Form Builder defines it: sections and fields in schema order, a field that is hidden
 * there is not rendered, labels / required marks / dropdown options come from the schema, and product-specific fields
 * appear straight after the section that holds the Product field. Nothing is hard-coded beyond how each kind of
 * field is edited (a bank picker, a Yes/No, a number…).
 */
export function SchemaCaseForm({
  schema, productFields, values, setValues, ctx, readOnly = [], hide = [], cols = 2, lead,
}: {
  schema: FormSchema | null;
  productFields: FieldDef[];
  values: CaseValues;
  setValues: (fn: (v: CaseValues) => CaseValues) => void;
  ctx: CaseFormCtx;
  /** Keys shown but not editable (e.g. the phone number already entered). */
  readOnly?: string[];
  /** Keys skipped entirely (e.g. fields collected elsewhere in the flow). */
  hide?: string[];
  cols?: 1 | 2 | 3;
  lead?: ReactNode;
}) {
  if (!schema) return <p className="text-sm text-muted py-6 text-center">Loading form…</p>;

  const set = (key: string, value: string) => setValues((v) => applyChange(v, key, value, ctx));
  const sections = visibleSections(schema).map((s) => ({ ...s, fields: s.fields.filter((f) => !hide.includes(f.key)) })).filter((s) => s.fields.length);
  const prod = productFields.filter((f) => f.isActive !== false && !hide.includes(f.key));
  const productAt = sections.findIndex((s) => s.fields.some((f) => f.isCore && f.key === "product"));
  const gridCls = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2";

  const section = (id: string, title: string, fields: FieldDef[]) => (
    <section key={id} className="space-y-2.5" data-section={title}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border pb-1">{title}</p>
      <div className={`grid ${gridCls} gap-3`}>
        {fields.map((f) => renderField(f))}
      </div>
    </section>
  );

  // A plain function (not a component) so inputs keep focus while typing.
  function renderField(f: FieldDef) {
    const value = values[f.key] ?? "";
    const ro = readOnly.includes(f.key);
    return (
      <div key={f.key} className="space-y-1.5" data-field={f.key}>
        <div className="flex items-center justify-between gap-2">
          <Label>{f.label?.trim() || f.key}{f.required && <span className="text-danger ml-0.5">*</span>}</Label>
          {f.isCore && f.key === "dealer" && ctx.onAddDealer && !ro && (
            <button type="button" onClick={ctx.onAddDealer} className="text-[11px] font-semibold text-primary hover:underline">+ Add new dealer</button>
          )}
        </div>
        {control(f, value, ro)}
      </div>
    );
  }

  function control(f: FieldDef, value: string, ro: boolean): ReactNode {
    const on = (v: string) => set(f.key, v);
    const uniq = (xs: readonly string[]) => [...new Set(xs.map((x) => String(x)).filter((x) => x.trim() !== ""))];
    const opts = (fallback: readonly string[] = []) => { const o = uniq(f.options ?? []); return o.length ? o : uniq(fallback); };
    const select = (options: readonly { value: string; label: string }[], placeholder = "Select…") => (
      <Select value={value} disabled={ro} onChange={(e) => on(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o, i) => <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>)}
        {value && !options.some((o) => o.value === value) && <option value={value}>{value}</option>}
      </Select>
    );
    const plain = (xs: readonly string[]) => select(xs.map((x) => ({ value: x, label: x })));

    if (f.isCore) {
      switch (f.key) {
        case "product": return select(ctx.products.map((p) => ({ value: p.name, label: p.name })), "Select product…");
        case "bank": return select(ctx.banks.map((b) => ({ value: b._id, label: b.name })), "Select bank…");
        case "dealer": return select(ctx.dealers.map((d) => ({ value: d._id, label: d.name })), "Select dealer…");
        case "firm": return plain(opts(ctx.firms ?? []));
        case "state": return ctx.states.length ? plain(opts(ctx.states)) : <Input value={value} disabled={ro} onChange={(e) => on(e.target.value)} placeholder={f.placeholder} />;
        case "location":
          return (
            <>
              <Input value={value} disabled={ro} list={`cities-${f.key}`} onChange={(e) => on(e.target.value)} placeholder={f.placeholder || "City / Area"} />
              {ctx.cities.length > 0 && <datalist id={`cities-${f.key}`}>{ctx.cities.map((c) => <option key={c} value={c} />)}</datalist>}
            </>
          );
        case "existingInsurer": return plain(opts(ctx.insurers));
        case "residentialStatus": case "loanType": return plain(opts(DEFAULTS[f.key]));
      }
      if (BOOLEAN_CORE.has(f.key)) return plain(["Yes", "No"]);
      if (PHONE_CORE.has(f.key)) return <PhoneInput value={value} disabled={ro} onChange={on} />;
      if (NUMBER_CORE.has(f.key)) {
        return (
          <div className="relative">
            {f.key === "loanAmount" && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm select-none pointer-events-none">₹</span>}
            <Input type="number" min="0" value={value} disabled={ro} onChange={(e) => on(e.target.value)} placeholder={f.placeholder} className={f.key === "loanAmount" ? "!pl-7" : ""} />
          </div>
        );
      }
    }

    switch (f.type) {
      case "select": return plain(opts());
      case "boolean": return plain(["Yes", "No"]);
      case "date": return <Input type="date" value={value} disabled={ro} onChange={(e) => on(e.target.value)} />;
      case "number": return <Input type="number" value={value} disabled={ro} onChange={(e) => on(e.target.value)} placeholder={f.placeholder} />;
      case "file": return <FileFieldInput value={value} onChange={on} />;
      case "tel": return <PhoneInput value={value} disabled={ro} onChange={on} />;
      default:
        return uniq(f.options ?? []).length
          ? plain(uniq(f.options))
          : <Input value={value} disabled={ro} onChange={(e) => on(e.target.value)} placeholder={f.placeholder} />;
    }
  }

  const out: ReactNode[] = [];
  if (lead) out.push(<div key="lead">{lead}</div>);
  sections.forEach((s, i) => {
    out.push(section(s.id, s.title, s.fields));
    if (i === productAt && prod.length) out.push(section("product-fields", `${values.product || "Product"} details`, prod));
  });
  if (productAt < 0 && prod.length) out.push(section("product-fields", `${values.product || "Product"} details`, prod));
  if (!sections.length && !prod.length) out.push(<p key="empty" className="text-sm text-muted">No fields are enabled for this form in Form Builder.</p>);

  return <div className="space-y-5">{out}</div>;
}

export { Textarea };
