# CLAUDE.md — campaign/journey-engine

> Worktree: `~/dev/smartout.ai-journey-engine` · Branch: `campaign/journey-engine` · Started: 2026-04-21
> Campaign doc: `docs/plans/CAMPAIGN-journey-engine.md`
>
> **Scoped CLAUDE.md.** This file reflects the sole purpose of this worktree — the Journey Engine. For full Smartout v3 project rules (stack, repo layout, all modules, all ADRs, global traps), read `CLAUDE.md` on `development` via `git show development:CLAUDE.md`. Everything in this file is additive or narrowing relative to that baseline.

---

## 🎯 Mission — Why This Worktree Exists

**Build one Journey Engine that runs three experiences from one intermediate representation.** Not three parallel systems ("protocols vs journeys vs missions"). Not three IRs. One JourneyIR, one authoring surface, one runtime, five generated artefacts.

### The promise this worktree delivers

1. **One Source → Five Artefacts.** `JourneyIR` (shared package) is the only truth. From it: Playwright script (dev), Mission (runtime), USER-GUIDE (docs), Inference pattern (telemetry), Fjernkontroll card (UI). No dual write. No drift.
2. **Three Experiences, One Engine.** Dev test-run / Docs & Mission publish / Runtime agent-guided — all three run the same IR. Capabilities differ, authority differs, surface differs. Engine is one.
3. **Phantom contracts die here.** Every emit path registered in `packages/telemetry/src/registry.ts` before code merges. 4 destinations wired (PostHog + Logger + `activity_trail` + `engine_event`). No `emit()` without a registry entry.
4. **C4 authority is a seed, not a default.** `engine_authority_config` seeded at migration time with explicit rows for every journey capability. `read_only` + `gate_action` default-allow combo is CVE-class — banned at the seed.
5. **Mobile thin-client only.** `journey.run_guided` is the only capability that may surface on mobile, and only as BFF-proxied thin client (ADR-0132). No direct capability calls. No authoring. No mission editing. No `packages/ai/src/journey` shortcut — the canonical path is `packages/journey-ir`.

### How "best" is measured (concrete, not generic)

- **Authoring-to-artefacts-latency:** < 5 s from `JourneyIR` save to all 5 artefacts generated in preview.
- **Emit-registry-coverage:** 100 % of journey mutations covered; CI fails on an `emit()` call with no registry entry.
- **Trust-Gate-Unblocks:** All 7 council unblock conditions (see below) green before v1.7.0 spec approval.
- **Stuck-detection-latency:** < 30 s from step timeout to `journey.stuck` event emitted and ingested by the Fjernkontroll card.
- **Generator-unification:** 0 files in `apps/e2e/generators/` that read `docs/protocol/` directly — all go through `protocolToJourneyIR()` adapter until full migration, then adapter deleted.
- **`packages/ai/src/journey` path count:** Pre-campaign state is **1 file + 1 consumer** (`packages/ai/src/journey/compile.ts` introduced by PR #40 "Feat/journey engine core", consumed by `apps/web/src/app/platform-admin/journeys/actions/compile.ts` via `@smartout/ai/journey/compile` export). Target state: **exactly 0**, achieved by the M2 migration sub-sortie (move to `packages/journey-ir/src/compile.ts`, delete legacy file, drop `./journey/compile` export from `packages/ai/package.json`). After migration lands: any reference is a merge blocker.

### The 7 Trust-Gate Unblock Conditions

Council Phase 5 Trust Gate (2026-04-21 Journey Runner Suite v1.6.0 re-review) blocks v1.7.0 spec approval until ALL seven unblocks are green. Every sub-sortie in this campaign must trace back to one or more of these:

1. **Telemetry registry exists** — 5 journey events (`run_started`, `step_reached`, `completed`, `stuck`, `run_failed`) in `packages/telemetry/src/registry.ts` with payload schemas (ADR-0175).
2. **Enum lifecycle migration** — `journey_version_status` enum introduced via 0a/0b/0c pattern (L-0075), resolving `ready_test` collision with existing `journey_status` (ADR-0172).
3. **C4 authority seed migration** — `engine_authority_config` rows for 4 capabilities (ADR-0173/0176) in a migration, not runtime insert.
4. **Capability skeletons registered** — 4 capabilities (`journey.run_dev`, `journey.publish_mission`, `journey.publish_guide`, `journey.run_guided`) scaffolded in `packages/ai/src/capabilities/journey/` with correct authority defaults (ADR-0173).
5. **`packages/journey-ir` created** — canonical package, not `packages/ai/src/journey` (ADR-0171). Workspace tsconfig references added. Legacy `packages/ai/src/journey/compile.ts` migrated into `packages/journey-ir/src/`, consumer `apps/web/src/app/platform-admin/journeys/actions/compile.ts` re-imports from `@smartout/journey-ir`, legacy file + `./journey/compile` export deleted. Grep returns zero results post-migration.
6. **`actor_id` resolution doc** — written rule in ADR-0176 on how dev/publish/runtime each resolve actor (dev user session / admin session / mobile `getProfileContext()`). ADR-0134 contract upheld on the runtime branch.
7. **ADR-0074 unification delta spec** — appendix documenting generator retarget from `docs/protocol/` to `JourneyIR`, `protocolToJourneyIR()` adapter contract, cutover steps, and deletion window (ADR-0174).

> Unblock state for the campaign lives in `docs/plans/CAMPAIGN-journey-engine.md §Trust-Gate Unblocks`. Update that table at the close of every sub-sortie.

### 100% Dedikasjon — Ikke-forhandlingbar

**Dette worktree-et implementerer KUN Journey Engine.** Ingen unntak:

- Daily operations (D6 sessions, hooks, tasks) → `campaign/daily-operation`
- Year wheel / season authoring → `campaign/year-wheel`
- Helpdesk tickets → `campaign/helpdesk`
- Botsson / voice / agent-router / stage-engine work → `campaign/botsson-arena`
- Onboarding / contract composition → web-only, separate scope
- Any Edge Function **other than** `supabase/functions/journey-stuck-detector` → separate scope

If a task touches another campaign's surface → **STOPP**. Flag to user. Do not write code. Spawn a new sortie or coordinate with the right campaign. Worktree-hygiene is part of the quality bar.

### Roadmap — Six Milestones

See `docs/plans/CAMPAIGN-journey-engine.md §Milestones` for per-milestone detail. Summary:

- **M1 Foundations (week 1):** Emit registry + enum 0a/0b/0c + capability skeletons + authority seed + 7 ADRs move `proposed → accepted`.
- **M2 Spec v1.7.0 + Remaining Unblocks (week 2):** `packages/journey-ir` package, actor_id resolution doc, v1.7.0 spec with delta-review.
- **M3 JourneyIR + Generator Unification (week 3–4):** `protocolToJourneyIR()` adapter, generator retarget, full ADR-0074 unification.
- **M4 Authoring Surface + Store Listing (week 5–6):** `apps/web/src/app/platform-admin/journeys`, `JourneyStoreListingCard` (ADR-0177).
- **M5 Runtime Agent-Guided + Mobile (week 7–9):** Fjernkontroll state machine, stuck detector cutover (3 steps), mobile thin-client surface.
- **M6 Close-Feature Gate + Handoff (week 10):** Journey Guardian CI gate, comprehensive handoff, campaign milestone merge to development.

Each milestone revisits the previous one. Milestones are direction, not promises.

---

## Campaign Purpose

**Build the Journey Engine layer.** The authoring + runtime surface that powers three experiences from one IR. Cascade positioning:

- **Event Engine (primary)** — `engine_state` + `engine_process` + `engine_dispatch` execute journey runs; `engine_missions` (plural, prefixed per ADR) stores published missions; `engine_authority_config` gates every capability.
- **C4 Governance** — explicit authority rows per capability; no default-allow combos on journey tools.
- **Telemetry Plane** — journey events feed `activity_trail` + `engine_event` as canonical destinations.
- **Dev-tracking ≠ runtime-state (L-0023)** — `journey_event` captures dev/telemetry runs; `engine_state` holds live runtime mission state. Never collapse these.

The campaign explicitly implements the 2026-04-21 Journey Runner Suite council verdict (APPROVE WITH CHANGES → v1.7.0 required, all 7 ADRs 0171–0177 and all 5 learnings 0094–0098).

### In-Scope Surfaces

| Surface                                     | Path                                                   | Owner         |
| ------------------------------------------- | ------------------------------------------------------ | ------------- |
| JourneyIR package (canonical)               | `packages/journey-ir/**`                               | This campaign |
| Journey capabilities (4)                    | `packages/ai/src/capabilities/journey/**`              | This campaign |
| Journey authoring UI                        | `apps/web/src/app/platform-admin/journeys/**`          | This campaign |
| Generator retarget (Mission / Docs / Audit) | `apps/e2e/generators/**`                               | This campaign |
| Emit registry entries for journey           | `packages/telemetry/src/registry.ts` (journey.\* keys) | This campaign |
| Stuck detector Edge Function                | `supabase/functions/journey-stuck-detector/**`         | This campaign |
| Close-feature gate additions                | `scripts/close-feature.sh` (journey-related checks)    | This campaign |
| Fjernkontroll runtime card                  | `apps/web/src/components/journey/**` + mobile proxy    | This campaign |
| Store-listing card schema                   | `JourneyStoreListingCard` TS interface + UI            | This campaign |

### Explicit Out-of-Scope

- **Protocol Verification Engine** (ADR-0074 legacy) — preserved and wrapped via `protocolToJourneyIR()` adapter; the legacy engine itself is not refactored here beyond the adapter seam.
- **D6 sessions, hooks, tasks, reconciliations** — handled by `campaign/daily-operation`.
- **Season / planning cycle / D4 demand** — handled by `campaign/year-wheel`.
- **Helpdesk tickets / `channel_type='desk'`** — handled by `campaign/helpdesk`.
- **Stage engine / agent router / voice routing / Ultravox / LiveKit** — handled by `campaign/botsson-arena`.
- **Any Edge Function other than `journey-stuck-detector`** — separate scope.
- **Mobile authoring** — forbidden (ADR-0132/0133); mobile only proxies `journey.run_guided` via BFF.

> If a task slides into out-of-scope territory, stop and flag it — do not cross campaign boundaries silently.

---

## Source of Truth (narrowed)

Read these before touching journey-engine code:

0. `docs/ORIENTATION.md` — North Star cheat sheet (first at session start).
1. **Code + DB schema** — always wins.
2. **Journey Runner Suite spec** — `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md` (v1.6.0 now; v1.7.0 lands in M2).
3. **Council verdict & report** — `docs/superpowers/specs/2026-04-21-journey-runner-council-report.md` + `docs/council/COUNCIL-LOG.md` entry for 2026-04-21.
4. **Decision log** — `docs/decisions/0000-decision-log.md` (filter: `journey`, `JourneyIR`, ADRs 0074, 0171–0177).
5. **Binding ADRs** — 0074 (Protocol Verification Engine unification), 0171 (package path), 0172 (enum lifecycle), 0173 (capability model), 0174 (ADR-0074 unification completion), 0175 (telemetry contract), 0176 (C4 authority seed), 0177 (UI contract).
6. **Binding learnings** — L-0023 (dev-tracking vs runtime-state), L-0045 (code-trace catches schema fiction), L-0066 (C4 authority defaults not free), L-0075 (migration atomicity 0a/0b/0c), L-0094 (phantom emit contracts recurring — promotion candidate), L-0095 (long-spec internal contradictions), L-0096 (code-trace catches schema fiction — reinforcement), L-0097 (C4 authority defaults — 2nd occurrence), L-0098 (global scripts cutover ownership).

### Directly-Relevant ADRs

- **ADR-0024** — Authority policy (C4 primer; ADR-0176 extends for journey capabilities).
- **ADR-0074** — Protocol Verification Engine → JourneyIR unification (completion tracked via ADR-0174).
- **ADR-0075** — orientation / doc hierarchy (how this file fits).
- **ADR-0132** — Mobile AI Routing (thin-client, BFF → stage-engine). Binds `journey.run_guided` mobile path.
- **ADR-0133** — web composes, mobile executes. Journey authoring is web-only.
- **ADR-0134** — Mobile Telemetry Contract (workspace_id + actor_id via `getProfileContext()` before emit). Binds mobile runtime emit.
- **ADR-0171** — `packages/journey-ir` canonical; `packages/ai/src/journey` forbidden.
- **ADR-0172** — `journey_version_status` enum lifecycle (0a/0b/0c).
- **ADR-0173** — Four journey capabilities with C4 defaults.
- **ADR-0174** — ADR-0074 unification completion path (adapter + cutover).
- **ADR-0175** — Journey telemetry contract (5 events, 4 destinations).
- **ADR-0176** — Journey C4 authority seed migration.
- **ADR-0177** — Journey Runner UI contract (state machine, spring physics, `JourneyStoreListingCard`).

> New journey-engine decisions during this campaign land in `docs/decisions/` and are registered before merging to development.

---

## Sibling Campaigns (awareness, not dependency)

| Campaign        | Worktree                            | What they own                                                           |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| daily-operation | `~/dev/smartout.ai-daily-operation` | D6 sessions, hooks, tasks, reconciliations, deviations.                 |
| helpdesk        | `~/dev/smartout.ai-helpdesk`        | `channel_type='desk'` + `engine_state` as ticket; SLA orb, auto-assign. |
| year-wheel      | `~/dev/smartout.ai-year-wheel`      | Season planning (D4 demand, `planning_cycle`, `season_budget`).         |
| botsson-arena   | `~/dev/smartout.ai-botsson-arena`   | Agent capability work, voice routing, stage engine.                     |

If journey-engine work needs something from a sibling campaign, open a coordination note; never duplicate their tables or routes here.

---

## Database Focus

Tables this campaign mutates or consumes heavily. Review `database.types.ts` before changing any of them:

- `journey_version` (status column migrated to new `journey_version_status` enum per ADR-0172)
- `journey_event` (dev-tracking — NOT runtime state; L-0023)
- `engine_state`, `engine_state_step`, `engine_process`, `engine_dispatch` (runtime mission execution)
- `engine_missions` (plural, prefixed — published mission store)
- `engine_authority_config` (C4 rows seeded per capability via migration — ADR-0176)
- `engine_delayed_trigger` (reused by stuck detector; no new time-infra)
- `engine_event` (telemetry destination)
- `activity_trail` (telemetry destination)

**Hard rules inherited from the project CLAUDE.md — all apply, no exceptions:**

- All new tables require `workspace_id`, `created_at`, `updated_at`, UUID PK.
- Migrations only via `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
- RLS everywhere. Both JWT **and** API key policies for any workspace-scoped table.
- Enum changes use 0a/0b/0c pattern (L-0075). Never `ALTER TYPE journey_status ADD VALUE` — that collision is exactly why ADR-0172 exists.
- C4 authority rows are **seeded by migration**, not inserted at runtime. Default `read_only` + `gate_action` default-allow is banned.
- **Dev-tracking ≠ runtime-state** — `journey_event` is dev/telemetry; `engine_state` is live. Do not collapse.
- **Develop against Supabase Local only.** `npx supabase start`. Never the Cloud DB.

**Load the `smartout-database-guide` skill before any SQL or schema work.**

---

## Capability Model (ADR-0173)

Exactly four journey capabilities. Registered in `packages/ai/src/capabilities/journey/`.

| Capability                | Surface                    | Default Authority | Purpose                                                                          |
| ------------------------- | -------------------------- | ----------------- | -------------------------------------------------------------------------------- |
| `journey.run_dev`         | Dev (Playwright)           | `suggest`         | Execute a journey run locally against a dev build, produce events + screenshots. |
| `journey.publish_mission` | Admin UI                   | `suggest`         | Publish a `JourneyIR` as a runtime mission to `engine_missions`.                 |
| `journey.publish_guide`   | Admin UI                   | `suggest`         | Publish a `JourneyIR` as a user-facing USER-GUIDE page.                          |
| `journey.run_guided`      | Runtime (web + mobile BFF) | `autonomous`      | Agent-guided step-through for end users; Fjernkontroll state machine surface.    |

No fifth capability. No shortcut paths. No direct `packages/ai/src/journey` path — canonical import is `packages/journey-ir`.

---

## Telemetry — Journey Events Registry

Every journey mutation emits. Registry lives in `packages/telemetry/src/registry.ts`. When adding or touching a journey mutation:

1. Confirm the event exists in the registry; if not, add it with full payload schema before the mutation code.
2. Wire all four destinations: PostHog, Logger, `activity_trail`, `engine_event`.
3. Never create a parallel event stream. `emit()` is the only path.
4. No mutation without `emit()` in the `onSuccess` of the TanStack mutation, Server Action, or capability tool.

### Required journey events (ADR-0175)

| Event                  | Emitted by                   | Required payload                                                                    |
| ---------------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| `journey.run_started`  | run_dev, run_guided          | `journey_version_id`, `run_id`, `actor_id`, `workspace_id`, `capability`, `surface` |
| `journey.step_reached` | run_dev, run_guided          | `run_id`, `step_key`, `step_index`, `actor_id`, `workspace_id`                      |
| `journey.completed`    | run_dev, run_guided          | `run_id`, `final_step`, `duration_ms`, `actor_id`, `workspace_id`                   |
| `journey.stuck`        | stuck-detector Edge Function | `run_id`, `step_key`, `timeout_ms`, `actor_id`, `workspace_id`                      |
| `journey.run_failed`   | run_dev, run_guided          | `run_id`, `step_key`, `error_code`, `error_message`, `actor_id`, `workspace_id`     |

L-0094 is the 4th occurrence of phantom emit contracts. **Phase 2.5 briefing fact-check MUST grep `packages/telemetry/src/registry.ts` for every journey.\* event named in any plan before Phase 3.**

---

## UI & Styling — Fjernkontroll Contract (ADR-0177)

- **Design System:** Nordic Split. Load the `smartout-nordic-split` skill before any `.tsx`/`.css` edit in `apps/web/` or `apps/mobile/` that touches visual output.
- **State machine (6 states):** `idle | running | paused | stuck | completed | failed`. Transitions documented in ADR-0177.
- **Motion:** Spring physics `stiffness=35, damping=22, mass=2.2` on all state transitions. No linear/ease-out cheats.
- **Accessibility:** `useReducedMotion()` respected on every animated element. ARIA live region announces state changes for assistive tech.
- **Touch target:** ≥ 44 pt on mobile. Fjernkontroll primary action = thumb zone.
- **Tokens only:** Hardcoded colors (`zinc-800`, `gray-*`) forbidden. Use `bg-background`, `text-foreground`, `border-border`.
- **Typography:** Instrument Serif for `font-heading`; Geist Sans body; Geist Mono data.
- **Icons:** Lucide only. No emojis in UI.
- **Store listing:** `JourneyStoreListingCard` TS interface (ADR-0177) is the card schema — do not invent per-surface variants.

---

## Mobile Parity — Narrow Boundary

Only `journey.run_guided` crosses to mobile. Every other journey capability is web-only.

On mobile, the runtime path is:

1. Mobile UI → BFF route (`/api/journey/guided/...`) → stage-engine → `journey.run_guided` capability (ADR-0132).
2. No direct capability import in `apps/mobile/`. No authoring. No Playwright. No publish actions.
3. Every emit MUST resolve `workspace_id` (non-null, non-empty) + `actor_id` via `getProfileContext()` (`apps/mobile/src/lib/profile-context.ts`) BEFORE `emit()`. Empty-string fallback = forbidden (ADR-0134). Offline-queue payloads Zod-validated at enqueue.

---

## What NOT To Do (campaign-scoped additions)

Inherits everything in the development-branch project CLAUDE.md, plus:

- Never add a NEW import from `packages/ai/src/journey` (ADR-0171). The path exists today as legacy (`compile.ts` from PR #40) with exactly one consumer; that single legacy reference is grandfathered until the M2 migration sub-sortie retires it. Any other reference is a merge blocker. Canonical is `packages/journey-ir`.
- Never add `ALTER TYPE journey_status ADD VALUE 'ready_test'` — use `journey_version_status` via 0a/0b/0c (ADR-0172).
- Never default a journey capability to `read_only` + `gate_action` default-allow — that combo is CVE-class (L-0066/L-0097, ADR-0176).
- Never call `emit('journey.*')` without a matching entry in `packages/telemetry/src/registry.ts`. Phase 2.5 grep is a merge gate.
- Never insert `engine_authority_config` rows at runtime — seed via migration (ADR-0176).
- Never collapse `journey_event` (dev) and `engine_state` (runtime) into one table (L-0023).
- Never build journey authoring or publish UI on mobile (ADR-0133). Authoring = web only.
- Never let generators in `apps/e2e/generators/` read `docs/protocol/` directly during or after M3 — go through `protocolToJourneyIR()` adapter, then delete the adapter at cutover (ADR-0174).
- Never drop the `protocolToJourneyIR()` adapter before the cutover checklist in ADR-0174 is ticked off.
- Never edit `supabase/functions/*` other than `journey-stuck-detector` from this worktree. Cutover of shared scripts follows L-0098's three-step plan (dual-write → flip → delete).

---

## Workflow in This Worktree

- **Direct commits to `campaign/journey-engine`** are fine for small in-campaign fixes/docs.
- **Sub-sorties** for larger features: `/start-feature <sub>` from inside this worktree creates `~/dev/smartout.ai-journey-engine-wt-N` on `feat/journey-engine-<sub>`.
- **Close a sub-sortie** with `/close-feature` — merges to `campaign/journey-engine` and syncs `origin/development` in.
- **Never** run `/close-feature` on `campaign/journey-engine` itself — campaigns don't close.
- **Keep fresh** with `/sync-campaign` when `development` moves ahead.
- Promotion to `development` is a manual PR/push when a milestone is ready.

### Feature closure gates (per sub-sortie)

Required before `close-feature.sh`:

1. Decision log updated for any new ADRs; any ADR moved from `proposed → accepted` has its status row bumped.
2. `docs/journeys/JOURNEY-<sub>.md` written (every flow: admin, runtime user, dev; happy + error paths).
3. `pnpm turbo typecheck` passes with 0 errors.
4. Handoff written (decisions + learnings + next steps).
5. Recommended: E2E test per journey in `apps/e2e/`, manual-test doc for UX checks.

**Journey-engine specific gates (in addition):**

6. **Emit-registry in commit:** If the sub-sortie adds or touches a journey mutation, the corresponding `packages/telemetry/src/registry.ts` entry is in the same commit. Phase 2.5 grep on the PR must return the event name.
7. **Authority seed in commit:** If the sub-sortie adds a new capability or changes a default, the `engine_authority_config` seed migration is in the same commit. No runtime inserts.
8. **Stuck detector cutover documented:** If the sub-sortie touches `supabase/functions/journey-stuck-detector`, the 3-step cutover (dual-write → flip → delete) is in the handoff with the flip date.
9. **No NEW `packages/ai/src/journey` references:** `grep -R "packages/ai/src/journey" apps packages scripts` returns the grandfathered legacy pair (`packages/ai/src/journey/compile.ts` + `apps/web/src/app/platform-admin/journeys/actions/compile.ts`) and nothing else, until the M2 migration sub-sortie lands. After that sub-sortie merges, grep must return zero. Any sub-sortie introducing a new reference is a merge blocker regardless of phase.
10. **No `ALTER TYPE journey_status ADD VALUE`:** `grep -R "journey_status ADD VALUE" supabase/migrations` returns zero results. Merge blocker if not.
11. **No phantom capabilities (ADR-0196 / ADR-0197).** A capability tool that emits `run_started` MUST produce its declared domain artefact in the same `execute()` call, OR return `{ok:false, error:'not_implemented'}` WITHOUT emitting `run_started`. Forbidden shape: `emit("journey run_started") → return {ok:true, note:"…skeleton / lands in M_"}`. Grep gate in `close-feature-journey-guardian.sh`: any capability `execute()` containing `emit(...run_started)` must also contain a DB write / file write / mutating POST / explicit `not_implemented` return within 40 lines. E2E test (per L-0118 + L-0125) must assert the artefact, not the return shape.
12. **Falsifiable campaign status claims (ADR-0196).** Every "complete" / "green" / "closed" row added to `docs/plans/CAMPAIGN-journey-engine.md` or this CLAUDE.md must cite a specific grep / SQL / test that, when run, returns deterministic pass/fail. Unbacked claims are rejected by `close-feature-journey-guardian.sh`.
13. **gate_action on every mutation (ADR-0196, reinforces ADR-0099).** Every journey capability tool whose `execute()` body performs `supabase.from(...).insert(...)` / `.update(...)` / `.delete(...)` MUST also call `callGateAction(...)` before the mutation — regardless of authority default (`suggest` / `autonomous`). `autonomous` is not a skip-the-gate license.

---

## Documentation Protocol

1. This file wins for campaign scoping. Project CLAUDE.md (on development) wins for structural facts.
2. Journey Runner Suite spec wins for product behaviour.
3. Binding ADRs (0074, 0171–0177) win for implementation shape.
4. If code contradicts any doc — **code wins**; update the doc in the same PR.
5. Every new doc in `docs/` gets YAML frontmatter; update `updated:` on every touch.
6. Never load `docs/archive/` — superseded.

---

## Changelog

| Date       | Version | Change                                                                                                                                                                                                                            | Author          |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 2026-04-21 | 1.0.0   | Campaign-scoped rewrite — narrows CLAUDE.md to journey-engine purpose.                                                                                                                                                            | Pontus + Claude |
| 2026-04-23 | 1.1.0   | Added Invariants 11 / 12 / 13 (no phantom capabilities, falsifiable status claims, gate_action on every mutation) per Council 2026-04-23 post-implementation audit (ADR-0194 / 0195 / 0196 / 0197 + L-0124 / 0120 / 0121 / 0122). | Pontus + Claude |
