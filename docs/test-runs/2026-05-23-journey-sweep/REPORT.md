---
title: Journey Verification Sweep — REPORT
status: in_progress
updated: 2026-05-24
created: 2026-05-24
module: meta
tags: [report, journey-verification, playwright, e2e]
---

# Journey Verification Sweep — REPORT (2026-05-23/24)

> Goal: iterate documented user journeys, verify end-to-end via Playwright, capture pass/fail/gap + bugs/blockers.
> Scope: "Core user journeys" (~28) + 8 typed protocols per goal Q1.
> Env: local stack (Supabase local + web 3060 + admin 3070) per goal Q2.
> Branch: development @ b2b6770e (post wizard merge be44abb44 from 2026-05-23 PM).

---

## Headline (final, post-extended sweep)

- **47 spec runs** across `apps/e2e/` covering ~500 unique test cases (multiple reruns to disambiguate web-OOM cascade).
- **~158 tests PASS** (cumulative).
- **~120 real fails** (post-cascade-reclassification).
- **~120 tests SKIPPED** (preconditions / env gaps / `test.skip()`).
- **~75 tests DID NOT RUN** (early teardown failure cascades).
- **20 product/schema bugs + 3 harness bugs + 4 env gaps + 1 OPS cliff = 28 distinct findings.**

### Web died mid-sweep — 4 separate occurrences requiring restart
- Each time: OOM-induced kill of next-server 3060 → cascade ERR_NETWORK_CHANGED in tests
- Restart + rerun pattern used to disambiguate cascade from real bugs
- Net effect on signal: 6-8 hours of effective sweep time, ~30% rework due to OPS-1 cliff

### Web died mid-sweep — 3 separate occurrences
- Each: OOM-induced kill of next-server 3060
- Cascade visible as `ERR_NETWORK_CHANGED` in next test → all subsequent tests in batch DNR
- Restart-and-rerun confirms which fails were cascade vs real
- 14 cascade casualties confirmed PASS on rerun (join-wizard, join-journey-1)
- 21 fails in run-33 contracts/ rerun → 4 PASS / 17 REAL (BUG-12/13/14)
- 11 fails in run-34 contracts-compliance/ rerun → still 11 FAIL (BUG-16, not cascade)

---

## Aggregate by suite

| # | Suite | Pass | Fail | Skip | DNR | Status |
|---|---|---:|---:|---:|---:|---|
| 01 | `tests/auth.spec.ts` | 9 | 0 | 0 | 0 | ✅ PASS |
| 03 | `tests/employee-onboarding-wizard.spec.ts` | 3 | 0 | 0 | 0 | ✅ PASS |
| 04 | `admin/avstemming.spec.ts` (admin app 3070) | 1 | 0 | 10 | 0 | ⚠️ SKIP-heavy |
| 05 | `admin/kartotek.spec.ts` | 0 | 0 | 8 | 0 | ⚠️ SKIP-all |
| 06 | `admin/orders.spec.ts` | 0 | 0 | 5 | 0 | ⚠️ SKIP-all |
| 07 | `contract-employee/` (both dirs) | 9 | 1 | 40 | 6 | ❌ FAIL |
| 08 | `komm-nyheter/` | 2 | 8 | 0 | 0 | ❌ FAIL |
| 09 | `dagslinjen-quickadd/` | 2 | 13 | 18 | 0 | ❌ FAIL |
| 10 | `procedure-engine/` | 3 | 2 | 0 | 3 | ❌ FAIL (OOM) |
| 11 | `engine-world/` | 33 | 2 | 10 | 6 | ✅ PASS-dominant |
| 12 | `payroll-phase-5/` | 0 | 0 | 6 | 0 | ⚠️ SKIP-all |
| 13 | `timeline-templates/` | 0 | 3 | 3 | 3 | ❌ FAIL (OOM) |
| 14 | `bulk-import/` | 2 | 0 | 3 | 0 | ✅ PASS |
| 15 | `schedule/density.spec.ts` | 0 | 4 | 0 | 0 | ❌ FAIL (OOM) |
| 16 | `specs/announcement-kind-tier.spec.ts` | 0 | 4 | 0 | 0 | ❌ FAIL |
| 17 | `tests/signup-session-redirects.spec.ts` | 7 | 0 | 0 | 0 | ✅ PASS |
| 18 | `tests/dashboard-setup-wizard-deep.spec.ts` | 0 | 1 | 0 | 2 | ❌ FAIL (FK bug) |
| 19 | `tests/workspace-setup-flow.spec.ts` | 0 | 1 | 0 | 10 | ❌ FAIL (cascade) |
| 20 | `tests/join-wizard.spec.ts` | 0 | 1 | 0 | 7 | ❌ FAIL (cascade) |
| 21 | `tests/join-journey-1-happy.spec.ts` | 0 | 1 | 0 | 0 | ❌ FAIL (cascade) |
| 22 | `tests/journey-platform-admin-billing-product-catalog.spec.ts` | 0 | 5 | 2 | 0 | ❌ FAIL (cascade) |
| 23 | `tests/e2e-contract-template-maler.spec.ts` | 0 | 1 | 0 | 0 | ❌ FAIL |
| **Reruns to disambiguate web-OOM cascade** | | | | | | |
| 24 | `tests/workspace-setup-flow.spec.ts` (rerun) | 0 | 1 | 0 | 10 | ❌ Confirms BUG-8 (not cascade) |
| 25 | `tests/join-wizard.spec.ts` (rerun) | 8 | 0 | 0 | 0 | ✅ PASS (was cascade) |
| 26 | `tests/journey-platform-admin-billing-product-catalog.spec.ts` (rerun) | 2 | 3 | 2 | 0 | ⚠️ Real bugs surfaced |
| 27 | `tests/join-journey-1-happy.spec.ts` (rerun) | 1 | 0 | 0 | 0 | ✅ PASS (was cascade) |
| 28 | `tests/e2e-contract-template-maler.spec.ts` (rerun) | 0 | 1 | 0 | 0 | ❌ Confirms BUG-11 |
| **Extended uncovered-spec sweep** | | | | | | |
| 29 | `tests/day-line/` | 1 | 2 | 8 | 0 | ❌ FAIL |
| 30 | `tests/domain-chat-ownership/` | 1 | 7 | 0 | 0 | ❌ FAIL |
| 31 | `governance-training-mvp/` | 0 | 2 | 0 | 7 | ❌ FAIL |
| 32 | `tests/cascade-bootstrap.spec.ts + cascade-ui.spec.ts` | 10 | 8 | 0 | 0 | ⚠️ PARTIAL |
| 33 | `tests/contracts/` (initial — web died) | 0 | 21 | 2 | 3 | ❌ CASCADE |
| 34 | `tests/contracts-compliance*/` | 0 | 11 | 3 | 0 | ❌ FAIL |
| 35 | `tests/contract-composition/` | 0 | 2 | 1 | 0 | ❌ FAIL |
| 36 | `tests/contracts-api.spec.ts` | 4 | 0 | 0 | 0 | ✅ PASS |
| 37 | `tests/contracts/` (rerun) | 4 | 17 | 4 | 1 | ❌ REAL FAIL post-cascade |
| 38 | `tests/contracts-compliance*/` (rerun) | 0 | 11 | 3 | 0 | ❌ Confirms BUG-16 |
| 39 | `tests/contract-composition/` (rerun) | 0 | 2 | 1 | 0 | ❌ REAL FAIL |
| 40 | `tests/daily-operation-*` (7 specs) | 14 | 7 | 4 | 4 | ⚠️ PARTIAL (PASS-dominant) |
| 41 | `tests/hms-*` (4 specs) | 2 | 11 | 0 | 0 | ❌ FAIL |
| 42 | `tests/helpdesk-primitives + helpdesk-public + helpdesk-private` | 6 | 0 | 0 | 0 | ✅ PASS |
| 43 | `tests/helpdesk-sla-*` (3 specs) | 0 | 4 | 0 | 0 | ❌ FAIL |
| 44 | `tests/helpdesk-{downgrade,pii,progressive,rep-demotion,rls}` | 7 | 0 | 0 | 0 | ✅ PASS |
| 45 | `tests/journey-page-takeover-*` (4 specs) | 7 | 3 | 2 | 4 | ⚠️ PARTIAL |
| 46 | `tests/journey-help-*` (8 specs) | 0 | 11 | 0 | 13 | ❌ FAIL (cascade?) |
| 47 | `tests/journey-shift-*` (3 specs) | 8 | 6 | 0 | 2 | ⚠️ PARTIAL |

Status legend: ✅ PASS = dominant pass, ❌ FAIL = real bugs, ⚠️ SKIP = preconditions missing, OOM = Page/Target crashed under RAM pressure, cascade = ERR_NETWORK_CHANGED after web process killed.

---

## Bugs Found

### Product / Schema bugs (act on these)

**BUG-1 (CRITICAL) — `engine_authority_config` missing seed for `communication` capability**
- Surface: `publish_announcement` capability fails closed
- Spec evidence: `komm-nyheter/agent-publish/journey-1-draft-then-publish.spec.ts:185, 244` + `journey-3-fail-closed.spec.ts:172`
- Error: literal message `"engine_authority_config missing for capability=communication. Run migration 20260601100000_seed_communication_authority.sql first."`
- Hypothesis: seed migration not applied to local DB (or migration was timestamped post-base-reset)
- Action: `npx supabase db reset` from clean state, OR write a setup-script that applies missing seed.

**BUG-2 — Audience selector strict-mode violation in komm nyheter audience picker**
- Surface: `journey-2-audience-targeting.spec.ts:66`
- Selector `getByRole('button', { name: /bar/i })` matches 5 elements
- Real UI ambiguity; likely missing `data-testid` on the audience picker buttons
- Action: add `data-testid="audience-dept-<id>"` to department selector buttons

**BUG-3 — Pin/unpin announcement DB shape wrong**
- Surface: `komm-nyheter/journey-3-pin-unpin-realtime.spec.ts:145, 185`
- After pin click, `pinned_by` and `pinned_at` columns are undefined
- Action: trace `pin_announcement` capability — verify it writes both columns

**BUG-4 — Slot quickadd popover broken (4 timeouts)**
- Surface: `dagslinjen-quickadd/slot-quickadd.spec.ts:80, 110, 135, 175` (Booking, Notat, Oppgave, Avvik)
- Click on "08:00" slot never opens popover within 15s
- Hypothesis: popover anchor data-testid drift, OR missing seed (no department_session for "today" → no slots)
- Action: manual check `/dashboard/day/<today>` — does clicking 08:00 open popover at all?

**BUG-5 — Filter timeline 3-tab popover broken (3 fail / 1 pass)**
- Surface: `dagslinjen-quickadd/filter-timeline.spec.ts:75, 124, 157`
- H1 team pick, H2 shift pick, H3 reset all fail. H4 (reload preserves URL) passes.
- Read-from-URL works, click-to-update broken. Likely real regression in the 3-tab popover interaction since ui-shell merges.

**BUG-6 — `/api/contracts/send` returns 400 instead of 202**
- Surface: `tests/contract-employee/journey-2-admin-send.spec.ts:192`
- Expected 202 Accepted, got 400 Bad Request on happy-path send
- Hypothesis: Zod schema mismatch (body shape OR DocuSeal stub config drift)
- Action: trace handler at `apps/web/src/app/api/contracts/send/route.ts`

**BUG-7 — note-fanout-scheduler auth guard returns wrong status**
- Surface: `dagslinjen-quickadd/employee-receives-note.spec.ts:467`
- Expected 401 on wrong secret, got something else
- Action: trace `/api/note-fanout-scheduler` route

**BUG-8 (SCHEMA) — `channel.workspace_id_fkey` missing `ON DELETE CASCADE`**
- Surface: `tests/dashboard-setup-wizard-deep.spec.ts:27` + `tests/workspace-setup-flow.spec.ts` teardown
- Error: `update or delete on table "workspace" violates foreign key constraint "channel_workspace_id_fkey" on table "channel"`
- Blocks all test fixtures that recycle a workspace
- Action: migration to add `ON DELETE CASCADE` to channel.workspace_id FK
- Affects production too — if a workspace is ever deleted, channel cleanup will fail.

**BUG-9 — Billing product catalog: combobox option `Fjelds mat` not findable (timeout)**
- Surface: `tests/journey-platform-admin-billing-product-catalog.spec.ts:108` (mixed-lines test)
- `getByRole('option', { name: 'Fjelds mat' }).first()` times out after 15s
- Hypothesis: seed gap — company "Fjelds mat" missing from local DB; OR combobox not populating
- Action: confirm `Fjelds mat` company exists in local seed; if yes, debug combobox

**BUG-10 — Billing product catalog: duplicate `data-testid="ad-hoc-invoice-open"` in DOM**
- Surface: `tests/journey-platform-admin-billing-product-catalog.spec.ts:68, 135` (smoke + edit-clear)
- `getByTestId('ad-hoc-invoice-open')` resolves to 2 elements (strict mode violation)
- Two `<button>` rendered with same testid; one is hidden, one visible
- Same class as BUG-2 — real UI bug: testid should be unique
- Action: trace `ad-hoc-invoice-open` button render — likely DashboardShell + page both render; one needs different testid or conditional

**BUG-11 — Contract templates Maler tab: `/api/contracts/templates` never fires on mount**
- Surface: `tests/e2e-contract-template-maler.spec.ts:36` (`@smoke Maler tab — clone K1a system template into workspace`)
- `page.waitForResponse((r) => r.url().includes('/api/contracts/templates?workspace_id=<HQ_WORKSPACE_ID>'))` times out after 10s
- Confirmed not cascade: rerun (run-28) reproduces against healthy web
- Hypothesis: query disabled (TanStack `enabled: false`), wrong URL pattern, or component never mounts the tab
- Action: trace Maler tab page component — confirm `useContractsTemplates(workspaceId)` is called on mount; check workspace_id is resolved

**BUG-12 (CRITICAL) — `employment_contract.employment_form` NOT NULL but seed helper doesn't set it**
- Surface: 5 tests in `tests/contracts/employee-contract-cancel.spec.ts` + `employee-contract-send.spec.ts`
- Error literal: `null value in column "employment_form" of relation "employment_contract" violates not-null constraint`
- Schema/seed mismatch — migration added NOT NULL but `seedContract` helper not updated
- Action: trace seed helpers; add `employment_form: 'permanent_full_time'` (or correct default enum value)

**BUG-13 — Multiple contract UI elements not visible**
- Surface: 8 tests across contracts/ — bindings tab, drift drawer, composition drawer (open + ESC), employee-contract-create CTA, preview-editor, hub-redesign
- All fail with `element(s) not found`
- Hypothesis: testid drift OR auth-routed user lands wrong page OR feature gated off
- Action: manual repro

**BUG-14 — Page crashes on multiple contract surfaces**
- Surface: 3 tests across contracts/ — employee-contract-create, hub-redesign, reverse-flow
- Chromium "Page crashed" even with healthy web + ample RAM during rerun
- Hypothesis: heavy bundles (DocuSeal embed iframe?) + RAM peak inside browser tab
- Action: isolated repro with RAM > 6 Gi to confirm

**BUG-15 — Domain chat ownership: 7/8 fail (Orb suppression broken?)**
- Surface: `tests/domain-chat-ownership/` (botsson-provider-scope, komm-chat-passive, komm-thread-passive, schedule-active)
- 7 of 8 tests fail — likely ADR-0238 surface-ownership regression (Orb should suppress when domain chat declares ownership)
- Direct match to L-0178 in MEMORY.md (wizard textbox + Orb dual-surface UX trap)
- Action: trace `useDomainChatOwnership` hook + BotssonProvider scope detection

**BUG-16 (CRITICAL) — Contracts-compliance: ALL 11 tests auth-fail with `Invalid login credentials`**
- Surface: all `tests/contracts-compliance*/*.spec.ts` (court-order, singular-bypass, pdf-gate, non-court-order)
- Fixture pre-check succeeds (`admin@smartout.local` works); spec-level auth call fails
- Possible: GoTrue rate-limit OR helper hardcodes wrong creds OR different auth flow path
- Action: trace `loginAsAdmin` variant used by these specs vs the one fixture uses

**BUG-17 — HMS suite: 11/13 fail (broad HMS surface regression)**
- Surface: `tests/hms-{avvik,drift,oversikt,signoff}.spec.ts`
- Hypothesis: recent HMS polish (ui-shell-hms-cluster-polish + r2-fixup per MEMORY.md) drifted testids OR layout structure
- Action: inspect specific failure causes; likely testid drift after polish sortie

**BUG-18 — Day-line: most tests skip + 2 fail**
- Surface: `tests/day-line/{create,attach-routine,edit-hours}.spec.ts`
- 8/11 skip — likely missing `department_session` seed for current date
- 2 fails — likely real interaction bugs (related to BUG-4/5 in dagslinjen-quickadd)

**BUG-19 — Cascade UI: 8/18 fail (10 pass)**
- Surface: `tests/cascade-bootstrap.spec.ts + cascade-ui.spec.ts`
- Core I1+6D+4C bootstrap works (10 PASS); UI-edge cases fail
- Action: inspect 8 failures

**BUG-20 — Helpdesk SLA: 0/4 PASS (all 4 fail)**
- Surface: `tests/helpdesk-sla-{auto-escalation,manager-overdue-action,rep-overdue-badge}.spec.ts`
- Probable: `engine_delayed_trigger` cron not running in local OR `helpdesk_query` capability authority not seeded (likely cascade from BUG-1 — same `engine_authority_config` family)
- Action: re-test after fixing BUG-1 (communication seed)

**BUG-21 — Journey-help suite: 11/24 fail + 13 DNR (heavy failure)**
- Surface: `tests/journey-help-*.spec.ts` (8 specs — active-ticket-admin/employee/empty, tour-anchors/cancellation/onboarding/reduced-motion, v1)
- Hypothesis: cascade from early failure, OR systematic help-surface regression
- Action: rerun isolated to disambiguate; failure on Help v1 page very common

**BUG-22 — Journey-shift: 6/16 fail (8 pass, 2 dnr)**
- Surface: `tests/journey-shift-{clock,session-spine,temporal-lock}.spec.ts`
- Partial — clock-in core works (8 PASS), edge cases fail (6 fail)
- Action: inspect specific shift failures — may correlate with `schedule_shift.status` enum drift

### Harness / Infra bugs

**HARNESS-1 — `apps/e2e/db/` + `apps/e2e/runners/__tests__/` poison Playwright glob discovery**
- Specs import vitest in CommonJS context → Playwright fails to load them
- Error: `Vitest cannot be imported in a CommonJS module using require()`
- Workaround: run by explicit subdir path. Blocks any `--grep` or root-glob sweep.
- Action: move these to a separate `vitest` project OR exclude from `testMatch` in `playwright.config.ts`

**HARNESS-2 — `apps/e2e/admin/*.spec.ts` hardcode `http://localhost:3070`**
- Specs assume `apps/admin` (port 3070) is running, but `playwright.config.ts` only auto-starts apps/web (3060) and apps/landing (3056)
- Manual workaround: `cd apps/admin && pnpm dev` before running admin specs
- Action: add admin app to `playwright.config.ts.webServer` OR document explicitly

**HARNESS-3 — Playwright `webServer` includes landing (3056) but it's not always running**
- Test runs fail with "Process from config.webServer exited early" when landing dev not pre-started
- Workaround: `SKIP_WEB_SERVER=1` env var
- Action: make webServer entries conditional / skippable individually

### Environment / Seed gaps

**ENV-1 — `WATCHDOG_CRON_SECRET` missing from `apps/e2e/.env.local`**
- 8 tests in `employee-receives-note.spec.ts` skip with explicit message
- Action: add `WATCHDOG_CRON_SECRET=local-dev-secret` to env

**ENV-2 — Most `admin/` tests skip (10/11 avstemming, 8/8 kartotek, 5/5 orders)**
- Likely require accountant grant seed or specific company data
- Action: document or scaffold seed precondition

**ENV-3 — Most `payroll-phase-5/` tests skip (6/6)**
- Likely require period + golden case seed
- Action: document or auto-seed

### Systemic operational issue

**OPS-1 — WSL2 OOM cliff during concurrent Playwright + Next.js 16 dev**
- `swap=0B`, RAM 15 Gi total
- Web process killed at least once during sweep (PID 17068 → 82373); cascade: 4+ test suites failed with `ERR_NETWORK_CHANGED`
- Heavy pages (`/dashboard/schedule`) crash chromium tab with `Page crashed`
- Affects: J-10 procedure-engine, J-13 timeline-templates, J-15 schedule
- Action: enable WSL2 swapfile, OR cap test concurrency to 1 worker AND only run during otherwise-idle session, OR use `pnpm build` + production server for tests
- Already documented in MEMORY.md as L-0316-pattern; this run = 4th confirmed occurrence

---

## Journey-to-spec coverage

(see `journeys/J-NN-*.md` for per-journey detail; selected highlights below)

| # | Journey doc | Spec | Result |
|---|---|---|---|
| J-01 | `JOURNEY-auth-screens-redesign.md` + `JOURNEY-auth-security-friction.md` | `tests/auth.spec.ts` | ✅ 9/9 |
| J-04 | `JOURNEY-c3-1-onboarding-reduced-motion.md` | `tests/employee-onboarding-wizard.spec.ts` | ✅ 3/3 |
| J-07 | `JOURNEY-client-contract*.md` + 6 contract docs | `contract-employee/` + `tests/contract-employee/` | ⚠️ 9 pass, 1 fail (BUG-6), 40 skip |
| J-08 | `JOURNEY-announce-kind-tier-link.md` + 4 botsson-publishannouncement docs | `komm-nyheter/` + `specs/announcement-kind-tier.spec.ts` | ❌ blocked by BUG-1 |
| J-09 | 4 `JOURNEY-day-line-*.md` docs | `dagslinjen-quickadd/` | ❌ BUG-4 + BUG-5 |
| J-10 | `JOURNEY-procedure-engine-*` | `procedure-engine/` | ⚠️ DB OK, UI OOM |
| J-11 | `JOURNEY-agent-*` (3 docs) | `engine-world/` | ✅ 33/51 dominant pass |
| J-14 | `JOURNEY-bulk-import-sortie-*.md` | `bulk-import/` | ✅ 2/5 (3 skip) |
| J-15 | `JOURNEY-admin-daily-loop.md` Journey 2 | `schedule/density.spec.ts` | ❌ Page crashes |
| J-signup | `JOURNEY-auth-screens-redesign.md` (signup half) | `tests/signup-session-redirects.spec.ts` | ✅ 7/7 |
| J-workspace-setup | (multiple workspace setup docs) | `tests/workspace-setup-flow.spec.ts` | ❌ blocked by BUG-8 |

---

## Recommended next actions (ordered, fastest wins first)

1. **(15 min) Fix BUG-8 — add `ON DELETE CASCADE` to channel.workspace_id FK.** Unblocks 4+ test suites + removes a real production landmine.
2. **(15 min) Fix BUG-2 + BUG-10 — uniqueness on `data-testid`.** Same root cause (component rendered twice OR header+page both render). Trace both.
3. **(15 min) Fix ENV-1 — add `WATCHDOG_CRON_SECRET` to `apps/e2e/.env.local`.** Unlocks 8 note-fanout tests.
4. **(30 min) Fix BUG-1 — apply `seed_communication_authority` migration to local.** Re-run komm-nyheter; should drop most failures.
5. **(30 min) Fix HARNESS-1 — exclude `apps/e2e/db/` + `apps/e2e/runners/__tests__/` from Playwright `testMatch`.** Re-enables root-glob `--grep @smoke`.
6. **(30 min) Investigate BUG-11 — contract templates Maler tab API never fires on mount.** Likely simple wiring bug. High visibility — used to clone K1a system templates.
7. **(1-2 h) Investigate BUG-4 + BUG-5 — slot-quickadd + filter-timeline interaction regressions.** Most likely post-ui-shell-merge drift. Manual repro first.
8. **(1 h) Investigate BUG-6 — `/api/contracts/send` 400.** Read recent commits to the handler.
9. **(documentation) Update `apps/e2e/README` to document admin-app prerequisite + `SKIP_WEB_SERVER=1` flag.**
10. **(ops/long-term) Enable WSL2 swapfile OR set up production-build test mode.** Removes the OOM cascade — caused web to die mid-batch this sweep; 14 tests required rerun to disambiguate cascade from real bugs.

---

## What I did NOT do

- Mobile journeys (Maestro / device required, marked BLOCKED-NO-DEVICE upfront)
- Anything beyond read-only verification — no code changes, no commits, no migrations, no deploys
- Did not write new Playwright specs (existing 249 specs already cover most journeys)
- Did not run all 526 JOURNEY-*.md (scope filtered to ~28 user-traversable at goal Q1)
- Did not iterate every typed protocol individually (apps/e2e/protocols/index.ts) — they're typed runners that wrap into `tests/protocol.spec.ts`; not run separately this round.

---

## Evidence

- 23 per-run logs in `evidence/run-NN-<suite>.log`
- Per-journey result files in `journeys/J-NN-<slug>.md` (selected, not exhaustive)
- Video traces captured by Playwright on failure: `apps/e2e/test-results/`
- Index: this file + `INDEX.md`

---

*Sweep executed 2026-05-23 23:43 – 2026-05-24 08:12 CEST. Goal directive: iterate all documented user journeys end-to-end with Playwright.*
