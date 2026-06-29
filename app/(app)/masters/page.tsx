"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck, Car, MapPin, Users, FileText,
  Plus, Edit2, Power, RefreshCw, Search, Map,
  X, Hash, ListOrdered,
} from "lucide-react";
import {
  Button, Badge, Input, Label, Select, Modal, EmptyState, Skeleton,
  SearchInput, useToast, type BadgeTone,
} from "../../../components/ui";
import { mastersApi, type MasterItem } from "../../../lib/api";

// ── Master catalog config ──────────────────────────────────────────────────────

interface MasterConfig {
  slug: string;
  label: string;
  description: string;
  group: string;
  icon: React.ElementType;
  iconBg: string;
  iconText: string;
  hasCode?: boolean;
  hasShortName?: boolean;
  hasCategory?: boolean;
  hasColorClass?: boolean;
  hasTerminal?: boolean;
  parentSlug?: string;
  parentLabel?: string;
  hasEnumValues?: boolean;
}

const CATALOG: MasterConfig[] = [
  // Insurance & Finance
  { slug: "insurance-companies", label: "Insurance Companies", description: "Insurers shown in policy and MIS entry forms", group: "insurance", icon: ShieldCheck, iconBg: "bg-blue-500/10", iconText: "text-blue-600", hasCode: true, hasShortName: true },
  // Vehicles
  { slug: "vehicle-types",       label: "Vehicle Types",       description: "Car, Two Wheeler, Truck, Commercial etc.",    group: "vehicle",   icon: Car,         iconBg: "bg-green-500/10", iconText: "text-green-600", hasCode: true, hasCategory: true },
  // Geography
  { slug: "states",              label: "States",              description: "Indian states and union territories",          group: "geography", icon: Map,         iconBg: "bg-orange-500/10", iconText: "text-orange-600", hasCode: true },
  { slug: "cities",              label: "Cities",              description: "Cities linked to states",                     group: "geography", icon: MapPin,      iconBg: "bg-orange-500/10", iconText: "text-orange-600", hasCode: true, parentSlug: "states",      parentLabel: "State" },
  // Documents
  { slug: "document-types",      label: "Document Types",      description: "Supporting document types for cases",         group: "docs",      icon: FileText,    iconBg: "bg-neutral-500/10",  iconText: "text-neutral-600" },
  // Form Options
  { slug: "enum-sets",           label: "Enum Sets",           description: "Named option lists you can reuse in Form Builder select fields", group: "form-options", icon: ListOrdered, iconBg: "bg-violet-500/10", iconText: "text-violet-600", hasEnumValues: true },
];

const GROUPS = [
  { id: "insurance",     label: "Insurance & Finance", icon: ShieldCheck, color: "text-blue-600"   },
  { id: "vehicle",      label: "Vehicles",            icon: Car,         color: "text-green-600"  },
  { id: "geography",    label: "Geography",           icon: Map,         color: "text-orange-600" },
  { id: "docs",         label: "Documents",           icon: FileText,    color: "text-neutral-500"},
  { id: "form-options", label: "Form Options",        icon: ListOrdered, color: "text-violet-600" },
];

const COLOR_OPTIONS = [
  { value: "green",  label: "Green",  bg: "bg-green-500" },
  { value: "yellow", label: "Yellow", bg: "bg-yellow-400" },
  { value: "orange", label: "Orange", bg: "bg-orange-500" },
  { value: "red",    label: "Red",    bg: "bg-red-500" },
  { value: "blue",   label: "Blue",   bg: "bg-blue-500" },
  { value: "purple", label: "Purple", bg: "bg-purple-500" },
  { value: "gray",   label: "Gray",   bg: "bg-neutral-400" },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MastersPage() {
  return (
    <Suspense>
      <MastersContent />
    </Suspense>
  );
}

function MastersContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedSlug = searchParams.get("type") ?? "insurance-companies";
  const [items, setItems] = useState<MasterItem[]>([]);
  const [parents, setParents] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<MasterItem | null>(null);

  // Reset search/inactive when type changes via URL
  useEffect(() => { setSearch(""); setShowInactive(false); }, [selectedSlug]);

  const config = CATALOG.find((c) => c.slug === selectedSlug);

  // Redirect stale/unknown slugs (e.g. old bookmarks to removed catalog entries)
  useEffect(() => {
    if (!config) router.replace(`/masters?type=${CATALOG[0].slug}`);
  }, [config, router]);

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setItems([]);
    try {
      const { data } = await mastersApi.list(selectedSlug, true);
      setItems(data);
      if (config.parentSlug) {
        const { data: p } = await mastersApi.list(config.parentSlug);
        setParents(p);
      } else {
        setParents([]);
      }
    } catch (e: any) {
      toast("error", e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [selectedSlug, config, toast]);

  useEffect(() => { load(); }, [load]);

  if (!config) return null;

  function selectCatalog(slug: string) {
    router.replace(`/masters?type=${slug}`);
  }

  const parentMap: Record<string, string> = {};
  parents.forEach((p) => { parentMap[String(p._id)] = p.name; });

  const filtered = items.filter((item) => {
    if (!showInactive && !item.isActive) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.code ?? "").toLowerCase().includes(q) ||
      (item.shortName ?? "").toLowerCase().includes(q) ||
      (item.category ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = items.filter((i) => i.isActive).length;
  const totalCount = items.length;

  async function handleToggle(item: MasterItem) {
    try {
      const { data } = await mastersApi.toggle(selectedSlug, item._id);
      setItems((prev) => prev.map((x) => x._id === item._id ? { ...x, isActive: data.isActive } : x));
      toast("success", `${item.name} ${data.isActive ? "activated" : "deactivated"}`);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update");
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden animate-fadeIn">
      {/* ── Left catalog panel ──────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 border-r border-border bg-surface overflow-y-auto flex flex-col">
        <div className="px-3 pt-4 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-1 mb-2">Data Catalog</p>
        </div>
        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {GROUPS.map((group) => {
            const groupItems = CATALOG.filter((c) => c.group === group.id);
            return (
              <div key={group.id} className="mb-2">
                <div className={`flex items-center gap-1.5 px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-widest ${group.color}`}>
                  <group.icon className="size-3" />
                  {group.label}
                </div>
                {groupItems.map((cat) => {
                  const catItems = items; // only load for selected; show active count from loaded
                  const isActive = cat.slug === selectedSlug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => selectCatalog(cat.slug)}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground-secondary hover:bg-surface-2 hover:text-foreground"
                      }`}
                    >
                      <div className={`size-6 rounded-md grid place-items-center shrink-0 ${isActive ? "bg-white/20" : cat.iconBg}`}>
                        <cat.icon className={`size-3.5 ${isActive ? "text-white" : cat.iconText}`} />
                      </div>
                      <span className="text-[13px] font-medium text-left truncate flex-1">{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ── Right content panel ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-background">
        {/* Page header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${config.iconBg}`}>
              <config.icon className={`size-5 ${config.iconText}`} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base leading-tight">{config.label}</h1>
              <p className="text-xs text-muted mt-0.5">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span className="font-semibold text-foreground">{activeCount}</span> active
              <span className="text-border">·</span>
              <span className="font-semibold text-foreground">{totalCount}</span> total
            </div>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="size-3.5" />
            </Button>
            <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
              <Plus className="size-3.5" /> Add {config.label.replace(/s$/, "").replace(/ Lookup$/, "")}
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
              placeholder={`Search ${config.label.toLowerCase()}…`}
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
        <div className="px-6 py-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 h-12 rounded-lg border border-border px-4 animate-pulse bg-surface-2/50" style={{ animationDelay: `${i * 50}ms` }}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card mt-4">
              <EmptyState
                icon={config.icon}
                title={search ? "No matches found" : `No ${config.label.toLowerCase()} yet`}
                description={search ? "Try a different search term." : `Add your first ${config.label.toLowerCase().replace(/s$/, "")} using the button above.`}
                action={!search ? (
                  <Button size="sm" onClick={() => { setEditItem(null); setFormOpen(true); }}>
                    <Plus className="size-3.5" /> Add Entry
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
                    {config.parentSlug && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{config.parentLabel}</th>}
                    {config.hasCode && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-24">Code</th>}
                    {config.hasShortName && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-32">Short Name</th>}
                    {config.hasCategory && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-28">Category</th>}
                    {config.hasColorClass && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-24">Color</th>}
                    {config.hasTerminal && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-20">Terminal</th>}
                    {config.hasEnumValues && <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Options</th>}
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted w-24">Status</th>
                    <th className="px-4 py-2.5 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((item) => (
                    <ItemRow
                      key={item._id}
                      item={item}
                      config={config}
                      parentMap={parentMap}
                      onEdit={() => { setEditItem(item); setFormOpen(true); }}
                      onToggle={() => handleToggle(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {formOpen && (
        <ItemFormModal
          item={editItem}
          config={config}
          parents={parents}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          onSaved={(saved) => {
            if (editItem) {
              setItems((prev) => prev.map((x) => x._id === saved._id ? saved : x));
            } else {
              setItems((prev) => [...prev, saved]);
            }
            setFormOpen(false);
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}

// ── Item Row ───────────────────────────────────────────────────────────────────

function ItemRow({
  item, config, parentMap, onEdit, onToggle,
}: {
  item: MasterItem;
  config: MasterConfig;
  parentMap: Record<string, string>;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <tr className={`group transition-colors hover:bg-surface-2/50 ${!item.isActive ? "opacity-50" : ""}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`size-7 rounded-md grid place-items-center shrink-0 ${config.iconBg}`}>
            <config.icon className={`size-3.5 ${config.iconText}`} />
          </div>
          <span className="font-medium text-sm">{item.name}</span>
        </div>
      </td>

      {config.parentSlug && (
        <td className="px-4 py-3 text-xs text-foreground-secondary">
          {item.parentId ? (parentMap[String(item.parentId)] ?? <span className="text-muted italic">Unknown</span>) : <span className="text-muted">—</span>}
        </td>
      )}

      {config.hasCode && (
        <td className="px-4 py-3">
          {item.code ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-surface-2 rounded-md px-2 py-0.5">
              <Hash className="size-2.5 text-muted" />{item.code}
            </span>
          ) : <span className="text-muted text-xs">—</span>}
        </td>
      )}

      {config.hasShortName && (
        <td className="px-4 py-3 text-xs text-foreground-secondary">
          {item.shortName ?? <span className="text-muted">—</span>}
        </td>
      )}

      {config.hasCategory && (
        <td className="px-4 py-3">
          {item.category ? (
            <Badge tone="neutral">{item.category}</Badge>
          ) : <span className="text-muted text-xs">—</span>}
        </td>
      )}

      {config.hasColorClass && (
        <td className="px-4 py-3">
          {item.colorClass ? (
            <div className="flex items-center gap-1.5">
              <span className={`size-3 rounded-full inline-block bg-${item.colorClass}-500`} style={{ background: colorFromClass(item.colorClass) }} />
              <span className="text-xs capitalize text-foreground-secondary">{item.colorClass}</span>
            </div>
          ) : <span className="text-muted text-xs">—</span>}
        </td>
      )}

      {config.hasTerminal && (
        <td className="px-4 py-3">
          {item.isTerminal ? (
            <Badge tone="danger" dot>Terminal</Badge>
          ) : <span className="text-muted text-xs">—</span>}
        </td>
      )}

      {config.hasEnumValues && (
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {((item.metadata?.values as string[]) ?? []).map((v) => (
              <span key={v} className="inline-block px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[11px] text-foreground-secondary font-mono">
                {v}
              </span>
            ))}
            {!((item.metadata?.values as string[])?.length) && <span className="text-muted text-xs">—</span>}
          </div>
        </td>
      )}

      <td className="px-4 py-3">
        <Badge tone={item.isActive ? "success" : "neutral"} dot>
          {item.isActive ? "Active" : "Inactive"}
        </Badge>
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="size-7 grid place-items-center rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors"
            title="Edit"
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            onClick={onToggle}
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
  );
}

// ── Item Form Modal ────────────────────────────────────────────────────────────

function ItemFormModal({
  item, config, parents, onClose, onSaved,
}: {
  item: MasterItem | null;
  config: MasterConfig;
  parents: MasterItem[];
  onClose: () => void;
  onSaved: (saved: MasterItem) => void;
}) {
  const toast = useToast();
  const isEdit = !!item;
  const [form, setForm] = useState({
    name: item?.name ?? "",
    code: item?.code ?? "",
    shortName: item?.shortName ?? "",
    parentId: item?.parentId ?? "",
    category: item?.category ?? "",
    colorClass: item?.colorClass ?? "",
    isTerminal: item?.isTerminal ?? false,
    sortOrder: item?.sortOrder?.toString() ?? "0",
    enumValues: ((item?.metadata?.values as string[]) ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (config.hasCode && form.code) body.code = form.code.trim();
      if (config.hasShortName && form.shortName) body.shortName = form.shortName.trim();
      if (config.parentSlug && form.parentId) body.parentId = form.parentId;
      if (config.hasCategory && form.category) body.category = form.category.trim();
      if (config.hasColorClass && form.colorClass) body.colorClass = form.colorClass;
      if (config.hasTerminal) body.isTerminal = form.isTerminal;
      if (config.hasEnumValues) {
        const values = form.enumValues.split(",").map(s => s.trim()).filter(Boolean);
        body.metadata = { values };
      }

      let res: { data: MasterItem };
      if (isEdit) {
        res = await mastersApi.update(config.slug, item!._id, body);
        toast("success", `${config.label.replace(/s$/, "")} updated`);
      } else {
        res = await mastersApi.create(config.slug, body);
        toast("success", `${config.label.replace(/s$/, "")} added`);
      }
      onSaved(res.data);
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const needsTwoCol = config.hasCode || config.hasShortName || config.parentSlug || config.hasCategory || config.hasColorClass || false;

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Edit ${config.label.replace(/s$/, "")}` : `New ${config.label.replace(/s$/, "")}`}
      description={config.description}
      size="md"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className={`grid gap-4 ${needsTwoCol ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* Name — always full width */}
          <div className={needsTwoCol ? "col-span-2" : ""}>
            <Label>Name <span className="text-danger">*</span></Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Enter name…"
              autoFocus
              required
            />
          </div>

          {/* Parent dropdown */}
          {config.parentSlug && (
            <div className="col-span-2">
              <Label>{config.parentLabel}</Label>
              <Select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
                <option value="">Select {config.parentLabel}…</option>
                {parents.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </Select>
            </div>
          )}

          {/* Code */}
          {config.hasCode && (
            <div>
              <Label>Code</Label>
              <div className="flex rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                <span className="flex items-center px-2.5 bg-surface-2 border-r border-border text-muted shrink-0">
                  <Hash className="size-3.5" />
                </span>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MH"
                  className="flex-1 px-3 py-2 bg-surface text-sm font-mono placeholder:text-muted/50 outline-none"
                />
              </div>
            </div>
          )}

          {/* Short Name */}
          {config.hasShortName && (
            <div>
              <Label>Short Name</Label>
              <Input
                value={form.shortName}
                onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
                placeholder="Abbreviation…"
              />
            </div>
          )}

          {/* Category (vehicle-types) */}
          {config.hasCategory && (
            <div>
              <Label>Category</Label>
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="">Select category…</option>
                <option value="2W">Two Wheeler (2W)</option>
                <option value="4W">Four Wheeler (4W)</option>
                <option value="CV">Commercial Vehicle (CV)</option>
                <option value="Other">Other</option>
              </Select>
            </div>
          )}

          {/* Color class (renewal-statuses) */}
          {config.hasColorClass && (
            <div className={config.hasTerminal ? "" : "col-span-2"}>
              <Label>Status Color</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, colorClass: c.value }))}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all ${
                      form.colorClass === c.value
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                        : "border-border hover:border-primary/40 text-foreground-secondary"
                    }`}
                  >
                    <span className={`size-3 rounded-full ${c.bg}`} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Is Terminal (renewal-statuses) */}
          {config.hasTerminal && (
            <div className="flex items-start gap-3 rounded-xl border border-border p-3 bg-surface-2/50 col-span-2">
              <input
                type="checkbox"
                id="isTerminal"
                checked={form.isTerminal}
                onChange={(e) => setForm((f) => ({ ...f, isTerminal: e.target.checked }))}
                className="mt-0.5 rounded size-4"
              />
              <div>
                <label htmlFor="isTerminal" className="text-sm font-medium cursor-pointer">Terminal Status</label>
                <p className="text-xs text-muted mt-0.5">No further transitions are possible after reaching this status</p>
              </div>
            </div>
          )}

          {/* Enum Values */}
          {config.hasEnumValues && (
            <div className={needsTwoCol ? "col-span-2" : ""}>
              <Label>Options (comma-separated) <span className="text-danger">*</span></Label>
              <textarea
                value={form.enumValues}
                onChange={(e) => setForm((f) => ({ ...f, enumValues: e.target.value }))}
                placeholder="e.g. Pending, Received, Not Required"
                rows={3}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted/50 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
              />
              <p className="text-[11px] text-muted mt-0.5">
                These values will be available as dropdown options in Form Builder.
              </p>
            </div>
          )}

          {/* Sort order */}
          <div className={needsTwoCol ? "" : ""}>
            <Label>Sort Order</Label>
            <Input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              placeholder="0"
              min="0"
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function colorFromClass(cls?: string): string {
  const map: Record<string, string> = {
    green: "#22c55e", yellow: "#facc15", orange: "#f97316",
    red: "#ef4444", blue: "#3b82f6", purple: "#a855f7", gray: "#9ca3af",
  };
  return map[cls ?? ""] ?? "#9ca3af";
}
