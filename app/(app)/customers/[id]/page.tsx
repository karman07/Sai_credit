"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, User, Calendar, Briefcase, Edit2,
  Hash, AlertTriangle,
} from "lucide-react";
import {
  casesApi, customersApi,
  type Customer, type LoanCase, type CaseStatus,
} from "../../../../lib/api";
import {
  Button, Input, Badge, Modal, Label, CaseStatusBadge,
  EmptyState, Skeleton, useToast, Textarea, Select,
} from "../../../../components/ui";
import { CaseDrawer } from "../../../../components/CaseDrawer";

function InfoRow({ icon: Icon, value, muted }: { icon: React.ElementType; value: string; muted?: boolean }) {
  if (!value) return null;
  return (
    <div className={`flex items-center gap-2 text-sm ${muted ? "text-muted" : ""}`}>
      <Icon className="size-4 text-primary/70 shrink-0" />
      <span>{value}</span>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drawerCaseId, setDrawerCaseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "", lastName: "", phone: "",
    alternatePhone: "", email: "", notes: "",
  });

  const loadCases = useCallback(async (phone: string) => {
    setCasesLoading(true);
    try {
      // Strip non-digits and take last 10 so "+918813947793" → "8813947793".
      // Raw phone passed to new RegExp() on the backend would throw on "+" (regex quantifier).
      const normalised = phone.replace(/\D/g, "").slice(-10);
      const { data } = await casesApi.list({ search: normalised, limit: 50 });
      setCases(data as unknown as LoanCase[]);
    } catch {
      setCases([]);
    } finally {
      setCasesLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.get(id);
      setCustomer(data);
      setEditForm({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        alternatePhone: data.alternatePhone ?? "",
        email: data.email ?? "",
        notes: data.notes ?? "",
      });
      loadCases(data.phone);
    } catch {
      toast("error", "Failed to load customer");
    } finally {
      setLoading(false);
    }
  }, [id, loadCases, toast]);

  useEffect(() => { load(); }, [load]);

  async function saveEdit() {
    if (!customer) return;
    setSaving(true);
    try {
      const { data } = await customersApi.update(customer._id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        alternatePhone: editForm.alternatePhone || undefined,
        email: editForm.email || undefined,
        notes: editForm.notes || undefined,
      });
      setCustomer(data);
      setEditing(false);
      toast("success", "Customer updated");
    } catch (e: any) {
      toast("error", e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={User}
        title="Customer not found"
        description="This customer may have been deleted or the link is invalid."
        action={<Button variant="secondary" size="sm" onClick={() => router.push("/customers")}>Back to Customers</Button>}
      />
    );
  }

  const assignedName =
    typeof customer.assignedTo === "object" && customer.assignedTo
      ? `${customer.assignedTo.firstName} ${customer.assignedTo.lastName}`
      : "Unassigned";

  const statusCounts = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const disbursed = statusCounts["Disbursed"] ?? 0;
  const active = cases.filter((c) => !["Disbursed", "Rejected", "Cancelled"].includes(c.status)).length;
  const totalLoanVol = cases.reduce((s, c) => s + (c.loanAmount ?? 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.back()}
          className="size-8 flex items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{customer.firstName} {customer.lastName}</h1>
            <Badge tone="neutral">{customer.customerCode}</Badge>
            <Badge tone={customer.customerType === "Individual" ? "info" : "purple"}>
              {customer.customerType}
            </Badge>
            {customer.latestCaseStatus && (
              <CaseStatusBadge status={customer.latestCaseStatus as CaseStatus} />
            )}
          </div>
          <p className="text-sm text-muted mt-0.5">
            {customer.phone} · {customer.totalCases} case{customer.totalCases !== 1 ? "s" : ""}
            {customer.latestCaseCode && <span className="ml-2 font-mono text-primary">{customer.latestCaseCode}</span>}
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Edit2 className="size-3.5" /> Edit Customer
        </Button>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Cases" value={customer.totalCases} />
        <StatCard label="Active" value={active} color="text-primary" />
        <StatCard label="Disbursed" value={disbursed} color="text-success" />
        <StatCard
          label="Loan Volume"
          value={totalLoanVol > 0 ? `₹${(totalLoanVol / 100000).toFixed(1)}L` : "—"}
          color="text-foreground-secondary"
        />
      </div>

      {/* ── Info cards ──────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-3 gap-4">
        {/* Contact */}
        <div className="card p-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Contact Info</p>
          <div className="space-y-2.5">
            <InfoRow icon={Phone} value={customer.phone} />
            {customer.alternatePhone && <InfoRow icon={Phone} value={customer.alternatePhone} muted />}
            {customer.email && <InfoRow icon={Mail} value={customer.email} muted />}
          </div>
        </div>

        {/* Details */}
        <div className="card p-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Profile</p>
          <div className="space-y-2.5">
            <InfoRow icon={Hash} value={customer.customerCode} />
            <InfoRow icon={User} value={customer.customerType} muted />
            <InfoRow
              icon={Calendar}
              value={new Date(customer.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
              })}
              muted
            />
          </div>
          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {customer.tags.map((t) => <Badge key={t} tone="info">{t}</Badge>)}
            </div>
          )}
        </div>

        {/* Assignment + Notes */}
        <div className="card p-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Assigned To</p>
          <InfoRow icon={Briefcase} value={assignedName} />
          {customer.notes && (
            <div className="mt-2 p-3 bg-surface-2 rounded-lg text-xs text-foreground-secondary leading-relaxed border border-border-subtle">
              {customer.notes}
            </div>
          )}
          {!customer.isActive && (
            <div className="flex items-center gap-2 text-xs text-danger mt-2">
              <AlertTriangle className="size-3.5" /> Inactive account
            </div>
          )}
        </div>
      </div>

      {/* ── Cases table ─────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/40">
          <Briefcase className="size-4 text-muted" />
          <h2 className="font-semibold text-sm">
            Cases {!casesLoading && <span className="text-muted font-normal">({cases.length})</span>}
          </h2>
        </div>

        {casesLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                {[1, 2, 3, 4, 5, 6].map((j) => <Skeleton key={j} className="h-4 flex-1" />)}
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <EmptyState icon={Briefcase} title="No cases found" description="No loan cases are linked to this customer's phone number." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Bank</th>
                  <th>Loan Amount</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c._id} className="cursor-pointer hover:bg-surface-2/60 transition-colors" onClick={() => setDrawerCaseId(c._id)}>
                    <td>
                      <span className="font-mono text-xs text-primary font-semibold">{c.caseCode}</span>
                    </td>
                    <td className="text-xs text-muted whitespace-nowrap">
                      {new Date(c.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="text-sm">{c.product}</td>
                    <td className="text-xs text-muted">{c.bankName ?? "—"}</td>
                    <td className="font-mono text-xs font-semibold">
                      {c.loanAmount ? `₹${c.loanAmount.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td><CaseStatusBadge status={c.status} /></td>
                    <td className="text-xs text-muted">{c.assignedToName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Case Drawer ─────────────────────────────────────────────── */}
      <CaseDrawer
        caseId={drawerCaseId}
        onClose={() => setDrawerCaseId(null)}
        onCaseChange={() => loadCases(customer.phone)}
      />

      {/* ── Edit Modal ──────────────────────────────────────────────── */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Customer" description="Changes to name or phone will cascade to all linked cases." size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input
                value={editForm.firstName}
                onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input
                value={editForm.lastName}
                onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Alternate Phone <span className="normal-case font-normal text-muted/70">(optional)</span></Label>
              <Input
                value={editForm.alternatePhone}
                onChange={(e) => setEditForm((f) => ({ ...f, alternatePhone: e.target.value }))}
                placeholder="Alt number…"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email <span className="normal-case font-normal text-muted/70">(optional)</span></Label>
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="customer@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Internal Notes <span className="normal-case font-normal text-muted/70">(optional)</span></Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any internal notes about this customer…"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={saveEdit}>Save Changes</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
