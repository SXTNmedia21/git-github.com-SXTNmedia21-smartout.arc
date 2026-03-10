---
title: "CSV Column Mapping Implementation Plan"
status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: onboarding
tags: [csv, column-mapping, plan]
---

# CSV Column Mapping Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded CSV column matching in TeamSetupStep with an interactive column mapping dialog where users map CSV columns to Smartout fields, with unmapped columns stored in a JSON field.

**Architecture:** New `CsvMappingDialog` component handles the mapping UI. Column synonym matching provides auto-suggestions. Extended `InviteRow` carries `extraData` for unmapped columns. A migration adds `metadata JSONB` to the `invitation` table for persistence.

**Tech Stack:** React, shadcn/ui Dialog + Select, papaparse (already installed), Supabase migration

**Spec:** `docs/specs/team-csv-mapping-architecture.md`

---

## File Structure

| Action | File                                                                   | Responsibility                               |
| ------ | ---------------------------------------------------------------------- | -------------------------------------------- |
| Create | `apps/web/src/components/dashboard/wizard-steps/csv-column-mapper.tsx` | Mapping dialog component                     |
| Create | `apps/web/src/components/dashboard/wizard-steps/csv-synonyms.ts`       | Column synonym dictionary + auto-match logic |
| Modify | `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx`     | Wire mapping dialog into CSV upload flow     |
| Create | `supabase/migrations/YYYYMMDDHHMMSS_invitation_metadata.sql`           | Add metadata JSONB column to invitation      |
| Modify | `supabase/functions/create-invitation/index.ts`                        | Accept + store metadata field                |

---

## Chunk 1: Column synonym matching + mapping dialog

### Task 1: Column synonym dictionary

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/csv-synonyms.ts`

- [ ] **Step 1: Create the synonym file with types and matching logic**

```typescript
// csv-synonyms.ts

export type MappableField = {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date" | "lookup";
};

export const MAPPABLE_FIELDS: MappableField[] = [
  { key: "firstName", label: "Fornavn", required: true, type: "text" },
  { key: "lastName", label: "Etternavn", required: true, type: "text" },
  { key: "email", label: "E-post", required: true, type: "text" },
  { key: "phone", label: "Telefon", required: false, type: "text" },
  { key: "departmentId", label: "Avdeling", required: false, type: "lookup" },
  { key: "positionId", label: "Stilling", required: false, type: "lookup" },
  { key: "employmentForm", label: "Ansettelsesform", required: false, type: "lookup" },
  { key: "hourlyRate", label: "Timelønn", required: false, type: "number" },
  { key: "startDate", label: "Startdato", required: false, type: "date" },
  { key: "positionPct", label: "Stillingsprosent", required: false, type: "number" },
  { key: "birthDate", label: "Fødselsdato", required: false, type: "date" },
  { key: "address", label: "Adresse", required: false, type: "text" },
];

const SYNONYMS: Record<string, string[]> = {
  firstName: ["fornavn", "first_name", "firstname", "förnamn", "namn", "name"],
  lastName: ["etternavn", "last_name", "lastname", "efternamn", "surname"],
  email: ["e-post", "epost", "email", "mail", "e-mail"],
  phone: ["telefon", "phone", "tlf", "mobil", "mobilnummer", "mob"],
  departmentId: ["avdeling", "department", "dept", "avd"],
  positionId: ["stilling", "position", "rolle", "role", "title", "tittel"],
  employmentForm: ["ansettelsesform", "employment", "anställningsform", "type"],
  hourlyRate: ["timelønn", "lønn", "hourly_rate", "timlön", "lön", "lonn"],
  startDate: ["startdato", "start_date", "startdatum", "tiltredelse"],
  positionPct: ["stillingsprosent", "stillingsandel", "prosent", "pct"],
  birthDate: ["fødselsdato", "birth_date", "født", "dob", "födelsedatum"],
  address: ["adresse", "address", "bosted"],
};

/**
 * Auto-match CSV column headers to Smartout fields.
 * Returns a map: csvHeader → fieldKey (or "_skip").
 */
export function autoMatchColumns(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header
      .trim()
      .toLowerCase()
      .replace(/[^a-zæøåäöü0-9_]/g, "");
    let matched = false;

    for (const [fieldKey, synonyms] of Object.entries(SYNONYMS)) {
      if (usedFields.has(fieldKey)) continue;
      if (synonyms.includes(normalized)) {
        mapping[header] = fieldKey;
        usedFields.add(fieldKey);
        matched = true;
        break;
      }
    }

    if (!matched) {
      mapping[header] = "_skip";
    }
  }

  return mapping;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /home/sxtnl/dev/reset_wizzard && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | grep csv-synonyms || echo "No errors for csv-synonyms"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/csv-synonyms.ts
git commit -m "feat(wizard): add CSV column synonym dictionary and auto-match logic"
```

---

### Task 2: CsvMappingDialog component

**Files:**

- Create: `apps/web/src/components/dashboard/wizard-steps/csv-column-mapper.tsx`

- [ ] **Step 1: Create the mapping dialog component**

```tsx
// csv-column-mapper.tsx
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
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /home/sxtnl/dev/reset_wizzard && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | grep csv-column-mapper || echo "No errors for csv-column-mapper"`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/csv-column-mapper.tsx
git commit -m "feat(wizard): add CsvMappingDialog component with auto-match and preview"
```

---

## Chunk 2: Wire into TeamSetupStep + migration

### Task 3: Extend InviteRow and refactor CSV upload in TeamSetupStep

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx`

- [ ] **Step 1: Add new fields to InviteRow type and createEmptyRow**

At top of file, replace the `InviteRow` type and `createEmptyRow`:

```typescript
type InviteRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  employmentForm: string;
  positionId: string;
  hourlyRate: number;
  startDate: string;
  positionPct: number;
  birthDate: string;
  address: string;
  extraData: Record<string, string>;
  status: "pending" | "sending" | "sent" | "error";
  validationErrors: string[];
};

function createEmptyRow(): InviteRow {
  return {
    id: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    employmentForm: "",
    positionId: "",
    hourlyRate: 0,
    startDate: "",
    positionPct: 0,
    birthDate: "",
    address: "",
    extraData: {},
    status: "pending",
    validationErrors: [],
  };
}
```

- [ ] **Step 2: Add mapping dialog state and imports**

Add imports at top:

```typescript
import { CsvMappingDialog } from "@/components/dashboard/wizard-steps/csv-column-mapper";
import { MAPPABLE_FIELDS } from "@/components/dashboard/wizard-steps/csv-synonyms";
```

Add state inside `TeamSetupStep` component:

```typescript
const [csvMappingOpen, setCsvMappingOpen] = useState(false);
const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
const [csvRawRows, setCsvRawRows] = useState<Record<string, string>[]>([]);
```

- [ ] **Step 3: Replace handleCsvUpload to open mapping dialog instead of auto-mapping**

Replace the `handleCsvUpload` callback (lines ~458-546) with:

```typescript
const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    complete: (results) => {
      if (results.data.length === 0) {
        toast.error("Ingen rader funnet i CSV-filen");
        return;
      }
      const headers = results.meta.fields ?? [];
      if (headers.length === 0) {
        toast.error("Ingen kolonner funnet i CSV-filen");
        return;
      }
      setCsvHeaders(headers);
      setCsvRawRows(results.data);
      setCsvMappingOpen(true);
    },
    error: () => {
      toast.error("Kunne ikke lese CSV-filen");
    },
  });

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
}, []);
```

- [ ] **Step 4: Add handleMappingConfirm callback**

Add after `handleCsvUpload`:

```typescript
const handleMappingConfirm = useCallback(
  (mapping: Record<string, string>) => {
    const csvRows: InviteRow[] = csvRawRows
      .filter((row) => {
        // At least one mapped required field must have data
        const hasData = Object.entries(mapping).some(([header, fieldKey]) => {
          const field = MAPPABLE_FIELDS.find((f) => f.key === fieldKey);
          return field?.required && row[header]?.trim();
        });
        return hasData;
      })
      .map((row) => {
        const newRow = createEmptyRow();
        const extraData: Record<string, string> = {};

        for (const [header, fieldKey] of Object.entries(mapping)) {
          const value = row[header]?.trim() ?? "";
          if (!value) continue;

          if (fieldKey === "_skip") {
            extraData[header] = value;
            continue;
          }

          switch (fieldKey) {
            case "firstName":
              newRow.firstName = value;
              break;
            case "lastName":
              newRow.lastName = value;
              break;
            case "email":
              newRow.email = value;
              break;
            case "phone":
              newRow.phone = value;
              break;
            case "departmentId":
              newRow.departmentId = deptNameMap.get(value.toLowerCase()) ?? "";
              break;
            case "positionId": {
              const posId = posNameMap.get(value.toLowerCase()) ?? "";
              newRow.positionId = posId;
              if (posId) {
                newRow.hourlyRate = positionWageMap.get(posId) ?? 0;
              }
              break;
            }
            case "employmentForm":
              newRow.employmentForm = value;
              break;
            case "hourlyRate":
              newRow.hourlyRate = parseFloat(value) || 0;
              break;
            case "startDate":
              newRow.startDate = value;
              break;
            case "positionPct":
              newRow.positionPct = parseFloat(value) || 0;
              break;
            case "birthDate":
              newRow.birthDate = value;
              break;
            case "address":
              newRow.address = value;
              break;
            default:
              extraData[header] = value;
          }
        }

        newRow.extraData = extraData;
        newRow.validationErrors = validateRow(newRow);
        return newRow;
      });

    if (csvRows.length === 0) {
      toast.error("Ingen gyldige rader funnet i CSV-filen");
      setCsvMappingOpen(false);
      return;
    }

    setRows((prev) => {
      const nonEmpty = prev.filter(
        (r) => r.firstName.trim() || r.lastName.trim() || r.email.trim(),
      );
      return [...nonEmpty, ...csvRows];
    });

    const errorCount = csvRows.filter((r) => r.validationErrors.length > 0).length;
    if (errorCount > 0) {
      toast.warning(`${csvRows.length} rader importert, ${errorCount} med valideringsfeil`);
    } else {
      toast.success(`${csvRows.length} rader importert fra CSV`);
    }

    setCsvMappingOpen(false);
  },
  [csvRawRows, deptNameMap, posNameMap, positionWageMap],
);
```

- [ ] **Step 5: Add CsvMappingDialog to the render**

Add just before the closing `</div>` of the component return:

```tsx
<CsvMappingDialog
  open={csvMappingOpen}
  onOpenChange={setCsvMappingOpen}
  isDark={isDark}
  csvHeaders={csvHeaders}
  csvPreviewRows={csvRawRows.slice(0, 3)}
  onConfirm={handleMappingConfirm}
/>
```

- [ ] **Step 6: Update handleSend to include extraData in invitation metadata**

In the `handleSend` function, update the body sent to `create-invitation` (line ~583-595):

```typescript
body: {
  workspace_id: workspace.workspace_id,
  company_id: workspace.company_id,
  invites: [
    {
      email: row.email.trim(),
      first_name: row.firstName.trim(),
      last_name: row.lastName.trim(),
      role: "employee",
      department_ids: row.departmentId ? [row.departmentId] : undefined,
      metadata: Object.keys(row.extraData).length > 0 ? row.extraData : undefined,
    },
  ],
},
```

- [ ] **Step 7: Verify typecheck passes**

Run: `cd /home/sxtnl/dev/reset_wizzard && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | tail -5`

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx
git commit -m "feat(wizard): wire CsvMappingDialog into TeamSetupStep CSV upload flow"
```

---

### Task 4: Database migration — add metadata to invitation

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_invitation_metadata.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add metadata JSONB column to invitation table for storing
-- unmapped CSV import data and other structured metadata.
ALTER TABLE invitation
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN invitation.metadata IS
  'Structured metadata from CSV import or other sources. Unmapped CSV columns stored here.';
```

Use current timestamp for filename, e.g. `20260310120000_invitation_metadata.sql`.

- [ ] **Step 2: Apply migration locally**

Run: `cd /home/sxtnl/dev/reset_wizzard && npx supabase db push --local 2>&1 | tail -5`

If supabase is not running, run: `npx supabase migration up --local`

- [ ] **Step 3: Regenerate types**

Run: `cd /home/sxtnl/dev/reset_wizzard && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*_invitation_metadata.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add metadata JSONB column to invitation table"
```

---

### Task 5: Update create-invitation Edge Function to accept metadata

**Files:**

- Modify: `supabase/functions/create-invitation/index.ts`

- [ ] **Step 1: Add metadata to batch invite records**

In `handleBatchInvites` function (~line 76-88), add metadata to the insert:

```typescript
const recordsToInsert = invites.map((inv) => ({
  workspace_id,
  company_id,
  email: inv.email as string,
  first_name: inv.first_name as string | undefined,
  last_name: inv.last_name as string | undefined,
  role: (inv.role as string) || "employee",
  department_ids: inv.department_ids || [],
  team_ids: inv.team_ids || [],
  status: "pending",
  invite_type: "email",
  invited_by: inviterProfile.profile_id,
  metadata: inv.metadata ?? null,
}));
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/create-invitation/index.ts
git commit -m "feat(edge): accept metadata field in create-invitation batch mode"
```

---

## Chunk 3: Update pre-fill from extracted employees

### Task 6: Fix extractedEmployees pre-fill for new InviteRow shape

**Files:**

- Modify: `apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx`

- [ ] **Step 1: Update the pre-fill useEffect for extractedEmployees**

The existing pre-fill effect (lines ~382-421) maps extracted employees to InviteRow. Update to include the new fields with defaults:

In the `mapped` function inside the useEffect, the `row` object needs `startDate`, `positionPct`, `birthDate`, `address`, `extraData` fields. Since `createEmptyRow()` already has these defaults, change the pre-fill to spread from `createEmptyRow()`:

```typescript
const mapped: InviteRow[] = extractedEmployees.map((emp) => {
  const departmentId = emp.department ? (deptNameMap.get(emp.department.toLowerCase()) ?? "") : "";
  const positionId = emp.position ? (posNameMap.get(emp.position.toLowerCase()) ?? "") : "";
  const hourlyRate = positionId ? (positionWageMap.get(positionId) ?? 0) : 0;

  const row: InviteRow = {
    ...createEmptyRow(),
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email ?? "",
    phone: emp.phone ?? "",
    departmentId,
    positionId,
    hourlyRate,
  };
  row.validationErrors = validateRow(row);
  return row;
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /home/sxtnl/dev/reset_wizzard && pnpm --filter web exec tsc --noEmit --pretty 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/wizard-steps/TeamSetupStep.tsx
git commit -m "fix(wizard): update extractedEmployees pre-fill for extended InviteRow"
```

---

## Summary

| Task | What                           | Files                                 |
| ---- | ------------------------------ | ------------------------------------- |
| 1    | Column synonyms + auto-match   | `csv-synonyms.ts` (new)               |
| 2    | CsvMappingDialog component     | `csv-column-mapper.tsx` (new)         |
| 3    | Wire into TeamSetupStep        | `TeamSetupStep.tsx` (modify)          |
| 4    | Migration: metadata column     | migration SQL + regen types           |
| 5    | Edge Function: accept metadata | `create-invitation/index.ts` (modify) |
| 6    | Fix pre-fill for new shape     | `TeamSetupStep.tsx` (modify)          |

Tasks 1-2 are independent. Task 3 depends on 1+2. Task 4-5 are independent of 1-3. Task 6 depends on 3.
