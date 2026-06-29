"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Save, Trash2, ChevronUp, ChevronDown, Eye, EyeOff,
  Lock, Settings2, GripVertical, RotateCcw, FileText, Clipboard, ShieldCheck, IndianRupee, Users,
} from "lucide-react";
import {
  Button, Input, Label, Select, Modal, useToast, Badge, cn,
} from "../../../components/ui";
import {
  formSchemasApi, mastersApi,
  type FieldDef, type SectionDef, type FormSchema, type FieldType, type MasterItem,
} from "../../../lib/api";

// ── Form catalogue ─────────────────────────────────────────────────────────────

const FORMS = [
  { id: "new-case",        label: "New Case",        icon: FileText,    desc: "Fields in the case creation wizard" },
  { id: "rto",             label: "RTO",             icon: Clipboard,   desc: "Fields in the RTO tracker form" },
  { id: "insurance",       label: "Insurance MIS",   icon: ShieldCheck, desc: "Fields in the insurance entry form" },
  { id: "payout",          label: "Payout",          icon: IndianRupee, desc: "Fields in the payout record form" },
  { id: "insurance-lead",  label: "Insurance Lead",  icon: Users,       desc: "Fields in the insurance lead capture form" },
] as const;

type FormId = typeof FORMS[number]["id"];

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:    "Text",
  number:  "Number",
  select:  "Dropdown",
  tel:     "Phone",
  date:    "Date",
  boolean: "Yes / No",
};

// ── Field Editor Modal ─────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: FieldDef | null;
  enumSets: MasterItem[];
  onSave: (f: FieldDef) => void;
  onClose: () => void;
}

function FieldEditor({ field, enumSets, onSave, onClose }: FieldEditorProps) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState<FieldType>(field?.type ?? "text");
  const [required, setRequired] = useState(field?.required ?? false);
  const [placeholder, setPlaceholder] = useState(field?.placeholder ?? "");
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? "");
  const [optionsMode, setOptionsMode] = useState<"manual" | "enum">(
    field?.options?.length ? "manual" : "manual",
  );
  const [optionsRaw, setOptionsRaw] = useState((field?.options ?? []).join(", "));
  const [selectedEnumId, setSelectedEnumId] = useState("");
  const [keyField, setKeyField] = useState(field?.key ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isCore = field?.isCore ?? false;

  // When enum set picked, populate options preview
  const selectedEnum = enumSets.find(e => e._id === selectedEnumId);
  const resolvedOptions: string[] = optionsMode === "enum" && selectedEnum
    ? ((selectedEnum.metadata?.values as string[]) ?? [])
    : optionsRaw.split(",").map(s => s.trim()).filter(Boolean);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!label.trim()) e.label = "Label is required";
    if (!isCore && !keyField.trim()) e.key = "Key is required";
    if (!isCore && keyField && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(keyField))
      e.key = "Key must start with a letter, containing only letters/numbers/underscores";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    const options = type === "select" ? resolvedOptions : [];
    onSave({
      key: isCore ? field!.key : keyField.trim(),
      label: label.trim(),
      type,
      required,
      placeholder: placeholder.trim() || undefined,
      defaultValue: defaultValue.trim() || undefined,
      options,
      order: field?.order ?? 999,
      isCore,
      isActive: field?.isActive ?? true,
    });
  }

  return (
    <Modal open onClose={onClose} size="md">
      <div className="p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold">
            {isCore ? "Configure Field" : field ? "Edit Custom Field" : "Add Custom Field"}
          </h2>
          {isCore && (
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
              <Lock className="size-3" /> Core field — key and type are locked
            </p>
          )}
        </div>

        {!isCore && (
          <div>
            <Label>Field Key *</Label>
            <Input
              value={keyField}
              onChange={e => setKeyField(e.target.value)}
              placeholder="e.g. coBorrowerName"
              disabled={!!field}
            />
            <p className="text-[11px] text-muted mt-0.5">
              Unique identifier. Cannot be changed after creation.
            </p>
            {errors.key && <p className="text-xs text-danger mt-1">{errors.key}</p>}
          </div>
        )}

        <div>
          <Label>Label *</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Display label shown in the form" />
          {errors.label && <p className="text-xs text-danger mt-1">{errors.label}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Field Type</Label>
            <Select value={type} onChange={e => setType(e.target.value as FieldType)} disabled={isCore}>
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded" />
              <span className="text-sm font-medium">Required field</span>
            </label>
          </div>
        </div>

        {type === "select" && (
          <div className="space-y-2">
            <Label>Dropdown Options</Label>
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setOptionsMode("manual")}
                className={cn(
                  "flex-1 py-1.5 font-medium transition-colors",
                  optionsMode === "manual" ? "bg-primary text-primary-foreground" : "bg-surface text-muted hover:bg-surface-2",
                )}
              >
                Type manually
              </button>
              <button
                type="button"
                onClick={() => setOptionsMode("enum")}
                className={cn(
                  "flex-1 py-1.5 font-medium transition-colors border-l border-border",
                  optionsMode === "enum" ? "bg-primary text-primary-foreground" : "bg-surface text-muted hover:bg-surface-2",
                )}
              >
                Use Enum Set
              </button>
            </div>

            {optionsMode === "manual" ? (
              <>
                <Input
                  value={optionsRaw}
                  onChange={e => setOptionsRaw(e.target.value)}
                  placeholder="Option A, Option B, Option C"
                />
                <p className="text-[11px] text-muted">
                  Leave empty for dynamic options (banks, dealers, cities — handled automatically).
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Select value={selectedEnumId} onChange={e => setSelectedEnumId(e.target.value)}>
                  <option value="">Select an Enum Set…</option>
                  {enumSets.map(e => (
                    <option key={e._id} value={e._id}>{e.name}</option>
                  ))}
                </Select>
                {enumSets.length === 0 && (
                  <p className="text-[11px] text-warning">
                    No enum sets found. Create some in Data Catalog → Enum Sets first.
                  </p>
                )}
                {selectedEnum && (
                  <div className="flex flex-wrap gap-1 p-2 bg-surface-2 rounded-lg border border-border">
                    {((selectedEnum.metadata?.values as string[]) ?? []).map(v => (
                      <span key={v} className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono">{v}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <Label>Placeholder</Label>
          <Input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="Hint text inside the input" />
        </div>

        <div>
          <Label>Default Value</Label>
          <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} placeholder="Pre-filled value" />
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save}>Save Field</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Field Row ──────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: FieldDef;
  fieldIdx: number;
  totalFields: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}

function FieldRow({ field, fieldIdx, totalFields, onToggle, onEdit, onDelete, onMove }: FieldRowProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors",
      field.isActive
        ? "border-border bg-surface hover:bg-surface-2"
        : "border-dashed border-border/60 bg-surface/50 opacity-55",
    )}>
      <GripVertical className="size-4 text-muted/40 shrink-0 cursor-grab" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{field.label}</span>
          {field.required && <span className="text-[10px] text-danger font-bold">*</span>}
          {field.isCore && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted bg-surface-2 border border-border px-1.5 py-0.5 rounded">
              <Lock className="size-2.5" /> core
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted font-mono">{field.key}</span>
          <span className="text-muted/40 text-[10px]">·</span>
          <span className="text-[11px] text-muted">{FIELD_TYPE_LABELS[field.type]}</span>
          {field.options.length > 0 && (
            <>
              <span className="text-muted/40 text-[10px]">·</span>
              <span className="text-[11px] text-muted truncate max-w-[200px]">{field.options.join(", ")}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onMove("up")} disabled={fieldIdx === 0} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-colors" title="Move up">
          <ChevronUp className="size-3.5" />
        </button>
        <button onClick={() => onMove("down")} disabled={fieldIdx === totalFields - 1} className="p-1 rounded hover:bg-surface-2 disabled:opacity-30 transition-colors" title="Move down">
          <ChevronDown className="size-3.5" />
        </button>
        <button onClick={onEdit} className="p-1 rounded hover:bg-surface-2 transition-colors text-muted hover:text-foreground" title="Configure">
          <Settings2 className="size-3.5" />
        </button>
        <button
          onClick={onToggle}
          className={cn("p-1 rounded transition-colors", field.isActive ? "text-muted hover:text-foreground hover:bg-surface-2" : "text-success hover:bg-surface-2")}
          title={field.isActive ? "Hide field" : "Show field"}
        >
          {field.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </button>
        {!field.isCore && (
          <button onClick={onDelete} className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger transition-colors" title="Delete">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function FormBuilderPage() {
  const toast = useToast();
  const [activeFormId, setActiveFormId] = useState<FormId>("new-case");
  const [schemas, setSchemas] = useState<Record<FormId, FormSchema | null>>({
    "new-case": null, rto: null, insurance: null, payout: null, "insurance-lead": null,
  });
  const [dirty, setDirty] = useState<Record<FormId, boolean>>({
    "new-case": false, rto: false, insurance: false, payout: false, "insurance-lead": false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [editingField, setEditingField] = useState<{ sectionIdx: number; field: FieldDef | null } | null>(null);
  const [enumSets, setEnumSets] = useState<MasterItem[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [schemasRes, enumRes] = await Promise.all([
        formSchemasApi.list(),
        mastersApi.list("enum-sets"),
      ]);
      const map: Record<string, FormSchema> = {};
      for (const s of schemasRes.data) map[s.formId] = s;
      setSchemas({
        "new-case":       map["new-case"]       ?? null,
        rto:              map.rto               ?? null,
        insurance:        map.insurance         ?? null,
        payout:           map.payout            ?? null,
        "insurance-lead": map["insurance-lead"] ?? null,
      });
      setEnumSets(enumRes.data.filter(e => e.isActive));
    } catch {
      toast("error", "Failed to load form schemas");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reset section idx when switching forms
  useEffect(() => { setActiveSectionIdx(0); }, [activeFormId]);

  const activeSchema = schemas[activeFormId];

  function mutateSection(sectionIdx: number, updater: (fields: FieldDef[]) => FieldDef[]) {
    setSchemas(prev => {
      const s = prev[activeFormId];
      if (!s) return prev;
      return {
        ...prev,
        [activeFormId]: {
          ...s,
          sections: s.sections.map((sec, i) =>
            i === sectionIdx ? { ...sec, fields: updater([...sec.fields]) } : sec,
          ),
        },
      };
    });
    setDirty(prev => ({ ...prev, [activeFormId]: true }));
  }

  function handleToggle(sectionIdx: number, fieldIdx: number) {
    mutateSection(sectionIdx, fields => {
      fields[fieldIdx] = { ...fields[fieldIdx], isActive: !fields[fieldIdx].isActive };
      return fields;
    });
  }

  function handleMove(sectionIdx: number, fieldIdx: number, dir: "up" | "down") {
    mutateSection(sectionIdx, fields => {
      const target = dir === "up" ? fieldIdx - 1 : fieldIdx + 1;
      if (target < 0 || target >= fields.length) return fields;
      [fields[fieldIdx], fields[target]] = [fields[target], fields[fieldIdx]];
      return fields.map((f, i) => ({ ...f, order: i + 1 }));
    });
  }

  function handleDelete(sectionIdx: number, fieldIdx: number) {
    mutateSection(sectionIdx, fields => fields.filter((_, i) => i !== fieldIdx));
  }

  function handleSaveField(sectionIdx: number, updatedField: FieldDef) {
    mutateSection(sectionIdx, fields => {
      const idx = fields.findIndex(f => f.key === updatedField.key);
      if (idx >= 0) {
        fields[idx] = updatedField;
      } else {
        updatedField.order = fields.length + 1;
        fields.push(updatedField);
      }
      return fields;
    });
    setEditingField(null);
  }

  async function save() {
    if (!activeSchema) return;
    setSaving(true);
    try {
      await formSchemasApi.update(activeFormId, { sections: activeSchema.sections });
      setDirty(prev => ({ ...prev, [activeFormId]: false }));
      toast("success", "Form schema saved");
    } catch {
      toast("error", "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function discard() {
    setDirty(prev => ({ ...prev, [activeFormId]: false }));
    await loadAll();
  }

  const activeSection = activeSchema?.sections[activeSectionIdx];
  const isDirty = dirty[activeFormId];
  const formMeta = FORMS.find(f => f.id === activeFormId)!;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse h-8 w-48 bg-surface-2 rounded" />
        <div className="animate-pulse h-96 bg-surface-2 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="shrink-0 px-6 pt-6 pb-0 border-b border-border">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Form Builder</h1>
            <p className="text-sm text-muted mt-0.5">
              Customize fields for each form. Add custom fields, reorder, and configure options.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <button onClick={discard} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
                <RotateCcw className="size-3.5" /> Discard
              </button>
            )}
            <Button onClick={save} loading={saving} disabled={!isDirty}>
              <Save className="size-3.5" /> Save Changes
            </Button>
          </div>
        </div>

        {/* Form tabs */}
        <div className="flex gap-0">
          {FORMS.map(form => {
            const isActive = form.id === activeFormId;
            const hasDirty = dirty[form.id];
            return (
              <button
                key={form.id}
                onClick={() => setActiveFormId(form.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors relative",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground hover:border-border",
                )}
              >
                <form.icon className="size-3.5 shrink-0" />
                {form.label}
                {hasDirty && (
                  <span className="size-1.5 rounded-full bg-warning absolute top-2 right-1.5" title="Unsaved changes" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!activeSchema ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted text-sm">Schema not available.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Section sidebar */}
          <div className="w-52 shrink-0 border-r border-border p-3 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted/70 px-2 pb-1">Sections</p>
            {activeSchema.sections.map((section, i) => {
              const isActive = i === activeSectionIdx;
              const activeCount = section.fields.filter(f => f.isActive).length;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSectionIdx(i)}
                  className={cn(
                    "w-full flex flex-col items-start px-2.5 py-2 rounded-lg text-left transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-surface-2 text-foreground-secondary",
                  )}
                >
                  <span className="text-[13px] font-medium">{section.title}</span>
                  <span className="text-[11px] mt-0.5 opacity-70">
                    {activeCount} / {section.fields.length} active
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fields panel */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {activeSection && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">{activeSection.title}</h2>
                    <p className="text-xs text-muted mt-0.5">
                      {activeSection.fields.filter(f => f.isActive).length} active ·{" "}
                      {activeSection.fields.filter(f => !f.isCore).length} custom
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingField({ sectionIdx: activeSectionIdx, field: null })}
                  >
                    <Plus className="size-3.5" /> Add Custom Field
                  </Button>
                </div>

                {activeSection.fields.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
                    <p className="text-muted text-sm">No fields in this section yet.</p>
                    <Button size="sm" className="mt-3" onClick={() => setEditingField({ sectionIdx: activeSectionIdx, field: null })}>
                      <Plus className="size-3.5" /> Add First Field
                    </Button>
                  </div>
                )}

                {activeSection.fields.map((field, fieldIdx) => (
                  <FieldRow
                    key={field.key}
                    field={field}
                    fieldIdx={fieldIdx}
                    totalFields={activeSection.fields.length}
                    onToggle={() => handleToggle(activeSectionIdx, fieldIdx)}
                    onEdit={() => setEditingField({ sectionIdx: activeSectionIdx, field })}
                    onDelete={() => handleDelete(activeSectionIdx, fieldIdx)}
                    onMove={dir => handleMove(activeSectionIdx, fieldIdx, dir)}
                  />
                ))}
              </>
            )}
          </div>

          {/* Help panel */}
          <div className="w-60 shrink-0 border-l border-border p-4 space-y-4 overflow-y-auto">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted/70 mb-2">
                {formMeta.label} Form
              </p>
              <p className="text-xs text-muted">{formMeta.desc}</p>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted/70 mb-2">Field Types</p>
              <div className="space-y-1.5">
                {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="font-mono text-muted">{k}</span>
                    <span className="text-foreground-secondary">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted/70 mb-2">Enum Sets</p>
              {enumSets.length === 0 ? (
                <p className="text-xs text-muted">
                  No enum sets yet. Create reusable option lists in <strong>Data Catalog → Enum Sets</strong>.
                </p>
              ) : (
                <div className="space-y-2">
                  {enumSets.map(e => (
                    <div key={e._id} className="text-xs">
                      <p className="font-medium text-foreground-secondary">{e.name}</p>
                      <p className="text-muted truncate">
                        {((e.metadata?.values as string[]) ?? []).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3 space-y-2 text-xs text-muted">
              <div className="flex gap-1.5">
                <Lock className="size-3 mt-0.5 shrink-0 text-muted/60" />
                <span><strong className="text-foreground">Core</strong> fields are built-in. Configure label/required but cannot delete them.</span>
              </div>
              <div className="flex gap-1.5">
                <Plus className="size-3 mt-0.5 shrink-0 text-muted/60" />
                <span><strong className="text-foreground">Custom</strong> fields store as extra data and appear in the form and case detail view.</span>
              </div>
              <div className="flex gap-1.5">
                <EyeOff className="size-3 mt-0.5 shrink-0 text-muted/60" />
                <span><strong className="text-foreground">Hide</strong> a field to remove it from the form without deleting.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingField !== null && (
        <FieldEditor
          field={editingField.field}
          enumSets={enumSets}
          onSave={f => handleSaveField(editingField.sectionIdx, f)}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  );
}
