---
title: "Protocol Pipeline — Five Functions, One Folder"
id: ENGINE_SYSTEM_PROTOCOL_PIPELINE
version: "1.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - journey
  - protocol
  - pipeline
  - skill
  - source-of-truth
---

# Protocol Pipeline — Five Functions, One Folder

> ⚠️ **STATUS: INTENT, NOT IMPLEMENTED (2026-04-28).** This document describes the authoring pipeline as designed. The compile pipeline (FLOW.md generator, e2e generator, 13-file materializer), the MISSION.md schema runtime mapping, the ROADMAP.md button-renderer, and the `journey.rescued` event have **no implementation in code today**. Treat this as intent for upcoming work, not as a runnable contract. Tracking ADRs: ADR-0222 (op pipeline), ADR-0223 (rescue reconciliation), ADR-0224 (engine_missions schema), ADR-0225 (FLOW.md as intent doc).
>
> The authoring lifecycle for a Journey Protocol. Five operations, run in order. Output is one immutable folder per journey — the "fundament" — that becomes source of truth for every downstream artefact.
>
> Companion: `01-prd.md` (engine PRD), `02-architecture.md` (runtime contracts), `04-lifecycle.md` (status state machine), `07-journey-package-compiler.md` (package contract).

---

## 1. Why a pipeline (and not a wizard)

A wizard implies a fixed form. Real journey authoring requires:

- Pushback on scope ("is this really one journey or two?")
- Validation that the journey is core, not peripheral
- Verification that triggers, events, and capabilities exist
- Confirmation before any artefact lands on disk

This is agent work, not form work. The pipeline below maps cleanly to the `journey-protocol` skill's five operations.

---

## 2. The five operations

| # | Operation | Slash | Status transition | Output |
|---|---|---|---|---|
| 1 | **Create** (PreJourney) | `/journey-protocol create` | `idea → wizard` | `<slug>.idea.md` (intent stub) |
| 2 | **Spec** (SpecEther) | `/journey-protocol spec` | `wizard → defined` | `<slug>.spec.yaml` (full IR draft, 8-phase conversation) |
| 3 | **Refine** | `/journey-protocol refine` | `defined → ready_impl` | `<slug>.refined.yaml` (validated IR — events bound, capabilities verified) |
| 4 | **Approve** | `/journey-protocol approve` | `ready_impl → implemented` | folder materialized at `docs/journeys/<slug>/` |
| 5 | **Rescue** | `/journey-protocol rescue` | (any) | `RESCUE-PROMPT.md` for the agent context layer |

**Activate** (`implemented → active`) is a separate runtime capability (`journey.publish_mission` + author flip), not a skill operation. **Break / Retire** are runtime states, not authoring steps.

### 2.1 Create — capture intent

One-sentence goal, one actor, one trigger. No steps yet. No commitments.

Refuses if:
- Goal contains "and" (two journeys)
- Project is in Phase 0–2 and proposed journey is not core
- An existing journey already covers this intent

Output: `<slug>.idea.md` with frontmatter (`status: idea`, actor, trigger, one-line goal).

### 2.2 Spec — flesh out

Runs the eight-phase conversation (Introduce → Intent → Scope → Shape → Steps → Metadata → Confirm → Generate). Locks every required IR field. Pushes back on:
- Steps that are actually three sub-actions
- Vague predicates ("user is happy")
- Missing on-timeout policies
- Confidence weights that exceed 0.6 cap

Output: `<slug>.spec.yaml` — the IR draft, schema-valid, semantic-valid.

### 2.3 Refine — bind to reality

Spec is decoupled from running code. Refine binds it:

- Every `trigger.type: dom_event` → confirm selector exists in code (`grep -r "data-journey='<key>'"`)
- Every `trigger.type: network_response` → confirm route exists (`grep -r "<path>"`)
- Every `trigger.type: server_event` → event in `packages/telemetry/src/registry.ts`
- Every step → assertion is deterministic (no LLM calls, no wall-clock)
- Every capability referenced → seeded in `engine_authority_config`
- `prerequisites` → reference real journey ids, not stubs
- Generator pre-flight passes for all five runtime artefacts

Output: `<slug>.refined.yaml` — validated IR with binding-evidence comments (line refs).

### 2.4 Approve — lock + materialize

Final author sign-off. Computes IR hash. Writes immutable canonical IR. Compiles all artefacts into the folder.

Pre-conditions (all must hold):
- Refine passed
- No phantom emits (every emitted event is in registry)
- No phantom consumers (every written row has a named reader)
- C4 authority configured for all four capabilities (`run_dev`, `run_guided`, `publish_mission`, `publish_guide`)
- Every step has author-reviewed coaching text (anti-laziness gate)
- IR does not match auto-derivation byte-for-byte

Side effects:
1. Materializes folder at `docs/journeys/<slug>/` (see §4)
2. Writes `engine_missions` row (`is_active=false`)
3. Inserts authority rows (idempotent CROSS JOIN, ADR-0176)
4. Emits `journey.published` event
5. Updates `journey_version_status` enum row

### 2.5 Rescue — agent context layer

Standalone op, can be run any time post-spec. Authors the agent's context-screen for failure modes:

- "If user stuck at step 4, say X"
- "If validation fails at step 7, say Y"
- "If network_response 5xx, say Z"

Output: `RESCUE-PROMPT.md` inside the journey folder. Loaded by stage-engine when run state transitions to `stuck` or `failed`. Not load-bearing — journey can complete without it. See `10-rescue-prompt-spec.md`.

---

## 3. Roadmap + Mission — paired primitives

Two files, one binding. Defines the **trigger seam** between user and agent.

| File | Owns | Schema |
|---|---|---|
| `ROADMAP.md` | The button. UX entry point. What user clicks to start. | route, button copy (i18n), position in UI, role-gate, journey id |
| `MISSION.md` | The agent trigger. Fires when ROADMAP-button pressed. | mission_id, persona, opening line, stages, success criteria |

### 3.1 Roadmap schema (the button contract)

```yaml
roadmap_id: "R-<JID>"
journey_id: "<slug>"
title:
  en: "Sign up to newsletter"
  no: "Meld deg på nyhetsbrev"
button:
  copy:
    en: "Subscribe"
    no: "Meld på"
  variant: "primary"          # primary | secondary | ghost
  icon: "mail"                # lucide icon name
  position: "hero.cta"        # surface anchor
route: "/landing#subscribe"
visible_for_roles: ["anonymous_visitor"]
visible_when:
  - "feature_flag('newsletter') == true"
fires_mission: "M-<JID>"
```

### 3.2 Mission schema (the agent contract)

```yaml
mission_id: "M-<JID>"
journey_id: "<slug>"
roadmap_id: "R-<JID>"
persona: "lise"               # missions/registry.ts persona key
opening_line:
  en: "Hi! I'll help you sign up — what's your email?"
  no: "Hei! Jeg hjelper deg å melde deg på — hva er e-posten din?"
mode: "sequential"            # mirror of journey.mode
stages:
  - stage_id: "collect_email"
    goal: "Get a valid email"
    success_criteria: "step.form.email_filled fired AND assertion true"
  - stage_id: "confirm_subscribe"
    goal: "Submit + verify success popup"
    success_criteria: "step.api.subscribe_ok received"
voice:
  enabled: false              # journeys with pii_input steps are chat-only
authority_required: ["journey.run_guided"]
```

### 3.3 The pairing rule

`ROADMAP.fires_mission` MUST equal `MISSION.mission_id`. `MISSION.roadmap_id` MUST equal `ROADMAP.roadmap_id`. Approve gate enforces this. A roadmap without a mission is an orphan button. A mission without a roadmap is unreachable code.

---

## 4. The journey folder — 13 files, closed loop

After approve, this layout is materialized. Folder is the **fundament**. Anything outside this folder that claims to describe the journey is wrong.

```
docs/journeys/<slug>/
├── journey.md                  # SOURCE OF TRUTH (frontmatter + step body)
├── ROADMAP.md                  # the button (entry-point UX)
├── MISSION.md                  # the agent trigger (paired with ROADMAP)
├── LIVE-EXPERIENCE.md          # prose flow as user lives it
├── LICENSE.md                  # authority + policy contract (C4 manifest)
├── FLOW.md                     # ★ chronological function list (closed-loop spine)
├── API.md                      # merged: endpoints + events + functions
├── DATAFLOW.md                 # tables touched, data shapes, side-effects
├── COUPLINGS.md                # journeys/missions/services this binds to
├── e2e.spec.ts                 # Playwright — generated from FLOW.md
├── RESCUE-PROMPT.md            # agent context for stuck/failed runs
└── ir/
    ├── journey.yaml            # canonical immutable IR (post-approve)
    └── journey.hash            # sha256 of journey.yaml
```

### 4.1 What each file is

| File | Edit-by-hand? | Generated from | Read by |
|---|---|---|---|
| `journey.md` | ✅ via skill | — (canonical) | Authors, agents, devs |
| `ROADMAP.md` | ✅ via skill | hand-authored | UX, button-renderer |
| `MISSION.md` | ⚠️ generated, then enriched | journey.md auto-derive + author enrichment (anti-laziness gated) | Stage Engine runtime |
| `LIVE-EXPERIENCE.md` | ❌ regenerate-only | journey.md (steps → prose) | Onboarding writers, support, marketing |
| `LICENSE.md` | ❌ regenerate-only | journey.md (capability refs → authority manifest) | Authority loader, security review |
| `FLOW.md` | ❌ regenerate-only | journey.md (steps → chronological list with timing fields) | Dashboard, e2e generator, observability |
| `API.md` | ❌ regenerate-only | journey.md (network_response triggers → endpoints + events) | Frontend devs, backend devs |
| `DATAFLOW.md` | ❌ regenerate-only | journey.md (assertions + side-effects → table writes/reads) | DBAs, security review |
| `COUPLINGS.md` | ❌ regenerate-only | journey.md (`prerequisites`, `terminates`, `exclusive_with`) | Architects |
| `e2e.spec.ts` | ❌ regenerate-only | FLOW.md → Playwright | CI |
| `RESCUE-PROMPT.md` | ✅ via skill | hand-authored | Stage Engine on stuck/failed |
| `ir/journey.yaml` | ❌ immutable | spec → refine → approve | All generators |
| `ir/journey.hash` | ❌ immutable | sha256(ir/journey.yaml) | Approve gate, run snapshot integrity |

### 4.2 What was dropped (and why)

The earlier 19-file proposal had `USER-TEST.md`, `KNOWLEDGE-TEST.md`, `FUNCTION-TEST.md`, plus `runtime/INFERENCE-PATTERN.json` and `runtime/STATE-CARD.json`. Decisions:

- **User/Knowledge/Function-test → dropped.** They are *reports* on data collection (completion rates, retention scores, behavior anomalies), not artefacts the engine compiles. They live in observability dashboards, not in the journey folder. Dashboard reads `engine_event` + `journey_run` + `journey_event` and renders these reports per-journey.
- **Inference-pattern + State-card → kept but moved into `ir/`.** They are runtime artefacts, not authoring outputs. Materialize writes them; runtime reads them. Document in `01-prd.md` §3.

Result: 13 files, every one with a distinct consumer surface.

---

## 5. FLOW.md — closed-loop spine

> ⚠️ **STATUS: INTENT, NOT IMPLEMENTED.** No FLOW.md generator exists. No dashboard reads it. No e2e generator consumes it. Examples below use **illustrative event names** (`page.loaded`, `step.scroll.50`, etc.) that are NOT in `packages/telemetry/src/registry.ts` — adding them would explode ADR-0175's frozen-5-events contract. ADR-0225 (proposed) reconciles whether FLOW.md becomes a registry source or stays as intent-doc only. Until then, treat schema as design artifact.

The chronological function list. One row per observable step in the journey, system + user side. Schema:

```yaml
flow:
  - order: 1
    name: page_load
    actor: user
    type: client
    surface: web
    expected_ms: 200
    event: page.loaded
    consumer: telemetry
    trigger_ref: null

  - order: 2
    name: scroll_hero
    actor: user
    type: dom_event
    selector: "[data-journey='hero-bottom']"
    expected_ms: null
    event: step.scroll.50
    trigger_ref: "step.scroll.50"   # back-ref to journey.md step.key

  - order: 3
    name: click_subscribe
    actor: user
    type: dom_event
    selector: "button[data-journey='subscribe-submit']"
    expected_ms: null
    event: step.form.submitted
    trigger_ref: "step.form.submitted"

  - order: 4
    name: api_subscribe
    actor: system
    type: network
    method: POST
    path: /api/subscribe
    expected_ms: 350
    side_effect: "INSERT subscriber"
    event: step.api.subscribe_ok
    trigger_ref: "step.api.subscribe_ok"

  - order: 5
    name: scrape_enrichment
    actor: system
    type: service
    service: scrapling
    surface: backend
    expected_ms: 2400
    event: step.scrape.completed
    trigger_ref: null

  - order: 6
    name: agent_welcome
    actor: agent
    type: stage
    mission_stage: welcome
    expected_ms: 1200
    event: step.agent.responded
    trigger_ref: null

  - order: 7
    name: success_dialog
    actor: system
    type: ui_render
    component: success_dialog
    expected_ms: 80
    event: step.ui.popup_shown
    trigger_ref: "step.ui.popup_shown"
```

### 5.1 Field meanings

| Field | Required | What it is |
|---|---|---|
| `order` | ✅ | Chronological position. Strictly increasing. |
| `name` | ✅ | Snake-case unique identifier within journey. |
| `actor` | ✅ | `user` / `system` / `agent` |
| `type` | ✅ | `client` / `dom_event` / `network` / `service` / `stage` / `ui_render` / `state_predicate` |
| `event` | ✅ | Registry event name. CI-checked against `packages/telemetry/src/registry.ts`. |
| `expected_ms` | ⚠️ | Target latency. `null` if user-paced. Dashboard yellow-flags > 2× expected. |
| `trigger_ref` | ⚠️ | Back-reference to `journey.md` step.key if this row IS a journey step. `null` for derived rows (page_load, scrape, agent response). |
| `selector` / `path` / `service` / etc. | type-dependent | Specifics per type. |
| `side_effect` | ⚠️ | DB write or external call. Dashboard correlates with `DATAFLOW.md`. |

### 5.2 Closed-loop guarantees

- Every row has an `event` in the registry. CI fails on miss.
- Dashboard subscribes to event stream + renders rows live.
  - Row green: event observed within `expected_ms`.
  - Row yellow: event observed but `actual_ms > expected_ms × 2`.
  - Row red: window elapsed, no event. Run flagged `stuck` / `failed`.
- `e2e.spec.ts` is generated from FLOW.md — one Playwright assertion per row with `trigger_ref != null`.
- Authoring guarantee: refine pass cross-validates `journey.md` steps ↔ FLOW.md `trigger_ref`. Every step.key must appear exactly once. Mismatch = refine fails.

### 5.3 What FLOW.md replaces

- Hand-written E2E tests (drift-prone) — generated from FLOW.md
- Per-team observability dashboards (parallel realities) — single FLOW-driven dashboard
- Ad-hoc latency budgets (forgotten in spec) — `expected_ms` carries the budget
- Untested promise that "events fire" — registry-bound + dashboard-rendered = falsifiable

---

## 6. Lifecycle mapping (13-status authoring → IR enum runtime)

The Mental Model defines 13 statuses for authoring; the database `journey_version_status` enum has a narrower runtime set. Both are correct for their layer. Mapping:

| Authoring status (skill) | IR enum (DB) | Lives in |
|---|---|---|
| `idea`, `wizard` | (no DB row yet) | `<slug>.idea.md` / `<slug>.spec.yaml` |
| `defined` | `draft` | `journey_ir.status='draft'` |
| `ready_impl`, `building`, `review`, `ready_test`, `testing`, `ready_validation` | `draft` (still) | refinements on draft IR |
| `implemented` | `validated`, then `published` | post-approve materialize |
| `active` | `active` | mission `is_active=true` |
| `inactive` | `inactive` | author toggle |
| `broken` | `broken` | engine auto on regression |
| (n/a authoring) | `retired` | superseded by newer journey_version |

See `04-lifecycle.md` for the full state machine + transition rules.

---

## 7. Anti-patterns (refuse at skill level)

- "Make tests directly in the folder" → tests are generated from FLOW.md. Hand-written tests drift. Refuse.
- "Edit MISSION.md without updating journey.md" → MISSION.md is generated, then enriched. Free-edit breaks the regenerate cycle. Refuse.
- "Add a 6th capability for this journey" → capability count is frozen at 4 (ADR-0173). New runtime capability is ADR-class. Refuse at skill level.
- "Skip Refine, go straight to Approve" → Refine binds spec to code. Approve without refine = phantom artefacts. Refuse.
- "Add fields to FLOW.md schema" → schema is part of dashboard contract. Adding fields breaks the dashboard renderer. ADR-class change.
- "Edit `ir/journey.yaml` after approve" → immutable. Edit creates new draft from copy → new journey_version. Skill enforces.

---

## 8. Cross-references

- `01-prd.md` §3, §4, §5 — five runtime artefacts + IR schema + lifecycle
- `02-architecture.md` §3, §4 — DB schema + API contracts
- `03-mental-model.md` §4–§7 — compile pipeline, capability surfaces, fjernkontroll
- `04-lifecycle.md` — full status state machine
- `06-ir-template.md` — authoring template the skill writes
- `07-journey-package-compiler.md` — package compile contract (this doc supersedes the 9-artefact list)
- `10-rescue-prompt-spec.md` — RESCUE-PROMPT.md format
- `11-handoff-capstone.md` — what the campaign already shipped (4 capabilities, IR package, state machine, migrations)
- `packages/admin-onboarding/` — reference example (R-001 / J-001 / M-001 / L-001)

---

## 9. Open items

| Item | Owner | Resolution |
|---|---|---|
| `ROADMAP.md` schema needs ADR (route + button + role-gate is a new contract) | platform | ADR before first refined approval |
| `MISSION.md` schema needs ADR (vs current `engine_missions` row) | stage-engine | ADR co-written with above |
| `FLOW.md` schema needs ADR (CI registry-binding) | platform | ADR before dashboard build |
| `RESCUE-PROMPT.md` needs telemetry event `journey.rescued` | telemetry | registry bump + ADR |
| Authoring statuses 13 → IR enum 7 reconciliation | platform | merge into `04-lifecycle.md` |
| Existing `docs/journeys/JOURNEY-*.md` (~25 files) — closure-deliverable kind, not protocol-package kind | docs | leave; differentiate via path (`docs/journeys/<slug>/` = protocol package; `docs/journeys/JOURNEY-<slug>.md` = closure stub) |

---

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-04-28 | 1.0.0 | Initial. Five-op pipeline + 13-file folder + FLOW.md closed-loop spine. Drops User/Knowledge/Function-test reports per author intent (data collection, not artefact). Merges API + events + functions into one `API.md`. Pairs Roadmap (button) ↔ Mission (agent trigger). |
