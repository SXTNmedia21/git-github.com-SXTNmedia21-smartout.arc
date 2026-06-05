---
topic: live-dashboard-verify-source-emits
status: active
updated: 2026-05-31T16:00:00Z
created: 2026-05-31T16:00:00Z
supersedes:
---

# Decision lesson — live-dashboard-verify-source-emits

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

When a "live" telemetry dashboard shows no movement, verify the **source is emitting** before
touching the feed pipeline. Check `max(created_at)` / row delta over the last N minutes and whether
the emitting app/worker is actually running — a frozen newest-timestamp means nothing is being
written, not that the DB→json→panel wiring is broken. Prove the pipeline independently by injecting
one timestamped row and watching it surface; if it surfaces, the problem is upstream (no emitter).
Read counts with `count(*)` against the live connection, never planner estimates — see
[[live-db-connection-before-db-claims]].
Also: a _generated_ dashboard whose data is baked at gen-time will never move regardless of live
data — only a panel that fetches a refreshed feed can tick.

## Why

Three SmartOut dashboards "stood still"; the instinct is to blame the feed. But two were static
baked snapshots (never move by design) and the third (live) was reading a `activity_trail` whose
newest row was 11h old — the SmartOut app/engine wasn't running, so nothing emitted. Injecting 3
timestamped rows lit the live panel within ~5s, proving the pipeline and isolating the fault to the
dead source. Debugging the pipeline would have been wasted effort. Check emission first; "live UI
with no data" is usually a dead producer, not a broken consumer.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T16:00:00Z — initial: SmartOut live dashboards frozen because the app wasn't running (newest event 11h stale), not because the feeder broke; baked dashboards never move regardless. Verify source emission (max ts / row delta / process up) + inject a probe row before debugging the pipeline.
