---
title: "Hospitality Operations Cockpit V1 Contract"
id: ADR-0065
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
---

# ADR-0065: Hospitality Operations Cockpit V1 Read/Action Contract

## Context and Problem Statement

Smartout needs a first-screen operations cockpit for hospitality leaders that supports fast, safe decisions during live shifts. Earlier concepts mixed marketing discovery patterns with runtime operations, which risked scope creep, event-noise, and governance drift.

## Decision Drivers

- The first screen must prioritize immediate operational risk and action under time pressure.
- Runtime truth must stay aligned with existing cascade and event engine ownership boundaries.
- Fast actions must remain authority-safe and auditable.
- Web and mobile must consume the same semantic contract.

## Considered Options

1. **Feature catalog first screen** — broad module shortcuts and cards.
2. **Action-first cockpit over runtime truth** — narrow, risk-led first screen with strict contracts.
3. **New cockpit-owned workflow state** — dedicated cockpit state machine and tables.

## Decision Outcome

Chosen option: **"Action-first cockpit over runtime truth"**, because it delivers immediate operator value without introducing parallel workflow state or violating governance/event boundaries.

## Rules & Consequences

- **Good, because** it creates one high-signal first screen for staffing risk, operational/HACCP risk, on-duty progression, guarded broadcast, and unified activity feed.
- **Bad, because** strict V1 constraints defer attractive features (deep analytics, automation breadth, custom layouts) to later phases.
- **Agent Impact:** Any cockpit work must use the shared read/action contract, enforce C4 authority checks for quick actions, and keep event rendering on a normalized/deduplicated envelope.
