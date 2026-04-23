---
id: ADR-0193
title: "Amendment to ADR-0134: NonEmptyString brand for telemetry actor_id/workspace_id"
status: proposed
date: 2026-04-22
created: 2026-04-22
updated: 2026-04-22
deciders: [pontus, council]
superseded_by: null
amends: ADR-0134
module: MODULE_TELEMETRY
tags: [adr, telemetry, type-safety, branded-types, activity-trail, contract-hub-redesign]
---

# ADR-0193 — Amendment to ADR-0134: NonEmptyString brand for telemetry actor_id/workspace_id

## Context and Problem Statement

Post-merge code-trace of `contract-hub-redesign` (PR #234) found 5 hub event emit sites using the empty-string fallback pattern:

```ts
emit({
  event: "contract.template.opened",
  actor_id: profileId ?? "",        // ← silent telemetry corruption
  workspace_id: workspaceId ?? "",  // ← silent telemetry corruption
  ...
});
```

The `activity_trail` provider (`writeActivityTrail`) rejects events on missing `actor_id` (per L-0038, L-0045, L-0094). With empty strings, the event is silently dropped from `activity_trail` — but typecheck passes because `BaseEvent.actor_id: string` accepts `""` as valid.

ADR-0134 (Mobile Telemetry Contract, 2026-04-17) promised this would be caught by:
1. **Dev-mode runtime assertion** — `if (NODE_ENV === 'development' && !actor_id) throw new Error(...)`.
2. **Lint rule** — flag `actor_id: ... ?? ""` patterns.
3. **Unit tests** — assert `emit()` rejects empty strings.

None of the three ever shipped. The promise existed in the ADR; the enforcement did not. Five web emit sites added in PR #234 took the empty-string fallback path because TypeScript permitted it and no developer-time signal fired.

This is the third council to find the same class of bug (L-0038 → L-0045 → L-0094 → L-0103 phantom-emit briefing-staleness for Edge inserts → this). The pattern is structural: a `string` type accepts the empty string, the empty string fails downstream silently, the developer sees no signal, the bug ships, the bug is caught at post-merge code-trace.

The fix has to be **structural** — make the empty-string assignment fail at type-check time, not at runtime, not at lint, not at unit test. Branded types are the standard answer.

## Decision Drivers

- **Move enforcement from runtime/lint/test to type-check** — three optional gates can all be skipped; one mandatory gate cannot.
- **Stop silent-drop class of bugs** — `activity_trail` provider's silent rejection is ugly, but the deeper bug is the type system permitting the value in the first place.
- **Backward-compatible at the registry level** — `BaseEvent` shape stays the same except for two field types tightening.
- **Forward-compatible with future fail-closed providers** — once `NonEmptyString` is the type, future providers (engine_event, PostHog) get the same protection without further ADR.
- **Dev-mode and prod-mode have different failure modes** — dev should throw loud (catch in tests + local dev). Prod should reject silently from emit (don't crash the request) but log to a separate dead-letter table for observability.

## Considered Options

1. **Lint rule only** — flag `?? ""` and `as string` patterns near `actor_id`/`workspace_id`. Rejected: too easy to disable, ESLint warnings get ignored, and it does not catch all paths (e.g., `actor_id: someValue` where `someValue` is `string` but happens to be `""`).
2. **Runtime assertion only** — keep `BaseEvent.actor_id: string`, add `if (!actor_id) throw` in dev. Rejected: caught only when `emit()` actually fires, which may not happen in development testing of every code path. ADR-0134 already promised this; never shipped.
3. **Branded type `NonEmptyString` + factory `nonEmpty(s)`** — chosen. Type system makes empty-string assignment impossible without explicit factory construction; factory throws in dev, returns sentinel in prod.

## Decision Outcome

Chosen option: **Branded type `NonEmptyString` + factory `nonEmpty(s)`** (option 3).

**Type definition** (in `packages/telemetry/src/types.ts`):

```ts
export type NonEmptyString = string & { readonly __brand: unique symbol };

export function nonEmpty(s: string | null | undefined, field: string): NonEmptyString {
  if (s === null || s === undefined || s === "") {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(`telemetry: ${field} must be non-empty (got ${JSON.stringify(s)})`);
    }
    // Prod: log to dead-letter, return sentinel that downstream providers will reject
    console.warn(`[telemetry] dropping event: ${field} is empty`);
    return "__EMIT_DROPPED__" as NonEmptyString;
  }
  return s as NonEmptyString;
}
```

**`BaseEvent` shape change** (in `packages/telemetry/src/registry.ts`):

```ts
export interface BaseEvent {
  event: string;
  actor_id: NonEmptyString;     // was: string
  workspace_id: NonEmptyString; // was: string
  // ...rest unchanged
}
```

**Emit-site refactor pattern.** Every existing emit site becomes:

```ts
// BEFORE (forbidden — does not type-check)
emit({ ..., actor_id: profileId ?? "", workspace_id: workspaceId ?? "" });

// AFTER, fail-closed (preferred)
if (!profileId || !workspaceId) return;  // skip emit entirely
emit({ ..., actor_id: nonEmpty(profileId, 'actor_id'), workspace_id: nonEmpty(workspaceId, 'workspace_id') });
```

**Dev-mode assertion semantics.** `nonEmpty()` throws in dev — caught by Jest/Vitest tests and by local dev runs. `NODE_ENV=test` also throws (so CI catches the bug regardless of which suite runs).

**Prod-mode degradation.** `nonEmpty()` returns a sentinel string in prod — downstream providers (`activity_trail`, `engine_event`) recognize the sentinel and reject silently with a structured `console.warn`. This preserves existing behavior of "broken event silently drops" but adds observability via a known sentinel value.

**Migration sequencing.** Three steps to avoid breaking the world:

1. **Step A** — add `NonEmptyString` + `nonEmpty()` to `packages/telemetry`, type `BaseEvent.actor_id`/`workspace_id` as `string | NonEmptyString` (union, permissive). Existing code compiles.
2. **Step B** — refactor all emit sites in repo to call `nonEmpty()` or to fail-closed. Council Trust Gate Phase 5 verifies grep `actor_id:.*\?\? ""` returns 0 lines.
3. **Step C** — tighten `BaseEvent` to `actor_id: NonEmptyString` (drop the `string` half of the union). Compile breaks if any site missed in Step B. Land Step C in a separate PR.

## Rules & Consequences

- **Good, because** the empty-string assignment becomes a TypeScript error — caught at type-check, not at runtime, not at lint, not at code review.
- **Good, because** future providers automatically get the same protection — they accept `NonEmptyString` and the type system propagates the invariant up the call stack.
- **Good, because** dev-mode throw + prod-mode dead-letter gives both fast feedback (dev) and graceful degradation (prod).
- **Good, because** the migration is staged — Step A is permissive, Step B is the cleanup, Step C is the lockdown. Low blast radius per step.
- **Bad, because** every existing emit site touches `nonEmpty()` — ~50–80 sites repo-wide. One-time migration cost.
- **Bad, because** branded types are a TypeScript-only feature; runtime values are still strings, so a determined developer can `as NonEmptyString` cast around it. Mitigation: lint rule that forbids `as NonEmptyString` outside the `nonEmpty()` factory.
- **Agent Impact:** Capability tool authors stop writing `?? ""` and start writing fail-closed guards. Council Trust Gate gains a one-line grep: `grep -rn 'actor_id:.*?? ""' packages/ apps/` must return 0. Phase 5 verifies post-PR.

## Alternatives Considered

- **Lint rule only** (option 1) — rejected: optional, easy to disable, doesn't catch indirect assignments.
- **Runtime assertion only** (option 2) — rejected: ADR-0134 already tried this, never shipped, doesn't catch code paths that don't fire emit during testing.
- **Make `activity_trail` provider throw** instead of silently rejecting — rejected: fixes the symptom, not the cause. Empty `actor_id` is a bug at the call site; the provider should keep rejecting silently to avoid crashing requests, but the type system should prevent the call site from constructing the bad event.
- **Replace `string` with structured object `{type: 'profile', id: uuid}`** — rejected as out of scope; would require schema redesign and migrate every consumer. The branded-type fix is the minimal viable.

## Open Questions

- **Sentinel value choice.** `"__EMIT_DROPPED__"` is one option; structured object would be cleaner but breaks the `string` runtime shape. Decide at implementation time; sentinel is fine for v1.
- **PostHog fail-mode.** PostHog accepts any string for distinct_id; sentinel value would create a distinct user "_EMIT_DROPPED_" in analytics. Acceptable noise-floor signal, but worth filtering out at the registry routing level.
- **Other emit fields.** Should `entity_id`, `event` name, etc. also be `NonEmptyString`? Probably yes, but stage as follow-up — this ADR covers the two fields that produced the bug.

## Related ADRs

- **ADR-0134** — Mobile Telemetry Contract (this ADR amends).
- **ADR-0122** — Quad-destination routing (consumer that L-0038 silent-drops affect).
- **L-0038** — Registry destinations provider silent drop.
- **L-0045** — emit() exists but payload broken.
- **L-0094** — Phantom emit contracts recurring.

---

> Council: 2026-04-22 post-merge review of contract-hub-redesign (PR #234). Verdict: APPROVE WITH FIX-FORWARD SORTIE. After writing: register in `docs/decisions/0000-decision-log.md`.
