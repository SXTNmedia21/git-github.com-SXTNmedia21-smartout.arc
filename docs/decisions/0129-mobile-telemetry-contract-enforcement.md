---
title: "Mobile Telemetry Contract Enforcement — workspace_id and actor_id Required"
id: ADR_0129
status: proposed
layer: decision
created: 2026-04-17
updated: 2026-04-17
---

# ADR-0129: Mobile Telemetry Contract Enforcement

> Companion to ADR-0116 (Runtime Telemetry Standard).

## Context and Problem Statement

Council 2026-04-17 (Supervisor R1 findings) caught silent telemetry corruption on mobile:

- `apps/mobile/src/hooks/mutations/use-punch.ts:141-142` — punch_out emits `workspace_id: null, actor_id: ""` (despite both being available on punch_in via `getProfileContext()`)
- `apps/mobile/src/hooks/mutations/use-swap.ts:60,124-138,187-192` — all 4 swap mutations emit `workspace_id: ""` (empty string)
- `apps/mobile/src/hooks/mutations/use-create-shift.ts:69` — emits `actor_id: ""`

`BaseEvent` types `workspace_id` as `string | null`, so empty string passes TypeScript but breaks downstream `workspace_id IS NOT NULL` filters in `engine_event` routing and JSONB analytics. C1 calibration loops that depend on `activity_trail` provenance cannot trust attribution. C4 governance audit trails are silently corrupted by mobile-originated mutations.

Per Steward synthesis: this is "active poisoning" — every cascade derivation downstream of `activity_trail` makes wrong decisions in proportion to mobile mutation volume.

## Decision Drivers

- ADR-0116 established the telemetry standard but does not enforce surface-level contracts
- Mobile mutations pass type check but emit semantically broken events
- Empty-string fallback is a copy-paste pattern that spreads as new mutations are added
- Catching this in code review has failed (it shipped)
- The fix pattern is already in use — `getProfileContext()` in `use-punch.ts:24-46`

## Considered Options

1. **Code review discipline.** Rejected: failed three times in three different mutations.
2. **Tighten BaseEvent types — disallow empty string.** Partial: catches new code, doesn't catch the bug downstream.
3. **Runtime contract assertion in `emit()` for mobile context.** Chosen.

## Decision Outcome

**Chosen: Option 3 — runtime assertion that throws (in dev) or rate-limit-logs (in prod) when mobile mutations emit broken attribution.**

## Rules & Consequences

### R1. Mobile mutation contract
- Every mobile mutation MUST resolve `workspace_id` (non-null, non-empty string) and `actor_id` (non-empty string) BEFORE calling `emit()`.
- The pattern is `const { workspaceId, actorId } = await getProfileContext()` — copy from `use-punch.ts:24-46`.
- No empty-string or null fallbacks. If context cannot be resolved, the mutation fails fast (do not emit broken telemetry).

### R2. Runtime assertion in `emit()` (mobile context)
- `@smartout/telemetry` adds a development-mode assertion: if `event.workspace_id === "" || event.workspace_id === null` OR `event.actor_id === ""`, throw with a descriptive error pointing at the caller.
- Production mode: rate-limited warning log (one per minute per event name) plus a sentry breadcrumb. Do not throw in production (better corrupt-but-shipping than crash).

### R3. Backfill in current sprint
- Fix `use-punch.ts:141-142`, `use-swap.ts` (4 sites), `use-create-shift.ts:69` in week 1 of remediation.
- Add unit test per fixed mutation: `expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ workspace_id: expect.stringMatching(/.+/), actor_id: expect.stringMatching(/.+/) }))`.

### R4. Lint rule (follow-up)
- ESLint rule that flags `emit({ ... workspace_id: "" })` or `emit({ ... actor_id: "" })` as a hard error.
- Targets: `apps/mobile/src/hooks/mutations/**`, `apps/mobile/src/components/**`.

### Agent Impact
- **Build agents:** when adding mobile mutations, ALWAYS call `getProfileContext()` and pass real IDs to `emit()`. Never use empty-string fallbacks.
- **Supervisor:** mobile mutation PRs are auto-rejected if telemetry assertion isn't testable.
- **Steward:** Trust Gate verdict for mobile mutations references this ADR.

## Consequences

- **Good:** stops active poisoning of `activity_trail` and `engine_event`; restores C1 calibration trust
- **Bad:** dev-mode throws can interrupt local work if `getProfileContext()` is slow or fails — mitigated by clear error message
- **Migration cost:** ~4 hours to fix 6 sites + ~1 day to write the lint rule

---

> Registered in `docs/decisions/0000-decision-log.md`. Companions ADR-0116. Surfaced by Council 2026-04-17.
