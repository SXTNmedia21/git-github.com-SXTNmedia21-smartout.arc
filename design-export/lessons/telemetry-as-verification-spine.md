---
topic: telemetry-as-verification-spine
status: active
updated: 2026-06-01T02:10:00Z
created: 2026-05-31T14:02:28Z
supersedes:
---

# Decision lesson — telemetry-as-verification-spine

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

In a full-strict anti-fabrication campaign, **telemetry is the verification spine, not one of several equal prerequisites.** Frame it as the wayfinder: every interactive element fires a registered event; every gate verifies the event landed in the activity/event store; therefore "did this control actually do something real?" stops being a judgment call and becomes a database query. A fully-telemetered app is a self-proving app.

Consequences for ordering: register ALL mutation events FIRST (Phase-0 item #1, before any UI is ported), and treat login/auth as the second proof surface (the e2e gate must log a real seeded user in, so working login is the entry-gate for proving everything else). The other prerequisites ([[wiring-campaign-gate-prerequisites]]: lint-as-error, seed-as-hard-pre-gate) exist to PROTECT this spine — they are not co-equal with it.

**Emit-contract (the await rule — graded per call-site kind):**

| Call-site kind                                           | Emit pattern                                                 | Why                                                                                                                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mutation** (insert/update/delete via a gated hook)     | `await emit(...)` inside `onSuccess`                         | The DB-assert proof depends on the row being written before the gate reads it; a fire-and-forget emit can lose the event and produce phantom telemetry that the gate then can't verify. |
| **Navigation / view / click intent** (no backend effect) | `void emit(...).catch(noop)` — fire-and-forget, non-blocking | There is no mutation to confirm; blocking render on a nav-event emit is wrong. A dropped nav event is a coverage miss, not a correctness bug.                                           |

So fire-and-forget is **acceptable and correct** for nav/view/click events, but **forbidden** for mutation call-sites — those must await in `onSuccess`. Established on the oversikt port (2026-06-01): all 11 emits were `void emit().catch(noop)`, which passed because oversikt has NO real mutation call-sites (its 3 mutation hooks are missing-backend findings, so the CTAs emit intent only). For a domain WITH real writes, the verifier must check that every mutation emit is awaited, not fire-and-forget.

## Why

The interactive_contract gate and the no-mock gate both ultimately resolve to "a real backend effect happened, observably." Telemetry is the cheapest, most uniform observation of that effect across every domain — one mechanism that proves buttons, forms, and mutations alike. Anchoring the whole verification strategy on it (rather than per-domain bespoke assertions) makes the gates uniform and the proof queryable. Pontus's framing (2026-05-31, Smartout redesign campaign): "hvis telemetry fungerer så vet vi at ting fungerer." Build the compass before walking.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T14:02:28Z — initial: telemetry = verification spine/wayfinder; register-all-events-first + login-as-entry-gate; lint+seed prerequisites protect the spine, not co-equal.
- 2026-06-01T02:10:00Z — added emit-contract await rule (graded per call-site kind): mutations MUST `await emit()` in onSuccess (DB-assert depends on it); nav/view/click events MAY `void emit().catch(noop)` (no effect to confirm, must not block render). Surfaced on oversikt port: 11 fire-and-forget emits passed BECAUSE oversikt has no real mutation call-sites (3 mutation hooks are missing-backend findings); the verifier must enforce await on mutation emits in any domain WITH real writes.
