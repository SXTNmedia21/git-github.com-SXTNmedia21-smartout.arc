---
title: "ADR-0106: Effective-Dating Strategy for Governance Content"
id: ADR-0106
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
---

# ADR-0106: Effective-Dating Strategy for Governance Content

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

Governance content (`protocol`, `procedure`, `knowledge_test`, `confirmation`) needs answerable "what was active at time T" queries, including for regulator inspections. The initial design proposed per-entity `*_version` tables. During codebase review we discovered `policy` already had `valid_from` / `valid_to` (migration `20260228140000`). Introducing parallel `*_version` tables would fork the pattern unnecessarily.

## Decision Drivers

- A single history pattern across governance content is easier to reason about and query.
- Regulator inspections require "active at time T" semantics, not semver resolution.
- Semver-like labels are still useful for admin communication but should be orthogonal to history.

## Considered Options

- **A.** Add `*_version` tables per entity (original proposal).
- **B.** Extend the existing `policy` pattern (`valid_from` / `valid_to`) to `protocol`, `procedure`, `knowledge_test`, `confirmation`.
- **C.** Event-sourced audit log as the only history.

## Decision Outcome

Chosen option: **B**.

- Add `valid_from DATE` and `valid_to DATE` columns to `protocol`, `procedure`, `knowledge_test`, `confirmation`.
- Semver label stays as `protocol.version TEXT` (admin-set on publish); it is a label, not a history mechanism.
- Deprecation: `UPDATE ... SET valid_to = now(), status = 'deprecated'`.
- "Active at time T" query: `WHERE valid_from <= :t AND (valid_to IS NULL OR valid_to > :t)`.

## Rules & Consequences enforced for Agents

- **Good, because** one history pattern across all governance content (matches existing `policy`).
- **Good, because** regulator queries are a simple SQL predicate, no join to a version table.
- **Bad, because** rows accumulate over time; callers must always filter by effective date.
- **Agent Impact:** NEVER create `*_version` tables for governance content. Effective-dated rows ARE the history. Admin sets the semver label explicitly on publish — do not auto-increment. All "active content" queries MUST apply the `valid_from`/`valid_to` predicate.
