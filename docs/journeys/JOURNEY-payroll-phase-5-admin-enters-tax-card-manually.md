---
title: "Journey — Admin enters tax card manually"
journey: payroll-phase-5-admin-enters-tax-card-manually
spec: docs/plans/PLAN-payroll-phase-5.md
status: verified
updated: 2026-05-08
created: 2026-05-08
module: payroll
roles: [admin]
tags: [journey, payroll, phase-5, tax-card, manual-entry, lonnsprofil, audit]
---

# Journey: Admin enters tax card manually

**Role:** admin

**Context:** Smartout does NOT fetch tax-card data from Skatteetaten. ADR-0250 stays `status: deferred`. Tax-card data enters `employee_payroll_profile` via two paths only: (1) manual admin entry via the LonnsprofilSection form (this journey), or (2) Tripletex push-sync (Phase 7, not yet built). This form is the only active path.

**Precondition:**

- Admin logged in on web dashboard
- Admin navigates to `/dashboard/people/[id]/complete-data`
- `employee_payroll_profile` row exists for the target employee (created during onboarding)
- `isAdminMode = true` from DashboardContext — tax-card fields are editable only for admins
- No active Tripletex sync (payroll_sync_status = "not_synced" or "divergent")

## Happy Path — percentage tax card

1. Admin navigates to `/dashboard/people/{employee-uuid}/complete-data`
   → `HrTabSections.tsx` loads; `isAdminMode` read from DashboardContext (HrTabSections.tsx:1300)
   → `LonnsprofilSection` mounted with `isAdmin={isAdminMode}` (HrTabSections.tsx:1385-1389)
   → Section renders in VIEW mode (not editing)

2. Admin clicks "Rediger" button in the Lønnsprofil card header
   → `handleEdit()` fires (LonnsprofilSection.tsx:275-299)
   → `originalEditRef.current` captured (preserves rollback state)
   → `editing = true`; form fields become editable

3. Admin locates the "Skattekort" subsection (LonnsprofilSection.tsx:693-863)
   → Section heading "Skattekort" with "Manuell inntasting" badge visible (LonnsprofilSection.tsx:704-711)
   → "Skattekorttype" dropdown visible in edit mode (LonnsprofilSection.tsx:732-747)
   → `data-testid="edit-tax_card_type"` on the select element

4. Admin selects "Trekkprosent" from Skattekorttype dropdown
   → `setEditTaxCardType("percentage")` (LonnsprofilSection.tsx:736)
   → "Trekkprosent (%)" field appears (conditional at LonnsprofilSection.tsx:816-850) with `data-testid="edit-tax_percentage"`
   → "Skattetabellnummer" field does NOT appear (only visible when type = "table")

5. Admin fills in:
   - Kortår: "2026" (LonnsprofilSection.tsx:766-780, `data-testid="edit-tax_card_year"`)
   - Trekkprosent: "35.5" (LonnsprofilSection.tsx:824-835, `data-testid="edit-tax_percentage"`)

6. Admin clicks "Lagre"
   → `handleSave()` fires (LonnsprofilSection.tsx:341)
   → `isAdmin = true`, so `validateTaxFields()` runs (LonnsprofilSection.tsx:342-348)
   → Validation: `anyTaxSet = true` (type is set), year 2026 is valid (2024–2035), percentage 35.5 is valid (0–100)
   → No validation errors
   → `taxChanged = true` (type + percentage differ from `originalEditRef.current`)
   → `upsertLonnsprofil({ profile_id, contract_id, salary_type: "hourly", pension_scheme_id, tax_card_type: "percentage", tax_table_number: null, withholding_pct: 35.5, tax_card_year: 2026 })` (LonnsprofilSection.tsx:360-371)

7. Server Action `upsertLonnsprofil` executes:
   → Writes to `employee_payroll_profile` (tax_card_type, tax_percentage, tax_card_year columns)
   → Sets `tax_card_fetched_at = now()` (marks row as freshly entered)
   → Writes via `update_payroll_profile` capability tool path (gated mutation, ADR-0204)
   → `payroll.update_payroll_profile` telemetry event emitted → `posthog + logger + activity_trail + engine_event`

8. `upsertLonnsprofil` returns `{ ok: true }`
   → Local state updated optimistically: `data.tax_card_type = "percentage"`, `tax_percentage = 35.5`, `tax_card_year = 2026`, `tax_card_fetched_at = <now>` (LonnsprofilSection.tsx:393-408)
   → `toast.success("Lønnsprofil oppdatert")` (LonnsprofilSection.tsx:463)
   → `editing = false` (LonnsprofilSection.tsx:464)

9. Admin verifies: Skattekort section now shows in VIEW mode:
   - Skattekorttype: "Trekkprosent"
   - Trekkprosent: "35.5 %"
   - Kortår: "2026"
   - Sist oppdatert: timestamp showing save time

**Postcondition:**

- `employee_payroll_profile` row: `tax_card_type = "percentage"`, `tax_percentage = 35.5`, `tax_card_year = 2026`, `tax_card_fetched_at = <timestamp>`
- `activity_trail` row from `payroll.update_payroll_profile` emit
- Recalc trigger: does NOT fire if the current period is locked (ADR-0251). If the period is open, the upsertLonnsprofil path may trigger recalc via ADR-0293 Pattern B sync-recalc-chain (best-effort; does not block save)

## Happy Path variant — table-based tax card

Steps 1-3 same. At step 4:
- Admin selects "Trekktabell" from Skattekorttype dropdown
- "Skattetabellnummer" field appears (LonnsprofilSection.tsx:789-813, `data-testid="edit-tax_table_number"`)
- "Trekkprosent" field does NOT appear
- Admin fills in Skattetabellnummer: "7100" and Kortår: "2026"
- Validation at step 6: `type = "table"`, regex `/^\d{4}$/` must match — "7100" passes

## Happy Path variant — frikort

- Admin selects "Frikort" from Skattekorttype dropdown
- Neither Trekkprosent nor Skattetabellnummer field appears
- Only Kortår is required (must be 2024–2035)
- Result: `tax_card_type = "freecard"`, `tax_percentage = null`, `tax_table_number = null`

## Known limitation — `tax_municipality_code` field absent

The `update_payroll_profile` capability tool schema (TB2) includes `tax_municipality_code` as a fifth optional tax field. However, `tax_municipality_code` is absent from the LonnsprofilSection form because the field does not appear in `database.types.ts` type-gen output (type-gen lag as of 2026-05-08). The field exists in the database schema and the capability tool schema, but the UI form omits it. Impact: municipality code cannot be entered via this form until `database.types.ts` is regenerated with the column included. Workaround: direct DB insert via Supabase Studio for dev. Flag for TG (Phase 5 closure): tracked as carry-forward in HANDOFF-payroll-phase-5.md.

## Error Paths

- **Tax type = percentage, percentage field empty or invalid:** `validateTaxFields()` adds "Trekkprosent (0–100) er påkrevd ved prosent-skattekort" (LonnsprofilSection.tsx:328-330) → `taxErrors` state renders error banner (LonnsprofilSection.tsx:718-726) → save blocked
- **Tax type = table, table number not 4 digits:** adds "Skattetabellnummer må være 4 sifre ved tabellskattekort" (LonnsprofilSection.tsx:331-334)
- **Year out of range:** validation checks `year < 2024 || year > 2035` (LonnsprofilSection.tsx:323-325) → error: "Kortår (årstall) er påkrevd ved skattekortendring (2024–2035)"
- **Server Action fails:** `upsertLonnsprofil` returns `{ ok: false, error: "..." }` → `toast.error(result.error)` (LonnsprofilSection.tsx:466)
- **Non-admin user (manager/employee):** tax-card fields render in read-only mode regardless of editing state (LonnsprofilSection.tsx:732 `editing && isAdmin` guard) — no form fields visible, no save path for tax fields
- **Locked period:** the `upsertLonnsprofil` write succeeds (it writes to `employee_payroll_profile`, not to a locked `payroll.calculation` row). The recalc trigger best-effort fires, but if the period is locked, the recalc is a no-op per ADR-0251 immutability.

## Verification — file:line references

| Step | Implementation |
|------|----------------|
| HrTabSections mounts LonnsprofilSection with isAdmin | `apps/web/src/app/dashboard/people/[id]/complete-data/HrTabSections.tsx:1385-1389` |
| isAdminMode from DashboardContext | `HrTabSections.tsx:1300` |
| Lønnsprofil "Rediger" button | `apps/web/src/app/dashboard/people/[id]/_components/LonnsprofilSection.tsx:494-501` |
| handleEdit() | `LonnsprofilSection.tsx:275-299` |
| Skattekort section heading | `LonnsprofilSection.tsx:693-716` |
| Skattekorttype select (admin edit) | `LonnsprofilSection.tsx:732-747` (data-testid="edit-tax_card_type") |
| Kortår input | `LonnsprofilSection.tsx:766-780` (data-testid="edit-tax_card_year") |
| Skattetabellnummer input (type=table) | `LonnsprofilSection.tsx:793-811` (data-testid="edit-tax_table_number") |
| Trekkprosent input (type=percentage) | `LonnsprofilSection.tsx:824-835` (data-testid="edit-tax_percentage") |
| validateTaxFields() | `LonnsprofilSection.tsx:316-339` |
| Validation error banner | `LonnsprofilSection.tsx:718-726` |
| handleSave() → taxChanged → upsertLonnsprofil | `LonnsprofilSection.tsx:341-468` |
| upsertLonnsprofil Server Action path | `apps/web/src/app/dashboard/people/[id]/_actions/employment-contract-actions.ts` |
| Sist oppdatert display | `LonnsprofilSection.tsx:852-860` |
| Known limitation: tax_municipality_code absent | No UI field — see HANDOFF-payroll-phase-5.md carry-forward |
