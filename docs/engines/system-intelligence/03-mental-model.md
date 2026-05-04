---
title: "Journey Engine — Mental Model & Harness Integration"
status: draft
updated: 2026-04-28
created: 2026-04-28
module: journey
tags: [journey, harness, mental-model, source-of-truth, portable]
---

# Journey Engine — Mental Model

> Reusable across projects. Framework-agnostic. Describes the *what* and *why* — not the Smartout-specific `*.tsx` files.
>
> Companion docs (Smartout-specific):
> - `docs/architecture/modules/journey/SMARTOUT_JOURNEY_REGISTRY.md` — registry + 13-status lifecycle
> - `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md` — runner pipeline
> - `docs/decisions/0171-0177` — binding ADRs

---

## 1. Core Principle

**Every user-facing function in the product begins as a User Journey. Nothing else.**

Two-way contract:

- **Spec → Code.** A function cannot be built without a journey markdown file as input. The journey is the kravspec — the acceptance contract.
- **Code → Spec.** A function cannot ship without a verified journey. Closure gate blocks merge if journey missing or unverified.

Result: spec is the single source of truth. Code, tests, docs, missions, telemetry — all derived. Drift between layers becomes mechanically impossible because all layers share one origin.

A journey = **one actor achieving one goal through one sequence of steps**. Not a feature. Not a screen. Not a task.

---

## 2. Journey Document — Schema

One markdown file per journey. Frontmatter mandatory.

```yaml
---
feature: short-name              # binds journey to feature branch
status: draft | verified | broken
actor: employee | manager | admin | trainee | owner | all
platform: web | mobile | both
priority: P0 | P1 | P2 | P3
module: scheduling | onboarding | governance | ...
trigger: what initiates this journey
preconditions: [list]
test_assertion: one-line E2E truth
outcomes:
  success: what user sees on success
  empty: what user sees with no data
  error: what user sees when things break
---

## Journey: <Actor> <Action>

**Precondition:** state before start

1. User does X → System does Y → User sees Z
2. ...

**Postcondition:** state after success
**Error paths:** what happens on failure
```

That schema is the *only* input the journey engine takes. Everything downstream (tests, docs, missions, telemetry registry) is generated from it.

---

## 3. Journey Lifecycle (13 statuses)

```
idea → wizard → defined → ready_impl → building → review
   → ready_test → testing → ready_validation
   → implemented → active ⇄ inactive
                       ↓
                    broken
```

Three phases:

| Phase | Statuses | Owner |
|---|---|---|
| **Definition** | idea, wizard, defined | Author + Journey Agent |
| **Build** | ready_impl, building, review | Developer |
| **Test** | ready_test, testing, ready_validation | QA + Author |
| **Release** | implemented, active, inactive, broken | Product |

Each transition has explicit entry/exit criteria, a responsible role, and emits a `journey.status_changed` event.

`broken` is reachable from `active` only — production-discovered regression. Forces re-entry through `ready_test`.

---

## 4. Compile Pipeline — Define Once, Generate Many

A single journey markdown compiles into N derived artefacts. Each artefact is a *consumer view* of the same source.

```
                 ┌─────────────────────────┐
                 │   JOURNEY-<slug>.md     │  ← single source of truth
                 └────────────┬────────────┘
                              │
                              ▼
                  ┌─────────────────────┐
                  │   compile pipeline  │  (pure function, no I/O)
                  └──────────┬──────────┘
                             │
       ┌─────────┬───────────┼───────────┬──────────┬──────────┐
       ▼         ▼           ▼           ▼          ▼          ▼
   E2E test  Onboarding  Mission   Telemetry   Linear   Agent
   (.spec)   (web doc)   (engine)  (registry)  (issue)  (script)
```

Each artefact is **regenerable, never edited by hand**. If output drifts from spec → recompile. If spec drifts from output → fix spec.

CI gate: every commit that names a `journey.*` event must have a matching registry entry. Phantom emit = merge blocked.

---

## 5. Capability Surfaces — Same Spec, Three Runtimes

The journey engine exposes three named capabilities. Each runs the *same* journey spec but in different contexts. All three emit identical telemetry — one schema, one analytics dashboard, one regression detector.

| Capability | Surface | Caller | Runtime |
|---|---|---|---|
| `journey.run_dev` | web | Platform Admin runner-tab | Playwright in headed/headless mode against dev DB. **Verifies the spec is buildable.** |
| `journey.run_guided` | mobile (BFF-proxied) | Real end-user | Live runtime — agent narrates, user steps through real production flow. **Verifies the spec is livable.** |
| `journey.run_inferred` | server-side | Agent observing `engine_state` | Pattern-matches user state → offers a journey to bridge the gap. **Verifies the spec is reachable.** |

Plus two publish capabilities (write-side):

| Capability | Surface | Output |
|---|---|---|
| `journey.publish_mission` | web | Inserts into `engine_missions` (engine consumes) |
| `journey.publish_guide` | web | Writes to `docs/guides/` (website consumes) |

Capability count is frozen — guard rail enforced by closure gate. Adding a 6th capability is an ADR-class decision.

### Why the dev/runtime split is the killer feature

- Dev run produces the **same** `journey.run_started → step_reached → completed` event sequence as runtime.
- Same shape, same registry, same dashboard.
- If dev passes → runtime telemetry contract is already verified.
- If runtime drifts → dev run reproduces it.
- Test-as-runtime, runtime-as-test. One contract.

---

## 6. Fjernkontroll — Remote Runtime Control

Fjernkontroll = the **operator panel** for a journey instance. Lives in Platform Admin (dev) and surfaces in mobile UI (runtime). Same state machine, same commands, same events.

### State machine (six states)

```
   idle ─────► running ──┬──► completed
    ▲           │ ▲      └──► failed ──► idle (reset)
    │           ▼ │
    │         paused
    │           │
    │           └──► running (resume)
    │
    └──── abandon
              ▲
              │
   running ──► stuck ──► running (retry)
                    └──► idle (abandon)
```

### Commands (UI verbs)

| Command | From → To | Effect |
|---|---|---|
| **Start** | idle → running | Begin journey. Emit `journey.run_started`. |
| **Pause** | running → paused | Hold step. No telemetry. User-initiated freeze. |
| **Resume** | paused → running | Continue. |
| **Step Forward** | running → running (idx+1) | Advance to next step. Emit `journey.step_reached`. |
| **Step Back** | running → running (idx-1) | Re-enter previous step. Idempotent. |
| **Retry** | stuck → running | Re-enter current step. Emit `journey.retry_attempted`. |
| **Abandon** | stuck → idle | User gives up. Emit `journey.run_failed` with `error_code: abandoned_by_user`. |
| **Reset** | failed → idle | Fresh start after terminal failure. |
| **Complete** | running → completed | Final step reached. Emit `journey.completed`. |
| **Fail** | running → failed | System-detected failure. Emit `journey.run_failed` with error. |

### Stuck detector (the key trigger)

`stuck` state is **server-emitted**, not user-emitted. A scheduled function watches `engine_state.current_step` + `engine_state_step.completed_at`. If a step has been current for longer than its `stuck_timeout` → emit `journey.stuck`. Fjernkontroll subscribes via realtime → transitions to `stuck`.

This is the **stale trigger** you described. Same mechanism powers:

- **Inference trigger.** User sits on dashboard X minutes without progress on Journey A → agent offers Journey A.
- **Waiting trigger.** Mission B requires Journey C to complete → poll `engine_state` for completion → fire next mission step.
- **Stale trigger.** Journey started 7 days ago, never completed → email/notify + offer abandon.

All three are the same primitive: `engine_trigger` table, `trigger_subtype` discriminator, dispatcher branches per subtype. One mechanism, three uses.

### Reducer purity

The state machine has zero side effects. No emit, no DB write, no network call. Outer wrapper subscribes to `engine_event` realtime and drives the machine from server-observed events. This makes the reducer trivially testable in node — no Supabase/realtime mocks needed.

---

## 7. Telemetry Contract

Every journey emits a fixed event family. Registry is enforced at CI.

| Event | Fired by | Payload |
|---|---|---|
| `journey.run_started` | Capability on entry | `journey_version_id, run_id, capability, surface, actor_id` |
| `journey.step_reached` | Capability per step | `run_id, step_order, step_key` |
| `journey.completed` | Capability on success | `run_id, duration_ms` |
| `journey.run_failed` | Capability on failure | `run_id, error_code, error_msg` |
| `journey.stuck` | Stuck detector (cron) | `run_id, current_step, dwell_ms` |
| `journey.retry_attempted` | Fjernkontroll on retry | `run_id, step_order` |
| `journey.status_changed` | Lifecycle transitions | `journey_id, from_status, to_status, actor_id` |

Phantom-emit guard: any commit that introduces an event name not in the registry → merge blocked.

Authority guard: every capability has a seeded `engine_authority_config` row. No runtime inserts. Default-allow combinations are CVE-class.

`actor_id` resolution differs per capability:
- Web/dev: Supabase JWT → `profile_id`.
- Mobile/runtime: `getProfileContext()` from BFF, Zod-validated, empty-string fallback forbidden.
- Inference: server-resolved from `engine_state.actor_id`.

---

## 8. Coding Agent Harness — Where Journey Engine Plugs In

The harness is the agent's lifecycle wrapper around feature work. Journey Engine inserts gates at five points.

### Step 0 — `start-feature`

Agent is asked: *"Which journeys does this feature realize?"* Required input. 1–5 journeys per feature. Stub files are created in `docs/journeys/JOURNEY-<slug>.md` with `status: draft`.

**No journey declaration → no feature start.**

### Step 1 — Journey wizard (definition phase)

Agent runs the journey wizard against the stub: actor, trigger, preconditions, steps, outcomes. Status moves `idea → wizard → defined`.

This is the **kravspec phase**. Code does not exist yet. Spec is finalized first.

### Step 2 — Build phase

Code is written. Status: `building`. Agent is bound to the spec — implementation must satisfy each step. Deviations require spec amendment, not code-side workaround.

### Step 3 — Test generation

Compile pipeline runs: spec → `.spec.ts` Playwright file. Agent does NOT hand-write E2E tests. Test is generated from spec. If test doesn't pass → either spec is wrong (amend spec) or code is wrong (fix code) — never patch the test.

The test tests the testee. The journey tests the test. **One source.**

### Step 4 — `close-feature` (Journey Guardian gate)

Closure script runs five gates. Merge blocked unless all pass:

1. **Decision log** — every ADR registered.
2. **Journey Guardian** — every journey for this feature has `status: verified` in frontmatter. Zero unverified.
3. **Frontmatter** — all `docs/` markdown valid.
4. **Typecheck** — zero errors.
5. **Journey-engine gates (when diff touches journey surfaces):**
   - Emit-registry parity (no phantom events)
   - Authority seed parity (no capability without seeded authority)
   - No legacy import paths
   - No enum shortcuts
   - Capability count frozen
   - No runtime writes to dev-only tables

### Step 5 — Post-merge

Status: `implemented → active`. Journey is live. Telemetry flows. Stuck detector watches.

---

## 9. Implementation Order — How To Build This in Any Project

For a new project / new harness, build in this order. Each step unlocks the next.

### Phase 0 — Foundations (cannot skip)

1. **Telemetry registry.** One file, list of event names + payload schemas. CI gate that compares emit call-sites against registry.
2. **Authority config table.** One row per capability. Seed via migration, never insert at runtime.
3. **Journey markdown schema.** Zod schema for frontmatter + body. Validator script.
4. **Journey lifecycle enum + table.** 13 statuses. State transitions enforced server-side.

### Phase 1 — Compile pipeline

5. **Journey IR package.** Pure-function compile from markdown → intermediate representation. Reusable across all output emitters. NO I/O in this package.
6. **E2E emitter.** IR → Playwright `.spec.ts`.
7. **Doc emitter.** IR → onboarding markdown.

### Phase 2 — Capabilities

8. **`journey.run_dev` capability.** Runs the generated `.spec.ts` headed via CDP. Emits the event family.
9. **Closure gate.** Block feature merge without verified journey. Run all six journey-engine gates.

### Phase 3 — Runtime

10. **`journey.run_guided` capability.** Mobile thin-client surface. Same event family. BFF-proxied (never direct).
11. **Fjernkontroll component.** Six-state reducer. Subscribes to `engine_event` realtime.
12. **Stuck detector.** Scheduled function reading `engine_state`. Emits `journey.stuck`.

### Phase 4 — Inference + Missions

13. **Mission emitter.** IR → `engine_missions` row. Agent picks up mission, drives user through journey.
14. **Inference trigger.** Agent observes `engine_state`, matches against journey patterns, offers journey.
15. **Roadmap surface.** Per-user view: which journeys completed, which pending, which stale.

### Phase 5 — Observability

16. **Completion tracker.** `engine_state.current_step` + `engine_state_step.completed_at` → completion-rate dashboard per journey, per actor, per workspace.
17. **Stale-trigger.** Journey started > N days ago, never completed → notification + agent offer to abandon.

---

## 10. The Five Outputs (define-once, generate-many)

| Output | When generated | Audience | Format |
|---|---|---|---|
| **User Journey** | At spec-write | Product team | Structured markdown — the spec itself |
| **E2E Test** | At compile | Engineers | Playwright `.spec.ts` |
| **Onboarding Doc** | At publish | End users | Norwegian markdown → public website |
| **Linear Issue** | At spec-write | Dev team | Acceptance criteria from spec |
| **Agent Script** | At publish | AI assistant | Mission package — voice/chat walkthrough |

Each is a *view* of the spec. None is editable independently. Editing the agent script means editing the spec and re-publishing.

---

## 11. The Hard Contract — Discipline Beats Tooling

All of the above is necessary. None of it is sufficient. Failure happens on day 90, not day 1, when someone needs a quick fix before a demo.

**Failure looks like:**
- Developer adds a `data-testid` to code without updating journey markdown. CI passes because test snapshot was "temporarily" updated.
- Admin edits a mission prompt directly in DB because "it's faster". Docs and runtime diverge.
- Bug-fix hardcodes a workaround for Journey J-007. Spec no longer matches runtime.
- New hire writes a journey directly in DB. Version history has a hole.
- Someone uses `--no-verify` because "the gate was wrong". Precedent set.

After 10 such shortcuts, the spec is no longer truth. It is a description of something that *was* true. The model collapses silently.

**Success looks like:**
- Every change starts in markdown. No exceptions.
- CI gates that block merge are fixed by updating spec, not bypassing gate.
- Runtime bug → amend spec → recompile → publish new version. Runtime never edits itself.
- When it's urgent, the path is the same — just a shorter PR. Never "we'll compile later".
- New people are taught one rule first: *spec first, always*.

**The rule of thumb:**
*"Should I update the spec first or fix the code first?"* — the answer is always **spec first.** Even when annoying. Even when it's late on a Friday. Even when only a single testid changes.

The day you take a shortcut once because "it's a special case" is the day the model starts to rot.

---

## 12. Reusing This in Other Projects

The mental model is portable. Strip Smartout-specific names and you have:

- A markdown spec format (frontmatter + step body).
- A 13-status state machine for the spec lifecycle.
- A pure-function compile pipeline (markdown → IR → N artefacts).
- A capability surface set (dev-runner, runtime-runner, inference, publish).
- A six-state remote control component.
- A stuck/inference/stale trigger primitive.
- A closure gate that blocks merge without a verified spec.
- A telemetry registry that blocks merge without a registered event.

Every coding agent harness needs:
1. A way to bind work to specs (start-feature gate).
2. A way to verify work satisfies specs (closure gate).
3. A way to keep tests honest (generated, not hand-written).
4. A way to keep telemetry honest (registry-enforced).
5. A way to keep authority honest (seeded, not defaulted).

Journey Engine is one implementation of those five needs, unified through one source: the markdown journey spec.

---

## 13. What This Replaces

| Old way | Journey Engine way |
|---|---|
| Acceptance criteria in Linear | Markdown journey is the criteria |
| Hand-written E2E tests | Compiled from spec |
| Onboarding docs written separately | Compiled from spec |
| Mission prompts edited in DB | Compiled from spec, published |
| Telemetry events added ad-hoc | Registered in registry, CI-enforced |
| Capability authority added at runtime | Seeded via migration, no runtime insert |
| "Did this feature ship?" measured by PR merged | Measured by completion rate per actor |
| Bug reports = "broken" | Bug reports = journey transitions to `broken`, retries via `ready_test` |

The whole loop — from idea to user-completion — runs through one schema.

---

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-04-28 | 1.0.0 | Initial mental model. Synthesizes registry + Guardian gates + Fjernkontroll state machine + capability model + telemetry contract into one portable description. |
