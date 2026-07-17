"use client";

import { Input, Label, Select } from "./ui";

export const INSURANCE_COVERAGE_TYPES = ["Comprehensive", "Third Party", "Own Damage"] as const;

export interface InsuranceCoreForm {
  insurer: string;
  coverageType: string;
  ownerType: string;
  insuredName: string;
  agentName: string;
  premiumAmount: string;
  holdAmount: string;
  startDate: string;
  endDate: string;
  reminderDate: string;
}

// Shared field block used by the "Add/Edit Insurance Entry" and "Convert to
// Insurance MIS" dialogs so the two stay visually and structurally in sync.
export function InsuranceEntryFields({
  form,
  onChange,
  ownerTypeOptions,
  insurerOptions,
  agentOptions = [],
  insuredNameOptions = [],
}: {
  form: InsuranceCoreForm;
  onChange: <K extends keyof InsuranceCoreForm>(key: K, value: InsuranceCoreForm[K]) => void;
  ownerTypeOptions: readonly string[];
  insurerOptions?: string[];
  agentOptions?: string[];
  insuredNameOptions?: string[];
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Insurer <span className="text-danger">*</span></Label>
          {insurerOptions ? (
            <Select value={form.insurer} onChange={(e) => onChange("insurer", e.target.value)}>
              <option value="">Select…</option>
              {insurerOptions.map((ins) => <option key={ins}>{ins}</option>)}
            </Select>
          ) : (
            <Input
              value={form.insurer}
              onChange={(e) => onChange("insurer", e.target.value)}
              placeholder="Insurance company name"
              required
            />
          )}
        </div>
        <div>
          <Label>Coverage Type</Label>
          <Select value={form.coverageType} onChange={(e) => onChange("coverageType", e.target.value)}>
            <option value="">Select…</option>
            {INSURANCE_COVERAGE_TYPES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
        <div>
          <Label>Owner Type</Label>
          <Select value={form.ownerType} onChange={(e) => onChange("ownerType", e.target.value)}>
            {ownerTypeOptions.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Insured Name</Label>
          <Input
            list="ins-insured-opts"
            value={form.insuredName}
            onChange={(e) => onChange("insuredName", e.target.value)}
            placeholder="Select or type…"
          />
          <datalist id="ins-insured-opts">
            {insuredNameOptions.map((n) => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <Label>Insurance Agent</Label>
          <Input
            list="ins-agent-opts"
            value={form.agentName}
            onChange={(e) => onChange("agentName", e.target.value)}
            placeholder="Select or type…"
          />
          <datalist id="ins-agent-opts">
            {agentOptions.map((a) => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <Label>Premium (₹)</Label>
          <Input type="number" min="0" value={form.premiumAmount} onChange={(e) => onChange("premiumAmount", e.target.value)} placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Hold Amount (₹)</Label>
          <Input type="number" min="0" value={form.holdAmount} onChange={(e) => onChange("holdAmount", e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Start Date <span className="text-danger">*</span></Label>
          <Input type="date" value={form.startDate} onChange={(e) => onChange("startDate", e.target.value)} required />
        </div>
        <div>
          <Label>End Date <span className="text-danger">*</span></Label>
          <Input type="date" value={form.endDate} onChange={(e) => onChange("endDate", e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Reminder Date</Label>
          <Input type="date" value={form.reminderDate} onChange={(e) => onChange("reminderDate", e.target.value)} />
        </div>
      </div>
    </>
  );
}
