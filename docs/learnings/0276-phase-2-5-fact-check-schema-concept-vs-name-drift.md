---
id: L-0276
title: "Phase 2.5 fact-check fails on schema concept-vs-name drift"
status: accepted
date: 2026-05-16
discovered_in: chat-whatsapp Phase 3 priority council (2026-05-16)
related_adrs: [ADR-0338]
tags: [council, fact-check, schema, phase-2-5, haiku]
---

# Phase 2.5 fact-check fails on schema concept-vs-name drift

## Discovery

Chat-WhatsApp Phase 3 priority council (2026-05-16). Phase 2.5 fact-check
(haiku) was tasked with verifying 4 schema claims in the briefing. It grepped
for literal claim strings and reported VERIFIED MISSING:

| Claim | What haiku grepped | Reality |
|---|---|---|
| `replied_to_message_id` | literal column name | Schema has `reply_to_id` (same concept, different name) |
| `channel_settings` | literal table name | Settings live as columns on `channel` table |
| `channel_role` | literal enum/column | Schema has `channel_member_role` enum |
| `channel_mute` | literal concept | Schema has `channel_member.is_muted` + `muted_until` columns |

All 4 were reported VERIFIED MISSING. Supervisor (sonnet) caught all 4 in
Phase 3 by reading the schema concept-first rather than name-first. The
synthesis was delayed and nearly produced a false architectural verdict.

## Why this happens

Haiku Phase 2.5 operates on exact string matches. Schema concepts and their
column/table names frequently differ:
- Spec says "replied_to" → actual column `reply_to_id`
- Spec says "channel settings" → actual: JSONB columns on parent table
- Spec says "role" → actual: `channel_member_role` (prefixed enum)
- Spec says "mute flag" → actual: `is_muted` boolean + `muted_until` nullable

The phase-2.5 prompt as written does not require the fact-checker to:
1. Build a synonym list for each claimed concept before grepping
2. Check whether the concept lives on a different table or as columns
3. Distinguish "missing feature" from "feature under different name"

## Fix — Phase 2.5 prompt requirements

Add these rules to the Phase 2.5 fact-check prompt:

```
For each schema claim:
1. SYNONYM CHECK: List 2-3 alternative column/table names for the concept
   before grepping (e.g. "replied_to" → grep: reply_to_id, replied_to_message_id,
   parent_message_id, in_reply_to)
2. COLUMN-ON-OTHER-TABLE CHECK: If a claimed table is missing, grep for the
   concept as a column on the parent/related table
3. REPO-WIDE CHECK: If a claimed feature is missing from the primary location,
   grep repo-wide before declaring absent
4. VERDICT FORM: "VERIFIED PRESENT (under name X)" or
   "VERIFIED MISSING (synonyms checked: Y, Z)"
```

## Supervisor counter-detection rule

When haiku Phase 2.5 returns "VERIFIED MISSING" on multiple schema items
(≥2 in a single briefing), Phase 3 Supervisor reviewer MUST re-verify at
least one "MISSING" claim concept-first before synthesis. Pattern signature:
haiku reports ≥2 missing schema concepts → sonnet re-verifies → both confirmed
present under different names = Phase 2.5 prompt gap, not real absence.

This has occurred twice (2026-04-15 governance/training, 2026-05-16 chat-whatsapp).
Promote to `run-council` SKILL.md Phase 2.5 hard rule on 3rd occurrence.

## Relationship to other learnings

- L-0147 (Chair self-reversal pattern) — same dynamic: first-pass reviewer
  generalizes from names, code-tracer falsifies with concept-first trace
- L-0102 (briefing granularity vs schema reality) — same class
- ADR-0338 (visual verification) — same class: checking spec names is not
  checking resolved/actual values
