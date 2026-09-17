"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Plus, Edit2, Power, RefreshCw, Search, X, Hash } from "lucide-react";
import {
  Button, Badge, Input, Label, Modal, EmptyState, Skeleton, useToast,
} from "../../../components/ui";
import { mastersApi, type MasterItem } from "../../../lib/api";

const SLUG = "document-types";

export default function DocumentTypesPage() {
  const toast = useToast();
  const [items, setItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MasterItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await mastersApi.list(SLUG, true);
      setItems(data);
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load");
      toast("error", e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((item) => {
    if (!showInactive && !item.isActive) return false;
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  const activeCount = items.filter((i) => i.isActive).length;

  async function handleToggle(item: MasterItem) {
    try {
      const { data } = await mastersApi.toggle(SLUG, item._id);
      setItems((prev) => prev.map((x) => x._id === item._id ? { ...x, isActive: data.isActive } : x));
      toast("success", `${item.name} ${data.isActive ? "activated" : "deactivated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden animate-fadeIn">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-xl grid place-items-center shrink-0 bg-neutral-500/10">
            <FileText className="size-5 text-neutral-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight">Document Types</h1>
            <p className="text-xs text-muted mt-0.5">Supporting document types requested and uploaded on cases</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="font-semibold text-foreground">{activeCount}</span> active
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{items.length}</span> total
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw className="size-3.5" />
          </Button>
          <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
            <Plus className="size-3.5" /> Add Document Type
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-border bg-surface-2/50">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search document types…"
            className="w-full pl-8 pr-3 h-8 rounded-lg border border-border bg-surface text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 size-4 grid place-items-center text-muted hover:text-foreground">
              <X className="size-3" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none ml-auto">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded size-3.5"
          />
          Show inactive
        </label>
        {search && (
          <span className="text-xs text-muted">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 h-12 rounded-lg border border-border px-4 animate-pulse bg-surface-2/50" style={{ animationDelay: `${i * 50}ms` }}>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-6 w-16 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="card mt-4">
            <EmptyState
              icon={X}
              title="Failed to load"
              description={loadError}
              action={
                <Button size="sm" variant="secondary" onClick={load}>
                  <RefreshCw className="size-3.5" /> Retry
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card mt-4">
            <EmptyState
              icon={FileText}
              title={search ? "No matches found" : "No document types yet"}
              description={search ? "Try a different search term." : "Add your first document type using the button above."}
              action={!search ? (
                <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
                  <Plus className="size-3.5" /> Add Document Type
                </Button>
              ) : undefined}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/50">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Name</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-24">Status</th>
                  <th className="px-4 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => (
                  <tr key={item._id} className={`group transition-colors hover:bg-surface-2/50 ${!item.isActive ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-md grid place-items-center shrink-0 bg-neutral-500/10">
                          <FileText className="size-3.5 text-neutral-600" />
                        </div>
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.isActive ? "success" : "neutral"} dot>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditItem(item); setFormOpen(true); }}
                          className="size-7 grid place-items-center rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggle(item)}
                          className={`size-7 grid place-items-center rounded-md transition-colors text-muted ${
                            item.isActive ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-success/10 hover:text-success"
                          }`}
                          title={item.isActive ? "Deactivate" : "Activate"}
                        >
                          <Power className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <DocumentTypeFormModal
          item={editItem}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          onSaved={(saved) => {
            setItems((prev) => editItem
              ? prev.map((x) => x._id === saved._id ? saved : x)
              : [...prev, saved]);
            setFormOpen(false);
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}

function DocumentTypeFormModal({
  item, onClose, onSaved,
}: {
  item: MasterItem | null;
  onClose: () => void;
  onSaved: (saved: MasterItem) => void;
}) {
  const toast = useToast();
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [sortOrder, setSortOrder] = useState(item?.sortOrder?.toString() ?? "0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      const body = { name: name.trim(), sortOrder: Number(sortOrder) || 0 };
      let res: { data: MasterItem };
      if (isEdit) {
        res = await mastersApi.update(SLUG, item!._id, body);
        toast("success", "Document type updated");
      } else {
        res = await mastersApi.create(SLUG, body);
        toast("success", "Document type added");
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit Document Type" : "New Document Type"}
      description="Supporting document types requested and uploaded on cases"
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Name <span className="text-danger">*</span></Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. PAN Card"
            autoFocus
            required
          />
        </div>
        <div>
          <Label>Sort Order</Label>
          <div className="flex rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
            <span className="flex items-center px-2.5 bg-surface-2 border-r border-border text-muted shrink-0">
              <Hash className="size-3.5" />
            </span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              min="0"
              className="flex-1 px-3 py-2 bg-surface text-sm placeholder:text-muted/50 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end border-t border-border pt-3">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="submit" loading={saving}>
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
