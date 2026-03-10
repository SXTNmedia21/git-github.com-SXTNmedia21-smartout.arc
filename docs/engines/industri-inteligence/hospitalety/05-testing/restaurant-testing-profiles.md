---
title: Restaurant Testing Profiles
id: ENGINE_TESTING_RESTAURANT_PROFILES
version: "0.1"
status: draft
layer: testing
created: 2026-03-06
updated: 2026-03-06
owner: platform
tags:
  - restaurant
  - testing
  - personas
---

# Restaurant Testing Profiles

## 1) Automated Functional Profiles

### Profile A: Core Operational Flow

- Validate onboarding to active workspace
- Validate schedule lifecycle actions
- Validate core opening/closing controls

### Profile B: Compliance-Critical Flow

- Validate temperature and allergen control routines
- Validate required policy gates and signoff outputs
- Validate deviation flow capture and closure

## 2) Manual Guided Profiles

### Profile C: Shift Leader Real-Use Walkthrough

- Speed and usability under service-like time pressure
- Clarity of tasks and escalation actions

### Profile D: Low-Language Worker Walkthrough

- Comprehension of instructions and controls
- Recovery behavior when user is uncertain

### Profile E: Specialist Quality Walkthrough

- Depth and correctness of advanced workflows
- Confidence in process fidelity and traceability

## 3) A/B Testing Profiles

### Variant Themes

- Instruction density (short vs expanded)
- Interaction mode (visual-first vs text-first)
- Guided sequence mode (strict vs adaptive)

### Segment Requirement

A/B results must be segmented by AI council clusters, not only total conversion.

## 4) Security Testing Profiles

### Abuse and Misuse Scenarios

- Unauthorized action attempts across roles
- Invalid transition attempts in journey lifecycle
- Repeated trigger abuse (spam/loop behavior)
- Stale-context or replay-like action attempts

### Verification Outcomes

- denied actions are observable
- audit trail is complete
- no hidden state corruption

## 5) Required Test Outputs

- pass/fail result
- step-level failure reason
- policy gate status
- persona-segment attribution
- remediation recommendation
