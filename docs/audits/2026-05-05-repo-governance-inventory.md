---
title: Repo Governance Inventory — 2026-05-05
status: done
created: 2026-05-05
updated: 2026-05-05
module: meta
tags: [governance, audit, inventory, cleanup]
---

# Repo Governance Inventory — 2026-05-05

> Read-only sweep. No writes, no branch ops, no worktree ops outside this file.
> Today: 2026-05-05. Idle days calculated from last commit or `updated:` date.

---

## Headline Numbers

**31 worktrees: 21 active (≤7d), 5 dying (8-30d), 5 dead (>30d — cloud + locked + 3 stale sorties)**
**208 journeys: 74 verified, 115 done, 6 in-progress, 9 stale/superseded/draft**
**51 handoffs total: 36 docs/ root, 15 docs/handoffs/ — all recent (oldest with date = 2026-04-23, 7 undated = git log → 2026-04-28/05-02)**
**96 active PLAN- files (root) + 11 CAMPAIGNs + 18 completed + 1 archive — 13 done-plans misplaced in active root**
**271 ADRs: 196 accepted, 49 proposed (in-flight), 26 other, 1 in archive**
**8 audit files + 1 audit folder (2026-05-02 ADR contract validation, 14 sub-files)**

---

## Section 1 — Worktrees

**Total:** 31 entries in `git worktree list` (including main repo + 1 prunable + 1 cloud skip)

### Campaign Worktrees

| Path | Branch | Last Commit | Idle Days | Status |
|------|--------|-------------|-----------|--------|
| `smartout.ai-botsson-arena` | `campaign/botsson-arena` | 2026-05-04 | 1 | 🟢 active |
| `smartout.ai-bubble-migration` | `campaign/bubble-migration` | 2026-05-04 | 1 | 🟢 active |
| `smartout.ai-core-module` | `campaign/core-module` | 2026-04-30 | 5 | 🟢 active |
| `smartout.ai-daily-operation` | `campaign/daily-operation` | 2026-04-29 | 6 | 🟢 active |
| `smartout.ai-helpdesk` | `campaign/helpdesk` | 2026-04-30 | 5 | 🟢 active |
| `smartout.ai-journey-engine` | `campaign/journey-engine` | 2026-04-30 | 5 | 🟢 active |
| `smartout.ai-lovsen` | `campaign/lovsen` | 2026-05-02 | 3 | 🟢 active |
| `smartout.ai-mobile` | `campaign/mobile` | 2026-05-04 | 1 | 🟢 active |
| `smartout.ai-order-system` | `campaign/order-system` | 2026-05-03 | 2 | 🟢 active |
| `smartout.ai-payroll` | `campaign/payroll` | 2026-05-02 | 3 | 🟢 active |
| `smartout.ai-pipeline-autonomy` | `campaign/pipeline-autonomy` | 2026-05-05 | 0 | 🟢 active |
| `smartout.ai-schedule-harness` | `campaign/schedule-harness` | 2026-05-03 | 2 | 🟢 active |
| `smartout.ai-services` | `campaign/services` | 2026-05-02 | 3 | 🟢 active |

### Sub-Sortie Worktrees (inside campaigns)

| Path | Branch | Last Commit | Idle Days | Status | Note |
|------|--------|-------------|-----------|--------|------|
| `botsson-arena-wt-1` | `feat/botsson-arena-komm-gate-action-wiring` | 2026-04-29 | 6 | 🟢 active | remote pushed |
| `botsson-arena-wt-2` | `feat/botsson-arena-voice-plane-consolidation` | 2026-05-04 | 1 | 🟢 active | remote differs |
| `journey-engine-wt-1` | `feat/journey-engine-runtime-loop` | 2026-04-28 | 7 | 🟢 active | remote pushed |
| `mobile-wt-1` | `feat/mobile-mobile-restore-4tab-plan` | 2026-05-04 | 1 | 🟢 active | remote pushed |
| `mobile-wt-2` | `feat/mobile-shift-system-polish` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `mobile-wt-3` | `feat/mobile-calendar-redesign` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `mobile-wt-4` | `feat/mobile-addsheet-booking-stack` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `mobile-wt-5` | `feat/mobile-addsheet-server-action-migration` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `mobile-wt-6` | `feat/mobile-addsheet-task-bff-wrap` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `schedule-harness-wt-1` | `feat/schedule-harness-tariff-utc-fix` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |

### Sortie Pool (`smartout.ai-wt-N`)

| Path | Branch | Last Commit | Idle Days | Status | Open PR |
|------|--------|-------------|-----------|--------|---------|
| `wt-1` | `feat/botsson-orb-voice-mount` | 2026-05-02 | 3 | 🟢 active | None |
| `wt-2` | `feat/innkalling-og-policies` | 2026-05-02 | 3 | 🟢 active | None |
| `wt-3` | `feat/botsson-sdk` | 2026-05-02 | 3 | 🟢 active | None |
| `wt-4` | `feat/pwa-telemetry-build` | 2026-05-04 | 1 | 🟢 active | None |
| `wt-5` | `feat/billing-erik-seed` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `wt-6` | `feat/welcome-mission-rework` | 2026-05-04 | 1 | 🟢 active | LOCAL ONLY |
| `wt-7` | `feat/mobile-restore-4tab-plan` | 2026-05-04 | 1 | ⚠️ LOCKED | zombie |

### Skipped / Excluded

| Path | Reason |
|------|--------|
| `smartout.ai` (main repo) | Main repo on `development` — not audited as worktree |
| `smartout.ai-cloud` | `cloud/main` branch — infrastructure, intentionally separate |
| `admiring-haibt-e44165` | Claude internal worktree, prunable |

### Flags

- **wt-7 is `locked:initializing`** — zombie state. Path exists with `app.json` (React Native content) but lock reason is "initializing" which means creation was interrupted. Branch `feat/mobile-restore-4tab-plan` is a near-duplicate of `feat/mobile-mobile-restore-4tab-plan` (mobile-wt-1). Last commit is 2026-05-04 DASHBOARD stub only.
- **6 mobile sub-sorties are LOCAL ONLY** (not pushed to origin). `schedule-harness-wt-1` also local-only.
- **No open PRs** on any feat/* or campaign/* branch. Only open PR: #316 (`preview` → `main`, release).

---

## Section 2 — Branches (Remote)

### Summary

| Category | Count | With Open PR |
|----------|-------|--------------|
| `feat/*` | 11 | 0 |
| `campaign/*` | 12 | 0 |
| `hotfix/*` | 0 | — |
| Protected/other | 5 | 1 (PR #316, `preview`) |

### `feat/*` Remote Branches

| Branch | Last Remote Commit | Idle Days | Status |
|--------|-------------------|-----------|--------|
| `feat/botsson-arena-komm-gate-action-wiring` | 2026-04-29 | 6 | 🟢 active |
| `feat/botsson-arena-voice-plane-consolidation` | 2026-05-04 | 1 | 🟢 active |
| `feat/botsson-orb-voice-mount` | 2026-05-02 | 3 | 🟢 active |
| `feat/botsson-sdk` | 2026-05-02 | 3 | 🟢 active |
| `feat/enforce-pipeline` | 2026-05-03 | 2 | 🟢 active |
| `feat/innkalling-og-policies` | 2026-05-02 | 3 | 🟢 active |
| `feat/journey-engine-publish-mission-body` | 2026-04-27 | 8 | 🟡 dying |
| `feat/journey-engine-runtime-loop` | 2026-04-28 | 7 | 🟢 active |
| `feat/mobile-mobile-restore-4tab-plan` | 2026-05-04 | 1 | 🟢 active |
| `feat/pipeline-autonomy-ci-agent` | 2026-05-04 | 1 | 🟢 active |
| `feat/pwa-telemetry-build` | 2026-05-04 | 1 | 🟢 active |

> Note: `feat/journey-engine-publish-mission-body` has NO local worktree. Orphaned remote branch.

### `campaign/*` Remote Branches

| Branch | Last Remote Commit | Idle Days | Status |
|--------|-------------------|-----------|--------|
| `campaign/botsson-arena` | 2026-05-04 | 1 | 🟢 active |
| `campaign/bubble-migration` | 2026-05-04 | 1 | 🟢 active |
| `campaign/core-module` | 2026-04-30 | 5 | 🟢 active |
| `campaign/daily-operation` | 2026-04-29 | 6 | 🟢 active |
| `campaign/helpdesk` | 2026-04-30 | 5 | 🟢 active |
| `campaign/journey-engine` | 2026-04-30 | 5 | 🟢 active |
| `campaign/lovsen` | 2026-05-02 | 3 | 🟢 active |
| `campaign/order-system` | 2026-05-03 | 2 | 🟢 active |
| `campaign/payroll` | 2026-05-02 | 3 | 🟢 active |
| `campaign/pipeline-autonomy` | 2026-05-05 | 0 | 🟢 active |
| `campaign/schedule-harness` | 2026-05-03 | 2 | 🟢 active |
| `campaign/services` | 2026-05-02 | 3 | 🟢 active |

### Other Remote Branches

| Branch | Last Commit | Note |
|--------|-------------|------|
| `main` | — | Production |
| `development` | current | Integration |
| `preview` | 2026-05-04 | Has open PR #316 → main |
| `cloud/main` | — | Infra |
| `release/preview-to-main-2026-05-04` | 2026-05-04 | PR #312 MERGED — stale branch |

> `release/preview-to-main-2026-05-04` — PR was merged, branch can be deleted.

---

## Section 3 — Journeys

**Total: 208 JOURNEY-*.md files** in `docs/journeys/`

### Status Breakdown

| Status | Count | Notes |
|--------|-------|-------|
| `done` | 115 | Feature complete, closed |
| `verified` | 74 | Verified + linked |
| `in_progress` | 6 | Active features |
| `superseded` | 5 | Explicitly replaced |
| `draft` | 4 | Unstarted |
| `review` / `ready*` / `archived` | 4 | Various edge states |

### ADR Cross-References

Only **3 journey files** are referenced by name from ADR docs — nearly all journeys are standalone.

### Age Distribution (by `updated:` date)

| Age Bucket | Count | Notes |
|------------|-------|-------|
| ≤ 7 days (2026-04-28+) | ~65 | Bulk of recent work |
| 8-30 days (2026-04-05 to 2026-04-27) | ~80 | Still recent |
| 31-60 days (2026-03-06 to 2026-04-04) | ~40 | Potentially stale |
| > 60 days (before 2026-03-06) | 23 | Clear stale candidates |

### Journeys > 60 days Old (before 2026-03-06)

All have `status: done` or `verified` — created during early build phase.

| Updated | Filename |
|---------|----------|
| 2026-03-01 | JOURNEY-landing-analytics.md |
| 2026-03-01 | JOURNEY-schedule-ui.md |
| 2026-03-02 | JOURNEY-dashboard-redesign.md |
| 2026-03-02 | JOURNEY-fix-crash-useworkspace.md |
| 2026-03-02 | JOURNEY-keys-admin-ui-v2.md |
| 2026-03-02 | JOURNEY-landing-optimization.md |
| 2026-03-02 | JOURNEY-schedule-v2.md |
| 2026-03-02 | JOURNEY-stage-engine-local.md |
| 2026-03-02 | JOURNEY-team-member-management.md |
| 2026-03-03 | JOURNEY-agent-architecture.md |
| 2026-03-03 | JOURNEY-daily-standup.md |
| 2026-03-03 | JOURNEY-dashboard-evolution.md |
| 2026-03-03 | JOURNEY-dashboard-polish.md |
| 2026-03-03 | JOURNEY-journey-testing-system.md |
| 2026-03-03 | JOURNEY-operations-ui-redesign.md |
| 2026-03-03 | JOURNEY-people-module-v2.md |
| 2026-03-03 | JOURNEY-platform-admin-polish.md |
| 2026-03-03 | JOURNEY-schedule-db-persistence.md |
| 2026-03-03 | JOURNEY-services-health-dashboard.md |
| 2026-03-03 | JOURNEY-voice-agent-fix.md |
| 2026-03-04 | JOURNEY-daily-standup.md |
| 2026-03-05 | JOURNEY-entity-detail-pages.md |
| 2026-03-03 | JOURNEY-fix-keys-admin-bugs.md |

### Superseded Journeys (explicit, updated 2026-04-29)

These were explicitly superseded by the `services/` campaign contract work:

- JOURNEY-employee-contract-management.md
- JOURNEY-services-employee-contract-cancel.md
- JOURNEY-services-employee-contract-create.md
- JOURNEY-services-employee-contract-send.md
- JOURNEY-services-employee-contract-sign.md

### Journey Subfolders

| Subfolder | Files | Notes |
|-----------|-------|-------|
| `archive/` | 1 | JOURNEY-deployment-pipeline.md |
| `dev-adr-0249-base-consolidation/` | 5 | Mission/flow docs for AI dev task |
| `dev-arena-bootstrap/` | 5 | Mission/flow docs for AI dev task |
| `dev-sixten-hello/` | 6 | Mission/flow docs for AI dev task |
| `platform-admin-authors-journey/` | 12 | Larger journey spec set |

> The `dev-*` subfolders are AI-agent mission directories (MISSION.md, FLOW.md, etc.) accidentally placed inside `docs/journeys/` — they are not user journeys.

---

## Section 4 — Handoffs

**Total: 51 handoffs** — 36 in `docs/` root, 15 in `docs/handoffs/`

### Age Breakdown

| Age | Count | Oldest Undated (git log) |
|-----|-------|--------------------------|
| 🟢 < 30 days (2026-04-05+) | 48 | — |
| 🟡 30-90 days | 3 | HANDOFF-publish-mission-body (2026-04-28), HANDOFF-botsson-arena-c3-1 (2026-04-28) |
| 🔴 > 90 days | 0 | — |

### No `updated:` Frontmatter (7 files)

These 7 files have no `updated:` field in YAML frontmatter. Git log dates provided:

| Git Date | Filename |
|----------|----------|
| 2026-05-02 | HANDOFF-arbeidstilsynet-mcp.md |
| 2026-05-02 | HANDOFF-lovdata-mcp.md |
| 2026-05-02 | HANDOFF-lovsen-foundation.md |
| 2026-05-02 | HANDOFF-mattilsynet-mcp.md |
| 2026-05-02 | HANDOFF-nho-reiseliv-mcp.md |
| 2026-04-28 | HANDOFF-publish-mission-body.md |
| 2026-04-28 | HANDOFF-botsson-arena-c3-1-onboarding-reduced-motion.md |

### Notes on Root vs Subfolder Split

- `docs/handoffs/` was introduced for date-stamped session handoffs (2026-05-04 cluster).
- `docs/` root has feature/sortie handoffs (pattern: `HANDOFF-<feature-name>.md`).
- No policy enforces which goes where — both patterns coexist.

---

## Section 5 — Plans

**Total in `docs/plans/`:**

| Category | Count | Notes |
|----------|-------|-------|
| Active `PLAN-*.md` (root) | 96 | Includes 13 with `status: done` — misplaced |
| `CAMPAIGN-*.md` (root) | 11 | Campaign planning docs |
| `completed/` | 18 | Moved-done plans |
| `archive/` | 1 | One rejected plan |
| Non-standard root files | 4 | `ROADMAP-ai-harness.md`, `platform-admin-communications-gap-plan.md`, 2x `2026-05-04-*.md` |

### Active Root Plan Statuses

| Status | Count | Notes |
|--------|-------|-------|
| `draft` | 40 | Never started or placeholder |
| `in_progress` | 28 | Ongoing |
| `done` | 13 | Should be in `completed/` |
| `ready` | 10 | Ready to execute |
| `review` / `proposed` / `exploration` / `approved` / `superseded` | 5 | Edge cases |

### `completed/` Plans — Status Anomaly

16 of 18 completed plans have `status: draft` (not updated at close). Only 1 has `status: done`.

### Misplaced Done Plans (in active root)

Should be moved to `completed/`:

- PLAN-cascade-gate-write.md, PLAN-dispatcher-entity-pk.md, PLAN-domain-taxonomy.md
- PLAN-enforce-pipeline.md, PLAN-mobile-parity-poc.md, PLAN-nordic-split-phase-1.md
- PLAN-nordic-split-phase-2.md, PLAN-overview-v2.md, PLAN-perf-sprint-wave-1.md
- PLAN-publish-mission-body.md, PLAN-route-polish.md, PLAN-training-schema-foundation.md
- PLAN-avstemming-pages.md

---

## Section 6 — Decisions

| Metric | Count |
|--------|-------|
| Total ADR files in `docs/decisions/` | 271 |
| `status: accepted` | 196 |
| `status: proposed` (in-flight) | 49 |
| Other statuses | 26 |
| In `archive/` subfolder | 1 |

> 49 proposed ADRs is high — likely includes council-session ADRs pending final acceptance after implementation. No per-file listing per spec.

---

## Section 7 — Audits

**Total: 8 files + 1 folder (14 sub-files)**

| Item | Date | Notes |
|------|------|-------|
| `2026-05-02-adr-contract-validation/` | 2026-05-02 | 14-file synthesis folder, SYNTHESIS.md = canonical output |
| `2026-05-03-git-deploy-orchestration-map.md` | 2026-05-03 | Git/deploy topology map |
| `PHASE-2-CAPABILITY-AUDIT-2026-04-27.md` | 2026-04-27 | Capability audit wave 2 |
| `AUDIT-supabase-preview-ci-2026-04-15.md` | 2026-04-15 | Supabase preview CI check |
| `AUDIT-pg-net-callers-2026-04-15.md` | 2026-04-15 | pg_net usage audit |
| `AUDIT-P-LOGIN-2026-04-14.md` | 2026-04-14 | Login audit follow-up |
| `AUDIT-P-LOGIN-2026-04-13.md` | 2026-04-13 | Login audit |
| `AUDIT-P-001-2026-04-13.md` | 2026-04-13 | Initial P audit |

**Last 5 by date:** 2026-05-03, 2026-05-02 (14 files), 2026-04-27, 2026-04-15 (×2).

---

## Section 8 — Top 10 Prune Candidates

### Priority Table

| # | Target | Why Dead | Action | Risk |
|---|--------|----------|--------|------|
| 1 | `wt-7` (`feat/mobile-restore-4tab-plan`) | `locked:initializing` — zombie. Path exists, branch is near-duplicate of `feat/mobile-mobile-restore-4tab-plan` (mobile-wt-1). Only commit is DASHBOARD stub. | `git worktree remove --force ~/dev/smartout.ai-wt-7` then delete local branch | Low — no unique work; mobile-wt-1 has the real feature |
| 2 | `release/preview-to-main-2026-05-04` (remote) | PR #312 MERGED 2026-05-04. Branch is dead ref. | `git push origin --delete release/preview-to-main-2026-05-04` | Zero — PR closed |
| 3 | `feat/journey-engine-publish-mission-body` (remote only) | Last commit 2026-04-27 (8 days). No local worktree. No open PR. Likely superseded by journey-engine-wt-1 (runtime-loop). | Confirm superseded, then `git push origin --delete feat/journey-engine-publish-mission-body` | Low — verify journey-engine campaign covers scope |
| 4 | 13 `PLAN-*.md` with `status: done` in active root | Already complete — noise in active working set | Move to `docs/plans/completed/` | Zero — pure file move |
| 5 | 23 journeys older than 60 days (pre-2026-03-06) | All `done`/`verified`, from early build phase. No ADR cross-ref. Features long-shipped. | Move to `docs/journeys/archive/` | Low — may be referenced in HANDOFF/PLAN files (unverified grep) |
| 6 | 5 superseded journeys (`status: superseded`) | Explicitly marked superseded 2026-04-29 | Move to `docs/journeys/archive/` | Zero — status is definitive |
| 7 | `dev-adr-0249-base-consolidation/`, `dev-arena-bootstrap/`, `dev-sixten-hello/` subfolders inside `docs/journeys/` | AI-agent mission directories (MISSION.md, FLOW.md, etc.) — not user journeys. Wrong location. | Move to appropriate location (e.g., `docs/missions/` or campaign folder) | Low — verify no agent harness links to current path |
| 8 | 7 HANDOFF files missing `updated:` frontmatter | Protocol violation — not blocking but will confuse future date-sorting | Add `updated:` field matching git log date | Zero — cosmetic fix |
| 9 | 16 `completed/` plans with `status: draft` (never updated at close) | Status field is meaningless after move — should say `done` | Update `status: done` in frontmatter | Zero — docs only |
| 10 | `AUDIT-P-001-2026-04-13.md`, `AUDIT-P-LOGIN-2026-04-13.md`, `AUDIT-P-LOGIN-2026-04-14.md` | 22 days old, tiny files (800-900 bytes each), superseded by PHASE-2-CAPABILITY-AUDIT and 2026-05-02 synthesis | Move to `docs/audits/archive/` or delete | Low — no ADR references found |

---

## Recommended Cull Order (Anbefalt cull-rekkefølge)

Ranked by: safety (high = no risk) × impact (high = most noise removed).

| Rank | Action | Safety | Impact | Notes |
|------|--------|--------|--------|-------|
| 1 | Delete zombie `wt-7` + local branch `feat/mobile-restore-4tab-plan` | High | Medium | Ask Pontus first — branch may have intended work |
| 2 | Delete remote `release/preview-to-main-2026-05-04` | Max | Low | PR merged, zero risk |
| 3 | Move 13 done-plans from root to `completed/` | Max | High | Pure housekeeping |
| 4 | Move 5 superseded journeys to archive | Max | Medium | Status is definitive |
| 5 | Move 23 old journeys (pre-2026-03-06) to archive | High | High | Confirm no active HANDOFF links first |
| 6 | Relocate 3 `dev-*/` subfolders out of `docs/journeys/` | High | Medium | Confirm agent harness paths |
| 7 | Confirm + delete `feat/journey-engine-publish-mission-body` remote | Medium | Low | Need campaign owner confirmation |
| 8 | Add `updated:` to 7 dateless HANDOFFs | Max | Low | Protocol hygiene |
| 9 | Fix 16 `completed/` plan status fields to `done` | Max | Low | Protocol hygiene |
| 10 | Archive 3 tiny April-13/14 audit files | High | Low | Noise reduction |

---

## Open Questions

1. **`wt-7` intent** — Was `feat/mobile-restore-4tab-plan` (wt-7, locked) supposed to replace `feat/mobile-mobile-restore-4tab-plan` (mobile-wt-1)? The naming suggests wt-7 was a sortie-pool slot started for the same feature but interrupted. Mobile-wt-1 has the real work. Pontus must confirm before force-removing wt-7.

2. **49 proposed ADRs** — High count. Are these all actively pending, or did council-session ADRs get stuck in `proposed` without a code-owner accepting them? A second pass to bucket `proposed` ADRs by age would surface zombie ADRs.

3. **6 LOCAL-ONLY mobile sub-sorties** (`mobile-wt-2` through `wt-6`, `schedule-harness-wt-1`) — uncommitted work exists only on this machine. If WSL/disk fails, that work is gone. Are these intentionally unpushed (in-progress) or forgotten?

4. **`feat/journey-engine-publish-mission-body`** — remote orphan with no local worktree. Was this superseded by `feat/journey-engine-runtime-loop`? Campaign owner (journey-engine) should confirm.

5. **`docs/journeys/platform-admin-authors-journey/`** — 12 files. Is this an active AI-mission package or a user journey spec? Different governance applies.

6. **`docs/plans/` naming discipline** — Two `2026-05-04-*.md` files in root plans/ don't follow PLAN- or CAMPAIGN- naming. Ad-hoc files will accumulate. Should a naming rule be enforced?

7. **Completed plans with `status: draft`** — 16 of 18 files in `completed/` still say `draft`. Is the `completed/` move sufficient, or should frontmatter be updated to `done`?
