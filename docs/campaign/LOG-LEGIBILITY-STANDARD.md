---
title: Log Legibility Standard — every log line self-explains, read from anywhere
status: draft
updated: 2026-06-03
created: 2026-06-03
module: campaign
tags: [logs, telemetry, legibility, harness, activity-trail, standard]
---

# Log Legibility Standard

> **The rule:** a log line read **from anywhere** (Supabase Studio, Telegram, the activity-log file,
> a terminal) must be understood **immediately** — who, what, for whom, when, on what. No ambiguity,
> no "Session started — branch: X" that tells you nothing. This file **defines what a log line must be.**

## The problem it kills

Today's entries are anemic and indistinguishable:

```
## [2026-06-03T05:11:18+02:00] source:session | actor:system
Session started — branch: campaign/master-refactor

## [2026-06-03T05:13:46+02:00] source:session | actor:system
Session started — branch: campaign/master-refactor
```

Two near-identical lines. You cannot tell **which agent**, **what mission**, **which human**, or **why**.
Read from Studio a week later: meaningless.

## The seven fields (mandatory vocabulary)

Every legible log entry draws from this fixed vocabulary. Not every entry uses all seven — but every
field it *does* carry uses **this exact name**.

| Field | Meaning | Example |
|-------|---------|---------|
| `agent` | the **specific** agent name — never bare "claude"/"system" | `sxtn-builder`, `work-mode-orchestrator`, `cron:pulse` |
| `vision` | the mission — one line, what it is doing **and why** | `"port min-dag-v2 to L3"` |
| `human` | which human commissioned / owns it | `pontus` |
| `started_at` | ISO-8601 — when the run/work began | `2026-06-03T06:12:00+02:00` |
| `component_id` | the component / surface / event acted on | `min-dag-v2`, `scheduler.create_shift` |
| `level` | severity **or** maturity grade | `info` · `warn` · `error` · `L2` · `L3` |
| `clicked_at` | ISO-8601 — when the interaction fired (user/agent acted) | `2026-06-03T06:14:22+02:00` |

## The two entry shapes

Most logs are one of two shapes. Each declares its `kind` so a reader knows which to expect.

**1. Agent-run** — an agent starts / progresses / finishes a mission.
> required: `agent` · `vision` · `human` · `started_at`  ·  optional: `component_id` · `level`

```
[2026-06-03T06:12:00+02:00] kind=agent-run  agent=sxtn-builder  human=pontus
  vision="port min-dag-v2 to L3 — copy + adapter + wire + prove"  component=min-dag-v2  level=info
```

**2. Component-interaction** — a surface fired a telemetry event (the product/spy log).
> required: `component_id` · `level` · `clicked_at` · `event`  ·  optional: `agent` · `human`

```
[2026-06-03T06:14:22+02:00] kind=component-interaction  component=min-dag-v2  event=task.complete
  level=L3  clicked_at=2026-06-03T06:14:22+02:00  human=anna
```

## Correlation keys (the join — "something, hopefully more than two")

The descriptive fields say *what happened*. The **correlation keys** say *where it belongs* — they are the
foreign keys that let any log line join to the rest of the system **from anywhere**. A line that carries
them is traceable; a line without them is an orphan.

| Key | Joins the line to | Example |
|-----|-------------------|---------|
| `component_id` | the component-index / spy lifecycle (`proposed→…→proven`) | `min-dag-v2` |
| `feature` | the feature / sortie | `min-dag-v2-port` |
| `branch` | git | `campaign/master-refactor` |
| `agent_id` | the specific run / invocation (not just the name) | `sxtn-builder@46a548191` |
| `chronicle` | a canon artifact — **polymorphic**: `plan` \| `proposal` \| `spec` \| `ADR` \| bare id | `proposal:0011` · `ADR-0047` · `spec:2026-06-02-design-handoff` |
| `domain` | the domain | `min-dag` · `payroll` · `schedule` |

**The minimum-correlation rule.** You don't need every key every time — but you need **more than two**.
A compliant line carries **≥3 correlation keys** (whichever apply); one or two = an orphan you can't trace
from anywhere; zero = noise. Always include every key that applies — never strip a known one to save space.

```json
{ "host": "harness", "parsed": [{
  "kind": "agent-run", "agent": "sxtn-builder", "agent_id": "sxtn-builder@46a548191",
  "human": "pontus", "vision": "port min-dag-v2 to L3", "started_at": "2026-06-03T06:12:00+02:00",
  "component_id": "min-dag-v2", "feature": "min-dag-v2-port", "branch": "campaign/master-refactor",
  "chronicle": "proposal:0011", "domain": "min-dag", "level": "info" }]}
```
That line has six correlation keys — query the Logs Explorer by any one and every related line comes back.

## Runtime-state fields (how the agent is doing)

A third group — not *what* happened or *where* it belongs, but the **live state of the agent** emitting the
line. These turn the log into a health signal, not just a record.

| Field | Meaning | Example |
|-------|---------|---------|
| `worktree` | the **physical worktree** the line came from — stamps which instance emitted it | `master-refactor` · `min-dag-wt-3` |
| `context` | the working context / task the agent is inside | `golden-path-close` |
| `context_float` | context-window fullness `0.0–1.0` — the **degradation early-warning** | `0.92` |
| `mood` | agent self-assessed state | `steady` · `uncertain` · `blocked` · `degraded` |

Why they matter:

- **`worktree` catches collisions.** Today's 208-deletion landmine + index race came from two instances on
  one worktree. Had every line carried `worktree=`, the second emitter would have been obvious at a glance.
  Strongly recommended on **every** agent-run.
- **`context_float` is the checkpoint trigger.** A line with `context_float ≥ 0.85` is a signal to checkpoint
  **before** the agent degrades — the cure for the "200k-context RED session trying to turn green mid-stream."
- **`mood` is the human-legible health read** — but `mood=confident` is a *feeling*, **not** authorization.
  Confident ≠ authorized (C4). Mood informs; it never gates.

## The one-glance test

A line passes legibility if a stranger reading it cold can answer **WHO · WHAT · FOR-WHOM · WHEN · ON-WHAT**
without opening another file. If any of those is unanswerable, the line is non-compliant — fix the writer,
not the reader.

## Where it applies (and the wall)

| Writer | Path | Can fix directly? |
|--------|------|-------------------|
| Activity-log (local audit) | `~/.claude/scripts/log-activity.sh` → `activity-log.md` | ✅ yes — file + bash, no DB |
| Campaign live-log | `docs/campaign/telemetry-map/LIVE-LOG.txt` | ✅ yes |
| Harness telemetry | `sxtn-ops-emit.sh` → `harness_event` (Supabase) | ⚠️ **DB-wall** — `vision`/`human`/`component_id`/`clicked_at` as first-class columns is a schema + 14-key-allowlist change (ADR-0027). Surface as a finding → Database Agent + founder approve. Until then, carry them inside the allowlisted `payload` where they fit (`agent`, `level` already allowlisted). |
| Product telemetry | `emit()` → `activity_trail` (Supabase) | ⚠️ **DB-wall** — same. `component_id`/`clicked_at` map to existing columns where present; new columns gated. |

## Rules

1. **Name the agent, never the role.** `agent=sxtn-builder`, not `actor:system`. "system" is who ran it; the
   **agent name** is what you read.
2. **Vision is mandatory on every agent-run.** A run with no stated vision is a non-compliant run — the
   dispatcher must put the mission in the log line (the dispatch brief already carries it; copy it through).
3. **One human, always named.** `human=pontus`. Never omit — a log with no owning human is an orphan.
4. **Times are ISO-8601 with offset.** `started_at` for runs, `clicked_at` for interactions. Both, when both apply.
5. **`component_id` ties the line to the component-index** (the spy / lifecycle `proposed→…→proven`). A log
   line and a component row share the same `component_id` — that's how "from anywhere" joins up.
6. **Backward-compatible.** Old 3-arg log calls still work; the new fields are additive. A legible line is the
   target, not a breaking gate (yet).

## Status

- **Standard: defined** (this file).
- **Activity-log writer: pending** upgrade to carry `agent`/`vision`/`human`/`started_at` (safe, next).
- **Harness + product telemetry: DB-wall** — defined here; column wiring is a Database-Agent finding, not a
  direct edit.
