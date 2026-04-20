---
title: "role='owner' enum collides across tables"
id: L-0071
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, enums, naming, schema]
---

# Learning-0071: Adding `'owner'` to role enums creates cross-table semantic collision

## What Happened

During the 2026-04-19 helpdesk council, the steward (Phase 3) proposed extending `channel_member_role` (currently `'member' | 'admin'`) with `'owner'` to represent "the single person responsible for this desk." The supervisor flagged this: `profile.role` already has `'owner'` meaning "workspace owner (the person who pays)." Two different enums would carry the same token with unrelated meanings.

In the Phase 5 synthesis, the steward reversed course. Reviewer and reader would encounter `role='owner'` and need context ("which role? profile.role or channel_member.role?") to interpret correctly. Queries joining profile and channel_member would carry invisible ambiguity. LLM agents generating SQL would conflate the two.

The winning solution: use a dedicated FK column `channel.responsible_profile_id` (nullable, CHECK NOT NULL for desk channel_type) for accountability. Keep `channel_member.role` as `'member' | 'representative'` without adding `'owner'`.

## What We Learned

Short tokens in enums are cheap to write but expensive to interpret when they collide across tables. A token like `'owner'`, `'admin'`, `'active'`, or `'default'` is almost certainly already in use somewhere in the schema; adding it to another enum creates a silent polysemy.

Three failure modes:
1. **Query ambiguity:** `WHERE role = 'owner'` without the table qualifier applies to whichever enum the reader assumed.
2. **LLM confusion:** Prompts like "is this the owner?" or "assign to the owner" cannot be answered without disambiguation.
3. **Convention drift:** One team uses `'owner'` on one table, another team uses it with different semantics on another; code reviewers stop flagging it; the meanings diverge silently.

The pattern is especially risky for "accountability" concepts. Every domain has a notion of "who is responsible," and the temptation is to name that role `'owner'` everywhere. The result is N enums with identical token and N different meanings.

## The Rule

1. **Before adding a role-like value to an enum, grep all enums for the same token.** If any other enum has the token with different semantics, use a different name or a different representation entirely.
2. **Prefer FK columns over enum values for "accountability" concepts.** A FK like `responsible_profile_id` is self-documenting (the column name carries the meaning). An enum value `'owner'` on a role enum offloads meaning to documentation.
3. **If an enum must distinguish "the responsible one," prefer domain-specific tokens.** `channel_desk_lead` rather than `owner`. `procedure_primary_author` rather than `owner`. The extra length is the reader's reward.
4. **Audit existing collisions.** As a one-time sweep, grep `CREATE TYPE` across all migrations for repeated tokens (`'owner'`, `'admin'`, `'active'`, `'pending'`, `'default'`). Each hit is a potential collision to document or rename.

## References

- Council 2026-04-19 — helpdesk, steward self-reversal on `channel_member_role='owner'`.
- `profile.role` enum — includes `'owner'` (workspace owner).
- ADR-0161 — helpdesk ontology, uses `channel.responsible_profile_id` FK for accountability.
- L-0053 — "source term is overloaded; verify semantics" (precedent for cross-column polysemy).
