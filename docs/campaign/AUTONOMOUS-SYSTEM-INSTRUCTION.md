---
title: Autonomous Telemetry-Driven Frontend Refactor — Operating Instruction
status: draft
created: 2026-06-03
updated: 2026-06-03
module: design-handoff
tags: [autonomous, telemetry, loop, instruction, north-star, gap-to-skill]
---

# Autonomous System Instruction — how I drive the frontend refactor

> **What this is.** The operating manual for me (Top Orchestrator, code side) to run the
> SmartOut frontend design-handoff as a **self-driving telemetry loop**: telemetry coverage
> finds the gaps → each gap-class has a skill → the loop builds each domain FAIL→PASS using
> those skills → it never stops until every domain reads all-green on disk.
>
> **Prime directive (from the lessons):** *do the thing, not the machinery about the thing.*
> One real page ported through the full loop comes BEFORE generalizing the loop. Product first,
> harness around proven motion second.

---

## 1. The core idea (one paragraph)

The design is **finished**. The work is faithful **port + wire**, not redesign. "Done" is not a
human verdict — it is a database query: every interactive element fires a **registered telemetry
event**, every mutation event is **proven to land a row in `activity_trail`**. So **telemetry is
the wayfinder**: an unaccounted event = a phantom = a gap = a unit of work. When zero events are
phantom across all domains, the frontend is done. The whole campaign is "drive telemetry coverage
to 100%, on disk, autonomously."

---

## 2. Persistent context — what I carry and where it lives

Five layers. Each survives a restart; none duplicates another.

| Layer | Holds | Lives in | Refresh cadence |
|-------|-------|----------|-----------------|
| **North-star** | where we are + where things live | `docs/campaign/ORIENTATION.md` + this file | every session start |
| **Resume state** | what I am, last session, open blockers | `docs/campaign/CONTEXT.md` + `HANDOFF.md` | end of every session |
| **Loop state (the truth)** | per-domain gate + blockers + counts | `<home>/telemetry-map/<domain>/control.json` + `AGGREGATE-control.json` | every loop iteration (read, never judge) |
| **Method memory (frozen)** | ~42 hard-won lessons | `docs/campaign/lessons/` (canonical = sxtn plugin) | append on new lesson |
| **Done-oracle** | every event type that must fire | `packages/telemetry/src/registry.ts` | when a domain registers events |

**Rule:** the loop reads layer 3 (control.json) for *truth*; everything else is navigation. If a
doc disagrees with control.json or code, **code/gate win** and the doc is patched (never the reverse).

---

## 3. The autonomous loop (mechanical, control.json-driven)

This is the `DRIVE-TO-100.md` machine, already specced + scripted in the sandbox.

```
DEFINITION OF DONE (0 friction), per domain:
    gate == "PASS"  AND  blockers == []  AND  every control_points value == true
  across ALL domains. No human verdict — `bash gen-dashboard.sh` reads it.

LOOP until all domains all-green:
  1. READ      every control.json            → current gate grid       (gen-dashboard.sh)
  2. PICK      highest-friction domain        → most blockers / events
  3. SELECT    the skill(s) for its gap-class → §5 catalog
  4. DISPATCH  a build/fix agent (sonnet)     → port + wire + register + emit
  5. VERIFY    on disk (separate verifier)    → rewrite that control.json
  6. REGEN     dashboard + append activity/feed.jsonl (logon→working→delivered→gate→logoff)
  REPEAT
HALT only when: pass==ALL, fail==0, missing_events==0, every blockers==[].
```

Three guarantees compose (control-point-loop lesson):
- **Can't fake done** — control.json gate is mechanical, read from disk.
- **Can't go dark** — `heartbeat.sh` pulse classifies each agent live/working/stalled/done.
- **Can't stop early** — the loop-gate wall re-fires until the disk read is all-green.

Observability = a **server-free text log** (`render-on-read`, tail-able) as primary; the
self-contained HTML dashboard (data baked inline, 0 fetch) as the rich secondary.

---

## 4. Gap-finding = the telemetry coverage scan

The gap oracle is **layer 2 (emitted), not layer 1 (defined)** — measure events actually firing
from a wired component, reconciled against the registry. A rosy "defined %" next to an all-FAIL
gate is the tell; trust the gate.

Each domain's `control.json` surfaces every gap explicitly, never hidden:

| Gap field | Meaning | Becomes work via skill |
|-----------|---------|------------------------|
| `events_missing_from_registry[]` | event the design needs, not in registry | **register-events** skill |
| `hooks_missing[]` | mutation with no data hook | **wire-hookless-mutation** skill |
| `noop_candidates[]` | button that does nothing | **gate-or-flag-noop** skill |
| `mutations` ungated | write with no auth/event gate | **gate-ungated-write** skill (DB-wall aware) |
| 0-row seed | e2e-blocked domain | **honest-empty-state** skill + Database-Agent seed (gated) |

---

## 5. Skill-per-gap-class (the reusable how-to library)

**One skill per gap-CLASS, not per domain** — reusable across all 13 domains. The loop *selects* a
skill by the blocker type; it does not improvise.

> **The catalog is canonical in [`FRONTEND-TOOL-LIST-PROPOSAL.md`](./FRONTEND-TOOL-LIST-PROPOSAL.md)**
> (A build-skills · B enforcement gates · C router; statuses verified on disk). Do **not** maintain a
> parallel list here — this section defers to that doc. Summary: **A1** `smartout-design-port` (✅,
> honest-empty-state folded in) · **A2** `register-events` (proven on min-dag-v2) · **A3**
> `wire-hookless-mutation` · **A4** `gate-ungated-write` · **B1** `check-design-tokens` (♻️ pre-commit
> hook #10) · **B6** `check-telemetry-coverage` (♻️ harden `emit-coverage.sh` — the done-oracle) ·
> **C1** `frontend-workflow-router`.

**Skill build protocol (per gap-class):** find the gap in ≥2 domains → extract the common motion
→ write the skill with mål + mening + the mechanical steps + the gate it feeds → prove it on one
domain → only then let the loop fan it out.

---

## 6. Order of operations (product-first, per the lesson)

```
STEP 0  Decide campaign-home (sandbox vs master-refactor)   ← BLOCKER, §8 Q1
STEP 1  GOLDEN PATH: drive ONE backend-ready domain FAIL→PASS through the full loop,
        end-to-end, by hand. Proves the motion + every script + the gate. (one running page > ten docs)
STEP 2  Reconcile the 144 missing events into registry.ts (the register-first sweep)
STEP 3  Crystallize the gap→skill library (§5) from what step 1 actually needed
STEP 4  ARM the loop in the worktree's .sxtn/ (loop-arms-in-project) — fan out the GREEN domains
STEP 5  GAP-TRACK: FAIL domains close their backend FIRST (DB-wall gated, founder approval)
HALT    when the disk read is all-green across all domains
```

I never declare done. I read it. I surface only at genuine decision points (irreversible, DB-wall,
G8 human-accept). Autonomy = act → verify on disk → report; not narrate-and-ask.

---

## 7. Hard rails (campaign contract — never crossed autonomously)

- **DB-wall** — no migration/seed/schema without founder approval; only the Database Agent writes.
- **Copy-not-rewrite** — ~2× source line-count = a rewrite → reject.
- **No ghost data** — real source or honest empty state; never fabricate.
- **Nordic Split tokens only** (ADR-0366) — no hex / inline oklch in app code.
- **One instance owns `.sxtn/`** — concurrent writers wipe each other; check heartbeat first.
- **G8 + commit + push + production-go = Pontus.** Confident ≠ authorized (C4).
- **Verify every relayed claim on disk** — no shared filesystem with the PO.

---

## 8. Decisions (locked 2026-06-03 by Pontus)
1. **Campaign-home = master-refactor.** This worktree is the execution home. The sandbox
   (`/home/sxtnl/plugins/smartout-sxtn-sandbox`) is the **fasit = read-only reference**; I seed its
   proven machinery (telemetry-map coverage system, DRIVE-TO-100 loop, scripts) + the 2 GREEN ported
   pages (oversikt-v2, min-dag-v2) **into** this branch as the starting seed, commit, then run here.
2. **Skill granularity = per gap-class.** ~4 reusable skills (register-events, wire-hookless-mutation,
   gate-ungated-write, honest-empty-state), fanned across all domains. Not per-domain.
3. **Loop driver = hand-drive golden-path first.** Manually drive ONE backend-ready domain FAIL→PASS
   through the full loop to prove every script + gate; only then arm the autonomous `/goal` Stop-hook
   loop. (Loop ownership — `harness-agent-loop-ownership` lesson is OPEN — resolve before arming.)
4. **Infra = up now, together.** Bring env up this session (Docker, local Supabase, `/sxtn-init`) so
   golden-path builds + verifies against a live DB end-to-end. Mind sibling-worktree port clashes
   (`local-supabase-multi-project-ports`) + WSL2 OOM (endemic).
