---
title: "Sibling enums with different value-spaces — text_participation 'interactive' trap"
id: LEARNING_0213
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [learning, migration, enum, sibling-enums, pgtap, ci, channel, value-space-drift]
---

# Learning-0213: Sibling enums with different value-spaces

## Reference (for grep)

- Migration: `supabase/migrations/20260519201000_seed_botsson_direct_channels.sql`
- Enums migration: `supabase/migrations/20260422300000_channel_communications.sql:108,114`
- CI failure: pgTAP job `74344217324` on PR #324 (preview → main, head_sha `fe0acd882`)
- Error: `ERROR: invalid input value for enum channel_ai_text_mode: "interactive" (SQLSTATE 22P02)`
- Surfaced: 2026-05-05 03:10 UTC during preview→main pgTAP gate

## Context

`channel_ai_policy` table has two participation columns with **sibling but
non-identical** enum types:

```sql
text_participation  channel_ai_text_mode  NOT NULL DEFAULT 'disabled';
voice_participation channel_ai_voice_mode NOT NULL DEFAULT 'disabled';
```

Value spaces:

| Enum | Values |
|---|---|
| `channel_ai_text_mode` | `disabled`, `mention_only`, `proactive` |
| `channel_ai_voice_mode` | `disabled`, `listen_only`, `interactive` |

Overlap: only `disabled`. The non-disabled values are **disjoint** by design —
text mode does not have an "interactive" semantic (text is always
keystroke-driven), voice mode does.

Migration `20260519201000_seed_botsson_direct_channels.sql` was authored with
header comment claiming "text+voice = 'interactive'". The header was a
shorthand error — `interactive` was meant for voice only. The body INSERT
nonetheless wrote `'interactive'` to BOTH columns, failing on
`text_participation` at apply-time with SQLSTATE 22P02.

## Why pgTAP caught it (and dev push didn't)

- Local Supabase Local applies migrations once at `db reset`. After that
  reset, the migration body is in the DB schema and subsequent local pushes
  do NOT re-apply it.
- Preview / pgTAP runs `supabase start` from empty + applies all migrations
  fresh. That re-applies the buggy seed and hits SQLSTATE 22P02.
- Net effect: bug shipped silently from feat-branch through dev for ~16
  days. Caught only when preview-DB applied from scratch.

## Pattern signature

Triggers when:
- Two enum types share a name-stem (`channel_ai_*_mode`, `*_participation`,
  `*_status`) but have different value spaces.
- Author writes one literal expecting both columns accept it.
- Migration is `INSERT ... VALUES (...)` (positional binding amplifies the
  miss — no `column = value` keyword pairing to catch the drift).
- Header comment uses summary phrasing that masks per-column distinction.

## Rule

For every migration that writes to two or more columns of sibling enum
types, the body MUST use named `column = value` form (PostgreSQL: explicit
column list at INSERT, or UPDATE-style ON CONFLICT). The literal value for
each column must be cited as living inside that column's specific enum.

Header comments of the form "text+voice = 'X'" are forbidden when the two
columns reference different enum types. Spell out `text='X', voice='Y'`
even when X=Y, so the body and header are both per-column.

## How to apply

- **Author-time:** when adding a new sibling enum (e.g. `*_text_mode` +
  `*_voice_mode`), check `CREATE TYPE` rows for both. If value-spaces
  diverge, leave a one-line comment in the table-definition migration
  spelling out which values are valid for which enum.
- **Migration review:** if INSERT into a table with sibling-enum columns
  uses identical literals for both columns, raise as REJECT — likely
  copy-paste rather than intent.
- **CI:** pgTAP `migrations` suite already catches this at preview gate.
  Document in the suite README that "fresh DB apply" is the reason these
  bugs surface here and not on dev pushes.

## Sibling

- L-0042 (migration timestamps = causal DAG) — same class of "bug ships
  silently because re-apply is rare". Both surface at the preview gate.
- L-0135 (migration headers as primary evidence) — header comments are
  load-bearing during council review; this case shows headers can also
  encode bugs when they over-summarize sibling-enum semantics.

## Resolution

Fixed at dev HEAD (commit during 2026-05-04 cutover work) by changing line
50 of the seed migration from `'interactive'` to per-column values:

```sql
VALUES (
  ch_id,
  ws.workspace_id,
  'proactive',     -- text_participation (channel_ai_text_mode)
  'interactive',   -- voice_participation (channel_ai_voice_mode)
  false,
  false,
  false
)
```

Comment column suffixes added in subsequent commit so future readers can
not repeat the literal-collision read.

## References

- Migration file: `supabase/migrations/20260519201000_seed_botsson_direct_channels.sql`
- Enum source: `supabase/migrations/20260422300000_channel_communications.sql:108,114`
- Failing CI run: https://github.com/SXTNmedia21/smartout.ai/actions/runs/25355650432/job/74344217324
- PR #324 (preview → main) — blocked on pgTAP until fix lands in preview via promote-preview FF
- Related: L-0042 timestamp ordering, L-0135 migration headers as evidence

---

> Registered in `docs/learnings/0000-learning-log.md` 2026-05-05.
