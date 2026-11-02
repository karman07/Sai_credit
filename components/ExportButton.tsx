"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button, useToast } from "./ui";

/**
 * "Export" button for any list. `onExport` builds and downloads the workbook (see lib/excel.ts)
 * and may return a row count for the success toast; errors surface as a toast.
 */
export function ExportButton({ onExport, label = "Export Excel" }: { onExport: () => Promise<number | void>; label?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const n = await onExport();
      toast("success", typeof n === "number" ? `Exported ${n} row${n !== 1 ? "s" : ""} to Excel` : "Excel file exported");
    } catch (e: any) {
      toast("error", e?.message ?? "Failed to export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={run} loading={busy}>
      <Download className="size-3.5" /> {label}
    </Button>
  );
}
