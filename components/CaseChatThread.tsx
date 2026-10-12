"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Paperclip, Loader2, FileText, X } from "lucide-react";
import { cn, useToast } from "./ui";
import { useAuth } from "../lib/auth-context";
import {
  caseMessagesApi, uploadsApi, fileUrl,
  type CaseMessage, type MessageAttachment,
} from "../lib/api";

function isImage(fileType?: string) {
  return !!fileType && fileType.startsWith("image/");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * The message list + composer for one case's chat — self-contained (polls on
 * its own), so it can be dropped into the floating widget's thread view and
 * directly into a case's own detail tabs without duplicating the logic.
 */
export function CaseChatThread({ caseId, height = "420px", bordered = true }: { caseId: string; height?: string; bordered?: boolean }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const { data } = await caseMessagesApi.list(caseId);
      setMessages(data);
    } catch {
      // keep whatever was already loaded
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadMessages(true);
    const iv = setInterval(() => loadMessages(false), 8000);
    return () => clearInterval(iv);
  }, [loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) setPendingFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(idx: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSend() {
    if (sending) return;
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const attachments: MessageAttachment[] = [];
      for (const file of pendingFiles) {
        const { data } = await uploadsApi.upload(file);
        attachments.push({ url: data.url, fileName: data.fileName, fileType: file.type });
      }
      const { data } = await caseMessagesApi.send(caseId, { text: text.trim(), attachments });
      setMessages((prev) => [...prev, data]);
      setText("");
      setPendingFiles([]);
    } catch (e: any) {
      toast("error", e.message ?? "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={cn("flex flex-col bg-surface", bordered && "border border-border rounded-xl overflow-hidden")} style={{ height }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading ? (
          <div className="text-center text-xs text-muted py-6">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-xs text-muted py-6">No messages yet. Say hello 👋</div>
        ) : (
          messages.map((m) => {
            const mine = m.authorId === user?.id;
            return (
              <div key={m._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[80%] rounded-xl px-3 py-2", mine ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground")}>
                  {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.authorName}</p>}
                  {m.text && <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>}
                  {m.attachments.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {m.attachments.map((a, i) =>
                        isImage(a.fileType) ? (
                          <a key={i} href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="block">
                            <img src={fileUrl(a.url)} alt={a.fileName} className="max-w-[240px] max-h-[200px] rounded-lg border border-black/10 object-cover" />
                          </a>
                        ) : (
                          <a
                            key={i}
                            href={fileUrl(a.url)}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 border",
                              mine ? "border-white/30 hover:bg-white/10" : "border-border hover:bg-surface-3",
                            )}
                          >
                            <FileText className="size-3.5 shrink-0" />
                            <span className="truncate">{a.fileName}</span>
                          </a>
                        ),
                      )}
                    </div>
                  )}
                  <p className={cn("text-[10px] mt-1", mine ? "opacity-70" : "text-muted")}>{timeAgo(m.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div className="shrink-0 px-3 pt-2 flex flex-wrap gap-1.5">
          {pendingFiles.map((f, i) => (
            <span key={i} className="flex items-center gap-1 text-[11px] bg-surface-2 border border-border rounded-full pl-2 pr-1 py-0.5">
              <span className="truncate max-w-[140px]">{f.name}</span>
              <button onClick={() => removePendingFile(i)} className="size-4 grid place-items-center rounded-full hover:bg-surface-3">
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="shrink-0 p-2.5 border-t border-border flex items-end gap-1.5">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={pickFiles} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="size-8 shrink-0 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
          title="Attach file"
        >
          <Paperclip className="size-4" />
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none max-h-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={handleSend}
          disabled={sending || (!text.trim() && pendingFiles.length === 0)}
          className="size-8 shrink-0 grid place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
          title="Send"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
    </div>
  );
}
