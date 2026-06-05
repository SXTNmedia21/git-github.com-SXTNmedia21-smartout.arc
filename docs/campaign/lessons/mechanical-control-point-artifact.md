---
topic: mechanical-control-point-artifact
status: active
updated: 2026-05-31T14:20:00Z
created: 2026-05-31T14:20:00Z
supersedes:
---

# Decision lesson — mechanical-control-point-artifact

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Make "is this unit ready?" a **query, not a vote.** Each work-unit (domain, sortie, slice) emits a machine-readable `control.json` with explicit counts + a `control_points` block of booleans + a derived `gate: PASS|FAIL` + a `blockers[]` list. The gate reads the file from disk; readiness is mechanical, never a judgment call. Every gap (missing event, missing hook, noop candidate) is listed explicitly — surfaced, never hidden. A baseline count (e.g. total interactive elements) is recorded so later work cannot silently narrow scope. A single generator (`gen-dashboard.sh`) aggregates all `control.json` into a refreshable visual dashboard, so status is always one command away and never a question.

Pattern proven: fan out N subagents (one per area), each writes its own `control.json`; the orchestrator never re-judges — it reads. When the gate is honest, agents return honest FAIL with surfaced gaps rather than fake PASS.

## Why

Empirically validated on the Smartout telemetry-map orchestration (2026-05-31): 7 parallel mapping subagents, every one returned a mechanical FAIL with its gaps listed, **zero fake PASS** — exactly the anti-fabrication outcome the harness exists for. The control.json artifact is what makes the gate unbluffable: prose ("I mapped it") is a claim; `{"gate":"FAIL","blockers":[...]}` on disk is evidence. This is the on-disk, per-unit instantiation of the telemetry-as-spine idea ([[telemetry-as-verification-spine]]) and the prerequisite that the anti-fabrication gates ([[wiring-campaign-gate-prerequisites]]) consume. The dashboard generator turns the same artifacts into the "follow the process" surface for the human — reinforcement without re-judging.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T14:20:00Z — initial: per-unit control.json (counts + control_points booleans + gate + blockers + baseline) read from disk makes readiness a query not a vote; proven by 7/7 honest FAIL, 0 fake PASS; one generator → refreshable dashboard.
