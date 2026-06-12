"use client";

import { useState } from "react";
import { Clipboard, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Badge, Select, Label, ProgressBar, Input } from "../../../components/ui";

const CHECKS = [
  { key: "rtoOwnership", label: "RTO Ownership Transfer" },
  { key: "hypothecation", label: "Hypothecation Added" },
  { key: "bankNoc", label: "Bank NOC" },
  { key: "nocHoldAmt", label: "NOC Hold Amount" },
  { key: "challanClearance", label: "Challan Clearance" },
  { key: "aadhaarMatch", label: "Aadhaar Address Match" },
];

type ItemStatus = "Received" | "Pending" | "Not Required";

interface ChecklistState { [key: string]: ItemStatus; }

const MY_CASES = ["CAR-2026-0148", "CAR-2026-0147", "PL-2026-0146", "CAR-2026-0145", "CAR-2026-0142"];

export default function RTOChecklistPage() {
  const [selectedCase, setSelectedCase] = useState(MY_CASES[0]);
  const [items, setItems] = useState<ChecklistState>(() =>
    Object.fromEntries(CHECKS.map((c) => [c.key, "Pending" as ItemStatus]))
  );
  const [mismatch, setMismatch] = useState("");

  const done = Object.values(items).filter((v) => v === "Received").length;
  const total = Object.values(items).filter((v) => v !== "Not Required").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 100;

  function set(key: string, val: ItemStatus) { setItems((p) => ({ ...p, [key]: val })); }

  return (
    <div className="space-y-5 animate-fadeIn max-w-xl">
      <div>
        <h1 className="text-xl font-bold tracking-tight">RTO / Document Checklist</h1>
        <p className="text-sm text-muted mt-0.5">Track compliance items for each case</p>
      </div>

      <div>
        <Label>Select Case</Label>
        <Select value={selectedCase} onChange={(e) => setSelectedCase(e.target.value)} className="max-w-xs">
          {MY_CASES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>

      {/* Progress */}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">Completion</p>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </div>
          <ProgressBar value={pct} tone={pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger"} />
          <p className="text-xs text-muted mt-1.5">{done} of {total} items completed</p>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-2">
        {CHECKS.map((check) => {
          const status = items[check.key];
          return (
            <div key={check.key} className={`card p-4 flex items-center gap-4 ${
              status === "Received"     ? "border-success-border bg-success-subtle/40" :
              status === "Pending"      ? "border-warning-border bg-warning-subtle/40" :
                                          "border-border bg-surface-2"
            }`}>
              <div className={`size-8 rounded-full grid place-items-center shrink-0 font-bold text-sm ${
                status === "Received"     ? "bg-success text-white" :
                status === "Pending"      ? "bg-warning text-white" :
                                            "bg-surface-3 text-muted"
              }`}>
                {status === "Received" ? "✓" : status === "Pending" ? "!" : "—"}
              </div>
              <p className="flex-1 text-sm font-medium">{check.label}</p>
              <Select
                value={status}
                onChange={(e) => set(check.key, e.target.value as ItemStatus)}
                className="!h-7 !w-36 text-xs"
              >
                {(["Received", "Pending", "Not Required"] as ItemStatus[]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>

      {/* Mismatch flag */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning shrink-0" />
          <p className="text-sm font-semibold">Aadhaar Address Mismatch Flag</p>
        </div>
        <Input
          value={mismatch}
          onChange={(e) => setMismatch(e.target.value)}
          placeholder="Describe the mismatch (if any)…"
        />
      </div>

      <div>
        <button className="h-9 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-hover transition-colors">
          Save Checklist
        </button>
      </div>
    </div>
  );
}
