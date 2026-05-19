---
title: "Phase 2.5 Fact-Check Must Grep ALTER TYPE ADD VALUE, Not Only CREATE TYPE"
id: LEARNING_0313
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [council, fact-check, postgres-enum, methodology, ADR-grade-promotion]
---

# Learning-0313: Phase 2.5 Fact-Check Must Grep `ALTER TYPE ADD VALUE`, Not Only `CREATE TYPE`

## Context

Council review on 2026-05-18 of the Announcement Kind/Tier/Entity-Link design spec. Phase 2.5 fact-check verified the `notification_channel` enum values by grepping `CREATE TYPE.*notification_channel` against `supabase/migrations/*.sql`. The original migration `00006_notification_engine.sql:7` declared values `('push', 'sms', 'email', 'voice')`. The fact-check report stated "No `in_app` value exists."

This claim landed in the spec at §4.1 as a verified fact. The spec's tier→channels mapping dropped `in_app` from all three tiers based on this premise.

## Discovery

Supervisor Phase 3 code-trace surfaced that `in_app` was added to the enum via `ALTER TYPE ADD VALUE` in a later migration: `supabase/migrations/20260324220000_notification_table.sql:7`. The current notification trigger at `20260422310100_channel_message_notification_trigger.sql` uses `ARRAY['push', 'in_app']` as the live channel set for announcement messages. The in-app badge/drawer surface depends on this enum value.

Phase 2.5 fact-check methodology grepped only the canonical `CREATE TYPE` declaration. PostgreSQL allows enum values to be added (not removed) via `ALTER TYPE`. Multiple downstream consumers (8 grep hits at the time of council) depended on `in_app`. Dropping it from the spec's channel array would have silently killed the in-app badge surface across all announcement deliveries.

This is the **3rd occurrence** of a same-class Phase 2.5 grep-narrowness pattern in 3 days:

1. 2026-05-16 chat-whatsapp council — fact-check grepped `"hms` against `site-map.json` returned 0 because keys use `"path"` not `"scope"`. Schema-aware grep would have found 5 entries.
2. 2026-05-17 HMS R1 PM — fact-check Phase 2.5 site-map "ZERO entries" claim; reality 5 entries (wrong-scope-key trap).
3. 2026-05-18 Announcement council — fact-check grepped only `CREATE TYPE notification_channel`, missed `ALTER TYPE ADD VALUE 'in_app'`.

3-occurrence threshold reached for ADR-grade promotion per skill convention.

## Impact

**Promoted to mandatory pre-flight check in run-council Phase 2.5:**

When a fact-check claim concerns an enum's value set:
1. `grep "CREATE TYPE.*<enum_name>" supabase/migrations/*.sql`
2. `grep "ALTER TYPE.*<enum_name>" supabase/migrations/*.sql`
3. Concatenate the canonical `CREATE` values with all `ADD VALUE` mutations.
4. Report the FULL current set, not the originally-declared set.

**Generalized rule:** Phase 2.5 fact-check methodology must capture _accreted state_, not _original declaration state_. The pattern extends beyond enums:

- Tables: grep both `CREATE TABLE` and `ALTER TABLE ADD COLUMN` / `DROP COLUMN`.
- Functions: grep `CREATE OR REPLACE FUNCTION` (later versions supersede; original signature may be obsolete).
- Indexes: grep both `CREATE INDEX` and `DROP INDEX`.
- Sequences: grep both `CREATE SEQUENCE` and `ALTER SEQUENCE`.

**Council infrastructure update:** Update `~/.claude/skills/run-council/SKILL.md` Phase 2.5 fact-check briefing template to include this generalized rule. Update `council_meta.md` Process Improvements section to record this 3rd-occurrence promotion.

## References

- ADR-0369, ADR-0370, ADR-0371 (Announcement council derivatives)
- Council session: `docs/council/COUNCIL-LOG.md` entry 2026-05-18 Announcement Kind/Tier/Link
- Sibling occurrences: chat-whatsapp 2026-05-16, HMS R1 PM 2026-05-17
- Falsifying evidence: `supabase/migrations/20260324220000_notification_table.sql:7`
- Sibling pattern: L-0276/0278 (chat-whatsapp grep-narrowness), L-NEW-3 in council meta (HMS site-map scope-key trap)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
