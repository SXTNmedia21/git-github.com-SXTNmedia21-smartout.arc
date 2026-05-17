---
title: "Journey — payroll-admin-tariff-page"
status: verified
feature: admin-tariff-page
updated: 2026-05-17
created: 2026-05-17
module: web
tags: [journey, payroll, admin, tariff, dashboard, phase-7e, page-polish]
---

# Journey — payroll-admin-tariff-page

> Phase 7e Track 3. Admin dashboard page for tariff management.

## Journey: Admin views current tariff binding

**Precondition:** Admin authenticated, route `/dashboard/payroll/tariff`.

1. Server shell renders Suspense skeleton
2. Client `TariffClient` mounts, view-emits `payroll.tariff_view_loaded` (currently no-op until registry entry lands)
3. `useCurrentTariff()` TanStack Query fetches GET `/api/payroll/tariff/current` (5-min stale)
4. `CurrentBindingCard` renders union + law_version + effective_from + paragraf references
5. **Empty state**: `is_bound=false` → dashed-border card explaining bransjenorm default

**Postcondition:** Admin sees authoritative binding state with paragraf citations.

**Error paths:** BFF error → inline error card with Norwegian copy.

## Journey: Admin switches tariff binding

**Precondition:** Existing binding active.

1. Admin opens `ChangeBindingForm` (admin-only)
2. Picks new union + law_version + provides reason
3. Submits → POST `/api/payroll/tariff/change`
4. On 200 → toast success + TanStack Query invalidates `tariffKeys.current` → re-fetch
5. `BindingHistoryList` updates with prior binding's effective_to

**Error paths:** AMENDMENT_BLOCKED (ENDRINGSOPPSIGELSE) → inline form error explaining re-signing requirement + Aml. §15-7 ref.

## Journey: Manager adds workspace supplement

**Precondition:** Workspace tariff-bound, manager-or-admin role.

1. `AddSupplementForm` shows 14 supplement_type options + rate selector + rate_type picker
2. Manager fills → submits → POST `/api/payroll/tariff/supplement`
3. PostgreSQL tariff-floor trigger validates → BFF returns success or floor error
4. Below-floor error: inline form error shows `{floor}`, `{proposed}`, `{aml_ref}` with §14-15 explanation

**Postcondition:** supplement_rule row created OR explicit guidance shown.

## Page polish (ADR-0357) — 7/8 PASS

| Phase | Status |
|---|---|
| (a) site-map entry `/dashboard/payroll/tariff` | PASS |
| (b) page header + description | PASS |
| (c) page instructions | PASS |
| (d) telemetry view-emit `payroll.tariff_view_loaded` | FLAGGED — registry entry pending |
| (e) skeleton loaders | PASS |
| (f) empty state | PASS |
| (g) tool descriptions (3 tools + 5 Norwegian intents) | PASS |
| (h) reduced motion gate on animate-* | PASS |

## Contract gap

`SupplementType` + `RateType` not re-exported by name from `@smartout/types` — derived locally via `z.infer<typeof rateTypeSchema>`. Phase 7g should add named exports.
