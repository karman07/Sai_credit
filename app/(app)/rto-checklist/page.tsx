"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, CheckCircle2, Circle, Loader2, MinusCircle, ChevronDown, ChevronRight,
  Paperclip, Send, MessageSquare,
} from "lucide-react";
import { Badge, ProgressBar, EmptyState, CaseStatusBadge, cn, useToast } from "../../../components/ui";
import {
  casesApi, rtoApi, uploadsApi, fileUrl,
  type LoanCase, type RTORecord, type RTODocRequest, type RTOStageStatus,
} from "../../../lib/api";
import { CaseChatThread } from "../../../components/CaseChatThread";

function StageIcon({ status }: { status: RTOStageStatus }) {
  if (status === "Done") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "In Progress") return <Loader2 className="size-4 text-primary" />;
  if (status === "NA") return <MinusCircle className="size-4 text-muted" />;
  return <Circle className="size-4 text-muted" />;
}

function RequestCard({ record, req, onChange }: { record: RTORecord; req: RTODocRequest; onChange: (r: RTORecord) => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  async function respond() {
    if (!text.trim() && files.length === 0) return;
    setSending(true);
    try {
      const attachments: { url: string; fileName: string }[] = [];
      for (const f of files) {
        const { data } = await uploadsApi.upload(f);
        attachments.push({ url: data.url, fileName: data.fileName });
      }
      const { data } = await rtoApi.respond(record._id, req._id, { text: text.trim(), attachments });
      onChange(data);
      setText(""); setFiles([]);
      toast("success", "Sent to the RTO team");
    } catch (e: any) {
      toast("error", e.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{req.docTypes.join(", ")}</p>
          <p className="text-[11px] text-muted">Requested by {req.requestedByName} · {new Date(req.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
        </div>
        {req.isResolved ? <Badge tone="success">Resolved</Badge> : req.response ? <Badge tone="info">Sent</Badge> : <Badge tone="warning">Action needed</Badge>}
      </div>
      <p className="text-xs whitespace-pre-wrap">{req.remarks}</p>

      {req.response && (
        <div className="bg-surface-2 rounded-md p-2.5 text-xs space-y-1">
          <p className="font-semibold">Your reply</p>
          {req.response.text && <p className="whitespace-pre-wrap">{req.response.text}</p>}
          {req.response.attachments.map((a, i) => (
            <a key={i} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Paperclip className="size-3" /> {a.fileName}
            </a>
          ))}
        </div>
      )}

      {!req.isResolved && (
        <div className="space-y-2 pt-1">
          <textarea
            value={text} onChange={e => setText(e.target.value)} placeholder="Add a note for the RTO team…"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm min-h-[52px] resize-y focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span key={i} className="text-[11px] bg-surface-2 border border-border rounded-full px-2 py-0.5">{f.name}</span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground cursor-pointer">
              <Paperclip className="size-3.5" /> Attach files
              <input type="file" multiple className="hidden" onChange={e => { setFiles(p => [...p, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
            </label>
            <button
              onClick={respond} disabled={sending || (!text.trim() && files.length === 0)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40"
            >
              <Send className="size-3.5" /> {sending ? "Sending…" : req.response ? "Send another reply" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RTOStatusPage() {
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [records, setRecords] = useState<Record<string, RTORecord>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseRes, rtoRes] = await Promise.all([
        casesApi.list({ status: "Disbursed", limit: 500 }),
        rtoApi.list(),
      ]);
      const vehicle = (caseRes.data as unknown as LoanCase[]).filter(c => c.product === "Car Loan" || c.product === "Commercial Vehicle Loan");
      setCases(vehicle);
      setRecords(Object.fromEntries(rtoRes.data.filter(r => r.caseId).map(r => [r.caseId!, r])));
    } catch (e: any) {
      setError(e.message ?? "Failed to load RTO status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const apply = (r: RTORecord) => r.caseId && setRecords(p => ({ ...p, [r.caseId!]: r }));

  return (
    <div className="space-y-5 animate-fadeIn max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">RTO Status</h1>
          <p className="text-sm text-muted mt-0.5">Track RTO progress on your disbursed vehicle loans and answer document requests from the RTO team.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground mt-1">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {error && <div className="card p-4 border-danger-border bg-danger-subtle text-sm text-danger">{error}</div>}

      {loading ? [1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-2 rounded-xl animate-pulse" />)
        : cases.length === 0 ? <EmptyState title="No disbursed vehicle loans yet" description="Cases show up here once they are disbursed." />
        : cases.map(c => {
          const r = records[c._id];
          const stages = [...(r?.stages ?? [])].sort((a, b) => a.order - b.order);
          const active = stages.filter(s => s.status !== "NA");
          const pct = active.length ? Math.round((active.filter(s => s.status === "Done").length / active.length) * 100) : 0;
          const open = (r?.docRequests ?? []).filter(d => !d.isResolved && !d.response).length;
          const isOpen = expanded === c._id;
          return (
            <div key={c._id} className="card p-0 overflow-hidden">
              <button className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-2 transition-colors" onClick={() => setExpanded(isOpen ? null : c._id)}>
                {isOpen ? <ChevronDown className="size-4 text-muted shrink-0" /> : <ChevronRight className="size-4 text-muted shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-primary font-semibold">{c.caseCode}</span>
                    <span className="text-sm font-medium">{c.customer.firstName} {c.customer.lastName}</span>
                    {c.regNumber && <span className="text-xs text-muted">· {c.regNumber}</span>}
                    <CaseStatusBadge status={r?.status ?? "Awaiting RTO"} />
                    {open > 0 && <Badge tone="warning">{open} request{open > 1 ? "s" : ""} need you</Badge>}
                  </div>
                  <div className="mt-1.5"><ProgressBar value={pct} tone={pct === 100 ? "success" : pct >= 50 ? "warning" : "danger"} size="sm" /></div>
                </div>
                <span className="text-xs font-semibold text-primary shrink-0">{pct}%</span>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4 space-y-5 bg-surface-2/30">
                  {!r ? (
                    <p className="text-sm text-muted">The RTO team hasn't picked this file up yet.</p>
                  ) : (
                    <>
                      {r.rtoOwnerName && <p className="text-xs text-muted">Handled by <span className="font-semibold text-foreground">{r.rtoOwnerName}</span></p>}
                      <ol className="space-y-2">
                        {stages.map(s => (
                          <li key={s.stageId} className="flex items-start gap-2.5">
                            <StageIcon status={s.status} />
                            <div className="min-w-0">
                              <p className="text-sm"><span className="font-medium">{s.name}</span> <span className="text-xs text-muted">· {s.status === "NA" ? "Not applicable" : s.status}</span></p>
                              {s.comments.length > 0 && (
                                <p className="text-xs text-muted truncate">Latest: {s.comments[s.comments.length - 1].text}</p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>

                      {(r.docRequests ?? []).length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Document requests</p>
                          {[...r.docRequests!].reverse().map(req => <RequestCard key={req._id} record={r} req={req} onChange={apply} />)}
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <button
                      onClick={() => setChatOpen(p => { const n = new Set(p); n.has(c._id) ? n.delete(c._id) : n.add(c._id); return n; })}
                      className={cn("flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline", chatOpen.has(c._id) && "mb-2")}
                    >
                      <MessageSquare className="size-3.5" /> {chatOpen.has(c._id) ? "Hide chat" : "Chat with RTO team"}
                    </button>
                    {chatOpen.has(c._id) && <CaseChatThread caseId={c._id} height="360px" />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
