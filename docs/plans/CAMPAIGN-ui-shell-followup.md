---
title: "Campaign — ui-shell-followup"
status: active
updated: 2026-05-19
created: 2026-05-19
module: Dashboard
tags: [campaign, roadmap, audit-followup, enforcement]
---

# Campaign — ui-shell-followup

> Branch: `campaign/ui-shell-followup` | Worktree: /home/sxtnl/dev/smartout.ai-ui-shell-followup | Module: Dashboard | Started: 2026-05-19
> Parent: `campaign/ui-shell` @ 80ba24389 (audit baseline 2026-05-18-adr-contract-validation-02, YELLOW)

## Vision

Close the residual drift surfaced by the 2026-05-18 audit and install the enforcement that prevents it
re-accumulating. Parent `campaign/ui-shell` shipped 16 commits and 4 parallel HIGH-fix sorties but
left 5 HIGH + 7 MEDIUM + 11 LOW findings open, all in axes that lack mechanical enforcement
(i18n adoption, ADR-0366 OKLCH literals, ADR-0204 D6 mutation governance, frontmatter hygiene).
Per cross-cutting pattern surfaced in synthesis: **enforcement-less ADRs accumulate violations
geometrically** (replays L-0083 mobile pattern that only stabilized after ESLint shipped). This
campaign ships the rules first, then the sweeps, so the same audit run a month from now finds
zero net new drift.

## Scope

### In scope

- **HIGH closure (5):** F-11-OKLCH-COMP, F-11-OKLCH-GLOBAL, F-12-I18N-SURFACES, F-10-I18N-WIZARD-1, F-10-I18N-WIZARD-2
- **MEDIUM closure (7):** M-001 billing-query body `workspace_id`; M-002 timebank gate-then-direct; M-003 shift-lifecycle gate-then-direct; M-004 timeline-template cross-namespace; F-04-OKLCH-DAY day-component sub-cluster; F-09-02 ADR-0321 superseded live-ref purge; F-12-FM frontmatter `module:` backfill (≥ADR + plans + learnings)
- **Enforcement rules** (ship BEFORE sweep so sweep deltas stay green):
  - ESLint rule: ban Tailwind arbitrary `[oklch(...)]` literals + raw `#hex` / `rgb()` in component files (scope `apps/web/src/components/**`, `apps/web/src/app/**/*.tsx`)
  - Hardcoded-Norwegian scanner: pre-commit hook + CI check, regex over `.tsx`/`.ts` outside `_locales/`, allowlist for proper nouns/brand strings
  - ADR-0204 amendment: explicit decision on gate-then-direct vs `gatedMutation` (payroll/shift-lifecycle convention pattern) — write amendment FIRST, refactor follows ADR
- **Deferred-from-parent:** DashboardShell setup-branch hydration mismatch (project memory `dashboard_shell_setup_hydration_mismatch`) — unify provider stack so setup-branch and dashboard-branch share outer wrapper
- **Drift telemetry:** snapshot `metrics.json` per closed HIGH/MEDIUM so next audit run can diff cleanly

### Out of scope

- New feature work (campaigns `mobile`, `payroll`, `botsson-arena` etc. own their roadmaps)
- Schema migrations (mark NOT-OVERNIGHT findings to their owning campaigns)
- Slice 03 (Edge Functions) and Slice 14 (Missions/E2E) re-audit — separate audit cycle
- Cross-campaign sweeps (this campaign ships rules + closes findings against `apps/web/` only)
- Refactors not tied to a tracked finding

## Milestones

- [ ] **M1 — Enforcement rules shipped** (ESLint OKLCH ban + hardcoded-NO scanner + ADR-0204 amendment). Baseline grep counts captured before any sweep commit.
- [ ] **M2 — HIGH sweep closed** (5 findings → 0). Verified by re-running slice 11 + slice 12 graders against new baseline.
- [ ] **M3 — MEDIUM sweep closed** (7 findings → 0). Payroll/shift-lifecycle refactor follows ADR-0204 amendment direction; superseded ADR-0321 live refs deleted.
- [ ] **M4 — Frontmatter backfill** (script-driven `module:` + `status:` + `updated:` on ADRs + plans + learnings; CI gate added).
- [ ] **M5 — DashboardShell setup hydration unified** (one provider stack, no recoverable hydration error). E2E covers both setup and post-setup load.
- [ ] **M6 — Promote-readiness verification** — full `/audit` run produces GREEN or YELLOW-with-rationale (no HIGH, ≤3 MEDIUM, all LOW classified). Merge campaign → development via FF.

## Active Sub-Sorties

<!-- Updated automatically when /start-feature runs from this worktree. -->

_none_

## Completed Sub-Sorties

<!-- Updated automatically when /close-feature merges a sub-sortie into this campaign. -->

_none_

## Decisions

See `docs/decisions/0000-decision-log.md` (inherited from development at campaign start).
All campaign-specific decisions registered here.

Expected new ADRs:
- ADR-0204 amendment (gate-then-direct vs `gatedMutation` clarification)
- ESLint rule scope ADR (which paths enforce, which carve-outs allowed)
- Hardcoded-Norwegian allowlist ADR (proper-noun policy)

## Sync Log

<!-- Updated by /sync-campaign when development changes are merged in. -->

| Date | Development HEAD | Merge commit |
|------|------------------|--------------|
| 2026-05-19 | 1e1dd843a | bffbce219 (seed from campaign/ui-shell @ 80ba24389) |
