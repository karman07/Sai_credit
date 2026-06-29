"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, X, Users, Edit2 } from "lucide-react";
import { api, ApiError, PageMeta } from "../../../lib/api";
import { Button, Input, Badge, Modal, Label, CaseStatusBadge, EmptyState, TableSkeleton, SearchInput, useToast, type CaseStatus } from "../../../components/ui";

const STATUS_TABS = ["All", "Repeat", "Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"] as const;

interface Customer {
  _id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  customerType: string;
  phone: string;
  email?: string;
  tags: string[];
  assignedTo?: { firstName: string; lastName: string } | null;
  latestCaseStatus?: string;
  latestCaseCode?: string;
  totalCases: number;
  createdAt: string;
}

export default function CustomersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Customer[]>("/customers", {
        page,
        limit: 25,
        search: debounced || undefined,
      })
      .then((r) => {
        setRows(r.data);
        setMeta(r.meta ?? null);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced, statusFilter]);

  // Client-side filter: "Repeat" means totalCases > 1, others filter by latestCaseStatus
  const visible = statusFilter === "All"
    ? rows
    : statusFilter === "Repeat"
    ? rows.filter((c) => (c.totalCases ?? 0) > 1)
    : rows.filter((c) => c.latestCaseStatus === statusFilter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted mt-0.5">
            {meta ? `${meta.total.toLocaleString("en-IN")} total` : " "}
          </p>
        </div>
        <Button onClick={() => setDrawer(true)}>
          <Plus className="size-4" /> New Customer
        </Button>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search name, phone, email, code…"
        className="max-w-sm"
      />

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-surface-2 text-foreground-secondary hover:bg-surface-3"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[12px] uppercase tracking-wide text-muted">
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Latest Case</Th>
                <Th>Status</Th>
                <Th>Cases</Th>
                <Th>Assigned To</Th>
                <Th>Created</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <TableSkeleton rows={8} cols={8} />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16">
                    <EmptyState icon={Users} title="No customers found" description={search ? "Try a different search term." : "Customers are created automatically when a case is added."} />
                  </td>
                </tr>
              ) : (
                visible.map((c) => (
                  <tr key={c._id} className="border-t border-border hover:bg-surface-2 transition-colors">
                    <Td className="font-mono text-xs">
                      <Link href={`/customers/${c._id}`} className="text-primary hover:underline">
                        {c.customerCode}
                      </Link>
                    </Td>
                    <Td className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>
                          {c.customerType === "corporate" && c.companyName
                            ? c.companyName
                            : `${c.firstName} ${c.lastName}`}
                        </span>
                        {(c.totalCases ?? 0) > 1 && <Badge tone="warning">Repeat</Badge>}
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">{c.phone}</Td>
                    <Td className="font-mono text-xs text-foreground-secondary">
                      {c.latestCaseCode ? (
                        <Link href={`/cases?search=${c.latestCaseCode}`} className="text-primary hover:underline">
                          {c.latestCaseCode}
                        </Link>
                      ) : "—"}
                    </Td>
                    <Td>
                      {c.latestCaseStatus
                        ? <CaseStatusBadge status={c.latestCaseStatus as CaseStatus} />
                        : <span className="text-xs text-muted">No case</span>}
                    </Td>
                    <Td>
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-surface-2 text-xs font-semibold">
                        {c.totalCases ?? 0}
                      </span>
                    </Td>
                    <Td>{c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : "—"}</Td>
                    <Td className="text-muted text-xs">
                      {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Td>
                    <Td>
                      <button onClick={() => setEditTarget(c)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-primary transition-colors">
                        <Edit2 className="size-3.5" />
                      </button>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <span className="text-muted">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-1">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {drawer && (
        <CreateCustomerDrawer
          onClose={() => setDrawer(false)}
          onCreated={() => { setDrawer(false); load(); }}
        />
      )}

      {editTarget && (
        <EditCustomerModal
          customer={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => r._id === updated._id ? { ...r, ...updated } : r));
            setEditTarget(null);
            toast("success", "Customer updated — linked cases also updated");
          }}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

// ── Create drawer ──────────────────────────────────────────────────
function CreateCustomerDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.post("/customers", {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        email: form.email || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-surface border-l border-border shadow-xl flex flex-col">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border">
          <h2 className="font-semibold">New Customer</h2>
          <button onClick={onClose} className="size-8 grid place-items-center rounded-md hover:bg-surface-2">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <Field label="First name" required>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Last name" required>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
          <Field label="Phone" required>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          {error && (
            <div className="rounded-md border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </form>
        <div className="h-16 flex items-center justify-end gap-2 px-5 border-t border-border">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create customer"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-foreground-secondary mb-1.5">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Edit Customer Modal (admin can edit any customer) ──────────────────────────

function EditCustomerModal({ customer, onClose, onSaved }: {
  customer: Customer;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    email: customer.email ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!form.firstName.trim() || !form.phone.trim()) {
      setError("First name and phone are required");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put<Customer>(`/customers/${customer._id}`, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
      });
      onSaved(data);
    } catch (e: any) {
      setError(e.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit — ${customer.firstName} ${customer.lastName}`} size="md">
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
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <p className="text-[11px] text-muted bg-surface-2 rounded-md px-3 py-2">
          Changes to name and phone are automatically propagated to all linked cases.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={save}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  );
}
