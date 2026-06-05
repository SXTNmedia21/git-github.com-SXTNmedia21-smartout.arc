---
title: PLANLEGG — Ordered Build Plan, Fan-out + Gap-track
status: in_progress
created: 2026-06-05
updated: 2026-06-05
module: design-handoff
tags: [plan, planlegg, wave-order, fan-out, gap-track, s5]
---

# PLANLEGG — Ordered Build Plan

> **S5 output.** Consumed by dispatchers and builders. Frozen ordering — change only via PO
> decision or a new disk finding that shifts backend-readiness. All domain stats read from
> `docs/campaign/telemetry-map/AGGREGATE-control.json` and per-domain `TELEMETRY-MAP.md` files
> (2026-06-01–03). Route existence verified on disk (2026-06-05).

---

## Preconditions / State on Entry

| Fact | Status |
|------|--------|
| Foundation (tokens + harness) | done |
| Golden-path (`min-dag-v2`, commit `34ad5947a`) | L3 — tag `min-dag/ready` |
| `oversikt-v2` port | wip-L2, tracked on campaign; design also live on real `/dashboard` route (`d7bd69705`) |
| Telemetry registry | single: `packages/telemetry/src/registry.ts` (`EVENT_ROUTING`) |
| L3 unblock | smartout local Supabase on `:54321` (sxtn-ops currently occupies that port) — verify before any L3 run |
| P0 bug | `emit-coverage.sh` `REPO_ROOT` path wrong (`../..` should be `../../..`); fix before any L2 gate run |
| ADR-0047 | PO-pending (not a build blocker) |

These are not re-derived here — they are the disk state the campaign enters BYGG fan-out with.

---

## A. Per-Domain Plan Slices

### Notation

- **Class**: from `reuse-map.md` (code-wins, F7 corrected)
- **Backend-ready**: GREEN or PASS gate in `control.json` (all mutations have hooks + events registered) = backend-ready for fan-out; FAIL gate = gap-track
- **Friction**: light (≤20 elem, ≤15 events) / med (20–70 elem, 15–25 events) / heavy (>70 elem, >25 events)
- **Route**: verified `page.tsx` present on disk

---

### 1. oversikt — admin home

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/page.tsx` (root dashboard) |
| Design source | `apps/web/pages/oversikt.jsx`, `apps/web/shared/data.js` |
| Port files (exist) | `oversikt-v2/page.tsx`, `_lib/to-design-shape.ts`, `_components/OversiktCockpit.tsx`, `_components/oversikt.css` |
| Backend-ready | YES — gate PASS (only PASS on the board) |
| Friction | light — 19 elem, 0 mutations, 11 events (all registered) |
| Telemetry events | 11 all in registry: `oversikt.viewed`, `oversikt.pulse_tile_clicked`, `oversikt.action_queue_row_clicked`, `oversikt.action_cta_clicked`, `oversikt.nav_link_clicked`, `oversikt.gap_fill_requested`, `oversikt.receipt_nudge_sent`, `oversikt.dagsrapport_requested`, `oversikt.brief_why_toggled`, `oversikt.brief_action_taken`, `oversikt.budget_empty_state_shown` |
| Status | wip-L2 (port done, not yet L3); wire remaining noops, drive to L3 |
| Known gaps | 3 noops documented (gap_fill, dagsrapport, budget honest-empty) — already design-documented, not blockers |
| Payload bug | `receipt_nudge_sent` sets `profile_id = workspaceId` — fix in next pass (low severity) |

---

### 2. oppgaver — tasks

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/oppgaver/page.tsx` (verified) |
| Design source | `pages/oppgaver.jsx`, `pages/oppgaver-form.jsx` |
| Backend-ready | YES — gate GREEN (all events in registry, all mutations hooked or flagged) |
| Friction | light — 38 elem, 14 mutations, 19 events (all registered) |
| Telemetry events | 19 in registry; all mutations gated (ADR-0099/0114/0134/0151 closed for `addTaskAction` + `assignTaskAction`) |
| Status | gate GREEN; port not yet started — next-in-line after oversikt |
| Known gaps | P3 hooks (bulk-complete, DnD, subtask, flow-player, etc.) — explicitly future sorties, not fan-out blockers; `control_list_attempt` backend gap (reuse-map flags this — see B1 gap-track note for the hook) |
| W1 telemetry item | `w1-vaktplan-telemetry-sweep` is in worklist for vaktplan; oppgaver has no pending W1 sweep item — it is clean |

---

### 3. planlegging — planning / year-wheel

| Field | Value |
|-------|-------|
| Class | re-skin (overlaps `planning/`, `year-wheel/`, `season/[seasonId]/`) |
| Route | `apps/web/src/app/dashboard/planning/page.tsx` + `year-wheel/page.tsx` (both verified); `season/page.tsx` absent — `season/[seasonId]/page.tsx` exists (dynamic route) |
| Design source | `planlegging.jsx`, `planlegging-data.jsx`, `planlegging-panels.jsx`, `planlegging-season.jsx`, `planlegging-views.jsx` |
| Backend-ready | NO — gate FAIL |
| Friction | med — 43 elem, 14 mutations, 29 events (16 in registry, 13 missing) |
| Telemetry events missing | 13 events unregistered (calendar nav, layer toggles, filter, saved-view, attention, booking confirm/cancel, leave approve/reject, Botsson CTAs) |
| Gap-track blockers | B1: `use-budget.ts:103` ungated direct `.upsert()` to `workspace_budget` (F0.3 offender); B2: no booking-create hook (`schedule_day_booking`); B3: no leave approve/reject hook; B4: opening-hours save hook missing; B5: 13 unregistered events |
| Classification | GAP-TRACK |

---

### 4. kommunikasjon — communication

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/komm/page.tsx` (verified; NO-language route) |
| Design source | `pages/kommunikasjon.jsx`, `kommunikasjon-compose.jsx`, `kommunikasjon-detail.jsx`, `kommunikasjon-shared.jsx`, `kommunikasjon-skranke.jsx`, `kommunikasjon-skranke-views.jsx`, `kommunikasjon-case.jsx` |
| Backend-ready | NO — gate FAIL |
| Friction | med — 46 elem, 22 mutations, 22 events (8 in registry, 14 missing) |
| Telemetry events missing | 14: announcement lifecycle (draft/scheduled/archived/republished/reminder/comment), helpdesk (reply/note/ai/priority/reopen), channel (updated/reopened) |
| Gap-track blockers | B1: 14 unregistered events; B2: `notification_outbox` 0-seeded for announcement reminders — no backend path; B3: Skranke helpdesk tab mock-only (9 mutations without hooks); B4: announcement comment thread is design fiction (no DB table); partial: 3 hooks exist-but-unwired (togglePin, upsertAnn-publish, upsertChannel-create) |
| W1 worklist | `w1-kommunikasjon-telemetry-sweep` done (2026-06-03, 27 L3-routed events); W2 port item `w2-port-kommunikasjon` still ready |
| Note | W1 sweep closed the L3 routing work; the port visual + remaining hook-wiring is W2 scope; skranke is gap-track due to B3 |
| Classification | GAP-TRACK (skranke sub-track; announcements+channels backend-mostly-ready) |

---

### 5. lonn — payroll

| Field | Value |
|-------|-------|
| Class | re-skin + `my-salary/` employee view |
| Route | `apps/web/src/app/dashboard/payroll/page.tsx` + `my-salary/page.tsx` (both verified) |
| Design source | `lonn.jsx`, `lonn-config.jsx`, `lonn-overlays.jsx`, `lonn-shared.jsx`, `lonn-views.jsx`, `min-lonn.jsx` |
| Backend-ready | YES — gate GREEN (all 13 events registered, all mutations hooked or flagged, malformed event fixed) |
| Friction | med — 71 elem, 13 mutations, 13 events (all registered, 10 hooks found + wired-confirmed for key paths) |
| Telemetry events | 13 in registry; 3 P1/P2 gaps flagged (deviation-reject, timebank-withdrawal, supplement-test-run) — not fan-out blockers, future sorties |
| Status | gate GREEN; not yet ported — W2 scope |
| Known gaps | `min-lonn` data gap: `payroll.calculation` empty for open periods (F0.4 seed required); SCHEMA_TRAP: all callers must use `.schema('payroll')` |
| W1 worklist | `w1-lonn-telemetry-sweep` ready (still pending) |

---

### 6. rapporter — reports

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/reports/page.tsx` (verified) |
| Design source | `rapporter.jsx` + 7 sub-views (oversikt/insikt/bygger/datakilder/planlagte + drilldown) |
| Backend-ready | UNKNOWN — no `control.json` exists; telemetry-map present but no gate |
| Friction | med — 41+ elem (58 counting planlagte detail + drilldown), 14 mutations, 30 events missing from registry |
| Telemetry events | 2 generic events in registry; 30 domain-specific events missing |
| Gap-track flags | TRAP 1: `rapporter-planlagte` DESCOPED — `custom_report` table has no schedule/cron/cadence columns; all planlagte interactions are backend=NONE; TRAP 2: `protocol_assignment` workspace-filter in-memory only (isolation gap, not critical for port); write hook for `custom_report` INSERT missing; insight approval has no backend persistence |
| Action needed | Generate `control.json` (run telemetry-map batch 2) before this domain enters a wave; port visual unblocked; planlagte surface renders honestly with descoped noops |
| Classification | NEEDS control.json — likely GAP-TRACK for planlagte tab; main tabs (oversikt/insikt/bygger/datakilder) are backend-partial-ready |

---

### 7. handbook — handbook / bibliotek

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/handbook/page.tsx` (verified) |
| Design source | `handbook.jsx`, `handbook-shared.jsx`, `handbook-views.jsx`, `handbook-editor.jsx`, `handbook-create.jsx` |
| Backend-ready | PARTIAL — no `control.json`; telemetry-map exists; 7 events in registry (chapter_opened/saved, governance.content_updated), 10 events missing |
| Friction | light-med — 36 elem, 3 real DB mutations, 10 events missing |
| Telemetry events missing | 10: search_executed, create_initiated, wizard_started, wizard_block_accepted, wizard_block_rewrite_requested, ai_suggestion_accepted, ai_suggestion_dismissed, gap_actioned, gap_dismissed, chapter_archived |
| Hooks | `useHandbookSave` + `upsertHandbookChapterAction` cover main mutations; archive hook missing; approval state-machine (draft→review→approved) has no backend persistence |
| Gap-track flags | TRAP 1: `handbook_chapter` has 0 seed rows (E2E blocked); TRAP 3: most editor interactions mock-only; AI semantic search descoped to v2 |
| Action needed | Generate `control.json`; then port visual; register 10 events; archive hook is the only new hook needed for non-mock paths |
| Classification | NEEDS control.json — likely backend-mostly-ready (low real mutations, 2 hooks exist); advance after control.json proves it |

---

### 8. hms — health, safety, environment

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/hms/page.tsx` (verified) |
| Design source | `hms.jsx`, `hms-avvik.jsx`, `hms-dashboard.jsx`, `hms-entities.jsx`, `hms-protocol.jsx`, `hms-shared.jsx`, `hms-tracking.jsx`, `hms-wizard.jsx` |
| Backend-ready | YES — gate GREEN (all 38 events registered, all mutations hooked, `use-create-protocol.ts` delivered) |
| Friction | heavy — 145 elem, 38 mutations, 38 events; biggest sweep |
| Telemetry events | 38 in registry; 0 missing |
| Status | gate GREEN; not yet ported — W3 scope |
| Known gaps | Seed blockers (F0.4): `haccp_log`, `knowledge_test_attempt`, `confirmation_signature` all 0-seeded → E2E blocked until F0.4 seed approved; ENV-BLOCKED for live E2E (op token); static gates pass |
| ADR note | HMS campaign shipped on `development` branch (`6526d2de9`) — reuse those patterns |
| W1 worklist | `w1-hms-telemetry-sweep` ready (still pending; 49 partial components) |

---

### 9. ansatte — employees / people

| Field | Value |
|-------|-------|
| Class | re-skin + split (people/ + contracts/ + my-* family) |
| Routes | `apps/web/src/app/dashboard/people/page.tsx`, `contracts/page.tsx` (both verified); `my-contract/`, `my-cv/`, `my-salary/`, `my-schedule/`, `my-training/` (verified); `my-profile/page.tsx` ABSENT (only `my-profile/complete/page.tsx` exists — flag) |
| Design source | `ansatte.jsx`, `ansatte-directory.jsx`, `ansatte-contracts.jsx`, `ansatte-controls.jsx`, `ansatte-panels.jsx`, `ansatte-panels2.jsx`, `ansatte-profile.jsx`, `ansatte-templates.jsx`, `ansatte-shared.jsx` |
| Backend-ready | NO — gate FAIL |
| Friction | heavy — 164 elem, 34 mutations, 20 events missing from registry |
| Telemetry events missing | 20 (bulk actions, competence/absence/document/task/recert/contract/message/audit events) |
| Hooks missing | 24 hooks (profile save/access/placement, activate/reactivate, absence, competence, assign-protocols/legal, recert, contract-template, bulk-assign-training, bulk-message/dept, export-contracts/audit, send-document, assign-task, add-to-daily-list, direct-message) |
| Gap-track blockers | 20 unregistered events; 24 missing hooks; 2 bulk actions have no API route yet; MessageThread is client-only; IDENTITY FLAG on PII reveal (must join user_identity, not auth.users); ADR-0114 violations (5 client-side DB writes must be gated first per W3 worklist item) |
| Classification | GAP-TRACK |

---

### 10. avstemming — reconciliation

| Field | Value |
|-------|-------|
| Class | re-skin |
| Route | `apps/web/src/app/dashboard/reconciliation/page.tsx` (verified) |
| Design source | `pages/avstemming.jsx`, `pages/avstemming-daglig.jsx`, `pages/avstemming-forms.jsx`, `pages/avstemming-more.jsx`, `pages/avstemming-shared.jsx` |
| Backend-ready | NO — gate FAIL |
| Friction | heavy — 97 elem, 40 mutations, 11 events missing from registry |
| Telemetry events missing | 11 (reconciliation exported/bulk_approved/revenue_adjusted/shift_proposal_sent/occupational_closed/season_closed, handoff resolved/escalated/reminder_sent/rejected, reconciliation policy_updated) |
| Hooks missing | 11 (adjust-revenue, submit-handoff, propose-shift-hours, bulk-approve, resolve-handoff, escalate-handoff, handoff-reminder, reject-handoff, close-occupational, close-season, update-policy) |
| Gap-track blockers | CRITICAL: `daily_reconciliation`, `shift_approval`, `session_note` tables have 0 seed rows → E2E BLOCKED until F0.4 migration + seed; 11 missing events; 11 missing hooks |
| Note | 5 hooks already exist and reusable (approve/reject/approve-shift-hours/resolve-deviation/lockDay) |
| Classification | GAP-TRACK |

---

### 11. vaktplan — schedule

| Field | Value |
|-------|-------|
| Class | re-skin/rewire |
| Route | `apps/web/src/app/dashboard/schedule/page.tsx` (verified) |
| Design source | `vaktplan.jsx`, `vaktplan-parts.jsx`, `vaktplan-controller.jsx`, `vaktplan-availability.jsx`, `vaktplan-turnus.jsx`, `vaktplan-profile.jsx`, `vaktplan-print.jsx` |
| Backend-ready | NO — gate FAIL |
| Friction | heavy — 153 elem, 91 mutations, 33 events missing from registry |
| Telemetry events missing | 33 (nav/grouping/filter/gap-fill/planner/export/pdf, shift lifecycle sub-actions, session_task/shift supplement, Botsson, comms, shift_swap/absence approve-reject, roster updates, shift_offer.posted) |
| Hooks missing | 6 (useShiftLifecycleApprove, useWeekNavTelemetry, useScheduleGrouping, useScheduleFilter, usePlannerTelemetry, + publish-shifts extension) |
| Gap-track blockers | 33 missing events; 18 shift write paths bypass cascade gate (C4/enforce-gates — MUST be gated before production); 6 hooks missing; RSC-excluded (ADR-0115) — requires exit ADR before visual port can land on real route |
| Classification | GAP-TRACK (heaviest — goes LAST per lesson `wave-order: friction-first wins, vaktplan LAST`) |
| ADR-0115 note | RSC exclusion means the current `schedule/` route uses client-only RSC fallback. An exit ADR must be written and PO-approved before the Nordic Split visual can be wired to the real route. This is the longest pole for vaktplan. |

---

### 12. min — employee self-service family

> The `min` family (`my-contract/`, `my-cv/`, `my-salary/`, `my-schedule/`, `my-training/`) is treated
> as a sub-group within the `ansatte` domain in MISSION-MANIFEST. `min-dag` (the golden-path) is already done.
> The remaining `my-*` surfaces follow `ansatte` in wave order.

| Field | Value |
|-------|-------|
| Class | re-skin |
| Routes | `my-contract/`, `my-cv/`, `my-salary/` (shared with lonn), `my-schedule/`, `my-training/` verified; `my-profile/page.tsx` ABSENT (only `my-profile/complete/` exists — DRIFT flagged) |
| Design source | `min-lonn.jsx` (covered in lonn slice); remaining `my-*` surfaces not yet explicitly telemetry-mapped |
| Backend-ready | PARTIAL (follows ansatte gate for profile/contract surfaces; lonn slice covers `my-salary`) |
| Status | No standalone control.json for the non-lonn my-* surfaces — needs batch-2 telemetry map |
| Classification | DEFERRED — resolve alongside ansatte gap-track; `my-salary` port follows lonn W2 |

---

## B. Ordered Wave Sequence

### State recap before ordering

| Domain | Gate | Backend-ready | Friction |
|--------|------|--------------|----------|
| oversikt | PASS | YES | light |
| oppgaver | GREEN | YES | light |
| lonn | GREEN | YES | med |
| hms | GREEN | YES | heavy |
| min-dag | GREEN | DONE (golden-path) | — |
| kommunikasjon | FAIL | GAP-TRACK (partial) | med |
| planlegging | FAIL | GAP-TRACK | med |
| ansatte | FAIL | GAP-TRACK | heavy |
| avstemming | FAIL | GAP-TRACK | heavy |
| vaktplan | FAIL | GAP-TRACK | heavy |
| rapporter | NO control.json | UNKNOWN | med |
| handbook | NO control.json | PARTIAL | light-med |

### Fan-out order (backend-ready domains, friction-first)

```
W1 — oversikt (in-flight, drive to L3)
W2 — oppgaver  [light, gate GREEN]
W3 — lonn      [med, gate GREEN; my-salary co-ports here]
W4 — hms       [heavy, gate GREEN; all 38 events + hooks done]
```

> These four are the backend-ready fan-out. They run in isolated worktrees. Each must reach L3
> before the next wave opens (per MISSION milestone gates M1→M2).

### Handbook / rapporter (control.json generation first)

Before these enter a wave, batch-2 telemetry-mapping must produce their `control.json`.
Once control.json exists:

- `handbook` likely enters W2 or W3 (light-med, only 3 real mutations, 2 hooks exist)
- `rapporter` main tabs likely enter W3 (med, 4 hooks exist); `planlagte` tab is gap-track

Pending control.json = insert them into the wave order after the map confirms their gate.

### Gap-track list (backend must close first — longest-pole blocker named)

| # | Domain | Longest-pole blocker | Notes |
|---|--------|---------------------|-------|
| GT-1 | planlegging | `use-budget.ts:103` ungated upsert (F0.3) + booking-create hook missing | 5 critical blockers; season-financials subset unblocked; budget-tiles F0.4 blocked |
| GT-2 | kommunikasjon | Skranke helpdesk tab: 9 mutations with no hooks + no schema for case-status | Announcements+channels backend-mostly-ready and can advance separately |
| GT-3 | ansatte | 24 missing hooks; 5 ADR-0114 client-side writes must be gated first (worklist `w3-fix-adr0114-client-writes`) | IDENTITY FLAG on PII reveal — privileged server route required |
| GT-4 | avstemming | F0.4 seed migration required (`daily_reconciliation`, `shift_approval`, `session_note` 0-seeded) | 11 missing hooks; DB-wall blocks all write paths until F0.4 approved |
| GT-5 | vaktplan | ADR-0115 exit ADR (RSC exclusion) — PO decision; 18 ungated shift writes; 33 missing events | Goes LAST — heaviest; exit ADR is the critical dependency |

Gap-track domains enter the build queue only after their named blocker is resolved and confirmed on disk. The Database Agent works GT-4 (F0.4) in parallel; PO must approve ADR-0115 exit for GT-5.

---

## C. Per-Slice Acceptance Criteria (Gate Battery)

Every domain slice must satisfy all of the following before the `commit-steward` can tag it and before G8 human accept:

### Static gates (disk-verifiable, no running app needed)

1. **Copy fidelity** — `diff` of ported file vs design source: only plumbing changes (`"use client"` + export + React imports). Line-count delta ≤ 2× source = accepted; > 2× = rewrite, reject.
2. **Typecheck** — `TURBO_CONCURRENCY=1 pnpm --filter web typecheck` exits 0.
3. **No hex / no inline oklch** — no `#` hex or raw `oklch()` in app files (ADR-0366); only design-tokens / Tailwind theme tokens / `var(--token)`.
4. **No direct browser DB writes** — no `supabase.from(...).insert/update/delete` in `.tsx`/`.ts` client files; all mutations via gated server actions.
5. **All events registered** — `emit-coverage.sh` (after `REPO_ROOT` path bug fix) exits 0 — no phantom events for the domain.
6. **Telemetry dist rebuilt** — `pnpm --filter @smartout/telemetry build` succeeds after any registry.ts change.
7. **control.json gate** — domain's `control.json` shows `gate == "PASS"` and `blockers == []` and all `control_points` true.

### Live gates (require running app — L3)

8. **Real-or-empty data** — no hardcoded samples, no `Math.random()` as real data; adapter maps real rows or renders honest empty state.
9. **L3 proven** — fire each domain event for real (browser action) → assert row in `activity_trail` (DB-assert, not UI-200) → `emit-coverage.sh` 0 phantoms.
10. **G8 human accept** — Pontus reviews + approves; he decides push/merge. Builder and verifier never self-approve G8.

### Commit shape (commit-steward rule)

- Tag format: `<domain>/ready` (e.g. `oppgaver/ready`)
- Commit message: `feat(<domain>): port + wire + L3 — <brief>`
- Ledger entry in `docs/campaign/COMMIT-LEDGER.md`

---

## D. Open Questions for PO / Pontus

These cannot be resolved from disk. They are not build blockers for the fan-out domains, but they gate specific gap-track work.

| # | Question | Blocked domain(s) | Default if no answer |
|---|----------|------------------|----------------------|
| OQ-1 | **ADR-0115 exit ADR** — approve vaktplan leaving the RSC-exclusion zone? What is the new rendering strategy for `schedule/`? | vaktplan (GT-5) | Vaktplan stays LAST; no port begins until ADR approved. Default = keep RSC exclusion, port visual to client component only, no SSR data on first load. |
| OQ-2 | **F0.4 seed approval** — approve the `daily_reconciliation`, `shift_approval`, `session_note` seed migration for local DB? | avstemming (GT-4); also hms (haccp_log/knowledge_test_attempt/confirmation_signature) | Default = domains stay in gap-track; E2E remains ENV-BLOCKED; L2 static gates can proceed. |
| OQ-3 | **kommunikasjon skranke model** — the helpdesk case-status column doesn't exist. Approve schema extension, or descope skranke to honest-empty? | kommunikasjon (GT-2) | Default = descope skranke to honest-empty/read-only for fan-out; schedule skranke as a separate gap-track sortie once schema is decided. |
| OQ-4 | **rapporter + handbook control.json** — approve dispatching batch-2 telemetry-map agents to produce missing `control.json` for these two domains? | rapporter, handbook | Default = YES, generate control.json immediately; no code written, no DB touched — pure analysis. Blocks their wave-placement. |
| OQ-5 | **my-profile route gap** — `my-profile/page.tsx` does not exist (only `my-profile/complete/page.tsx`). Is the top-level my-profile surface a new route (DB-wall gated new build) or does it live under the people directory? | ansatte/min family | Default = treat `people/[profileId]` as the profile surface; do not create new route without approval. |
| OQ-6 | **planlegging booking-create** — `schedule_day_booking` hook: is booking creation in scope for this campaign wave, or descope to honest-empty CTA? | planlegging (GT-1) | Default = honest-empty CTA (toast "not available yet" + `planlegging.create_button_used` event); hook build is a separate gap-track sortie. |
| OQ-7 | **ADR-0047 promotion** — when does the locked ruleset get promoted to a campaign ADR? | All domains (governance) | Default = continue operating under dossier + CLAUDE.md until PO decides; not a build blocker. |

---

## E. Drift Findings (disk vs artifact mismatch)

These were discovered during route verification (2026-06-05). Surface to Pontus before starting affected slices.

| Finding | Artifact claim | Disk reality | Action |
|---------|---------------|-------------|--------|
| `my-profile/page.tsx` absent | reuse-map lists `my-*` family as existing routes | Only `my-profile/complete/page.tsx` exists; no top-level `my-profile/page.tsx` | Surface to PO (OQ-5); do not create route without approval |
| `season/page.tsx` absent | reuse-map + planlegging design reference `season/` as a route | `season/[seasonId]/page.tsx` exists (dynamic); no static `season/page.tsx` | Season is a dynamic sub-route; planlegging ports to `planning/page.tsx` (static root) + references `[seasonId]` for drill-down |
| rapporter has no `control.json` | DRIVE-TO-100 expects 13 control.json files | Only `TELEMETRY-MAP.md` + `PLAN.md` exist in `telemetry-map/rapporter/` | Dispatch batch-2 telemetry-map agent to generate `control.json` (OQ-4) |
| handbook has no `control.json` | Same | Same | Same |
| P0 bug: `emit-coverage.sh` REPO_ROOT | `emit-coverage.sh` used `../..` for REPO_ROOT | Correct path is `../../..` (script relocated 3 levels deep); L2 gate dark across all domains | Fix before any L2 gate run |

---

## F. Summary Reference (one-page)

```
BYGG fan-out entry state (2026-06-05):
  PASS:  oversikt (in-flight to L3)
  GREEN: oppgaver, lonn, hms, min-dag(done)
  FAIL:  kommunikasjon, planlegging, ansatte, avstemming, vaktplan
  NO-CJ: rapporter, handbook

Fan-out wave order (friction-first, vaktplan LAST):
  W1  oversikt        → drive to L3 (port done, L2 wip)
  W2  oppgaver        → port + wire + L3  [worktree-isolated]
  W3  lonn            → port + wire + L3  [+ my-salary co-port]
  W4  hms             → port + wire + L3
  W?  handbook        → after control.json (likely W2–W3 slot)
  W?  rapporter       → after control.json (main tabs W3, planlagte gap-track)

Gap-track queue (backend must close before port begins):
  GT-1  planlegging   → F0.3 gate fix + booking hook decision (OQ-6)
  GT-2  kommunikasjon → skranke schema decision (OQ-3)
  GT-3  ansatte       → ADR-0114 gate-fixes + 24 hooks (longest internal pole)
  GT-4  avstemming    → F0.4 seed approval (OQ-2)
  GT-5  vaktplan      → ADR-0115 exit ADR (OQ-1) — LAST

Immediate next actions:
  1. Fix emit-coverage.sh REPO_ROOT path (P0 bug — unblocks L2 gate across all domains)
  2. Dispatch batch-2 telemetry-map for rapporter + handbook → produce control.json (OQ-4)
  3. Drive oversikt to L3 (once smartout local Supabase confirmed on :54321)
  4. Open oppgaver worktree → W2 port run
  5. Escalate OQ-1/OQ-2/OQ-3 to Pontus for gap-track unblocking
```

---

*Sources: `docs/campaign/reuse-map.md` · `docs/campaign/telemetry-map/AGGREGATE-control.json` ·
per-domain `TELEMETRY-MAP.md` files · `docs/campaign/MISSION-MANIFEST.md` · `docs/campaign/worklist.json` ·
route disk verification 2026-06-05.*
