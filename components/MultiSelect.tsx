"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "./ui";

export interface Option { value: string; label: string }

/** Searchable multi-select dropdown (checkbox list). Empty selection means "all". */
export function MultiSelect({
  label, options, value, onChange, placeholder = "All", className,
}: {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, q]);

  const selectedLabels = value.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const summary = value.length === 0 ? placeholder : value.length <= 2 ? selectedLabels.join(", ") : `${value.length} selected`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={ref} className={cn("relative flex flex-col gap-1 min-w-[160px]", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "h-8 w-full rounded-md border bg-surface px-2.5 text-left text-xs flex items-center justify-between gap-2 transition-colors",
          value.length ? "border-primary text-foreground font-medium" : "border-border text-muted hover:border-border-strong",
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-surface shadow-xl animate-fadeIn">
          <div className="p-2 border-b border-border relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full h-7 rounded-md border border-border bg-surface-2 pl-7 pr-2 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {shown.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted text-center">No options</p>
            ) : shown.map((o) => {
              const on = value.includes(o.value);
              return (
                <button
                  key={o.value} type="button" onClick={() => toggle(o.value)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-surface-2"
                >
                  <span className={cn("size-3.5 rounded border grid place-items-center shrink-0", on ? "bg-primary border-primary text-primary-foreground" : "border-border-strong")}>
                    {on && <Check className="size-2.5" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[11px]">
            <button type="button" className="text-primary hover:underline" onClick={() => onChange(shown.map((o) => o.value))}>Select shown</button>
            <button type="button" className="text-muted hover:text-foreground" onClick={() => onChange([])}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
