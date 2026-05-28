---
title: HANDOFF — Dagslinjen prototype-parity + Core Structure Reform Phase 1 (ADR-0429)
status: done
updated: 2026-05-28
created: 2026-05-28
module: scheduler
tags: [handoff, dagslinjen, day-timeline, oppgaver, adr-0429, adr-0430, core-structure, foh-boh-admin, ui-shell]
---

# HANDOFF — Dagslinjen Parity + ADR-0429 Department Vocabulary

> Branch: `development` (direct sortie, no worktree) | Closed: 2026-05-28
> Two interleaved sorties shipped same chain: (a) ADR-0429 Department Vocabulary
> implementation, (b) Dagslinjen prototype-parity completion.

## Summary

**Out-of-scope parallel work:** Commit `aaca997bb` (SDSM orchestrator v2 + spec) landed in the same chain but is independent of the Dagslinjen + ADR-0429 sortie scope. Documented separately in `docs/superpowers/specs/2026-05-28-smartout-development-state-machine-design.md`.

Two orchestrated sorties shipped to `development` on 2026-05-27 → 2026-05-28:

1. **ADR-0429 implementation (L1–L7)** — FoH/BoH/Admin defaults + canonical Smartout
   terminology glossar landed in I1 seed, onboarding wizard, i18n org.* namespace,
   Botsson prompt, capability tool descriptions, and core-structure domain docs.
2. **Dagslinjen prototype-parity (D1–D7)** — Day Timeline at `/dashboard/oppgaver`
   now renders bands horizontally, has location pill, "Bruk mal" + "Akkurat nå"
   buttons, open-period wash, employee strips, NowLine without hydration mismatch,
   and a seeded HQ workspace with 5 areas + 17 day_lines for 2026-05-28.

Council review (Phase 3-9) on the same day produced **ADR-0429 accepted** and
**ADR-0430 accepted** 2026-05-28 via commit `dad1e3fd7` (shift × zone × location M:N reform, 8 MF + 4 CF council corrections applied; Phase b implementation sortie unblocked but not yet built).

## What Was Built

### Sortie A — ADR-0429 Department Vocabulary (L1–L7)

| Task | Deliverable | SHAs |
|---|---|---|
| L1 | `packages/ai/src/industry/packages/hospitality.ts` — I1 seed FoH/BoH/Admin | `708a5d81e` |
| L1 | `packages/ai/src/industry/defaults.ts` — NACE 56.101 + POSITION_REGISTRY | (same commit) |
| L2 | `apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx` — Radix Tooltip + Bar/Events toggles | ADR-0429 chain |
| L3 | `packages/i18n/locales/{nb,en}/org.json` — 46 leaf keys per locale (ASCII-only) | ADR-0429 chain |
| L3 | `packages/i18n/src/translate.ts` — nbOrg/enOrg registration | ADR-0429 chain |
| L4 | `packages/ai/src/prompts/mr-botsson.ts` — canonical terminology section | ADR-0429 chain |
| L4 | 5 capability `tools.ts` (org/routine/bootstrap/timeline-template/task) — 11 description edits "rolle"→"tilgangsnivå" | ADR-0429 chain |
| L5 | `docs/domains/core-structure/OVERVIEW.md §7 Terminology` — full glossar table | ADR-0429 chain |
| L5 | `docs/engines/industri-inteligence/cross-industry-pattern.md` — 5-industry archetype | ADR-0429 chain |
| L6 | Pre-merge grep gates green — zero "Operations" in seed code; zero misuse of "rolle" | (audit) |
| L7 | `docs/decisions/0429-department-vocabulary-foh-boh-admin-defaults.md` — accepted | (committed) |

### Sortie B — Dagslinjen Prototype-Parity (D1–D7)

| Commit | What |
|---|---|
| `f5d323b7f` | Bands horizontal (flex-row + min-w-220) — closes empty/vertical bug |
| `c21cbb78e` | HQ Workspace migration `20260801000000_hq_workspace_location_area_reshape.sql` — 5 areas + 12 dept-location M:N + dept_session + 17 day_lines seeded for 2026-05-28 |
| `8cd1e67ea` | AreaBand polish — OpenPeriodWash, EmpStrip (max 6 + overflow chip), routine strips, `data-testid="area-band-{id}"`, color-mix in oklch (no OKLCH literals) |
| `e9cc6f7ba` | Toolbar parity — "Bruk mal" chip + "Akkurat nå · HH:MM" pulse-button with motionTokens.springGentle + useReducedMotion gate |
| `112c3bf92` | Orchestrator-bundle — ManagerTimelineChart `scrollBodyRef` forward-prop, TimelineToolbar residual body, NowLine + TaskBlock data-testid wiring |

**Also landed earlier in chain (not numbered above):**

- `NowLine.tsx` hydration fix — single-tree render, `useReducedMotion` only switches
  framer-motion `animate` target (not DOM structure). `data-testid="now-line"` on
  outermost wrapper.
- `LocationSwitcherPill.tsx` (193 lines, new) — shadcn Popover + Command composition,
  URL searchParam `?location=<id>|all`, telemetry `oppgaver.location_filter_changed`,
  reads from `useLocationsForWorkspace`.
- `useLocationsForWorkspace.ts` (73 lines, new) — TanStack Query hook in
  `packages/data/src/day-session/`, L-0177 fail-fast pattern.
- `TimelineTopBar.tsx` rebuild (+176/-54) — brand-cluster + LocationSwitcherPill +
  date-stepper + "Lukk dagen → AVV" CTA + manager-pill. Telemetry
  `oppgaver.close_day_clicked`.
- `ManagerTimelineShell.tsx` (+61) — `chartBodyRef` + `scrollToNow` wiring +
  `useSearchParams` + `bandLocationMap` + `locationFilteredBands`.
- Telemetry registry (+78 lines) — 4 new event interfaces:
  `OppgaverPulseNowClicked`, `OppgaverTemplateApplyClicked`,
  `OppgaverLocationFilterChanged`, `OppgaverCloseDayClicked`. Union members + 4
  EVENT_ROUTING entries. L-0176 same-commit emit() compliance verified.
- E2E spec `apps/e2e/dagslinjen-parity/parity.spec.ts` (250 lines, 7 assertions).

### Sortie C — Council Phase 3-9 (Track F + K)

| Output | Status |
|---|---|
| `docs/audits/2026-05-27-core-structure-reform-index/INDEX.md` — 313-line indexer audit (117 ADRs, 41 relevant, 8 spines, 12 migrations, 110+ refs) | shipped |
| ADR-0429 (Department Vocabulary FoH/BoH/Admin) | **accepted** |
| ADR-0430 (Shift × Zone × Location M:N — Option Y) | **accepted** 2026-05-28 via commit `dad1e3fd7` (8 MF + 4 CF council corrections applied). Phase b implementation sortie unblocked but not yet built. Track #13. |
| Council 4/4 converged on Option Y for shift_zone reform | locked into ADR-0430 reservation notes |

## Decisions Registered

| ADR | Title | Status |
|---|---|---|
| ADR-0429 | Department Vocabulary — FoH/BoH/Admin Defaults + Terminology Glossar | accepted |
| ADR-0430 | Core Structure Reform Phase 2 — Shift × Zone × Location M:N (Option Y) | accepted |

Both registered in `docs/decisions/0000-decision-log.md`.

## Learnings Captured

- **Phase 2.5 fact-check fallibility** — claim "profile.location_id does not exist"
  was wrong; Steward Phase 3 verified the column at
  `00001_identity_tables.sql:118` + `00002:159`. Counter: always cross-verify
  Phase 2.5 negative-existence claims with a second axis (grep + direct migration
  read).
- **L-0176 trust-gate effective** — telemetry registry add + emit() call-sites
  landed same commit (`e9cc6f7ba` + `112c3bf92` for residuals). Verified via grep
  matching after merge. No drift.
- **WSL2 stop-hook noise ≠ actual block** — 4 parallel sub-agents triggered
  repeated stop-hook typecheck OOM-kills (memory 12Gi/15Gi, swap=0B). Edits
  landed despite hook failures because stop-hook is post-tool advisory, not a
  gate. Pattern: trust `git status` + commit hash over hook RED output.
- **Lint-staged commit overlap between parallel sub-agents** — D2 + D3 both
  modified TimelineToolbar/ManagerTimelineShell. Whichever committed first won;
  the loser's diff lingered in working tree. Resolved by orchestrator-bundle
  commit (`112c3bf92`). Going forward: serialize commits when sub-agents share
  file paths.
- **ADR-0240 misattribution caught mid-flight** — briefing claimed ADR-0240 is
  "Frozen-4 Boundaries". Actual: ADR-0240 is `journey-authoring-tool-boundary`;
  Frozen-4 lives in ADR-0173/0239. Sent SendMessage correction to in-flight
  Steward + Supervisor. Briefing fact-check rule: cite ADR title verbatim from
  file, not from memory.

## Known Debt / Next Steps

- **Track #20 — L1-debt:** `supabase/templates/restaurant/*.sql` and
  `supabase/functions/bootstrap-cascade/` still seed
  `Operations / Kitchen / Service / Bar`. Need follow-up sortie to align with
  ADR-0429 FoH/BoH/Admin defaults. Flagged in `hospitality.ts` commit message.
- **Track #13 / ADR-0430 — Shift × Zone × Location M:N:** Reserved ADR slot.
  Implementation sortie kicks off when prioritized. 8 conditions captured in
  ADR-0430 body §"Council verdict" — must be the implementation acceptance
  criteria.
- **Property-layer (location vs área-of-location):** Deferred per ADR-0367 v1.1.
  V1 keeps `location` as the area concept; a future property-layer ADR may add
  multi-property workspaces.
- **Mobile parity for LocationSwitcherPill:** Web-only V1. Mobile-side
  composition pending (shadcn Popover not present in RN; needs native
  bottom-sheet equivalent).
- **Maestro E2E for Dagslinjen on mobile:** Web Playwright spec landed
  (`apps/e2e/dagslinjen-parity/parity.spec.ts`). Mobile counterpart pending.

## Verification Gates

- D6.1 Hot-reload sanity — PASS (web 3060 responsive, 307 redirects expected)
- D6.2 Server log smoke — PASS (no error patterns)
- D6.3 Playwright spec run — SKIP (auth-gated, spec exists at
  `apps/e2e/dagslinjen-parity/parity.spec.ts`, needs fixture run separately)
- D6.4 Console error capture — SKIP (auth-gated; unauth nav → 307)
- D6.5 File-grep sanity — PASS (`now-line` ✓ NowLine.tsx:62,
  `location-switcher-pill` ✓ LocationSwitcherPill.tsx:118,
  `now-pulse-button` ✓ TimelineToolbar.tsx:236,
  `area-band-*` ✓ AreaBand.tsx:418, no stale references)
- Typecheck — verified prior to commits per L-0316 mitigation
  (`TURBO_CONCURRENCY=1`)
- Grep gate ADR-0429 — zero "Operations" in seed code; zero "rolle" misuse in UI
  strings; "rolle"→"tilgangsnivå" only in description copy, no Zod field-name
  changes (ADR-0112 compliance)

## Commit Chain on Development

```
112c3bf92  fix(dagslinjen): orchestrator-bundle residual D2/D3/D5 edits
e9cc6f7ba  feat(dagslinjen): Toolbar parity — Bruk mal + Akkurat nå pulse-button
8cd1e67ea  feat(dagslinjen): AreaBand polish — open-period wash + emp-strip + routine strips
c21cbb78e  feat(dagslinjen): HQ Workspace location area-reshape migration (ADR-0429)
f5d323b7f  fix(dagslinjen): bands render as horizontal columns (flex-row + min-w-220)
```

Plus the ADR-0429 chain commits (registered in `0000-decision-log.md`) and
`708a5d81e` (hospitality.ts I1 seed).

## Files Touched (snapshot)

```
 packages/i18n/locales/nb/oppgaver.json
 packages/supabase/src/database.types.ts
 packages/telemetry/src/registry.ts
 supabase/migrations/20260801000000_hq_workspace_location_area_reshape.sql
 apps/web/src/app/dashboard/oppgaver/_chart/{NowLine,TaskBlock,AreaBand,ManagerTimelineChart}.tsx
 apps/web/src/app/dashboard/oppgaver/_components/{LocationSwitcherPill,TimelineTopBar,TimelineToolbar,ManagerTimelineShell}.tsx
 packages/data/src/day-session/use-locations-for-workspace.ts
 apps/e2e/dagslinjen-parity/parity.spec.ts
 docs/decisions/0429-department-vocabulary-foh-boh-admin-defaults.md
 docs/decisions/0430-core-structure-reform-shift-zone-m2m.md
 docs/decisions/0000-decision-log.md
 docs/domains/core-structure/OVERVIEW.md
 docs/engines/industri-inteligence/cross-industry-pattern.md
 docs/audits/2026-05-27-core-structure-reform-index/INDEX.md
 packages/ai/src/industry/{packages/hospitality.ts,defaults.ts}
 packages/ai/src/prompts/mr-botsson.ts
 packages/ai/src/capabilities/{org,routine,bootstrap,timeline-template,task}/tools.ts
 packages/i18n/locales/{nb,en}/org.json
 packages/i18n/src/translate.ts
 apps/web/src/app/onboarding/steps/ConfirmDepartments.tsx
```

15 files in the D-track sortie alone: +1003 / -72 lines net.

## Closure Notes

- Direct-on-development sortie (no worktree). Pre-authorized scope per user
  orchestrator dispatch on 2026-05-27 + continuation on 2026-05-28.
- No PR — direct push (development accepts direct push per CLAUDE.md §Git
  Workflow).
- DASHBOARD.md bumped same chain (entry under "Today's Shipped to Development").
- Core-structure domain spine reconciled per ADR-0392 — see
  `docs/domains/core-structure/OVERVIEW.md §7 Terminology` for the canonical
  glossar landing point.
