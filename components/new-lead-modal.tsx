"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CheckCircle2, ChevronRight, ChevronLeft, User, Car, Building2, Eye } from "lucide-react";
import { Button, Input, Label, Select, Modal } from "./ui";
import {
  banksApi, dealersApi, casesApi, mastersApi, formSchemasApi,
  type Bank, type Dealer, type FormSchema, type FieldDef,
} from "../lib/api";

// ── Core field key → case payload path mapping ────────────────────────────────
// These keys are "special" — they map to named fields in the case payload rather
// than going into customFields.
const CORE_KEYS = new Set([
  "firstName", "lastName", "fatherName", "contact", "altContact",
  "state", "location", "residentialStatus", "ebillOwner",
  "product", "loanType", "vehicleModel", "regNumber", "ownerSerial",
  "existingInsurer", "hypothecation", "nocRequired", "challanCount", "loanAmount",
  "bank", "branch", "bmName", "bmContact", "executive", "dealer", "payoutPct",
]);

// Section id → step number
const SECTION_STEP: Record<string, number> = {
  "customer-info": 1,
  "vehicle-loan":  2,
  "bank-dealer":   3,
};

const STEP_ICONS = [User, Car, Building2, Eye];
const STEP_DESCS = [
  "Personal and contact details",
  "Loan type, vehicle, and amounts",
  "Assign bank, dealer, and payout",
  "Confirm and submit the lead",
];

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-danger mt-1">{msg}</p>;
}

// ── Dynamic field renderer ────────────────────────────────────────────────────

interface DynFieldProps {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  banks?: Bank[];
  dealers?: Dealer[];
  cities?: string[];
  states?: string[];
}

function DynField({ field, value, onChange, error, banks, dealers, cities, states }: DynFieldProps) {
  const id = `field-${field.key}`;

  function renderInput() {
    // Special handling for dynamic option fields
    if (field.key === "state") {
      return (
        <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select state…</option>
          {(states ?? []).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      );
    }
    if (field.key === "location") {
      return (cities ?? []).length > 0 ? (
        <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select city…</option>
          {(cities ?? []).map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      ) : (
        <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />
      );
    }
    if (field.key === "bank") {
      return (
        <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select bank…</option>
          {(banks ?? []).map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </Select>
      );
    }
    if (field.key === "dealer") {
      return (
        <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select dealer…</option>
          {(dealers ?? []).map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </Select>
      );
    }

    switch (field.type) {
      case "select":
        return (
          <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
            <option value="">Select…</option>
            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        );
      case "boolean":
        return (
          <Select id={id} value={value} onChange={e => onChange(e.target.value)}>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </Select>
        );
      case "number":
        return <Input id={id} value={value} onChange={e => onChange(e.target.value)} type="number" placeholder={field.placeholder} />;
      case "tel":
        return <Input id={id} value={value} onChange={e => onChange(e.target.value)} type="tel" placeholder={field.placeholder} />;
      case "date":
        return <Input id={id} value={value} onChange={e => onChange(e.target.value)} type="date" />;
      default:
        return <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} />;
    }
  }

  return (
    <div>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-danger ml-0.5">*</span>}
      </Label>
      {renderInput()}
      {error && <FieldError msg={error} />}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function NewLeadModal() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get("new-lead") === "true";

  const [step, setStep] = useState(1);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdCaseCode, setCreatedCaseCode] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Total steps = schema sections + review step
  const totalSteps = schema ? schema.sections.length + 1 : 4;
  const reviewStep = totalSteps;

  useEffect(() => {
    if (!open) return;
    banksApi.list().then(r => setBanks(r.data)).catch(console.error);
    dealersApi.list().then(r => setDealers(r.data)).catch(console.error);
    mastersApi.list("cities")
      .then(r => setCities([...new Set<string>(r.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort()))
      .catch(console.error);
    mastersApi.list("states")
      .then(r => setStates([...new Set<string>(r.data.filter((d: any) => d.isActive).map((d: any) => d.name as string))].sort()))
      .catch(console.error);

    formSchemasApi.get("new-case").then(r => {
      const s = r.data;
      setSchema(s);
      // Initialise defaults from schema
      const defaults: Record<string, string> = {};
      for (const section of s.sections) {
        for (const f of section.fields) {
          if (f.isActive && f.defaultValue !== undefined) {
            defaults[f.key] = f.defaultValue;
          }
        }
      }
      setFormValues(prev => ({ ...defaults, ...prev }));
    }).catch(console.error);
  }, [open]);

  function showToast(type: "success" | "error", text: string) {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  }

  function close() {
    setStep(1);
    setFormValues({});
    setErrors({});
    setSubmitted(false);
    setCreatedCaseCode("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("new-lead");
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl);
  }

  function setVal(key: string, val: string) {
    // When bank changes, auto-fill bank-related fields from bank record
    if (key === "bank") {
      const b = banks.find(x => x._id === val);
      if (b) {
        setFormValues(prev => ({
          ...prev,
          bank: val,
          branch: b.branch ?? "",
          bmName: b.bmName ?? "",
          bmContact: b.bmContact ?? "",
          executive: b.executive ?? "",
        }));
        setErrors(prev => ({ ...prev, bank: undefined as any }));
        return;
      }
    }
    setFormValues(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined as any }));
  }

  function activeFieldsForStep(stepNum: number): FieldDef[] {
    if (!schema) return [];
    const section = schema.sections[stepNum - 1];
    return section ? section.fields.filter(f => f.isActive) : [];
  }

  function validateStep(stepNum: number): boolean {
    if (!schema) return true;
    const fields = activeFieldsForStep(stepNum);
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required) {
        const v = formValues[f.key] ?? "";
        if (!v.trim()) errs[f.key] = "Required";
        if ((f.key === "contact") && v.length < 10) errs[f.key] = "Valid phone required";
      }
    }
    setErrors(prev => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep(step)) setStep(s => Math.min(s + 1, reviewStep)); }
  function back() { setStep(s => Math.max(s - 1, 1)); }

  function buildPayload(isDraft: boolean) {
    if (!schema) return null;
    const v = formValues;
    const customFields: Record<string, any> = {};

    for (const section of schema.sections) {
      for (const f of section.fields) {
        if (!CORE_KEYS.has(f.key)) {
          const raw = v[f.key];
          if (raw !== undefined && raw !== "") {
            customFields[f.key] = f.type === "number" ? Number(raw) : raw;
          }
        }
      }
    }

    return {
      customer: {
        firstName: v.firstName,
        lastName: v.lastName || undefined,
        fatherName: v.fatherName || undefined,
        contact: v.contact,
        altContact: v.altContact || undefined,
        location: v.location || undefined,
        state: v.state || undefined,
        residentialStatus: v.residentialStatus,
        ebillOwner: v.ebillOwner === "Yes",
      },
      product: v.product || undefined,
      loanType: v.loanType || undefined,
      vehicleModel: v.vehicleModel || undefined,
      regNumber: v.regNumber || undefined,
      ownerSerial: v.ownerSerial,
      existingInsurer: v.existingInsurer || undefined,
      hypothecation: v.hypothecation === "Yes",
      nocRequired: v.nocRequired === "Yes",
      challanCount: Number(v.challanCount) || 0,
      loanAmount: v.loanAmount ? Number(v.loanAmount) : undefined,
      bankId: v.bank || undefined,
      bankBranch: v.branch || undefined,
      bmName: v.bmName || undefined,
      bmContact: v.bmContact || undefined,
      bankExecutive: v.executive || undefined,
      dealerId: v.dealer || undefined,
      payoutPct: Number(v.payoutPct) || 0,
      status: isDraft ? "Draft" : "Sales",
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  }

  async function submit() {
    let valid = true;
    if (schema) {
      for (let i = 1; i <= schema.sections.length; i++) {
        if (!validateStep(i)) valid = false;
      }
    }
    if (!valid) { showToast("error", "Please fill all required fields."); return; }
    setSubmitting(true);
    try {
      const payload = buildPayload(false);
      const res = await casesApi.create(payload);
      setCreatedCaseCode(res.data.caseCode);
      setSubmitted(true);
    } catch (e: any) {
      showToast("error", e.message ?? "Failed to submit lead");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveDraft() {
    const errs: Record<string, string> = {};
    if (!formValues.firstName?.trim()) errs.firstName = "Required to save draft";
    if (!formValues.contact || formValues.contact.length < 10) errs.contact = "Valid phone required";
    if (!formValues.dealer) errs.dealer = "Required to save draft";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast("error", "First name, valid contact, and dealer are required to save draft.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(true);
      const res = await casesApi.create(payload);
      setCreatedCaseCode(res.data.caseCode);
      setSubmitted(true);
    } catch (e: any) {
      showToast("error", e.message ?? "Failed to save draft");
    } finally {
      setSubmitting(false);
    }
  }

  // Build steps from schema
  const steps = schema
    ? [
        ...schema.sections.map((s, i) => ({
          id: i + 1,
          title: s.title,
          icon: STEP_ICONS[i] ?? Eye,
          desc: STEP_DESCS[i] ?? s.title,
        })),
        { id: reviewStep, title: "Review & Submit", icon: Eye, desc: "Confirm and submit the lead" },
      ]
    : [
        { id: 1, title: "Customer Info",  icon: User,      desc: "Personal and contact details" },
        { id: 2, title: "Vehicle & Loan", icon: Car,       desc: "Loan type, vehicle, and amounts" },
        { id: 3, title: "Bank & Dealer",  icon: Building2, desc: "Assign bank, dealer, and payout" },
        { id: 4, title: "Review & Submit",icon: Eye,       desc: "Confirm and submit the lead" },
      ];

  if (submitted) {
    return (
      <Modal open={open} onClose={close} size="md">
        <div className="flex flex-col items-center justify-center py-8 px-4 animate-fadeIn">
          <div className="size-16 rounded-full bg-success-subtle grid place-items-center mb-4">
            <CheckCircle2 className="size-8 text-success" />
          </div>
          <h2 className="text-xl font-bold">Case Saved!</h2>
          <p className="text-sm text-center text-muted mt-1 mb-6">
            Case ID: <span className="font-mono font-bold text-primary">{createdCaseCode}</span>
          </p>
          <div className="flex gap-3 w-full">
            <Button variant="secondary" className="flex-1" onClick={() => { setSubmitted(false); setStep(1); setFormValues({}); }}>
              Add Another
            </Button>
            <Button className="flex-1" onClick={close}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} size="xl">
      <div className="flex flex-col h-full max-h-[85vh]">
        {/* Header */}
        <div className="shrink-0 p-5 border-b border-border relative">
          <h1 className="text-xl font-bold tracking-tight">New Lead</h1>
          <p className="text-sm text-muted mt-0.5">Fill in the details to create a new loan case</p>

          {toastMsg && (
            <div className={`absolute top-4 right-4 px-3 py-1.5 rounded text-xs font-semibold shadow-md z-50 animate-fadeIn ${
              toastMsg.type === "success" ? "bg-success text-white" : "bg-danger text-white"
            }`}>
              {toastMsg.text}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex items-center gap-0 mt-6">
            {steps.map((s, i) => {
              const isActive = s.id === step;
              const isDone   = s.id < step;
              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`size-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                      isDone  ? "bg-success border-success text-white" :
                      isActive ? "bg-primary border-primary text-primary-foreground" :
                                 "bg-surface border-border text-muted"
                    }`}>
                      {isDone ? <CheckCircle2 className="size-4" /> : s.id}
                    </div>
                    <p className={`text-[11px] font-semibold mt-1 text-center leading-tight hidden sm:block ${isActive ? "text-primary" : isDone ? "text-success" : "text-muted"}`}>
                      {s.title}
                    </p>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`h-0.5 flex-1 max-w-[40px] mx-1 transition-colors ${s.id < step ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[300px]">
          {schema && step <= schema.sections.length && (
            <>
              <div className="flex items-center gap-2 mb-5">
                {(() => { const Icon = steps[step - 1]?.icon ?? Eye; return <Icon className="size-5 text-primary" />; })()}
                <div>
                  <p className="font-semibold">{steps[step - 1]?.title}</p>
                  <p className="text-xs text-muted">{steps[step - 1]?.desc}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {activeFieldsForStep(step).map(field => (
                  <DynField
                    key={field.key}
                    field={field}
                    value={formValues[field.key] ?? ""}
                    onChange={v => setVal(field.key, v)}
                    error={errors[field.key]}
                    banks={banks}
                    dealers={dealers}
                    cities={cities}
                    states={states}
                  />
                ))}
              </div>
            </>
          )}

          {/* Review step */}
          {step === reviewStep && schema && (
            <div className="space-y-4">
              {schema.sections.map(section => {
                const activeFields = section.fields.filter(f => f.isActive);
                return (
                  <div key={section.id} className="rounded-lg border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-surface-2 border-b border-border">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted">{section.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-border">
                      {activeFields.map(f => {
                        let display = formValues[f.key] ?? "—";
                        if (f.key === "bank") display = (banks.find(b => b._id === display)?.name ?? display) || "—";
                        if (f.key === "dealer") display = (dealers.find(d => d._id === display)?.name ?? display) || "—";
                        if (f.key === "loanAmount" && display && display !== "—") {
                          display = `₹${Number(display).toLocaleString("en-IN")}`;
                        }
                        return (
                          <div key={f.key} className="bg-surface px-4 py-3">
                            <p className="text-[11px] text-muted font-medium">{f.label}</p>
                            <p className="text-sm font-semibold mt-0.5">{display || "—"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback while schema loads */}
          {!schema && (
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 w-24 bg-surface-2 rounded mb-2" />
                  <div className="h-9 bg-surface-2 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 p-5 border-t border-border flex items-center justify-between bg-surface-2/50 rounded-b-xl">
          <Button variant="secondary" onClick={back} disabled={step === 1}>
            <ChevronLeft className="size-3.5" /> Back
          </Button>
          <span className="text-xs text-muted">Step {step} of {totalSteps}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={saveDraft} loading={submitting}>
              Save as Draft
            </Button>
            {step < reviewStep ? (
              <Button onClick={next}>
                Next <ChevronRight className="size-3.5" />
              </Button>
            ) : (
              <Button onClick={submit} loading={submitting}>
                Submit Lead
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
