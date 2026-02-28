---
title: "Foundation Data Model"
id: FOUND_DATA_MODEL
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - data-model
  - foundation
  - database
  - schema
tables:
  - user_identity
  - company
  - company_member
  - workspace
  - profile
  - department
  - location
  - team
  - policy
  - protocol
  - season
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Core Data Model

> **Smartout.io** — Foundation documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Sections 2, 3, 4
> **Authoritative source:** SMARTOUT_CORE_ARCHITECTURE_v2.md

---

> This document provides a summary of the Core Data Model. The full detailed schemas with all fields, design decisions, and relationships are in **SMARTOUT_CORE_ARCHITECTURE_v2.md**. Refer to that document for implementation.

## 1. Design Principles

- **If multiple modules need it → Core. If only one module → Module.**
- **Core has no business logic** — only identity, relationships, access control, and governance
- ALL tables (except user, company, company_member) have `workspace_id`
- UUIDs for all primary keys
- `created_at` and `updated_at` on every table

## 2. 11 Core Types

| #   | Type          | Category   | Purpose                                            |
| --- | ------------- | ---------- | -------------------------------------------------- |
| 1   | User          | Identity   | Person. Login. One per human.                      |
| 2   | Company       | Identity   | Legal entity. Can have multiple Workspaces.        |
| 3   | CompanyMember | Identity   | Thin bridge User ↔ Company.                        |
| 4   | Workspace     | Identity   | Physical workplace. Operational unit.              |
| 5   | Profile       | Identity   | Rich bridge User ↔ Workspace. Work identity.       |
| 6   | Department    | Structure  | Fixed organizational division. Never season-aware. |
| 7   | Location      | Structure  | Physical place within a Workspace.                 |
| 8   | Team          | Structure  | Dynamic access group. Season-aware.                |
| 9   | Policy        | Governance | Universal rule. One statement. One standard.       |
| 10  | Protocol      | Governance | Enforcement container for a Policy (1:1).          |
| 11  | Season        | Time       | Operational time context.                          |

## 3. Extension Types

- **Zone** (extends Location) — service section within a Location, season-aware
- **Asset** (extends Location) — equipment and control points, CCP flag for HACCP
- **Position** (extends Department) — job types, assigned per shift not per profile, season-aware

## 4. Governance Model

```
Policy      →  "What must happen"      (the rule)
Protocol    →  "How we comply"         (the umbrella)
  ├── Procedure    →  "Step by step"       (instructions with tasks)
  ├── Routine      →  "When to run"        (scheduled procedure execution)
  ├── Runbook      →  "When things fail"   (escalation workflow)
  ├── Control List →  "Did we do it?"      (verification)
  ├── Knowledge Test → "Do you understand?" (quiz/test)
  └── Confirmation →  "I confirm"          (employee sign-off)
```

## 5. Role & Access Model

Four roles (employee → manager → admin → owner), four statuses (trainee → active → inactive → offboarding), and "leader" as a team attribute — not a role.

```
Total access = Role × Team × Season × Module × Status
```

## 6. Season Concept

Default mode: just work, everything is "default." Advanced mode: create named seasons with teams, policies, points, and leaderboards. Setup the battlefield → click PLAY → compete for points.

---

_For complete field-level schemas, see SMARTOUT_CORE_ARCHITECTURE_v2.md._
_For all enums, see SMARTOUT_APPENDIX_ENUMS.md._
