---
title: "Journey Engine — Product Requirements Document"
id: ENGINE_SYSTEM_PRD
version: "0.2.0"
status: draft
layer: architecture
created: 2026-04-27
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - prd
  - system
  - journey-engine
  - ir
  - runtime
  - telemetry
  - confidence
  - assist
---

# Journey Engine — PRD v0.2

> **Hva er nytt i v0.2:** Konfidens-skåring, assist-triggere, frontend/backend-ansvarsfordeling, multi-actor handoff, run-snapshot-policy, recurring-mode, attribution-modell, journey-creation-skill referanse, fullstendige kontrakter og templates.

> **Lese-rekkefølge:** §1 forklarer hva engine er. §2 er kanonisk test-journey. §3 er artefakter. §4 er IR. §5 er livssyklus (IR + run, separat). §6 er authoring. §7 er runtime-state-machine + konfidens + assist + attribusjon. §8 er generators. §9 er telemetri. §10 er pattern matcher. §11 er AI guide. §12 er component overlay + frontend/backend kontrakt. §13 er bridges. §14 er multi-actor. §15 er testability. §16 er variants. §17 er gotchas. §18 er roadmap. §19 er glossary. §20 er creation-flow.

---

## 1. Executive summary

A Journey Engine takes a single declarative description of a user flow — the **JourneyIR** — and produces every artefact required to dev-test, document, execute, observe, and assist that flow.

> **One authored journey → N artefacts → three surfaces.**
> 
> - One IR (authored once, versioned, immutable per version)
> - Five default artefacts: dev-test script, mission, user guide, inference pattern, runtime state card
> - Three surfaces: dev (test against build), publish (docs + missions), runtime (live agent-guided execution)

The engine prevents drift. There is no parallel "tests vs docs vs runtime" reality. Every surface reads the same IR. When the IR changes, every artefact regenerates.

The engine is **not** a workflow engine, a state-machine library, or an analytics tool. It composes these primitives, but the journey description is the single load-bearing input.

### Core invariants (non-negotiable)

1. **Spec-first.** No code without IR. No artefact-edit without IR-edit.
2. **Producer-keeps-promise.** A capability that emits "started" must produce its declared artefact in the same execution.
3. **Consumer-exists.** A capability that writes a row must name the consumer that reads it.
4. **Registry-enforced telemetry.** No event emitted that is not in the registry.
5. **Authority-gated mutation.** Every state-changing operation passes through the engine's authority layer.
6. **Falsifiable claims.** Every "done" claim cites a specific grep, SQL, or test that returns deterministic pass/fail.

---

## 2. Reference user journey

This journey is the canonical test case for the entire engine. Every claim in §4–§14 must be verifiable by running it end-to-end.

**Journey name:** `newsletter-signup-and-welcome` **Persona:** Anonymous visitor on a public marketing site. **Goal:** Visitor lands, signs up, gets confirmation email, returns, runs a search, is welcomed by name.

### Step-by-step

|#|User does|System does|Visible artefact / event|
|---|---|---|---|
|1|Navigates to `/landing`|Renders page; emits `journey.run_started`|telemetry event|
|2|Scrolls past hero|Pattern matcher records `step.scroll_depth_50`|`journey.step_reached`|
|3|Sees newsletter form|Component overlay highlights form; AI guide hint|overlay + hint|
|4|Types email|Form-state captured; `step.form.email_filled`|event|
|5|Types name|`step.form.name_filled`|event|
|6|Clicks submit|POST `/api/subscribe`; binds click to `step.form.submitted`|event|
|7|Waits|API returns 200; `step.api.subscribe_ok`|event|
|8|Sees success popup|Engine renders `success_dialog`; `step.ui.popup_shown`|event|
|9|Background|Email queued; `step.email.confirmation_sent`|event|
|10|Closes popup|Overlay highlights `#search-bar`; AI guide hint|overlay + hint|
|11|Clicks search, types query|Search activated; `step.search.activated`|event|
|12|Hits Enter|Results render; `step.search.completed`|event|
|13|(later) clicks magic link from email|Server sets cookie; redirects to `/welcome?token=...`|redirect|
|14|Lands on `/welcome`|Inference pattern matches `subscriber_returning`; `journey.completed`|event|
|15|Sees "Welcome back, Pat"|Personalised banner; AI guide offers follow-on|overlay + guide|

### Edge cases this journey verifies

- Form-validation failure at step 4 → `step.form.validation_failed`
- API failure at step 7 → `journey.run_failed` with `error_code=api_error`
- Email outage → `journey.stuck` after configured timeout
- Abandon mid-flow → `journey.stuck`; reopenable on next visit
- Multi-device → run joined by stable subscriber id (email + persistent cookie)

---

## 3. The five generated artefacts

|#|Artefact|Audience|Generated when|Storage|Mutability|
|---|---|---|---|---|---|
|1|Dev-test script|Engineers, CI|On every IR commit|Code repo|Regenerated|
|2|User guide|End users, support|On `published`|Docs storage|Snapshot per version|
|3|Mission|Runtime engine|On `published`|Mission store|Snapshot per version; activatable|
|4|Inference pattern|Telemetry pipeline|On `validated`|Pattern registry|Snapshot per version|
|5|Runtime state card|Admin/operator UI|On `validated`|Component bundle|Schema-driven|

Removing any one produces a gap; adding a sixth duplicates a consumer. Implementations MAY add proprietary artefacts but the five MUST always be regenerable from the same IR.

---

## 4. JourneyIR — the single source of truth

The IR is a versioned, declarative document. Not code. Not a runtime object.

### 4.1 Required top-level fields

```yaml
schema_version: "2.0.0"          # IR shape semver
journey_version: "v3"             # this journey's content version
id: "newsletter-signup-and-welcome"
title: "Newsletter signup + welcome"
description: "Anonymous visitor signs up, gets confirmation email, returns, runs search."

# What kind of journey is this?
mode: "sequential" | "free" | "hybrid" | "recurring"
repeat_policy: "first_time_only" | "always" | "anomaly_based"

# Who and where?
actor: "anonymous_visitor" | "<role>" | "multi"
platform: "web" | "mobile" | "voice" | "any"
auth_profile: "anonymous" | "authenticated" | "<custom>"

# Module + classification (for filtering, dashboards, agent retrieval)
module: "<onboarding|scheduling|comms|settings|admin|...>"
relevance:
  onboarding: true | false
  daily_use: true | false
  rare_event: true | false
priority: "P0" | "P1" | "P2" | "P3"

# Where it starts
entry_url: "https://example.com/landing"
preconditions:
  - "Email provider configured"
  - "Search index ≥ 100 documents"

# What "done" means
success_gate:
  description: "User confirmed email AND completed at least one search"
  predicate: "events.contains('step.email.confirmation_clicked') AND events.contains('step.search.completed')"

# Cross-journey relationships
prerequisites: []                 # journey_ids that must complete before this can start
terminates: []                    # journey_ids that get terminated when this completes
exclusive_with: []                # journey_ids that cannot run concurrently with this

# Confidence + assist (see §7)
assist:
  threshold: 0.85
  default_silence_ms: 15000
  cooldown_ms: 3600000

# Tags for retrieval
tags: ["onboarding", "newsletter"]

# Optional AI-guide context
system_prompt: "..."

# i18n
i18n:
  en: { title: "...", description: "..." }
  no: { title: "...", description: "..." }

steps: [ ... ]                    # see §4.2
```

### 4.2 Step schema

```yaml
steps:
  - key: "step.form.email_filled"
    title: "Type email"
    description: "Visitor types a valid email"
    order: 4

    # How engine sees it (see §7.4)
    trigger:
      type: "dom_event" | "network_response" | "server_event" | "state_predicate" | "absence"
      # Type-specific:
      selector: "input[name='email']"        # dom_event
      event: "input"                          # dom_event
      method: "POST"                          # network_response
      path: "/api/subscribe"                  # network_response
      status: 200                             # network_response
      event_name: "email.queued"              # server_event
      filter: "template_id == 'confirm'"      # server_event
      predicate: "subscriber.confirmed_at IS NOT NULL"  # state_predicate
      poll_interval_ms: 60000                 # state_predicate
      after: "step.x"                         # absence
      timeout_ms: 300000                      # absence (when absence becomes the trigger)

    # What must be true for step to count
    assertion: "input.value.matches('^[^@]+@[^@]+\\.[^@]+$')"

    # Stuck-window for THIS step
    next_step_window_ms: 30000

    # What happens at timeout
    on_timeout: "abandon" | "pause" | "background" | "assist"
    reentry_trigger: "magic_link_click"   # required if on_timeout == "background"
    assist_silence_ms: 15000              # override if on_timeout == "assist"

    # Confidence weighting (see §7.7)
    weight: 0.4
    confidence_contribution: "low" | "medium" | "high" | "terminal"

    # Multi-actor (see §14)
    actor: "anonymous_visitor"
    handoff_to: null                      # role to hand off to after this step
    handoff_token_field: null             # field carrying the handoff token

    # Optional
    pii_input: false                      # if true, voice channel refuses
    screenshots: []
    instructions: "..."                   # AI guide coaching for this step
```

### 4.3 Versioning

Two versions per IR:

- **`schema_version`** — semver of IR shape itself. When engine evolves, schema bumps. Old IRs remain readable until officially deprecated.
- **`journey_version`** — content version of this specific journey. Each version is immutable. Editing a published IR creates a new draft from a copy.

Both old and new versions can coexist (A/B testing, gradual rollout).

### 4.4 Validation (three layers)

1. **Syntactic** — IR conforms to Zod/JSON Schema
2. **Semantic** — every step's trigger references a known type; selectors non-empty; success gate references real events; prerequisites/terminates reference known journey ids
3. **Generator pre-flight** — each generator can refuse an IR ("dev-test cannot run because step 7 has no `assertion`")

A failing layer blocks `validated` state.

### 4.5 Snapshot policy (run-IR binding)

When a run starts, the engine MUST snapshot the _full IR document_ (not just version pointer) into the run's record. This guarantees:

- Run is unaffected by later IR edits or schema migrations
- Stuck runs from 9 months ago can still be inspected against their original IR
- Engine can read all historical schema versions OR fail-loud if a deprecated schema is encountered

Storage cost is acceptable: an IR document is typically < 50 KB.

### 4.6 Event-to-step attribution

Events are facts. Journeys are interpretations.

A single event can:

- Match multiple active runs (login click is step 7 of onboarding AND step 1 of daily-active-user)
- Match no journey (raw telemetry only)
- Be matched differently by different IR versions (A/B testing)

Pattern matcher (§10) does the attribution. Each run independently tracks progress against the same event stream. The event itself carries no `run_id` — the matcher attaches it when emitting derived `step_reached` events.

---

## 5. Lifecycle states (separated)

The engine has TWO independent lifecycles that must not be confused.

### 5.1 IR lifecycle

```
draft → validated → published → active ⇄ inactive → retired
                                            ↓
                                          broken (hot-discovered regression)
```

|State|Meaning|Who transitions|
|---|---|---|
|`draft`|Author writing|Author|
|`validated`|Schema + semantic + pre-flight passed|Engine (auto on save)|
|`published`|Generators produced 5 artefacts; mission is `is_active=false`|Author (manual publish)|
|`active`|`is_active=true`; runtime surfaces this journey|Author (manual activate)|
|`inactive`|Temporarily disabled; existing runs continue|Author|
|`retired`|Replaced by newer version; no new runs accepted|Author|
|`broken`|Reachable from `active` OR `published` when prod-like regression detected|Engine (auto) or Author|

### 5.2 Run lifecycle (separate from IR)

```
       ┌──────────┐
       │  idle    │
       └────┬─────┘
            ▼
       ┌──────────┐                ┌──────────┐
   ┌───│ running  │◄──── RETRY ────│  stuck   │
   │   └─┬───┬────┘                └────┬─────┘
   │     │   │                          │
   │ STEP_DONE │ TIMEOUT                │ ABANDON
   │     ▼   ▼                          ▼
   │ ┌────────────┐                ┌──────────┐
   │ │ completed  │                │  idle    │
   │ └────────────┘                └──────────┘
   │
   │ FAIL
   ▼
┌──────────┐                  ┌──────────┐
│  failed  │──── RESET ──────►│  idle    │
└──────────┘                  └──────────┘

(also: running ⇄ paused on tab close / focus return)
```

|State|Entry|Exit|
|---|---|---|
|`idle`|New run OR explicit reset|→ `running` (start), terminal|
|`running`|Step in flight|→ `paused`, `stuck`, `completed`, `failed`|
|`paused`|Focus loss / tab close|→ `running` (focus return), → `stuck` (timeout)|
|`stuck`|Step timeout fired|→ `running` (RETRY), → `idle` (ABANDON)|
|`completed`|Success gate true|terminal|
|`failed`|Hard error|→ `idle` (RESET)|

### 5.3 Critical invariant

Closing an IR (`retired`) does NOT terminate live runs. They continue against their snapshotted IR.

Recurring-mode runs (`mode: "recurring"`) emit `journey.cycle_completed` instead of transitioning to `completed`. They keep running.

---

## 6. Authoring surface

### 6.1 Editor

- Form-driven OR raw-IR editor (toggleable)
- Live validation on every keystroke (debounce ≤ 500 ms)
- "Publish" disabled until `validated`
- Diff view between previous published version and current draft

### 6.2 Storage

- Versioned store (DB + immutable history)
- Every IR-touch auditable (author, timestamp, prior version hash)
- Editing published IR creates new draft from copy

### 6.3 Publish action

- Re-runs all generators
- Writes mission with `is_active=false`
- Generates user-guide page
- Persists inference pattern
- Queues dev-test regeneration
- Emits `journey.published` audit event

### 6.4 Activate action

- Flips mission to `is_active=true`
- Pre-condition: every step must have author-reviewed coaching text
- Anti-laziness: refuse activation if mission stages match IR auto-derivation byte-for-byte
- Emits `journey.activated` audit event

### 6.5 Creation flow

New journeys are created via the **`/journey-create` skill** (see §20). The skill is the canonical entry point — agent-driven, output is a validated IR draft. Manual IR-writing is allowed but discouraged for first-time journeys.

---

## 7. Runtime model

### 7.1 The runtime executes one journey for one actor

There is **one runtime model**, regardless of surface (dev / publish-test / live). The 6-state run machine in §5.2 is universal.

### 7.2 Run identity

A run has a stable `run_id`. Engine joins events to a run by:

1. `run_id` if present in payload (rare — usually only post-attribution)
2. Stable cross-event identifier: subscriber_id, persistent cookie, authenticated user_id
3. Fallback: session token + IR id

Multi-device joined by user identity OR auth-handshake (e.g. magic link with embedded `run_id`).

### 7.3 Step advancement

A step advances when its **trigger fires** AND its **assertion is true**. Trigger and assertion are different concepts:

- **Trigger** wakes the engine: "something happened that might be this step"
- **Assertion** verifies it: "the something was actually what we wanted"

A click on submit-button is the trigger. `events.recent.contains('api.subscribe.200')` is the assertion. Both must hold.

### 7.4 The five trigger types

|Type|Source|Example|
|---|---|---|
|`dom_event`|Frontend DOM observer|Click, input, scroll, viewport intersection|
|`network_response`|Frontend fetch interceptor or backend handler|API returns 200|
|`server_event`|Backend event bus|Email queued, webhook fired, cron ran|
|`state_predicate`|Periodic DB poll|`subscriber.confirmed_at IS NOT NULL`|
|`absence`|Engine-internal timer|No progress for X ms after step Y|

### 7.5 Step temporal coherence

Each step declares `next_step_window_ms` and `on_timeout`. The pattern matcher tracks `last_progress_at` per run. When `now - last_progress_at > current_step.next_step_window_ms`, apply policy:

|Policy|Effect|
|---|---|
|`abandon`|Run → `failed` with `error_code: timeout`|
|`pause`|Run → `paused`; resume on next matching event|
|`background`|Run leaves active tracking; reactivate only on `reentry_trigger`|
|`assist`|Run stays `running`; emit `assist.requested` (see §7.8)|

### 7.6 Pattern-matcher event classification

For each new event against each active run:

|Classification|Meaning|Effect|
|---|---|---|
|`match`|Event triggers next expected step|Advance run; update `last_progress_at`|
|`out_of_sequence`|Event matches a step in this journey but not the expected one|Log warning; do NOT advance; do NOT update `last_progress_at`|
|`unrelated`|Event doesn't match any step in this journey|Ignore for this run|

Only `match` drives progress. `out_of_sequence` is a signal that either the IR is missing a step or the user is bug-rounding the flow.

### 7.7 Confidence scoring

Every active candidate IR is scored continuously per user. Score determines whether the engine _believes_ the user is in that journey.

```
confidence(journey, user) =
    base_score
  + steps_matched_score
  + recency_score
  - exclusion_penalty
```

**Base score** (0.0–0.4):

- Right route: +0.2
- Right role: +0.1
- Has not completed (if `repeat_policy: first_time_only`): +0.1

**Steps-matched score** (0.0–0.6):

- Sum of `step.weight` for observed steps
- Weighted by `step.confidence_contribution`:
    - `low`: ×0.3 (generic page views, scroll)
    - `medium`: ×0.6 (typed content, hover)
    - `high`: ×1.0 (unique action like password input)
    - `terminal`: 1.0 (= journey complete)

**Recency score** (0.0–0.2):

- Events within last 60s: full weight
- Events 60s–10m: linear decay
- Events > 10m: minimal contribution

**Exclusion penalty** (0.0–1.0):

- Logout event: −0.5
- Different journey reached high confidence: −0.3
- Explicit "cancel" action: −1.0 (terminates)

Confidence is recomputed on every event. Stored per run. Visible in admin's runtime state card.

### 7.8 Assist triggers

Three triggers exist in the system:

|Trigger|Fires when|Effect|
|---|---|---|
|`step_trigger`|Brukerens handling matcher trigger-spec|Advance run|
|`assist_trigger`|High confidence + silence + eligibility|Offer help|
|`mission_trigger`|Explicit handoff to Stage Engine|Stage Engine takes over|

**Assist eligibility (all must hold):**

1. `confidence ≥ assist.threshold`
2. `time_since_last_progress ≥ current_step.assist_silence_ms` (or default)
3. `repeat_policy` allows assist:
    - `first_time_only`: user has not completed this journey before
    - `always`: always allowed
    - `anomaly_based`: current run duration > N × user's baseline
4. No assist for this journey within `cooldown_ms`
5. User has not dismissed assist for this journey recently
6. No higher-priority assist already showing

When all hold → emit `assist.requested` with payload (run_id, journey_id, step_key, confidence, suggested_action).

### 7.9 Assist queue

A user can have multiple eligible assists at once. The engine maintains a per-user `assist_queue` on server:

1. Score each candidate by confidence
2. Pick highest-confidence
3. If user has active assist → cooldown new assists for N minutes
4. Tie-break by oldest run (more critical to complete)
5. Drop the rest (they were not critical enough if overshadowed)

---

## 8. Generators

A generator is a pure function `IR → artefact`. Deterministic. Side-effect-free.

### 8.1 Dev-test script generator

- Output: Playwright/Cypress/Selenium spec
- One step → one assertion block
- Selectors from `step.trigger.selector`
- Success gate → final assertion
- Does NOT call engine runtime — drives browser directly

### 8.2 User-guide generator

- Output: Markdown/MDX
- Title + description + numbered human-readable steps
- MUST NOT include selectors, assertions, telemetry-event names

### 8.3 Mission generator

- Output: runtime mission record
- Fields: `mission_id`, IR version ref, per-stage agent coaching (`goal`, `instructions`, `success_criteria`), `is_active=false`
- Anti-laziness gate: refuse activation if stages match auto-derivation byte-for-byte

### 8.4 Inference-pattern generator

- Output: pattern document for telemetry pipeline
- Used by pattern matcher and anomaly detection

### 8.5 Runtime-state-card generator

- Output: UI component descriptor
- Names 6 states + per-step labels + i18n + recovery actions
- Visual implementation fixed by engine; descriptor populates

---

## 9. Telemetry contract

Fixed event registry. No off-registry events allowed.

### 9.1 Required events

|Event|When|Required payload|
|---|---|---|
|`journey.run_started`|Run begins|run_id, journey_id, journey_version, actor_id, surface, timestamp|
|`journey.step_reached`|Step assertion true|run_id, step_key, step_index, actor_id, timestamp|
|`journey.completed`|Success gate true|run_id, final_step, duration_ms, actor_id, timestamp|
|`journey.cycle_completed`|Recurring run cycles|run_id, cycle_number, duration_ms, timestamp|
|`journey.stuck`|Timeout without progress|run_id, step_key, timeout_ms, actor_id, timestamp|
|`journey.run_failed`|Terminal error|run_id, step_key, error_code, error_message, actor_id, timestamp|
|`journey.handoff_initiated`|Multi-actor handoff started|run_id, from_actor, to_actor, handoff_token, timestamp|
|`journey.handoff_accepted`|Handoff accepted|run_id, accepted_by_actor, handoff_token, timestamp|
|`assist.requested`|Assist trigger fired|run_id, journey_id, step_key, confidence, suggested_action|
|`assist.dismissed`|User dismissed assist|run_id, journey_id, dismissal_reason|
|`assist.engaged`|User engaged with assist|run_id, journey_id, action_taken|
|`journey.published`|IR published|journey_id, journey_version, author_id|
|`journey.activated`|IR activated|journey_id, journey_version, author_id|
|`journey.retired`|IR retired|journey_id, journey_version, author_id|

### 9.2 Required destinations

Every event lands in at minimum:

1. **Analytics sink** (cohort + funnel)
2. **Logger** (debugging)
3. **Audit trail** (compliance + reconstruction)
4. **Runtime event store** (pattern matcher subscription)

### 9.3 Registry rule

CI gate: every `emit("journey.*", ...)` and `emit("assist.*", ...)` call site grep'd against registry. Miss → build fails.

---

## 10. Pattern matcher

Continuously running consumer of event stream.

### 10.1 Inputs / outputs

- **Inputs:** event stream, all published inference patterns, run state store (read+write)
- **Outputs:** updated run state, derived events (e.g. `journey.completed`)

### 10.2 Determinism

MUST NOT invoke any non-deterministic component. No LLM-based classifiers, no wall-clock-dependent logic, no external services without bounded retries. Pattern matching is pure event-window evaluation.

If LLM-assisted classification is desired, it lives as separate `journey.pattern_assist` capability that _suggests_ mappings for human or deterministic validation.

### 10.3 Catch-up

Pattern matcher MUST replay a window of past events. Supports:

- Late events (mobile reconnect)
- New patterns deployed needing backfill
- Debugging specific runs

---

## 11. AI guide layer

Optional. Surfaces natural-language coaching during a run.

### 11.1 Inputs

- Current run state (which step)
- IR `system_prompt`
- Step `description` + `instructions`
- Recent user actions (last N events / last 5 min)

### 11.2 Outputs

- Short coaching message (tooltip, sidebar, voice)
- Optional follow-on suggestion

### 11.3 Constraints

- MUST NOT be load-bearing — journey completes if AI guide disabled
- MUST NOT mutate journey state — speaks only; engine acts
- MUST NOT leak context across users or runs (security rule)
- MAY retain context within a run (recommended; bounded by event window)

### 11.4 Voice channel

If voice present:

- Step-level: IR can mark step `pii_input: true`. Voice refuses such steps; falls back to chat
- Runtime-level: PII-redaction in transcription pipeline post-conversion

---

## 12. Component overlay + frontend/backend contract

### 12.1 Component overlay

DOM-attached layer highlighting next-suggested element.

**Inputs:** current step's `trigger.selector` + viewport state. **Outputs:** highlight + optional inline AI guide text.

**Constraints:**

- Respects `prefers-reduced-motion`
- Deterministic motion physics (spring stiffness=35, damping=22, mass=2.2)
- ARIA live regions for screen readers
- Touch targets ≥ 44 pt

### 12.2 Frontend / backend ansvarsfordeling

The system is **B+A**: backend authoritative (B), frontend agent harness as cache (A).

**Backend owns:**

- All active runs
- Confidence scoring
- `assist_trigger` decisions
- Run state machine
- `assist_queue` per user
- Authoritative event store

**Frontend agent harness owns:**

- Local event buffer (last 5 events / 60s, whichever shorter)
- Optimistic UI (highlight next selector before server confirms)
- Lazy-loaded run-context cache from `GET /api/journey/active-context`
- Realtime subscription on `journey.*` and `assist.*` events for current user

**Frontend MUST NOT:**

- Compute confidence
- Decide assists
- Drive run state forward
- Be the source of truth for anything beyond UI state

**Frontend MAY:**

- Show optimistic visual feedback
- Buffer events offline; batch-send on reconnect
- Display assist UI when server emits `assist.requested`

### 12.3 Frontend lifecycle

```
1. App boots
2. No active session → idle, no journey context
3. User logs in / becomes active
4. GET /api/journey/active-context
   → { active_runs, recent_events, pending_assists }
5. Subscribe to realtime journey.* + assist.* for user
6. Local DOM observer → POST /api/journey/events (debounced 200ms)
7. Server emits assist.requested via realtime → render AI guide
8. Every 60s: refresh if drift detected
```

### 12.4 API contracts

```
GET /api/journey/active-context
  → 200 {
      active_runs: [{ run_id, journey_id, current_step, confidence, ... }],
      recent_events: [{ ... }],
      pending_assists: [{ ... }]
    }

POST /api/journey/events
  body: { events: [{ type, name, payload, timestamp }] }
  → 202 { received: N }

GET /api/journey/run/:run_id
  → 200 { run_id, journey_id, current_step, state, history, ... }

POST /api/journey/run/:run_id/dismiss-assist
  → 204
```

---

## 13. Bridges

### 13.1 Stage-engine bridge

Engine runtime can hand off to broader Stage Engine (agent-orchestration).

Bridge passes: `run_id`, `mission_id`, current step, mission `system_prompt`, per-stage instructions.

Stage Engine takes over conversational layer; Journey Engine continues tracking. Shared `run_id` is join key.

### 13.2 Event bridge

Engine MAY forward events to external systems (CRM, email, analytics warehouse).

Bridge is **read-only** outbound. External systems never write back to engine state without going through runtime API (preserves authority).

---

## 14. Multi-actor handoff

Some journeys span multiple actors (admin invites employee → employee accepts → manager approves). Handoff is a first-class concept.

### 14.1 IR declaration

```yaml
actor: "multi"
actors:
  - role: "admin"
    starts_at_step: "step.invite.created"
  - role: "employee"
    starts_at_step: "step.invite.accepted"
  - role: "manager"
    starts_at_step: "step.profile.review"

steps:
  - key: "step.invite.created"
    actor: "admin"
    handoff_to: "employee"
    handoff_token_field: "invitation_token"
    handoff_timeout_ms: 86400000   # 24h
```

### 14.2 Handoff lifecycle

When step with `handoff_to` completes:

1. Emit `journey.handoff_initiated` (run_id, from_actor, to_actor, handoff_token)
2. Run state: `running` (waiting for handoff acceptance)
3. Receiving actor must trigger handoff event (e.g. click invitation link) within `handoff_timeout_ms`
4. On accept: emit `journey.handoff_accepted`; run continues with new actor
5. On timeout: `journey.stuck` with `error_code: handoff_timeout`

### 14.3 Telemetry segmentation

Multi-actor runs surface per-actor segments in dashboards: "step 4 of 7, waited on employee for 14 hours".

### 14.4 Run-event attribution

When an event arrives, pattern matcher checks:

1. Is run currently expecting an event from this `actor_id`?
2. Yes → attribute as normal
3. No → check if event matches a `handoff_to` field for current step
4. If yes → trigger handoff acceptance flow
5. If no → `unrelated` for this run

---

## 15. Testability rules

### 15.1 Four layers

|Layer|What it tests|Rule|
|---|---|---|
|L1 — semantic|Logic, naming, conventions|Static analysis; no runtime tests|
|L2 — payload trace|Source field → store → retrieved|Verify types, NOT NULL, enums|
|L3 — constraint semantics|DB constraints, RLS, FKs, triggers|Submit invalid input; assert constraint fires|
|L4 — capability-consumer trace|Producer-keeps-promise + consumer-exists|Name consumer for every producer|

### 15.2 Test-the-artefact rule

A test asserting `result.ok === true` proves nothing. Test MUST assert the artefact: row in store, file on disk, event in registry.

For §2 step 7: `SELECT FROM subscriber WHERE email='pat@example.com'` AND assert one row. NOT `response.status === 200`.

### 15.3 Falsifiable status claims

Every "complete"/"green"/"shipped" claim cites a specific grep, SQL, or test that returns deterministic pass/fail.

### 15.4 Anti-phantom invariants (every reviewer checks)

1. **No phantom emit.** Capability emitting `started` MUST produce artefact in same execution OR return `{ok:false, error:"not_implemented"}` WITHOUT emitting `started`.
2. **No phantom consumer.** Capability writing a row MUST name consumer reading it.
3. **Gate every mutation.** Every state-change passes through authority layer.

---

## 16. Variants

### 16.1 Mode variants

- `sequential` — strict order
- `free` — any order; success gate decides
- `hybrid` — mix; per-step `order` declares strict steps
- `recurring` — never terminates; emits `cycle_completed`

**No default.** Author must choose explicitly.

### 16.2 Surface variants

- Dev — runs test script against build
- Publish — generates docs+missions
- Runtime — live execution

### 16.3 Persona variants

- Anonymous — joined by cookie/session
- Authenticated — joined by user_id
- Multi-actor — see §14

### 16.4 Channel variants

- Web only
- Mobile native
- Voice (PII-restricted)
- Hybrid (events join by run_id)

### 16.5 Storage variants

- DB-backed mission store (default)
- Document-backed (large MDX content)

---

## 17. Gotchas + open questions

### 17.1 Gotchas (from real-world wear)

- **Status-vocab drift.** Capability tools wrote `queued`/`running`; DB CHECK enforced `pending`/`active`. Engine MUST publish allowed vocab; producers consume from same source.
- **Phantom emit.** Capability returns `ok:true` but never writes artefact. L4 catches.
- **Phantom consumer.** Row written, no service reads. L4 reverse catches.
- **Authority loader collapse.** Authority keyed by base-name (`journey`) instead of full-name (`journey.run_dev`); non-deterministic without ORDER BY.
- **Mission resolution gap.** Capability publishes missions but no runtime reads them.
- **Closure-doc invariant.** Every "campaign closed" cites falsifiable check.
- **Frontend confidence drift.** Frontend computes own confidence → diverges from server. Solved by B+A architecture (§12.2).

### 17.2 Open questions

- **Stuck detection strategy.** Pull (cron) vs push (delayed trigger) vs hybrid. Implementation chooses.
- **MDX escaping.** Public guides with attacker-controlled text need sanitization before exposure.
- **Multi-tenant isolation.** Tenant-scope at storage layer; never application-layer filter.
- **Confidence-algorithm tuning.** Initial weights are guesses. Need real data to calibrate.
- **Anomaly-based assist baseline.** How long is enough history? 5 completions? 10? Per-user vs cohort?

---

## 18. Roadmap (informational)

|Phase|Goal|Exit gate|
|---|---|---|
|Foundations|Telemetry registry, IR schema, authority gate, capability skeletons|Every emit registered, every capability gated, IR validates|
|Spec + IR canonical|IR package + types + validators canonical|One IR validates and stub artefact produced|
|Bodies|Real generators for all 5 artefacts; runtime executes one journey|§2 reference journey runs end-to-end|
|Authoring + UI|Author surface + admin observer card + activate flow|Non-engineer authors a journey via creation skill|
|Confidence + Assist|Pattern matcher confidence + assist queue|Reference journey emits assist when test user stalls|
|Multi-actor|Handoff contract + segmented telemetry|Onboarding journey with 3 actors completes|
|Mobile + ops|Mobile native runtime; alerting; rollback|Reference journey runs on mobile; ops can flip authority|

---

## 19. Glossary

|Term|Meaning|
|---|---|
|JourneyIR|Single declarative description of a journey. Versioned, immutable per version, source of all artefacts|
|Artefact|Output produced by generator from IR|
|Run|Single execution of journey by specific actor; has own lifecycle|
|Mission|Runtime artefact derived from IR; what runtime executes|
|Stage|Persisted unit within mission; corresponds roughly to step|
|Authority|Access-control config gating which capabilities a caller may invoke|
|Pattern matcher|Subsystem attributing observed events to runs|
|Stage Engine|Optional broader agent-orchestration layer|
|Bridge|Outbound integration to external system|
|Phantom-emit|Capability emits "started" without writing artefact|
|Phantom-consumer|Capability writes artefact no consumer reads|
|Falsifiable claim|Status claim backed by specific grep/SQL/test|
|Confidence|Score 0.0–1.0 of how strongly engine believes user is in a journey|
|Assist|Engine-initiated offer of help; gated by confidence + silence + eligibility|
|Trigger (step / assist / mission)|Three different kinds of triggers; not interchangeable|

---

## 20. Journey creation flow

New journeys are created via the **`/journey-create` skill** (a separate skill document).

### 20.1 Why a skill, not a wizard

A wizard implies a fixed form. Real journey-creation requires:

- Conversation about what the user is actually trying to model
- Pushback on scope ("is this really 1 journey or 2?")
- Validation that the journey is core, not peripheral
- Confirmation before commit

This is agent work, not form work.

### 20.2 Output of the skill

A `draft` IR document. Validated. Ready for `validated` transition once author approves.

### 20.3 Constraints on first batch

When a project is starting (Phase 0–2 of roadmap), only **core-feature journeys** are authored. Not edge cases. Not nice-to-haves. The first batch is typically 5–10 journeys covering the absolutely-must-work flows. More journeys are added as the engine matures.

### 20.4 Skill location

See `/skills/journey-create/SKILL.md`.

---

_End of PRD v0.2. Implementations MUST run §2 reference journey end-to-end before claiming engine is shippable._