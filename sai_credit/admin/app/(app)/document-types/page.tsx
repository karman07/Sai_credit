"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Power } from "lucide-react";
import {
  Button, Badge, Modal, Input, Label, SearchInput,
  SectionHeader, ConfirmDialog, Pagination, EmptyState, Skeleton,
  useToast,
} from "../../../components/ui";
import { mastersApi, type DocumentType } from "../../../lib/api";

export default function DocumentTypesPage() {
  const toast = useToast();
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editDocType, setEditDocType] = useState<DocumentType | null>(null);
  const [toggleTarget, setToggleTarget] = useState<DocumentType | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 10;

  // Form state
  const [form, setForm] = useState({ name: "" });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await mastersApi.list("document-types");
      setDocTypes(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load document types");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ name: "" });
    setAddOpen(true);
  }
  function openEdit(dt: DocumentType) {
    setForm({ name: dt.name });
    setEditDocType(dt);
  }
  function closeModal() { setAddOpen(false); setEditDocType(null); }

  async function save() {
    if (!form.name.trim()) { toast("error", "Document type name is required"); return; }
    setSaving(true);
    try {
      if (editDocType) {
        const { data } = await mastersApi.update("document-types", editDocType._id, form);
        setDocTypes((p) => p.map((dt) => dt._id === data._id ? data : dt));
        toast("success", "Document type updated");
      } else {
        const { data } = await mastersApi.create("document-types", form);
        setDocTypes((p) => [data, ...p]);
        toast("success", "Document type added");
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
      await mastersApi.toggle("document-types", toggleTarget._id);
      setDocTypes((p) => p.map((dt) => dt._id === toggleTarget._id ? { ...dt, isActive: !dt.isActive } : dt));
      toast("success", `Document type ${toggleTarget.isActive ? "deactivated" : "activated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update status");
    } finally {
      setToggleTarget(null);
    }
  }

  const filtered = docTypes.filter((dt) =>
    !search || dt.name.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-5 animate-fadeIn">
      <SectionHeader
        title="Document Types"
        description="Manage case document types"
        action={<Button size="sm" onClick={openAdd}><Plus className="size-3.5" /> Add Document Type</Button>}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Total Document Types</span>
          <Badge tone="neutral">{docTypes.length}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Active</span>
          <Badge tone="success">{docTypes.filter((dt) => dt.isActive).length}</Badge>
        </div>
        <div className="card p-3 flex items-center justify-between">
          <span className="text-xs text-muted">Inactive</span>
          <Badge tone="neutral">{docTypes.filter((dt) => !dt.isActive).length}</Badge>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <SearchInput value={search} onChange={setSearch} placeholder="Search document type..." className="w-64" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Status</th><th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 3 }).map((_, j) => <td key={j}><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))
              ) : paged.length === 0 ? (
                <tr><td colSpan={3}><EmptyState title="No document types found" description="Add your first document type above." /></td></tr>
              ) : paged.map((dt) => (
                <tr key={dt._id}>
                  <td className="font-semibold text-sm">{dt.name}</td>
                  <td><Badge tone={dt.isActive ? "success" : "neutral"} dot>{dt.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(dt)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Edit2 className="size-3.5" /></button>
                      <button onClick={() => setToggleTarget(dt)} className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted hover:text-foreground transition-colors"><Power className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / limit))} total={filtered.length} limit={limit} onPage={setPage} onLimit={() => {}} />
      </div>

      <Modal open={addOpen || !!editDocType} onClose={closeModal} title={editDocType ? "Edit Document Type" : "Add Document Type"} size="md">
        <div className="space-y-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ name: e.target.value })} placeholder="e.g. Aadhaar Card" /></div>
          <div className="flex gap-2 justify-end border-t border-border pt-3">
            <Button variant="secondary" size="sm" onClick={closeModal}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={save}>{editDocType ? "Save Changes" : "Add Document Type"}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={toggleStatus}
        title={`${toggleTarget?.isActive ? "Deactivate" : "Activate"} ${toggleTarget?.name}?`}
        description={toggleTarget?.isActive ? "This document type will not be available for selection." : "This document type will become available for selection."}
        confirmLabel={toggleTarget?.isActive ? "Deactivate" : "Activate"}
        variant={toggleTarget?.isActive ? "danger" : "primary"}
      />
    </div>
  );
}
