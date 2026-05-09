---
title: "Manual Test — payroll-phase-3 (CSV Export)"
status: done
updated: 2026-05-08
created: 2026-05-08
module: payroll
tags: [manual-test, payroll, phase-3, csv-export, nb-NO, excel, pii]
---

# Manual Test — payroll-phase-3

> Branch: `feat/payroll-payroll-phase-2` (combined Phase 2+3 PR) | Worktree: `/home/sxtnl/dev/smartout.ai-payroll-wt-1`
> Prerequisite: a locked payroll period with at least one calculation row (minimum viable: 1 profile, 1 period, status=locked).

---

## Prerequisite: Create or lock a period

If no locked period exists in local Supabase:

1. Log in as admin → `/dashboard/payroll`
2. Create a period if none exists (or use the seeded demo period)
3. Add at least one employee calculation row:
   - Click Beregn (recalculate) on an open period with shift data, OR
   - Manually insert a `payroll.calculation` row via Supabase Studio
4. Lock the period: click "Lås periode" → confirm in modal
5. Verify period badge shows "Låst" before proceeding

---

## Flow 1 — Aggregate export (standard path)

**Goal:** Admin downloads aggregate CSV, opens in Norwegian Excel, verifies format.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as admin → `/dashboard/payroll` | Period list renders without error |
| 2 | Click a locked period row | Opens period detail `/dashboard/payroll/<uuid>` |
| 3 | Click "Eksport" tab | ExportTab renders with "CSV-eksport" heading |
| 4 | Verify variant radio group | "Aggregert" is selected by default |
| 5 | Verify "Inkluder upålitt PII" toggle | Switch is OFF by default |
| 6 | Verify download button state | "Last ned CSV" button is enabled (period is locked) |
| 7 | Verify Nylige eksporter section | Shows loading skeleton then renders list or empty state |
| 8 | Click "Last ned CSV" | Browser download starts (toast "Eksport klar — nedlasting starter.") |
| 9 | Check downloaded filename | Format: `{slug}-{yyyy-mm}-aggregate-{ts}.csv` e.g. `demo-ws-2026-04-aggregate-1715164800.csv` |
| 10 | Open file in Excel (Norwegian locale) | File opens without encoding prompt; columns separated by semicolons, not commas |
| 11 | Inspect first row (header) | Norwegian column names, semicolon-delimited, no extra quotes around numbers |
| 12 | Inspect data rows | Numbers use comma as decimal separator (e.g. `1 234,56`) and period as thousands separator — matches nb-NO locale |
| 13 | Verify personnummer column | Shows last 4 digits only, e.g. `****-1234` |
| 14 | Verify bankkonto column | Masked, e.g. `****1234` |
| 15 | Verify Nylige eksporter updates | List now shows the new export event with timestamp + row count |
| 16 | Verify 1 row per employee | Aggregate variant: one row per profile, not one row per shift |

### Norwegian Excel verification checklist

- [ ] File opens without prompting for encoding (BOM UTF-8 present)
- [ ] Column delimiter is semicolon (`;`), not comma (`,`) — Excel auto-detects from BOM + locale
- [ ] Numbers display with comma decimal (e.g. `3 456,78`), not period decimal (`3456.78`)
- [ ] No `#VALUE!` or garbled characters in any cell
- [ ] Header row in Norwegian (e.g. `Navn`, `Profil-ID`, `Grunnlonn`, `Tillegg`, `Total`)

---

## Flow 2 — Audit export (provenance columns)

**Goal:** Admin downloads audit CSV and verifies rule-level provenance columns are present.

| Step | Action | Expected |
|------|--------|----------|
| 1 | On locked period → Eksport tab | Same as Flow 1 steps 1–3 |
| 2 | Select "Audit (med provenance)" radio | Radio changes to Audit |
| 3 | Click "Last ned CSV" | Download starts |
| 4 | Check filename | Contains `audit` not `aggregate`: `{slug}-{yyyy-mm}-audit-{ts}.csv` |
| 5 | Open in Excel | Same nb-NO formatting as Flow 1 |
| 6 | Verify row count | One row per calculation line (more rows than aggregate for the same period) |
| 7 | Verify provenance columns present | Columns `Regel-ID`, `Tariff-versjon`, `Paragraf` (or their Norwegian equivalents) populated for derived lines |
| 8 | Verify rule_id column | UUID or human-readable rule identifier — not empty for tariff-derived lines |
| 9 | Verify tariff_version column | Version string or date of tariff table used |
| 10 | Verify paragraf column | Tariff paragraph reference (e.g. `§6.1`) for overtime/evening supplement lines |

---

## Flow 3 — Unmasked PII export (confirm dialog + audit emit)

**Goal:** Admin enables unmasked PII, sees confirm dialog, downloads, audit event appears in activity_trail.

| Step | Action | Expected |
|------|--------|----------|
| 1 | On locked period → Eksport tab (as admin) | "Inkluder upålitt PII" switch visible |
| 2 | Click the "Inkluder upålitt PII" switch | Switch does NOT immediately flip ON — UnmaskedConfirmDialog opens instead |
| 3 | Read the dialog | Warning text about raw PII, ShieldAlert icon, explicit consequences |
| 4 | Click "Avbryt" | Dialog closes, switch remains OFF |
| 5 | Click the switch again → dialog opens → click "Bekreft" | Dialog closes, switch flips to ON, badge "Upålitt PII" visible |
| 6 | Click "Last ned CSV" | Download starts with unmasked data |
| 7 | Open CSV | Personnummer column shows full number (e.g. `12345678901`), bankkonto shows full account number |
| 8 | Check Supabase Studio: `payroll.export_event` row | `masked = false` for this export |
| 9 | Check `activity_trail` | Row with `entity_type = 'payroll_export_event'`, event matches `payroll.csv_export_unmasked` in description |
| 10 | Verify two events logged | One `payroll.csv_exported` AND one `payroll.csv_export_unmasked` in activity_trail for this export |

---

## Flow 4 — Locked-period guard (export blocked on open period)

**Goal:** Verify that an open (unlocked) period shows helper text and disables the download button.

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to an OPEN period (status = 'open') | Period detail loads with Beregn + Lås buttons in header |
| 2 | Click Eksport tab | ExportTab renders |
| 3 | Check download button | Button is DISABLED (greyed out) |
| 4 | Check helper text | "Lås perioden først" appears below the download button |
| 5 | Attempt to bypass via API: POST `/api/payroll/export-period` with `period_id` of open period | Returns HTTP 409 with `error: "period_not_locked"` and `detail` field explaining current status |
| 6 | Verify period status in response | `detail` field contains the actual period status (e.g. `"Periode er open — eksport krever låst periode."`) |

---

## Flow 5 — Recent exports list updates after second download

**Goal:** Verify the exports history list reflects each new download.

| Step | Action | Expected |
|------|--------|----------|
| 1 | On locked period → Eksport tab | Recent exports list shows 0 or N items |
| 2 | Download aggregate CSV | List updates: new row at top with current timestamp and row count |
| 3 | Change variant to Audit, download again | New row appears above the previous one |
| 4 | Verify timestamps | Both rows show correct timestamps in nb-NO format (e.g. "8. mai 2026 14:32") |
| 5 | Verify row_count column | Shows the number of rows in each export (aggregate = number of profiles, audit = number of calculation lines) |
| 6 | Verify variant badge | "Aggregert" badge on first, "Audit" badge on second |

---

## Notes for operator

- **Local Supabase required:** Run `npx supabase start` before this test. Do NOT use `op run` wrap for `supabase` commands — see learning "op run corrupts supabase gen types".
- **database.types.ts regen:** If columns appear as `undefined` in TypeScript, run `pnpm gen:types` against local Supabase (not Cloud). The `any` casts in the Phase 3 BFF routes are temporary stubs until regen.
- **Excel locale:** Verify your Excel is set to Norwegian (nb-NO) locale in File → Options → Language. The nb-NO locale auto-selects semicolon as the list separator, which enables BOM-based auto-detection.
- **BOM check:** If you see a garbled first cell (e.g. `ï»¿Navn`), Excel is treating the file as ASCII. Close and re-open selecting UTF-8 encoding, or use "Data → From Text/CSV" with UTF-8 encoding explicitly.
- **Unmasked PII:** Only run Flow 3 against a test workspace with fake personnummer data. Never use production PII in a test environment.
