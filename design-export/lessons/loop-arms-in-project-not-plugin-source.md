---
topic: loop-arms-in-project-not-plugin-source
status: active
updated: 2026-05-31T20:27:27Z
created: 2026-05-31T20:27:27Z
supersedes:
metadata:
  type: project
---

# Decision lesson — loop-arms-in-project-not-plugin-source

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Harness loop machinery (`bin/sxtn-autonomous-arm.sh`, `bin/sxtn-heartbeat-loop.sh`, the two walls `sxtn-loop-gate`/`sxtn-gate-enforce`, the trigger-registry seed+schema) lives in the **plugin source** and is verified there — but the loop **arms and runs in the target project's worktree**. Loop-liveness, the arm flag `.sxtn/autonomous-loop.active`, `.sxtn/config.yaml`, and `.sxtn/triggers.json` are checked against the **WORKTREE's** `.sxtn/`, never the plugin repo's. A missing `.sxtn/config.yaml` in the plugin source is **NOT drift**; the same file missing in the project worktree **IS** the bootstrap wall (surface `/sxtn-init`, block).

## Why

Post-compact (2026-05-31) I verified harness-builder asset claims against the plugin repo (13/13 bin OK, both walls present) and flagged the plugin's missing `.sxtn/config.yaml` as a "bootstrap blocker" — conflating source-of-truth with run-location. The plugin is where machinery is authored; the loop only becomes live when armed in `smartout.ai-wt-2/.sxtn/`. Last session's "the loop never ran" is explained by this: arming was never confirmed in the worktree. Next loop-bring-up checks the WORKTREE's `.sxtn/`, not the plugin's. Relates to [[implementation-harness-doc]] and [[do-the-thing-not-machinery-about-it]].

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T20:27:27Z — initial: loop machinery lives in plugin source but arms/runs in the target worktree; check worktree's .sxtn/ for liveness, not the plugin's.
