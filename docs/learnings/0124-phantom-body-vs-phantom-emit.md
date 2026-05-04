---
id: L-0124
title: "Phantom body vs phantom emit — two shapes of the same anti-pattern"
status: accepted
date: 2026-04-23
type: pattern
created: 2026-04-23
updated: 2026-04-23
related_adrs: [ADR-0196, ADR-0197]
module: journey-engine
tags: [phantom, capability, emit, telemetry, body-vs-emit, council]
---

# L-0124 — Phantom body vs phantom emit: two shapes of the same anti-pattern

## Context

L-0094 ("phantom emit contracts recurring") was logged 2026-04-21 after four occurrences where an emit declaration (registry entry, payload schema, downstream consumer) existed without a producer, or vice-versa. Phase 2.5 council fact-check was promoted to grep the emit registry before every journey plan's Phase 3.

On 2026-04-23, a 5th occurrence surfaced inside campaign `journey-engine`. The new occurrence has a **different shape** than the prior four: the emit exists. The registry entry exists. The payload is correct. The producer exists in code. **But the code that produces the emit also returns `{ok:true}` to the caller without performing the declared domain side effect.**

Example — `packages/ai/src/capabilities/journey/tools.ts:299-344`:

```
execute: async ({ journey_version_id }, ctx) => {
  if (!ctx.workspaceId || !ctx.profileId) { return MISSING_CONTEXT; }
  const runId = crypto.randomUUID();
  await emit({
    event: "journey run_started",
    workspace_id: ctx.workspaceId,
    actor_id: ctx.profileId,
    properties: { journey_version_id, run_id: runId, capability: "journey.publish_mission", surface: "admin", ... },
  });
  return JSON.stringify({ ok: true, run_id: runId, note: "S1.4 skeleton — engine_missions insert ... lands in M4" });
},
```

The emit says "publish_mission run started." The caller receives `ok:true`. Telemetry dashboards show a successful publish. **Zero rows land in `engine_missions`.** Zero MDX files exist. The agent (L-0118 context) invokes this tool, hears success, moves on. L-0118's E2E test in `journey.capability.test.ts:128-146` asserts `ok:true` + `run_id` is a UUID — both true — and passes.

## Discovery

**Phantom contracts have two shapes, not one.** They must be named and gated separately.

**Mode 1 — Phantom emit.** Registry or schema declares an event; code does not produce or consume it. Caught by grep of registry vs call sites.

**Mode 2 — Phantom body.** The emit fires correctly. The registry entry is real. The producer call site exists. But the producer does nothing else — the capability returns success telemetry for work it did not perform. **Grep of the registry alone passes.** L-0118's minimal-shape test passes. Only a trace from emit → expected side effect catches the gap.

The two modes look like siblings at the ADR level ("phantom contracts") but require different enforcement:

- Mode 1: grep the registry and call sites (existing Phase 2.5).
- Mode 2: grep each capability tool's `execute()` body for the shape — `emit(run_started) → return({ok:true, note:/.*skeleton|lands in M_/})` without an intervening write.

Mode 2 is more dangerous because every standard gate passes: types compile, tests green, emit fires, registry is consistent. The only failure signal is the absence of a row in the downstream table, which nothing asserts.

## Impact

**Mode 2 gate added to `close-feature.sh`** (implementation owned by ADR-0196 Invariant 11 + ADR-0197 Mode 2 enforcement):

```
# Phantom-body gate: every capability tool that emits run_started must either
# write to a table OR return ok:false not_implemented before the emit.
PHANTOM_BODIES=$(awk '
  /emit\(.*run_started/ { start = NR }
  start && NR - start <= 40 && /return.*\{.*ok:.?true/ && !body_has_write { print FILENAME ":" start; body_has_write = 0 }
  /\.insert\(|\.update\(|\.delete\(|writeFile|fetch\(.*method: [\"]POST/ { body_has_write = 1 }
' packages/**/capabilities/**/tools.ts)
[ -n "$PHANTOM_BODIES" ] && echo "❌ Phantom body: $PHANTOM_BODIES" && exit 1
```

**Tests must assert the artefact, not the return shape.** A capability tool E2E test that asserts `ok:true` without asserting a downstream row is **insufficient** (see L-0125 for the test-quality learning derived from this same council).

**Phase 2.5 council fact-check gains a Mode 2 check:** for every capability named in any plan, read the `execute()` body and verify it contains either a DB write, a file write, a network call with a mutating method, OR an explicit `ok:false, error:'not_implemented'` return. A body that emits and returns `ok:true` without any of the above is flagged FALSE before Phase 3 dispatch.

**Detection retrospective.** L-0094's four prior occurrences were all Mode 1. Mode 2 was invisible because no audit traced from emit-site to intended side effect. The 5th occurrence, which added Mode 2, also promoted L-0094 to ADR-0197 — the promotion is the class definition, and this learning is the distinction rule.

## References

- L-0094 — promoted to ADR-0197 after 5th occurrence.
- L-0117 — grep-based structural claims must be code-traced (adjacent principle).
- L-0118 — every capability tool requires E2E Trust Gate test (adjacent gate).
- L-0125 — test spirit vs letter (same-council sibling).
- ADR-0196 — Campaign Invariants 11/12/13 (journey-engine-scoped enforcement).
- ADR-0197 — Phantom contracts promotion (class definition).
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23.
- `packages/ai/src/capabilities/journey/tools.ts:299-392`.
- `packages/ai/src/capabilities/journey/__tests__/journey.capability.test.ts:128-146`.

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
