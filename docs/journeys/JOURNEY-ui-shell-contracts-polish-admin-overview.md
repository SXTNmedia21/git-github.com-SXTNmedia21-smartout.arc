---
title: "Journey — Admin polishes the contracts overview surface"
status: verified
feature: contracts-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, ui-shell, contracts, polish, campaign-ui-shell]
---

# Journey — Admin polishes the contracts overview surface

> Sub-sortie: `ui-shell-contracts-polish`. Primary journey closing S12 step 5 (`/dashboard/contracts`).

## Journey: Admin navigates to /dashboard/contracts and feels professional

**Precondition:** Admin signed in, on dashboard shell. Workspace has at least one `employment_contract` row. Sidebar M1 (sidebar-reorg) shipped — "Administrasjon > Kontrakter" link reachable.

1. Admin clicks "Kontrakter" in sidebar → browser navigates to `/dashboard/contracts`
2. Route streams via Suspense — `loading.tsx` shows skeleton aligned with Nordic Split tokens (`bg-muted`, no zinc hardcodes) → no layout shift when data resolves
3. Page header renders — Instrument Serif title "Kontrakter", page instructions slot explains what admin does here (overview list, filter by status, drill into detail)
4. Contract list table renders — status pills, recipient names, dates, all using Nordic Split palette (`text-foreground`, `border-border`)
5. Empty state when zero contracts — friendly Norwegian copy, primary CTA "Ny kontrakt" links to `/dashboard/contracts/new`
6. Botsson page-tool kit registered via `useRegisterTools('contracts', kit)` — admin can ask Botsson "vis kontrakter som venter på signering" and tool answers from list state

**Postcondition:** Admin sees production-grade contracts overview. First paint < 800ms on local dev. No console errors. Site-map.json includes the route entry with kit metadata. Botsson tool kit is discoverable via standard registration pattern.

**Error paths:**
- Query failure → `error.tsx` renders Norwegian error message + retry button, no white screen
- RLS denies → empty state shows (handled in server action, no error surface)
- Stale telemetry — if mutation handlers exist on this page (likely none, overview is read-only), `emit()` call gated on workspace_id + actor_id resolution per ADR-0134

## Verification

- `pnpm --filter web typecheck` → 0 errors
- `pnpm --filter web site-map:validate` → exit 0, includes `/dashboard/contracts` route entry
- Dev server `/dashboard/contracts` → loads under 1s, no console errors, Nordic Split tokens applied
- Botsson tool kit registration → visible in `apps/web/src/app/Botsson/_components/tool-registry.ts` consumer
- Tool Compliance Self-Check (per smartout-agent-dev skill) → 0 docstring-vs-body drift, 0 direct DB writes outside gatedMutation

## E2E (recommended)

S12 protocol already verifies route returns < 500 — sufficient for orphan-coverage. Per-journey Playwright spec deferred (not in M2 scope; covered by `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` step 5).
