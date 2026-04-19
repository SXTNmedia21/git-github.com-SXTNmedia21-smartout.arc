---
title: "Server Actions Scope — Amendment to ADR-0114"
id: ADR_0157
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0157: Server Actions Scope — Amendment to ADR-0114

**Status:** Proposed
**Date:** 2026-04-19
**Council:** 2026-04-19 (semantic conflict between Steward and Supervisor required explicit resolution)

## Context and Problem Statement

ADR-0114 declares Server Actions as the canonical user-initiated mutation primitive. In practice, the dashboard codebase uses TanStack `useMutation` + direct Supabase client for every mutation today (`use-signoff-session`, `use-update-deviation`, `use-send-broadcast`, ~30+ call sites). Council 2026-04-19 surfaced a live tension:

- **Steward position (Phase 3):** ADR-0114 is accepted; all new mutations must be Server Actions.
- **Supervisor position (Phase 3):** Wholesale switch is out of scope for a single PR; rewriting 30+ mutations would blow scope and invite regressions.

Both are correct. What's missing is an explicit scope rule.

## Decision Drivers

- Avoid scope blow-up on every feature PR
- Preserve ADR-0114's intent (Server Actions as canonical)
- Prevent codebase fragmentation where new code stealthily reproduces old patterns
- Enable incremental migration without feature-development paralysis

## Considered Options

### Option A — Retroactive: every PR touching a mutation must convert it to a Server Action
Blocks all feature work behind an unfunded migration.

### Option B — Grandfathered: new mutations must be Server Actions; existing mutations stay until explicitly scheduled for migration
Feature work proceeds. Migration happens deliberately, not ambiently.

### Option C — Indefinite: both patterns allowed, no guidance
Effectively deprecates ADR-0114. Fragments the codebase permanently.

## Decision Outcome

Chosen option: **B — Grandfathered.**

Amendment to ADR-0114:

> **"New mutation paths"** means: any mutation introduced by a feature PR, regardless of whether that feature touches an existing file or creates new ones. If a PR adds a new mutation (a new `*Action.ts` file, a new Zod schema for a POST, or a new TanStack `useMutation` call) — it MUST be a Server Action per ADR-0114.
>
> **"Existing mutation paths"** — TanStack `useMutation` + Supabase-client call sites that existed before ADR-0114 was accepted — remain functional. They are NOT rewritten as part of unrelated feature PRs. Migration is scheduled separately (tracked as its own initiative).

Test for "new mutation path":
1. Does this PR introduce a caller that writes data the previous codebase did not write? → new (Server Action required)
2. Does this PR change the shape or behavior of an existing mutation (new field, new validation, changed side-effect)? → material change (prefer Server Action migration)
3. Does this PR only re-use an existing `useMutation` hook? → existing (TanStack OK)

## Rules & Consequences enforced for Agents

- **Good, because** feature work proceeds without blocking on a migration sprint.
- **Good, because** codebase trend is monotonic: new mutations add to the Server Action side; ratio shifts over time.
- **Good, because** explicit test removes ambiguity when a reviewer asks "does this need to be a Server Action?"
- **Bad, because** codebase will host two mutation patterns indefinitely until migration is scheduled.
- **Bad, because** a PR that "slightly tweaks" an existing hook could be ambiguous — test #2 is judgment-based.
- **Agent Impact:**
  - Build agents implementing features per implementation specs: default to Server Action for any new mutation.
  - Reviewers reject new TanStack mutations introduced by new PRs.
  - Reviewers do NOT reject PRs that extend/touch existing TanStack mutations (scope boundary).
  - Council synthesis must surface this amendment when future councils hit the same Steward-vs-Supervisor tension.

## References

- ADR-0114 — Server Actions Canonical Mutation Primitive (parent)
- Council session 2026-04-19 — `docs/council/COUNCIL-LOG.md`
- ADR-0156 — Day-Control Panel (first consumer of this amendment)
