---
title: "Journey — Admin revises a draft contract"
status: verified
feature: contracts-polish
updated: 2026-05-17
created: 2026-05-17
module: MODULE_01
tags: [journey, ui-shell, contracts, polish, campaign-ui-shell]
---

# Journey — Admin revises a draft contract

> Sub-sortie: `ui-shell-contracts-polish`. Journey covering `/dashboard/contracts/[id]/revise`.

## Journey: Admin opens a draft contract for amendment

**Precondition:** Admin signed in, on dashboard shell. Contract at `<id>` has status=`draft` — "Rediger" action is visible on the detail page. Admin clicked "Rediger" from `/dashboard/contracts/<id>`.

1. Browser navigates to `/dashboard/contracts/<id>/revise`
2. `loading.tsx` renders a Nordic Split skeleton (`bg-muted` pulse) while the Client Component boots — back link and wizard placeholder visible within 200ms
3. Back link renders: "← Tilbake til kontrakt" linking to `/dashboard/contracts/<id>`
4. Page header renders — Instrument Serif h1 showing the revision title (i18n key `revise.revising`, includes contract id), muted subtitle as page instructions:
   "Gjennomgå og endre vilkårene for denne kontrakten. Cascade foreslår oppdaterte verdier basert på gjeldende tariff og rammeverk. Endringene lagres som et nytt utkast — den opprinnelige kontrakten bevares i historikken."
5. `CompositionWizard` renders below the header — the shared wizard component from `../../_components/CompositionWizard`
6. `ContractReviseToolsBridge` mounts with `contractId` prop — Botsson tools registered: admin can ask "hva skjer med den opprinnelige kontrakten?" and get an explanation of the amendment flow
7. `contracts.revise.opened` telemetry emits once when workspace_id + actor_id + id are all resolved; guarded by `openedRef` to prevent double-fire; `nonEmpty()` brand enforces ADR-0134 R1

**Postcondition:** Admin sees a professional revision surface with Instrument Serif heading, correct page instructions, and the composition wizard ready for input. Telemetry is emitted once. Botsson understands the amendment context.

**Error paths:**
- Admin navigates to `/revise` on a non-draft contract (e.g. status=`signed`) — no route-level guard yet; `CompositionWizard` renders regardless; future enforcement deferred to Phase 3 wizard hardening
- `id` param missing or malformed → `useParams` returns empty string; `ContractReviseToolsBridge` receives `contractId=""`, telemetry emit skipped (nonEmpty guard prevents empty-string event)
- `workspace_id` or `profileId` not resolved at first render → telemetry skipped for that cycle, fires on the render where both are truthy
- Wizard submission failure → handled by `CompositionWizard` internal error state (out of this sortie's scope)
- `error.tsx` boundary catches any unhandled component throw — renders Norwegian error message with retry

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `grep "contracts.revise.opened" packages/telemetry/src/registry.ts` → 1 hit (registered event)
- `grep nonEmpty apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx` → 2 hits (workspace_id + actor_id)
- `grep openedRef apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx` → guards double-fire
- Dev server `/dashboard/contracts/<draft-id>/revise` → loads with skeleton then resolves, heading visible, no console errors

## E2E (recommended)

S12 protocol already verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright spec deferred (not in M2 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` step 5).
