// packages/utils/src/spreadsheet/index.ts
// Sortie A: CSV-only (papaparse). xlsx adoption deferred to Sortie B per ADR-0402.
import Papa from "papaparse";

export type SheetRow = Record<string, string>;

export type Sheet = {
  name: string;
  headers: string[];
  rows: SheetRow[];
};

export type ParseCsvOptions = {
  sheetName: string;
};

export function parseCsv(input: string, options: ParseCsvOptions): Sheet[] {
  if (!input || input.length === 0) {
    throw new Error("parseCsv: input is empty");
  }

  const parsed = Papa.parse<SheetRow>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const first = parsed.errors[0]!;
    throw new Error(`parseCsv: ${first.type} at row ${first.row}: ${first.message}`);
  }

  const headers = parsed.meta.fields ?? [];
  const rows = parsed.data;

  if (rows.length === 0) {
    throw new Error("parseCsv: no data rows (header-only input)");
  }

  return [{ name: options.sheetName, headers, rows }];
}
