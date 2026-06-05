---
title: Design Canon — index (frozen reference for the design-handoff)
status: reference
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [design-canon, components, sitemap, sidebar, ia, nordic-split, frozen-reference]
---

# Design Canon — the design-system reference corpus

> **What this is.** The frozen, repo-local copy of the design-system canon a porter-agent must
> read while porting a page — so it grounds in the contract **without crossing into the sandbox
> fasit** (`smartout-sxtn-sandbox`, read-only). Seeded once (2026-06-03) from
> `smartout-sxtn-sandbox/docs/design/`. Treat as **read-only reference**: if a doc here disagrees
> with code/gate, code wins and the campaign patches the live surface — never edit canon to match drift.
>
> **Two halves of the design system:** (1) **Visual** — tokens + component recipes (how a card,
> badge, button is built). (2) **IA** — sitemap + sidebar grouping + reachability (how a user gets
> to a page). A page is only "design-done" when **both** are true: it looks right AND it is reachable.
> An unreachable page is a navigational phantom — the same failure class as a dead button
> (telemetry-spine thesis).

## The corpus

| File | Half | What it is |
|------|------|-----------|
| `components.md` | visual | Nordic Split component recipes — cards, glassmorphism, inputs, radios, badges, loading, buttons + the "never one-off variant" rules. Pairs with the token layer (`packages/design-tokens` + `globals.css @theme`). The component contract. |
| `SITEMAP-dashboard-audit.md` | IA | Route inventory + orphan audit (2026-05-15): 67+4 routes, 23 orphans, reachability matrix, mermaid graph. |
| `SIDEBAR-reorg-proposal.md` | IA | Pontus' 9-group sidebar taxonomy + the 23 orphans→home mapping + the one new route (`/dashboard/tasks`) + 7 open decisions. |
| `SITEMAP-current-vs-proposed.excalidraw` | IA | Visual current-vs-proposed sidebar (red=orphan, green=linked, yellow=sub, blue=new). |
| `sitemap/SIDEBAR-UX-AUDIT.md` | IA | Visual-hierarchy audit of the *grouped* sidebar (2026-05-18): density + 9px-header WCAG failures + sub-tab pattern. Refines what landed. |
| `sitemap/web/00-CANONICAL.md` | IA | Canonical web sitemap (full). |
| `sitemap/mobile/00..11-*.md` | IA | Full mobile sitemap audit (12 files): inventory → nav-graph → layouts/tabs → component-hierarchy → states → cross-links → auth-flow → gaps → recommendations → UX-review → proposed-architecture. ADR-0133 boundary ("web composes, mobile executes"). |

## Status on disk (verified 2026-06-03) — implemented + enforced?

### Visual half
- **Tokens:** ✅ implemented app-wide — `packages/design-tokens/src/tokens.ts` + `globals.css @theme inline` (131 custom-props). Ported `-v2` pages carry **0 token forks** (inherit). F0.5 (port-once-never-fork) satisfied for the ported set.
- **Component recipes (`components.md`):** the contract exists; **not mechanically enforced** (recipe adherence is reviewer/agent discipline, not a gate).
- **Enforcement (partial teeth):**
  - `.husky/pre-commit` hook #10 — live + firing. Gates **NEW** `zinc/gray/slate` + inline `stiffness/damping` + framer `duration:/ease:[`. "No NEW" only; **no hex / no font check**.
  - ESLint `no-oklch-literal.mjs` exists (ADR-0366 enforcer; enablement-level unverified).
  - **Hole:** hook #10 over-matches CSS → false-positives WCAG `prefers-reduced-motion` resets (`0.01ms`). No exemption. (Blocked the oversikt-v2 commit 2026-06-03.)

### IA half
- **Grouping infra:** ✅ landed — `sidebar-config.ts` (9 groups, ~52 admin / 12 employee items, config-driven) + `SidebarGroup.tsx` + `PageTabNav.tsx`.
- **Orphan-linking:** ⚠️ **incomplete** — `contracts`, `proposals`, `governance`, `tasks` = **0 refs** in `sidebar-config.ts`; `handbook`/`hms` = 1. Critical manager surfaces still unreachable.
- **New `/dashboard/tasks` route:** 🔴 not built (the reorg's only new route; ADR-0298 capability exists, no UI).
- **Grouped sidebar's own debt:** ⚠️ `SIDEBAR-UX-AUDIT` — 52 items in 256px = unscannable; 9px headers fail WCAG AA contrast.
- **`-v2` ports:** 🔴 not in sidebar (URL-only, by `-v2` side-by-side design — promotion to the real route is a later decision per WIRING-RECIPE).
- **IA enforcement:** 🔴 **none** — no orphan/reachability gate. The 34%-orphan finding was a *manual* audit; IA drift is invisible to CI.

## Verdict
**Implemented:** both halves, substantially, unevenly. **Enforced:** visual = partial-mechanical; IA = not at all.

## IA / enforcement backlog (feeds Phase-1 gate-harden + the campaign worklist)
1. **hook #10 a11y exemption** — skip `@media (prefers-reduced-motion: reduce)` blocks. (Live blocker.)
2. **F0.3** — `no-direct-supabase-write` `warn → error` for `apps/web/**` (fasit blocking item; still `warn`).
3. **orphan/reachability gate** — mechanical check that a routed page is linked OR explicitly archived.
4. **hook #10 coverage** — extend to hex + font enforcement; harden "no NEW" → "none".
5. **orphan-linking + `/tasks` build + sidebar UX/WCAG fixes** — the SIDEBAR-reorg + SIDEBAR-UX-AUDIT work, with the 7 open Pontus-decisions resolved first.

## How a porter-agent uses this
- **Visual:** port JSX/CSS verbatim (copy-not-rewrite); build any new card/badge/button per `components.md` recipes; tokens via the design layer only (no hex/oklch literals).
- **IA:** check `SITEMAP-*` for where the ported route belongs; a `-v2` port stays URL-only until promotion; surface any new orphan it creates.
- **Never** cross into the sandbox to read these — they live here now.
