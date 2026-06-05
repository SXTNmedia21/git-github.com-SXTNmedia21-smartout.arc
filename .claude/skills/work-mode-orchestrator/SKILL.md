---
name: work-mode-orchestrator
description: Use when conducting the SmartOut master-refactor campaign from the code side — dispatching build/verify agents, sequencing domains into waves, choosing model tiers, coordinating parallel worktrees, broadcasting focus/assignments to agents, or judging whether a domain is ready to close. The orchestrate-mode layer that stacks ON TOP of work-mode-core. Symptoms — "which agent + model for this?", "can these run in parallel?", "is this domain at L3?", "what do I dispatch next?".
updated: 2026-06-03
---

# Work-Mode Orchestrator

The orchestrate-mode layer. **Loads on top of `work-mode-core`** — core gives the rails + the done-oracle;
this adds the orchestra. The orchestrator **dispatches + sequences + verifies + coordinates** — it does
**not** hand-port pages (that's the builder) or grade them (that's the verifier). One job: keep every
scoped surface moving toward L3, never leaving one undone.

**REQUIRED BACKGROUND:** `work-mode-core` (done = §1 L3; rails = §5; DB-wall + C4 = §4). This skill
assumes it; it does not repeat it.

## The four moves

1. **Roster — who is who.** Pick the agent by task, then the model by weight. Trust the agent file's
   `model:` if set; else dispatch explicitly (never inherit Opus silently).

   | Task | Agent | Model |
   |------|-------|-------|
   | Explore / search / grep | `Explore`, `general-purpose` | haiku |
   | Port a page (copy + adapter + wire) | builder agents | sonnet |
   | Build capability / migration / SQL | builder agents | sonnet |
   | Grade a built slice (separate from builder) | `code-reviewer` / verifier | sonnet |
   | Narrate / format | `narrator` | haiku |
   | Plan architecture / verify plan vs reality | `Plan`, `system-steward` | opus |
   | Coordinate multi-agent / council | `supervisor`, council | opus |

   Bias: **sonnet > opus; haiku > sonnet** for throughput. Fan-out (3+ readers) = never Opus. A "30-agent"
   session ≈ 5–8 opus, 15–20 sonnet, 5–10 haiku. >50% opus = drift, re-audit.

2. **Wave — sequence by friction.** Foundation (serial, once) → golden-path (serial, one backend-ready
   domain, full gate battery green — proves the motion) → fan-out (parallel worktrees, lightest-friction
   first) → gap-track (backend gaps close DB first, DB-wall gated). A page never closes without:
   stated plan → copy+adapter+wire → telemetry registered+**proven** → gate green on disk → **G8 human accept**.

3. **Broadcast — the word to the agents.** One channel, four message types: **FOCUS** ("this now") ·
   **CONTINUE** ("go further") · **ASSIGN** ("you take this") · **AMPLIFY** ("more of this"). Steers
   running + queued agents, not just humans. Put the scope + the done-test in every dispatch brief.

4. **Evidence view — is the domain at L3?** Readiness is mechanical: read the gate on disk — **never a
   worker's word.** **Exact paths (pinned — don't go hunting):**
   - per-domain gate: `docs/campaign/telemetry-map/<domain>/control.json` (10 exist: min-dag, vaktplan,
     lonn, hms, ansatte, oppgaver, planlegging, kommunikasjon, avstemming, oversikt)
   - rollup: `docs/campaign/telemetry-map/AGGREGATE-control.json`
   - coverage reports: `docs/campaign/telemetry-map/reports/emit-coverage-<domain>.json`
   - landing proof: the `activity_trail` row (L3, manual today — see core §1)

   `blocked` → escalate, never advance. **"File not found" is a claim too — `find . -name control.json`
   before concluding it's absent** (it isn't; rail #7). Frame a real discovery-FAIL as the backlog it is,
   not a red headline.

   **Standing routine — regenerate the board.** After every gate-check, rewrite
   `docs/campaign/MISSION-DASHBOARD.html` (+ `MISSION-MANIFEST.md` rollups) **from the same
   `control.json` you just read** — domain status, wave progress, the rollup counts. The board is never
   stale because it's machine-rewritten every wave, never hand-edited. One source (`control.json`), two
   outputs (your verdict + the board).

## Dispatch brief — the minimum every agent gets

- **Scope** (one domain / one slice) + **the branch to commit to**.
- **The done-test** (L3: which events must land in `activity_trail`).
- **Worktree isolation** — if parallel + file-mutating, verify the physical worktree exists BEFORE
  dispatch (`git worktree list`); the flag alone shares the campaign root and cross-contaminates.
- **Rails reminder** by pointer, not re-paste (core §5).

## Hard rules (orchestrator-specific)

- **Lanes don't cross.** Orchestrator dispatches; builder ports; verifier grades; `commit-steward`
  commits; Pontus pushes + approves DB + holds G8.
- **One instance owns `.sxtn/`.** Concurrent writers collide — check heartbeat freshness first.
- **Confident ≠ authorized (C4).** Recommend G8 / production-go; never cross autonomously.
- **Evidence over assertion** — and diagnose a red before believing it (a FAIL verdict is also a claim).

## Red flags — STOP

- About to dispatch Opus for "just check / find / grep" → use haiku. (move 1)
- Parallel file-mutating agents without a verified physical worktree each → cross-contamination. (brief)
- Advancing a domain on a relayed "it's green" → read the gate + the row on disk. (move 4)
- Closing a domain below L3 / crossing G8 without the human → no. (core §1, C4)
