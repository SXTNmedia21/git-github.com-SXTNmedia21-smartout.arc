---
title: "AI Runtime Runbook"
id: AI_RUNTIME_RUNBOOK
version: "1.0"
status: canonical
layer: architecture
created: 2026-03-06
updated: 2026-03-06
author: platform
depends_on:
  - AI_RUNTIME_SYSTEM_DEFINITION_V1
tags:
  - ai
  - runtime
  - operations
  - guardian
---

# AI Runtime Runbook

This runbook defines the minimum operational procedures required to keep the AI runtime healthy in production.

## 1. Scope

Applies to:

- `services/stage-engine`
- `packages/ai`
- guardian call lifecycle and sentiment monitor
- authority and policy enforcement paths
- runtime observability envelopes

## 2. Core Health Checks

Check these in order:

1. Stage Engine health endpoint responds.
2. Session creation and retrieval succeed.
3. Contract envelope is emitted per turn.
4. Context envelope pack completes without overflow.
5. Tool execution path returns structured results.
6. Guardian events flow for call sessions.

## 3. Incident: AI Runtime Unhealthy

Symptoms:

- request timeouts
- missing responses
- repeated retries without resolution

Actions:

1. Verify Stage Engine process health and recent deploy changes.
2. Check provider availability and timeout saturation.
3. Confirm contract envelope generation is not failing validation.
4. Downgrade to safe non-mutating assistance mode until recovered.

## 4. Incident: Guardian Alert Storm

Symptoms:

- high rate of `sentiment.alert`
- duplicate interventions in short windows

Actions:

1. Validate 1-second loop cadence is running once per call session.
2. Confirm deduplication rule is applied.
3. Inspect transcript chunk quality and confidence metadata.
4. Temporarily raise alert threshold if operationally necessary.
5. Keep escalation for direct compliance/legal breach signals enabled.

## 5. Incident: Authority Misconfiguration

Symptoms:

- unsafe skills executed without expected confirmation
- blocked low-risk actions for authorized users

Actions:

1. Inspect workspace authority config for affected capability.
2. Validate side-effect level and confirmation policy mapping.
3. Re-run preflight checks with trace-level logging.
4. Restore last known-good authority configuration if needed.

## 6. Incident: Context Packing Overflow

Symptoms:

- context truncation breaks quality
- contradictory source usage

Actions:

1. Enforce Context Envelope v1 packing order.
2. Trim low-priority memory snippets first.
3. Keep mission/stage and safety invariants intact.
4. If contradictions remain, switch to clarification-first safe mode.

## 7. Incident: Event Schema Drift

Symptoms:

- missing `trace_id`, `stage_id`, or authority result fields
- dashboards or audits show partial records

Actions:

1. Validate event payload against canonical envelope fields.
2. Block high-risk execution if observability fields are missing.
3. Patch emitter mapping and replay affected events when possible.

## 8. Mandatory Recovery Gate

Before incident closure, verify:

1. mission mode turn completes with valid envelope
2. agent mode turn completes with `stage_id = agent.default`
3. side-effecting skill enforces authority and confirmation policy
4. guardian lifecycle reaches `guardian.report.submitted` for a test call
5. event envelope includes required audit fields

## 9. Escalation Matrix

- `low`: on-call engineer
- `medium`: on-call + AI runtime owner
- `high`: on-call + AI runtime owner + security/compliance owner

High severity includes:

- compliance risk signals
- missing auditability for executed actions
- authority bypass behavior
