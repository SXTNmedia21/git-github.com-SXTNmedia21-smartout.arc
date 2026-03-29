---
title: "Tasks and Routines"
id: MANUAL_05_EN
version: "1.0"
status: canonical
layer: manual
created: 2026-03-24
updated: 2026-03-24
author: claude
slug_en: tasks-and-routines
tags:
  - manual
  - tasks
  - routines
  - operations
  - english
---

# Tasks and Routines

> Operational sessions, hooks, task types, governance chain and sign-off — this is how SmartOut manages daily operations.

---

## Operational sessions

An **operational session** (Department Session) is the daily operative container per department. All tasks, notes and handovers happen within an operational session.

Operational sessions are generated automatically from the department's schedule and follow a fixed lifecycle:

| Status                | Description                                         |
| --------------------- | --------------------------------------------------- |
| **Upcoming**          | Planned, not yet started                            |
| **Active**            | In progress — tasks can be performed                |
| **Awaiting sign-off** | All tasks completed, waiting for manager's approval |
| **Closed**            | Signed by manager, concluded                        |
| **Missed**            | No one showed up — automatically registered         |

---

## Session hooks

Hooks are time-based triggers that fire tasks at specific points in an operational session:

| Hook type     | When it fires  | Typical use                              |
| ------------- | -------------- | ---------------------------------------- |
| **pre_open**  | Before opening | Temperature check, cleaning, preparation |
| **open**      | At opening     | Welcome routines, daily briefing         |
| **scheduled** | Scheduled time | Mid-day cleaning, temperature logging    |
| **pre_close** | Before closing | Last orders, tidying up                  |
| **close**     | At closing     | Cash reconciliation, closing routines    |

> Hooks are defined in the department's setup and can be linked to procedures, routines or checklists.

---

## Task types

SmartOut has six task types that cover different needs:

### Procedure

A step-by-step instruction to be followed in order. Each step can contain text, images or video.

**Example:** "How to open the restaurant" — 8 steps from unlocking to turning on the music.

### Routine

A recurring operational task performed regularly. Routines are linked to hooks for automatic activation.

**Example:** "Refrigerator temperature check" — Performed at opening and at 14:00.

### Runbook

A multi-step operational process for complex situations. More detailed than a procedure.

**Example:** "Handling a food allergy incident" — Step-by-step guide with escalation points.

### Checklist

A checklist that verifies that routines and runbooks have been performed correctly. May require photo documentation.

**Example:** "Kitchen closing control" — 12 items that must be confirmed.

### Knowledge test

A quiz that tests understanding of a policy. Used in onboarding and periodic training.

### Confirmation

A digital signature to confirm that content has been read and understood. Anti-ghosting mechanism.

---

## Governance chain

All tasks are organised in a governance chain:

```
Policy (the rule)
  +-- Protocol (the enforcement)
        |-- Procedure (learn: step-by-step)
        |-- Routine (do: recurring task)
        |-- Runbook (do: multi-step process)
        |-- Checklist (verify: checklist)
        |-- Knowledge test (prove: quiz)
        +-- Confirmation (confirm: signature)
```

> This structure ensures that every operational task can be traced back to the rule it enforces.

---

## Sign-off and approval

When an operational session is completed, the system requires sign-off:

1. **The shift supervisor** completes all tasks and notes
2. **The system** verifies that all required tasks have been performed
3. **The manager** approves the session with a digital signature
4. **The session** is closed and archived

Sign-off history is stored permanently and is available in reports and during inspections.
