---
title: "Journey Engine — Architecture & Contracts"
id: ENGINE_SYSTEM_ARCHITECTURE
version: "0.2.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - architecture
  - contracts
  - journey-engine
  - schema
  - api
---

# Journey Engine — Architecture & Contracts

> Companion to `01-prd.md`. Concrete arrows, schemas, contracts. Read PRD first if you have not.

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  AUTHORING                    GENERATORS                ARTEFACTS   │
│                                                                     │
│  ┌──────────┐                ┌────────────┐         ┌─────────────┐ │
│  │ /journey │──────────────► │ IR Parser  │────────►│ Dev-test    │ │
│  │ -create  │                │ + Validator│         │ User guide  │ │
│  │ skill    │                └─────┬──────┘         │ Mission     │ │
│  └────┬─────┘                      │                │ Inf. pattern│ │
│       │                            ▼                │ State card  │ │
│       ▼                      ┌────────────┐         └─────────────┘ │
│  ┌──────────┐                │ 5 emitters │                         │
│  │ IR Store │◄───────────────│  (pure fn) │                         │
│  └──────────┘                └────────────┘                         │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RUNTIME                                                            │
│                                                                     │
│  ┌────────────┐                                                     │
│  │ Frontend   │  events    ┌──────────────┐                        │
│  │ Agent      │───────────►│ Event API    │                        │
│  │ Harness    │            └──────┬───────┘                        │
│  │ (cache)    │                   │                                │
│  └────▲───────┘                   ▼                                │
│       │                    ┌──────────────┐                        │
│       │ realtime           │ Event Store  │                        │
│       │ (assist.requested) └──────┬───────┘                        │
│       │                           │                                │
│       │                           ▼                                │
│       │                    ┌──────────────┐    ┌────────────────┐ │
│       └────────────────────│ Pattern      │───►│ Run State Store│ │
│                            │ Matcher      │    └────────────────┘ │
│                            │ + Confidence │           │            │
│                            │ + Assist     │           │            │
│                            └──────┬───────┘           │            │
│                                   │                   │            │
│                                   ▼                   ▼            │
│                            ┌──────────────┐    ┌──────────────┐  │
│                            │ Telemetry    │    │ Stuck        │  │
│                            │ Sinks        │    │ Detector     │  │
│                            │ (4 required) │    │ (cron)       │  │
│                            └──────────────┘    └──────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ADMIN                                                              │
│                                                                     │
│  ┌────────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │ State Card │    │ Authoring UI │    │ Authority Config       │ │
│  │ (Fjernkon- │    │ (form + IR   │    │ (seeded, not runtime)  │ │
│  │  troll)    │    │  diff view)  │    │                        │ │
│  └────────────┘    └──────────────┘    └────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data flow — newsletter journey end-to-end

```
DEV-TIME (one-time, on IR commit)
═════════════════════════════════
  Author writes IR ─► Validator ─► IR Store (draft)
                                     │
                                     ▼
                                  Generators ─► 5 artefacts written
                                     │
                                     ▼
                                  Author reviews + Activates
                                     │
                                     ▼
                                  Mission flagged is_active=true


RUNTIME — first session
═══════════════════════
  User visits /landing
       │
       ▼
  Frontend Agent Harness boots
       │
       ▼
  GET /api/journey/active-context
       └──► server: no active runs yet, return empty
       │
       ▼
  Frontend listens to DOM
       │
       ▼
  User scrolls past hero
       │
       ▼
  POST /api/journey/events { type: "dom_event", name: "scroll", payload: {depth: 0.5} }
       │
       ▼
  Event Store + Pattern Matcher
       │
       ▼
  Pattern matcher: candidate journey "newsletter-signup-and-welcome"
                   confidence: 0.30 (page_view + scroll)
                   no run started yet because confidence < 0.5
       │
       ▼
  User types email → POST events → confidence: 0.55
       │
       ▼
  Pattern matcher creates run R1, status=running, current_step=1
                   emits journey.run_started
       │
       ▼
  User types name → confidence: 0.75
                  emits journey.step_reached(step.form.name_filled)
       │
       ▼
  User pauses 15s
       │
       ▼
  Stuck detector: confidence 0.75 + silence 15s + step.assist_silence_ms=15s
                  emits assist.requested(R1, "step.form.name_filled")
       │
       ▼
  Frontend realtime receives → renders AI guide tooltip


RUNTIME — second session (next day)
═══════════════════════════════════
  User clicks magic link in email
       │
       ▼
  Server: token valid → set cookie → redirect /welcome?token=X
       │
       ▼
  Frontend boots on /welcome
       │
       ▼
  GET /api/journey/active-context
       └──► server: R1 still in 'background' state
                    re-attribute via reentry_trigger="magic_link_click"
                    transition R1 → running, advance to step 13
       │
       ▼
  Server emits journey.step_reached(R1, step.email.confirmation_clicked)
       │
       ▼
  User runs search → success_gate predicate becomes true
       │
       ▼
  Server emits journey.completed(R1)
                update mission status
                trigger downstream: terminates[] journeys, follow-on suggestions
```

---

## 3. Database schema (illustrative — not implementation-mandated)

> Storage backend is implementation-defined. Schema below is reference shape.

### 3.1 `journey_ir`

```sql
CREATE TABLE journey_ir (
  id              TEXT NOT NULL,           -- e.g. "newsletter-signup-and-welcome"
  journey_version TEXT NOT NULL,           -- e.g. "v3"
  schema_version  TEXT NOT NULL,           -- e.g. "2.0.0"
  status          TEXT NOT NULL CHECK (status IN ('draft','validated','published','active','inactive','retired','broken')),
  document        JSONB NOT NULL,          -- the full IR
  document_hash   TEXT NOT NULL,           -- sha256 of document for integrity
  module          TEXT NOT NULL,
  priority        TEXT NOT NULL,
  author_id       UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ,
  activated_at    TIMESTAMPTZ,
  retired_at      TIMESTAMPTZ,

  PRIMARY KEY (id, journey_version)
);

CREATE INDEX idx_journey_ir_status ON journey_ir(status);
CREATE INDEX idx_journey_ir_module ON journey_ir(module);
```

### 3.2 `journey_run`

```sql
CREATE TABLE journey_run (
  run_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id          TEXT NOT NULL,
  journey_version     TEXT NOT NULL,
  ir_snapshot         JSONB NOT NULL,                   -- full IR captured at start
  ir_snapshot_hash    TEXT NOT NULL,
  actor_id            UUID,                             -- nullable for anonymous
  session_id          TEXT,                             -- for anonymous joining
  state               TEXT NOT NULL CHECK (state IN ('idle','running','paused','stuck','completed','failed','background')),
  current_step_key    TEXT,
  current_step_index  INT,
  confidence          NUMERIC(3,2) NOT NULL DEFAULT 0,
  last_progress_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  failure_code        TEXT,
  failure_message     TEXT,

  FOREIGN KEY (journey_id, journey_version) REFERENCES journey_ir(id, journey_version)
);

CREATE INDEX idx_journey_run_actor ON journey_run(actor_id, state);
CREATE INDEX idx_journey_run_active ON journey_run(state) WHERE state IN ('running','paused','stuck','background');
CREATE INDEX idx_journey_run_progress ON journey_run(last_progress_at) WHERE state = 'running';
```

### 3.3 `journey_event`

```sql
CREATE TABLE journey_event (
  event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT NOT NULL,                        -- must be in registry
  run_id          UUID,                                 -- nullable (raw events)
  journey_id      TEXT,
  step_key        TEXT,
  actor_id        UUID,
  session_id      TEXT,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  surface         TEXT NOT NULL CHECK (surface IN ('dev','publish','runtime')),
  emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (run_id) REFERENCES journey_run(run_id)
);

CREATE INDEX idx_journey_event_run ON journey_event(run_id, emitted_at);
CREATE INDEX idx_journey_event_actor ON journey_event(actor_id, emitted_at);
CREATE INDEX idx_journey_event_name ON journey_event(event_name, emitted_at);
```

### 3.4 `journey_step_log`

```sql
CREATE TABLE journey_step_log (
  log_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL,
  step_key        TEXT NOT NULL,
  step_index      INT NOT NULL,
  classification  TEXT NOT NULL CHECK (classification IN ('match','out_of_sequence','unrelated')),
  triggering_event_id UUID NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (run_id) REFERENCES journey_run(run_id),
  FOREIGN KEY (triggering_event_id) REFERENCES journey_event(event_id)
);
```

### 3.5 `journey_assist_log`

```sql
CREATE TABLE journey_assist_log (
  assist_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL,
  journey_id      TEXT NOT NULL,
  step_key        TEXT NOT NULL,
  confidence      NUMERIC(3,2) NOT NULL,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome         TEXT CHECK (outcome IN ('engaged','dismissed','timed_out','superseded')),
  outcome_at      TIMESTAMPTZ,

  FOREIGN KEY (run_id) REFERENCES journey_run(run_id)
);
```

### 3.6 `journey_authority`

```sql
-- Seeded via migration. NEVER inserted at runtime.
CREATE TABLE journey_authority (
  capability      TEXT PRIMARY KEY,         -- e.g. "journey.run_dev"
  required_role   TEXT NOT NULL,            -- e.g. "platform_admin"
  description     TEXT NOT NULL,
  seeded_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3.7 `journey_event_registry`

```sql
-- Seeded via migration. CI checks emit-sites against this.
CREATE TABLE journey_event_registry (
  event_name      TEXT PRIMARY KEY,
  payload_schema  JSONB NOT NULL,
  description     TEXT NOT NULL,
  required_destinations TEXT[] NOT NULL DEFAULT ARRAY['analytics','logger','audit','event_store']
);
```

---

## 4. API contracts

### 4.1 Event emission (frontend → backend)

```http
POST /api/journey/events
Content-Type: application/json
Authorization: Bearer <session_token>

{
  "events": [
    {
      "type": "dom_event",
      "name": "click",
      "selector": "button[data-journey='subscribe-submit']",
      "payload": { "form_id": "newsletter" },
      "client_timestamp": "2026-04-28T14:03:12.421Z"
    }
  ]
}
```

```http
202 Accepted
{ "received": 1, "server_timestamp": "2026-04-28T14:03:12.502Z" }
```

### 4.2 Active context (frontend cache hydration)

```http
GET /api/journey/active-context
Authorization: Bearer <session_token>
```

```http
200 OK
{
  "active_runs": [
    {
      "run_id": "...",
      "journey_id": "newsletter-signup-and-welcome",
      "journey_version": "v3",
      "current_step_key": "step.form.name_filled",
      "current_step_index": 5,
      "state": "running",
      "confidence": 0.75,
      "started_at": "2026-04-28T14:01:55Z",
      "last_progress_at": "2026-04-28T14:03:10Z"
    }
  ],
  "recent_events": [
    {
      "event_id": "...",
      "event_name": "journey.step_reached",
      "step_key": "step.form.name_filled",
      "emitted_at": "2026-04-28T14:03:10Z"
    }
  ],
  "pending_assists": []
}
```

### 4.3 Run details (admin / debugging)

```http
GET /api/journey/run/:run_id
Authorization: Bearer <session_token>
```

```http
200 OK
{
  "run_id": "...",
  "journey_id": "...",
  "journey_version": "v3",
  "ir_snapshot": { ... },
  "state": "running",
  "current_step_key": "...",
  "confidence": 0.75,
  "history": [
    { "step_key": "step.scroll.50", "classification": "match", "at": "..." },
    { "step_key": "step.form.email_filled", "classification": "match", "at": "..." }
  ],
  "assist_history": []
}
```

### 4.4 Dismiss assist

```http
POST /api/journey/run/:run_id/dismiss-assist
{ "reason": "not_helpful" | "already_know" | "wrong_journey" }
```

```http
204 No Content
```

### 4.5 Realtime subscription (frontend ← backend)

Channels per authenticated user:

- `journey.{user_id}` — receives all `journey.*` events for runs owned by user
- `assist.{user_id}` — receives `assist.requested`, `assist.dismissed`, `assist.engaged` for user

Payload format identical to event emission format.

---

## 5. Capability authority contract

Every capability is registered. Registration includes required role, surface, and effects.

```yaml
# Example: capability registration (seeded via migration)

capabilities:
  - name: "journey.run_dev"
    required_role: "platform_admin"
    description: "Run a journey's dev-test against a build"
    surfaces: ["dev"]
    side_effects:
      - "executes browser automation"
      - "writes journey_event with surface=dev"

  - name: "journey.run_guided"
    required_role: "authenticated_user"
    description: "Live agent-guided journey execution for end user"
    surfaces: ["runtime"]
    side_effects:
      - "writes journey_run, journey_event"
      - "may trigger assist.requested"

  - name: "journey.run_inferred"
    required_role: "system"
    description: "Pattern matcher attributes events to runs"
    surfaces: ["runtime"]
    side_effects:
      - "creates journey_run if none active"
      - "writes journey_step_log"
      - "emits journey.step_reached"

  - name: "journey.publish_mission"
    required_role: "journey_author"
    description: "Generate + persist mission artefact for an IR"
    surfaces: ["publish"]
    side_effects:
      - "writes mission record (is_active=false)"

  - name: "journey.publish_guide"
    required_role: "journey_author"
    description: "Generate + persist user guide for an IR"
    surfaces: ["publish"]
    side_effects:
      - "writes docs/journeys/<id>.md"
```

Capability count is frozen at the protocol level, not the count level. Adding a new capability that follows the protocol (registered, gated, telemetry-emitting) is allowed. Adding a capability that bypasses any of these is ADR-class.

---

## 6. Confidence algorithm — reference implementation

```typescript
// Pure function. Deterministic. No I/O.
function computeConfidence(
  ir: JourneyIR,
  observed: ObservedEvent[],
  user: UserContext,
  now: Date
): number {

  // ─── Base score (0.0–0.4) ────────────────────────────
  let base = 0;
  if (matchesEntryUrl(ir, user.currentUrl)) base += 0.2;
  if (matchesActorRole(ir, user.role)) base += 0.1;
  if (ir.repeat_policy === "first_time_only" && !user.hasCompleted(ir.id)) base += 0.1;

  // ─── Steps-matched score (0.0–0.6) ──────────────────
  const matchedSteps = observed
    .filter(e => isStepEvent(ir, e))
    .map(e => findStep(ir, e.step_key))
    .filter(Boolean);

  const contributionMultiplier: Record<string, number> = {
    low: 0.3,
    medium: 0.6,
    high: 1.0,
    terminal: 1.0,
  };

  const stepsScore = matchedSteps.reduce((acc, step) => {
    return acc + (step.weight * contributionMultiplier[step.confidence_contribution]);
  }, 0);

  const cappedSteps = Math.min(stepsScore, 0.6);

  // ─── Recency score (0.0–0.2) ────────────────────────
  const lastEvent = observed[observed.length - 1];
  if (!lastEvent) return base;
  const ageMs = now.getTime() - new Date(lastEvent.emitted_at).getTime();
  let recency: number;
  if (ageMs < 60_000) recency = 0.2;
  else if (ageMs < 600_000) recency = 0.2 * (1 - (ageMs - 60_000) / 540_000);
  else recency = 0.05;

  // ─── Exclusion penalty ──────────────────────────────
  let penalty = 0;
  if (observed.some(e => e.event_name === "user.logged_out")) penalty += 0.5;
  if (user.activeRunsExceptThis(ir.id).some(r => r.confidence > 0.7)) penalty += 0.3;
  if (observed.some(e => e.event_name === `journey.cancel.${ir.id}`)) penalty = 1.0;

  // ─── Final ──────────────────────────────────────────
  const raw = base + cappedSteps + recency - penalty;
  return Math.max(0, Math.min(1, raw));
}
```

---

## 7. Assist trigger — reference implementation

```typescript
// Called by stuck detector on every cron tick + on every event.
function evaluateAssist(
  run: JourneyRun,
  ir: JourneyIR,
  user: UserContext,
  now: Date
): AssistDecision {

  const currentStep = ir.steps.find(s => s.key === run.current_step_key);
  if (!currentStep) return { trigger: false, reason: "no_current_step" };

  // Must explicitly use assist as timeout policy
  if (currentStep.on_timeout !== "assist") {
    return { trigger: false, reason: "step_does_not_assist" };
  }

  // Confidence threshold
  if (run.confidence < ir.assist.threshold) {
    return { trigger: false, reason: "confidence_too_low" };
  }

  // Silence window
  const silenceMs = currentStep.assist_silence_ms ?? ir.assist.default_silence_ms;
  const elapsed = now.getTime() - run.last_progress_at.getTime();
  if (elapsed < silenceMs) {
    return { trigger: false, reason: "silence_window_not_elapsed" };
  }

  // Repeat policy
  if (ir.repeat_policy === "first_time_only" && user.hasCompleted(ir.id)) {
    return { trigger: false, reason: "repeat_policy_blocks" };
  }
  if (ir.repeat_policy === "anomaly_based") {
    const baseline = user.baselineDuration(ir.id);
    if (!baseline) return { trigger: false, reason: "no_baseline_yet" };
    const currentDuration = now.getTime() - run.started_at.getTime();
    if (currentDuration < baseline * 2) {
      return { trigger: false, reason: "within_normal_range" };
    }
  }

  // Cooldown
  const lastAssist = user.lastAssistFor(ir.id);
  if (lastAssist && (now.getTime() - lastAssist.getTime()) < ir.assist.cooldown_ms) {
    return { trigger: false, reason: "in_cooldown" };
  }

  // Active assist already showing
  if (user.hasActiveAssist()) {
    return { trigger: false, reason: "another_assist_active" };
  }

  // ── All filters passed ──
  return {
    trigger: true,
    payload: {
      run_id: run.run_id,
      journey_id: ir.id,
      step_key: currentStep.key,
      confidence: run.confidence,
      suggested_action: currentStep.instructions ?? "Continue with this step",
    }
  };
}
```

---

## 8. File structure (suggested)

```
journey-engine/
├── packages/
│   ├── ir/                        # Pure: schema + validators
│   │   ├── schema.ts
│   │   ├── validate.ts
│   │   └── snapshot.ts
│   ├── generators/                # Pure: IR → artefact
│   │   ├── dev-test.ts
│   │   ├── user-guide.ts
│   │   ├── mission.ts
│   │   ├── inference-pattern.ts
│   │   └── state-card.ts
│   ├── pattern-matcher/           # Stateful: events → run state
│   │   ├── classify.ts
│   │   ├── confidence.ts
│   │   ├── assist.ts
│   │   └── attribute.ts
│   ├── runtime/                   # Run state machine
│   │   ├── state-machine.ts
│   │   ├── stuck-detector.ts
│   │   └── handoff.ts
│   └── telemetry/                 # Event registry + sinks
│       ├── registry.ts
│       └── emit.ts
├── apps/
│   ├── api/                       # Backend HTTP API
│   │   └── routes/
│   │       ├── events.ts
│   │       ├── active-context.ts
│   │       └── run.ts
│   ├── frontend-harness/          # Frontend cache + DOM observer
│   │   ├── observer.ts
│   │   ├── cache.ts
│   │   └── overlay.ts
│   └── admin/                     # Authoring + state card
│       ├── editor.tsx
│       └── state-card.tsx
├── journeys/                      # IR documents (one per journey)
│   ├── newsletter-signup-and-welcome.journey.yaml
│   └── ...
├── tests/
│   ├── e2e/                       # Generated dev-test scripts
│   ├── confidence/                # Algorithm unit tests
│   └── integration/               # End-to-end runtime
└── docs/
    ├── PRD.md
    ├── ARCHITECTURE.md
    └── journeys/                  # Generated user guides
```

---

## 9. Deployment + environments

|Env|Purpose|Surface|
|---|---|---|
|dev|Local development|dev runner only|
|staging|Pre-prod validation|dev + publish|
|prod|Live users|runtime only|

Authority levels seeded per env. Production NEVER allows `journey.run_dev` to mutate prod data.

---

## 10. Security checklist

- [ ] Every API endpoint requires authentication
- [ ] Authority gate runs before any state mutation
- [ ] IR snapshot in run is immutable post-creation
- [ ] Voice channel refuses `pii_input: true` steps
- [ ] Multi-tenant: every IR + run + event is tenant-scoped at storage layer (RLS, not application filter)
- [ ] AI guide context never leaks across users or runs
- [ ] Telemetry payloads never contain raw PII (subscriber email is OK; password is never)
- [ ] Magic-link tokens are single-use and time-bound
- [ ] Generated user guides are sanitized before publishing if `is_public: true`

---

## 11. Observability

Required dashboards:

- **Active runs by journey** — count, by state
- **Completion rate** — per journey, per actor cohort, per version
- **Stuck rate** — runs entering stuck per hour, by step
- **Assist effectiveness** — assist.requested vs engaged vs dismissed, per journey
- **Confidence distribution** — histogram per journey, identifies threshold tuning needs
- **Multi-actor wait times** — handoff initiated → accepted, by step

Required alerts:

- Stuck rate > baseline × 2 → page on-call
- Generator failure during publish → block publish, page author
- Phantom emit detected (event without registry entry) → fail CI
- Authority loader returning non-deterministic results → page on-call