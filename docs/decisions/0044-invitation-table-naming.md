---
title: "Invitation Table Naming"
id: ADR-0044
status: accepted
layer: decision
created: 2026-03-03
updated: 2026-03-03
---

# ADR-0044: Invitation Table Named `invitation` Not `workspace_invite`

## Context and Problem Statement

Module 1 documentation specifies the invitation table as `workspace_invite`. The actual migration (`00011_employee_invitations.sql`) created the table as `invitation`. The documentation needs to align with the implementation.

## Decision Drivers

- Database naming convention: `snake_case` singular tables
- The table stores invitations (the noun), not workspace-invite actions
- Existing code (Edge Functions, UI) all reference `invitation`
- Renaming the table would require migration + code changes

## Considered Options

1. **Keep `invitation`** — update documentation to match code
2. **Rename to `workspace_invite`** — migration + update all code references
3. **Rename to `workspace_invitation`** — compromise with workspace prefix

## Decision Outcome

Chosen option: **Keep `invitation`**, because it follows the `snake_case` singular convention, all code already uses it, and the `workspace_id` FK column already provides workspace scoping.

## Rules & Consequences

- **Good, because** zero code changes needed, follows naming convention
- **Good, because** `workspace_id` column makes workspace scoping explicit without table name prefix
- **Bad, because** Module 1 documentation must be updated (10+ references)
- **Agent Impact:** Always use `invitation` when referencing this table. The Module 1 document references to `workspace_invite` are outdated.
