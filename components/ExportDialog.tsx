"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button, Modal, cn, useToast } from "./ui";
import { CaseFilterPanel, type FilterHide } from "./CaseFilterPanel";
import { downloadXlsxSheets, type XlsxSheet } from "../lib/excel";
import type { CaseFacets, CaseFilters } from "../lib/caseFilters";

type Excluded = Record<string, string[]>; // sheet name -> headers the user switched off ("" key = sheet itself off)

function readPrefs(key: string): Excluded {
  try { return JSON.parse(localStorage.getItem(`export-cols:${key}`) ?? "{}"); } catch { return {}; }
}
function writePrefs(key: string, v: Excluded) {
  try { localStorage.setItem(`export-cols:${key}`, JSON.stringify(v)); } catch { /* private mode etc. */ }
}

/**
 * Export dialog: pick which sheets and columns to download. Choices are remembered per `storageKey`
 * (stored as the columns you switched OFF, so columns added later are on by default).
 * With `filters`, the dialog also carries the case filter panel (pre-filled from the page) and reloads the
 * data as the filters change, so what you export is exactly what you filtered.
 */
export function ExportDialog({
  open, onClose, title = "Export to Excel", filename, storageKey, loadSheets, filters,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Base file name without date/extension. */
  filename: string;
  storageKey: string;
  loadSheets: (filters?: CaseFilters) => Promise<XlsxSheet[]>;
  filters?: { initial: CaseFilters; facets: CaseFacets; hide?: FilterHide[] };
}) {
  const toast = useToast();
  const [f, setF] = useState<CaseFilters | undefined>(filters?.initial);
  const [sheets, setSheets] = useState<XlsxSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Excluded>({});
  const [activeSheet, setActiveSheet] = useState(0);
  const [colSearch, setColSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  // Reset to the page's current filters + saved column choices each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setF(filters?.initial);
    setExcluded(readPrefs(storageKey));
    setActiveSheet(0);
    setColSearch("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // (Re)load the data — debounced while the filters change.
  useEffect(() => {
    if (!open) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    const t = setTimeout(() => {
      loadSheets(f)
        .then((s) => { if (mine === seq.current) setSheets(s); })
        .catch((e) => { if (mine === seq.current) setError(e?.message ?? "Failed to load data"); })
        .finally(() => { if (mine === seq.current) setLoading(false); });
    }, filters ? 500 : 0);
    return () => clearTimeout(t);
  }, [open, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const sheet = sheets[Math.min(activeSheet, Math.max(sheets.length - 1, 0))];
  const off = (name: string) => excluded[name] ?? [];
  const sheetOn = (name: string) => !off(name).includes("");
  const colOn = (name: string, h: string) => !off(name).includes(h);

  const update = (next: Excluded) => { setExcluded(next); writePrefs(storageKey, next); };
  const toggleCol = (name: string, h: string) =>
    update({ ...excluded, [name]: colOn(name, h) ? [...off(name), h] : off(name).filter((x) => x !== h) });
  const setAll = (name: string, headers: string[], on: boolean) =>
    update({ ...excluded, [name]: [...(sheetOn(name) ? [] : [""]), ...(on ? [] : headers)] });
  const toggleSheet = (name: string) =>
    update({ ...excluded, [name]: sheetOn(name) ? [...off(name), ""] : off(name).filter((x) => x !== "") });

  const visibleHeaders = useMemo(() => {
    if (!sheet) return [];
    const q = colSearch.trim().toLowerCase();
    return sheet.headers.filter((h) => !q || h.toLowerCase().includes(q));
  }, [sheet, colSearch]);

  /** The workbook the user has configured: chosen sheets only, chosen columns only. */
  const chosen = useMemo(
    () => sheets
      .filter((s) => sheetOn(s.name))
      .map((s) => {
        const idx = s.headers.map((h, i) => (colOn(s.name, h) ? i : -1)).filter((i) => i >= 0);
        return { name: s.name, headers: idx.map((i) => s.headers[i]), rows: s.rows.map((r) => idx.map((i) => r[i])) };
      })
      .filter((s) => s.headers.length > 0),
    [sheets, excluded], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function run() {
    if (chosen.length === 0) { toast("error", "Select at least one column to export"); return; }
    setBusy(true);
    try {
      await downloadXlsxSheets(chosen, `${filename}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast("success", `Exported ${chosen[0].rows.length} row${chosen[0].rows.length !== 1 ? "s" : ""} to Excel`);
      onClose();
    } catch (e: any) {
      toast("error", e?.message ?? "Failed to export");
    } finally {
      setBusy(false);
    }
  }

  const mainRows = sheets[0]?.rows.length ?? 0;
  const selectedCols = sheet ? sheet.headers.filter((h) => colOn(sheet.name, h)).length : 0;

  return (
    <Modal
      open={open} onClose={onClose} title={title} size="xl"
      description="Choose the filters and columns to include. Your column choices are remembered."
      footer={
        <div className="flex items-center justify-between w-full gap-3">
          <p className="text-xs text-muted">
            {loading ? "Loading data…" : error ? "" : `${mainRows.toLocaleString("en-IN")} row${mainRows !== 1 ? "s" : ""} · ${chosen.reduce((n, s) => n + s.headers.length, 0)} columns in ${chosen.length} sheet${chosen.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={run} loading={busy} disabled={loading || !!error || chosen.length === 0}>
              <Download className="size-3.5" /> Download Excel
            </Button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-5">
        {filters && f && (
          <section className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Filters</p>
            <CaseFilterPanel value={f} onChange={setF} facets={filters.facets} hide={filters.hide} defaultOpen />
          </section>
        )}

        <section className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Columns</p>
          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : loading && sheets.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted py-6 justify-center"><Loader2 className="size-4 animate-spin" /> Loading…</div>
          ) : !sheet ? (
            <p className="text-sm text-muted">Nothing to export.</p>
          ) : (
            <>
              {sheets.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {sheets.map((s, i) => (
                    <button
                      key={s.name} type="button" onClick={() => { setActiveSheet(i); setColSearch(""); }}
                      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                        i === activeSheet ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-surface-2",
                        !sheetOn(s.name) && "opacity-50")}
                    >
                      <input
                        type="checkbox" className="size-3 rounded" checked={sheetOn(s.name)}
                        onClick={(e) => e.stopPropagation()} onChange={() => toggleSheet(s.name)} title="Include this sheet"
                      />
                      {s.name} <span className="text-muted">({s.rows.length})</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted" />
                  <input
                    value={colSearch} onChange={(e) => setColSearch(e.target.value)} placeholder="Find a column…"
                    className="h-8 w-52 rounded-md border border-border bg-surface pl-8 pr-2 text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => setAll(sheet.name, sheet.headers, true)}>Select all</button>
                <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setAll(sheet.name, sheet.headers, false)}>Select none</button>
                <span className="ml-auto text-xs text-muted">{selectedCols} of {sheet.headers.length} selected</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 max-h-64 overflow-y-auto rounded-lg border border-border p-3">
                {visibleHeaders.map((h) => (
                  <label key={h} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                    <input type="checkbox" className="size-3.5 rounded shrink-0" checked={colOn(sheet.name, h)} onChange={() => toggleCol(sheet.name, h)} />
                    <span className="truncate" title={h}>{h}</span>
                  </label>
                ))}
                {visibleHeaders.length === 0 && <p className="col-span-full text-xs text-muted text-center py-2">No matching columns</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
