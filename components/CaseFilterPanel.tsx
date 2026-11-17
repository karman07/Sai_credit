"use client";

import { DatePicker } from "./DatePicker";
import { useEffect, useState } from "react";
import { Filter, X, ArrowDownUp } from "lucide-react";
import { Button, cn } from "./ui";
import { MultiSelect } from "./MultiSelect";
import { casesApi } from "../lib/api";
import { coreFields } from "../lib/coreFields";
import { useFormSchema } from "../lib/useFormSchema";
import {
  EMPTY_FACETS, EMPTY_FILTERS, SORT_OPTIONS, countActiveFilters, describeFilters,
  type CaseFacets, type CaseFilters,
} from "../lib/caseFilters";

/** Loads the filter dropdown options once (distinct values from the cases this user can see). */
export function useCaseFacets(): CaseFacets {
  const [facets, setFacets] = useState<CaseFacets>(EMPTY_FACETS);
  useEffect(() => {
    let alive = true;
    casesApi.facets().then(({ data }) => { if (alive) setFacets({ ...EMPTY_FACETS, ...data }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return facets;
}

export type FilterHide = "assignedTo" | "coordinatorId" | "dealerId" | "status" | "sort" | "search" | "createdDate";

const field = "h-8 w-full rounded-md border border-border bg-surface px-2.5 text-xs focus:outline-none focus:border-primary";
const caption = "text-[11px] font-semibold uppercase tracking-wide text-muted";

function Tri({ label, value, onChange }: { label: string; value: "" | "true" | "false"; onChange: (v: "" | "true" | "false") => void }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <span className={caption}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as "" | "true" | "false")} className={field}>
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

/**
 * The full case filter UI: alphanumeric search, every multi-select / date / amount / yes-no filter, sort, and
 * removable chips for what's applied. Controlled — the parent owns `value` and refetches when it changes.
 * `hide` drops filters that make no sense for the viewer (e.g. a sales rep only sees their own cases).
 */
export function CaseFilterPanel({
  value, onChange, facets, hide = [], defaultOpen = false, onSearchChange, className,
}: {
  value: CaseFilters;
  onChange: (f: CaseFilters) => void;
  facets: CaseFacets;
  hide?: FilterHide[];
  defaultOpen?: boolean;
  /** Called while typing so the parent can debounce its fetch; defaults to onChange. */
  onSearchChange?: (search: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // A field hidden in Form Builder is hidden from its filter too, so every portal shows the same set.
  const cf = coreFields(useFormSchema("new-case"));
  const set = (patch: Partial<CaseFilters>) => onChange({ ...value, ...patch });
  const active = countActiveFilters(value);
  const chips = describeFilters(value, facets);
  const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));
  const named = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));
  const statuses = facets.statuses.length ? facets.statuses : value.status;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {!hide.includes("search") && <input
          value={value.search}
          onChange={(e) => (onSearchChange ? onSearchChange(e.target.value) : set({ search: e.target.value }))}
          placeholder="Search case ID, name, phone, reg. no., vehicle, bank, dealer, city, remarks…"
          className={cn(field, "h-9 w-full sm:w-[26rem] text-sm")}
        />}
        <Button variant={open ? "outline" : "secondary"} size="sm" onClick={() => setOpen((o) => !o)}>
          <Filter className="size-3.5" /> Filters
          {active > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{active}</span>}
        </Button>
        {!hide.includes("sort") && <div className="flex items-center gap-1">
          <ArrowDownUp className="size-3.5 text-muted" />
          <select value={value.sortBy} onChange={(e) => set({ sortBy: e.target.value })} className={cn(field, "w-40")}>
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button
            type="button" title={value.order === "desc" ? "Descending" : "Ascending"}
            onClick={() => set({ order: value.order === "desc" ? "asc" : "desc" })}
            className="h-8 px-2 rounded-md border border-border text-xs font-semibold hover:bg-surface-2"
          >
            {value.order === "desc" ? "↓ Desc" : "↑ Asc"}
          </button>
        </div>}
        {(active > 0 || value.sortBy !== EMPTY_FILTERS.sortBy || value.order !== EMPTY_FILTERS.order) && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS })}><X className="size-3" /> Reset</Button>
        )}
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap gap-3">
            {!hide.includes("status") && <MultiSelect label="Status" options={opts(statuses)} value={value.status} onChange={(v) => set({ status: v })} />}
            {cf.show("bank") && <MultiSelect label="Bank / NBFC" options={named(facets.banks)} value={value.bankId} onChange={(v) => set({ bankId: v })} />}
            {!hide.includes("dealerId") && cf.show("dealer") && <MultiSelect label="Dealer" options={named(facets.dealers)} value={value.dealerId} onChange={(v) => set({ dealerId: v })} />}
            <MultiSelect label="Product" options={opts(facets.products)} value={value.product} onChange={(v) => set({ product: v })} />
            <MultiSelect label="Firm" options={opts(facets.firms)} value={value.firm} onChange={(v) => set({ firm: v })} />
            {cf.show("loanType") && <MultiSelect label="Loan type" options={opts(facets.loanTypes)} value={value.loanType} onChange={(v) => set({ loanType: v })} />}
            {!hide.includes("assignedTo") && <MultiSelect label="Sales rep" options={named(facets.reps)} value={value.assignedTo} onChange={(v) => set({ assignedTo: v })} />}
            {!hide.includes("coordinatorId") && <MultiSelect label="Coordinator" options={named(facets.coordinators)} value={value.coordinatorId} onChange={(v) => set({ coordinatorId: v })} />}
            {cf.show("state") && <MultiSelect label={cf.label("state", "State")} options={opts(facets.states)} value={value.state} onChange={(v) => set({ state: v })} />}
            {cf.show("location") && <MultiSelect label={cf.label("location", "City")} options={opts(facets.cities)} value={value.city} onChange={(v) => set({ city: v })} />}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {!hide.includes("createdDate") && <div className="flex flex-col gap-1">
              <span className={caption}>Created</span>
              <div className="flex items-center gap-1.5">
                <DatePicker type="date" value={value.createdFrom} onChange={(e) => set({ createdFrom: e.target.value })} className={cn(field, "w-36")} />
                <span className="text-muted text-xs">to</span>
                <DatePicker type="date" value={value.createdTo} onChange={(e) => set({ createdTo: e.target.value })} className={cn(field, "w-36")} />
              </div>
            </div>}
            <div className="flex flex-col gap-1">
              <span className={caption}>Disbursed</span>
              <div className="flex items-center gap-1.5">
                <DatePicker type="date" value={value.disbursedFrom} onChange={(e) => set({ disbursedFrom: e.target.value })} className={cn(field, "w-36")} />
                <span className="text-muted text-xs">to</span>
                <DatePicker type="date" value={value.disbursedTo} onChange={(e) => set({ disbursedTo: e.target.value })} className={cn(field, "w-36")} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={caption}>Loan amount (₹){facets.amount.max > 0 && <span className="normal-case font-normal"> · {facets.amount.min.toLocaleString("en-IN")}–{facets.amount.max.toLocaleString("en-IN")}</span>}</span>
              <div className="flex items-center gap-1.5">
                <input type="number" min={0} value={value.minAmount} onChange={(e) => set({ minAmount: e.target.value })} placeholder="Min" className={cn(field, "w-28")} />
                <span className="text-muted text-xs">to</span>
                <input type="number" min={0} value={value.maxAmount} onChange={(e) => set({ maxAmount: e.target.value })} placeholder="Max" className={cn(field, "w-28")} />
              </div>
            </div>
            {cf.show("hypothecation") && <Tri label={cf.label("hypothecation", "Hypothecation")} value={value.hypothecation} onChange={(v) => set({ hypothecation: v })} />}
            {cf.show("nocRequired") && <Tri label={cf.label("nocRequired", "NOC required")} value={value.nocRequired} onChange={(v) => set({ nocRequired: v })} />}
            <Tri label="Has documents" value={value.hasDocuments} onChange={(v) => set({ hasDocuments: v })} />
            <label className="flex items-center gap-2 text-xs font-medium h-8 cursor-pointer">
              <input type="checkbox" className="size-3.5 rounded" checked={value.openDocRequests} onChange={(e) => set({ openDocRequests: e.target.checked })} />
              Open document requests
            </label>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-primary max-w-[22rem]">
              <span className="truncate">{c.label}</span>
              <button type="button" onClick={() => onChange(c.clear(value))} className="size-4 rounded-full grid place-items-center hover:bg-primary/20" title="Remove filter">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
