---
title: "Tool-registry Object.assign collision — silent last-wins on duplicate modelToolName"
id: L-0258
status: canonical
layer: learning
created: 2026-05-14
updated: 2026-05-14
module: agent-harness
tags: [botsson, harness, tool-registry, collision, naming, silent-failure]
---

# L-0258: Tool-registry Object.assign collision

## The Trap

`apps/web/src/app/Botsson/_components/tool-registry.ts:85` uses:
```ts
Object.assign(implementations, set.implementations)
definitions.push(...set.definitions)
```

`Object.assign` is **silent last-wins**: if two bridges register `modelToolName: "listOpenDeviations"`, the second registration overwrites the first implementation. Both definitions remain in the `definitions` array, so the LLM sees duplicate entries — and calls whichever implementation survived the merge (determined by bridge mount order, not by any deterministic rule).

## Confirmed Collisions (2026-05-14, Agent-coord code-trace)

9 duplicate `modelToolName` values across 33 bridges from the 2026-05-14 polish wave:

| Duplicate name | Collision count |
|----------------|-----------------|
| `listOpenDeviations` | 3 |
| `switchStatusFilter` | 2 |
| `listTeams` | 2 |
| `proposeActivateSeason` | 2 |
| `getUnreadCount` | 2 |

Total: 9 collisions across at least 6 distinct bridges. With more pages active simultaneously, collision risk grows proportionally.

## Why It's Invisible

- TypeScript does not catch `Object.assign` key collision at compile time
- No runtime error is thrown — the second registration silently wins
- The LLM receives both `definitions` entries (array push appends, never deduplicates), creating an ambiguous tool array
- Tool invocations route to the surviving implementation, which may be from a different page context than the calling surface

## Immediate Fix — Collision Detector (M3 Sortie)

Add to `tool-registry.ts` registration loop:

```ts
for (const [name, impl] of Object.entries(set.implementations)) {
  if (name in implementations) {
    if (process.env.NODE_ENV === 'test') throw new Error(`Tool name collision: "${name}"`);
    console.error(`[tool-registry] COLLISION: "${name}" already registered. Second registration wins. Check ADR-0325.`);
  }
}
Object.assign(implementations, set.implementations);
```

CI test should register two bridges with a shared name and assert throw.

## Long-term Fix — See ADR-0325

ADR-0325 documents three options (page-scoped prefix / central allowlist / runtime detector) and defers the naming-convention decision to a follow-up council. M3 sortie ships Option C (detector) as unblock; naming convention follows.

## Pre-merge Rule (Interim)

Until ADR-0325 is resolved: **grep `tool-registry.ts` definitions for `modelToolName` values that match any name in your new bridge before merging.** New bridges must use unique names.

```bash
# Check for collision before merging new bridge
grep -r "modelToolName" apps/web/src/app/dashboard/**/_tools/ | awk -F'"' '{print $2}' | sort | uniq -d
```

Non-empty output = collision exists = merge blocker.

## Cross-references

- ADR-0325 (tool-name discipline — naming convention options for collision prevention)
- ADR-0324 (page-tool authority semantics — companion governance ADR)
- Polish-Wave QA Council 2026-05-14 (M3 finding — 9 confirmed collisions)
- `apps/web/src/app/Botsson/_components/tool-registry.ts:85`
