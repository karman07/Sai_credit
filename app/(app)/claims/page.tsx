"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, Receipt, X, FileText, Image, ExternalLink } from "lucide-react";
import { MonthPicker } from "../../../components/MonthPicker";
import { Button } from "../../../components/ui";
import { claimsApi, usersApi, type Claim, type AdminUser, API_BASE } from "../../../lib/api";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:  { label: "Pending",  icon: Clock,        color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle,      color: "text-red-700 bg-red-50 border-red-200" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function nowMonth() { return new Date().toISOString().slice(0, 7); }

function userName(uid: Claim["userId"]) {
  if (typeof uid === "object") return `${uid.firstName} ${uid.lastName}`;
  return "—";
}

function isPdf(url: string) { return url.toLowerCase().endsWith(".pdf"); }

function BillLink({ url }: { url: string }) {
  const full = url.startsWith("http") ? url : `${API_BASE.replace("/api/v1", "")}${url}`;
  return (
    <a
      href={full}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-surface-2 text-xs font-medium text-foreground hover:bg-surface-3 transition-colors"
    >
      {isPdf(url) ? <FileText className="size-3.5 text-red-500" /> : <Image className="size-3.5 text-blue-500" />}
      View Bill
      <ExternalLink className="size-3 text-muted" />
    </a>
  );
}

export default function AdminClaimsPage() {
  const [claims, setClaims]           = useState<Claim[]>([]);
  const [total, setTotal]             = useState(0);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [filterMonth, setFilterMonth] = useState(nowMonth());
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterUser, setFilterUser]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  const [reviewing, setReviewing]     = useState<Claim | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote]   = useState("");
  const [submitting, setSubmitting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q: Record<string, string> = {};
      if (filterMonth)  q.month  = filterMonth;
      if (filterStatus) q.status = filterStatus;
      if (filterUser)   q.userId = filterUser;
      const res = await claimsApi.list(q);
      setClaims(res.data.claims);
      setTotal(res.data.total);
    } catch { setError("Failed to load claims"); }
    finally { setLoading(false); }
  }, [filterMonth, filterStatus, filterUser]);

  useEffect(() => {
    usersApi.list({}).then((r) => setUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReview() {
    if (!reviewing) return;
    setSubmitting(true);
    setError("");
    try {
      await claimsApi.review(reviewing._id, { status: reviewStatus, reviewNote: reviewNote || undefined });
      setReviewing(null);
      setReviewNote("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingAmount  = claims.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const approvedAmount = claims.filter((c) => c.status === "approved").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Claims Management</h1>
        <p className="text-sm text-muted mt-0.5">Review and process staff reimbursement claims</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-muted">Total</p>
          <p className="text-2xl font-bold mt-1">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Pending Count</p>
          <p className="text-2xl font-bold mt-1 text-yellow-600">{claims.filter((c) => c.status === "pending").length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Pending Amount</p>
          <p className="text-xl font-bold mt-1 text-yellow-600">{fmt(pendingAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-muted">Approved Amount</p>
          <p className="text-xl font-bold mt-1 text-green-600">{fmt(approvedAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <MonthPicker value={filterMonth} onChange={setFilterMonth} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="input text-sm">
          <option value="">All Staff</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
        </select>
      </div>

      {/* Claims table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading…</div>
        ) : claims.length === 0 ? (
          <div className="p-10 text-center">
            <Receipt className="size-10 text-muted/40 mx-auto mb-3" />
            <p className="text-sm text-muted">No claims found for current filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  {["Staff", "Month", "Type", "Amount", "Description", "Bill", "Status", "Date", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {claims.map((c) => {
                  const cfg = STATUS_CONFIG[c.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={c._id} className="hover:bg-surface-2/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{userName(c.userId)}</p>
                        {typeof c.userId === "object" && (
                          <p className="text-xs text-muted capitalize">{c.userId.role.replace(/_/g, " ")}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{c.month}</td>
                      <td className="px-4 py-3 capitalize text-muted">{c.type}</td>
                      <td className="px-4 py-3 font-semibold">{fmt(c.amount)}</td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="truncate text-muted text-xs">{c.description}</p>
                        {c.reviewNote && <p className="text-xs italic text-muted/70 truncate mt-0.5">"{c.reviewNote}"</p>}
                      </td>
                      <td className="px-4 py-3">
                        {c.receiptUrl ? (
                          <BillLink url={c.receiptUrl} />
                        ) : (
                          <span className="text-xs text-muted/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                          <Icon className="size-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "pending" && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => { setReviewing(c); setReviewStatus("approved"); setReviewNote(""); }}
                          >
                            Review
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Review Modal ──────────────────────────────────────────────── */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">Review Claim</h2>
                <p className="text-xs text-muted mt-0.5">{userName(reviewing.userId)}</p>
              </div>
              <button
                onClick={() => setReviewing(null)}
                className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Claim details */}
            <div className="rounded-xl bg-surface-2 border border-border p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Type</span>
                <span className="font-medium capitalize">{reviewing.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Amount</span>
                <span className="font-bold text-base">{fmt(reviewing.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Month</span>
                <span>{reviewing.month}</span>
              </div>
              <div className="pt-1 border-t border-border">
                <p className="text-muted text-xs mb-1">Description</p>
                <p className="text-sm">{reviewing.description}</p>
              </div>
              {reviewing.receiptUrl && (
                <div className="pt-1 border-t border-border flex items-center justify-between">
                  <span className="text-muted text-xs">Attached Bill</span>
                  <BillLink url={reviewing.receiptUrl} />
                </div>
              )}
            </div>

            {/* Bill preview (image only) */}
            {reviewing.receiptUrl && !isPdf(reviewing.receiptUrl) && (
              <div className="rounded-xl overflow-hidden border border-border bg-surface-2">
                <img
                  src={reviewing.receiptUrl.startsWith("http") ? reviewing.receiptUrl : `${API_BASE.replace("/api/v1", "")}${reviewing.receiptUrl}`}
                  alt="Bill preview"
                  className="w-full max-h-52 object-contain p-2"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}

            {/* Decision buttons */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Decision</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReviewStatus("approved")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    reviewStatus === "approved"
                      ? "bg-green-50 border-green-400 text-green-700 shadow-sm"
                      : "border-border text-muted hover:border-green-300 hover:text-green-600"
                  }`}
                >
                  <CheckCircle2 className="size-4" /> Approve
                </button>
                <button
                  onClick={() => setReviewStatus("rejected")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    reviewStatus === "rejected"
                      ? "bg-red-50 border-red-400 text-red-700 shadow-sm"
                      : "border-border text-muted hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  <XCircle className="size-4" /> Reject
                </button>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide">
                Note <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={reviewStatus === "approved" ? "e.g. Approved as per policy" : "Reason for rejection…"}
                className="input w-full text-sm resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setReviewing(null)}>
                Cancel
              </Button>
              <Button
                size="md"
                className={`flex-1 ${reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                loading={submitting}
                onClick={handleReview}
              >
                {reviewStatus === "approved" ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
