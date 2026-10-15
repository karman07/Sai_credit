"use client";

import { Input } from "./ui";

export interface DateRange { from: string; to: string }

/** Presets are computed relative to "today" each time they're clicked. */
const PRESETS: { label: string; days: number }[] = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const today = () => new Date().toISOString().slice(0, 10);

export function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const activePreset =
    value.to === today() && value.from === isoDaysAgo(7) ? "7D" :
    value.to === today() && value.from === isoDaysAgo(30) ? "30D" :
    value.to === today() && value.from === isoDaysAgo(90) ? "90D" :
    value.to === today() && value.from === startOfMonth() ? "MTD" : "";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-0 rounded-md border border-border overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-surface border-r border-border">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">From</span>
          <Input
            type="date"
            value={value.from}
            max={value.to}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="!border-0 !shadow-none !ring-0 !bg-transparent w-36 text-sm font-medium p-0 h-auto"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-surface">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted whitespace-nowrap">To</span>
          <Input
            type="date"
            value={value.to}
            min={value.from}
            max={today()}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="!border-0 !shadow-none !ring-0 !bg-transparent w-36 text-sm font-medium p-0 h-auto"
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange({ from: isoDaysAgo(p.days), to: today() })}
            className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors ${
              activePreset === p.label
                ? "border-primary bg-primary-subtle text-primary"
                : "border-border text-muted hover:text-foreground hover:border-primary/40"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ from: startOfMonth(), to: today() })}
          className={`text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors ${
            activePreset === "MTD"
              ? "border-primary bg-primary-subtle text-primary"
              : "border-border text-muted hover:text-foreground hover:border-primary/40"
          }`}
        >
          MTD
        </button>
      </div>
    </div>
  );
}
