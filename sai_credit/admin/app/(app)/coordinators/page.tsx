"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Phone, FileText } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, Select, ProgressBar,
  SectionHeader, SearchInput, ConfirmDialog, useToast, Skeleton, EmptyState,
  type BadgeTone,
} from "../../../components/ui";
import { coordinatorsApi, type Coordinator } from "../../../lib/api";

const INITIALS = (name: string) => name.split(" ").map((w) => w[0]).join("").toUpperCase();
const AVATAR_COLORS = ["#6683FF", "#4ADE80", "#FBBF24", "#F87171", "#A78BFA", "#2DD4BF"];

export default function CoordinatorsPage() {
  const toast = useToast();
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editCoord, setEditCoord] = useState<Coordinator | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Coordinator | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", region: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await coordinatorsApi.list(true);
      setCoordinators(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load coordinators");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ name: "", phone: "", email: "", region: "" });
    setAddOpen(true);
  }
  function openEdit(c: Coordinator) {
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", region: c.region ?? "" });
    setEditCoord(c);
  }
  function closeModal() { setAddOpen(false); setEditCoord(null); }

  async function save() {
    if (!form.name.trim()) { toast("error", "Name is required"); return; }
    setSaving(true);
    try {
      if (editCoord) {
        const { data } = await coordinatorsApi.update(editCoord._id, form);
        setCoordinators((p) => p.map((c) => c._id === data._id ? data : c));
        toast("success", "Coordinator updated");
      } else {
        const { data } = await coordinatorsApi.create(form);
        setCoordinators((p) => [data, ...p]);
        toast("success", "Coordinator added");
      }
      closeModal();
    } catch (e: any) {
      toast("error", e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!deactivateTarget) return;
    try {
      await coordinatorsApi.toggle(deactivateTarget._id);
      setCoordinators((p) => p.map((c) => c._id === deactivateTarget._id ? { ...c, isActive: !c.isActive } : c));
      toast("success", `${deactivateTarget.name} ${deactivateTarget.isActive ? "deactivated" : "activated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed");
    } finally {
      setDeactivateTarget(null);
    }
  }

  const filtered = coordinators.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.region ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Coordinator Management"
        description="Manage your loan coordinators and track their performance"
        action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Coordinator</Button>}
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or region…" className="max-w-xs" />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: coordinators.length, tone: "neutral" as BadgeTone },
          { label: "Active", value: coordinators.filter((c) => c.isActive).length, tone: "success" as BadgeTone },
          { label: "Inactive", value: coordinators.filter((c) => !c.isActive).length, tone: "neutral" as BadgeTone },
        ].map((s) => (
          <div key={s.label} className="card p-3 flex items-center justify-between">
            <span className="text-xs text-muted">{s.label}</span>
            <Badge tone={s.tone}>{s.value}</Badge>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No coordinators found" description="Add your first coordinator above." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c, idx) => (
            <div key={c._id} className="card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow animate-fadeIn" style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full grid place-items-center text-sm font-bold text-white shrink-0" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
                    {INITIALS(c.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-muted">{c.region ?? "—"}</p>
                  </div>
                </div>
                <Badge tone={c.isActive ? "success" : "neutral"} dot>{c.isActive ? "Active" : "Inactive"}</Badge>
              </div>

              {c.phone && (
                <div className="flex items-center gap-2 text-xs text-muted border-t border-border pt-2">
                  <Phone className="size-3" />
                  <span>{c.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="xs" onClick={() => openEdit(c)}>Edit</Button>
                <Button variant="ghost" size="xs" className={`ml-auto ${c.isActive ? "text-danger hover:bg-danger-subtle" : "text-success hover:bg-success-subtle"}`} onClick={() => setDeactivateTarget(c)}>
                  {c.isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen || !!editCoord} onClose={closeModal} title={editCoord ? "Edit Coordinator" : "Add Coordinator"} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Full name" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@saicredit.in" /></div>
            <div className="col-span-2">
              <Label>Region</Label>
              <Select value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}>
                <option value="">Select region…</option>
                {["Delhi", "Mumbai", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur"].map((r) => <option key={r}>{r}</option>)}
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>{editCoord ? "Save Changes" : "Add Coordinator"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={deactivate}
        title={`${deactivateTarget?.isActive ? "Deactivate" : "Activate"} ${deactivateTarget?.name}?`}
        description={deactivateTarget?.isActive ? "They will no longer receive new case assignments." : "They will be available for case assignments again."}
        confirmLabel={deactivateTarget?.isActive ? "Deactivate" : "Activate"}
        variant={deactivateTarget?.isActive ? "danger" : "primary"}
      />
    </div>
  );
}
