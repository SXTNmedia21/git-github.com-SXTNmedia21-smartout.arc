---
title: Implementation Checklist — SmartOut Frontend Design Handoff
status: in_progress
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [checklist, roadmap, implementation, campaign]
---

# Implementation Checklist — SmartOut Frontend Design Handoff

> Simple overview. `[x]` = done. Phase order is locked (`redesign-wiring-pipeline`).

## BESLUTT — lock the rules
- [ ] Decide open forks: F1 (pipeline vs direct-port) · F6 (color debt) · F7 (naming) · F10 (new modules) · F11 (backend gaps)
- [ ] Promote locked ruleset → ADR-0047 (PO)
- [x] F2 (roles) + F5 (telemetry registry) — resolved on disk

## PLANLEGG
- [x] Reuse-map — 12 design domains → existing routes
- [ ] Per-domain classification (keep/re-skin/rewire) × 12
- [ ] Resolve 7 coverage-forks (dual calendar, parallel contract trees, dual AI surface, …)
- [ ] Tables-per-domain (static parse of `database.types.ts`)
- [ ] Worklist + wave order (lightest → heaviest)
- [ ] Confirm run-site (init worktree / direct-port)

## FOUNDATION — BYGG step 1 (serial, once)
- [ ] `/sxtn-init` worktree (Pontus / init step)
- [ ] Port design tokens once — NO→prod token map (F3)
- [ ] Font contract (F4: Cabinet Grotesk vs Instrument Serif)
- [ ] `.prettierignore` the design source
- [ ] login-proof + lint-clean + harness gate config

## GOLDEN-PATH — BYGG step 2 (serial, one domain)
- [ ] One backend-ready domain → full port + full gate battery green (proves the motion)

## FAN-OUT — BYGG step 3 (parallel)
- [ ] Remaining backend-ready domains, friction order — re-skin/rewire each, web + mobile

## GAP-TRACK (parallel, DB-wall gated — founder DB approval)
- [ ] Backend-gap domains close backend FIRST: oppgaver (`control_list_attempt`) · menykunnskap · seed-expansion

## Per-domain build loop (each domain)
`state plan → copy+adapter+wire → telemetry register+emit → gate battery green → G8 human accept`

## Cross-cutting (always)
copy-not-rewrite · no-ghost-data · Nordic tokens · telemetry-spine · mobile parity · evidence-on-disk · commit-early

---

# Orchestrator task list (what I do — infra-free now)

> Read-only PLANLEGG work I can run without Docker/init/DB.

- [ ] Per-domain classification × 12 (dispatch `code-explorer` per domain) — **starting `reports` now (template)**
- [ ] Resolve the 7 coverage-fork candidates from the seed
- [ ] Tables-per-domain (static parse `database.types.ts`)
- [ ] Assemble worklist + wave order from the classifications
- [ ] Crystallize the per-domain-classification workflow into a reusable **skill** (after the motion proves out)
- [ ] (blocked) Foundation + build — waits on env up + `/sxtn-init` + fork decisions
