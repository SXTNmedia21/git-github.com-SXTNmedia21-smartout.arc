---
title: "Dual-Rescue-System Trap (B3 pattern repeating)"
id: LEARNING_0153
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [phantom-contract, dual-system, rescue, journey-engine, council]
---

# Learning-0153: Dual-Rescue-System Trap (B3 pattern repeating)

## Context

2026-04-28 council on journey-engine doc consolidation — Harness Builder code-traced the proposed `journey.rescued` event + RESCUE-PROMPT.md loader against existing infrastructure. Found:

```sql
-- supabase/migrations/20260406150100_guardian_signal_push_trigger.sql (LIVE since 2026-04-06)
CREATE TRIGGER guardian_signal_push_trigger
AFTER INSERT ON guardian_signal
FOR EACH ROW
EXECUTE FUNCTION dispatch_push_notification('journey_rescue', NEW.entity_id, ...);
```

Existing pipeline: `cron stuck-detector → guardian_signal INSERT → trigger → push_dispatch → mobile`. In production, working.

New proposal: `cron stuck-detector → journey.stuck event → engine_event → stage-engine RESCUE-PROMPT loader → emit journey.rescued → ???`. Zero writers (no stage-engine handler), zero readers (no `journey.rescued` consumer), zero registry entry. Two parallel rescue systems for the same problem.

This is structurally identical to the B3 helpdesk-channel trap (2026-04-13 council): `channel_event` + `channel_ai_policy` shipped in a council with no first consumer for 90 days, until `kanaler-som-helpdesk` 2026-04-19 council finally wired them.

## Discovery

When authors propose new infrastructure for a recognized problem (rescue, fallback, recovery, alerting), they often **don't check whether the problem is already solved**. The reasoning chain:

1. "We need a rescue path for journeys"
2. "Journeys emit `journey.stuck` — let's add a `journey.rescued` event"
3. "Stage-engine should load context for rescue — let's spec a markdown loader"
4. (No step "what does the codebase do TODAY when a journey gets stuck?")

The existing `guardian_signal → push_dispatch` path was found by greping migrations for "rescue" — exactly the kind of negative-grep step the author should have done before authoring.

Pattern signature:
- New spec proposes infrastructure for a domain (rescue, alerting, retry, queue)
- Code-trace finds existing infrastructure for same domain in production
- New infrastructure has no migration plan for / vs deprecation plan for / vs coexistence rationale with existing
- Author wasn't aware of existing path

This is the inverse of "first consumer ships before producer" (B3 trap). Here, the producer exists with a real consumer; the new spec proposes a parallel producer with no consumer.

## Impact

**Process change:** before specifying any new infrastructure for a recognized domain (any noun: rescue, retry, alert, queue, signal, push, fallback), the spec author MUST run:

```bash
grep -r "<domain-noun>" supabase/migrations/ packages/ services/ apps/
```

and explicitly enumerate existing paths in the spec's §"Existing infrastructure" section before proposing new ones. If existing path found, the spec must declare: deprecation plan, coexistence rationale, OR justification for replacement.

**Council reviewer guidance:** for any spec touching infrastructure, ask "what does the codebase do today when this happens?" If reviewers can't answer in 30 seconds, the spec hasn't checked.

**Authoring rule:** new spec contracts in domains with existing infrastructure require either an ADR-class amendment of the existing infrastructure or an explicit "alongside" rationale. Silent parallel systems = guaranteed B3 trap.

## References

- `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` (existing live rescue path)
- `supabase/functions/journey-stuck-detector/index.ts:417` (cron emitter for guardian_signal)
- ADR-0223 (Journey Rescue reconciliation — drops journey.rescued, keeps guardian_signal)
- B3 helpdesk-channel trap (kanaler-som-helpdesk council 2026-04-19, MEMORY.md)
- Council 2026-04-28 (`docs/council/COUNCIL-LOG.md`)
- L-0151 (phantom contracts simultaneously authored)

---
