---
title: "AI Runtime System Definition v1"
id: AI_RUNTIME_SYSTEM_DEFINITION_V1
version: "1.0"
status: canonical
layer: architecture
created: 2026-03-06
updated: 2026-03-06
author: platform
supersedes:
  - ENGINE_AI_TOOLS_CATALOG
  - ENGINE_AI_INTERACTION_PATTERNS
  - ENGINE_AI_HARNESS
  - ENGINE_AI_GUARD_RAILS
  - ENGINE_AI_CONTEXT_CONTRACT
  - ENGINE_AI_RUNTIME_CONTRACTS
superseded_by: null
depends_on:
  - ADR-0042
tags:
  - ai
  - runtime
  - mission
  - guardian
  - contracts
---

# AI Runtime System Definition v1

This document is the single source of truth for Smartout AI runtime behavior.

It defines one canonical:

- contract envelope
- context envelope
- runtime system model

All other AI engine docs should be treated as reference annexes unless explicitly marked canonical.

---

## 1. Scope and Goals

This specification unifies:

- mission mode and agent mode
- persona behavior and skill execution
- stage engine transitions and guard-rail enforcement
- guardian call supervision lifecycle
- memory, authority, and observability contracts

Design goals:

1. Deterministic runtime decisions
2. Full traceability for safety-sensitive actions
3. Strict workspace isolation
4. One envelope format for all AI turns

---

## 2. Canonical Runtime Model

The runtime always resolves the same model:

1. **Session Runtime**  
   Execution container for a turn (`mission` or `agent` mode).
2. **Mission Contract**  
   Objective, instructions, success criteria, non-goals, escalation policy.
3. **Persona Contract**  
   Specialty, tone, decision posture, refusal policy, intervention style.
4. **Stage Contract**  
   Objective, done criteria, anti-goals, context scope, allowed skills, fallback.
5. **Skill Contract**  
   Capability, schemas, side-effect class, authority requirements.
6. **Guard-Rail Contract**  
   Authority, policy, risk, transparency rails.
7. **Guardian Contract**  
   Runtime supervision for call sessions and high-risk behavior.

In `agent` mode, stage is still required and uses `stage_id = "agent.default"`.

---

## 3. Contract Envelope v1

Every turn must build a `contract_envelope_v1` shape.

### 3.1 Required top-level sections

- `meta`
- `runtime`
- `mission`
- `persona`
- `stage`
- `skills`
- `guardrails`
- `transition_policy`
- `guardian`
- `observability`
- `verification`

### 3.2 Required fields by section

#### `meta`

- `envelope_version` (`1.0`)
- `contract_id`
- `generated_at`
- `trace_id`
- `source`

#### `runtime`

- `mode` (`mission` | `agent`)
- `workspace_id`
- `session_id`
- `turn_id`
- `mission_id` (nullable in agent mode)
- `stage_id` (never null; `agent.default` in agent mode)

#### `mission`

- `objective`
- `mission_instructions[]`
- `success_criteria[]`
- `non_goals[]`
- `escalation_policy`

#### `persona`

- `persona_id`
- `specialty[]`
- `tone_profile`
- `decision_posture` (`conservative` | `balanced` | `assertive`)
- `refusal_policy`
- `intervention_style`

#### `stage`

- `objective`
- `done_criteria[]`
- `anti_goals[]`
- `context_scope`
- `allowed_skills[]`
- `fallback_stage_id` (nullable)
- `stage_overrides` (optional structured overrides)

#### `skills[]`

For each skill:

- `skill_id`
- `capability`
- `input_schema_ref`
- `output_schema_ref`
- `side_effect_level` (`none` | `low` | `medium` | `high`)
- `idempotency`
- `requires_confirmation` (`never` | `conditional` | `always`)
- `authority_requirements`

#### `guardrails`

- `authority`
- `policy`
- `risk`
- `transparency`

#### `transition_policy`

- `order` (must be `["escalate", "fallback", "advance", "stay"]`)
- `retry_budget`
- `deadlock_policy`

#### `guardian`

- `enabled`
- `lifecycle_contract_ref`
- `intervention_rules`
- `degradation_policy`

#### `observability`

- `required_event_fields[]`
- `evidence_rules`
- `pii_redaction_policy`

#### `verification`

- `required_checks[]`

---

## 4. Context Envelope v1

Every turn must build a deterministic `context_envelope_v1`.

### 4.1 Packing order (strict)

1. runtime invariants + safety constraints
2. mission + active stage contract
3. identity + authority snapshot
4. session recency state/events
5. authoritative domain context
6. memory retrieval snippets
7. guardian risk/evidence context (if enabled)
8. tool affordances + output contract reminder

### 4.2 Token budget policy

- invariants/safety: 8%
- mission/stage: 20%
- identity/authority: 10%
- session recency: 15%
- domain context: 20%
- memory snippets: 12%
- guardian evidence: 8%
- tool/output contract: 5%
- reserve headroom: 2%

### 4.3 Freshness and invalidation rules

- `identity`: refresh on auth/session change
- `authority`: TTL 5 minutes or invalidate on authority update events
- `stage/session`: turn-fresh every request
- `domain context`: enforce source timestamp and policy TTL
- `memory`: relevance threshold + recency weighting
- `guardian sentiment`: TTL 2 seconds during active call
- contradictions across trusted sources: force safe non-mutating assistance mode

---

## 5. Turn Loop and Transition System

Unified runtime loop:

`input -> load contract envelope -> build context envelope -> classify -> route skill -> preflight guard rails -> execute -> verify -> transition -> emit events -> respond`

Transition decision priority:

1. `escalate`
2. `fallback`
3. `advance`
4. `stay`

Transition decision payload must include:

- `from_stage_id`
- `decision`
- `to_stage_id` (if changed)
- `reason_code`
- `evidence_refs[]`

---

## 6. Guardian Runtime Lifecycle

Canonical guardian call sequence:

1. `call.created`
2. `call.joined`
3. `guardian.started`
4. `sentiment.monitor.started`
5. `sentiment.alert` (0..n)
6. `call.ended`
7. `guardian.report.submitted`

Sentiment monitoring cadence:

- every 1 second while call is active
- trend-aware scoring, not single-point only
- deduplicate repeated alerts unless severity increases

`call.ended` requirements:

1. stop sentiment monitor
2. flush transcript buffers
3. compute risk summary
4. submit guardian report with evidence

Transcript requirements:

- continuous chunk ingestion while joined
- speaker + timestamp + confidence metadata
- evidence references per alert
- redaction policy applied before output

---

## 7. Authority and Guard-Rail Enforcement

The runtime must enforce four rails at preflight and post-execution checkpoints:

1. **Authority rail**  
   Validate workspace capability permissions and actor authority.
2. **Policy rail**  
   Enforce legal/compliance/business constraints.
3. **Risk rail**  
   Require confirmation/escalation for unsafe outcomes.
4. **Transparency rail**  
   Ensure every decision/action is auditable with evidence links.

Side-effect confirmation policy:

- `none`: no confirmation
- `low`: conditional confirmation
- `medium`: explicit confirmation required
- `high`: escalation + explicit confirmation required

---

## 8. Observability Event Envelope

All runtime and guardian events must include:

- `workspace_id`
- `session_id`
- `mission_id` (nullable in agent mode)
- `stage_id`
- `persona_id`
- `skill_id` (nullable)
- `risk_level`
- `authority_result`
- `transition_decision`
- `event_type`
- `event_timestamp`
- `latency_ms`
- `trace_id`

---

## 9. Verification Gates

Minimum test matrix:

1. mission happy path with stage advancement
2. tool failure fallback flow
3. authority denial on side-effecting skill
4. high-risk action escalation path
5. deadlock detection and recovery
6. guardian lifecycle end-to-end
7. sentiment alert dedupe under noisy input
8. transcript evidence and redaction checks

No production rollout should proceed without this matrix passing.

---

## 10. Governance and Deprecation

### 10.1 Canonical ownership

This document is the canonical AI runtime specification.

### 10.2 Reference annexes (non-canonical)

- `docs/archive/artificial-inteligence/00-tools-catalog.md`
- `docs/archive/artificial-inteligence/01-interaction-patterns.md`
- `docs/archive/artificial-inteligence/02-ai-harness.md`
- `docs/archive/artificial-inteligence/03-guard-rails.md`
- `docs/archive/artificial-inteligence/04-context-contract.md`
- `docs/archive/artificial-inteligence/05-runtime-contracts.md`
- `docs/architecture/agent-framework.md` (implementation map)

### 10.3 Adjacent but separate domain

`docs/architecture/SMARTOUT_STATEMACHINE_BLUEPRINT.md` remains valid for the generic platform state machine domain.  
It is not the canonical AI runtime contract.

### 10.4 Onboarding and cascade ownership boundary

The AI runtime may assist, validate, explain, and enrich onboarding flows, but it does not own workspace runtime truth.

- `/join` intake data is provisional input.
- `/onboarding` bootstrap/finalization establishes authoritative workspace runtime records.
- `/dashboard/setup` is a post-bootstrap completion guide.
- No mission, tool, or runtime hook may create a parallel onboarding state model beside the cascade bootstrap contract.
