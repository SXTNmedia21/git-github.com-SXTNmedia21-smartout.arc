---
title: "Journey — Admin configures EHF billing settings"
status: verified
feature: billing-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, billing, polish, campaign-ui-shell]
---

# Journey — Admin configures EHF billing settings

> Sub-sortie: `ui-shell-billing-polish`. Secondary journey covering `/dashboard/billing/settings`.

## Journey: Admin navigates to billing settings and enables EHF (electronic invoicing)

**Precondition:** Admin signed in, on `/dashboard/billing` or directly at `/dashboard/billing/settings`. Company has an org number registered (required for EHF). Admin holds `admin` or `owner` role in the workspace.

1. Admin clicks "Innstillinger" (settings link/tab on billing overview) → browser navigates to `/dashboard/billing/settings`
2. Route streams via Suspense → `loading.tsx` shows header skeleton + form-field skeletons aligned with Nordic Split tokens → no layout shift
3. `openBillingSettings` Botsson tool and page Server Component both load current EHF settings for the company from Supabase
4. Page header renders — `font-heading` h1 "Faktureringsinnstillinger" + Norwegian page instructions explaining EHF and what the toggle controls
5. EHF form section renders — toggle "Aktiver EHF-fakturering" + org number display field (read-only, sourced from `company.org_number`) + optional EHF reference field
6. Admin toggles EHF on → form state updates → "Lagre" button becomes active
7. Admin clicks "Lagre" → `updateCompanyEhfSettings` Server Action fires:
   - Validates input with Zod (org number format, reference max-length)
   - Resolves `workspace_id` and `actor_id` from server session (ADR-0151)
   - Reads before-snapshot of current EHF settings (ADR-0204 audit requirement)
   - Updates `company.ehf_enabled` (and optional reference) in Supabase via service role
   - Calls `emit('company.ehf_settings_updated', { workspace_id, actor_id, ... })` — routes to PostHog + logger (ADR-0134)
8. On success → toast "EHF-fakturering aktivert" (sonner); form shows saved state
9. Admin navigates back via breadcrumb "← Fakturering"

**Postcondition:** EHF setting persisted in `company` table. `emit()` fired — PostHog event logged, logger captured. `activity_trail` NOT written (company-scoped event, `workspace_id` null triggers provider early-return — known debt, see HANDOFF). Form reflects new state on next load. No console errors.

**Error paths:**
- Validation failure (invalid org number format) → inline field error in Norwegian, "Lagre" remains disabled
- Server Action auth failure (non-admin session) → 401 response, toast "Du har ikke tilgang til å endre faktureringsinnstillinger"
- Supabase write failure → toast "Kunne ikke lagre innstillinger — prøv igjen" + form resets to last known state
- Route query failure → new `error.tsx` renders Norwegian message + retry button (no white screen)

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter @smartout/telemetry typecheck` → 0 errors
- `ls apps/web/src/app/dashboard/billing/settings/error.tsx apps/web/src/app/dashboard/billing/settings/loading.tsx` → both exist
- `grep "emit(" apps/web/src/app/dashboard/billing/settings/_actions/updateCompanyEhfSettings.ts` → 1+ hit
- `grep -E "bg-(zinc|slate|gray|blue|green|red|amber)-(50|100|200|700)" apps/web/src/app/dashboard/billing/settings/` → 0 hits
- Manual: toggle EHF → save → reload page → setting persists; non-admin session → 401 toast fires

## E2E (recommended)

S12 protocol step 7 verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright deferred (covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`). Server Action mutation path has no Playwright coverage at this time — manual verification sufficient for polish-only sortie.
