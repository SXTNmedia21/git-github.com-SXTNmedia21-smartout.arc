---
title: HANDOFF — SmartOut Frontend Design Handoff campaign (resume point)
status: in_progress
created: 2026-06-02
updated: 2026-06-02
module: design-handoff
tags: [handoff, resume, campaign, restart]
---

# HANDOFF — resume point (2026-06-02)

> Read this first on restart, then `docs/campaign/ORIENTATION.md`. Everything below is committed +
> pushed to origin `campaign/master-refactor` (tip `b88bcc39`). Local was wiped once this session —
> **trust origin, not disk.**

## One-line state
Campaign at **BESLUTT → PLANLEGG**. Rules mapped, fasit reviewed, port-skill drafted. **No build yet**
(env/Docker down; `/sxtn-init` NOT mine to run). Two decisions block forward motion (below).

## Pipeline position
`KARTLEGG ✓ → BESLUTT ◀ (F2/F5 closed; forks + ADR-0047 pending) → PLANLEGG (reuse-map ✓, classification todo) → BYGG (not started)`

## Topology (critical — no shared filesystem)
- **PO** (`chronicle-product-owner`, web/Cloud Code) — owns canon, decides forks. Can't see this code.
- **Me** (Top Orchestrator, this worktree `~/dev/smartout.ai-master-refactor`, code side) — gather/verify/dispatch, feed evidence up. `.claude/agents/sxtn-top-orchestrator.md`.
- **Sandbox** `/home/sxtnl/plugins/smartout-sxtn-sandbox/` (branch `development`) = **the fasit** = prior campaign's REAL output (2 ported pages + coverage system + reuse-map + domain spine).
- **Bridge = Pontus (copy-paste).** Verify every relayed claim on disk.

## Done (committed @ origin b88bcc39)
| Artifact | Path |
|---|---|
| Operating contract | `CLAUDE.md` |
| North-star | `docs/campaign/ORIENTATION.md` |
| My role | `.claude/agents/sxtn-top-orchestrator.md` |
| Locked rules + 19 forks | `docs/superpowers/specs/2026-06-02-design-handoff-rules-of-engagement-dossier.md` |
| Route/page/schema inventory | `docs/superpowers/seeds/2026-06-02-route-page-inventory-seed.md` |
| F2/F5 resolved | `docs/campaign/F2-F5-evidence.md` |
| F7 domain naming proposal | `docs/campaign/F7-domain-naming-proposal.md` |
| Reuse-map (corrected by fasit) | `docs/campaign/reuse-map.md` |
| **Fasit review** (proven template + state truth) | `docs/campaign/fasit-review.md` |
| Implementation checklist | `docs/campaign/IMPLEMENTATION-CHECKLIST.md` |
| **Port skill (draft)** | `.claude/skills/smartout-design-port/SKILL.md` |
| 42 method lessons (frozen) | `docs/campaign/lessons/` |

## Key findings
1. **Proven port pattern = 4-file `-v2` unit** (page.tsx · _lib/to-design-shape.ts · _components/<Name>.tsx · <domain>.css), copy-not-rewrite, side-by-side. Full recipe in `fasit-review.md` + the skill. References: sandbox `oversikt-v2/` + `min-dag-v2/`.
2. **Done in sandbox:** oversikt-v2 + min-dag-v2 GREEN; 8 domains telemetry-mapped (FAIL + blocker catalog); handbook/oppgaver stubs.
3. **"All 12 = re-skin" is WRONG** — only shallow domains. vaktplan (91 mutations, 18 ungated writes), ansatte (24 hookless mutations), kommunikasjon (mock-only Skranke) etc. are rewire + backend-gap.
4. **F5 resolved:** one registry `packages/telemetry/src/registry.ts` (`events.ts` gone). **F2 resolved:** foreman=campaign drive, harness-builder=rails; distinct loops; one instance owns `.sxtn/`.
5. Sandbox has machine `reports/backend-reuse-map.json` (316 entities) + `.sxtn-staging/telemetry-map/` coverage system (`DRIVE-TO-100.md`, control.json per domain).

## OPEN — needs Pontus/PO (blocks forward)
1. **Campaign home: sandbox vs master-refactor.** Real work lives in sandbox; rules docs here. Reconcile. *Reco: sandbox as execution home, pull rules-docs in.*
2. **SixtenC9** — Pontus said "ta bort SixtenC9, vi skal ikke ha den" — UNIDENTIFIED. Do not delete until clarified.
3. **Forks** still open: F1 (pipeline vs direct-port — fasit favors direct-port) · F3 (token map) · F4 (font: Cabinet Grotesk vs Instrument Serif) · F6 (color debt) · F7 (naming) · F10 (new modules) · F11 (backend gaps). Promote ruleset → ADR-0047.

## Next actions (when resumed)
1. Pontus: answer campaign-home + SixtenC9.
2. PO: decide forks + ADR-0047.
3. Then (infra-free, can run without Docker): per-domain classification ×12, resolve 7 coverage-forks, tables-per-domain.
4. Then (needs env up + init, NOT my step): Foundation → golden-path → fan-out.

## Cautions
- **DB-wall:** no migration/seed/schema without founder approval; Database Agent only.
- **Don't run `/sxtn-init`** — that's Pontus/init.
- **Commit-early:** local got wiped once (~/wsl→~/dev move); push promptly.
- **No shared FS** with PO — bridge is Pontus.
- `smartout-design-port` skill is a **draft** — Pontus refines ("vi lager en skill med mål og mening").
