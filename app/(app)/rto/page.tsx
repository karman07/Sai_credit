"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw, Lock, CheckCircle2, Circle, Loader2, MinusCircle, Send, Save,
  MessageSquare, ListChecks, FileQuestion, ClipboardList, Paperclip, Check,
} from "lucide-react";
import { Label, ProgressBar, Badge, CaseStatusBadge, EmptyState, SearchInput, cn, useToast } from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";
import {
  casesApi, rtoApi, formSchemasApi, mastersApi, fileUrl,
  type LoanCase, type RTORecord, type RTOStage, type RTOStageStatus, type FieldDef, type SectionDef,
} from "../../../lib/api";
import { ExportButton } from "../../../components/ExportButton";
import { downloadXlsx, xlDate, customKeys, stampedName } from "../../../lib/excel";
import { customCell, customHead, customLabels } from "../../../lib/exportSheets";
import { FileFieldInput } from "../../../components/FileFieldInput";
import { CaseChatThread } from "../../../components/CaseChatThread";

const STAGE_STATUSES: RTOStageStatus[] = ["Pending", "In Progress", "Done", "NA"];
const inp = "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

/** Core fields now covered by the Data Catalog stages — hidden from the details form. */
const SUPERSEDED_KEYS = new Set(["verification", "approval", "insuranceEndorsement"]);

type Tab = "stages" | "details" | "requests" | "chat";

function stageProgress(r?: RTORecord | null) {
  const active = (r?.stages ?? []).filter(s => s.status !== "NA");
  const done = active.filter(s => s.status === "Done").length;
  return { done, total: active.length, pct: active.length ? Math.round((done / active.length) * 100) : 0 };
}

function StageIcon({ status }: { status: RTOStageStatus }) {
  if (status === "Done") return <CheckCircle2 className="size-5 text-success" />;
  if (status === "In Progress") return <Loader2 className="size-5 text-primary" />;
  if (status === "NA") return <MinusCircle className="size-5 text-muted" />;
  return <Circle className="size-5 text-muted" />;
}

// ── Stages ────────────────────────────────────────────────────────────

function StagesPanel({ record, onChange }: { record: RTORecord; onChange: (r: RTORecord) => void }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function act(stage: RTOStage, body: { status?: RTOStageStatus; comment?: string }) {
    setBusy(stage.stageId);
    try {
      const { data } = await rtoApi.updateStage(record._id, stage.stageId, body);
      onChange(data);
      if (body.comment) setDrafts(d => ({ ...d, [stage.stageId]: "" }));
    } catch (e: any) {
      toast("error", e.message ?? "Failed to update stage");
    } finally {
      setBusy(null);
    }
  }

  const stages = [...(record.stages ?? [])].sort((a, b) => a.order - b.order);
  if (stages.length === 0) {
    return <p className="text-sm text-muted">No RTO stages are configured yet. Ask an admin to add them in the Data Catalog → RTO Stages.</p>;
  }

  return (
    <ol className="space-y-3">
      {stages.map((s, i) => (
        <li key={s.stageId} className="rounded-lg border border-border bg-surface p-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <StageIcon status={s.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{i + 1}. {s.name}</p>
              {s.updatedByName && (
                <p className="text-[11px] text-muted">Updated by {s.updatedByName}{s.updatedAt ? ` · ${new Date(s.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</p>
              )}
            </div>
            <select
              value={s.status}
              disabled={busy === s.stageId}
              onChange={e => act(s, { status: e.target.value as RTOStageStatus })}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {STAGE_STATUSES.map(o => <option key={o} value={o}>{o === "NA" ? "Not Applicable" : o}</option>)}
            </select>
          </div>

          {s.comments.length > 0 && (
            <ul className="space-y-1.5 pl-8">
              {s.comments.map(c => (
                <li key={c._id} className="text-xs bg-surface-2 rounded-md px-2.5 py-1.5">
                  <span className="font-semibold">{c.authorName}</span>
                  <span className="text-muted"> · {new Date(c.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <p className="mt-0.5 whitespace-pre-wrap">{c.text}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pl-8">
            <input
              value={drafts[s.stageId] ?? ""}
              onChange={e => setDrafts(d => ({ ...d, [s.stageId]: e.target.value }))}
              onKeyDown={e => { if (e.key === "Enter" && drafts[s.stageId]?.trim()) act(s, { comment: drafts[s.stageId].trim() }); }}
              placeholder="Add a comment on this stage…"
              className={cn(inp, "py-1.5 text-xs")}
            />
            <button
              disabled={busy === s.stageId || !drafts[s.stageId]?.trim()}
              onClick={() => act(s, { comment: drafts[s.stageId].trim() })}
              className="shrink-0 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
            >
              Comment
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Details form (driven by Form Builder → RTO) ───────────────────────

function toFormValue(field: FieldDef, record: RTORecord): string {
  const raw = field.isCore ? (record as any)[field.key] : record.customFields?.[field.key];
  if (raw === undefined || raw === null || raw === "") return field.defaultValue ?? "";
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "boolean") return raw ? "true" : "false";
  if (field.type === "date") return String(raw).substring(0, 10);
  return String(raw);
}

function fromFormValue(field: FieldDef, value: string): unknown {
  switch (field.type) {
    case "number": return Number(value) || 0;
    case "boolean": return value === "true" || value === "Yes";
    case "date": return value || undefined;
    default:
      if (field.key === "pendingDocuments") return value.split(",").map(s => s.trim()).filter(Boolean);
      return value;
  }
}

function DetailsPanel({ record, sections, onChange }: { record: RTORecord; sections: SectionDef[]; onChange: (r: RTORecord) => void }) {
  const toast = useToast();
  const visible = useMemo(
    () => sections
      .map(sec => ({ ...sec, fields: sec.fields.filter(f => f.isActive !== false && !SUPERSEDED_KEYS.has(f.key)).sort((a, b) => a.order - b.order) }))
      .filter(sec => sec.fields.length > 0),
    [sections],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v: Record<string, string> = {};
    for (const sec of visible) for (const f of sec.fields) v[f.key] = toFormValue(f, record);
    setValues(v);
  }, [record._id, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const custom: Record<string, unknown> = { ...(record.customFields ?? {}) };
      for (const sec of visible) for (const f of sec.fields) {
        const val = fromFormValue(f, values[f.key] ?? "");
        if (f.isCore) { if (val !== undefined) body[f.key] = val; } else custom[f.key] = val;
      }
      body.customFields = custom;
      const { data } = await rtoApi.upsertByCase(record.caseId!, body);
      onChange(data);
      toast("success", "RTO details saved");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const set = (k: string, v: string) => setValues(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {visible.map(sec => (
        <section key={sec.id} className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{sec.title}</p>
          <div className="grid grid-cols-2 gap-3">
            {sec.fields.map(f => {
              const v = values[f.key] ?? "";
              const wide = f.type === "boolean" || f.key === "remarks" || f.key === "pendingDocuments";
              return (
                <div key={f.key} className={wide ? "col-span-2" : ""}>
                  {f.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="checkbox" className="size-4 rounded" checked={v === "true" || v === "Yes"} onChange={e => set(f.key, e.target.checked ? "true" : "false")} />
                      {f.label}
                    </label>
                  ) : (
                    <>
                      <Label>{f.label}{f.required && " *"}</Label>
                      {f.type === "select" ? (
                        <select value={v} onChange={e => set(f.key, e.target.value)} className={inp}>
                          <option value="">—</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === "file" ? (
                        <FileFieldInput value={v} onChange={nv => set(f.key, nv)} />
                      ) : f.key === "remarks" ? (
                        <textarea value={v} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className={cn(inp, "min-h-[56px] resize-y")} />
                      ) : (
                        <input
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          value={v} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className={inp}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
          <Save className="size-3.5" /> {saving ? "Saving…" : "Save details"}
        </button>
      </div>
    </div>
  );
}

// ── Requests to sales ─────────────────────────────────────────────────

function RequestsPanel({ record, stages, onChange }: { record: RTORecord; stages: RTOStage[]; onChange: (r: RTORecord) => void }) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [remarks, setRemarks] = useState("");
  const [stageName, setStageName] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    mastersApi.list("document-types").then(r => setCatalog(r.data.map(d => d.name))).catch(() => {});
  }, []);

  async function send() {
    const docTypes = [...picked, ...other.split(",").map(s => s.trim()).filter(Boolean)];
    if (!docTypes.length || !remarks.trim()) { toast("error", "Pick at least one document and add remarks"); return; }
    setSending(true);
    try {
      const { data } = await rtoApi.requestDocs(record._id, { docTypes, remarks: remarks.trim(), stageName: stageName || undefined });
      onChange(data);
      setPicked([]); setOther(""); setRemarks(""); setStageName("");
      toast("success", "Request sent to the sales team");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to send request");
    } finally {
      setSending(false);
    }
  }

  async function resolve(reqId: string) {
    try {
      const { data } = await rtoApi.resolveRequest(record._id, reqId);
      onChange(data);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to resolve");
    }
  }

  const requests = [...(record.docRequests ?? [])].reverse();

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-surface p-3 space-y-3">
        <p className="text-sm font-semibold">Request documents from sales</p>
        {catalog.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {catalog.map(d => (
              <button
                key={d} type="button"
                onClick={() => setPicked(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                  picked.includes(d) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface-2")}
              >{d}</button>
            ))}
          </div>
        )}
        <input value={other} onChange={e => setOther(e.target.value)} placeholder="Other documents (comma separated)" className={inp} />
        {stages.length > 0 && (
          <select value={stageName} onChange={e => setStageName(e.target.value)} className={inp}>
            <option value="">Related stage (optional)</option>
            {stages.map(s => <option key={s.stageId} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="What is needed and why…" className={cn(inp, "min-h-[56px] resize-y")} />
        <div className="flex justify-end">
          <button onClick={send} disabled={sending} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            <Send className="size-3.5" /> {sending ? "Sending…" : "Send request"}
          </button>
        </div>
      </section>

      {requests.length === 0 ? (
        <p className="text-sm text-muted">No document requests yet.</p>
      ) : requests.map(r => (
        <div key={r._id} className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{r.docTypes.join(", ")}</p>
              <p className="text-[11px] text-muted">
                {r.requestedByName} · {new Date(r.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {r.stageName ? ` · ${r.stageName}` : ""}
              </p>
            </div>
            {r.isResolved
              ? <Badge tone="success">Resolved</Badge>
              : <Badge tone={r.response ? "info" : "warning"}>{r.response ? "Response received" : "Awaiting sales"}</Badge>}
          </div>
          <p className="text-xs whitespace-pre-wrap">{r.remarks}</p>
          {r.response && (
            <div className="bg-surface-2 rounded-md p-2.5 text-xs space-y-1">
              <p><span className="font-semibold">{r.response.byName}</span> replied:</p>
              {r.response.text && <p className="whitespace-pre-wrap">{r.response.text}</p>}
              {r.response.attachments.map((a, i) => (
                <a key={i} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                  <Paperclip className="size-3" /> {a.fileName}
                </a>
              ))}
            </div>
          )}
          {!r.isResolved && (
            <button onClick={() => resolve(r._id)} className="flex items-center gap-1 text-xs font-semibold text-success hover:underline">
              <Check className="size-3.5" /> Mark resolved
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function RTOPage() {
  const { user } = useAuth();
  const toast = useToast();
  const hasAccess = !!user?.rtoAccess;

  const [cases, setCases] = useState<LoanCase[]>([]);
  const [records, setRecords] = useState<Record<string, RTORecord>>({});
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [tab, setTab] = useState<Tab>("stages");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "completed" | "waiting">("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The server already limits cases to Disbursed vehicle loans for RTO coordinators.
      const [caseRes, rtoRes, schemaRes] = await Promise.all([
        casesApi.list({ limit: 500 }),
        rtoApi.list(),
        formSchemasApi.get("rto"),
      ]);
      setCases(caseRes.data as unknown as LoanCase[]);
      setRecords(Object.fromEntries(rtoRes.data.filter(r => r.caseId).map(r => [r.caseId!, r])));
      setSections(schemaRes.data.sections);
    } catch (e: any) {
      setError(e.message ?? "Failed to load RTO data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (hasAccess) load(); else setLoading(false); }, [load, hasAccess]);

  async function open(caseId: string) {
    setSelectedId(caseId);
    setTab("stages");
    setOpening(true);
    try {
      const { data } = await rtoApi.getByCase(caseId);
      if (data) setRecords(p => ({ ...p, [caseId]: data }));
    } catch (e: any) {
      toast("error", e.message ?? "Could not open RTO file");
    } finally {
      setOpening(false);
    }
  }

  function applyRecord(r: RTORecord) {
    if (r.caseId) setRecords(p => ({ ...p, [r.caseId!]: r }));
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter(c => {
      const r = records[c._id];
      if (q && !`${c.caseCode} ${c.customer.firstName} ${c.customer.lastName} ${c.regNumber ?? ""}`.toLowerCase().includes(q)) return false;
      const completed = r?.status === "Completed";
      const waiting = !!r?.docRequests?.some(d => !d.isResolved);
      if (filter === "open") return !completed;
      if (filter === "completed") return completed;
      if (filter === "waiting") return waiting;
      return true;
    });
  }, [cases, records, search, filter]);

  if (!hasAccess) {
    return (
      <div className="max-w-2xl">
        <EmptyState icon={Lock} title="No access to RTO" description="RTO access is granted per coordinator. Ask an admin to enable it for your account." />
      </div>
    );
  }

  const selectedCase = cases.find(c => c._id === selectedId);
  const selectedRecord = selectedId ? records[selectedId] : undefined;

  const tabs: { id: Tab; label: string; icon: typeof ListChecks }[] = [
    { id: "stages", label: "Stages", icon: ListChecks },
    { id: "details", label: "Details", icon: ClipboardList },
    { id: "requests", label: "Sales requests", icon: FileQuestion },
    { id: "chat", label: "Chat", icon: MessageSquare },
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RTO Work</h1>
          <p className="text-sm text-muted mt-0.5">Disbursed vehicle loans waiting on RTO. Work the stages, request documents from sales, and close each file.</p>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <ExportButton onExport={async () => {
            // One row per case in the current list, with a column per catalog stage.
            const stageNames = [...new Set(Object.values(records).flatMap((r) => (r.stages ?? []).map((st) => st.name)))];
            const ck = customKeys(Object.values(records));
            const labels = await customLabels();
            await downloadXlsx(
              "RTO",
              ["Case ID", "Customer", "Phone", "Vehicle", "Reg. Number", "Bank", "Dealer", "Sales Rep", "RTO Status", "Progress %", "RTO Owner",
                ...stageNames, "Open Doc Requests", "Total Doc Requests", "Completed On",
                "Ownership Type", "RTO Ownership", "RTO Receiving", "Challan Check", "Bank NOC", "NOC Hold (₹)", "Insurance Check",
                "Hypothecation", "Aadhaar Match", "Aadhaar Mismatch Note", "Pending Documents", "Balance Payment (₹)", "Approval Date",
                "RTO Slip", "Remarks", ...ck.map((k) => customHead(k, labels))],
              rows.map((c) => {
                const r = records[c._id];
                const byName = new Map((r?.stages ?? []).map((st) => [st.name, st.status]));
                return [
                  c.caseCode, `${c.customer.firstName} ${c.customer.lastName}`.trim(), c.customer.contact ?? "", c.vehicleModel ?? "",
                  c.regNumber ?? "", c.bankName ?? "", c.dealerName ?? "", c.assignedToName ?? "", r?.status ?? "Not started",
                  stageProgress(r).pct, r?.rtoOwnerName ?? "",
                  ...stageNames.map((n) => byName.get(n) ?? ""),
                  (r?.docRequests ?? []).filter((d) => !d.isResolved).length, (r?.docRequests ?? []).length,
                  xlDate(r?.completedAt),
                  r?.rtoOwnershipType ?? "", r?.rtoOwnership ?? "", r?.rtoReceiving ? "Yes" : "No", r?.challanCheck ?? "", r?.bankNocCheck ?? "",
                  r?.nocHoldAmt ?? "", r?.insuranceCheck ?? "", r?.hypothecation ?? "", r?.aadhaarMatch ?? "", r?.aadhaarMismatchNote ?? "",
                  (r?.pendingDocuments ?? []).join(", "), r?.balancePayment ?? "", xlDate(r?.approvalDate), r?.rtoSlipFileName ?? "",
                  r?.remarks ?? "", ...ck.map((k) => customCell(r?.customFields?.[k])),
                ];
              }),
              stampedName("rto"),
            );
            return rows.length;
          }} />
          <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
            <RefreshCw className="size-3.5" /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 border-danger-border bg-danger-subtle">
          <p className="text-sm text-danger font-medium">{error}</p>
          <button onClick={load} className="mt-2 text-xs text-primary underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Case list */}
        <div className="card p-3 space-y-3 lg:sticky lg:top-20">
          <SearchInput value={search} onChange={setSearch} placeholder="Search case, customer, reg. no." />
          <div className="flex gap-1.5 flex-wrap">
            {([["open", "Open"], ["waiting", "Waiting on sales"], ["completed", "Completed"], ["all", "All"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)}
                className={cn("text-xs px-2.5 py-1 rounded-full border", filter === id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-surface-2")}>
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5 max-h-[68vh] overflow-y-auto">
            {loading ? [1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-2 rounded-lg animate-pulse" />)
              : rows.length === 0 ? <p className="text-sm text-muted text-center py-6">No disbursed vehicle cases match.</p>
              : rows.map(c => {
                const r = records[c._id];
                const { pct } = stageProgress(r);
                const waiting = r?.docRequests?.filter(d => !d.isResolved).length ?? 0;
                return (
                  <button key={c._id} onClick={() => open(c._id)}
                    className={cn("w-full text-left rounded-lg border p-2.5 transition-colors",
                      selectedId === c._id ? "border-primary bg-primary/5" : "border-border hover:bg-surface-2")}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary font-semibold">{c.caseCode}</span>
                      <span className="text-sm font-medium truncate">{c.customer.firstName} {c.customer.lastName}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <CaseStatusBadge status={r?.status ?? "Pending"} />
                      {waiting > 0 && <Badge tone="warning">{waiting} open request{waiting > 1 ? "s" : ""}</Badge>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1"><ProgressBar value={pct} tone={pct === 100 ? "success" : pct >= 50 ? "warning" : "danger"} size="sm" /></div>
                      <span className="text-[11px] text-muted">{pct}%</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Detail */}
        <div className="card p-0 overflow-hidden min-h-[320px]">
          {!selectedCase ? (
            <div className="p-10 text-center text-sm text-muted">Select a case to start working its RTO.</div>
          ) : (
            <>
              <div className="p-4 border-b border-border space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-primary font-semibold">{selectedCase.caseCode}</span>
                  <span className="font-semibold">{selectedCase.customer.firstName} {selectedCase.customer.lastName}</span>
                  <Badge tone="neutral">{selectedCase.product}</Badge>
                  {selectedRecord?.status && <CaseStatusBadge status={selectedRecord.status} />}
                </div>
                <p className="text-xs text-muted">
                  {[selectedCase.vehicleModel, selectedCase.regNumber, selectedCase.bankName && `Bank: ${selectedCase.bankName}`,
                    selectedCase.dealerName && `Dealer: ${selectedCase.dealerName}`,
                    selectedCase.assignedToName && `Sales: ${selectedCase.assignedToName}`].filter(Boolean).join(" · ")}
                </p>
                {selectedRecord && (() => {
                  const p = stageProgress(selectedRecord);
                  return <p className="text-xs text-muted">{p.done}/{p.total} stages done{selectedRecord.completedAt ? " · admin notified of completion" : ""}</p>;
                })()}
              </div>

              <div className="flex border-b border-border overflow-x-auto">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap",
                      tab === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground")}>
                    <t.icon className="size-3.5" /> {t.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {opening && !selectedRecord ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-2 rounded-lg animate-pulse" />)}</div>
                ) : !selectedRecord ? (
                  <p className="text-sm text-muted">Could not load the RTO file for this case.</p>
                ) : tab === "stages" ? (
                  <StagesPanel record={selectedRecord} onChange={applyRecord} />
                ) : tab === "details" ? (
                  <DetailsPanel record={selectedRecord} sections={sections} onChange={applyRecord} />
                ) : tab === "requests" ? (
                  <RequestsPanel record={selectedRecord} stages={selectedRecord.stages ?? []} onChange={applyRecord} />
                ) : (
                  <CaseChatThread caseId={selectedCase._id} height="460px" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
