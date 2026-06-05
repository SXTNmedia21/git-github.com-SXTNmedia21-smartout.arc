# sxtn-foreman LESSONS

> Durable architectural decisions for the foreman, captured per the self-improve gate. Canonical, update-in-place — one entry per decision. In a live project these live at `.sxtn/lessons/<slug>.md`.

---

## L-FM-001 — Foreman = the worker, not the gate-driver

- **Type:** binding · **Severity:** high · **Captured:** 2026-05-31
- **Decision:** The foreman *finds work and sets it in motion* (Worklist → spec → plan → spin workers). It does **not** drive the gates — once a plan exists, `sxtn-orchestrator` drives S0→S9. Three-agent split: foreman (what to do next) · orchestrator (how it's done right) · harness-builder (that it keeps running).
- **Why:** Pontus' design — "den første fyren, en worker, en aktiv fyr." Conflating finding-work with gate-driving would duplicate the orchestrator and blur ownership.
- **How to apply:** Foreman hands a planned session to `sxtn-orchestrator` and stops; it never re-runs G1–G8.
- **Related:** `agents/sxtn-foreman.md`, [[L-FM-003]].

## L-FM-002 — Parallel spin-up uses `dispatching-parallel-agents`, never `subagent-driven-development`

- **Type:** binding · **Severity:** high · **Captured:** 2026-05-31
- **Decision:** For the foreman's parallel worker spin-up, the correct superpowers primitive is **`dispatching-parallel-agents`** (independent problem domains, isolated worktrees, gather-by-summary). **`subagent-driven-development` is sequential by design** — dispatching multiple implementers in parallel is an explicit "Never" (they conflict on files).
- **Why:** Confirmed from the superpowers skill sources during research. Using the wrong primitive would cause file-conflict corruption across parallel workers.
- **How to apply:** Branch 1 spawns via `dispatching-parallel-agents` + sxtn's F9 worktree/lock layer. Use `subagent-driven-development` only for sequential per-task execution within a single session.
- **Related:** `docs/foreman/design-brief.md` §3, superpowers `skills/dispatching-parallel-agents`.

## L-FM-003 — Three branches = three registered triggers over one logic source

- **Type:** binding · **Severity:** medium · **Captured:** 2026-05-31
- **Decision:** The foreman's three branches are exposed as **three independent heartbeat triggers** (`foreman-start`/`foreman-spec`/`foreman-plan`) sharing **one logic source** — `sxtn-foreman-tick.sh`'s `decide()`, reached via `--when N` (predicate) / `--fire N`. They are registered in the harness-builder's trigger-registry with two-sided fire-matrices, so the **Trigger Registry keeps the foreman going**, not just the harness.
- **Why:** Pontus: "Trigger Registry needs to keep Orchestrator going as well … the three things that's triggering him." Three triggers give independent tunability + registry visibility; one logic source prevents duplicated, drifting branch logic.
- **How to apply:** `decide()` returns exactly one branch (mutually exclusive — verified: one state → one trigger). Tune cadence per branch in `triggers.json`; never fork the branch logic into the trigger configs.
- **Related:** `templates/foreman-triggers.json`, `bin/sxtn-foreman-tick.sh`, harness-builder `.sxtn-seed/trigger-registry.json`.
