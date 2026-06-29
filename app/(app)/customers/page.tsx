"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Edit2, Lock } from "lucide-react";
import Link from "next/link";
import {
  Button, Badge, CaseStatusBadge, SearchInput, Modal, Label, Input,
  EmptyState, Skeleton, useToast, type CaseStatus,
} from "../../../components/ui";
import { customersApi, getCurrentUserId, type SalesCustomer, type PageMeta } from "../../../lib/api";

const STATUS_TABS = ["All", "Repeat", "Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"] as const;

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [meta, setMeta] = useState<PageMeta>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<SalesCustomer | null>(null);
  const myId = getCurrentUserId();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data, meta: m } = await customersApi.list({ page, limit: 25, search: search || undefined });
      setCustomers(data);
      if (m) setMeta(m);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, statusTab]);

  const visible = statusTab === "All"
    ? customers
    : statusTab === "Repeat"
    ? customers.filter((c) => (c.totalCases ?? 0) > 1)
    : customers.filter((c) => c.latestCaseStatus === statusTab);

  function isAssignedToMe(c: SalesCustomer) {
    return myId && c.assignedTo?._id === myId;
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted mt-0.5">
          {meta.total > 0 ? `${meta.total.toLocaleString("en-IN")} total` : "Customers are created automatically when you add a case."}
        </p>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, code…" />

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setStatusTab(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusTab === s ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground-secondary hover:text-foreground"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet"
          description={search ? "No customers match your search." : statusTab !== "All" ? `No customers with status "${statusTab}".` : "Add a case and a customer will appear here automatically."} />
      ) : (
        <div className="space-y-2">
          {visible.map((c) => {
            const canEdit = !!isAssignedToMe(c);
            return (
              <div key={c._id} className="card p-4 flex items-center justify-between gap-4">
                {/* Avatar + name */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-full bg-primary/10 text-primary font-semibold text-sm grid place-items-center shrink-0 relative">
                    {c.firstName.charAt(0).toUpperCase()}{c.lastName?.charAt(0).toUpperCase() ?? ""}
                    {(c.totalCases ?? 0) > 1 && (
                      <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-warning border-2 border-surface" title="Repeat customer" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{c.firstName} {c.lastName}</p>
                      {(c.totalCases ?? 0) > 1 && <Badge tone="warning" className="shrink-0">Repeat</Badge>}
                    </div>
                    <p className="text-xs text-muted font-mono">{c.phone}</p>
                    {c.assignedTo && (
                      <p className="text-[11px] text-muted mt-0.5">
                        Assigned to {c.assignedTo.firstName} {c.assignedTo.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-end gap-1.5">
                    {c.latestCaseCode && (
                      <Link href={`/cases?search=${c.latestCaseCode}`} className="font-mono text-xs text-primary hover:underline">
                        {c.latestCaseCode}
                      </Link>
                    )}
                    {c.latestCaseStatus
                      ? <CaseStatusBadge status={c.latestCaseStatus as CaseStatus} />
                      : <span className="text-xs text-muted">No case</span>}
                  </div>

                  <div className="hidden sm:flex flex-col items-center min-w-[36px]">
                    <span className="text-lg font-bold leading-none">{c.totalCases ?? 0}</span>
                    <span className="text-[10px] text-muted">cases</span>
                  </div>

                  {/* Edit button — only if assigned to current user */}
                  {canEdit ? (
                    <button
                      onClick={() => setEditTarget(c)}
                      className="size-8 grid place-items-center rounded-lg hover:bg-surface-2 text-muted hover:text-primary transition-colors"
                      title="Edit customer"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                  ) : (
                    <div className="size-8 grid place-items-center rounded-lg text-border" title="Not assigned to you">
                      <Lock className="size-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-muted">Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {editTarget && (
        <EditCustomerModal
          customer={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setCustomers((prev) => prev.map((c) => c._id === updated._id ? { ...c, ...updated } : c));
            setEditTarget(null);
            toast("success", "Customer updated");
          }}
        />
      )}
    </div>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────────

function EditCustomerModal({ customer, onClose, onSaved }: {
  customer: SalesCustomer;
  onClose: () => void;
  onSaved: (c: SalesCustomer) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone ?? "",
    email: customer.email ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.firstName.trim() || !form.phone.trim()) {
      toast("error", "First name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const { data } = await customersApi.update(customer._id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        alternatePhone: form.alternatePhone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      onSaved(data);
    } catch (e: any) {
      toast("error", e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Customer" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First Name *</Label>
            <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <Label>Alternate Phone</Label>
            <Input value={form.alternatePhone} onChange={(e) => setForm((f) => ({ ...f, alternatePhone: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <p className="text-[11px] text-muted">Changes to name and phone will also update this customer's linked cases.</p>
        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={save}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
