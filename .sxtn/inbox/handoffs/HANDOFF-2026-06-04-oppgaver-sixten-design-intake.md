---
title: Handoff — Oppgaver, first full Sixten Design Intake run
status: done
created: 2026-06-04
updated: 2026-06-04
module: design-handoff
tags: [handoff, sixten-design-intake, oppgaver, telemetry, L3, campaign]
---

# Handoff — Sixten Design Intake, first end-to-end run (oppgaver)

**Date:** 2026-06-04 · **Branch:** `campaign/master-refactor` · **Lane:** development (host repo `smartout.ai`)
**Unit:** `oppgaver` · **Pipeline:** Sixten Design Intake T0→T6

---

## Where we are

The evening converged on one thing: **Sixten Design Intake** — a repeatable, telemetry-gated pipeline
that takes a design unit from raw design → implemented → _proven_, where **the verify-script reveals
"done", not the agent**. Tonight we ran that pipeline end-to-end for the first time, on `oppgaver`.

Result: **5 stages green, 1 partial, 1 awaiting human (T6).** Every green is a disk read, not a claim.

```
T0 INTAKE 🟢 → T1 KARTLEGG 🟢 → T2 FIDELITY ◐ → T3 DATA 🟢 → T4 FUNKSJON 🟢 → T5 L3 🟢 → T6 G8 ⏸
```

---

## What we did (the run, with evidence)

| Stage           | Verdict   | Evidence on disk                                                                                                                                                                            |
| --------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T0 INTAKE**   | 🟢        | `docs/campaign/tasks/T-oppgaver-intake.task.json` — unit registered                                                                                                                         |
| **T1 KARTLEGG** | 🟢        | oracle `telemetry-map/oppgaver/control.json` GREEN: 38 elements, 14 mutations, 19/19 events. **Scope-gap surfaced**                                                                         |
| **T2 FIDELITY** | ◐ partial | **T2a mechanical GREEN**: 0 hex/oklch, 0 zinc/gray, 0 motion-drift, 0 non-Lucide, 0 UI-emoji (1 hit was a code comment). **T2b visual 8-dim NOT RUN** — needs logged-in Playwright on :3060 |
| **T3 DATA**     | 🟢        | psql simulated-RLS: session_task=21, schedule_shift=39, profile=15, department=4, activity_trail=1678. Real-or-empty, 0 ghost                                                               |
| **T4 FUNKSJON** | 🟢        | 19/19 oppgaver+task events in `EVENT_ROUTING`; 8 route to `activity_trail`                                                                                                                  |
| **T5 TEST L3**  | 🟢        | **8/8 activity_trail-routed events landed real rows** (Δ 1680→1688) via the real `emit()` pipeline, Anna actor, real entities                                                               |
| **T6 G8**       | ⏸         | Awaiting Pontus C4 accept                                                                                                                                                                   |

---

## What worked

- **The telemetry-spine is real and provable.** T5 went from assertion → 8 concrete `activity_trail`
  rows. The `emit()` → `EVENT_ROUTING` → `writeActivityTrail()` path works end-to-end against the live
  local DB. This is the "done = a row, not a verdict" promise, delivered.
- **The non-fakeable gate held.** T3 (DB probe) and T4 (registry grep) and T2a (token discipline) are
  all mechanical truths the agent cannot talk its way past.
- **The intake caught a scope lie before we wasted work.** "Implement oppgaver from 0" was the wrong
  picture — the kartlegging revealed oppgaver is ~70% built (telemetry GREEN, ManagerTimeline shipped),
  not greenfield. One read saved a redundant build.
- **Env came up clean:** smartout Supabase on :54321, web on :3060, both green — L3 reachable same-day.

## What did not work / stayed open

- **T2b visual-pixel fidelity is the one un-mechanized stage.** It needs an authenticated Playwright
  session (admin@smartout.local) to extract computed px on the live page and diff against design CSS.
  Honestly flagged NEEDS-CAPTURE — not faked green. This is the single remaining hole to close before
  the whole intake is mechanically provable.
- **Design ≠ live surface.** The design `oppgaver.jsx` is a 4-tab task manager
  (Oversikt · Oppgaver · Dagslinje · Rutiner). Live `/dashboard/oppgaver` renders **only**
  `ManagerTimelineShell` (= the Dagslinje tab), a bespoke chart, not a 1:1 port. So visual fidelity
  will show real drift — that drift is **backlog, not a bug**.

---

## What we built vs did not build

**Built (this run):**

- `T-oppgaver-intake.task.json` — the unit's 7-stage gated task record with per-stage results.
- The Intake harness it rides on (`task.sh`, `run-verify.sh`, `gen-index.sh`, `control-server.py`,
  `verify/*`, `.history/`, `.signals/`) — the control surface where a verify-script is the truth the
  agent runs but cannot write.
- The first proven L3 firing recipe for oppgaver (temp script, run + deleted — not committed).

**Did NOT build (backlog):**

- T2b authenticated-Playwright 8-dim extractor (the reusable visual-fidelity verifier — pays off across
  all 167 pages).
- 3 of 4 design tabs: Oversikt, Oppgaver-list, Rutiner (live has only Dagslinje).
- P3 oppgaver hooks (bulk-complete, DnD reschedule, subtask toggle, etc.) — flagged in oracle, not
  blockers.
- The `gen-task.sh` generator that templatizes the 4 verify-archetypes — deliberately deferred: prove
  on one unit first, templatize what actually worked (avoids the "factory before the first widget" trap).

---

## What I liked / did not like (honest)

**Liked:**

- This session _shipped_ instead of orchestrating about shipping. We did the thing — fired real events,
  read real rows — rather than building machinery to talk about the thing. Direct execution by one
  driver beat fanning out 8 agents.
- The pipeline structure is sound: 4 of 5 stages mechanized cleanly on the first real unit. The shape
  generalizes.
- Catching that oppgaver was already built (not greenfield) is exactly what a kartlegging stage is for.

**Did not like:**

- T2 fidelity is still the soft spot — the one stage that needs an env-heavy harness (auth + Playwright)
  rather than a grep. Until T2b is mechanized, "design-correct" rests partly on eyeballs. That is the
  next thing to harden.
- We picked the heaviest possible pilot (the partly-built, scope-mismatched oppgaver). It proved the
  spine but muddied the fidelity story. A clean unbuilt unit would have been a tidier proof.

---

## Next step (recommended)

Build the **T2b authenticated Playwright 8-dim extractor** (login admin@smartout.local → render live
ManagerTimeline → computed-px per element → assert vs design CSS). That closes the last mechanical hole
and becomes reusable across every page. Then T6: Pontus reviews + accepts in the control panel
(`control-server.py`).

---

_Authored by Claude (Opus 4.8), code-side orchestrator. Evidence-on-disk; no relayed claims._
