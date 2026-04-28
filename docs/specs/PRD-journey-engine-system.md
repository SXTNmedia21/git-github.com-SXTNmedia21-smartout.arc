---
title: "Journey Engine — Product Requirements Document (system-level, project-independent)"
status: draft
version: 0.1.0
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [prd, system, journey-engine, intermediate-representation, runtime, telemetry]
---

# Journey Engine — Product Requirements Document

> **Scope of this document.** This PRD specifies the Journey Engine as a stand-alone system. No project-specific infrastructure, schema names, or product decisions are assumed. Where a real implementation is referenced, it is shown as `<example>` or `[implementation-defined]`.
>
> **Reading order.** §1 explains what the engine is. §2 walks one concrete user journey from intent to completion. §3 enumerates all artefacts the engine produces from a single authored input. §4–§13 specify each subsystem. §14 lists testability rules — every system claim in §4–§13 must be falsifiable by a test built from the §2 journey. §15 lists known variants. §16 captures open questions.

---

## 1. Executive summary

A **Journey Engine** is a system that takes a single declarative description of a user flow — the **JourneyIR (Intermediate Representation)** — and from that one source produces every artefact required to dev-test, document, execute, observe, and assist that flow.

The promise is exactly:

> **One authored journey → N artefacts → three surfaces.**
>
> - One IR (authored once, versioned, immutable per version).
> - Five default artefacts: dev-test script, mission, user guide, inference pattern, runtime state card.
> - Three surfaces: dev (test against a build), publish (docs + missions), runtime (live agent-guided execution).

The Journey Engine prevents drift. There is no parallel "tests vs docs vs runtime" reality. Every surface reads the same IR. When the IR changes, every artefact regenerates.

The Journey Engine is **not** a workflow engine, a state-machine library, or an analytics tool. It composes these lower-level primitives but keeps the journey description as the single load-bearing input.

---

## 2. Reference user journey (the one the system is tested against)

This journey is the canonical test case for the entire engine. Every claim in §4–§13 must be verifiable by running this journey through the engine end-to-end.

**Journey name:** `newsletter-signup-and-welcome`
**Persona:** Anonymous visitor on a public marketing site.
**Goal:** Visitor lands on the site, signs up to the newsletter, receives a confirmation email, returns, runs a search, and is welcomed by name.

### Step-by-step user actions and expected system behaviour

| # | User does | System does | Visible artefact / event |
|---|---|---|---|
| 1 | Navigates to `https://example.com/landing` | Server renders landing page; client emits `journey.run_started` with `journey_id=newsletter-signup-and-welcome`, surface=`runtime` | `journey.run_started` telemetry event |
| 2 | Scrolls past hero (≥ 50% page height) | Pattern matcher records `step.scroll_depth_50` reached | `journey.step_reached` event |
| 3 | Sees newsletter form anchor enter viewport | Component overlay highlights `#newsletter-form` with subtle Lucide icon glow; AI guide tooltip "Sign up to never miss an update" | overlay highlight + AI guide hint |
| 4 | Types email `pat@example.com` into `input[name="email"]` | Form-state captured; client-side validation; `journey.step_reached` for `step.form.email_filled` | telemetry event |
| 5 | Types name `Pat Doe` into `input[name="name"]` | `journey.step_reached` for `step.form.name_filled` | telemetry event |
| 6 | Clicks `<button>Get newsletter</button>` | Browser submits POST `/api/subscribe`; engine binds the click to `step.form.submitted` | telemetry event |
| 7 | (waiting) | API receives payload; `subscriber` row created; queues confirmation email via the configured email provider; returns 200 with success body | `journey.step_reached` for `step.api.subscribe_ok` |
| 8 | Sees success popup | Engine renders configured `success_dialog` component (template-driven); pattern matcher records `step.ui.popup_shown` | `journey.step_reached` event |
| 9 | (background) | Email service produces a confirmation email containing a magic link; `journey.step_reached` for `step.email.confirmation_sent` | telemetry event |
| 10 | Closes popup | Component overlay highlights `#search-bar` as the next suggested action; AI guide says "Try a search to find content tailored to you" | overlay highlight + AI guide hint |
| 11 | Clicks search bar, types a query | Search subsystem receives the query; engine records `step.search.activated` | telemetry event |
| 12 | Hits Enter | Results page renders; engine records `step.search.completed` | telemetry event |
| 13 | (later, e.g. next day) Clicks confirmation magic link from email | Server identifies subscriber; sets returning-visitor cookie; redirects to `https://example.com/welcome?token=...` | server-side redirect |
| 14 | Lands on `/welcome` | Engine recognises returning subscriber via inference pattern (`subscriber_returning`); emits `journey.completed` for the original run; mission status flipped to `completed` | `journey.completed` event |
| 15 | Sees personalised welcome banner "Welcome back, Pat" | Component overlay renders; AI guide offers a follow-on suggestion ("Subscribe to topic X?") | overlay banner + AI guide |

### Edge cases this journey must verify

- **Form-validation failure:** invalid email at step 4 → engine records `step.form.validation_failed` → no `journey.completed` until valid.
- **API failure:** 500 on POST `/api/subscribe` → `journey.run_failed` with `error_code=api_error`; AI guide surfaces remediation.
- **Email provider outage:** confirmation email never sends → engine emits `journey.stuck` after configured timeout (e.g. 24 h) → operator-defined recovery path.
- **User abandons mid-flow:** no further events for ≥ N minutes → `journey.stuck` event; no `journey.completed`; mission can be reopened on next visit by inference pattern matching.
- **Multiple devices:** user fills form on phone, opens magic link on laptop → engine joins runs by stable subscriber identifier (email or persistent cookie).

### What the engine MUST produce from this one authored journey

1. A dev-test script (e.g. Playwright, Cypress, Selenium — implementation-defined) that drives steps 1–12 against a real build.
2. A user-facing guide page rendered at `https://docs.example.com/journeys/newsletter-signup-and-welcome` describing the same flow in human prose.
3. A runtime mission readable by the engine's runtime layer (§7) so step 14 can advance the same `run_id` even though the user is on a different device days later.
4. An inference pattern that, given a stream of telemetry events, classifies which run a given event belongs to and what step it represents.
5. A runtime UI card (the "Fjernkontroll" / remote control) showing the user's current step, with the 6 lifecycle states (idle / running / paused / stuck / completed / failed) visible to admin observers.

All five must round-trip from the same IR. Editing the IR and regenerating must update all five with zero drift.

---

## 3. The five generated artefacts

| # | Artefact | Audience | Generated when | Storage | Mutability |
|---|---|---|---|---|---|
| 1 | **Dev-test script** | Engineers, CI | On every IR commit | Code repo (e.g. `tests/journeys/<id>.spec.ts`) | Regenerated on every IR change |
| 2 | **User guide** | End users, support | On IR `published` transition | Docs storage (e.g. CDN, DB-backed MDX) | Snapshot per IR version |
| 3 | **Mission** | Runtime engine | On IR `published` transition | Mission store (DB row or document) | Snapshot per IR version; activatable |
| 4 | **Inference pattern** | Telemetry pipeline | On IR `validated` transition | Pattern registry | Snapshot per IR version |
| 5 | **Runtime state card** | Admin/operator UI | On IR `validated`; consumed by runtime | Component bundle | Schema-driven, visual layer fixed |

### Why exactly five — not four, not six

Four would force one of {test, docs, runtime, observability, UI} to be coupled to another. Six would split a load that one artefact comfortably carries. The five are chosen because each maps to a distinct **consumer surface**:

- Dev-test script → CI
- User guide → docs reader
- Mission → runtime executor
- Inference pattern → telemetry subscriber
- State card → admin observer

Removing any one produces a gap; adding a sixth duplicates an existing consumer.

A specific implementation MAY add proprietary artefacts (e.g. a sales playbook, a support macro). The PRD does not forbid this; it requires that the five default artefacts always remain regenerable from the same IR.

---

## 4. JourneyIR — the single source of truth

The JourneyIR is a versioned, declarative description of a journey. It is **not** code. It is **not** a runtime object. It is a structured document that downstream generators read.

### 4.1 Required fields

```yaml
version: "2.0.0"            # semver, IR-shape version (not journey version)
id: "newsletter-signup-and-welcome"
title: "Newsletter signup + welcome"
description: "Anonymous visitor signs up, gets a confirmation email, returns, runs a search."
mode: "sequential" | "free" | "hybrid"
actor: "anonymous_visitor" | "<role>"
platform: "web" | "mobile" | "any"
auth_profile: "anonymous" | "authenticated" | "<custom>"
preconditions:
  - "Email provider configured"
  - "Search index ≥ 100 documents"
entry_url: "https://example.com/landing"
success_gate:
  description: "User has clicked confirmation link AND completed at least one search"
  predicate: "events.contains('step.email.confirmation_clicked') AND events.contains('step.search.completed')"
steps:
  - key: "step.scroll.50"
    title: "Scroll past hero"
    description: "User scrolls to ≥ 50% of landing page height"
    action: "scroll"
    selector: "[data-journey='hero-bottom']"
    assertion: "viewport.intersects(selector)"
    timeout_ms: 60000
    order: 1
  - key: "step.form.email_filled"
    title: "Type email"
    description: "Visitor types a valid email into the newsletter input"
    action: "type"
    selector: "input[name='email']"
    value_pattern: "^[^@]+@[^@]+\\.[^@]+$"
    assertion: "input.value.matches(value_pattern)"
    timeout_ms: 120000
    order: 2
  # … remaining steps
gate:
  on_failure: "emit_run_failed"
  on_stuck: "emit_run_stuck"
  on_complete: "emit_run_completed"
```

### 4.2 Optional fields

- `tags: ["onboarding", "newsletter"]` — used by pattern matcher and AI guide for retrieval.
- `system_prompt: "..."` — natural-language coaching text consumed by AI guide layer.
- `actions: [...]` per-step micro-actions for fine-grained instrumentation.
- `screenshots: { step_key: <reference> }` — for docs generation.
- `i18n: { en: {...}, no: {...} }` — translation overlays for human-facing artefacts.

### 4.3 Versioning

Every IR has two versions:

- `version` — the **schema** version (e.g. `2.0.0`). When the engine evolves the IR shape, the schema version bumps. Previous IRs are still readable until officially deprecated.
- A separate **journey version** (e.g. `v3` for `newsletter-signup-and-welcome`) — the content version of the journey itself. Each journey version is immutable. A new "version" of the journey produces a new IR document; both old and new can coexist (e.g. for A/B testing).

### 4.4 Validation

Validation happens in three layers:

1. **Syntactic** — IR conforms to schema (Zod / JSON Schema / equivalent).
2. **Semantic** — every step references an action the engine knows; selectors are non-empty; success gate references real events.
3. **Generator pre-flight** — each generator can refuse an IR ("dev-test cannot run because step 7 has no `assertion`"). A failing generator blocks the IR from leaving `validated` state.

An IR that fails any layer cannot be `published`.

---

## 5. Lifecycle states

The IR moves through a fixed state machine. Transitions are auditable.

```
draft → validated → published → active → (running ↔ stuck) → completed | failed → retired
```

| State | Meaning | Who transitions |
|---|---|---|
| `draft` | Author is still writing | Author |
| `validated` | Schema + semantic + generator pre-flight all passed | Engine (auto on save) |
| `published` | Generators have produced all five artefacts; mission is in store with `is_active = false` | Author (manual publish action) |
| `active` | `is_active = true` — runtime layer will surface this journey | Author (manual activate); requires post-publish review per implementation policy |
| `running` | A specific run of the journey is in progress (per `run_id`) | Runtime engine |
| `paused` | A specific run is paused (e.g. user closed tab; resumable on cookie) | Runtime engine |
| `stuck` | No progress for ≥ configured timeout | Stuck-detector |
| `completed` | Success gate evaluated true | Runtime engine |
| `failed` | Terminal error or `run_failed` event | Runtime engine |
| `retired` | Replaced by a newer journey version; no new runs accepted | Author |

### Critical invariant — runs vs IR

The IR has lifecycle states. **Runs of a journey** also have lifecycle states (the last six in the table). A single IR in `active` state may have thousands of concurrent `running` runs. A run's terminal state is independent of the IR's state. Closing an IR (transitioning to `retired`) does NOT terminate live runs — they continue against their snapshotted IR version.

### Phantom-write and phantom-consumer rules (architectural law)

These two invariants are non-negotiable:

- **No artefact may be claimed produced unless it was actually written.** A capability that emits "publish_succeeded" without writing the mission is a defect, not a placeholder. The engine MUST refuse such cases at generator level.
- **No producer may write a row to a table that has no consumer reading it.** If the runtime emits `engine_state` writes that no service reads, the run is a write-only ritual: telemetry says "running", reality says "nothing is happening". Producer-keeps-promise AND consumer-exists must both hold.

Concrete enforcement: a generator that fails to write its artefact MUST NOT emit a "started" event. A producer that writes a row MUST name (in the IR or in the mission) the consumer that will read it. Reviewers must verify both directions before approving an IR for publish.

---

## 6. Authoring surface

### 6.1 Editor

- Form-driven OR raw-IR editor (toggleable).
- Live validation on every keystroke (or debounced ≤ 500 ms).
- "Publish" button is disabled until IR is `validated`.
- Diff view between previous published IR and current draft.

### 6.2 Storage

- IRs persist in a versioned store (file system, DB, or document store — implementation-defined).
- Every IR-touch is auditable (author, timestamp, prior version hash).
- Versions are immutable. Editing a published IR creates a new draft from a copy.

### 6.3 Publish action

- Re-runs all generators.
- Writes mission with `is_active = false`.
- Generates user-guide page snapshot.
- Persists inference pattern.
- Triggers a regeneration of the dev-test script (queued for CI).
- Emits `journey.published` audit event.

### 6.4 Activate action

- Flips mission to `is_active = true`.
- A pre-condition: every step must have author-reviewed coaching text (anti-phantom — guards against publishing a stub mission with auto-derived placeholder copy).
- Emits `journey.activated` audit event.

---

## 7. Runtime — the state machine

The runtime is what executes a journey for a real user. There is **one runtime model**, regardless of surface (dev / publish-test / live).

### 7.1 The 6-state runtime machine (per run)

```
        ┌──────────┐
        │  idle    │
        └────┬─────┘
             ▼
        ┌──────────┐                ┌──────────┐
   ┌────│ running  │◄──────RETRY────│  stuck   │
   │    └─┬───┬────┘                └────┬─────┘
   │      │   │                          │
   │ STEP_DONE│ TIMEOUT                  │ ABANDON
   │      ▼   ▼                          ▼
   │  ┌────────────┐                ┌──────────┐
   │  │ completed  │                │  idle    │
   │  └────────────┘                └──────────┘
   │
   │ FAIL
   ▼
┌──────────┐                  ┌──────────┐
│  failed  │────RESET────────►│  idle    │
└──────────┘                  └──────────┘

(also: running ↔ paused on tab close / focus return)
```

| State | Entry condition | Exit edges |
|---|---|---|
| `idle` | New run created OR explicit reset | → `running` (start), → terminal |
| `running` | Step in flight | → `paused` (focus loss), → `stuck` (timeout), → `completed` (success gate), → `failed` (error) |
| `paused` | Tab not focused / app backgrounded | → `running` (focus return), → `stuck` (timeout) |
| `stuck` | Timeout fires; no progress | → `running` (RETRY), → `idle` (ABANDON) |
| `completed` | Success gate true | terminal |
| `failed` | Hard error or explicit `fail` | → `idle` (RESET) |

Every transition emits a telemetry event (§9).

### 7.2 Per-run identity

A run has a stable `run_id`. The engine joins events to a run by:

1. `run_id` if present in the event payload.
2. Otherwise: a stable cross-event identifier (e.g. `subscriber_id`, persistent cookie, authenticated user id).
3. Fallback: a session token and IR id.

Multi-device runs are joined by user identity OR by an auth-handshake event (clicking a magic link from email containing the original `run_id`).

### 7.3 Step advancement

A step advances when its `assertion` evaluates true. Assertions are pure functions over recent telemetry events plus DOM state plus server state. They MUST be deterministic.

### 7.4 Success gate

The IR's `success_gate.predicate` is evaluated whenever any new event lands in the run's event window. When the gate becomes true, the run transitions to `completed` and `journey.completed` is emitted.

---

## 8. Generators

A generator is a pure function `IR → artefact`. It MUST be deterministic and side-effect-free.

### 8.1 Dev-test script generator

Output: a runnable test script in the engine's test framework of choice (Playwright, Cypress, Selenium, etc.). One step in the IR maps to roughly one assertion block. Selectors come from `step.selector`. Success gate maps to a final assertion.

The generated test does NOT call the engine's runtime — it drives the browser/app directly. This keeps tests fast (no engine roundtrip) and decouples test from runtime.

### 8.2 User-guide generator

Output: a Markdown / MDX file containing the journey title, description, and a numbered list of human-readable step descriptions. Optional screenshots inline. The generator MUST NOT include selector, assertion, or telemetry-event details. Those are engineer concerns; users see only the user-visible action.

### 8.3 Mission generator

Output: a runtime mission record. The mission is what the runtime layer reads to surface the journey. Includes:

- `mission_id`
- A reference to IR version
- Per-stage agent coaching content (`goal`, `instructions`, `success_criteria`)
- An activation flag (`is_active = false` until reviewed)

The mission is **derived** from the IR but admins are expected to enrich the auto-derived starter content before activation. The engine MUST refuse to activate a mission whose stages still match the IR auto-derivation byte-for-byte (anti-laziness gate).

### 8.4 Inference-pattern generator

Output: a pattern document that the telemetry pipeline consumes. The pattern declares: given a stream of events with these properties, infer that they belong to this journey, this run, this step. Used by:

- Pattern matcher to attribute observed events to the right run.
- Anomaly detection ("expected step 7 in this run but saw step 12; gap?").

### 8.5 Runtime-state-card generator

Output: a UI component descriptor (or pre-rendered card) for the runtime observer surface ("Fjernkontroll"). The descriptor names the 6 states + the per-step labels + the i18n strings + the recovery actions available in `stuck`/`failed`.

The visual implementation is fixed by the engine; the descriptor populates it.

---

## 9. Telemetry contract

The engine defines a fixed set of events. Each event has a strict payload schema. No producer in the system MAY emit a journey-related event that is not in the registry.

### 9.1 Required events

| Event | When | Required payload |
|---|---|---|
| `journey.run_started` | A run begins | `run_id`, `journey_id`, `journey_version`, `actor_id`, `surface`, `timestamp` |
| `journey.step_reached` | A step's assertion turns true | `run_id`, `step_key`, `step_index`, `actor_id`, `timestamp` |
| `journey.completed` | Success gate true | `run_id`, `final_step`, `duration_ms`, `actor_id`, `timestamp` |
| `journey.stuck` | Timeout without progress | `run_id`, `step_key`, `timeout_ms`, `actor_id`, `timestamp` |
| `journey.run_failed` | Terminal error or `fail` action | `run_id`, `step_key`, `error_code`, `error_message`, `actor_id`, `timestamp` |

### 9.2 Required destinations

Every event MUST land in at least:

1. **An analytics sink** (e.g. PostHog, Mixpanel) — for cohort + funnel analysis.
2. **A logger** — for debugging.
3. **An audit trail** — for compliance / reconstruction.
4. **A runtime event store** — readable by the inference pattern matcher.

Implementations MAY add destinations (e.g. real-time dashboard, billing). The four are minimum.

### 9.3 The registry rule

The engine MUST refuse to compile/start if any code path emits an event whose name is not in the registry. This is enforced by a CI grep gate:

- Every `emit("journey.*", ...)` call site is grep'd.
- Every event name is checked against `registry.ts` (or equivalent).
- A miss fails the build.

This rule prevents "phantom-emit-contracts" — events that look real but are never received.

---

## 10. Pattern matcher

The pattern matcher is a continuously-running consumer of the event stream. Its job:

1. Read every event.
2. Determine which IR + which run + which step the event belongs to.
3. Update the run's runtime state accordingly.
4. Trigger downstream effects (e.g. emit `journey.completed` when the success gate becomes true).

### 10.1 Inputs

- Event stream (from §9).
- All published inference patterns (one per active IR).
- Run state store (read + write).

### 10.2 Outputs

- Updated run state (new step, new lifecycle state).
- Derived events (e.g. `journey.completed` from a sequence of `step_reached` events).

### 10.3 Determinism

Pattern matching MUST be deterministic. Given the same input event stream and the same patterns, the outcome is identical.

### 10.4 Catch-up

The pattern matcher MUST be able to replay a window of past events. This supports:

- Late-arriving events (mobile app reconnects after offline).
- New patterns deployed that need to backfill against historical traffic.
- Debugging a specific run.

---

## 11. AI guide layer

An optional layer that surfaces natural-language coaching to the user during a run.

### 11.1 Inputs

- Current run state (which step).
- IR's `system_prompt` (overall journey tone).
- Step's `description` and per-step `instructions` (if any).
- Recent user actions / events.

### 11.2 Outputs

- A short coaching message rendered in the UI (tooltip, sidebar, voice).
- Optional follow-on suggestion (e.g. "Try a search").

### 11.3 Constraints

- The AI guide MUST NOT be load-bearing. The journey must complete even if the AI guide is disabled.
- The AI guide MUST NOT have authority to mutate journey state. It speaks; the engine acts.
- The AI guide MUST receive a fresh context on every step (no cross-run leakage).

### 11.4 Voice channel

Implementations MAY add a voice channel. If they do, the channel MUST refuse to handle PII (e.g. credit card, social-security-equivalent identifiers). Sensitive input is chat-only.

---

## 12. Component overlay layer

A real-time DOM-attached layer that highlights the next-suggested element.

### 12.1 Inputs

- Current step's `selector`.
- The user's viewport state.

### 12.2 Outputs

- A visual highlight (border, glow, arrow) on the target element.
- Optional inline AI guide text near the highlight.

### 12.3 Constraints

- The overlay MUST respect `prefers-reduced-motion`.
- Highlight transitions MUST use deterministic motion physics (e.g. spring `stiffness=35, damping=22, mass=2.2`) to avoid feeling like ambient noise.
- ARIA live regions MUST announce overlay changes for screen readers.
- Touch targets MUST be ≥ 44 pt on mobile.

---

## 13. Bridges to broader systems

The engine exposes two outbound bridges. Both are optional but, when used, must follow strict contracts.

### 13.1 Stage-engine bridge

The engine's runtime can hand off to a broader **Stage Engine** (an agent-orchestration layer). The bridge passes:

- `run_id`
- `mission_id`
- Current step
- Mission's `system_prompt`
- Per-stage instructions

The Stage Engine then takes over the conversational/cognitive layer while the Journey Engine continues to track step progress. Both systems share `run_id` as the join key.

### 13.2 Event bridge

The engine MAY forward events to external systems:

- CRM (for sales attribution).
- Email service (to trigger transactional sends).
- Analytics warehouse (for offline modeling).

The bridge is **read-only** — external systems never write back to engine state without going through the runtime API (which preserves authority and state-machine invariants).

---

## 14. Testability rules

Every claim in §4–§13 must be falsifiable by a test built from §2's reference journey. The test suite has four layers, each with a non-negotiable rule:

| Layer | What it tests | Rule |
|---|---|---|
| **L1 — Per-file semantic** | Logic, naming, conventions | Reviewed manually or by static analysis. No runtime tests at this layer. |
| **L2 — Column / payload trace** | Source field → store → retrieved field | For every payload, follow it from source to target. Verify types, NOT NULLs, enum validity. |
| **L3 — Trigger / constraint semantics** | DB constraints, RLS, FKs, triggers | For every new constraint, write a test that submits invalid input and asserts the constraint fires. |
| **L4 — Capability-consumer trace** | Producer-keeps-promise AND consumer-exists | For every producer (capability emitting events / writing rows), name the consumer that reads. If no consumer, the producer is half-built. |

### 14.1 The "test the artefact, not the return shape" rule

A test that asserts `result.ok === true` proves nothing. The test MUST assert the **artefact** — the row in the store, the file on disk, the event in the registry. The return shape is a hint; the artefact is the truth.

Concrete: a test for §2 step 7 (POST `/api/subscribe`) MUST `SELECT FROM subscriber WHERE email = 'pat@example.com'` AND assert one row. Asserting only `response.status === 200` is incomplete.

### 14.2 Falsifiable status claims

Every "complete" / "green" / "shipped" claim made about a journey MUST cite a specific grep, SQL query, or test that returns deterministic pass/fail. Claims without falsifiable evidence are rejected at review.

### 14.3 Anti-phantom invariants

Three rules, every reviewer must check:

1. **No phantom emit.** A capability that emits `started` MUST produce its declared artefact in the same execution. Or it MUST return `{ok: false, error: "not_implemented"}` WITHOUT emitting `started`.
2. **No phantom consumer.** A capability that writes a row MUST name the consumer that reads it. If no consumer, the row is write-only ritual.
3. **Gate every mutation.** Every state-changing operation MUST pass through the engine's authority layer (an explicit gate function call), regardless of the caller's privilege level. "Autonomous" is not a license to skip the gate.

---

## 15. Variants

The Journey Engine accommodates several common variants. Each is a configurable surface, not a fork.

### 15.1 Mode variants

- **`sequential`** — steps must complete in declared order. Default.
- **`free`** — steps may complete in any order; success gate decides completion.
- **`hybrid`** — some steps strict-ordered (declared via `order`), others free.

### 15.2 Surface variants

- **Dev surface** — runs the test script against a build; no live mission.
- **Publish surface** — generates docs + missions; no live execution.
- **Runtime surface** — live agent-guided runs.

Authority for each surface is independently configured. A user with publish authority does not automatically have runtime-debugger authority.

### 15.3 Persona variants

- **Anonymous** — no auth context; runs joined by cookie / session.
- **Authenticated** — runs joined by user id.
- **Multi-actor** — runs span multiple actors (e.g. employer + employee). Implementations declare actor handoff points in the IR.

### 15.4 Channel variants

- **Web only** — desktop / mobile browser.
- **Mobile native** — wrapped in a native shell; runtime card port faithfully (no UI re-design).
- **Voice** — limited to non-PII steps. Always paired with a chat channel.
- **Hybrid** — same run handles web + mobile + voice; events join by `run_id`.

### 15.5 Storage variants

- **DB-backed mission store** — relational; supports SQL queries, FKs, RLS uniformly.
- **Document-backed** — NoSQL / object storage; cheaper for large MDX content.

The engine MUST allow storage backend to be configured per artefact type. Default for missions is DB; default for guides is document store unless content is small (< 32 KB MDX), in which case DB is also fine.

---

## 16. Known gotchas + open questions

This section is the engine's "things we caught the hard way" file. Every gotcha is a falsifiable test today.

### 16.1 Gotchas

- **Status-vocab drift.** Capability tools wrote runtime status values (`queued`, `running`) that the database CHECK constraint rejected (`pending`, `active`). The engine MUST publish its allowed status vocabulary AND every producer MUST consume from the same source. A grep gate catches new violations.
- **Phantom emit.** A capability returning `ok:true` but never writing the artefact passes superficial review. L4 testability rule (assert artefact, not return shape) catches it.
- **Phantom consumer.** A capability that writes a row no service reads passes producer-side tests but is operationally dead. L4 reverse direction catches it.
- **Authority loader collapse.** Authority levels keyed by base-name (`journey`) instead of full-name (`journey.run_dev`) returned non-deterministic results when the underlying SELECT had no ORDER BY. The engine MUST preserve full keys end-to-end and test determinism across shuffled row order.
- **Mission resolution gap.** A capability that publishes missions but no runtime layer that reads them. Reviewers MUST verify both the writer and the reader exist before declaring a journey complete.
- **Closure-doc Invariant violation.** Every "campaign closed" claim must cite falsifiable checks. Prior closures violated this in their own closure docs. CI grep gate at close-time prevents.

### 16.2 Open questions

- **State table choice.** Some implementations have two run-state tables (one for stage-engine sessions, one for runtime engine_state). Until ontology is unified, the IR MUST declare which table its runs write to, and the runtime MUST refuse to publish if no consumer reads that table.
- **Stuck detection strategy.** Pull (cron-based polling) vs push (capability schedules a delayed trigger) vs hybrid. The PRD does not pick. Implementation chooses based on latency / cost trade-off; whichever is chosen must close the loop (the producer schedules, the consumer fires, the event lands).
- **MDX escaping.** Guide content interpolated into MDX is exploitable if `is_public = true` exposes it to unauthenticated readers and the IR contains attacker-controlled text. Implementations MUST sanitize before public exposure.
- **Multi-tenant isolation.** When the engine is multi-tenant, every IR + run + artefact MUST be tenant-scoped at the storage layer. Tenant isolation is a non-negotiable RLS / access-control rule, never an application-layer filter.

---

## 17. Roadmap shape (informational)

Implementations typically ship the engine in five phases. This is a suggested shape, not a prescription.

| Phase | Goal | Exit gate |
|---|---|---|
| **Foundations** | Telemetry registry, IR schema, authority gate, capability skeletons | Every emit registered, every capability gated, IR validates |
| **Spec + IR canonical** | IR package + types + validators canonical; generators stub | One IR validates and a stub artefact is produced |
| **Bodies** | Real generators for all five artefacts; runtime can execute one journey end-to-end | §2 reference journey runs end-to-end |
| **Authoring + UI** | Author surface + admin observer card + activate flow | A non-engineer can author a journey and activate it |
| **Mobile + ops** | Mobile native runtime; alerting + monitoring; rollback paths | Reference journey runs on mobile; ops can disable a live journey via authority flip |

Each phase has a closure gate that asserts producer-keeps-promise AND consumer-exists for every artefact added in that phase. Skipping the gate produces phantom-ship; the L4 reverse-direction trace catches it later, but at higher cost.

---

## 18. Glossary

| Term | Meaning |
|---|---|
| **JourneyIR** | The single declarative description of a journey. Versioned, immutable per version, the source of all artefacts. |
| **Artefact** | An output produced by a generator from the IR. |
| **Run** | A single execution of a journey by a specific actor. Has its own lifecycle. |
| **Mission** | The runtime artefact derived from the IR; what the runtime executes. |
| **Stage** | A persisted unit within a mission; corresponds roughly to a step in the IR. |
| **Authority** | The access-control configuration that gates which capabilities a caller may invoke. |
| **Pattern matcher** | The subsystem that attributes observed events to the right run. |
| **Stage Engine** | An optional broader agent-orchestration layer that can take over the conversational/cognitive surface for a run. |
| **Bridge** | An outbound integration to an external system (CRM, email, etc.). |
| **Phantom-emit** | A capability that emits a "started" event without writing its declared artefact. |
| **Phantom-consumer** | A capability that writes an artefact no consumer reads. |
| **Falsifiable claim** | A status claim backed by a specific grep, SQL, or test that returns pass/fail. |

---

## 19. References (within this PRD)

- §2 reference user journey is the canonical test fixture for §4–§13.
- §3 five artefacts are the minimum set; implementations MAY add more.
- §5 lifecycle states are the only valid IR transitions.
- §7 runtime state machine is the only valid run transition graph.
- §9 telemetry events are the registry; no off-registry events allowed.
- §14 testability rules apply to every implementation claim.

---

*End of PRD. Implementations of this PRD MUST produce the §2 reference journey end-to-end before claiming the engine is shippable.*
