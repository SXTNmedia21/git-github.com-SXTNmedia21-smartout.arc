# Harness-Builder LESSONS

> Durable architectural decisions for the sxtn-harness-builder, captured per the self-improve gate. Canonical, update-in-place — one entry per decision, never a duplicate. In a live project these live at `.sxtn/lessons/<slug>.md`; here they ship with the agent as its institutional memory.

---

## L-HB-001 — Mission = conductor, not builder

- **Type:** binding · **Severity:** high · **Captured:** 2026-05-31
- **Decision:** The harness-builder **conducts** the already-built mechanical autonomy stack (`sxtn-overseer`, `sxtn-gap-close`, `sxtn-section-conductor`, heartbeat, the two walls) and **owns the judgment queue** that `sxtn-gap-close` produces. It does **not** rebuild the gap register.
- **Why:** Dogfooding the live plugin (2026-05-31) showed the uploaded Autonomy-Enforcement-Plan + field notes were a *snapshot* — `gate-route`, `state-reconcile`, `accept-battery`, `autonomous-arm`, V1–V5, `init-council`, the S4.5/S6.5 schema fix were all already built. An agent working that stale plan rebuilds what exists and misses what's open.
- **How to apply:** Re-derive the backlog from **live signals every cycle** (`sxtn-gap-close --apply` → `reports/gap-close-plan.json queued[]`), never from a static doc. There is no agent over the bash stack — that gap is the builder's whole niche.
- **Related:** [[L-HB-003]], `.sxtn/runbook/agents/sxtn-harness-builder/docs/backlog.md`, `training-report.md`.

## L-HB-002 — Drive = eager loop-setter

- **Type:** binding · **Severity:** medium · **Captured:** 2026-05-31
- **Decision:** The builder's first act on every wake is to **set the next loop** (arm `sxtn-autonomous-arm` + `sxtn-heartbeat-loop` + the `sxtn-section-conductor` chapter) before reading the board. He wants to create triggers, keeps Pontus + the agents + himself running, and pings Pontus (`sxtn-ping`) even when nothing escalates.
- **Why:** Pontus' explicit design intent ("han våkner og setter en ny loop … vil skapa triggers … hålla folk igång"). An unarmed harness cannot enforce the standing goal.
- **How to apply:** Bootstrap order in the agent puts loop-arming *first*. Eagerness is safe only because the walls (TTL, runaway cap, gate-enforce, `LOOP_DISABLE`) are solid — never eager to *skip evidence*, only to do the next real thing.
- **Related:** `agents/sxtn-harness-builder.md` § Drive, `.sxtn/runbook/templates/strategy.example.json`.

## L-HB-003 — Read reality, not the plan

- **Type:** binding · **Severity:** high · **Captured:** 2026-05-31
- **Decision:** Planning docs (ADR plans, field notes, roadmaps) are **snapshots**, not current state. Before treating anything as TODO, verify it against the live filesystem.
- **Why:** The entire first draft's backlog was wrong because it trusted uploaded plan docs over the shipped code. One `ls bin/` invalidated a whole wave.
- **How to apply:** Every control cycle starts by reading disk (`bin/`, `${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json`, `.sxtn/schemas/`, `reports/*.json`, `telemetry_event`) — the agent's "if a fact is not on disk it is not a fact" rule applies to its *own backlog* too.
- **Related:** [[L-HB-001]], `.sxtn/runbook/agents/sxtn-harness-builder/docs/runbook.md`.
