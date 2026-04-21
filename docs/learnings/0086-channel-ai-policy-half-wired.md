---
title: "channel_ai_policy plumbing ≠ feature — 'reuse' is misleading when only one consumer reads one mode"
id: LEARNING_0086
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [channel-ai-policy, dead-infra, reuse-trap, scope-honesty]
---

# Learning-0086: channel_ai_policy plumbing ≠ feature — "reuse" is misleading when only one consumer reads one mode

## Context

The `channel_ai_policy` table has existed since `20260422300000_channel_communications.sql:387`. ADR-0160 (2026-04-19) flagged it as "dead-infra with a 90-day clock (deadline 2026-07-13)" — the table existed, but no code consumed it.

The Progressive Channel council (2026-04-20) proposed to "reuse `channel_ai_policy.text_participation`" for Botsson policy (off / mention_only / proactive). On the surface this closes the dead-infra deadline cheaply. Code-trace of the actual read path told a different story.

## What is actually wired

**One consumer:** `packages/ai/src/capabilities/communication/tools.ts:163-168` calls `isAiAllowedInChannel(supabase, channel_id, 'text', !is_proactive)` inside the `send_message` tool. That's it. No other production code path reads `channel_ai_policy`.

**The proactive path returns true unconditionally:** `packages/ai/src/capabilities/communication/policy.ts:85-89`:

```typescript
function isProactiveAllowed(...): boolean {
  // TODO: wire proactive channel check
  return true;
}
```

No listener reads `text_participation='proactive'` to auto-respond. No trigger on `channel_message.insert` invokes Botsson. No Edge Function watches the table. The enum value `'proactive'` is storage-only.

**No writer exists:** Not a single admin UI in production writes a row to `channel_ai_policy`. The table is populated only by test fixtures and one-off SQL.

## The trap

Proposing to "reuse `channel_ai_policy`" sounds like a low-cost integration ("pay one storage cost, get Botsson-behavior-per-channel for free"). The plumbing is there. But the read-side listener, write-side admin UI, and enforcement logic for the most-interesting enum value are all absent.

## The learning

**Before citing "reuse X" as a scope reducer, verify:**

1. **Who writes the row?** Grep for `.insert(` or `.upsert(` on the table in `apps/*/src/**` + `packages/*/src/**`. Zero hits = "reuse" includes building the writer.
2. **Who reads the row?** Grep for `.from('<table>').select(`. Count distinct call sites. One site = "reuse" is single-consumer, not general infrastructure.
3. **Is every enum value / flag consumed?** For each value in the enum/boolean space, grep for the value literal. Unused values are storage-only and need listeners.
4. **Does the read path actually do something with the value?** Open every consumer and verify branching. A function that returns `true` unconditionally is not "wired" just because it takes the parameter.

**Honest framing in ADRs/specs:**

- ❌ "Reuse `channel_ai_policy.text_participation` for Botsson policy."
- ✅ "Reuse `channel_ai_policy.text_participation` as storage for Botsson policy. Phase 2 will build the listener that acts on `'proactive'` (currently unwired — returns true unconditionally at `policy.ts:85-89`). Phase 1 adds the first admin UI writer."

The honest framing prevents downstream surprise when Phase 2 estimates balloon because "just wire the existing listener" turns out to be "build the listener."

## Why this surfaced

The Progressive Channel council's AI-coord reviewer traced the read path and found the proactive branch unwired. Without that trace, Phase 2's Botsson-inngang scope estimate would have assumed "listener exists, just configure it" — likely a 1-week underestimate of a 3-week task.

## Related

- ADR-0087 (Komm thin display layer + dead-infra deadlines)
- ADR-0160 (channel_event projection — successfully wired the OTHER half of the dead-infra)
- ADR-0165 (Progressive Channel — this learning motivated honest Phase 2 scope estimate)
- L-0067 (dead-infra has a clock — complementary angle)
- L-0085 (dispatcher ENTITY_PK gap — same family of "plumbing exists, enforcement doesn't")
