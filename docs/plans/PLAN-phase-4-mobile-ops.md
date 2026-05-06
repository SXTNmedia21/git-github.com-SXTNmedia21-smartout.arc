---
title: "Phase 4 — Mobile RN Fjernkontroll + Ops"
status: ready
updated: 2026-04-27
created: 2026-04-27
module: journey-engine
tags: [plan, phase-4, mobile, reanimated, seed-missions, kill-switch, monitoring, rollback-migrations]
---

# Phase 4 — Mobile RN Fjernkontroll + Ops

**Goal:** Upgrade the mobile guided-journey screen from polling/static to a Reanimated spring-physics state machine, ship seed-missions for 2+ journeys to preview and prod, add rollback migrations for all campaign schema additions, wire a kill-switch for `journey.run_guided`, and define the monitoring alert shape for emit-drop and stuck-rate.

---

## ⚠️ Phase 4 Entry Precondition — NOT YET MET

**Phase 3 item #4 (stuck-detector Step B-flip + Step C-delete, ADR-0215 Option A) is deferred.**

Per CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT Phase 3: Phase 4 entry requires ≥4-of-5 artefacts real. Current state post-Phase 3 is 3-of-5:

| Artefact | Status | Evidence |
|---|---|---|
| `publish_mission` body | real | `engine_missions` + `engine_stages` writes per T5 commits |
| `publish_guide` body | real | `journey_guide` table + MDX write, `20260518230000` |
| `run_guided` + mission resolution | real | `resolveMissionForJourneyVersion()` + 409 guard; `2b88f1a5` chain |
| stuck-detector dual-write (Phase 3 #4) | **deferred** | ADR-0215 Option C; `grep -rn "engine_delayed_trigger" packages/ai/src/capabilities/journey/` → 0 |
| N-C worker (Phase 3 #3) | out-of-scope | CLAUDE.md §Explicit Out-of-Scope |

**Falsifiable gate:** Phase 4 sub-sorties MUST NOT be dispatched until Phase 3 #4 ships OR Pontus explicitly waives the ≥4-of-5 condition in writing. Verify with: `grep -rn "engine_delayed_trigger" packages/ai/src/capabilities/journey/tools.ts` — must return ≥1 hit before Phase 4 starts.

---

## Binding ADRs and Learnings

| ADR / Learning | Relevance |
|---|---|
| ADR-0132 | Mobile thin-client only; all journey runs BFF-proxied |
| ADR-0133 | Web composes, mobile executes; no authoring on mobile |
| ADR-0134 | `workspace_id` + `actor_id` non-empty from `getProfileContext()` before any emit |
| ADR-0151 | Stage-engine server-side profile ID derivation (BFF already implements) |
| ADR-0175 | 5 journey events × 4 destinations; emit-drop alert targets these |
| ADR-0176 | C4 authority seed via migration; kill-switch is a migration pair, not runtime insert |
| ADR-0177 | 6-state machine contract; spring 35/22/2.2; 44pt touch targets; `useReducedMotion()` |
| ADR-0215 | Stuck-detector deferred; Phase 4 does NOT include the event-driven path |
| L-0098 | 3-step cutover (dual-write → flip → delete); kill-switch migration follows this model |

---

## Scope Spike

### 1. State of Mobile Today (post-M5.2)

`apps/mobile/app/(app)/journey/[id]/guided.tsx` is a **fully wired polling screen** — not a stub. It:

- Guards on mount with `safeGetProfileContext()` (ADR-0134 compliant).
- Calls `bffStartGuided` / `bffFetchStatus` from `apps/mobile/src/lib/journey-bff.ts`; polls every 2500ms.
- Implements 8 UI states: `loading_profile | profile_error | idle | starting | running | stuck | completed | failed`.
- `stuck` exit: only "Start på nytt" (`handleReset → idle`). **Missing: `stuck → running` retry edge.**
- `failed` exit: "Prøv igjen" (`handleReset → idle`). Correct.
- Uses `Animated.View` + `FadeIn` preset only — no spring physics, no `withSpring`.
- Design tokens correct (`createStyles(theme => ...)`); touch targets ≥44pt. ADR-0177 compliant.
- No direct `@smartout/ai` imports. ADR-0132/0133 compliant.

BFF client (`journey-bff.ts`) exports `bffStartGuided`, `bffFetchStatus`, `buildStartGuidedBody`. No identity fields in request body (ADR-0176 Invariant 3). No BFF additions needed for Phase 4 except potentially a retry-signal route (assess in SS-1).

**Verdict: "extend X", not "build from scratch".** Phase 4 adds spring physics, shared reducer, and the missing retry edge.

### 2. Reanimated Port — Spring Physics Translation

**Installed version:** `react-native-reanimated ~4.2.1` (Reanimated v4). **No version bump needed.**

ADR-0177 spring `(35, 22, 2.2)` maps directly — parameter names are identical in Reanimated v3+:

```ts
// State transition value animations
withSpring(targetValue, { stiffness: 35, damping: 22, mass: 2.2 })

// Layout animations
<Animated.View layout={Layout.springify().stiffness(35).damping(22).mass(2.2)}>
```

`useReducedMotion()` is available from `react-native-reanimated` v3+. Must be called at the top level and respected on every animated element — skip `withSpring`, use a static value if `reducedMotion === true`.

**Reanimated version verdict: WORKS — no version bump needed.** v4.2.1 fully supports `withSpring({stiffness, damping, mass})` and `useReducedMotion()`.

### 3. State Machine Port

Web: home-rolled `useReducer` — NOT XState. Exports pure `reduce()` function + stable callbacks. 6 states, 9 event types per ADR-0177.

Mobile currently has a parallel inline discriminated union `MobileJourneyState` (8 kinds — includes `loading_profile`/`profile_error` as pre-machine wrapper states). Phase 4 does NOT re-design:

1. Extract `reduce()` to `packages/journey-ir/src/fjernkontroll-reducer.ts`; both web + mobile import from there.
2. Keep `loading_profile`/`profile_error` as wrapper (pre-`idle`) — not part of the 6-state machine.
3. Add missing `stuck → running` retry edge. Current mobile `stuck` only has `handleReset → idle`. Missing: `handleRetry → running`.
4. `failed → idle` reset already present via `handleReset`. Correct.
5. `paused` omitted from mobile — BFF never returns `paused` status; no pause endpoint exists. Document as known gap.

Recommended: move `reduce()` to shared package to prevent future drift.

### 4. Seed-Missions for 2+ Journeys (Preview + Prod)

Phase 2 G2 (`20260518220000`) linked two journeys to `engine_process`:
- `check-my-schedule` → `journey_03_check_shifts`
- `complete-trainee-core-journey` → `onboarding_journey`

Phase 4 seed-missions must create actual `engine_missions` + `engine_stages` rows for these two journeys so `run_guided` resolves without 409 on persistent preview and prod.

**Seeding strategy:** workspace-scoped seed is the only safe option. The seed migration cannot insert a global row because `engine_missions` is workspace-scoped (`workspace_id NOT NULL`). Options:

1. **Single-tenant seed** (Pontus's workspace only): insert one row per journey keyed to the known preview workspace UUID. Fragile — breaks if workspace is recreated. NOT recommended.
2. **Per-workspace seed via CROSS JOIN** (same pattern as `20260516000400`): `INSERT INTO engine_missions ... SELECT w.workspace_id, ... FROM workspace w CROSS JOIN (VALUES ...) ON CONFLICT DO NOTHING`. Every existing workspace gets seed rows; new workspaces don't (they need onboarding flow). This is the correct pattern.

**Stage data shape:** per ADR-0194, `engine_stages` coaching fields are `goal`, `instructions`, `success_criteria` (NOT NULL), `system_prompt`, `mode`. The seed must supply real coaching text for each step, not empty strings. Phase 4 sub-sortie writes minimal but non-empty coaching content for 3–5 steps per journey.

**Verification query (Invariant 12):**
```sql
SELECT journey_id, COUNT(*) AS missions
FROM engine_missions
WHERE journey_id IN (
  SELECT journey_id FROM journey WHERE slug IN ('check-my-schedule', 'complete-trainee-core-journey')
)
GROUP BY journey_id;
-- Expected: 2 rows, each missions ≥ 1
```

### 5. Rollback Migrations — Inventory

Campaign-specific schema-extending migrations that need a corresponding rollback file in `supabase/migrations/rollback/`:

| Migration | Type | Rollback needed |
|---|---|---|
| `20260516000000_journey_version_table.sql` | `CREATE TABLE journey_version` | Yes — `DROP TABLE journey_version CASCADE` |
| `20260516000100_journey_version_status_0a_widen.sql` | `CREATE TYPE journey_version_status` | Yes — `DROP TYPE journey_version_status` |
| `20260516000200_journey_version_status_0b_enum.sql` | Column type flip `text → journey_version_status` | Yes — flip back to `text DEFAULT 'draft'` |
| `20260516000300_journey_version_status_0c_tighten.sql` | `NOT NULL` + enum default | Yes — paired with 0b rollback (combined file) |
| `20260516000400_journey_authority_seed.sql` | Pure `INSERT` | Comment only — rollback is the `DELETE` block already in the migration header; no separate file needed |
| `20260518230000_journey_guide_table.sql` | `CREATE TABLE journey_guide` | Yes — `DROP TABLE journey_guide CASCADE` |

**Rollback files needed:** 4 new files (journey_version table, 0a-widen, 0b+0c combined, journey_guide table). Authority seed rollback documented inline in `20260516000400` header. Phase 4 seed + kill-switch migrations also each need a rollback file (written in their respective sub-sorties).

### 6. Kill-Switch Design

Migration pair — not runtime insert, not feature flag (ADR-0176).

- **Kill** (`<TIMESTAMP>_journey_run_guided_kill_switch.sql`): `UPDATE engine_authority_config SET level = 'disabled' WHERE capability = 'journey.run_guided'`
- **Un-kill** (`<TIMESTAMP+1>_journey_run_guided_restore.sql`): `UPDATE engine_authority_config SET level = 'autonomous' WHERE capability = 'journey.run_guided'`

Effect: `callGateAction` returns `{allow: false}`. BFF returns 403. Mobile renders `failed` with "Journey er midlertidig utilgjengelig." No app restart needed.

**Invariant 12:** `SELECT level FROM engine_authority_config WHERE capability = 'journey.run_guided'` → `disabled` after kill, `autonomous` after un-kill.

### 7. Monitoring

Stack: PostHog + Logger + `activity_trail` + `engine_event`. No Datadog. **Monitoring in Phase 4 = PostHog alert spec + SQL runbook targeting `engine_event`.**

**Alert A — Emit-drop:** `journey%` events absent from `engine_event` for >5 minutes while runs are active.
- SQL: `SELECT COUNT(*) FROM engine_event WHERE event_type LIKE 'journey%' AND created_at > now() - interval '5 minutes'`
- Suppress if: `SELECT COUNT(*) FROM engine_event WHERE event_type = 'journey run_started' AND created_at > now() - interval '1 hour'` = 0.

**Alert B — Stuck-rate >0.1 over 1h:**
- SQL: `SELECT (stuck.n::float / NULLIF(started.n, 0)) FROM (SELECT COUNT(*) AS n FROM engine_event WHERE event_type = 'journey stuck' AND created_at > now() - interval '1 hour') stuck CROSS JOIN (SELECT COUNT(*) AS n FROM engine_event WHERE event_type = 'journey run_started' AND created_at > now() - interval '1 hour') started`

**OQ-7a:** PostHog alerting configured? If not, runbook delivers SQL + manual Telegram/cron webhook pattern.

### 8. Migration Rollout — PR #233 Blocked Migrations

The 4 blocked M1 foundation migrations (quota exhaustion during PR #233):

1. `20260516000000_journey_version_table.sql`
2. `20260516000100_journey_version_status_0a_widen.sql`
3. `20260516000200_journey_version_status_0b_enum.sql`
4. `20260516000300_journey_version_status_0c_tighten.sql`

Applied to local Supabase; committed to campaign branch. **Pontus owns the promote.**

**Sequence for Pontus — persistent preview (`cibmhhgsrdmpnmcikalu`):**
1. Apply in order: `000000 → 000100 → 000200 → 000300 → 000400 → 220000 → 230000` + Phase 4 seed.
2. Verify: `SELECT status FROM journey_version LIMIT 1` → enum value; `SELECT COUNT(*) FROM engine_authority_config WHERE capability LIKE 'journey%'` → ≥4/workspace; `SELECT COUNT(*) FROM journey_guide` → 0.
3. Apply seed-missions migration; verify with mission count query from §4.
4. Promote to **prod** in same order after preview validation.

---

## Sub-Sortie Breakdown

### SS-1 — `feat/journey-engine-mobile-rn-fjernkontroll`

**Scope:**
- Extract `reduce()` function to `packages/journey-ir/src/fjernkontroll-reducer.ts` — shared by web + mobile.
- Rewrite `apps/mobile/app/(app)/journey/[id]/guided.tsx` to use the shared reducer + Reanimated v4 `withSpring({stiffness:35, damping:22, mass:2.2})` on state transitions.
- Add missing `stuck → running` retry edge (current screen only has `stuck → idle` reset).

**Files modified:**
- `packages/journey-ir/src/fjernkontroll-reducer.ts` (new)
- `packages/journey-ir/src/index.ts` (barrel export)
- `apps/mobile/app/(app)/journey/[id]/guided.tsx` (rewrite animation layer + retry edge)
- `apps/mobile/src/lib/journey-bff.ts` (add `bffRetryStep(runId)` if server needs signalling — assess)

**Acceptance criteria:**
1. `grep -rn "withSpring" apps/mobile/app/\(app\)/journey/` → ≥1 hit with `stiffness:35`.
2. `grep -rn "useReducedMotion" apps/mobile/app/\(app\)/journey/` → ≥1 hit.
3. `grep -rn "from.*fjernkontroll-reducer" apps/mobile` → ≥1 hit (shared reducer import).
4. `stuck` renders two action buttons: `grep -n "retry\|abandon\|Prøv igjen\|Avslutt" apps/mobile/app/\(app\)/journey/\[id\]/guided.tsx` → ≥2 hits.
5. `pnpm turbo typecheck` → 0 errors.
6. `grep -n "zinc-\|gray-\|#[0-9a-fA-F]" apps/mobile/app/\(app\)/journey/\[id\]/guided.tsx` → 0 hits.

**Token budget:** ~3k tokens build.
**Dependencies:** None (SS-1 is independent of all other Phase 4 sub-sorties).

---

### SS-2 — `feat/journey-engine-seed-missions`

**Scope:**
- Migration: per-workspace `engine_missions` seed for `check-my-schedule` + `complete-trainee-core-journey`.
- Migration: corresponding `engine_stages` rows with real coaching content (goal + instructions + success_criteria) for 3–5 steps each.
- Rollback file for both seed migrations.

**Files modified:**
- `supabase/migrations/<TIMESTAMP>_journey_seed_missions_phase4.sql` (new)
- `supabase/migrations/rollback/<TIMESTAMP>_journey_seed_missions_phase4_rollback.sql` (new)

**Acceptance criteria:**
1. `SELECT journey_id, COUNT(*) FROM engine_missions WHERE journey_id IN (SELECT journey_id FROM journey WHERE slug IN ('check-my-schedule','complete-trainee-core-journey')) GROUP BY journey_id` → 2 rows, each count ≥ 1.
2. `SELECT COUNT(*) FROM engine_stages WHERE mission_id IN (...)` → ≥6 (3 steps × 2 journeys).
3. `SELECT COUNT(*) FROM engine_stages WHERE success_criteria IS NULL OR success_criteria = ''` → 0.
4. BFF POST `/api/journey/guided/start` for either seed journey returns 200 (no 409) after migration applied.
5. Rollback file executes without error; mission count query returns 0 after rollback.
6. `pnpm turbo typecheck` → 0 errors.

**Token budget:** ~2k tokens build + migration.
**Dependencies:** Phase 3 items #1 (publish_mission body) and #2 (mission resolution) must be merged — both are done per HANDOFF.

---

### SS-3 — `feat/journey-engine-rollback-migrations`

**Scope:** Write rollback SQL files for all 4 campaign schema-extending migrations; verify round-trip on local Supabase.

**Files modified (all new in `supabase/migrations/rollback/`):**
- `20260516000000_journey_version_table_rollback.sql` — `DROP TABLE journey_version CASCADE`
- `20260516000100_journey_version_status_0a_widen_rollback.sql` — `DROP TYPE journey_version_status`
- `20260516000200_0b_and_0c_combined_rollback.sql` — flip column back to `text DEFAULT 'draft'`, `DROP TYPE`
- `20260518230000_journey_guide_table_rollback.sql` — `DROP TABLE journey_guide CASCADE`

**Acceptance criteria:**
1. `ls supabase/migrations/rollback/ | grep journey` → ≥4 files.
2. Forward + rollback round-trip executes without error on local Supabase (apply → rollback → re-apply).
3. `SELECT typname FROM pg_type WHERE typname = 'journey_version_status'` → 0 rows after 0a-widen rollback.
4. `\d journey_version` and `\d journey_guide` → "did not find any relation" after respective rollbacks.
5. No changes to forward migrations or application code.

**Token budget:** ~1k tokens (SQL only).
**Dependencies:** None (rollback files are standalone).

---

### SS-4 — `feat/journey-engine-kill-switch`

**Scope:**
- Kill migration: set `journey.run_guided` to `disabled` in `engine_authority_config`.
- Un-kill migration: restore `journey.run_guided` to `autonomous`.
- Rollback files for both migrations.
- Runbook in `docs/runbooks/RUNBOOK-journey-run-guided-kill-switch.md`.

**Files modified:**
- `supabase/migrations/<TIMESTAMP>_journey_run_guided_kill_switch.sql` (new)
- `supabase/migrations/<TIMESTAMP+1>_journey_run_guided_restore.sql` (new)
- `supabase/migrations/rollback/<TIMESTAMP>_kill_switch_rollback.sql` (new — same as un-kill)
- `docs/runbooks/RUNBOOK-journey-run-guided-kill-switch.md` (new)

**Acceptance criteria:**
1. `SELECT level FROM engine_authority_config WHERE capability = 'journey.run_guided'` → `disabled` after kill, `autonomous` after un-kill.
2. Both migrations idempotent (run twice, no error, correct result).
3. Runbook contains step-by-step ops procedure + SQL verification + un-kill command.
4. `grep -rn "runtime insert\|supabase.from.*engine_authority_config.*insert" packages services` → 0 hits.

**Token budget:** ~2k tokens SQL + runbook.
**Dependencies:** `20260516000400` (authority seed) must be applied so rows exist to UPDATE. Satisfied by SS-3's verification run.

---

### SS-5 — `feat/journey-engine-monitoring`

**Scope:**
- Document 2 alert definitions (emit-drop + stuck-rate) as runbook.
- Write SQL queries for both alerts targeting `engine_event` table.
- Write PostHog query specs (JSON) in the runbook for Pontus to configure.
- Verify SQL queries execute without error on local Supabase.

**Files modified:**
- `docs/runbooks/RUNBOOK-journey-monitoring.md` (new)

**Acceptance criteria:**
1. Runbook contains Alert A + B each with: trigger condition, SQL, PostHog spec, suppression condition.
2. Both SQL queries execute without error on local Supabase (`psql -c "<query>"` exits 0).
3. Runbook falsifiable test: insert 5 `journey run_started` + 1 `journey stuck` rows to `engine_event`; stuck-rate query returns 0.2 (fires alert).
4. OQ-7a answered by Pontus before SS-5 dispatch.

**Token budget:** ~1.5k tokens (SQL + runbook).
**Dependencies:** None (doc-only except SQL verification).

---

## Out of Scope — Kill List

- ADR-0215 stuck-detector event-driven path (Phase 3 #4 — must ship BEFORE Phase 4 entry).
- N-C worker / `run_dev` cloud execution (`campaign/botsson-arena` or new campaign).
- Mobile journey authoring or publish UI (ADR-0133 absolute ban).
- `paused` state on mobile (no BFF pause endpoint; no server-side pause).
- Second enrich pass post-activation (deferred from author-enrich).
- PostHog alert automation (Pontus configures manually per runbook).
- Any Edge Function other than `journey-stuck-detector`.
- Web Fjernkontroll changes (spring physics already implemented in M5.1).
- Stage-engine ADR-0195 authority loader fix (verify landed in `campaign/botsson-arena`).

---

## Open Questions for Pontus

| # | Question | Impacts |
|---|---|---|
| OQ-1 | Is Phase 3 #4 (ADR-0215 Option A) being actioned before Phase 4 dispatch, or is Pontus waiving the ≥4-of-5 entry condition? | Phase 4 dispatch gate |
| OQ-2 | Seed-missions seeding strategy: per-workspace CROSS JOIN (recommended) or single-tenant only? | SS-2 migration shape |
| OQ-3 | Kill-switch scope: `journey.run_guided` only, or all 4 journey capabilities? | SS-4 migration content |
| OQ-4 | Should the un-kill migration auto-restore `autonomous`, or should it require a manual level decision at incident time? | SS-4 un-kill migration design |
| OQ-5 | PR #233 blocked migrations: have any of these already been applied to persistent preview `cibmhhgsrdmpnmcikalu`? Run: `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 10` on preview to check. | Rollout sequence §8 |
| OQ-6 | Are there additional journeys beyond `check-my-schedule` and `complete-trainee-core-journey` that should get seed-missions in Phase 4? | SS-2 scope |
| OQ-7a | Is PostHog alerting configured and available for Smartout? Or is Telegram/Supabase cron the monitoring channel? | SS-5 alert delivery shape |
| OQ-7b | Is there an ops on-call channel (Telegram bot, Slack) where monitoring alerts should be delivered? | SS-5 runbook delivery section |

---

## Risks

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Reanimated v4 `withSpring` API changed from v3 | Low | Medium | Verified: parameter names `stiffness/damping/mass` unchanged in v4.2.1. Test on device before merge. |
| Kill-switch UPDATE finds 0 rows (authority seed not applied to target DB) | Medium | High | SS-4 acceptance criterion #1 must be verified before any kill deployment. Add guard: `DO $$ BEGIN IF (SELECT COUNT(*) FROM engine_authority_config WHERE capability = 'journey.run_guided') = 0 THEN RAISE EXCEPTION 'Kill-switch target missing — run authority seed first'; END IF; END $$` |
| Seed-missions coaching content too thin (empty-string success_criteria bypasses NOT NULL but fails ADR-0194) | Low | Medium | SS-2 acceptance criterion #3 blocks merge if any `success_criteria` is empty. |
| PR #233 migrations already partially applied to preview → conflict on re-apply | Medium | Medium | Use `ON CONFLICT DO NOTHING` in seed migrations; `IF NOT EXISTS` in DDL. All campaign migrations already follow this pattern. Pontus verifies via schema_migrations query (OQ-5). |
| `paused` state absent on mobile causes web-mobile state machine divergence | Low | Low | Documented as known gap; mobile simply never enters `paused`. BFF status poll never returns `paused` because no BFF pause endpoint exists. Non-blocking for Phase 4. |
| Monitoring alert noise during non-working hours | Medium | Low | Alert A suppression condition (no active runs in last hour) prevents false positives overnight. |

---

## Post-Phase 4 Checklist

Per sub-sortie before `close-feature.sh`: decision log updated · journey doc written · typecheck 0 errors · handoff written · E2E artefact-asserting tests (SS-1 + SS-2) · Invariant 12 (every "complete" cites grep/SQL/test) · `grep -rn "packages/ai/src/journey" apps packages scripts` → 0 · `grep -rn "journey_status ADD VALUE" supabase/migrations` → 0.
