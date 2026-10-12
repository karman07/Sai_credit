"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, ChevronLeft, Search } from "lucide-react";
import { CaseStatusBadge } from "./ui";
import { CaseChatThread } from "./CaseChatThread";
import { casesApi, type LoanCase } from "../lib/api";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "thread">("list");
  const [search, setSearch] = useState("");
  const [cases, setCases] = useState<LoanCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [activeCase, setActiveCase] = useState<LoanCase | null>(null);

  // Case picker list, refreshed whenever the widget is opened on the list view or the search changes.
  useEffect(() => {
    if (!open || view !== "list") return;
    setLoadingCases(true);
    const t = setTimeout(() => {
      casesApi.list({ search: search || undefined, limit: 30 })
        .then(({ data }) => setCases(data))
        .catch(() => setCases([]))
        .finally(() => setLoadingCases(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, view, search]);

  function openCase(c: LoanCase) {
    setActiveCase(c);
    setView("thread");
  }

  function backToList() {
    setView("list");
    setActiveCase(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-[90] size-14 rounded-full bg-primary text-primary-foreground shadow-xl grid place-items-center hover:scale-105 transition-transform"
        title="Case chat"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-[95] w-[380px] h-[560px] max-h-[75vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-border bg-surface-2/60">
            {view === "thread" ? (
              <>
                <button onClick={backToList} className="size-7 grid place-items-center rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors shrink-0">
                  <ChevronLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{activeCase?.caseCode}</p>
                  <p className="text-[11px] text-muted truncate">
                    {activeCase?.customer.firstName} {activeCase?.customer.lastName}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold flex-1">Case Chat</p>
            )}
            <button onClick={() => setOpen(false)} className="size-7 grid place-items-center rounded-md hover:bg-surface-2 text-muted hover:text-foreground transition-colors shrink-0">
              <X className="size-4" />
            </button>
          </div>

          {/* List view */}
          {view === "list" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by case ID or customer…"
                    className="w-full h-8 pl-8 pr-2 rounded-md border border-border bg-surface text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingCases ? (
                  <div className="p-6 text-center text-xs text-muted">Loading cases…</div>
                ) : cases.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted">No cases found.</div>
                ) : (
                  cases.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => openCase(c)}
                      className="w-full text-left px-4 py-2.5 border-b border-border-subtle hover:bg-surface-2/60 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-primary truncate">{c.caseCode}</p>
                        <p className="text-xs text-foreground-secondary truncate">{c.customer.firstName} {c.customer.lastName}</p>
                      </div>
                      <CaseStatusBadge status={c.status} />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Thread view */}
          {view === "thread" && activeCase && (
            <div className="flex-1 min-h-0 p-0">
              <CaseChatThread caseId={activeCase._id} height="100%" bordered={false} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
