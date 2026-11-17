"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./ui";
import { ExportDialog } from "./ExportDialog";
import type { FilterHide } from "./CaseFilterPanel";
import type { XlsxSheet } from "../lib/excel";
import type { CaseFacets, CaseFilters } from "../lib/caseFilters";

/**
 * "Export" button for any list. Opens the export dialog (column picker, optional filters) and downloads
 * the sheets returned by `loadSheets` — build them with the helpers in lib/exportSheets.ts or by hand.
 */
export function ExportButton({
  loadSheets, filename, storageKey, label = "Export Excel", title, filters,
}: {
  loadSheets: (filters?: CaseFilters) => Promise<XlsxSheet[]>;
  filename: string;
  storageKey: string;
  label?: string;
  title?: string;
  filters?: { initial: CaseFilters; facets: CaseFacets; hide?: FilterHide[] };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Download className="size-3.5" /> {label}
      </Button>
      <ExportDialog open={open} onClose={() => setOpen(false)} title={title} filename={filename} storageKey={storageKey} loadSheets={loadSheets} filters={filters} />
    </>
  );
}
