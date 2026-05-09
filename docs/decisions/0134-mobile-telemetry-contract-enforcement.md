---
title: "Mobile Telemetry Contract Enforcement — workspace_id and actor_id Required"
id: ADR-0134
status: accepted
layer: decision
created: 2026-04-17
updated: 2026-04-22
accepted: 2026-04-18
---

# ADR-0134: Mobile Telemetry Contract Enforcement

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

## §3.7 — Projection and state-change triggers do not double-emit (ADR-0187 amendment, 2026-04-22)

Per ADR-0187, `department_session.status` transitions (and any D6 aggregate state-change column with business-event meaning) emit exclusively via their dedicated DB trigger. Application code — Server Actions, TanStack mutation `onSuccess`, Edge Function inline inserts — MUST NOT emit state-change events directly.

**Rules:**
- State-change events (e.g., `"session pending_signoff"`, `"session closed"`) are fired by AFTER UPDATE triggers. Emit-registry subscribes via pg_notify or engine_event consumer and fans out to PostHog/Logger/activity_trail.
- Non-state-change events (form submissions, user actions like `"handoff submitted"`, `"reconciliation submitted"`) remain emitted from Server Actions / mutation hooks via `emit()` with `getProfileContext()`-resolved IDs per §2.
- Projection triggers (append-log → denormalized column patterns) MUST NOT emit domain events — the originating mutation already did.

**Rationale:** prevents the triple-emitter pattern (2026-04-18 Wave 2 council finding) where multiple writers produce divergent event names for the same real-world event (`department_session.pending_signoff` from trigger, `session.pending_signoff` from Server Action — observed in `department_session_lifecycle` step 6 + `trg_session_pending_signoff` + `signoff-session-action.ts:102-127`).

**Scope:** applies to all D6 aggregate state columns; D1 (schedule) and other dimensions retain existing emit patterns until separately reviewed.

---

> Registered in `docs/decisions/0000-decision-log.md`. Companions ADR-0116. Surfaced by Council 2026-04-17. Amended 2026-04-22 by ADR-0187 (§3.7).
