"use client";

import { useState } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, User, Car, Building2, Eye } from "lucide-react";
import { Button, Input, Label, Select, Textarea } from "../../../components/ui";

const STEPS = [
  { id: 1, title: "Customer Info",         icon: User,      desc: "Personal and contact details" },
  { id: 2, title: "Vehicle & Loan",         icon: Car,       desc: "Loan type, vehicle, and amounts" },
  { id: 3, title: "Bank & Dealer",          icon: Building2, desc: "Assign bank, dealer, and payout" },
  { id: 4, title: "Review & Submit",        icon: Eye,       desc: "Confirm and submit the lead" },
];

const PRODUCTS = ["Car Loan", "Truck", "Personal Loan", "BT Topup", "Two Wheeler"];
const BANKS = ["HDFC Bank", "Kotak Mahindra", "Axis Bank", "ICICI Bank", "SBI", "IDFC First Bank", "Bajaj Finserv"];
const COORDINATORS = ["Arjun Mehta", "Kavya Reddy", "Sanjay Kumar", "Priti Singh", "Ravi Teja"];
const DEALERS = ["Sunrise Motors", "Galaxy Auto Sales", "Prime Vehicles", "Star Cars Pvt Ltd", "Royal Auto Hub"];

interface FormData {
  // Step 1
  firstName: string; lastName: string; fatherName: string; contact: string;
  altContact: string; location: string; residentialStatus: string; ebillOwner: string;
  // Step 2
  product: string; vehicleModel: string; regNumber: string; ownerSerial: string;
  existingInsurer: string; hypothecation: string; nocRequired: string;
  challanCount: string; loanType: string; loanAmount: string;
  // Step 3
  bank: string; branch: string; bmName: string; bmContact: string;
  executive: string; dealer: string; payoutPct: string;
}

const INITIAL: FormData = {
  firstName: "", lastName: "", fatherName: "", contact: "", altContact: "",
  location: "", residentialStatus: "Own", ebillOwner: "Yes",
  product: "", vehicleModel: "", regNumber: "", ownerSerial: "1st",
  existingInsurer: "", hypothecation: "Yes", nocRequired: "No",
  challanCount: "0", loanType: "New", loanAmount: "",
  bank: "", branch: "", bmName: "", bmContact: "", executive: "", dealer: "", payoutPct: "1",
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-danger mt-1">{msg}</p>;
}

export default function NewLeadPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(key: keyof FormData, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(s: number): boolean {
    const errs: typeof errors = {};
    if (s === 1) {
      if (!form.firstName) errs.firstName = "Required";
      if (!form.lastName)  errs.lastName  = "Required";
      if (!form.contact || form.contact.length < 10) errs.contact = "Valid phone required";
      if (!form.location)  errs.location  = "Required";
    }
    if (s === 2) {
      if (!form.product)    errs.product    = "Select a product";
      if (!form.loanAmount) errs.loanAmount = "Required";
    }
    if (s === 3) {
      if (!form.bank)   errs.bank   = "Select a bank";
      if (!form.dealer) errs.dealer = "Select a dealer";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() { if (validateStep(step)) setStep((s) => Math.min(s + 1, 4)); }
  function back() { setStep((s) => Math.max(s - 1, 1)); }

  async function submit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn">
        <div className="size-16 rounded-full bg-success-subtle grid place-items-center mb-4">
          <CheckCircle2 className="size-8 text-success" />
        </div>
        <h2 className="text-xl font-bold">Lead Submitted!</h2>
        <p className="text-sm text-muted mt-1 mb-6">The case has been created and assigned. Case ID: <span className="font-mono font-bold text-primary">CAR-2026-0149</span></p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { setSubmitted(false); setStep(1); setForm(INITIAL); }}>Add Another Lead</Button>
          <Button onClick={() => {}}>View Case</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">New Lead</h1>
        <p className="text-sm text-muted mt-0.5">Fill in the details to create a new loan case</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
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
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 max-w-[40px] mx-1 transition-colors ${s.id < step ? "bg-success" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step card */}
      <div className="card p-6 animate-fadeIn" key={step}>
        <div className="flex items-center gap-2 mb-5">
          {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="size-5 text-primary" />; })()}
          <div>
            <p className="font-semibold">{STEPS[step - 1].title}</p>
            <p className="text-xs text-muted">{STEPS[step - 1].desc}</p>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name *</Label>
              <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First name" />
              <FieldError msg={errors.firstName} />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last name" />
              <FieldError msg={errors.lastName} />
            </div>
            <div>
              <Label>Father's Name</Label>
              <Input value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} placeholder="Father's name" />
            </div>
            <div>
              <Label>Contact Number *</Label>
              <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="+91 XXXXX XXXXX" type="tel" />
              <FieldError msg={errors.contact} />
            </div>
            <div>
              <Label>Alternate Contact</Label>
              <Input value={form.altContact} onChange={(e) => set("altContact", e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label>Location / City *</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="City" />
              <FieldError msg={errors.location} />
            </div>
            <div>
              <Label>Residential Status</Label>
              <Select value={form.residentialStatus} onChange={(e) => set("residentialStatus", e.target.value)}>
                {["Own", "Rented", "Family Owned"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>E-Bill Owner</Label>
              <Select value={form.ebillOwner} onChange={(e) => set("ebillOwner", e.target.value)}>
                {["Yes", "No"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product Type *</Label>
              <Select value={form.product} onChange={(e) => set("product", e.target.value)}>
                <option value="">Select…</option>
                {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
              </Select>
              <FieldError msg={errors.product} />
            </div>
            <div>
              <Label>Loan Type</Label>
              <Select value={form.loanType} onChange={(e) => set("loanType", e.target.value)}>
                {["New", "Used", "Refinance"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>Vehicle Model</Label>
              <Input value={form.vehicleModel} onChange={(e) => set("vehicleModel", e.target.value)} placeholder="e.g. Maruti Swift 2024" />
            </div>
            <div>
              <Label>Registration Number</Label>
              <Input value={form.regNumber} onChange={(e) => set("regNumber", e.target.value)} placeholder="e.g. MH02-AB-1234" className="uppercase" />
            </div>
            <div>
              <Label>Owner Serial</Label>
              <Select value={form.ownerSerial} onChange={(e) => set("ownerSerial", e.target.value)}>
                {["1st", "2nd", "3rd"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>Existing Insurer</Label>
              <Input value={form.existingInsurer} onChange={(e) => set("existingInsurer", e.target.value)} placeholder="Insurance company" />
            </div>
            <div>
              <Label>Hypothecation</Label>
              <Select value={form.hypothecation} onChange={(e) => set("hypothecation", e.target.value)}>
                {["Yes", "No"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>NOC Required</Label>
              <Select value={form.nocRequired} onChange={(e) => set("nocRequired", e.target.value)}>
                {["No", "Yes"].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </div>
            <div>
              <Label>Challan Count</Label>
              <Input value={form.challanCount} onChange={(e) => set("challanCount", e.target.value)} type="number" min="0" />
            </div>
            <div>
              <Label>Loan Amount (₹) *</Label>
              <Input value={form.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} type="number" placeholder="e.g. 850000" />
              <FieldError msg={errors.loanAmount} />
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank / NBFC *</Label>
              <Select value={form.bank} onChange={(e) => set("bank", e.target.value)}>
                <option value="">Select…</option>
                {BANKS.map((b) => <option key={b}>{b}</option>)}
              </Select>
              <FieldError msg={errors.bank} />
            </div>
            <div>
              <Label>Branch</Label>
              <Input value={form.branch} onChange={(e) => set("branch", e.target.value)} placeholder="Branch name" />
            </div>
            <div>
              <Label>BM Name</Label>
              <Input value={form.bmName} onChange={(e) => set("bmName", e.target.value)} placeholder="Business Manager" />
            </div>
            <div>
              <Label>BM Contact</Label>
              <Input value={form.bmContact} onChange={(e) => set("bmContact", e.target.value)} placeholder="+91 XXXXX XXXXX" />
            </div>
            <div>
              <Label>Executive</Label>
              <Input value={form.executive} onChange={(e) => set("executive", e.target.value)} placeholder="Executive name" />
            </div>
            <div>
              <Label>Dealer *</Label>
              <Select value={form.dealer} onChange={(e) => set("dealer", e.target.value)}>
                <option value="">Select…</option>
                {DEALERS.map((d) => <option key={d}>{d}</option>)}
              </Select>
              <FieldError msg={errors.dealer} />
            </div>
            <div>
              <Label>Payout %</Label>
              <Input value={form.payoutPct} onChange={(e) => set("payoutPct", e.target.value)} type="number" step="0.1" min="0" max="5" />
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            {[
              {
                section: "Customer Info",
                fields: [
                  ["Name", `${form.firstName} ${form.lastName}`],
                  ["Father's Name", form.fatherName || "—"],
                  ["Contact", form.contact],
                  ["Location", form.location],
                  ["Residential Status", form.residentialStatus],
                ],
              },
              {
                section: "Vehicle & Loan",
                fields: [
                  ["Product", form.product],
                  ["Loan Type", form.loanType],
                  ["Vehicle Model", form.vehicleModel || "—"],
                  ["Registration", form.regNumber || "—"],
                  ["Loan Amount", form.loanAmount ? `₹${Number(form.loanAmount).toLocaleString("en-IN")}` : "—"],
                ],
              },
              {
                section: "Bank & Dealer",
                fields: [
                  ["Bank", form.bank],
                  ["Dealer", form.dealer],
                  ["Payout %", `${form.payoutPct}%`],
                ],
              },
            ].map((section) => (
              <div key={section.section} className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 bg-surface-2 border-b border-border">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{section.section}</p>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border">
                  {section.fields.map(([label, value]) => (
                    <div key={label} className="bg-surface px-4 py-3">
                      <p className="text-[11px] text-muted font-medium">{label}</p>
                      <p className="text-sm font-semibold mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={back} disabled={step === 1}>
          <ChevronLeft className="size-3.5" /> Back
        </Button>
        <span className="text-xs text-muted">Step {step} of {STEPS.length}</span>
        {step < 4 ? (
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
  );
}
