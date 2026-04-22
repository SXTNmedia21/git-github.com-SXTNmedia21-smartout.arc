---
title: "Mock-surface trap expands linearly with additive schema — new columns need mock audit before migration lands"
id: LEARNING_0087
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [testing, supabase-mocks, schema-divergence, additive-migrations]
---

# Learning-0087: Mock-surface trap expands linearly with additive schema — new columns need mock audit before migration lands

## Context

L-0081 (2026-04-20) established that Supabase chainable-proxy mocks echo any column name, hiding schema-divergence from unit tests. That learning was written while fixing a single column typo (`created_at` vs `started_at`).

The Progressive Channel council (2026-04-20) proposed adding 5 new columns across two tables:

- `channel.helpdesk_enabled`
- `channel.privacy_mode`
- `channel.domain_tags` (later rejected)
- `channel.parent_channel_id` (later rejected)
- `channel_message.engine_state_id` (later rejected)

Code-trace confirmed that the existing mock at `packages/ai/src/capabilities/helpdesk_query/__tests__/tools.test.ts:24-56` would pass unit tests for every one of these columns **regardless of whether the migration actually added them** — because the proxy mock returns whatever you configure, without schema validation.

## The expansion pattern

L-0081 was about ONE typo. This learning is about the **trap surface scaling with every additive migration**:

- Migration adds N columns → mock's happy-path expands by N shapes → N new ways for schema-divergence to slip through tests.
- Migration adds M table → mock gains M new `.from()` targets → M new drift paths.
- Migration renames column → old consumer's test passes against both old name (via mock) and new name (via real schema) — silent dual-truth window.

**At current mock shape, every PR adding ≥1 column to a helpdesk-consumed table re-opens the L-0081 trap.** Not as a one-time bug but as a recurring vulnerability.

## The learning

**New columns consumed by capability tools require a mock audit BEFORE migration lands, not after.**

Concretely:

1. **Before writing the migration SQL:** identify every test file that mocks `supabase.from('<table>')` for the affected table. These become the audit target.
2. **Replace chainable-proxy mocks with schema-validated stubs.** Options:
   - **Zod schema per table.** Mock validates that `.select('...columns...')` columns all exist in the Zod shape for that table. Generate the Zod from `packages/supabase/src/database.types.ts`.
   - **Typed-generic mock.** `supabase.from<TableName>(...)` where TableName is a literal type pulled from generated types. TypeScript catches unknown column names at compile time.
   - **Real-DB integration tests** for the affected capability. Higher cost, highest confidence. Reserve for security-critical paths.
3. **PR gate:** every new column in a migration requires a checklist entry in the PR description: "mock audited at [file:line], columns added to stub."
4. **Block acceptance of the migration** until the audit checklist is complete. This is an L-0042-level blocker — mock blindspot can silently ship broken tool behavior to production.

## The fix path for Progressive Channel Phase 1A

ADR-0165 specifies that the Zod-validated mock replacement is a **Phase 1A.1 prerequisite** — done during the 48h soak before 1A.2 backfill starts. If the replacement is not shipped, 1A.2 does not start. This is the first time the mock replacement is ship-blocking rather than "nice to have."

## Why this surfaced

The council noticed that the proposed Progressive Channel changes would repeat the exact L-0081 pattern at 5× the surface area. The difference from L-0081 (which described the trap) is operational: L-0087 treats every additive migration as an opportunity for the trap to recur, and makes mock-audit a migration prereq rather than a test-hygiene recommendation.

## Related

- L-0081 (the original observation — single-column, reactive)
- L-0085 (dispatcher ENTITY_PK silent gap — same family of test-mock blindspots)
- L-0086 (channel_ai_policy half-wired — related "plumbing exists, verification doesn't")
- ADR-0165 (Progressive Channel — first ADR to make mock replacement a ship-block, Phase 1A.1 prereq)
