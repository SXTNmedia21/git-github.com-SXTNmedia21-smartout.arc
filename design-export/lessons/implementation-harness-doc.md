---
topic: implementation-harness-doc
status: active
updated: 2026-05-31T19:00:00Z
created: 2026-05-31T19:00:00Z
supersedes:
metadata:
  type: reference
---

# Decision lesson — implementation-harness-doc

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The living operating instruction for running the Smartout implementation agent-swarm lives at
`smartout.ai-wt-2/docs/IMPLEMENTATION-HARNESS.md` — read it FIRST when resuming Smartout
implementation work. It synthesizes this session's durable lessons into one structured playbook
(mission · three roles · setup-bootstrap · copy+adapter pattern · 7 disciplines · observability ·
handoff state · next-session steps). Its §6 (state-at-handoff) is updated every session so the next
one resumes rather than restarts.

The doc is the **vehicle**; these plugin lessons are the **durable truth** behind each discipline:
[[faithful-design-port-copy-not-rewrite]] · [[telemetry-as-verification-spine]] ·
[[mechanical-control-point-artifact]] · [[control-point-loop-and-observability]] ·
[[watchdog-flags-human-decides]] · [[discovery-output-and-foreman-role]] ·
[[wiring-campaign-gate-prerequisites]] · [[redesign-wiring-pipeline]] ·
[[local-supabase-multi-project-ports]] · [[live-db-connection-before-db-claims]] ·
[[design-source-canonical-location]].

## Why

The founder asked for one extremely-clear living instruction so the NEXT session can build the
harness around proven experience instead of re-discovering the bootstrap (Docker/local-Supabase,
clean .env.local, building packages) and re-learning the copy-not-rewrite pattern. Keeping the
synthesis in the worktree (where the work runs) and the atomic lessons in the plugin (where they're
refined across projects) means the doc stays project-current while the principles stay reusable.
Update the doc's §6 + Changelog at each session close.

---

## History

- 2026-05-31T19:00:00Z — initial: IMPLEMENTATION-HARNESS.md is the living synthesis doc; read it first when resuming Smartout impl; atomic lessons stay in the plugin and are linked from it.
