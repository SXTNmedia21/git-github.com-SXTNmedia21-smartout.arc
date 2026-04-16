---
title: "Learning 0033 — Migration attestation completeness ≠ apply-readiness"
status: accepted
updated: 2026-04-16
created: 2026-04-16
module: strike-mcp
tags: [learning, migration, operations, cutover]
---

# Learning 0033 — Migration "attestation complete" does not equal "apply ready"

## Context

Tier 1 Wrightegaarden Bubble→v3 migration via strike-mcp landed 11
attested mappings, 2 intentional drops, 2 manual SQL synthesis files,
3 ADRs (strike-mcp 0004/0005/0006), 5 new transforms, and a framework
fix — all in one ~6-hour session. 393 tests passing. Code-traced
end-to-end by a council reviewer with no findings. By every internal
metric: "Tier 1 done."

The council review surfaced 4 **must-fix-before-apply** items that no
amount of attestation passes would have caught:

1. The strike-auth-bridge tool that ADR-0006 depends on **does not
   exist** — referenced as "future ADR-0007 in another package" but
   has no scope, owner, or deadline.
2. NOT NULL email violation will abort the entire 127-row user_identity
   batch unless the apply script wraps each row in `SAVEPOINT` —
   pattern not yet documented anywhere.
3. Cutover communication artifacts (Norwegian + English templates for
   password reset, swap re-initiation, push notification re-enable)
   were missing entirely.
4. `invitations.json` was missing the `source = 'bubble_migration'`
   constant despite being in the ADR-0108 source-tagged 12-table list
   — dormant today (0 rows) but a latent bug for future tenants.

## The Learning

**Attestation completeness measures the LEFT side of the boundary
(strike-mcp's emit-time correctness). Apply-readiness lives on the
RIGHT side (operational wrappers around the emitted SQL).** They are
different deliverables with different review surfaces.

When migrating between two production systems, the work is split:

| Side | Owner | Verifiable by |
|---|---|---|
| Discovery + mapping + emit | Migration tool (strike-mcp) | Tests, attestations, schema diff |
| Bridge tool + apply script + cutover comms + post-cutover monitoring | Operations / separate workstream | Runbook walkthrough, dry-run on staging, council review |

Conflating these two — declaring victory after attestation — is the
classic "engineering complete, ops not started" trap. The migration
tool ships correct SQL; the SQL never reaches production because the
operational wrapper was forgotten.

## Practical rules

1. **A migration ADR has TWO consumer-readiness checks**, not one:
   (a) "Does the emitted SQL apply cleanly against a fresh schema?"
   AND (b) "Does the operator have everything they need to actually
   run this in production?"

2. **Reference promises like "future ADR-XXX in another package" are
   warnings, not architecture.** Either build the referenced thing or
   block the dependent work. Vapor dependencies don't ship.

3. **Cutover communication artifacts are first-class deliverables.**
   Drafts must exist before any apply, not "after we figure out the
   schedule." Per Pontus's email policy: drafts only, never sent — but
   the drafts themselves are a hard requirement.

4. **Idempotency rules need runtime semantics, not just declarative
   policies.** "Fail loud on collision" is meaningless without
   answering: abort batch, skip row, write failure CSV, or rollback?

5. **The mapping file is a long-lived contract.** If a constant is
   required for any future row of the target table, set it in the
   mapping NOW even if the current sample has 0 rows. The
   `known_empty_source` flag is about today's data; `constant_columns`
   is about tomorrow's row.

## Detection signal

You're in this trap when:

- The plan/PR declares "Tier 1 complete" but no production cutover
  date is set
- The implementation references a "separate tool" or "future ADR" that
  doesn't have a Linear issue or a directory
- The cutover communication is described abstractly ("we'll send a
  reset email") but no draft exists
- The apply script is hypothetical ("the operator runs psql against
  the file")

## What to do

1. **Pair every migration ADR with an "Operations" section** listing:
   bridge-tool dependencies, apply-script behaviors, cutover comms
   artifacts, rollback procedure, retention/PII rules.
2. **Block the migration as "attested but not apply-ready" until the
   operations annex is complete.** Tier 1 strike-mcp is in this state
   today — see ADR-0006 amendment 2026-04-16.
3. **Run a council review at the boundary** — not just on the
   migration tool's correctness but on the apply-side wrappers. The
   first council on Tier 1 surfaced 4 must-fix items that no review
   of strike-mcp alone would catch.

## References

- `~/dev/strike-mcp/docs/superpowers/decisions/0006-auth-bridge-orchestration.md` — amended 2026-04-16 with required apply-script behaviors, login-flow gate, cutover artifacts, bridge timeline
- `~/dev/strike-mcp/docs/migration/CUTOVER-USER-NOTICE.md` — drafted post-council
- `~/dev/strike-mcp/docs/migration/CUTOVER-SWAP-NOTICE.md` — drafted post-council
- `docs/council/COUNCIL-LOG.md` 2026-04-16 entry — full verdict + reviewer findings
- ADR-0107..0111 (wt-3) — the v3 schema-side companions to strike-mcp 0004/0005/0006
