"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Receipt, CheckCircle2, XCircle, Clock, Trash2, X, Upload, FileText, Image, ExternalLink, Paperclip } from "lucide-react";
import { Button, Input, Select, Textarea, Label } from "../../../components/ui";
import { api, claimsApi, type Claim, API_BASE } from "../../../lib/api";
import { MonthPicker } from "../../../components/MonthPicker";

const CLAIM_TYPES = [
  { value: "travel",        label: "Travel" },
  { value: "food",          label: "Food & Meals" },
  { value: "accommodation", label: "Accommodation" },
  { value: "other",         label: "Other" },
] as const;

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:  { label: "Pending",  icon: Clock,        color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle,      color: "text-red-600 bg-red-50 border-red-200" },
};

function nowMonth() { return new Date().toISOString().slice(0, 7); }

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function isPdf(url?: string) { return url?.toLowerCase().endsWith(".pdf"); }

function ReceiptLink({ url }: { url: string }) {
  const full = url.startsWith("http") ? url : `${API_BASE.replace("/api/v1", "")}${url}`;
  return (
    <a
      href={full}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      {isPdf(url) ? <FileText className="size-3.5" /> : <Image className="size-3.5" />}
      View Bill
      <ExternalLink className="size-3" />
    </a>
  );
}

interface FormState {
  month: string; type: string; amount: string; description: string;
}

export default function ClaimsPage() {
  const [claims, setClaims]         = useState<Claim[]>([]);
  const [total, setTotal]           = useState(0);
  const [filterMonth, setFilterMonth] = useState(nowMonth());
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [form, setForm]             = useState<FormState>({ month: nowMonth(), type: "travel", amount: "", description: "" });
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q: Record<string, string> = {};
      if (filterMonth)  q.month  = filterMonth;
      if (filterStatus) q.status = filterStatus;
      const res = await claimsApi.list(q);
      setClaims(res.data.claims);
      setTotal(res.data.total);
    } catch { setError("Failed to load claims"); }
    finally { setLoading(false); }
  }, [filterMonth, filterStatus]);

  useEffect(() => { load(); }, [load]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (!f) { setPreview(null); return; }
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null); // PDF — show name only
    }
  }

  function resetForm() {
    setForm({ month: nowMonth(), type: "travel", amount: "", description: "" });
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.description) return;
    setSubmitting(true);
    setError("");
    try {
      // Step 1 — create claim
      const res = await claimsApi.create({
        month: form.month,
        type: form.type,
        amount: parseFloat(form.amount),
        description: form.description,
      });
      const claimId = res.data._id;

      // Step 2 — upload receipt if provided
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post(`/claims/${claimId}/upload-receipt`, fd);
      }

      setShowForm(false);
      resetForm();
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this claim?")) return;
    try {
      await claimsApi.cancel(id);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Failed to cancel claim");
    }
  }

  const pendingTotal  = claims.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const approvedTotal = claims.filter((c) => c.status === "approved").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">My Claims</h1>
          <p className="text-sm text-muted mt-0.5">Submit and track reimbursement claims</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="size-4" /> New Claim
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Total Claims</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Pending Amount</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">{fmt(pendingTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Approved Amount</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{fmt(approvedTotal)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <MonthPicker value={filterMonth} onChange={setFilterMonth} />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      {/* Claims list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt className="size-10 text-muted/40 mx-auto mb-3" />
            <p className="text-sm text-muted">No claims found</p>
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} className="mt-3">
              Submit your first claim
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {claims.map((c) => {
              const cfg = STATUS_CONFIG[c.status];
              const Icon = cfg.icon;
              return (
                <div key={c._id} className="flex items-start gap-4 px-4 py-4 hover:bg-surface-2/40">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm capitalize">{c.type.replace("_", " ")}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border flex items-center gap-1 ${cfg.color}`}>
                        <Icon className="size-3" /> {cfg.label}
                      </span>
                      <span className="text-xs text-muted">{c.month}</span>
                    </div>
                    <p className="text-sm text-muted mt-1 truncate">{c.description}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {c.receiptUrl && <ReceiptLink url={c.receiptUrl} />}
                      {c.reviewNote && (
                        <p className="text-xs text-muted italic">"{c.reviewNote}"</p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-sm">{fmt(c.amount)}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString("en-IN")}
                    </p>
                    {c.status === "pending" && (
                      <button
                        onClick={() => handleCancel(c._id)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 ml-auto"
                      >
                        <Trash2 className="size-3" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New Claim Modal ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">Submit Claim</h2>
                <p className="text-xs text-muted mt-0.5">Attach a bill for faster approval</p>
              </div>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Month + Type */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Month</Label>
                  <MonthPicker
                    value={form.month}
                    onChange={(v) => setForm((f) => ({ ...f, month: v }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full"
                  >
                    {CLAIM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm font-medium select-none pointer-events-none">₹</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full !pl-8"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe the expense…"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full"
                  required
                />
              </div>

              {/* Bill Upload */}
              <div className="space-y-1.5">
                <Label>
                  Bill / Receipt <span className="font-normal normal-case text-muted/70">(image or PDF, max 10 MB)</span>
                </Label>

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors
                    ${file ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-surface-2/60"}`}
                  style={{ minHeight: file && preview ? undefined : "90px" }}
                >
                  {file ? (
                    preview ? (
                      /* Image preview */
                      <div className="relative w-full">
                        <img
                          src={preview}
                          alt="Receipt preview"
                          className="w-full max-h-44 object-contain rounded-xl p-2"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                          className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      /* PDF — icon + name */
                      <div className="flex items-center gap-3 px-4 py-3 w-full">
                        <div className="size-10 rounded-lg bg-red-50 border border-red-200 grid place-items-center shrink-0">
                          <FileText className="size-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                          className="text-muted hover:text-red-500"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1 py-4 px-3 text-center">
                      <div className="size-9 rounded-xl bg-surface-2 grid place-items-center mb-1">
                        <Paperclip className="size-4 text-muted" />
                      </div>
                      <p className="text-sm font-medium text-foreground">Click to attach bill</p>
                      <p className="text-xs text-muted">JPG, PNG, PDF up to 10 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => { setShowForm(false); resetForm(); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1"
                  loading={submitting}
                >
                  {submitting ? "Submitting…" : "Submit Claim"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
