---
title: "Campaign — ui-shell"
status: active
updated: 2026-05-16
created: 2026-05-15
module: MODULE_01
tags: [campaign, roadmap, dashboard, polish, sidebar]
---

# Campaign — ui-shell

> Branch: `campaign/ui-shell` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell | Module: MODULE_01 | Started: 2026-05-15

## Vision

Take Smartout's web dashboard from "all routes reachable" to "all routes feel professional." Foundation sub-sortie (sidebar-reorg) surfaced 20 previously-orphan dashboard routes through a data-driven 9-group sidebar. Every surfaced route now passes the S12 protocol (HTTP < 500) but most still lack the polish layer — proper loading states, telemetry, page instructions, harness-tool descriptions, site-map registration, Nordic Split visual pass. This campaign drives each route through the 8-phase `smartout-page-polish` workflow until the entire admin surface is production-grade.

## Scope

**In scope:**
- 20 linked-orphan routes from `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` (S12) — one polish sortie per route or per logical cluster (e.g. HMS cluster of 8 routes can ship as one or many sorties depending on shared infrastructure).
- Sidebar foundations: testids, disabled-state assertions, i18n migration of hardcoded NO labels in `sidebar-config.ts`.
- Cross-cutting debt that PosAccountsList-class fixes uncover (e.g. `WorkspaceData` missing fields, hardcoded values in bridge inputs).
- Per polish sortie: speed-test baseline → bottleneck fix → re-test → UI/UX pass (Nordic Split) → telemetry registration → page instructions → harness-tool descriptions → site-map.json registration.

**Out of scope:**
- Mobile sidebar (ADR-0133 — mobile keeps 5-tab Approve/Execute layout, no sidebar parity).
- Routes outside the S12 list (employee `/my-*` surfaces, top-level `/dashboard` overview, `/dashboard/schedule`, `/dashboard/payroll` — those have separate campaigns or are already shipped).
- Building new pages — `/dashboard/tasks` and `/dashboard/manuals` stay as `DisabledNavItem` placeholders ("Snart" badges).
- AI capability changes — capability/tool work belongs to `botsson-arena` or `core-module`.
- Schema/database changes beyond minimal fields needed for type-threading (e.g. `is_active`).

## Milestones

- [x] **M1 — Sidebar foundation.** Data-driven `SIDEBAR_GROUPS_{ADMIN,EMPLOYEE,DEMO}` config + `<SidebarGroup>` + S12 protocol. 23 orphan routes reachable, 0 returning 500. *Shipped via `feat/ui-shell-sidebar-reorg` 2026-05-15.*
- [x] **M2 — Quick wins (2 of 20 routes).** `/dashboard/website` cluster (3 sub-routes) + `/dashboard/admin/pos-accounts`. *Shipped via `website-polish` + `pos-accounts-polish` 2026-05-16.*
- [x] **M3 — Foundation debt closeout.** Sidebar testids + SectionEditor real values + `WorkspaceData.is_active` threading. *Shipped via `debt-closeout` + `workspace-status-context` 2026-05-16.*
- [x] **M4 — Admin cluster (3 routes).** Contracts, cost, billing — high-traffic admin surfaces. *Shipped via `contracts-polish` + `cost-polish` + `billing-polish` 2026-05-17.*
- [x] **M5 — HMS cluster (8 routes).** Overview, deviations, documents, training, drift, governance, policies, handbook. Council 2026-05-17 mandated 4-sortie Option C+ sequence: pre-m5-mutation-closure + hms-collision-fix (2 BLOCKER prereqs) + hms-cluster-polish-read + policies-handbook-polish-write. *Shipped 2026-05-17.*
- [ ] **M6 — Planning cluster (3 routes).** Proposals, year-wheel, setup. Touches Cascade D4/D5 — coordinate with `world-best-wfm` if scheduler work overlaps.
- [ ] **M7 — Kommunikasjon + AI + Min Tid (4 routes).** Komm/desks, komm/oversikt, onboarding-assistant, shift-clock.
- [x] **M8 — Cleanup.** i18n migration of `sidebar-config.ts` labels (59 → labelKey, 56 keys per locale). Stale `PLAN-sidebar-reorg.md` duplicate verified non-existent (no-op). *Shipped via `i18n-cleanup` 2026-05-17.*
- [ ] **M9 — Campaign milestone PR.** `campaign/ui-shell` → `development` via merge-commit (ADR-0213). Pontus decides cut point — does not need all milestones complete; partial value can land independently.

## Active Sub-Sorties

_none_

## Completed Sub-Sorties

| # | Sub-sortie | Merge SHA | Scope |
|---|---|---|---|
| 1 | `sidebar-reorg` | `29586eee0` | Data-driven 9-group sidebar, 23 orphan routes surfaced, S12 protocol shipped |
| 2 | `website-polish` | `7d2d57c24` | `/dashboard/website` cluster (3 routes): admin overview, page editor, setup wizard |
| 3 | `debt-closeout` | `3abc3049b` | Sidebar testids + SectionEditor `isVisible`/`websiteIsLive` real values from `usePages` |
| 4 | `pos-accounts-polish` | `09c3a667f` | `/dashboard/admin/pos-accounts` admin overview + Botsson `getPosActionState` tool |
| 5 | `workspace-status-context` | `eff0dccd5` | `WorkspaceData.is_active` threading — closes ccb794dca TODO debt from sortie 4 |
| 6 | `contracts-polish` | `4eda8806c` | M4 sortie 1/3 — 5 contracts routes (`overview`, `reusable`, `await-signature`, `revise-policy`, `revise-content`) + 4 bridges + Botsson tools |
| 7 | `cost-polish` | `c6bea43aa` | M4 sortie 2/3 — `/dashboard/cost` overview, single sonnet agent |
| 8 | `billing-polish` | `023d3f3a1` | M4 sortie 3/3 — 3 routes + 14 tools, ADR-0244 finance read-only compliant |
| 9 | `i18n-cleanup` | `4d318536f` | M8 — 59 sidebar labels → i18n keys, 56 keys per locale, council-verified (Option B hard cutover) |
| 10 | `pre-m5-mutation-closure` | `9ef0fbb60` | M5 Sortie 1 of 4 (council 2026-05-17 Option C+) — close ADR-0099/0114/0204 gaps: 2 hooks → Server Actions w/ gate_action, createPolicy gated, capability seed migration `20260617110000`. Blocker for Sortie 2-4. |
| 11 | `hms-collision-fix` | `379036989` | M5 Sortie 2 of 4 — close 3 LIVE L-0258 collisions (listOpenDeviations 3-way → hms/deviations, getDriftStatus 2-way → hms/drift, getProtocolDetail 2-way → governance) + ship ADR-0360 CI detector with ratchet allowlist (8 cross-domain entries pending follow-up). Blocker for Sortie 3. |
| 12 | `hms-cluster-polish-read` | `430563d27` | M5 Sortie 3 of 4 — polish 5 read-heavy routes (hms umbrella + training + drift + documents + governance). 5 error.tsx + 4 loading.tsx, Nordic Split sweep across 11 components, 4 telemetry events registered, HmsSubNav ARIA tablist + tab + aria-current, Opplæring typo fix. G4 found 2 HIGH (CompetenceMatrix tokens + HmsSubNav ARIA) → fixed `21e066252`. 4 LOWs deferred per HANDOFF. |
| 13 | `policies-handbook-polish-write` | `369e80b38` | **M5 Sortie 4 of 4 — FINAL.** Polish 4 write-heavy routes (hms/deviations + hms/procedure/[id] + policies + handbook). 4 error.tsx + 2 loading.tsx (outline button variant absorbing Sortie 3 G4 LOW), Nordic Split sweep across 11 components (~38 hardcoded → semantic), 2 telemetry events (`deviation viewed`, `handbook chapter_opened` SPACE-separator), DeviationKanban motion audit (no AnimatePresence found, satisfies guard by absence). **M5 milestone COMPLETE (4/4).** |

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).
Campaign-specific ADRs: none yet — sub-sorties have been mechanical polish + threading, no new architecture.

## Polish Backlog

Source: `docs/guides/GUIDE-S12.md` + `apps/e2e/protocols/p-sidebar-orphan-coverage.ts`. Per HANDOFF-sidebar-reorg.md debt #6.

**18 routes remaining** (2/20 polished, plus sidebar foundation):

| Step | Route | Group | Est. sortie |
|---|---|---|---|
| 2 | `/dashboard/proposals` | Drift | M6 |
| 3 | `/dashboard/year-wheel` | Planlegging | M6 |
| 4 | `/dashboard/setup` | Planlegging | M6 |
| 5 | `/dashboard/contracts` | Administrasjon | M4 |
| 6 | `/dashboard/cost` | Administrasjon | M4 |
| 7 | `/dashboard/billing` | Administrasjon | M4 |
| 9 | `/dashboard/hms` | HMS | M5 |
| 10 | `/dashboard/hms/deviations` | HMS | M5 |
| 11 | `/dashboard/hms/documents` | HMS | M5 |
| 12 | `/dashboard/hms/training` | HMS | M5 |
| 13 | `/dashboard/hms/drift` | HMS | M5 |
| 14 | `/dashboard/hms/governance` | HMS | M5 |
| 15 | `/dashboard/policies` | HMS | M5 |
| 16 | `/dashboard/handbook` | HMS | M5 |
| 17 | `/dashboard/komm/desks` | Kommunikasjon | M7 |
| 18 | `/dashboard/komm/oversikt` | Kommunikasjon | M7 |
| 20 | `/dashboard/onboarding-assistant` | AI & Botsson | M7 |
| 21 | `/dashboard/shift-clock` | Min Tid | M7 |

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
| 2026-05-16 | 0233ea3f1 | a2c251196 |
| 2026-05-17 | 74eb55fac | 07a4edaba |
