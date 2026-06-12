"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Power } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, SearchInput,
  SectionHeader, ConfirmDialog, Pagination, EmptyState, Skeleton,
  useToast,
} from "../../../components/ui";
import { banksApi, type Bank } from "../../../lib/api";

const EMPTY: Partial<Bank & { _edit?: boolean }> = {};

export default function BanksPage() {
  const toast = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editBank, setEditBank] = useState<Bank | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Bank | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Form state
  const [form, setForm] = useState({ name: "", branch: "", bmName: "", bmContact: "", executive: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await banksApi.list(true);
      setBanks(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load banks");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ name: "", branch: "", bmName: "", bmContact: "", executive: "" });
    setAddOpen(true);
  }
  function openEdit(b: Bank) {
    setForm({ name: b.name, branch: b.branch ?? "", bmName: b.bmName ?? "", bmContact: b.bmContact ?? "", executive: b.executive ?? "" });
    setEditBank(b);
  }
  function closeModal() { setAddOpen(false); setEditBank(null); }

  async function save() {
    if (!form.name.trim()) { toast("error", "Bank name is required"); return; }
    setSaving(true);
    try {
      if (editBank) {
        const { data } = await banksApi.update(editBank._id, form);
        setBanks((p) => p.map((b) => b._id === data._id ? data : b));
        toast("success", "Bank updated");
      } else {
        const { data } = await banksApi.create(form);
        setBanks((p) => [data, ...p]);
        toast("success", "Bank added");
      }
      closeModal();
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (!toggleTarget) return;
    try {
      await banksApi.toggle(toggleTarget._id);
      setBanks((p) => p.map((b) => b._id === toggleTarget._id ? { ...b, isActive: !b.isActive } : b));
      toast("success", `Bank ${toggleTarget.isActive ? "deactivated" : "activated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update status");
    } finally {
      setToggleTarget(null);
    }
  }

  const filtered = banks.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) || (b.bmName ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * limit, page * limit);
  const maxCases = 0; // will come from cases stats later

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Banks & NBFC Partners"
        description="Manage lending partner relationships"
        action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Partner</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Total Partners</span>
          <Badge tone="neutral">{banks.length}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Active</span>
          <Badge tone="success">{banks.filter((b) => b.isActive).length}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Inactive</span>
          <Badge tone="neutral">{banks.filter((b) => !b.isActive).length}</Badge>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bank or BM name…" className="w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank / NBFC</th><th>Branch</th><th>BM Name</th><th>BM Contact</th>
                <th>Executive</th><th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No banks found" description="Add your first bank partner above." /></td></tr>
              ) : paged.map((b) => (
                <tr key={b._id}>
                  <td className="font-semibold text-sm">{b.name}</td>
                  <td className="text-xs text-foreground-secondary">{b.branch ?? "—"}</td>
                  <td className="text-sm">{b.bmName ?? "—"}</td>
                  <td className="text-xs font-mono">{b.bmContact ?? "—"}</td>
                  <td className="text-xs text-foreground-secondary">{b.executive ?? "—"}</td>
                  <td><Badge tone={b.isActive ? "success" : "neutral"} dot>{b.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(b)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Edit2 className="size-3.5" /></button>
                      <button onClick={() => setToggleTarget(b)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Power className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / limit))} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen || !!editBank} onClose={closeModal} title={editBank ? "Edit Partner" : "Add Bank / NBFC Partner"} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label>Bank / NBFC Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. HDFC Bank" /></div>
          <div><Label>Branch</Label><Input value={form.branch} onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))} placeholder="Branch, City" /></div>
          <div><Label>BM Name</Label><Input value={form.bmName} onChange={(e) => setForm((p) => ({ ...p, bmName: e.target.value }))} placeholder="Business Manager" /></div>
          <div><Label>BM Contact</Label><Input value={form.bmContact} onChange={(e) => setForm((p) => ({ ...p, bmContact: e.target.value }))} placeholder="+91 XXXXX XXXXX" /></div>
          <div><Label>Executive</Label><Input value={form.executive} onChange={(e) => setForm((p) => ({ ...p, executive: e.target.value }))} placeholder="Executive name" /></div>
          <div className="col-span-2 flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>{editBank ? "Save Changes" : "Add Partner"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={toggleStatus}
        title={`${toggleTarget?.isActive ? "Deactivate" : "Activate"} ${toggleTarget?.name}?`}
        description={toggleTarget?.isActive ? "No new cases will be assigned to this bank." : "This bank will be available for case assignments."}
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Activate"}
        variant={toggleTarget?.isActive ? "danger" : "primary"}
      />
    </div>
  );
}
