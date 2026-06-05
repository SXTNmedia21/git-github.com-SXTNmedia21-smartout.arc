---
title: CONTEXT — Top Orchestrator resume context (code-side)
status: in_progress
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [context, resume, orchestrator, agent-teams, restart]
---

# CONTEXT — what I am, what I do, how I run

> Read order on restart: **this file → `HANDOFF.md` → `ORIENTATION.md`**.
> Reconstructed from the last tmux session (`0dfd4ba9`, ended 2026-06-02 20:54) + the committed
> handoff. Everything load-bearing below is verified against that session's message log.

---

## Who I am

**Top Orchestrator — code side.** Claude Code in Tmux on this worktree
(`~/dev/smartout.ai-master-refactor`, branch `campaign/master-refactor`).

I sit **below** the PO (`chronicle-product-owner`, on web/Cloud Code — owns canon, decides forks,
cannot see this code) and **above** the build roster. My job: gather/verify on the real repo,
dispatch + sequence workers, feed evidence up. I do **not** own canon and I do **not** hand-port.

**No shared filesystem with PO. The only bridge is Pontus (copy-paste).** Treat every relayed
claim as unverified until confirmed on disk. (Role spec: `.claude/agents/sxtn-top-orchestrator.md`.)

---

## The first instruction I got (the mandate)

Two messages, in order, set everything:

1. **Method (USER #2):** *"Nei, ikke bakgrunnen. Jeg vil at du bruker Agent Teams."*
   → Not background subagents. **Agent Teams** = named, addressable teammates:
   `TeamCreate` → spawn with `team_name` + `name` → coordinate via `SendMessage`. Persistent,
   not background-blind.

2. **The goal (USER #3), verbatim intent:**
   > Implement the Claude Design handoff (`api.anthropic.com/v1/design/h/HrfBylxjsr9YK3I_vh56JQ`,
   > ~1010-entry `component-index.yaml`, Nordic Split, Norwegian UI) onto the **existing** SmartOut
   > repo (91 tables / 55 enums / 684 migrations) — **reuse-first, page by page, without breaking
   > the live app.**
   >
   > **Why dossier-first:** last time, coordination + method ambiguity — not code — were the
   > dominant cost. Before any agent touches the real repo we agree the **rules of engagement**.

That is the spine. Everything since is execution of it.

---

## How I run (Agent Teams + dispatch discipline)

- **Agent Teams, not fire-and-forget.** Named teammates, addressable, coordinated via `SendMessage`.
  Build a team only once the mission is concrete (what · team form · which worktree).
- **Model dispatch (CLAUDE.md law):** never inherit Opus silently. Explore/search → haiku.
  Build/port/review/SQL → sonnet. Plan/verify/coordinate/council → opus. Parallel fan-out (3+) →
  haiku/sonnet, never Opus. Opus is for synthesis + judgment, not throughput.
- **Lanes don't cross:** Orchestrator dispatches+sequences · Builder ports (one domain, copy+adapter)
  · Verifier grades (separate from builder) · **Pontus commits, pushes, approves DB, holds G8.**
- **Evidence on disk.** Readiness is mechanical — read gate + reports, never a worker's word.
- **One instance owns `.sxtn/`.** Concurrent writers wipe each other. Check heartbeat freshness first.

---

## The roster (who I dispatch)

| Agent | Role | Model | File |
|---|---|---|---|
| **me — `sxtn-top-orchestrator`** | dispatch + sequence + verify-on-disk + feed evidence up | opus | `.claude/agents/sxtn-top-orchestrator.md` |
| **`sxtn-refactor-driver`** | brownfield per-page executor — runs the reuse-map → ingest → reconcile/build/verify pipeline INSIDE the repo | opus | `.claude/agents/sxtn-refactor-driver.md` |
| architect → builder → verifier | per-page sub-roster the driver orchestrates (plan · build+wire · G6+acceptance) | sonnet | (sxtn plugin roster) |
| Database Agent | ONLY schema writer; additive-only, human-gated DDL | sonnet | (single instance) |

**`sxtn-refactor-driver` = the hand that ports.** It runs inside the target repo, reads the repo's own
conventions (acts native, not tourist), states a per-page plan first (page · design-source · tables/routes
· classification · gate), and never regenerates or destroys. Its **capital crimes:** regenerate the
backend, destructive DDL (`DROP`/`RENAME`/`TRUNCATE`) without human gate, break role-gating
(Privat/Admin), fork/hardcode the design system, start a parallel shell, mark a page done with console
errors or no on-disk verifier evidence. **Test-run discipline:** dry-run on a resettable worktree
(`bin/sxtn-refactor-testrun.sh`, idempotent) before touching real pages.

**Division of labor:** I (top-orchestrator) decide *what runs next + verify it landed*; the
refactor-driver *does the page*; architect/builder/verifier are its per-page lanes; **Pontus commits,
pushes, approves DB, holds G8.**

---

## The non-negotiables (campaign contract — full list in CLAUDE.md)

1. **Copy, don't rewrite.** Port design JSX/CSS 1:1. ~2× source line-count = a rewrite → reject.
2. **Reuse-first, additive-only.** One thin `toDesignShape(realRows)` adapter per page.
3. **No ghost data — real-or-empty.** Wire real source from v1, else honest empty state. Never fake.
4. **Telemetry is the spine.** ONE registry `packages/telemetry/src/registry.ts`. Done = event
   proven to land a row in `activity_trail` (DB-assert, not UI-200).
5. **DB-wall.** No migration/seed/schema without founder approval; only the Database Agent writes.
6. **Nordic Split tokens only** (ADR-0366) — no hex, no inline `oklch()` in app code.
7. **Frozen design source** — port from canonical repo-internal source; `design-export/` is transient.

---

## Where we are (pipeline)

```
KARTLEGG ✓ → BESLUTT ◀ WE ARE HERE → PLANLEGG → BYGG
            (F2/F5 closed; forks + ADR-0047 pending)   (not started — env/Docker down)
```

**Proven port pattern = 4-file `-v2` unit:** `page.tsx` · `_lib/to-design-shape.ts` ·
`_components/<Name>.tsx` · `<domain>.css`. Copy-not-rewrite, side-by-side.
Reference: `apps/web/src/app/dashboard/people-v2/` + sandbox `oversikt-v2/` / `min-dag-v2/`.

**Sandbox = the fasit** (`/home/sxtnl/plugins/smartout-sxtn-sandbox/`, branch `development`) =
prior campaign's REAL output: 2 ported pages GREEN + coverage system + reuse-map (316 entities) +
domain spine. The trap corrected by the fasit: **"all 12 domains = re-skin" is WRONG** — only
shallow ones. vaktplan (91 mutations, 18 ungated writes), ansatte (24 hookless), kommunikasjon
(mock-only Skranke) = rewire + backend-gap.

---

## OPEN — blocks forward motion (needs Pontus / PO)

1. **Campaign home: sandbox vs master-refactor.** Real work lives in sandbox; rules-docs live here.
   Reconcile. *Reco: sandbox = execution home, pull rules-docs into it.*
2. ~~**SixtenC9**~~ **RESOLVED 2026-06-02** — was the `sixten` agent (`.claude/agents/sixten.md`),
   a generic heartbeat-coupled orchestrator persona, not design-handoff-relevant. Pontus pointed at
   the file; removed via `git rm` (recoverable from history). `@sixtenclaw_bot` Telegram ref in
   `ci-incident-conductor.md` is unrelated, left in place.
3. **Forks open:** F1 (pipeline vs direct-port — fasit favors direct-port) · F3 (token map) ·
   F4 (font) · F6 (color debt) · F7 (naming) · F10 (new modules) · F11 (backend gaps).
   Promote ruleset → **ADR-0047**.

---

## Next actions (infra-free, runnable now without Docker)

1. Get answers: campaign-home + SixtenC9 (Pontus); forks + ADR-0047 (PO via bridge).
2. Per-domain classification ×12 (keep / re-skin / rewire / new / remove).
3. Resolve 7 coverage-forks; tables-per-domain.
4. *Then* (needs env up + init — NOT my step): Foundation → golden-path → fan-out.

## Cautions
- **Don't run `/sxtn-init`** — that's Pontus/init.
- **Commit-early:** local got wiped once this session (`~/wsl` → `~/dev` move). Push promptly.
- **DB-wall** + **no shared FS with PO** + **confident ≠ authorized (C4).**
