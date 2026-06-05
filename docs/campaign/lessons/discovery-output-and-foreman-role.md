---
topic: discovery-output-and-foreman-role
status: active
updated: 2026-05-31T16:45:00Z
created: 2026-05-31T16:45:00Z
supersedes:
---

# Decision lesson — discovery-output-and-foreman-role

> Managed by sxtn-lesson-capture (mode: decision).
> The **Decision** block below is always the canonical current truth.
> History appends at the bottom — never edit it retroactively.

---

## Decision

Two coupled truths about running a mapping/discovery campaign for a founder:

1. **Discovery output is FAIL-by-design — that is success, not breakage.** A mapping phase exists to FIND the work; every unit it maps `gate=FAIL` because it describes unbuilt work, not because anything is broken. `FAIL · N events to register` = the backlog was found. Green arrives in the BUILD phase, never in discovery. **Never present raw red gates to the human as the headline** — they read "nothing works." Frame discovery output as the backlog/map it is (what's done discovering, what build comes next, where green will appear), with a phase bar (DISCOVERY ██░ / BUILD ░░░).

2. **Foreman, not worker.** When the orchestrator (the Opus session) runs the grunt subagents by hand and pings the human at every step, it has slipped from coordinating to grinding. The role is: connect the real orchestrator (sxtn-orchestrator drives S0→S9, dispatches subagents, enforces gates, pings the human ONLY at G8 product-accept), monitor it, and notify the human at decision points — not FAIL-spam, not per-step asks. Doing the work yourself instead of dispatching is the anti-pattern.

3. **Training/ordering workers is the ORCHESTRATOR's domain, not the foreman's.** The split inside the coordination layer: the **orchestrator owns training workers + issuing orders to them** (writing/curating agent definitions, dispatching, gating). The **foreman finds + feeds work** (pulls the worklist, decomposes, surfaces at checkpoints, verifies evidence on disk) but does NOT train workers or write their agent files. A foreman editing an agent's `.md` to "train it on the design system" has overstepped into the orchestrator's lane — leave it as a draft for the orchestrator to approve/own, don't issue it unilaterally.

Corollary: the orchestrator can only drive once sxtn is actually init'd in the project (config.yaml + STATE.md + council.yaml). Running discovery agents manually before init means there is no real orchestration — just a human staring at red gates with no coordinating context. Connect the orchestrator EARLY, not after the human is frustrated.

## Why

Pontus, 2026-05-31: after a long manual mapping campaign he said "jeg ser bare gate failed, gate failed, gate failed … det er ingenting som fungerer … du skal koordinere dem i stedet, ikke jobbe med det." The FAILs were correct (the design demands 143 unregistered events) — but surfaced as bare red gates with no phase context and no orchestrator, they read as total failure. The fix is both framing (discovery FAIL = backlog) and role (be the foreman: connect sxtn-orchestrator, let it drive + gate, notify at checkpoints). Links the human-decision boundary in [[watchdog-flags-human-decides]] and the telemetry-as-spine build that turns FAIL→green ([[telemetry-as-verification-spine]]).

---

## History

<!-- Entries appended by sxtn-lesson-capture on each UPDATE. Oldest first. -->

- 2026-05-31T16:45:00Z — initial: discovery output is FAIL-by-design (backlog found, not breakage) — never headline raw red gates to the founder; be the foreman (connect sxtn-orchestrator, monitor, notify at checkpoints) not the worker grinding subagents by hand; connect the orchestrator early (needs sxtn-init) so there's real coordination, not a human staring at red.
- 2026-05-31T23:15:00Z — added point 3: training/ordering workers = orchestrator's domain, not foreman's. Founder corrected ("Orchestrator agent eier trening og ordre til agentene") after the coordinating session trained sxtn-ui-builder + wrote a foreman agent file itself. Foreman finds+feeds+verifies; orchestrator trains+orders+gates. A foreman editing an agent .md = overstep → leave as draft for orchestrator to own.
