---
title: Journey Sweep — Bug List (2026-05-23/24)
status: complete
updated: 2026-05-24 (BUG-16/17 fixed in hotfix/mech-fixes-bug-16-17-22)
created: 2026-05-24
module: meta
tags: [bugs, journey-verification, playwright]
---

# Journey Sweep — Bugs Found

22 distinct bugs from 47-run sweep (~500 test cases). Ordered: SCHEMA → PRODUCT → HARNESS → ENV → OPS.

---

## SCHEMA bugs (database-level, production landmine)

### BUG-8 — `channel.workspace_id_fkey` missing `ON DELETE CASCADE` 🔴 CRITICAL
- **Where:** `channel` table foreign key to `workspace.workspace_id`
- **Evidence:** `run-18-dashboard-setup` + `run-19-workspace-setup` + `run-24-rerun` (consistent across both)
- **Error:** `update or delete on table "workspace" violates foreign key constraint "channel_workspace_id_fkey" on table "channel"`
- **Impact:** Blocks all test fixtures that recycle a workspace. Production landmine — workspace deletion will fail.
- **Fix:**
  ```sql
  ALTER TABLE channel DROP CONSTRAINT channel_workspace_id_fkey;
  ALTER TABLE channel ADD CONSTRAINT channel_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE;
  ```

### BUG-12 — `employment_contract.employment_form` NOT NULL but seed helper doesn't set it 🔴 CRITICAL
- **Where:** `employment_contract` table column `employment_form`
- **Evidence:** `run-37-contracts-rerun` — 5 tests fail in `employee-contract-cancel.spec.ts` + `employee-contract-send.spec.ts` at `setup — seed draft contract`
- **Error:** `null value in column "employment_form" of relation "employment_contract" violates not-null constraint`
- **Impact:** Recent migration added NOT NULL but `seedContract`/`seedDraftContract` helpers in `apps/e2e/helpers/contract-harness.ts` (likely) not updated
- **Fix:** Add `employment_form: 'permanent_full_time'` (or correct enum default) to seed helpers

---

## PRODUCT bugs (real UI/API/logic regressions)

### BUG-1 — `engine_authority_config` missing seed for `communication` capability 🔴 CRITICAL
- **Where:** `engine_authority_config` table, capability=`communication`
- **Evidence:** `run-08-komm-nyheter` (3 tests fail with explicit message)
- **Error:** literal `"engine_authority_config missing for capability=communication. Run migration 20260601100000_seed_communication_authority.sql first."`
- **Impact:** `publish_announcement` capability blocked end-to-end. Likely cascade to BUG-20 (helpdesk SLA).
- **Fix:** `npx supabase db reset` OR apply seed migration directly

### BUG-2 — Audience selector strict-mode violation
- **Where:** `komm-nyheter` audience picker — `getByRole('button', { name: /bar/i })` matches 5 elements
- **Evidence:** `run-08` `journey-2-audience-targeting.spec.ts:66`
- **Impact:** Selector ambiguity in real UI
- **Fix:** Add `data-testid="audience-dept-<id>"` to department picker buttons

### BUG-3 — Pin/unpin announcement DB shape wrong
- **Where:** `pin_announcement` capability
- **Evidence:** `run-08` `journey-3-pin-unpin-realtime.spec.ts:145, 185`
- **Impact:** After pin, `pinned_by` + `pinned_at` columns undefined; client-side emit races with page unload
- **Fix:** New `pin_message` capability tool in `packages/ai/src/capabilities/communication/pin-message.ts` writes `is_pinned + pinned_by + pinned_at` atomically with awaited emit (ADR-0415 Path A). Server Action thin-wraps tool. Hook fire-and-forget emit removed.
- **Status:** fixed-in-PR — hotfix/pin-message-capability-bug-3-v2

### BUG-4 — Slot quickadd popover broken (4 click timeouts)
- **Where:** `/dashboard/day/<date>` slot interaction
- **Evidence:** `run-09-dagslinjen-quickadd` slot-quickadd.spec.ts — H1 Booking, H2 Notat, H3 Oppgave, H4 Avvik (4 tests)
- **Impact:** Click on 08:00 slot never opens popover within 15s
- **Fix:** Manual repro — check popover anchor + data-testid drift OR seed gap (no department_session for "today")

### BUG-5 — Filter timeline 3-tab popover broken
- **Where:** Dagslinjen filter pill 3-tab popover
- **Evidence:** `run-09` filter-timeline.spec.ts — H1 team, H2 shift, H3 reset (3 fail; H4 reload-preserves passes)
- **Impact:** Click-to-update broken; read-from-URL works
- **Fix:** Likely regression post-ui-shell merges — trace 3-tab interaction

### BUG-6 — `/api/contracts/send` returns 400 instead of 202
- **Where:** `apps/web/src/app/api/contracts/send/route.ts`
- **Evidence:** `run-07-contract-employee` `tests/contract-employee/journey-2-admin-send.spec.ts:192`
- **Impact:** Zod schema mismatch (body OR DocuSeal stub config drift)
- **Fix:** Trace handler + golden test data

### BUG-7 — note-fanout-scheduler auth guard returns wrong status
- **Where:** `/api/note-fanout-scheduler` route
- **Evidence:** `run-09` employee-receives-note.spec.ts:467 (`rejects request with wrong secret → 401`)
- **Impact:** Returns wrong status on wrong-secret request
- **Fix:** Trace route handler auth check

### BUG-9 — Billing combobox option `Fjelds mat` not findable
- **Where:** `/platform-admin/billing` ad-hoc invoice company picker
- **Evidence:** `run-26-billing-product-rerun` mixed-lines test
- **Impact:** `getByRole('option', { name: 'Fjelds mat' }).first()` times out 15s
- **Fix:** Confirm company exists in seed; if yes, debug combobox population

### BUG-10 — Billing product catalog: duplicate `data-testid="ad-hoc-invoice-open"` in DOM
- **Where:** Billing page renders two buttons with same testid
- **Evidence:** `run-26-billing-product-rerun` smoke + edit-clear (2 tests, strict-mode violation)
- **Impact:** Strict mode resolves to 2 elements (one hidden, one visible)
- **Fix:** Make testid unique — likely DashboardShell + page both render the button

### BUG-11 — Contract templates Maler tab: `/api/contracts/templates` never fires on mount
- **Where:** Maler tab page component
- **Evidence:** `run-28-contract-template-rerun` (`@smoke Maler tab — clone K1a system template into workspace`)
- **Impact:** `waitForResponse` for `/api/contracts/templates?workspace_id=<HQ>` times out 10s; rerun confirms not cascade
- **Fix:** Trace component — confirm `useContractsTemplates(workspaceId)` called on mount + workspace_id resolved

### BUG-13 — Multiple contract UI elements not visible (8 tests)
- **Where:** Multiple contracts/ surfaces — bindings-tab, drift-drawer, composition-drawer (CTA + ESC), employee-contract-create CTA, preview-editor, hub-redesign
- **Evidence:** `run-37-contracts-rerun` (8 tests, `element(s) not found`)
- **Impact:** Real UI gap or testid drift across multiple surfaces
- **Fix:** Manual repro — navigate `/dashboard/contracts` + inspect DOM vs expected testids

### BUG-14 — Page crashes on contract surfaces (3 tests)
- **Where:** employee-contract-create (HTML edit), hub-redesign, reverse-flow
- **Evidence:** `run-37-contracts-rerun` — chromium "Page crashed" even with healthy web + RAM
- **Impact:** Tab crashes inside browser process (not WSL2 OOM)
- **Fix:** Isolated repro with RAM > 6 Gi to confirm — likely heavy DocuSeal embed bundle

### BUG-15 — Domain chat ownership: 7/8 fail (Orb suppression broken — ADR-0238)
- **Where:** ADR-0238 surface-ownership enforcement
- **Evidence:** `run-30-domain-chat-ownership` — botsson-provider-scope, komm-chat-passive, komm-thread-passive, schedule-active
- **Impact:** Orb should suppress when domain chat declares ownership — appears broken across 4 specs
- **Fix:** Trace `useDomainChatOwnership` hook + BotssonProvider scope detection. Matches L-0178 in MEMORY.md.

### BUG-16 — Contracts-compliance: ALL 11 tests auth-fail with `Invalid login credentials` 🔴 CRITICAL — **FIXED in PR hotfix/mech-fixes-bug-16-17-22**
- **Where:** `tests/contracts-compliance*/*.spec.ts` (5 spec files)
- **Evidence:** `run-34` + `run-38-rerun` (consistent — not cascade)
- **Impact:** Fixture pre-check succeeds for `admin@smartout.local`; spec-level auth path fails
- **Root cause:** `journey-a-singular-bypass.spec.ts` used `anna@strommatabar.local`/`testpassword123` (stale seed domain). `journey-d-pdf-gate-bypass.spec.ts` used `testpassword123` for admin. Both now aligned to `anna@smartout.local`/`password123` and `password123` respectively.
- **Fix:** Credential mismatch fixed in both specs.

### BUG-17 — HMS suite broad regression (11/13 fail) — **PARTIAL FIX in PR hotfix/mech-fixes-bug-16-17-22** (strict-mode locator)
- **Where:** `tests/hms-{avvik,drift,oversikt,signoff}.spec.ts`
- **Evidence:** `run-41-hms`
- **Impact:** Broad HMS surface failure — likely related to recent ui-shell-hms-cluster-polish + r2-fixup work (MEMORY.md)
- **Mechanical fix applied:** `hms-drift.spec.ts` `page.locator("text=2026")` → `.first()` — resolves strict-mode: both "Vinter 2026" season chip and date bar match "2026".
- **Remaining:** Other HMS failures (avvik/oversikt/signoff) are product-level regressions, not mechanical harness issues. Need separate investigation.

### BUG-18 — Day-line: 2 tests fail + 8 skip
- **Where:** `tests/day-line/{create,attach-routine,edit-hours}.spec.ts`
- **Evidence:** `run-29-day-line`
- **Impact:** 8/11 skip — missing seed; 2 real fails — interaction bugs (correlate with BUG-4/5)
- **Fix:** Seed `department_session` + `day_line` for current date; investigate 2 fails

### BUG-19 — Cascade UI: 8/18 fail
- **Where:** `tests/cascade-bootstrap.spec.ts + cascade-ui.spec.ts`
- **Evidence:** `run-32`
- **Impact:** Core I1+6D+4C bootstrap works (10 PASS); UI-edge cases fail
- **Fix:** Inspect 8 failures

### BUG-20 — Helpdesk SLA: 0/4 PASS (all 4 fail)
- **Where:** `tests/helpdesk-sla-{auto-escalation,manager-overdue-action,rep-overdue-badge}.spec.ts`
- **Evidence:** `run-43-helpdesk-sla`
- **Impact:** All SLA auto-escalation flows broken
- **Fix:** Likely cascade from BUG-1 (engine_authority_config family) + `engine_delayed_trigger` cron not running locally

### BUG-21 — Journey-help suite: 11/24 fail + 13 DNR
- **Where:** `tests/journey-help-*.spec.ts` (8 specs — active-ticket variants + tour variants + v1)
- **Evidence:** `run-46-journey-help`
- **Impact:** Heavy fail — systematic help-surface regression OR cascade
- **Fix:** Rerun isolated to disambiguate; investigate Help v1 page first

### BUG-22 — Journey-shift: 6/16 fail
- **Where:** `tests/journey-shift-{clock,session-spine,temporal-lock}.spec.ts`
- **Evidence:** `run-47-journey-shift`
- **Impact:** Partial — clock-in core works (8 PASS); edge cases fail (6)
- **Fix:** Inspect specific failures — may correlate with `schedule_shift.status` enum drift

---

## HARNESS bugs (test infra, blocks sweep itself)

### HARNESS-1 — `apps/e2e/db/` + `apps/e2e/runners/__tests__/` poison Playwright glob discovery
- **Where:** `apps/e2e/db/*.spec.ts` + `apps/e2e/runners/__tests__/*.test.ts`
- **Error:** `Vitest cannot be imported in a CommonJS module using require()`
- **Impact:** Blocks any `--grep` or root-glob sweep (forced explicit-path runs throughout this sweep)
- **Fix:** Move to separate `vitest` project OR exclude from `testMatch` in `playwright.config.ts`
- **Status: fixed-in-PR** — `hotfix/playwright-testmatch-narrow` narrows `testMatch` regex to use a
  negative lookahead (`/^(?!.*\/(?:db|runners\/__tests__)\/)\S+\.(spec|test)\.ts$/`) that prevents
  Playwright from discovering files in those subdirs. Verified 0 Vitest errors in `--list` output.

### HARNESS-2 — `apps/e2e/admin/*.spec.ts` hardcode `http://localhost:3070`
- **Where:** All `apps/e2e/admin/*.spec.ts`
- **Impact:** Specs require `apps/admin` (port 3070) but `playwright.config.ts.webServer` only starts apps/web (3060) + apps/landing (3056)
- **Fix:** Add admin app to webServer OR document explicitly

### HARNESS-3 — Playwright `webServer` includes landing (3056) without conditional skip
- **Where:** `playwright.config.ts`
- **Impact:** Runs fail "Process from config.webServer exited early" when landing dev not pre-started
- **Workaround:** `SKIP_WEB_SERVER=1`
- **Fix:** Make `webServer` entries individually skippable

---

## ENV gaps (seed/secret missing)

### ENV-1 — `WATCHDOG_CRON_SECRET` missing from `apps/e2e/.env.local`
- **Impact:** 8 tests in `employee-receives-note.spec.ts` skip with explicit message
- **Fix:** Add `WATCHDOG_CRON_SECRET=local-dev-secret` to env

### ENV-2 — `admin/` tests skip (10/11 avstemming, 8/8 kartotek, 5/5 orders)
- **Impact:** Likely missing accountant grants + company seed
- **Fix:** Document or scaffold seed precondition

### ENV-3 — `payroll-phase-5/` tests skip (6/6)
- **Impact:** Likely missing period + golden case seed
- **Fix:** Document or auto-seed

### ENV-4 — `governance-training-mvp/` (2 fail + 7 dnr) — policy/protocol seed missing
- **Impact:** Engine-dispatch + observer-request need policy seed
- **Fix:** Document precondition

---

## OPS cliff (systemic)

### OPS-1 — WSL2 OOM cliff during concurrent Playwright + Next.js 16 dev 🔴 SYSTEMIC
- **Where:** WSL2 host config (`swap=0B`, RAM 15 Gi total)
- **Evidence:** Web died 4× during this sweep; each kill cascaded ERR_NETWORK_CHANGED across 5-15 tests
- **Impact:** ~30% sweep overhead from disambiguation reruns. Heavy pages (`/dashboard/schedule`) crash chromium tab with "Page crashed". Documented in MEMORY.md as L-0316-pattern.
- **Affects:** J-10 procedure-engine, J-13 timeline-templates, J-15 schedule, J-33 contracts, J-37 contracts rerun
- **Fix options (pick one):**
  1. Enable WSL2 swapfile (`/etc/wsl.conf` + .wslconfig)
  2. Cap test concurrency to 1 worker AND run only during idle session
  3. Use `pnpm build` + production server for tests (memory profile drops ~60%)

---

## Fast wins (cost-ordered, highest impact first)

| # | Bug | Cost | Unblocks |
|---|---|---|---|
| 1 | BUG-8 (channel FK CASCADE) | 15 min | 4+ test suites + production landmine |
| 2 | BUG-12 (employment_form seed) | 15 min | 5 contract tests |
| 3 | BUG-1 (communication seed) | 15 min | 8+ komm + helpdesk-SLA tests |
| 4 | ENV-1 (WATCHDOG_CRON_SECRET) | 5 min | 8 fanout tests |
| 5 | BUG-2 + BUG-10 (testid uniqueness) | 30 min | 3 strict-mode tests |
| 6 | HARNESS-1 (vitest exclusion) | 15 min | re-enables `--grep` sweep |
| 7 | BUG-16 (compliance auth) | 30 min diag | 11 compliance tests |
| 8 | BUG-11 (Maler tab API) | 30 min | 1 critical contract flow |
| 9 | BUG-15 (Orb suppression) | 1-2 h | 7 domain-chat tests |
| 10 | OPS-1 (WSL2 swap) | 30 min config | removes OOM cliff for all future sweeps |

**Total fast-wins time: ~5 hours → unblocks ~50 tests + removes systemic ops bottleneck.**

---

## Evidence

All raw logs: `docs/test-runs/2026-05-23-journey-sweep/evidence/run-NN-*.log` (47 files)
Per-journey: `docs/test-runs/2026-05-23-journey-sweep/journeys/J-NN-*.md` (selected)
Index + final REPORT: `docs/test-runs/2026-05-23-journey-sweep/INDEX.md` + `REPORT.md`
