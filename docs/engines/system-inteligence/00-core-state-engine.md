---
title: Core State Engine
id: ENGINE_SYSTEM_STATE_CORE
version: "0.1"
status: draft
layer: architecture
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - state-engine
  - state-machine
  - transitions
---

# Core State Engine

## Purpose

Define the canonical state model for Smartout as a deterministic, auditable state machine.

## Design Principle

Smartout is a large state machine.

Every user, agent, and system action must either:

- create a state,
- update a state through valid transitions, or
- be rejected as invalid transition intent.

## Canonical State Domains

1. Session state  
   Mission, agent, onboarding, operational sessions.
2. Journey state  
   Lifecycle from draft through active and deprecate.
3. Task and procedure state  
   Pending, in_progress, blocked, complete, signed_off.
4. Notification state  
   Queued, delivered, acknowledged, escalated, closed.
5. Agent interaction state  
   Proposed, approved, executed, overridden, rolled_back.
6. Readiness state  
   Trainee, active, restricted, inactive.

## Transition Rules

- Each state domain must define explicit allowed transitions.
- Guard conditions are mandatory for critical transitions.
- Invalid transition attempts must be logged with reason.
- Transition side effects must be idempotent.

## Audit Contract

Every transition should record:

- actor (`user`, `agent`, `system`, `integration`)
- previous state
- next state
- trigger/event id
- timestamp
- correlation id for cross-system tracing
