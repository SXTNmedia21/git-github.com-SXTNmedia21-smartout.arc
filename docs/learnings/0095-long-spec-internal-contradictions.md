---
title: "Long specs accumulate internal contradictions between revisions"
id: LEARNING_0095
status: canonical
layer: learning
created: 2026-04-21
updated: 2026-04-21
tags: [spec-review, consistency, review-gate]
---

# Learning-0095: Long specs accumulate internal contradictions between revisions

## Context

Journey Runner Suite spec revised v1.5 → v1.6 between councils. 1052 lines. Reviewers read in chunks (targeted offset/limit reads). When reviewers reconvened for Phase 5 synthesis, three contradictions emerged that no single reviewer saw in isolation:

1. §state model declared `journey_event` is dev-tracking only (per L-0023). Line 176 lifecycle table still wrote `journey_event` as runtime state.
2. §storage declared `packages/journey-ir` canonical. Another section referenced `packages/ai/src/journey`.
3. §ordbok/glossary declared `ready_test` as a new enum value. §state model declared `ALTER TYPE journey_status ADD VALUE 'ready_test'` — the value already exists.

Each contradiction was caught by a different reviewer looking at a different region. None would have been caught by any single reviewer.

## Discovery

Specs over ~500 lines cannot be reviewed in a single pass by a single reviewer without chunk-reads. Chunk-reads produce local correctness but miss cross-section consistency. When the author revises, new content in section X contradicts old content in section Y that the author did not re-read.

First recorded occurrence of this pattern as a named learning. Not yet promoted to SKILL.md (promotion rule: 3rd occurrence). Note only.

## Impact

- Author checklist for specs over 500 lines: single-pass consistency scrub before submitting to council re-review. Scrub means one author reading the full spec top-to-bottom without interruption, flagging every claim that repeats across sections.
- Council briefing for re-review should include: *"If the spec is over 500 lines AND has been revised, confirm the author has completed a single-pass consistency scrub since the last revision."*
- Phase 2.5 fact-check already catches some of this (verifies external claims). It does NOT cross-check internal claims. Consider adding: "For each revision, diff the old/new spec; for every changed section, grep other sections for references to the same concept."

## References

- ADR-0171 (packages/journey-ir) — resolves package path contradiction.
- ADR-0172 (journey_version_status enum) — resolves enum collision + `journey_event` contradiction.
- L-0023 (dev-tracking vs runtime-state separation) — the rule the spec violated on line 176.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
