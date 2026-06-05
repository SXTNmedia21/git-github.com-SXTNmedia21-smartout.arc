---
topic: control-point-loop-and-observability
status: active
updated: 2026-05-31T14:35:00Z
created: 2026-05-31T14:35:00Z
supersedes:
---

# Decision lesson — control-point-loop-and-observability

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

The per-unit `control.json` gates ([[mechanical-control-point-artifact]]) are not just checks — they are the **loop state**. Three patterns compose on top:

1. **Drive-to-100% loop.** "Done" is defined mechanically and read from disk: every unit `gate==PASS` && `blockers==[]` && all control_points true. The loop reads all control.json → picks the highest-friction unit → dispatches a fix → re-runs that unit's control check → regenerates the dashboard → repeats. It never asks "is it done?" (reads `gate`) and never stops on a FAIL (fixes + re-checks). It halts ONLY when the read says all-green. `blockers==[]` is the definition of "0 friction." This is the standing-goal ("no scoped task left undone") instantiated on the control surface.

2. **Append-only activity feed.** Every dispatched agent appends one JSON line per event to `activity/feed.jsonl`: `{ts, agent, domain, event: logon|working|delivered|gate|logoff, detail, artifact, gate}`. This makes the orchestration observable without re-judging anything — the feed IS the truth of who is on/off, what they delivered, what they work on.

3. **Observability surface built BY a dedicated agent.** The human-facing dashboard (live agent cards, gate grid, progress-to-100%, buttons to spec + design) is built by a spun-up frontend agent, NOT by the orchestrator inline. It polls the feed + the aggregated gates (~3s) so logon/logoff/gate-flips update live. Because `file://` blocks fetch, ship a one-command local-server launcher alongside the HTML.

   **But the PRIMARY surface is a server-free text log, not the HTML.** An HTML dashboard that needs a running server "disappears" (renders empty) the moment the user just opens the file — `file://` blocks the fetch. For a long-running orchestration the robust default is a **render-on-read text log**: a script that reads the feed + latest beat and prints designed columns (`time · glyph · EVENT · agent · domain · detail`, where detail carries the artifacts/elements sent). It's tail-able (`watch -n2 render-log.sh`), needs no server, and is always readable. Keep the HTML as the rich secondary; lead with text.

4. **Liveness needs a dedicated heartbeat process — gates alone don't prove agents work.** A control.json proves _output_ is honest, but says nothing about an agent that logged on and went dark. So run a background pulse (`heartbeat.sh`, ~15s beat, self-capped, stop-flag) that polls the activity feed and classifies every agent live/working/stalled/done; an agent past a stall threshold with no new event emits a loud `stall-alert`. A dark agent becomes _visible_, not silently dead. The three guarantees compose: **can't fake done** (control.json) · **can't go dark** (heartbeat) · **can't stop early** (loop-gate wall).

5. **A verify-watchdog must READ the actual claim, not assume it — and liveness is latest-event-wins.** A watchdog that compares "what the surface claims" against "ground truth" must parse the surface's _actual rendered state_; if it assumes the claim, it fabricates a discrepancy that isn't there (I once asserted "dashboard shows 8 working" without reading it — it showed 0 live/9 done; the watchdog reported a false drift). Two rules fall out: (a) the verify step reads the real artifact, never a remembered/assumed value; (b) per-agent liveness = **latest event wins** — an agent that logged off is DONE even if a mid-run stall-alert was emitted earlier; historical alerts must not override the final state. Baking historical stall-alerts that survive logoff is itself a liveness bug.

6. **Three signal channels.** Tag every inbound signal with `channel` ∈ {**heartbeat** (the liveness pulse), **telemetry** (app `emit()` events → activity_trail/engine_event), **webhook** (external inbound — Stripe/SendGrid/etc → edge fns)}. The dashboard shows which channel is live at a glance. One taxonomy for all inbound observability.

## Why

Founders want to _watch_ a long multi-agent run, not get a final report — and they want the machine to grind to 100% on its own, not stop at the first failure and ask. Separating the three concerns keeps it honest: the control.json is the gate (mechanical), the feed is the audit (append-only), the dashboard is the lens (built by an agent, never re-judges). Validated on the Smartout telemetry-map campaign (2026-05-31): 7 agents → seeded feed → agent-built live dashboard polling every 3s → 0/13 PASS shown honestly. The orchestrator's job is to nail this loop + observability, then iterate; declaring "done" is forbidden until the disk read is all-green.

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T14:35:00Z — initial: control.json = loop state; drive-to-100 reads-picks-fixes-rechecks until all-green (blockers==[] == 0 friction); append-only activity feed (logon/working/delivered/gate/logoff); live dashboard built by a dedicated agent, polls feed + gates, served (file:// blocks fetch).
- 2026-05-31T15:12:00Z — text log is the robust PRIMARY surface (render-on-read, server-free, tail-able); HTML dashboard needs a server (file:// blocks fetch → it "disappears"), so it's secondary.
- 2026-05-31T15:25:00Z — server-free visual = a SELF-CONTAINED HTML with data baked inline (0 fetch), regenerated on demand; it opens as a plain downloaded file. A fetch-based HTML only works while a server runs (and the server dies when the terminal closes). Debug gotcha: `pgrep -af 'http.server'` self-matches its own command line → false "server running"; confirm with `curl` to the port, not pgrep.
- 2026-05-31T15:38:00Z — verify the artifact on disk BEFORE claiming it works: a dashboard is "done" only after grep confirms `0 fetch` + the baked `const` parses as valid JSON + HTML closes. Same no-fabrication discipline as the control.json gate — don't send a surface you haven't proven renders.
- 2026-05-31T16:38:00Z — liveness has a THIRD terminal state: **abandoned** (logged on, never logged off, gone silent — e.g. a rejected/killed worker) ≠ **done** (logged off cleanly). A verify that buckets abandoned-into-done hides incomplete work; the heartbeat's "stalled" count was the more honest signal. Distinguish done / abandoned / active.
- 2026-05-31T16:16:00Z — full loop closed live: watchdog flagged drift → Pontus confirmed via screenshot (map-avstemming showed ⚠ STALLED + "3 stall" though it had logged off) → fix dispatched to the dashboard agent (latest-event-wins in both the generator and the HTML; stall counter counts only currently-stalled, not historical) → re-verify. The flag→confirm→fix→re-verify cycle is the intended behaviour, not an exception.
- 2026-05-31T16:14:00Z — implemented the rule: verify-dashboard.sh (10-min watchdog) reads truth from disk and emits `mislabel_risk` / `finished_but_maybe_stalled` — flags a finished agent (latest event = logoff) that a dashboard may still show STALLED from a baked mid-run alert. Drift detected, not hand-patched.
- 2026-05-31T14:48:00Z — added heartbeat liveness (dedicated background pulse polls the feed, classifies live/working/stalled/done, emits stall-alerts — gates prove output not liveness) + three-channel taxonomy (heartbeat/telemetry/webhook). The three guarantees: can't-fake-done · can't-go-dark · can't-stop-early.
