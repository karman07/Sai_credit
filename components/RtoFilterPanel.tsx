"use client";

import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import { Button, cn } from "./ui";
import { MultiSelect } from "./MultiSelect";
import { DatePicker } from "./DatePicker";
import { coreFields } from "../lib/coreFields";
import { useFormSchema } from "../lib/useFormSchema";
import type { LoanCase, RTORecord } from "../lib/api";
import {
  ALL_DONE, CHECK_VALUES, EMPTY_RTO_FILTERS, NOT_STARTED, RTO_CHECKS, STAGE_STATUS_VALUES, countRtoFilters, currentStageOf, progressOf, type RtoFilters,
} from "../lib/rtoFilters";

const field = "h-8 rounded-md border border-border bg-surface px-2.5 text-xs focus:outline-none focus:border-primary";
const caption = "text-[11px] font-semibold uppercase tracking-wide text-muted";
const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

function Tri({ label, value, onChange, labels = ["Any", "Yes", "No"] }: { label: string; value: string; onChange: (v: any) => void; labels?: [string, string, string] }) {
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <span className={caption}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>
        <option value="">{labels[0]}</option><option value="true">{labels[1]}</option><option value="false">{labels[2]}</option>
      </select>
    </div>
  );
}
function Range({ label, a, b, onA, onB, type = "date" }: { label: string; a: string; b: string; onA: (v: string) => void; onB: (v: string) => void; type?: "date" | "number" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={caption}>{label}</span>
      <div className="flex items-center gap-1.5">
        {type === "date"
          ? <DatePicker value={a} max={b || undefined} onChange={(e) => onA(e.target.value)} className={cn(field, "w-36")} />
          : <input type={type} value={a} onChange={(e) => onA(e.target.value)} placeholder="Min" className={cn(field, "w-24")} />}
        <span className="text-xs text-muted">to</span>
        {type === "date"
          ? <DatePicker value={b} min={a || undefined} onChange={(e) => onB(e.target.value)} className={cn(field, "w-36")} />
          : <input type={type} value={b} onChange={(e) => onB(e.target.value)} placeholder="Max" className={cn(field, "w-24")} />}
      </div>
    </div>
  );
}

/**
 * Every filter an RTO file can be sliced by: progress/status, ownership, each checklist item, stages (and their status),
 * RTO owner, document requests, slip, amounts, approval/completion/disbursal dates and the Form Builder's custom RTO
 * dropdowns — plus bank/dealer/product/rep/state/city. Filters tied to a field that Form Builder hides are hidden too.
 * Options come from the files passed in. Controlled and fully client-side.
 */
export function RtoFilterPanel({
  value, onChange, items, hideSearch, hideCase, className,
}: {
  value: RtoFilters;
  onChange: (f: RtoFilters) => void;
  items: { c: LoanCase; r?: RTORecord | null }[];
  hideSearch?: boolean;
  /** Skip the case-level filters (bank, dealer…) when another panel already covers them. */
  hideCase?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rtoSchema = useFormSchema("rto");
  const caseCf = coreFields(useFormSchema("new-case"));
  const rcf = coreFields(rtoSchema);
  const set = (patch: Partial<RtoFilters>) => onChange({ ...value, ...patch });
  const active = countRtoFilters(value);

  const o = useMemo(() => {
    const recs = items.map((i) => i.r).filter(Boolean) as RTORecord[];
    const cs = items.map((i) => i.c);
    return {
      status: uniq(["Not started", ...recs.map((r) => r.status)]),
      ownership: uniq(recs.map((r: any) => r.rtoOwnershipType)),
      stages: (() => { const pos = new Map<string, number>(); for (const r of recs) for (const s of r.stages ?? []) pos.set(s.name, Math.min(pos.get(s.name) ?? 1e9, s.order)); return [...pos.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n); })(),
      currentStages: [...new Set(items.map((i) => currentStageOf(i.r)))],
      owners: uniq([...recs.map((r: any) => r.rtoOwnerName), ...items.filter((i) => !(i.r as any)?.rtoOwnerName).map(() => "Unassigned")]),
      banks: uniq(cs.map((c) => c.bankName)), dealers: uniq(cs.map((c) => c.dealerName)), products: uniq(cs.map((c) => c.product)),
      reps: uniq([...cs.map((c) => c.assignedToName), ...cs.filter((c) => !c.assignedToName).map(() => "Unassigned")]),
      states: uniq(cs.map((c) => c.customer.state)), cities: uniq(cs.map((c) => c.customer.location)),
    };
  }, [items]);

  // Form Builder's custom RTO fields that are dropdowns / yes-no become filters (active ones only).
  const customFilters = useMemo(() => {
    const out: { key: string; label: string; options: string[] }[] = [];
    for (const sec of rtoSchema?.sections ?? []) for (const f of sec.fields) {
      if (f.isCore || f.isActive === false) continue;
      if (f.type === "select" && f.options.length) out.push({ key: f.key, label: f.label, options: f.options });
      else if (f.type === "boolean") out.push({ key: f.key, label: f.label, options: ["Yes", "No"] });
    }
    return out;
  }, [rtoSchema]);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  const addArr = (label: string, arr: string[], clear: () => void) => { if (arr.length) chips.push({ key: label, label: `${label}: ${arr.join(", ")}`, clear }); };
  if (value.q.trim()) chips.push({ key: "q", label: `Search: "${value.q.trim()}"`, clear: () => set({ q: "" }) });
  addArr("Progress", value.progress, () => set({ progress: [] }));
  addArr("RTO status", value.status, () => set({ status: [] }));
  addArr("Ownership", value.ownershipType, () => set({ ownershipType: [] }));
  for (const c of RTO_CHECKS) addArr(rcf.label(c.key, c.label), value.checks[c.key] ?? [], () => set({ checks: { ...value.checks, [c.key]: [] } }));
  addArr("Stage", value.stage, () => set({ stage: [] }));
  addArr("Stage status", value.stageStatus, () => set({ stageStatus: [] }));
  addArr("Current stage", value.currentStage, () => set({ currentStage: [] }));
  if (value.stage.length > 1 && value.stageMode === "all") chips.push({ key: "stageMode", label: "Stages: all must match", clear: () => set({ stageMode: "any" }) });
  addArr("RTO owner", value.owner, () => set({ owner: [] }));
  addArr("Bank", value.bank, () => set({ bank: [] })); addArr("Dealer", value.dealer, () => set({ dealer: [] }));
  addArr("Product", value.product, () => set({ product: [] })); addArr("Sales rep", value.rep, () => set({ rep: [] }));
  addArr("State", value.state, () => set({ state: [] })); addArr("City", value.city, () => set({ city: [] }));
  for (const cf of customFilters) addArr(cf.label, value.custom[cf.key] ?? [], () => set({ custom: { ...value.custom, [cf.key]: [] } }));
  const yn = (label: string, v: string, clear: () => void, txt = v === "true" ? "Yes" : "No") => { if (v) chips.push({ key: label, label: `${label}: ${txt}`, clear }); };
  yn("Receiving", value.receiving, () => set({ receiving: "" })); yn("RTO slip", value.slip, () => set({ slip: "" })); yn("Pending docs", value.pendingDocs, () => set({ pendingDocs: "" }));
  if (value.requests) chips.push({ key: "requests", label: `Doc requests: ${value.requests}`, clear: () => set({ requests: "" }) });
  const rng = (label: string, a: string, b: string, clear: () => void) => { if (a || b) chips.push({ key: label, label: `${label}: ${a || "…"} → ${b || "…"}`, clear }); };
  rng("Approval", value.approvalFrom, value.approvalTo, () => set({ approvalFrom: "", approvalTo: "" }));
  rng("Completed", value.completedFrom, value.completedTo, () => set({ completedFrom: "", completedTo: "" }));
  rng("Disbursed", value.disbursedFrom, value.disbursedTo, () => set({ disbursedFrom: "", disbursedTo: "" }));
  rng("NOC hold ₹", value.nocMin, value.nocMax, () => set({ nocMin: "", nocMax: "" }));
  rng("Balance ₹", value.balMin, value.balMax, () => set({ balMin: "", balMax: "" }));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {!hideSearch && (
          <input
            value={value.q} onChange={(e) => set({ q: e.target.value })}
            placeholder="Search case, customer, phone, reg. no., bank, dealer, RTO owner…" className={cn(field, "h-9 w-full sm:w-[26rem] text-sm")}
          />
        )}
        <MultiSelect label="Current stage" options={opts([NOT_STARTED, ...o.stages, ALL_DONE])} value={value.currentStage} onChange={(v) => set({ currentStage: v })} />
        <MultiSelect label="Stage" options={opts(o.stages)} value={value.stage} onChange={(v) => set({ stage: v })} />
        <MultiSelect label="Stage status" options={opts(STAGE_STATUS_VALUES)} value={value.stageStatus} onChange={(v) => set({ stageStatus: v })} />
        {value.stage.length > 1 && (
          <select value={value.stageMode} onChange={(e) => set({ stageMode: e.target.value as RtoFilters["stageMode"] })} className={field} title="How multiple stages combine">
            <option value="any">Any chosen stage</option><option value="all">All chosen stages</option>
          </select>
        )}
        <Button variant={open ? "outline" : "secondary"} size="sm" onClick={() => setOpen((x) => !x)}>
          <Filter className="size-3.5" /> RTO filters
          {active > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center">{active}</span>}
        </Button>
        {active > 0 && <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_RTO_FILTERS })}><X className="size-3" /> Reset</Button>}
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-4 animate-fadeIn">
          <div className="flex flex-wrap gap-3">
            <MultiSelect label="Progress" options={opts(["Not started", "In progress", "Completed"])} value={value.progress} onChange={(v) => set({ progress: v })} />
            <MultiSelect label="RTO status" options={opts(o.status)} value={value.status} onChange={(v) => set({ status: v })} />
            {rcf.show("rtoOwnershipType") && <MultiSelect label={rcf.label("rtoOwnershipType", "Ownership type")} options={opts(o.ownership)} value={value.ownershipType} onChange={(v) => set({ ownershipType: v })} />}
            <MultiSelect label="RTO owner" options={opts(o.owners)} value={value.owner} onChange={(v) => set({ owner: v })} />
          </div>

          <div className="flex flex-wrap gap-3">
            {RTO_CHECKS.filter((c) => rcf.show(c.key)).map((c) => (
              <MultiSelect key={c.key} label={rcf.label(c.key, c.label)} options={opts(CHECK_VALUES)} value={value.checks[c.key] ?? []}
                onChange={(v) => set({ checks: { ...value.checks, [c.key]: v } })} />
            ))}
            {customFilters.map((cf) => (
              <MultiSelect key={cf.key} label={cf.label} options={opts(cf.options)} value={value.custom[cf.key] ?? []}
                onChange={(v) => set({ custom: { ...value.custom, [cf.key]: v } })} />
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            {rcf.show("rtoReceiving") && <Tri label={rcf.label("rtoReceiving", "RTO receiving")} value={value.receiving} onChange={(v) => set({ receiving: v })} />}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className={caption}>Document requests</span>
              <select value={value.requests} onChange={(e) => set({ requests: e.target.value as RtoFilters["requests"] })} className={field}>
                <option value="">Any</option><option value="open">Has open requests</option><option value="awaiting">Awaiting sales reply</option>
                <option value="resolved">All resolved</option><option value="none">No requests</option>
              </select>
            </div>
            <Tri label="RTO slip uploaded" value={value.slip} onChange={(v) => set({ slip: v })} />
            {rcf.show("pendingDocuments") && <Tri label={rcf.label("pendingDocuments", "Pending documents")} value={value.pendingDocs} onChange={(v) => set({ pendingDocs: v })} />}
            {rcf.show("approvalDate") && <Range label="Approval date" a={value.approvalFrom} b={value.approvalTo} onA={(v) => set({ approvalFrom: v })} onB={(v) => set({ approvalTo: v })} />}
            <Range label="Completed on" a={value.completedFrom} b={value.completedTo} onA={(v) => set({ completedFrom: v })} onB={(v) => set({ completedTo: v })} />
            <Range label="Disbursed on" a={value.disbursedFrom} b={value.disbursedTo} onA={(v) => set({ disbursedFrom: v })} onB={(v) => set({ disbursedTo: v })} />
            {rcf.show("nocHoldAmt") && <Range label={rcf.label("nocHoldAmt", "NOC hold (₹)")} type="number" a={value.nocMin} b={value.nocMax} onA={(v) => set({ nocMin: v })} onB={(v) => set({ nocMax: v })} />}
            {rcf.show("balancePayment") && <Range label={rcf.label("balancePayment", "Balance payment (₹)")} type="number" a={value.balMin} b={value.balMax} onA={(v) => set({ balMin: v })} onB={(v) => set({ balMax: v })} />}
          </div>

          {!hideCase && (
            <div className="flex flex-wrap gap-3">
              {caseCf.show("bank") && <MultiSelect label="Bank / NBFC" options={opts(o.banks)} value={value.bank} onChange={(v) => set({ bank: v })} />}
              {caseCf.show("dealer") && <MultiSelect label="Dealer" options={opts(o.dealers)} value={value.dealer} onChange={(v) => set({ dealer: v })} />}
              <MultiSelect label="Product" options={opts(o.products)} value={value.product} onChange={(v) => set({ product: v })} />
              <MultiSelect label="Sales rep" options={opts(o.reps)} value={value.rep} onChange={(v) => set({ rep: v })} />
              {caseCf.show("state") && <MultiSelect label={caseCf.label("state", "State")} options={opts(o.states)} value={value.state} onChange={(v) => set({ state: v })} />}
              {caseCf.show("location") && <MultiSelect label={caseCf.label("location", "City")} options={opts(o.cities)} value={value.city} onChange={(v) => set({ city: v })} />}
            </div>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-primary max-w-[22rem]">
              <span className="truncate">{c.label}</span>
              <button type="button" onClick={c.clear} className="size-4 rounded-full grid place-items-center hover:bg-primary/20" title="Remove filter"><X className="size-2.5" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export { progressOf };
