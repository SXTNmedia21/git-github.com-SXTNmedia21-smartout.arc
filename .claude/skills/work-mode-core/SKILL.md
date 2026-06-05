---
name: work-mode-core
description: Use when working inside the SmartOut master-refactor campaign — porting/wiring a page, building a capability, marking or tracking a component, capturing a deviation or idea, or deciding whether something is "done." The mode-less operating core every campaign worker mounts. Symptoms it answers — "is this page done?", "may I write this table?", "where does X live?", "I found a gap", "should I rewrite this?". Orchestrators load work-mode-orchestrator ON TOP of this.
updated: 2026-06-03
---

# Work-Mode Core

The mode-less operating spine for anyone working the SmartOut app folder. Mount it and you carry the
rails, the registers, the captures, and the done-oracle in one place. It does **not** re-inline the deep
skills — it **points** to them. Orchestrators stack `work-mode-orchestrator` on top; everyone else this
IS the surface.

**One principle:** the work is faithful **porting + wiring**, proven on disk — not redesign, not
self-report. When in doubt, the rule below wins; the detail lives in the pointer.

## 1. Done-oracle — telemetry-as-done (the only "done" that counts)

A surface is **done** only at page-polish **Level 3 (Proven & Enforced)**: every registered event fired
for real lands a row in `public.activity_trail` (non-empty `workspace_id` + `actor_id`) — **DB-assert,
not UI-200.** L2 = emit wired; L3 = emit proven. A page that emits nothing real is a **phantom**, however
polished. No domain closes while any event is phantom.
→ `smartout-page-polish` (L1→L2→L3, Phase 5.5), `packages/telemetry/src/registry.ts`.

## 2. Registers — "what do I have, and its state"

- **Skills** — the capabilities available (this core + the deep `smartout-*` + build skills).
- **Components & systems** — each + lifecycle `proposed → worked → wired → emitting → proven`.
- **Knowledge & enhancers** — lessons, Tell-Me-Telemetry, design pointers.

## 3. Captures — cheap, and each one ESTABLISHES three things

Drop an **avvik**, drop an **idea**, **mark + track** a component, **carry-with** context. A capture is
not free text — before it moves it establishes:

- **Create-or-not?** Justification, not reflex. **mark ≠ implement** — capture intent first, build later.
- **Competence / special knowledge?** Which skill / domain / human it routes to.
- **Human in the loop?** Does a human hold a gate (C4 / DB-wall / G8)? Set the flag at capture, not at merge.

## 4. Enforcement gate (the wall)

- **L1→L2→L3** — not closed below L3 (see §1).
- **Real-or-empty** — wire to the real source from v1; no source → honest empty state. Never fabricate.
- **DB-wall** — no migration / seed / schema without founder approval; only the Database Agent writes
  schema. A missing table is a **finding to surface**, never a license to invent one.
- **Confident ≠ authorized (C4)** — recommend; the human decides G8 + production.
- **Commit through the gate — pipeline control (core feature).** Nobody commits free-hand. **Every** commit
  routes through `commit-steward`: it runs the Definition-of-Done check, **bounces** anything not gate-green,
  writes the commit ledger, and tags by domain+tier. Agents leave staged work for the steward; **Pontus
  pushes.** One gate = control of the whole pipeline + every commit legible (see
  `docs/campaign/LOG-LEGIBILITY-STANDARD.md`). A free-hand commit is a hole in the pipeline — there isn't one.

## 5. Rails (non-negotiable)

Copy-don't-rewrite (port 1:1; ~2× line-count = rewrite → reject) · reuse-first, additive-only · no-ghost-data ·
Nordic-Split tokens (no hex/inline oklch in app code) · evidence-on-disk (read the gate, not a worker's word) ·
verify-relayed-claims · never `--no-verify` · commits route through `commit-steward` (never free-hand) · Pontus pushes.

## Your memory (agent_id-keyed — core feature)

Every agent that mounts a skill has its **own durable memory** at `.claude/agent-memory/<agent_id>/` —
keyed by the same `agent_id` the log-standard uses. It is yours; no other agent writes it.

- **On mount:** read `.claude/agent-memory/<agent_id>/` — your accumulated facts from prior runs. Fresh
  context each dispatch, never amnesiac.
- **When you learn something durable** (a trap, a path, a recurring gotcha): write **one fact per file** —
  frontmatter (`name` · `description` · `type`) + the fact + `[[links]]` to related — same convention as the
  global memory. One fact, one file.
- **Keyed by `agent_id`** so a builder's lessons don't pollute the orchestrator's, and a log line citing
  `agent_id=X` joins straight to that agent's memory.

This is how the roster gets smarter across waves **without** carrying stale context in-prompt.

## Pointers (do NOT re-inline)

| For | Skill / path |
|-----|--------------|
| Done depth + L3 proof | `smartout-page-polish` |
| Design tokens / fonts / motion | `smartout-nordic-split` |
| DB / RLS / migration / types | `smartout-database-guide` |
| Edge functions / auth | `smartout-edge-function-guide` |
| Cascade / schedule / tariff | `smartout-cascade-developer` |
| Payroll / lønn | `payroll-engine-developer` |
| Telemetry done-oracle | `packages/telemetry/src/registry.ts` |
| North-star (where we are) | `docs/campaign/ORIENTATION.md` |
| Full rule dossier (~70) | `docs/superpowers/specs/2026-06-02-design-handoff-rules-of-engagement-dossier.md` |

## Red flags — STOP

- "It works / toast is green" → not done. L3 = a row in `activity_trail`. (§1)
- "I'll rewrite it cleaner" → no. Copy 1:1. (§5)
- "The table's missing, I'll add it" → no. Surface the finding. (DB-wall, §4)
- "I'll seed a sample row so it's not empty" → phantom. Honest empty state. (§4)
- "The relay said it's green" → unverified until you read the gate on disk. (§5)
