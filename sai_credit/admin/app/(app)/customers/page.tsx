"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { api, ApiError, PageMeta } from "../../../lib/api";
import { Button, Input, Badge } from "../../../components/ui";

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
  createdAt: string;
}

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Customer[]>("/customers", { page, limit: 25, search: debounced })
      .then((r) => {
        setRows(r.data);
        setMeta(r.meta ?? null);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, debounced]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted mt-0.5">
            {meta ? `${meta.total.toLocaleString("en-IN")} total` : " "}
          </p>
        </div>
        <Button onClick={() => setDrawer(true)}>
          <Plus className="size-4" /> New Customer
        </Button>
      </div>

      {/* Toolbar */}
      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, email, code…"
          className="pl-9"
        />
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
                <Th>Email</Th>
                <Th>Assigned To</Th>
                <Th>Tags</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow text="Loading…" />
              ) : rows.length === 0 ? (
                <EmptyRow text="No customers found." />
              ) : (
                rows.map((c) => (
                  <tr key={c._id} className="border-t border-border hover:bg-surface-2 transition-colors">
                    <Td className="font-mono text-xs">
                      <Link href={`/customers/${c._id}`} className="text-primary hover:underline">
                        {c.customerCode}
                      </Link>
                    </Td>
                    <Td className="font-medium">
                      {c.customerType === "corporate" && c.companyName
                        ? c.companyName
                        : `${c.firstName} ${c.lastName}`}
                    </Td>
                    <Td className="font-mono text-xs">{c.phone}</Td>
                    <Td className="text-foreground-secondary">{c.email ?? "—"}</Td>
                    <Td>
                      {c.assignedTo ? `${c.assignedTo.firstName} ${c.assignedTo.lastName}` : "—"}
                    </Td>
                    <Td>
                      <div className="flex gap-1 flex-wrap">
                        {c.tags?.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}
                      </div>
                    </Td>
                    <Td className="text-muted text-xs">
                      {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
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
            <span className="text-muted">
              Page {meta.page} of {meta.totalPages}
            </span>
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

      {drawer && <CreateCustomerDrawer onClose={() => setDrawer(false)} onCreated={() => { setDrawer(false); load(); }} />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function EmptyRow({ text }: { text: string }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted">{text}</td>
    </tr>
  );
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
