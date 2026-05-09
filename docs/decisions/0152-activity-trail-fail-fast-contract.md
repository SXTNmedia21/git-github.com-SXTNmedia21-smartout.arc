---
title: "activity-trail provider must fail-fast on missing IDs, not silently drop"
id: ADR-0152
status: proposed
layer: decision
created: 2026-04-19
updated: 2026-04-19
---

# ADR-0152: activity-trail provider must fail-fast on missing IDs (close L-0038 recurrence)

## Context and Problem Statement

`packages/telemetry/src/providers/activity-trail.ts:22` currently early-returns when `actor_id` or `workspace_id` is falsy. No INSERT is attempted, a `console.warn` is logged, and control flow continues as if the event was recorded. The NOT NULL database constraints on `activity_trail.workspace_id` and `activity_trail.actor_id` therefore never fire — the provider guards before the INSERT reaches the DB.

Two active bugs exploit this silent-drop:
- `apps/mobile/src/hooks/mutations/use-cancel-absence.ts:69-70` emits with `workspace_id: null, actor_id: ""`
- `apps/mobile/src/hooks/mutations/use-confirm-hours.ts:40-41` emits with the same pattern

Both mutations appear to succeed, but no audit row is written. In production, `console.warn` is not read, so the corruption is invisible. This is L-0038 (Botsson R2 activity_trail silent-drop) recurring in a different shape — the provider pattern of "guard-then-early-return" is the underlying defect.

## Decision Drivers

- ADR-0134 Mobile Telemetry Contract says "emit() MUST have non-null, non-empty workspace_id and actor_id." The provider currently enables violations rather than enforcing the contract.
- GDPR/compliance: audit_trail gaps are legal exposure — "we cannot prove who did what from mobile."
- L-0038 recurrence count: 2 (Botsson R2 2026-04-16 + this 2026-04-19). Provider-level fix closes the class.
- Fail-fast is cheaper than silent-drop: surfaces the bug at the caller's test run, not at a GDPR audit six months later.

## Considered Options

1. **Throw on missing IDs in provider** — provider validates, throws `InvalidTelemetryPayload` with file:line of the caller. Forces `emit()` contract discipline.
2. **Keep silent-drop but add Sentry alert** — preserve current behaviour, escalate visibility.
3. **Let the INSERT fail on DB NOT NULL** — remove the provider guard, let Postgres reject.
4. **Fail-fast in dev, silent-drop in prod** — emulate frontend loud-fail patterns.

## Decision Outcome

Chosen option: **"Option 1 — throw on missing IDs"**. The provider becomes the contract enforcer. Rationale:

- Option 2 keeps corruption possible; only shifts the visibility problem.
- Option 3 lets corruption reach the DB driver; error messages are worse than provider-level.
- Option 4 produces environment-dependent behaviour, which is itself a trap.

The thrown error must surface to the caller's test run (CI fails) and to Sentry in production. `emit()` at the top of the pipeline should catch and route to Sentry + console.error so a single bad payload doesn't crash the whole request.

## Rules & Consequences

- **Good, because** every contract violation becomes loud in dev and visible in Sentry in prod. Closes L-0038 recurrence class.
- **Good, because** mobile mutation sites either supply valid IDs via `getProfileContext()` or surface errors at PR review (tests fail).
- **Bad, because** any in-flight caller still using null fallbacks breaks noisily on deploy — mitigated by the companion C1 fix that updates `use-cancel-absence.ts` and `use-confirm-hours.ts` in the same change.
- **Agent Impact:** No change to well-formed `emit()` calls. Agent tools that already resolve context via `getProfileContext()` (server-derived per ADR-0134) continue to work unchanged.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
