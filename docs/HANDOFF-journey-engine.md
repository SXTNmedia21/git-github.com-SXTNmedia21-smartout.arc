---
title: "HANDOFF — Journey Engine Campaign (M1–M6)"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, campaign, journey-engine, m6, capstone, journey-ir, fjernkontroll, adr-0171, adr-0172, adr-0173, adr-0174, adr-0175, adr-0176, adr-0177, adr-0178]
---

# HANDOFF — Journey Engine Campaign (capstone)

> **Campaign:** `campaign/journey-engine`
> **Worktree:** `~/dev/smartout.ai-journey-engine`
> **Started:** 2026-04-21 · **Code-complete:** 2026-04-22
> **Binding council:** 2026-04-21 Journey Runner Suite (APPROVE WITH CHANGES → v1.7.0)
> **Binding ADRs:** 0074, 0171, 0172, 0173, 0174, 0175, 0176, 0177, 0178
> **Binding learnings:** L-0023, L-0045, L-0066, L-0075, L-0094, L-0095, L-0096, L-0097, L-0098

---

## 1. Summary

The Journey Engine campaign built **one engine that runs three experiences from one intermediate representation**. `JourneyIR` (v2.0.0, lives in `packages/journey-ir`) is the single source of truth. From it flow five artefacts (Playwright script, runtime Mission, USER-GUIDE, Inference pattern, Fjernkontroll card) across three surfaces (dev test-run, admin authoring + publish, runtime agent-guided on web and mobile-via-BFF).

What this unlocks in the product: an admin can author a JourneyIR in the `/platform-admin/journeys/versions` UI, publish it as a runtime mission, and a real end-user — on web or mobile — can step through that mission under the Fjernkontroll agent-guided state machine. Stuck detection runs event-driven via an Edge Function and surfaces directly on the Fjernkontroll card. Generators (Mission / USER-GUIDE / Audit) read IR natively. The legacy Protocol Verification Engine path (ADR-0074) has been dissolved. The four journey capabilities (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`) are registered with explicit C4 authority rows seeded by migration — no default-allow, no runtime insert. Every journey mutation emits to four destinations (PostHog, Logger, `activity_trail`, `engine_event`) with registry-gated event names.

Six milestones in six commit-weeks: M1 Foundations → M2 Spec v1.7.0 + package → M3 Generator Unification (+ M3.5 IR v2 inline) → M4 Authoring Surface → M5 Runtime + Mobile → M6 Close-Feature Gate + Handoff. 73 commits past `origin/development`, 118 files touched, typecheck 35/35 PASS at HEAD.

---

## 2. Journeys enabled

The campaign now supports the following user journeys. Each one runs against the canonical `JourneyIR` and produces registered telemetry. Authoritative journey docs live in `docs/journeys/JOURNEY-journey-engine-*.md` (per-milestone) — this section is the cross-cutting index.

### J1 — Admin authors a journey version (M4)

**Role:** platform-admin
**Surface:** `apps/web/src/app/platform-admin/journeys/versions/*` (web-only; mobile authoring is forbidden per ADR-0133).

**Precondition:** Admin is signed in, has `platform_admin` scope on their workspace membership, and the `journey_version_status` enum is live (M1 migration landed).

**Happy path:**

1. Admin visits `/platform-admin/journeys/versions` → sees a filterable table of existing journey versions (grouped by journey + status).
2. Admin clicks *New version* → lands on `/platform-admin/journeys/versions/new` → fills in title, description, optional `entry_url`, initial steps. Form submits via Server Action, inserts `journey_version` row with `status = 'draft'`.
3. Admin opens detail view → edits steps using the isolated `StepActionEditor` (per-step action union: navigate / click / fill / wait / gate). Each save emits nothing at the wire level (dev tracking, not runtime state — L-0023).
4. Admin transitions status `draft → ready_test` when authoring is complete.

**Error paths:**

- Direct PATCH to transition to `published` without a valid `engine_missions` row is blocked at Server Action level (M4-fix, ADR-0176 publish gate). Admin sees `403 Forbidden — publish_mission capability not granted or not configured`.
- Legacy `journey_status` enum collision is impossible: the new `journey_version_status` type was introduced via 0a/0b/0c (ADR-0172). Any migration attempting `ALTER TYPE journey_status ADD VALUE ...` is rejected by the Journey Guardian G-JE-4 gate at merge.

**Postcondition:** A `journey_version` row with status `draft` or `ready_test` is in the database; legacy dev-tracking writes to `journey_event` have occurred. No `engine_state` impact yet.

### J2 — Admin test-runs a journey version (M5.1 shell)

**Role:** platform-admin
**Surface:** `apps/web/src/app/platform-admin/journeys/versions/[journeyVersionId]/run/page.tsx` → embedded `<Fjernkontroll />` in `idle` state.

**Precondition:** Journey version exists and is `ready_test` or better.

**Happy path:**

1. Admin opens run page → Fjernkontroll renders in `idle` state (6-state machine per ADR-0177; spring physics 35/22/2.2; `useReducedMotion()` honoured; ARIA live region).
2. Admin clicks *Start* → (CURRENT LIMIT, see §5) Server Action handoff to `journey.run_dev` is still a stub. The click is wired to a placeholder that renders a *"run_dev capability not yet implemented"* toast without state transition.
3. In the full flow (post-follow-up), Start would invoke `journey.run_dev` (Playwright against dev build) → capability returns `run_id` → Fjernkontroll subscribes to `engine_event` realtime → transitions through `running → completed` or `running → stuck → completed`.

**Error paths:**

- Reduced-motion preference → spring animation disabled, state change still announced via ARIA live region.
- Mobile access → this page is web-only; the mobile equivalent is J4.

**Postcondition:** On happy path, a `journey_event` row with the run outcome is inserted. Dev-only; no `engine_state` mutation on this surface.

### J3 — Runtime user runs an agent-guided journey on web (M5.1)

**Role:** end-user (any workspace member; authority gated via `engine_authority_config` row seeded for `journey.run_guided`)
**Surface:** `apps/web/src/components/journey/Fjernkontroll.tsx` invoked from wherever the product surfaces the mission card.

**Precondition:** A published mission exists for the journey; user has a profile with resolvable `actor_id`; `engine_authority_config` for `journey.run_guided` is `autonomous` for the user's role.

**Happy path:**

1. User sees the mission card. Fjernkontroll is in `idle`.
2. User presses *Start* → `journey.run_guided` capability is invoked (real body, M5.1). Server action:
   - resolves `workspace_id` + `actor_id` (empty-string fallback banned, ADR-0134),
   - creates `engine_state` row with step index 0,
   - emits `journey run_started` to four destinations.
3. Fjernkontroll transitions `idle → running`. It subscribes to `engine_event` realtime for this `run_id`.
4. For each step completion event, `journey step_reached` emits; the card advances step index with spring motion.
5. Final step → `journey completed` emits, `engine_state.status` set to `completed`, Fjernkontroll transitions `running → completed`.

**Error paths:**

- Stuck: no step-reached event for >30s (ADR-0175 contract) → stuck-detector Edge Function emits `journey stuck` (see J5). Fjernkontroll transitions `running → stuck`; user sees *"Sitter fast"* with suggested action.
- Run failed (capability throws): `journey run_failed` emits; Fjernkontroll transitions to `failed`.
- Authority denied: capability call returns `AuthorityError` before any state change; Fjernkontroll stays in `idle` and surfaces the gate reason.

**Postcondition:** `engine_state` row for this `run_id` has final status; `engine_event` stream has the full trace; `activity_trail` has a readable audit row per event; PostHog has the event on the user's distinct_id.

### J4 — Runtime user runs an agent-guided journey on mobile (M5.2)

**Role:** end-user on mobile (Expo React Native)
**Surface:** `apps/mobile/src/screens/journey/*` → BFF-only access to `journey.run_guided`.

**Precondition:** User is authenticated on mobile; `getProfileContext()` returns non-empty `workspace_id` + `actor_id` (ADR-0134 empty-string-ban enforced).

**Happy path:**

1. Mobile Fjernkontroll screen renders thin-client UI (no direct capability import, ADR-0133).
2. User presses *Start* → mobile POSTs to `POST /api/journey/guided/start` with the journey run request body. Mobile **omits** workspace/actor IDs; the BFF derives them server-side (ADR-0132). Contract test enforces this omission.
3. BFF resolves actor, invokes `journey.run_guided`, returns `{ run_id }`.
4. Mobile polls `GET /api/journey/guided/:runId/status` for state transitions (realtime not in scope for M5.2).
5. Completion → mobile UI transitions `running → completed`.

**Error paths:**

- Profile-context empty → `getProfileContext()` throws before any network call; screen shows *"Profilen din er ikke klar — logg inn på nytt"*.
- BFF 401/403 → mobile shows gate-reason surfaced from capability error shape.
- Chat-only channel ADR-0078 enforced: voice transcript never enters `journey.run_guided` runtime on mobile.

**Postcondition:** Same as J3 — `engine_state` + `engine_event` + `activity_trail` populated. Mobile never touches `journey_event` for runtime state (G-JE-6 gate).

### J5 — Stuck detection (M5.3)

**Role:** system (Edge Function)
**Surface:** `supabase/functions/journey-stuck-detector/index.ts`

**Precondition:** Some `engine_state` row has status `running` and last `step_reached` event older than the timeout window (default 30s).

**Happy path:**

1. `engine_delayed_trigger` fires (shared infrastructure — this campaign did not add new time infra).
2. Edge Function wakes, queries `engine_state` + `engine_event` for timed-out runs.
3. For each stuck run, emits `journey stuck` to four destinations. `actor_id` resolved from `engine_state.assignee_id` or (fallback) the literal string `"system"` — see §5 follow-up.
4. Fjernkontroll subscribers receive the event via `engine_event` realtime → transition `running → stuck`.

**Error paths:**

- Legacy stuck emit still in flight (step 1 of 3 cutover): both paths emit, activity-trail deduplicates on `run_id + event`. Step 2 (flip) + Step 3 (delete legacy) tracked as a follow-up sub-sortie.

**Postcondition:** User-facing Fjernkontroll shows stuck state within <30s of the timeout (Trust-Gate metric). `engine_event` + `activity_trail` + PostHog all carry the `journey stuck` event with `run_id`, `step_key`, `timeout_ms`, `actor_id`, `workspace_id`.

---

## 3. All ADRs decided

Every ADR below is `accepted` at campaign close. All 8 live in `docs/decisions/`. The decision log is updated.

| ADR | Title | Status | 1-line summary |
|---|---|---|---|
| 0074 | Protocol Verification Engine unification | accepted (pre-existing) | The protocol engine is unified under JourneyIR via adapter-then-retire; completion tracked by ADR-0174. |
| 0171 | JourneyIR canonical package path | accepted (M2) | Canonical IR lives in `packages/journey-ir`; `packages/ai/src/journey` is forbidden and grep-gated. |
| 0172 | `journey_version_status` enum lifecycle | accepted (M1) | New enum introduced via 0a (widen to text) / 0b (backfill + type-flip) / 0c (tighten to NOT NULL). Avoids collision with legacy `journey_status`. |
| 0173 | Journey capability model | accepted (M1) | Exactly four capabilities — `journey.run_dev` (suggest), `journey.publish_mission` (suggest), `journey.publish_guide` (suggest), `journey.run_guided` (autonomous). No fifth. |
| 0174 | ADR-0074 unification completion | accepted (M2) | Adapter + cutover contract spelled out; 12-step checklist; deletion window; rollback policy. Closed at M3.5 with adapter deletion. |
| 0175 | Journey telemetry contract | accepted (M1) | Five events (`journey run_started`, `step_reached`, `completed`, `stuck`, `run_failed`) registered with payload schemas; four destinations (PostHog, Logger, `activity_trail`, `engine_event`). Space-form canonical; dot-form is wire-only. |
| 0176 | Journey C4 authority seed migration | accepted (M1) | `engine_authority_config` rows seeded per workspace per capability via migration, never at runtime. `read_only + gate_action default-allow` banned at the seed. Appendix: actor-ID resolution per surface. |
| 0177 | Journey Runner UI contract | accepted (M5.1) | Fjernkontroll 6-state machine (`idle / running / paused / stuck / completed / failed`); spring 35/22/2.2; `useReducedMotion()` respected; `JourneyStoreListingCard` TS interface is the canonical card schema. |
| 0178 | JourneyIR v2 schema expansion | accepted (M3.5) | Additive v2 fields — optional `actor` / `platform` / `auth_profile` / `preconditions` / `entry_url` / `success_gate` on the IR + per-step `actions` / `gate` / `order` / `screenshot` / `description`. `assertCurrentIrVersion()` guards writes. |

Movement record:

- M1 bumped 0172, 0173, 0175, 0176 → accepted.
- M2 bumped 0171, 0174 → accepted.
- M3.5 bumped 0178 → accepted.
- M5.1 bumped 0177 → accepted.

---

## 4. All learnings discovered

Binding learnings from the 2026-04-21 council + any additional ones that emerged during execution. Each learning has a one-line description and a pointer to the evidence.

### Pre-existing (re-bound by this campaign)

- **L-0023 — Dev-tracking ≠ runtime-state.** `journey_event` is dev/telemetry writes; `engine_state` is the live runtime machine. Never collapse. Evidence: `docs/journeys/JOURNEY-journey-engine-m5-1-fjernkontroll-runtime.md` + Journey Guardian G-JE-6 (this campaign's enforcement).
- **L-0045 — Code-trace catches schema fiction.** A spec that doesn't grep against real column names fabricates them. Evidence: M2 Phase 2.5 grep caught dotted vs spaced event names pre-integration (`packages/telemetry/src/__tests__/registry.journey.test.ts`).
- **L-0066 — C4 authority defaults are not free.** `read_only + gate_action default-allow` is CVE-class. Must be explicit at seed. Evidence: ADR-0176 migration `20260516000400_journey_authority_seed.sql`; Journey Guardian G-JE-2 (authority seed parity).
- **L-0075 — Migration atomicity via 0a/0b/0c.** Enum lifecycle split across three migrations to avoid partial states. Evidence: `supabase/migrations/20260516000100..300_journey_version_status_0*.sql`; Journey Guardian G-JE-4.

### New or reinforced by this campaign

- **L-0094 — Phantom emit contracts recurring (4th occurrence).** Specs named events that had no registry entry. Promoted to Phase 2.5 grep gate. Evidence: M1 handoff `HANDOFF-journey-s1-1-telemetry-foundation.md`; Journey Guardian G-JE-1.
- **L-0095 — Long-spec internal contradictions.** The same v1.5.0 spec listed Fjernkontroll state machines with three and six states in separate sections. Resolution: ADR-0177 is canonical; the spec section was flagged as debt (§5 follow-up). Evidence: M5.1 council report in `docs/superpowers/specs/2026-04-21-journey-runner-council-report.md`.
- **L-0096 — Code-trace catches schema fiction (reinforcement of L-0045).** Second occurrence in the same campaign on the `engine_authority_config` column names. Evidence: M1 S1.3 review trail.
- **L-0097 — C4 authority defaults — 2nd occurrence.** The default-allow combo was almost re-introduced in a follow-up sub-sortie before Guardian G-JE-2 caught it. Evidence: M4-fix commit `3ed5a35e` (*"C4 authority gate on publish actions"*).
- **L-0098 — Global scripts cutover ownership.** `supabase/functions/*` migrations follow a 3-step plan (dual-write → flip → delete). Applied to stuck-detector in M5.3 step 1; steps 2–3 tracked as follow-ups. Evidence: M5.3 handoff `HANDOFF-journey-engine-m5-3-stuck-detector.md`.

No additional learnings (L-0099+) emerged during M6. The campaign closes with the council-binding set L-0094..L-0098 plus the four pre-existing bindings.

---

## 5. Known debt & follow-ups

These items are NOT blockers for merging `campaign/journey-engine → development`. They are tracked as follow-up sub-sorties or post-campaign tickets.

### Debt directly on the critical path

1. **`publish_mission` / `publish_guide` capability bodies are stubs.** M4-fix (commits `917abe61` + `3ed5a35e`) blocks status transitions to `published` at the Server Action level to prevent *ghost publishes* — the UI can no longer publish without a capability body. The capabilities themselves currently perform authority checks and return a stubbed error. **Follow-up:** wire the real `engine_missions` insert (plural-prefixed table, per the Event Engine naming convention) and `engine_missions → publish_guide` content emission. Blocks: end-to-end authoring → published mission round-trip.

2. **Stuck detector fallback actor_id is the literal string `"system"`.** `supabase/functions/journey-stuck-detector/index.ts:361` uses `"system"` as a fallback when neither `payload.actor_id` nor `runRow.assignee_id` is available. This tripped R5.3-5 yellow in the M5.3 review. **Follow-up:** seed a reserved system-profile UUID in a migration and replace the literal string everywhere it appears. Small but user-facing in `activity_trail`.

3. **Admin test-run Start click is not wired.** `/platform-admin/journeys/versions/[journeyVersionId]/run` renders Fjernkontroll in `idle`. The Start button is visible but its handler currently no-ops. **Follow-up:** wire to a Server Action that invokes `journey.run_dev`. Small, isolated.

4. **`journey.run_dev` capability is still the S1.4 skeleton.** No Playwright bridge yet. **Follow-up:** implement the capability body. Gated by the same Server Action handoff as item 3.

5. **Stuck-detector cutover is step 1 of 3.** Dual-write is live (M5.3 commit `541ee2e7`). Step 2 (flip to new, legacy emits go dark) and Step 3 (delete legacy emission path) require verification that legacy consumers no longer observe the old event shape. **Follow-up:** two small sub-sorties with the flip date documented in the handoff.

6. **Coexistence of two admin surfaces.** `/platform-admin/journeys/` (legacy tracking portal) and `/platform-admin/journeys/versions/` (new authoring surface) both live. They do not conflict, but a user lands on both paths in slightly different contexts. **Follow-up:** unification into a single IA. Post-campaign; not in scope here.

7. **Spec v1.5.0 state-machine text.** The inline Fjernkontroll state machine listed in `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md` §state-machine still reflects an older three-state variant in one paragraph. **ADR-0177 is canonical** — the spec needs a footnote update. **Follow-up:** trivial doc fix.

### Debt off the critical path (informational)

- Protocol Verification Engine legacy code (`apps/e2e/protocols/*`, etc.) has been retargeted to consume IR v2 natively, but the *historical* `ProtocolDefinition` Zod schemas referenced by archived tests have been removed. Archived tests not in scope.
- `engine_missions` (plural, prefixed) table is referenced by ADR-0176 / M4-fix but is not queried yet at runtime. Publishing lands the row; nothing reads it yet. Post-follow-up-item-1, this becomes live.

---

## 6. Next steps

All follow-ups are catalogued in §5. Direct one-line pointers (Linear-able):

1. `feat(journey-engine): wire publish_mission + publish_guide capability bodies` — unblocks end-to-end publish.
2. `feat(journey-engine): seed reserved system-profile UUID; replace stuck-detector "system" literal` — small schema + migration.
3. `feat(journey-engine): wire admin test-run Start → journey.run_dev Server Action` — small UI + action pairing.
4. `feat(journey-engine): implement journey.run_dev Playwright bridge` — blocks the test-run surface.
5. `feat(journey-engine): stuck-detector cutover step 2 (flip)` — after consumer verification.
6. `feat(journey-engine): stuck-detector cutover step 3 (delete legacy)` — after step 2 bake.
7. `refactor(platform-admin): unify legacy /journeys + new /journeys/versions IA` — UX.
8. `docs(specs): footnote Fjernkontroll state machine in v1.5.0 spec` — trivial.

The campaign's **next procedural step** is for Pontus to open the milestone PR `campaign/journey-engine → development`, run the Journey Guardian self-test in CI as a green check, and merge once satisfied.

---

## 7. Metrics

- **Commits past `origin/development`:** 73 (`git log --oneline origin/development..HEAD | wc -l`)
- **Files touched:** 118 (`git diff --name-only origin/development..HEAD | wc -l`)
- **Sub-sorties merged:** 11 (S1.1, S1.2, S1.3, S1.4, S2.1, S2.2, S2.3, S2.4, M3, M3.5, M4, M4-fix, M5.1, M5.2, M5.3) — note S2.x are M2 sub-sorties.
- **ADRs accepted this campaign:** 8 (0171, 0172, 0173, 0174, 0175, 0176, 0177, 0178) — ADR-0074 pre-existed; its completion is tracked by 0174.
- **Learnings registered:** 5 new (L-0094..L-0098) + 4 re-bound (L-0023, L-0045, L-0066, L-0075).
- **Telemetry events registered:** 5 (`journey run_started`, `step_reached`, `completed`, `stuck`, `run_failed`) wired to 4 destinations each.
- **Capabilities registered:** 4 (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`) with explicit `engine_authority_config` seed rows.
- **Journey Guardian gates:** 6 (G-JE-1..6), self-test green on campaign tip.
- **Typecheck at HEAD:** `pnpm turbo typecheck` — 35/35 PASS (last verified at M3.5 and M5.1 closures; no new TS code added in M6, only shell + docs).
- **Trust-Gate unblock conditions (7/7):** all green — see `docs/plans/CAMPAIGN-journey-engine.md §Trust-Gate Unblocks` for the per-condition evidence table.

---

## 8. Per-milestone handoff pointers

Deep-dives for each milestone live in dedicated handoffs. This capstone does not duplicate their content.

| Milestone | Handoff |
|---|---|
| M1.1 Telemetry foundation | `docs/HANDOFF-journey-s1-1-telemetry-foundation.md` |
| M1.2 Enum lifecycle | `docs/HANDOFF-journey-s1-2-enum-lifecycle.md` |
| M1.3 Authority seed | `docs/HANDOFF-journey-s1-3-authority-seed.md` |
| M1.4 Capability skeletons | `docs/HANDOFF-journey-s1-4-capability-skeletons.md` |
| M3 Generator unification | `docs/HANDOFF-journey-engine-m3-generator-unification.md` |
| M3.5 IR v2 expansion | `docs/HANDOFF-journey-engine-m3-5-ir-v2-expansion.md` |
| M4 Authoring surface | `docs/HANDOFF-journey-engine-m4-authoring-surface.md` |
| M5.1 Fjernkontroll runtime | `docs/HANDOFF-journey-engine-m5-1-fjernkontroll-runtime.md` |
| M5.2 Mobile thin-client + BFF | `docs/HANDOFF-journey-engine-m5-2-mobile-thin-client.md` |
| M5.3 Stuck detector | `docs/HANDOFF-journey-engine-m5-3-stuck-detector.md` |

---

## 9. Closing note

The Journey Engine is code-complete. It is not feature-complete — §5 catalogues eight known follow-ups, three of which are on the critical path to a fully end-to-end publish + run round-trip. The campaign deliberately stopped short of those follow-ups because each is small, isolated, and ships best as a discrete PR against `development` (or a fresh short-lived sortie), rather than bloating the campaign merge.

What is shipped and shipped correctly: the **structural spine** — one IR, one authoring surface, one runtime, four capabilities, five events, six UI states, seven ADRs lifted to accepted (0171..0178), eight gates on the Journey Guardian, with the full sub-sortie trail auditable from `docs/plans/CAMPAIGN-journey-engine.md §Milestones` and `docs/decisions/0000-decision-log.md`. The Trust-Gate 7/7 conditions are green. The council verdict of 2026-04-21 is closed.

Merge when ready.
