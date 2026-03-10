---
title: AI Guard Rails
id: ENGINE_AI_GUARD_RAILS
version: "0.1"
status: reference
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
superseded_by: AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - ai
  - safety
  - authority
---

# AI Guard Rails

> Reference snapshot only: canonical guard-rail and guardian contracts live in `docs/architecture/AI_RUNTIME_SYSTEM_DEFINITION_V1.md`.

## Purpose

Define mandatory safety boundaries for AI behavior across all autonomous and assisted flows.

## Guard-Rail Layers

1. **Authority rails**  
   Enforce workspace capability permissions.
2. **Policy rails**  
   Enforce legal, compliance, and operational constraints.
3. **Risk rails**  
   Block or escalate high-risk actions.
4. **Transparency rails**  
   Require traceability for AI decisions and actions.

## Guardian Runtime Role

The Guardian is a runtime safety supervisor for live call sessions.

- It does not replace the primary agent.
- It observes connection state, transcripts, sentiment, and risk signals.
- It can send intervention guidance to the active operator/agent.
- It can escalate or block behavior based on configured risk policy.

## Call Lifecycle Contract (Guardian)

The guardian contract is event-driven and must follow this sequence:

1. `call.created`  
   Initialize guardian connection context, session state, and risk profile.
2. `call.joined`  
   Start guardian runtime, register transcript stream, and activate monitoring services.
3. `guardian.started`  
   Guardian enters active supervision mode for the call.
4. `sentiment.monitor.started`  
   Sentiment watcher starts with 1-second evaluation cadence.
5. `sentiment.alert` (zero or more times)  
   Guardian sends intervention instructions with rationale and urgency.
6. `call.ended`  
   Stop sentiment monitor, finalize transcript analysis, and close active supervision.
7. `guardian.report.submitted`  
   Emit final report with timeline, alerts, interventions, and recommendations.

## Runtime Event Expectations

Each guardian runtime event must include:

- `workspace_id`
- `session_id`
- `call_id`
- `mission_id` (if mode is mission)
- `stage_id` (if mode is mission)
- `persona_id`
- `risk_level` (`low` | `medium` | `high`)
- `event_type`
- `event_timestamp`
- `source` (`guardian` | `agent` | `operator` | `system`)
- `trace_id` for end-to-end observability

## Transcript Handling Contract

Guardian transcript processing must be explicit and auditable:

- ingest transcript chunks continuously from call join to call end
- classify chunks for sentiment, compliance, and escalation risk
- preserve per-chunk metadata (speaker, timestamp, confidence)
- mark transcript-derived alerts with evidence snippets
- avoid exposing secrets or protected content in intervention messages
- store references to transcript ranges used by each decision

## Sentiment Monitor Rules

- monitor interval: every 1 second while call is active
- evaluate trend, not only point-in-time score
- suppress duplicate alerts unless severity increases
- auto-escalate when risk crosses threshold for configured window
- stop immediately on `call.ended` or connection termination

## Intervention Message Contract

Every guardian intervention message should include:

- current risk assessment
- what signal triggered the alert
- recommended maneuver/reaction for the operator
- confidence level
- whether escalation is required now

## Mandatory Rules

- No high-impact mutation without authority check.
- No hidden autonomous actions in critical workflows.
- No unsafe recommendation without confidence disclosure.
- No loss of auditability for AI-triggered actions.

## Escalation Model

- `low risk` -> assist or nudge
- `medium risk` -> require explicit user confirmation
- `high risk` -> escalate to manager/admin or block

Guardian-specific escalation rules:

- repeated medium-risk alerts in short window -> escalate to high-risk path
- direct legal/compliance breach signal -> immediate high-risk escalation
- missing transcript coverage during active call -> degrade to safe mode and notify operator

## Override Rules

- Human override is always available for non-legal constraints.
- Override actions must be logged with actor and reason.

## Shutdown and Final Report

When `call.ended` is received:

1. Stop the sentiment cron loop.
2. Flush remaining transcript buffers.
3. Compute call-level risk summary and intervention effectiveness.
4. Submit guardian report with:
   - call timeline
   - alerts raised
   - interventions sent
   - escalation actions
   - unresolved risks
   - post-call recommendations
