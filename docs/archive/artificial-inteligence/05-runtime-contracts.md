---
title: AI Runtime Contracts
id: ENGINE_AI_RUNTIME_CONTRACTS
version: "0.1"
status: reference
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
superseded_by: AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - ai
  - runtime
  - contracts
  - guardian
---

# AI Runtime Contracts

> Reference note: Canonical runtime specification moved to `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`.
> This file is a historical snapshot and should not introduce new normative runtime rules.

## Purpose

Define implementation-ready contracts for mission runtime, persona behavior, stage transitions, skill gating, guardian events, and verification.

## Canonical Type Contracts

### MissionDefinition

Required fields:

- `mission_id`
- `mode` (`mission` | `agent`)
- `mission_instructions`
- `success_criteria`
- `persona_id`
- `stages[]`
- `default_escalation_policy`

### PersonaDefinition

Required fields:

- `persona_id`
- `name`
- `specialty`
- `tone_profile`
- `decision_posture` (`conservative` | `balanced` | `assertive`)
- `refusal_policy`
- `intervention_style`

### StageDefinition

Required fields:

- `stage_id`
- `objective`
- `done_criteria[]`
- `anti_goals[]`
- `context_scope`
- `allowed_skills[]`
- `fallback_stage_id` (optional)
- `escalation_policy` (optional override)

### SkillDefinition

Required fields:

- `skill_id`
- `capability`
- `input_schema`
- `output_schema`
- `side_effect_level` (`none` | `low` | `medium` | `high`)
- `idempotency`
- `authority_requirements`
- `requires_confirmation` (`never` | `conditional` | `always`)

## Stage Transition Contract

Transition decisions are deterministic and ordered by priority:

1. `escalate`
2. `fallback`
3. `advance`
4. `stay`

Evaluation inputs:

- done criteria status
- risk state
- authority result
- tool outcome
- retry budget
- deadlock detector status

A transition decision must always include:

- `from_stage_id`
- `decision` (`stay` | `advance` | `fallback` | `escalate`)
- `to_stage_id` (if changed)
- `reason_code`
- `evidence_refs`

## Risk and Confirmation Matrix

- `side_effect_level = none`
  - confirmation: never
  - escalation: never
- `side_effect_level = low`
  - confirmation: conditional
  - escalation: on repeated anomaly
- `side_effect_level = medium`
  - confirmation: always (unless pre-approved automation policy exists)
  - escalation: required on failed confirmation or risk spike
- `side_effect_level = high`
  - confirmation: always with explicit actor
  - escalation: mandatory before execution

## Guardian Runtime Contract

Mandatory event sequence:

1. `call.created` -> initialize guardian connection context
2. `call.joined` -> bind transcript stream and activate guardian runtime
3. `guardian.started` -> supervision active
4. `sentiment.monitor.started` -> 1-second cadence loop started
5. `sentiment.alert` -> intervention guidance emitted as needed
6. `call.ended` -> monitor stopped, buffers flushed
7. `guardian.report.submitted` -> post-call report persisted

If an expected event is missing or out of order:

- mark runtime state as degraded
- block high-risk actions
- notify operator and observability pipeline

## Transcript and Evidence Contract

Guardian decisions must be traceable to transcript evidence:

- transcript chunk IDs must be preserved for each alert
- every `sentiment.alert` includes one or more evidence refs
- final guardian report includes summarized transcript-backed findings
- redaction rules must apply before model-visible or operator-visible output

## Observability Event Schema

All mission and guardian events should emit:

- `workspace_id`
- `session_id`
- `mission_id` (nullable in agent mode)
- `stage_id` (nullable in agent mode)
- `persona_id`
- `skill_id` (nullable when no skill used)
- `risk_level`
- `authority_result`
- `transition_decision`
- `latency_ms`
- `event_type`
- `event_timestamp`
- `trace_id`

## Minimum Verification Matrix

Required runtime tests before production rollout:

1. mission happy-path with stage advancement
2. tool failure with fallback transition
3. authority denied for side-effecting skill
4. high-risk action requiring escalation
5. deadlock loop detection and safe recovery
6. guardian call lifecycle from `call.created` to `guardian.report.submitted`
7. sentiment alert deduplication under noisy transcript input
8. transcript redaction and evidence linking validation
