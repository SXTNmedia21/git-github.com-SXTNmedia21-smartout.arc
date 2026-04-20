---
title: "Post-implementation trace catches what per-file review misses — 4-layer model"
id: LEARNING_0051
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [council, review, trace, post-implementation, process]
---

# Learning-0051: Post-implementation trace catches what per-file review misses

## Context

Tier 2 v1.5 of strike-mcp was reviewed twice by council on 2026-04-17:

1. **Pre-implementation mapping council** (morning) — 4 reviewers + Steward
   synthesis on 11 mapping questions. Verdict APPROVE WITH CHANGES with 7
   ADRs proposed. Per-file review passed.

2. **Post-implementation code review** (afternoon) — 4 reviewers again, but
   with payload-trace + schema-constraint verification required. Agent
   Coordinator (code-tracer) found `SQLSTATE 23505` on `unique_policy_protocol`
   that per-file review missed. Supervisor found `auto_assign_protocols`
   trigger-order gap that Agent-Coord's column-trace missed.

The same team, the same code, the same data — but the second review used a
*different lens* and found bugs the first review did not. This generalizes
Learning 0023 ("per-file review is insufficient") into a 4-layer model.

## Discovery

**Each reviewer sees a different failure mode.** A complete review needs
all four layers. No single reviewer catches everything.

### Layer 1 — Per-file semantic review
- Who: reviewers reading the code in isolation
- Catches: variable naming, logic errors, bad imports, obvious typos
- Misses: anything requiring cross-file context (schema, triggers, RLS)

### Layer 2 — Column-level payload trace
- Who: code-tracer reviewer with file:line citations
- What: pick one payload field, follow it from source → transform → SQL →
  target column; verify type, NOT NULL, enum validity, FK resolvability
- Catches: schema column mismatches, NOT NULL violations, enum typos,
  FK chain breaks, UNIQUE constraint conflicts
- Misses: trigger side-effects, capability-consumer assumptions

### Layer 3 — Trigger/constraint semantics
- Who: Supervisor or database-focused reviewer
- What: grep for `CREATE TRIGGER`, `CHECK`, cross-migration schema
  extensions (ALTER TABLE ADD CONSTRAINT); check trigger firing semantics
  (ON INSERT vs UPDATE, WHEN clauses)
- Catches: trigger order problems, cascade side-effects, constraint
  combinations across migrations (e.g. UNIQUE + NOT NULL together)
- Misses: runtime capability behavior

### Layer 4 — Capability-consumer trace
- Who: system-agent-coordinator or domain reviewer
- What: grep `packages/ai/capabilities/` for readers of the affected tables;
  check if migration data shape assumptions break consumers
- Catches: AI tools assuming JSONB shape, user-facing rendering of
  placeholder names, authority divergence when subset of users see rows
- Misses: schema-level failures (that's layer 2's job)

## Impact

**For council briefings (topic type = post-implementation):** the briefing
MUST assign all 4 layers to reviewers, not just layers 1-2. Code-tracer
mandate from SKILL.md is layer 2; Supervisor should be explicitly asked
for layer 3 (triggers + cross-migration constraints); system-agent-coordinator
should do layer 4 (capability consumers).

**For the council SKILL.md:** add to the "Post-Implementation Briefing
Addendum": *"Assign one reviewer per layer. No single reviewer catches
everything."*

**For migration work specifically:** the 4-layer model is how to avoid
Learning 0033's "attestation ≠ apply-readiness" failure mode — per-file
review gives false confidence that disappears when the SQL meets the real
schema + triggers + RLS + consumers.

**Caught in this session:**
- Agent-Coord (layer 2) caught UNIQUE constraint violation.
- Supervisor (layer 3) caught trigger-firing-order gap (existing profiles
  miss new protocols without backfill).
- Frontend (layer 4) caught user-facing placeholder names leaking.
- Steward (layer 1) caught draft-filter asymmetry on handbooks.

All four were real. Removing any one reviewer would have shipped a bug.

## References

- Skill: `.claude/skills/run-council/SKILL.md` — post-implementation mode
- Related: Learning 0023 (per-file review insufficient), Learning 0033
  (attestation vs apply-readiness), Learning 0035 (UNIQUE invalidates
  bookkeeping pattern)
- Case study: `docs/council/COUNCIL-LOG.md` 2026-04-17 Tier 2 v1.5 entry

---
