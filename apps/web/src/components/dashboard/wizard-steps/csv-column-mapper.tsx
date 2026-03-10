"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowRight, FileSpreadsheet, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAPPABLE_FIELDS, autoMatchColumns } from "./csv-synonyms";

type CsvMappingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  csvHeaders: string[];
  csvPreviewRows: Record<string, string>[];
  onConfirm: (mapping: Record<string, string>) => void;
};

export function CsvMappingDialog({
  open,
  onOpenChange,
  isDark,
  csvHeaders,
  csvPreviewRows,
  onConfirm,
}: CsvMappingDialogProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    autoMatchColumns(csvHeaders),
  );

  const handleFieldChange = useCallback((csvHeader: string, fieldKey: string) => {
    setMapping((prev) => {
      const next = { ...prev };

      // If another column already maps to this field, reset it to _skip
      if (fieldKey !== "_skip") {
        for (const [header, key] of Object.entries(next)) {
          if (key === fieldKey && header !== csvHeader) {
            next[header] = "_skip";
          }
        }
      }

      next[csvHeader] = fieldKey;
      return next;
    });
  }, []);

  const requiredFieldsMapped = useMemo(() => {
    const mappedKeys = new Set(Object.values(mapping));
    return MAPPABLE_FIELDS.filter((f) => f.required).every((f) => mappedKeys.has(f.key));
  }, [mapping]);

  const missingRequired = useMemo(() => {
    const mappedKeys = new Set(Object.values(mapping));
    return MAPPABLE_FIELDS.filter((f) => f.required && !mappedKeys.has(f.key));
  }, [mapping]);

  const mappedCount = useMemo(
    () => Object.values(mapping).filter((v) => v !== "_skip").length,
    [mapping],
  );

  const skippedCount = useMemo(
    () => Object.values(mapping).filter((v) => v === "_skip").length,
    [mapping],
  );

  // Build preview table columns: only mapped fields
  const previewColumns = useMemo(() => {
    const cols: { csvHeader: string; fieldLabel: string }[] = [];
    for (const [csvHeader, fieldKey] of Object.entries(mapping)) {
      if (fieldKey === "_skip") continue;
      const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);
      if (field) cols.push({ csvHeader, fieldLabel: field.label });
    }
    return cols;
  }, [mapping]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-2xl ${isDark ? "border-zinc-800 bg-zinc-950" : ""}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-orange-500" />
            Koble kolonner
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Column mapping list */}
          <div className="space-y-2">
            <p className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Koble CSV-kolonner til riktig felt. Kolonner som hoppes over lagres som ekstradata.
            </p>

            <div
              className={`overflow-hidden rounded-xl border ${
                isDark ? "border-zinc-800" : "border-zinc-200"
              }`}
            >
              {/* Header */}
              <div
                className={`grid grid-cols-[1fr_32px_1fr] items-center gap-2 px-4 py-2 text-xs font-semibold tracking-wider uppercase ${
                  isDark ? "bg-zinc-900/70 text-zinc-500" : "bg-zinc-50 text-zinc-400"
                }`}
              >
                <span>CSV-kolonne</span>
                <span />
                <span>Smartout-felt</span>
              </div>

              {/* Rows */}
              {csvHeaders.map((header) => (
                <div
                  key={header}
                  className={`grid grid-cols-[1fr_32px_1fr] items-center gap-2 border-t px-4 py-2.5 ${
                    isDark ? "border-zinc-800" : "border-zinc-200"
                  }`}
                >
                  <span
                    className={`truncate text-sm font-medium ${
                      isDark ? "text-zinc-300" : "text-zinc-700"
                    }`}
                  >
                    {header}
                  </span>
                  <ArrowRight className={`h-4 w-4 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
                  <Select
                    value={mapping[header] ?? "_skip"}
                    onValueChange={(v) => handleFieldChange(header, v)}
                  >
                    <SelectTrigger
                      className={`h-8 text-sm ${
                        mapping[header] === "_skip"
                          ? isDark
                            ? "border-zinc-700 text-zinc-500"
                            : "border-zinc-200 text-zinc-400"
                          : isDark
                            ? "border-orange-500/40 text-orange-300"
                            : "border-orange-300 text-orange-700"
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">-- Hopp over --</SelectItem>
                      {MAPPABLE_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Missing required fields warning */}
          {missingRequired.length > 0 && (
            <div
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                isDark ? "bg-red-950/30 text-red-400" : "bg-red-50 text-red-600"
              }`}
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Obligatoriske felt mangler mapping:{" "}
                <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>
              </span>
            </div>
          )}

          {/* Preview */}
          {previewColumns.length > 0 && csvPreviewRows.length > 0 && (
            <div className="space-y-2">
              <p className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Forhåndsvisning ({csvPreviewRows.length} første rader)
              </p>
              <div
                className={`overflow-x-auto rounded-lg border text-xs ${
                  isDark ? "border-zinc-800" : "border-zinc-200"
                }`}
              >
                <table className="w-full">
                  <thead>
                    <tr
                      className={
                        isDark ? "bg-zinc-900/70 text-zinc-500" : "bg-zinc-50 text-zinc-400"
                      }
                    >
                      {previewColumns.map((col) => (
                        <th key={col.csvHeader} className="px-3 py-1.5 text-left font-semibold">
                          {col.fieldLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
                      >
                        {previewColumns.map((col) => (
                          <td
                            key={col.csvHeader}
                            className={`px-3 py-1.5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}
                          >
                            {row[col.csvHeader] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stats */}
          <p className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            {mappedCount} kolonner mappet, {skippedCount} hoppes over
            {skippedCount > 0 && " (lagres som ekstradata)"}
          </p>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              isDark
                ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
          >
            Avbryt
          </button>
          <button
            onClick={() => onConfirm(mapping)}
            disabled={!requiredFieldsMapped}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
              requiredFieldsMapped
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "cursor-not-allowed bg-orange-500 text-white opacity-50"
            }`}
          >
            Importer {csvPreviewRows.length > 3 ? `alle rader` : `${csvPreviewRows.length} rader`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
