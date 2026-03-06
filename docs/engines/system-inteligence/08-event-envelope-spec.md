---
title: Event Envelope Specification
id: ENGINE_SYSTEM_EVENT_ENVELOPE
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - events
  - contracts
  - telemetry
  - guardian
---

# Event Envelope Specification

## Purpose

Define one canonical envelope for all runtime events across journey execution, process orchestration, guardian interventions, and verification.

## Envelope Schema

```json
{
  "event_id": "uuid",
  "event_name": "step_completed",
  "event_version": "1.0",
  "occurred_at": "2026-03-06T10:15:00.000Z",
  "workspace_id": "uuid",
  "correlation_id": "uuid",
  "causation_id": "uuid|null",
  "source": {
    "domain": "journey|process|guardian|notification|agent|integration|test",
    "service": "web|edge-function|stage-engine|guardian-sweep|scheduler|worker",
    "component": "string"
  },
  "actor": {
    "type": "user|agent|system|integration",
    "id": "uuid|string|null",
    "role": "employee|manager|admin|owner|service|null"
  },
  "subject": {
    "kind": "journey|roadmap|mission|license|session|step|protocol|notification|process|test_run",
    "id": "uuid|string"
  },
  "state": {
    "from": "string|null",
    "to": "string|null"
  },
  "severity": "debug|info|warning|critical",
  "payload": {},
  "tags": ["string"],
  "provenance": {
    "channel": "ui|api|voice|chat|cron|webhook|internal",
    "request_id": "string|null",
    "trace_id": "string|null"
  }
}
```

## Required Field Rules

- `event_id`, `event_name`, `event_version`, `occurred_at`, `workspace_id`, `correlation_id` are mandatory.
- `state.from` and `state.to` are required for transition events.
- `actor.type` is mandatory even when actor id is unknown.
- `payload` must be a versioned object contract per `event_name`.

## Canonical Event Families

1. Journey execution  
   `step_started`, `step_completed`, `data_saved`, `journey_completed`
2. Verification and tests  
   `test_started`, `test_passed`, `test_failed`, `gate_blocked`
3. Guardian and autonomous intervention  
   `stall_detected`, `whisper_sent`, `escalation_triggered`, `auto_advance_applied`
4. Mission and license controls  
   `mission_stage_changed`, `license_gate_checked`, `license_gate_failed`, `license_gate_passed`
5. Process orchestration  
   `process_started`, `process_step_started`, `process_step_completed`, `process_completed`

## Example: Step Completed

```json
{
  "event_id": "6f2f8f2e-7163-4f8f-8b4b-7457f878e251",
  "event_name": "step_completed",
  "event_version": "1.0",
  "occurred_at": "2026-03-06T10:15:00.000Z",
  "workspace_id": "b0000000-0000-0000-0000-000000000000",
  "correlation_id": "d4b45ec9-5f4f-47f7-a993-6c79f2d2a115",
  "causation_id": "0f4cb26a-5fb9-44f2-b3b5-7f29eb65caac",
  "source": {
    "domain": "journey",
    "service": "web",
    "component": "OnboardingWizard"
  },
  "actor": {
    "type": "user",
    "id": "a4fd0b5b-b95c-4d63-8f69-7fcf40fa31d4",
    "role": "admin"
  },
  "subject": {
    "kind": "step",
    "id": "R-001.step.business.confirm-company"
  },
  "state": {
    "from": "in_progress",
    "to": "completed"
  },
  "severity": "info",
  "payload": {
    "duration_ms": 18200,
    "data_written": ["company", "location"],
    "validation_result": "passed"
  },
  "tags": ["roadmap:R-001", "journey:J-001", "module:onboarding"],
  "provenance": {
    "channel": "ui",
    "request_id": "req_91dbe3",
    "trace_id": "trace_8f17d6"
  }
}
```

## Storage and Projection

- Raw envelope events should be append-only in event storage.
- Projections (journey status, process state, guardian scorecards) must be derived from envelope streams.
- Event consumers must be idempotent using `event_id` and `correlation_id`.

## Compatibility and Migration

- Breaking payload changes require `event_version` increment.
- New optional fields are backward-compatible in same version.
- Consumers must ignore unknown fields.
