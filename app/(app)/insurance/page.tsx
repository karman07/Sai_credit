"use client";

import { useState } from "react";
import { ShieldCheck, Plus } from "lucide-react";
import { Button, Badge, Input, Label, Select, Modal, EmptyState } from "../../../components/ui";

interface InsuranceEntry {
  id: string; caseId: string; customer: string; ownerType: string;
  insurer: string; startDate: string; endDate: string; holdAmt: string;
}

const MOCK: InsuranceEntry[] = [
  { id: "i1", caseId: "CAR-2026-0148", customer: "Raj Kumar",    ownerType: "Individual", insurer: "ICICI Lombard",  startDate: "2025-06-15", endDate: "2026-06-14", holdAmt: "12000" },
  { id: "i2", caseId: "CAR-2026-0147", customer: "Priya Sharma", ownerType: "Financer",   insurer: "HDFC Ergo",      startDate: "2025-05-20", endDate: "2026-05-19", holdAmt: "8500"  },
];

const MY_CASES = ["CAR-2026-0148", "CAR-2026-0147", "PL-2026-0146", "CAR-2026-0145", "CAR-2026-0142"];

export default function InsurancePage() {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ caseId: "", ownerType: "Individual", insurer: "", startDate: "", endDate: "", holdAmt: "" });

  function set(k: string, v: string) { setForm((p) => ({ ...p, [k]: v })); }

  function daysLeft(endDate: string) {
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    return diff;
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Insurance Entry</h1>
          <p className="text-sm text-muted mt-0.5">Log insurance details for your disbursed loan cases</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-3.5" /> Add Insurance
        </Button>
      </div>

      {MOCK.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShieldCheck} title="No insurance entries" description="Add insurance details for your disbursed cases." action={<Button size="sm" onClick={() => setAddOpen(true)}>Add Insurance</Button>} />
        </div>
      ) : (
        <div className="space-y-3">
          {MOCK.map((entry) => {
            const days = daysLeft(entry.endDate);
            return (
              <div key={entry.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-semibold">{entry.caseId}</span>
                      <span className="font-medium text-sm">{entry.customer}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{entry.insurer} · {entry.ownerType}</p>
                  </div>
                  <Badge tone={days < 0 ? "danger" : days <= 30 ? "danger" : days <= 60 ? "warning" : "success"}>
                    {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Start Date</p>
                    <p className="text-sm font-medium">{new Date(entry.startDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">End Date</p>
                    <p className="text-sm font-medium">{new Date(entry.endDate).toLocaleDateString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted font-semibold uppercase tracking-wide">Hold Amount</p>
                    <p className="text-sm font-semibold font-mono">₹{Number(entry.holdAmt).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Insurance Entry" size="md">
        <div className="space-y-4">
          <div>
            <Label>Case ID</Label>
            <Select value={form.caseId} onChange={(e) => set("caseId", e.target.value)}>
              <option value="">Select case…</option>
              {MY_CASES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Insurance Owner Type</Label>
              <Select value={form.ownerType} onChange={(e) => set("ownerType", e.target.value)}>
                {["Individual", "Financer"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>Insurer Name</Label>
              <Input value={form.insurer} onChange={(e) => set("insurer", e.target.value)} placeholder="e.g. ICICI Lombard" />
            </div>
            <div>
              <Label>Policy Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            </div>
            <div>
              <Label>Policy End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Hold Amount (₹)</Label>
              <Input type="number" value={form.holdAmt} onChange={(e) => set("holdAmt", e.target.value)} placeholder="e.g. 12000" />
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button size="sm">Save Insurance</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
