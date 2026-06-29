"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Power, MapPin, Phone } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, SearchInput,
  SectionHeader, ConfirmDialog, Pagination, EmptyState, Skeleton, useToast,
} from "../../../components/ui";
import { dealersApi, type Dealer } from "../../../lib/api";

export default function DealersPage() {
  const toast = useToast();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editDealer, setEditDealer] = useState<Dealer | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Dealer | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [form, setForm] = useState({ name: "", contact: "", location: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await dealersApi.list(true);
      setDealers(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load dealers");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setForm({ name: "", contact: "", location: "" }); setAddOpen(true); }
  function openEdit(d: Dealer) { setForm({ name: d.name, contact: d.contact ?? "", location: d.location ?? "" }); setEditDealer(d); }
  function closeModal() { setAddOpen(false); setEditDealer(null); }

  async function save() {
    if (!form.name.trim()) { toast("error", "Dealer name is required"); return; }
    setSaving(true);
    try {
      if (editDealer) {
        const { data } = await dealersApi.update(editDealer._id, form);
        setDealers((p) => p.map((d) => d._id === data._id ? data : d));
        toast("success", "Dealer updated");
      } else {
        const { data } = await dealersApi.create(form);
        setDealers((p) => [data, ...p]);
        toast("success", "Dealer added");
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
      await dealersApi.toggle(toggleTarget._id);
      setDealers((p) => p.map((d) => d._id === toggleTarget._id ? { ...d, isActive: !d.isActive } : d));
      toast("success", `Dealer ${toggleTarget.isActive ? "deactivated" : "activated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed");
    } finally {
      setToggleTarget(null);
    }
  }

  const filtered = dealers.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || (d.location ?? "").toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Dealer Management"
        description="Manage dealership partners and track their case volume"
        action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Dealer</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Dealers", value: dealers.length, tone: "neutral" as const },
          { label: "Active", value: dealers.filter((d) => d.isActive).length, tone: "success" as const },
          { label: "Inactive", value: dealers.filter((d) => !d.isActive).length, tone: "neutral" as const },
        ].map((s) => (
          <div key={s.label} className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">{s.label}</span>
            <Badge tone={s.tone}>{s.value}</Badge>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search dealer or location…" className="w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dealer Name</th><th>Contact</th><th>Location</th>
                <th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 5 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={5}><EmptyState title="No dealers found" description="Add your first dealer partner above." /></td></tr>
              ) : paged.map((d) => (
                <tr key={d._id}>
                  <td className="font-semibold text-sm">{d.name}</td>
                  <td><span className="flex items-center gap-1.5 text-xs font-mono"><Phone className="size-3 text-muted" /> {d.contact ?? "—"}</span></td>
                  <td><span className="flex items-center gap-1 text-xs text-foreground-secondary"><MapPin className="size-3 text-muted" /> {d.location ?? "—"}</span></td>
                  <td><Badge tone={d.isActive ? "success" : "neutral"} dot>{d.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(d)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Edit2 className="size-3.5" /></button>
                      <button onClick={() => setToggleTarget(d)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Power className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / limit))} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen || !!editDealer} onClose={closeModal} title={editDealer ? "Edit Dealer" : "Add Dealer"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Dealer Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Dealer business name" /></div>
            <div><Label>Contact</Label><Input value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} placeholder="+91 XXXXX XXXXX" /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="City" /></div>
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>{editDealer ? "Save Changes" : "Add Dealer"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={toggleStatus}
        title={`${toggleTarget?.isActive ? "Deactivate" : "Activate"} ${toggleTarget?.name}?`}
        description="This will affect case assignment for this dealer."
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Activate"}
        variant={toggleTarget?.isActive ? "danger" : "primary"}
      />
    </div>
  );
}
