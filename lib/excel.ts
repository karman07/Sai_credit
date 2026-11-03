/** Builds real .xlsx workbooks in the browser and triggers a download. exceljs is loaded on demand. */
export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

/** dd/mm/yyyy for any date-ish value, "" when missing/invalid — keeps exports readable in Excel. */
export function xlDate(d?: string | Date | null): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-IN");
}

export async function downloadXlsxSheets(sheets: XlsxSheet[], filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();

  for (const s of sheets) {
    const sheet = wb.addWorksheet(s.name.replace(/[\\/*?:[\]]/g, " ").slice(0, 31) || "Sheet");
    sheet.addRow(s.headers).font = { bold: true };
    s.rows.forEach((r) => sheet.addRow(r));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((col, i) => {
      const longest = Math.max(s.headers[i]?.length ?? 0, ...s.rows.map((r) => String(r[i] ?? "").length));
      col.width = Math.min(Math.max(longest + 2, 10), 50);
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadXlsx(sheetName: string, headers: string[], rows: (string | number)[][], filename: string) {
  return downloadXlsxSheets([{ name: sheetName, headers, rows }], filename);
}

/** Union of custom-field keys (Form Builder fields) across records, so each becomes its own column. */
export function customKeys(items: { customFields?: Record<string, any> }[]): string[] {
  return [...new Set(items.flatMap((i) => Object.keys(i.customFields ?? {})))];
}

/** Flattens any stored value (string, number, object, array) into a single spreadsheet cell. */
export function xlCell(v: unknown): string | number {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map((x) => String(xlCell(x))).join(", ");
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

export const stampedName = (base: string) => `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`;
