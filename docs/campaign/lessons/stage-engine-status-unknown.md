---
topic: stage-engine-status-unknown
status: active
updated: 2026-05-31T20:30:00Z
created: 2026-05-31T20:30:00Z
supersedes:
---

# Decision lesson — stage-engine-status-unknown

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

In the local SmartOut DB, the `platform` telemetry source is ~99% of all activity_trail rows
(1644 of ~1658) and is a SINGLE repeated event: `engine_world.platform_write` (verb `observed`,
entity `engine_world`), every row with payload `surface_id=stage_engine.dispatch, status=unknown,
surface_type=service`. The stage-engine is writing the same "unknown"-status observation in a
tight loop and never records an OK/healthy status. Treat this as noise/health-probe churn when
reading telemetry — it drowns the ~19 real user events (web source) and any genuine signal. If
stage-engine health matters, the fix is upstream: have it emit a real status (ok/degraded/error),
not a constant `unknown`. Relates to [[live-db-connection-before-db-claims]] (count real, not
estimate) and [[no-ghost-data]] (the dashboard shows this honestly — a warn badge on `unknown`).

## Why

Surfacing per-source detail in the control center exposed that "platform = 1644 events" is not 1644
distinct things happening — it is one health-probe observation repeated, stuck at `status=unknown`.
A naive "platform is very active" read would be wrong; the real human activity is the 19 `web`
events. Knowing this prevents mistaking probe churn for product activity, and flags that
stage-engine's status reporting is effectively a constant, not a live health signal.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T20:30:00Z — initial: platform source = 1644× engine_world.platform_write observing stage_engine.dispatch, status always "unknown" (a stuck health-probe loop), drowning 19 real web events. Read it as noise; real fix is stage-engine emitting a real status, not constant unknown.
