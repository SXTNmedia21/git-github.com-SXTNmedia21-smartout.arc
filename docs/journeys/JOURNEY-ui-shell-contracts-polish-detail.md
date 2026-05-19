---
title: "Journey — Admin reviews a contract's detail view"
status: verified
feature: contracts-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, contracts, polish, campaign-ui-shell]
---

# Journey — Admin reviews a contract's detail view

> Sub-sortie: `ui-shell-contracts-polish`. Journey covering `/dashboard/contracts/[id]`.

## Journey: Admin drills into a single contract and sees full context

**Precondition:** Admin signed in, on dashboard shell. At least one `employment_contract` row exists in the workspace. Admin arrived from the contracts overview at `/dashboard/contracts`.

1. Admin clicks a contract row in the overview list → browser navigates to `/dashboard/contracts/<uuid>`
2. Route is Client Component — `loading.tsx` renders a Nordic Split skeleton (`bg-muted`, no zinc hardcodes) while the client `useEffect` fetch resolves against `/api/employment-contracts/<id>`
3. Header renders: employee's `display_name` as Instrument Serif h1, `position_title` as muted caption, `StatusBadge` using CSS variable palette (`bg-muted`, `bg-info/10`, `bg-success/10`, etc.) — dark-mode safe, no hardcoded Tailwind zinc/green/red classes
4. Page instructions appear inline below the header: "Her ser du vilkår, samsvarsstatus og historikk for kontrakten. Utkast kan redigeres; sendte kontrakter kan sendes på nytt eller avbrytes."
5. Contextual action buttons render based on status:
   - `draft` → "Rediger" button linking to `/dashboard/contracts/<id>/revise`
   - `pending_data` → "Fyll inn data" button linking to `/dashboard/people/<profile_id>/complete-data`
   - `signed` → disabled "Generer på nytt" button
6. Contract terms section renders as a definition list: hourly rate, monthly salary, employment percentage, start date — all reading from the fetched row; null values show i18n "detail_page.not_set"
7. Compliance overrides section appears if `compliance_overrides` is non-empty — each override rendered as `ComplianceBadge` using Nordic Split tokens (`bg-warning/10`, `bg-destructive/10`, `bg-info/10`)
8. Declined banner appears for status=`declined`: `AlertCircle` icon + decline reason code + free-text decline reason inside `bg-destructive/10` container
9. Pending-data banner appears for status=`pending_data`: warning palette container with description
10. Parent contract lineage link renders if `parent_contract_id` is set — `Link2` icon + link to parent detail page
11. `ContractDetailToolsBridge` mounts — Botsson tools registered: admin can ask "hva er statusen på kontrakten?" and get a structured answer from the loaded `ContractDetailRow`
12. `contracts.detail.viewed` telemetry emits once after contract loads and workspace_id + actor_id are both resolved — guarded by `viewedRef` to prevent double-fire on re-renders; `nonEmpty()` brand enforces ADR-0134 R1

**Postcondition:** Admin sees full contract context in a professional Nordic Split surface. Status badge uses semantic CSS variables. All conditional sections render correctly for each status variant. Telemetry is emitted exactly once. Botsson tool kit is reachable.

**Error paths:**
- `/api/employment-contracts/<id>` returns non-OK → `contract` state stays null, page renders "Kontrakten ble ikke funnet" with back link to `/dashboard/contracts`; `error.tsx` boundary catches unhandled throws
- Network timeout → same not-found fallback (fetch catches, `finally` sets `loading=false`)
- `workspace_id` or `profileId` not yet resolved when component mounts → telemetry emit skipped for that render cycle; fires on the render where both are truthy
- RLS denies the API route → 403/404 from route handler maps to not-found display

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `grep -r "zinc\|gray-[0-9]\|slate-[0-9]" apps/web/src/app/dashboard/contracts/[id]/page.tsx` → 0 hits (all palette via CSS vars)
- `grep STATUS_COLORS apps/web/src/app/dashboard/contracts/[id]/page.tsx` → uses `bg-muted`, `bg-info/10`, `bg-success/10`, `bg-warning/10`, `bg-destructive/10`
- `grep "contracts.detail.viewed" packages/telemetry/src/registry.ts` → 1 hit (registered event)
- `grep nonEmpty apps/web/src/app/dashboard/contracts/[id]/page.tsx` → 2 hits (workspace_id + actor_id)
- Dev server `/dashboard/contracts/<id>` → loads with skeleton then resolves, no console errors

## E2E (recommended)

S12 protocol already verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright spec deferred (not in M2 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` step 5).
