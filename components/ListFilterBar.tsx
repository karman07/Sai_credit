"use client";

import { DatePicker } from "./DatePicker";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button, cn } from "./ui";
import { MultiSelect, type Option } from "./MultiSelect";

/** State for a client-side list filter: free-text search, multi-select filters keyed by name, and a date range. */
export interface ListFilterState {
  q: string;
  sel: Record<string, string[]>;
  from: string;
  to: string;
}
export const EMPTY_LIST_FILTER: ListFilterState = { q: "", sel: {}, from: "", to: "" };

export function useListFilter(initial: ListFilterState = EMPTY_LIST_FILTER) {
  return useState<ListFilterState>(initial);
}

export function listFilterCount(s: ListFilterState): number {
  return (s.q.trim() ? 1 : 0) + Object.values(s.sel).filter((v) => v.length).length + (s.from || s.to ? 1 : 0);
}

/**
 * Applies a ListFilterState to a list. `text` is everything searchable about an item (every word typed must
 * appear somewhere, any case); `sel` maps each select key to the item's value(s); `date` is the item's date.
 */
export function filterList<T>(
  items: T[],
  s: ListFilterState,
  get: { text: (i: T) => string; sel?: Record<string, (i: T) => string | string[] | undefined>; date?: (i: T) => string | undefined },
): T[] {
  const words = s.q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (words.length) {
      const hay = get.text(i).toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    for (const [key, chosen] of Object.entries(s.sel)) {
      if (!chosen.length) continue;
      const v = get.sel?.[key]?.(i);
      const values = Array.isArray(v) ? v : v === undefined ? [] : [v];
      if (!values.some((x) => chosen.includes(x))) return false;
    }
    if (s.from || s.to) {
      const d = get.date?.(i)?.slice(0, 10);
      if (!d) return false;
      if (s.from && d < s.from) return false;
      if (s.to && d > s.to) return false;
    }
    return true;
  });
}

const field = "h-8 rounded-md border border-border bg-surface px-2.5 text-xs focus:outline-none focus:border-primary";

/** Search + multi-select filters + optional date range, with a result count and reset. */
export function ListFilterBar({
  value, onChange, placeholder = "Search…", selects = [], dateLabel, shown, total, className,
}: {
  value: ListFilterState;
  onChange: (s: ListFilterState) => void;
  placeholder?: string;
  selects?: { key: string; label: string; options: Option[] }[];
  dateLabel?: string;
  shown?: number;
  total?: number;
  className?: string;
}) {
  const active = listFilterCount(value);
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
        <input
          value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} placeholder={placeholder}
          className={cn(field, "h-9 w-64 pl-8 text-sm")}
        />
      </div>
      {selects.map((s) => (
        <MultiSelect
          key={s.key} label={s.label} options={s.options} value={value.sel[s.key] ?? []}
          onChange={(v) => onChange({ ...value, sel: { ...value.sel, [s.key]: v } })} className="min-w-[140px]"
        />
      ))}
      {dateLabel && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{dateLabel}</span>
          <div className="flex items-center gap-1.5">
            <DatePicker type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={cn(field, "w-36")} />
            <span className="text-xs text-muted">to</span>
            <DatePicker type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={cn(field, "w-36")} />
          </div>
        </div>
      )}
      {active > 0 && <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_LIST_FILTER)}><X className="size-3" /> Reset</Button>}
      {shown !== undefined && total !== undefined && active > 0 && (
        <span className="text-xs text-muted pb-2">{shown} of {total}</span>
      )}
    </div>
  );
}
