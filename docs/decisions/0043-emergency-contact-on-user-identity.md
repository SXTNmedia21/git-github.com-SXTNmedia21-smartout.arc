---
title: "Emergency Contact on user_identity"
id: ADR_0043
status: accepted
layer: decision
created: 2026-03-03
updated: 2026-03-03
---

# ADR-0043: Emergency Contact Fields on user_identity Table

## Context and Problem Statement

Module 1 documentation specifies emergency contact fields (`emergency_contact_name`, `emergency_contact_phone`, `emergency_contact_relation`) on the `profile` table. However, the implementation placed them on `user_identity`. The question is which table is correct for this data.

## Decision Drivers

- Emergency contact is personal — it doesn't change per workspace
- A user with profiles in multiple workspaces has ONE emergency contact, not one per workspace
- `profile` is workspace-scoped (one per workspace), `user_identity` is global (one per user)
- Norwegian workplace safety law requires employer access to emergency contacts

## Considered Options

1. **user_identity** — store once, shared across all workspaces
2. **profile** — store per workspace, potentially different per job
3. **Separate table** — `emergency_contact` with FK to `user_identity`

## Decision Outcome

Chosen option: **user_identity**, because emergency contact is personal data that belongs to the person, not the job. A cook who works at two restaurants has the same emergency contact regardless of which workspace they're in.

## Rules & Consequences

- **Good, because** no data duplication across workspaces, single update point
- **Good, because** aligns with data model principle: `user_identity` = person, `profile` = workplace role
- **Bad, because** Module 1 documentation must be updated to reflect this
- **Agent Impact:** When accessing emergency contact, query `user_identity` not `profile`. Join through `profile.user_id → user_identity.id` when needed in workspace context.
