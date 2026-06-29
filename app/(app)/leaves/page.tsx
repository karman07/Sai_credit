"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, CalendarOff, X, Users } from "lucide-react";
import { Button } from "../../../components/ui";
import { leavesApi, usersApi, type Leave, type AdminUser } from "../../../lib/api";
import { MonthPicker } from "../../../components/MonthPicker";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:   { label: "Pending",   icon: Clock,        color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  approved:  { label: "Approved",  icon: CheckCircle2, color: "text-green-700 bg-green-50 border-green-200" },
  rejected:  { label: "Rejected",  icon: XCircle,      color: "text-red-700 bg-red-50 border-red-200" },
  cancelled: { label: "Cancelled", icon: CalendarOff,  color: "text-muted bg-surface-2 border-border" },
};

const TYPE_LABELS: Record<string, string> = {
  casual: "Casual", sick: "Sick", earned: "Earned", unpaid: "Unpaid",
};

function userName(uid: Leave["userId"]) {
  if (typeof uid === "object") return `${uid.firstName} ${uid.lastName}`;
  return "—";
}
function userRole(uid: Leave["userId"]) {
  if (typeof uid === "object" && "role" in uid) return (uid as any).role.replace(/_/g, " ");
  return "";
}

function nowMonth() { return new Date().toISOString().slice(0, 7); }

export default function AdminLeavesPage() {
  const [leaves, setLeaves]           = useState<Leave[]>([]);
  const [total, setTotal]             = useState(0);
  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [filterMonth, setFilterMonth] = useState(nowMonth());
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterUser, setFilterUser]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");

  const [reviewing, setReviewing]       = useState<Leave | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">("approved");
  const [reviewNote, setReviewNote]     = useState("");
  const [submitting, setSubmitting]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q: Record<string, string> = {};
      if (filterMonth)  q.month  = filterMonth;
      if (filterStatus) q.status = filterStatus;
      if (filterUser)   q.userId = filterUser;
      const res = await leavesApi.list(q);
      setLeaves(res.data.leaves);
      setTotal(res.data.total);
    } catch { setError("Failed to load leaves"); }
    finally { setLoading(false); }
  }, [filterMonth, filterStatus, filterUser]);

  useEffect(() => { usersApi.list({}).then((r) => setUsers(r.data)).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  async function handleReview() {
    if (!reviewing) return;
    setSubmitting(true);
    setError("");
    try {
      await leavesApi.review(reviewing._id, { status: reviewStatus, reviewNote: reviewNote || undefined });
      setReviewing(null);
      setReviewNote("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Review failed");
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount  = leaves.filter((l) => l.status === "pending").length;
  const approvedCount = leaves.filter((l) => l.status === "approved").length;
  const totalDays     = leaves.filter((l) => l.status === "approved").reduce((s, l) => s + l.totalDays, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Leave Management</h1>
        <p className="text-sm text-muted mt-0.5">Review and approve staff leave requests</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-xs text-muted">Total Requests</p><p className="text-2xl font-bold mt-1">{total}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Pending</p><p className="text-2xl font-bold mt-1 text-yellow-600">{pendingCount}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Approved</p><p className="text-2xl font-bold mt-1 text-green-600">{approvedCount}</p></div>
        <div className="card p-4"><p className="text-xs text-muted">Approved Days</p><p className="text-2xl font-bold mt-1 text-primary">{totalDays}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <MonthPicker value={filterMonth} onChange={setFilterMonth} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="input text-sm">
          <option value="">All Staff</option>
          {users.map((u) => <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading…</div>
        ) : leaves.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarOff className="size-10 text-muted/40 mx-auto mb-3" />
            <p className="text-sm text-muted">No leave requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  {["Staff", "Type", "From", "To", "Days", "Reason", "Status", "Applied", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leaves.map((l) => {
                  const cfg = STATUS_CONFIG[l.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={l._id} className="hover:bg-surface-2/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{userName(l.userId)}</p>
                        <p className="text-xs text-muted capitalize">{userRole(l.userId)}</p>
                      </td>
                      <td className="px-4 py-3 capitalize font-medium">{TYPE_LABELS[l.type] ?? l.type}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(l.startDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">{new Date(l.endDate).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-3 font-bold text-center">{l.totalDays}</td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="truncate text-muted text-xs">{l.reason}</p>
                        {l.reviewNote && <p className="text-xs italic text-muted/70 mt-0.5 truncate">"{l.reviewNote}"</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
                          <Icon className="size-3" /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                        {new Date(l.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        {l.status === "pending" && (
                          <Button variant="outline" size="xs" onClick={() => { setReviewing(l); setReviewStatus("approved"); setReviewNote(""); }}>
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

      {/* Review Modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base">Review Leave Request</h2>
                <p className="text-xs text-muted mt-0.5">{userName(reviewing.userId)}</p>
              </div>
              <button onClick={() => setReviewing(null)} className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors">
                <X className="size-4" />
              </button>
            </div>

            {/* Details */}
            <div className="rounded-xl bg-surface-2 border border-border p-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Type</span>
                <span className="font-medium capitalize">{TYPE_LABELS[reviewing.type] ?? reviewing.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Duration</span>
                <span className="font-semibold">{reviewing.totalDays} day{reviewing.totalDays !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">From</span>
                <span>{new Date(reviewing.startDate).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">To</span>
                <span>{new Date(reviewing.endDate).toLocaleDateString("en-IN")}</span>
              </div>
              <div className="pt-1 border-t border-border">
                <p className="text-muted text-xs mb-1">Reason</p>
                <p className="text-sm">{reviewing.reason}</p>
              </div>
            </div>

            {/* Note */}
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

            <div className="flex gap-2.5">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setReviewing(null)}>Cancel</Button>
              <Button
                size="md"
                className={`flex-1 ${reviewStatus === "approved" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                loading={submitting}
                onClick={handleReview}
              >
                {reviewStatus === "approved" ? "Approve Leave" : "Reject Leave"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
