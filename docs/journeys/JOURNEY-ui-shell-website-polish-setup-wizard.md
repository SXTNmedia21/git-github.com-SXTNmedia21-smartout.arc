---
title: "Journey — admin completes /dashboard/website/setup wizard"
status: verified
feature: website-polish
updated: 2026-05-16
created: 2026-05-16
module: MODULE_01
tags: [journey, website, setup, page-polish, ui-shell, campaign-ui-shell]
---

# Journey — admin completes website setup wizard

> Sub-sortie: `ui-shell-website-polish`. Verifies setup wizard polish — added 2026-05-16 after Phase 0 recon found 3rd route.

## Journey: Admin sets up website for first time

**Precondition:** Admin signed-in, workspace has NO website yet (`website` row missing or `is_published=false`).

1. Admin navigates from `/dashboard/website` empty state → clicks "Lag første side" / "Sett opp nettside" → routes to `/dashboard/website/setup`
2. SetupWizard mounts → User progresses through wizard steps (template pick, sections, hours, spokesperson) → each step has clear instruction + next-action
3. Wizard completes → fires `website setup completed` mutation → `emit('website.setup_completed', ...)` → activity_trail row + PostHog event → redirects to `/dashboard/website` with newly created site

**Postcondition:** Workspace has website row + initial pages + sections. Activity trail shows setup-completed event. Admin lands on overview with populated state.

**Error paths:**
- Template fetch fails → wizard shows retry copy
- Section creation partial-fails mid-wizard → wizard rolls back transactional state, toast "Setup feilet — start på nytt"
- Spokesperson assignment fails (chosen profile no longer active) → wizard skips, allows manual assignment later
- Auth lost mid-wizard → redirect to `/login`, partial state preserved if possible

## Verification

- Lighthouse on `/dashboard/website/setup`: LCP <1.5s warm
- All 342L `SetupWizard` mutations resolve telemetry registry entries
- Wizard step instructions are non-generic — describe choice consequences
- run.yml: `dashboard-website-setup.run.yml` documentation-only (sub-route under `dashboard-website`)
- site-map entry: `/dashboard/website/setup` with purpose ≤140 chars, tools array (may be empty if no Botsson surface needed)

## ADR-0244 risk-tier note

Setup wizard creates `website` row + initial pages + sections — a transactional surface. Per ADR-0244, no Botsson mutation tool for "run setup automatically". Setup is human-driven through wizard. Botsson may read setup state (`isWebsiteSetUp`, `setupCompletedAt`) but not initiate or short-circuit.

## E2E (recommended)

`apps/web/e2e/website-polish/setup-wizard.spec.ts` — empty-state click-through, complete wizard, assert website row + redirect + emit.
