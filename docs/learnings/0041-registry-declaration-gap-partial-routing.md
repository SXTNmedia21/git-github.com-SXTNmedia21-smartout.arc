---
title: Learning 0041 — Registry Declaration Gap: emit() Called ≠ Mutation Audit-Covered
id: LEARNING_0041
status: canonical
layer: learning
created: 2026-04-17
updated: 2026-04-17
tags: [telemetry, emit, registry, audit-trail, governance, cascade-invariant]
---

# Learning 0041 — Registry Declaration Gap: emit() Called ≠ Mutation Audit-Covered

## Context

A 2026-04-17 audit claimed 7 governance mutations in `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts` "have no `emit()` call." Phase 2.5 fact-check disproved this — every mutation DOES call `emit()`. The audit claim was false.

But the Supervisor code-trace went deeper. The 7 mutations all emit the event name `"button clicked"`. In `packages/telemetry/src/registry.ts:4887`, `"button clicked"` is declared with `destinations: ["posthog"]` only — no `logger`, no `activity_trail`, no `engine_event`.

Result: the mutations emit. The events reach PostHog. But the cascade-canonical destinations (audit trail, engine trigger) receive nothing. CLAUDE.md's rule — "Every mutation emits. `emit()` drives four destinations" — is honored **in letter** (emit is called) but **violated in spirit** (routing is partial).

Each call site even carries a `TODO(plan-phase-2): event pending — no [X] event registered yet` comment, self-documenting the gap. The audit grepped for `emit(` but didn't read the surrounding comment.

## Discovery

**`emit()` being called is necessary but not sufficient for mutation audit coverage.** The registry's `destinations` array determines which of the four provider pipelines actually receives the payload. Three independent failure modes can produce partial coverage:

1. **Registry-declaration gap (this case)** — event routes to PostHog-only, other destinations silently empty. Audit signal: `"button clicked"`-like generic event names on domain mutations.
2. **Provider silent drop** (L-0038, 2026-04-16) — event declares full routing but a provider (e.g. `writeActivityTrail`) rejects the payload (e.g. missing `properties.entity`). `Promise.allSettled` in emit swallows the rejection.
3. **Event-name typo** — emit uses a name not in registry; falls through to default route (sometimes PostHog-only, sometimes nothing).

The three are distinct. L-0038 covers #2. This learning covers #1.

## Impact

- **PR-review checklist update:** when touching `emit()`, verify the event name exists in registry AND verify the destination set matches the event's classification (mutation → quad-destination; UI interaction → posthog-only).
- **Audit guidance:** future audits of `emit()` compliance must grep BOTH `emit(` invocations AND the event's registry entry. Counting `emit(` calls alone produces a 100% compliance false-positive.
- **ADR-0122 (this session)** registers 7 domain-specific governance events with quad-destination routing and adds a CI assertion that each reaches all 4 provider entry points (per L-0038 pattern).
- **Audit-inflation pattern** (`memory/learning_audit_inflation_pattern.md`) gets a new sub-pattern: **grep-without-context misses in-flight TODO markers.** The code self-documented the gap; the audit missed the self-documentation. Future audits must read surrounding comments when grep-counting.

## References

- ADR-0004 (Unified Telemetry Engine) — original emit contract
- ADR-0122 (this session) — domain-specific governance event registration
- ADR-0114 (Server Actions canonical mutation) — emit contract that this learning clarifies
- L-0038 (Registry Destinations Provider Silent Drop) — sister learning on provider-side silent drops
- `packages/telemetry/src/registry.ts:4887` — `"button clicked"` registry entry
- `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts:104,146,195,237,298,341,380` — self-documenting `TODO(plan-phase-2)` comments
- Council log 2026-04-17 — Supervisor's registry-trace
