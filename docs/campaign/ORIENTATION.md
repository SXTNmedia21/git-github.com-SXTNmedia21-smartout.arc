---
title: Campaign Orientation — SmartOut Frontend Design Implementation
status: in_progress
created: 2026-06-02
updated: 2026-06-03
module: design-handoff
tags: [orientation, north-star, campaign, design-handoff, map]
---

# ORIENTATION — SmartOut Frontend Design Implementation

> **North-star + campaign map. Read first at every session start.** Pointer-first: if it disagrees
> with code or canon, **code/canon win** and this file is patched. Refreshed 2026-06-03 to reflect
> the full 72h corpus (design-canon, mission roadmap, governance, the dev-lane real-route landing).

## What this worktree is

`campaign/master-refactor`, code side (Tmux). One job: land the **finished Nordic Split design**
onto the existing live SmartOut app — reuse-first, page by page, web + mobile. The design is done;
our work is faithful **port + wiring**, not redesign.

## Where we are — mid-BYGG (the doc marker moved 2026-06-03)

```
KARTLEGG ✓ ──► BESLUTT ✓* ──► PLANLEGG ✓ ──► BYGG ◀ HERE (fan-out)
```
- **KARTLEGG** ✓ — rules mined (dossier), routes/pages/schema mapped (seed).
- **BESLUTT** ✓* — forks resolved (F2/F5 on disk); ruleset → **ADR-0047** still PO-pending (the only
  thing keeping this from full ✓). Operating model now locked in **ADR-0441** (see Governance).
- **PLANLEGG** ✓ — reuse-map + 14-domain telemetry-map gates + done-oracle loop (`DRIVE-TO-100.md`).
- **BYGG** ◀ — golden-path SHIPPED (`min-dag-v2`, `34ad5947a`, gate GREEN). Now fan-out.

**Disk reality 2026-06-03:**
- **min-dag-v2** — tracked, gate GREEN, tag `min-dag/ready` (the reference motion).
- **oversikt-v2** — ported, tier **wip-L2**, tracked on campaign (`e26bf6425`).
- **oversikt design LANDED ON THE REAL ROUTE** — the live `/dashboard` Oversikt admin variant now
  renders the Nordic Split `OversiktCockpit` on the **`development`** branch (`d7bd69705`). First
  real-route design change; tier wip-L2 (L3 deferred to a running app).
- Done-oracle grid: 10 scored · 1 PASS · 5 GREEN(L2) · 5 FAIL · 102 events still missing.
- **Zero domains at L3** (activity_trail landing unproven — needs the smartout local Supabase up;
  `:54321` currently serves sxtn-ops, not the app — verify before any L3).

## Two lanes right now (ADR-0441)

| Lane | Worktree / branch | Owner | Scope |
|------|-------------------|-------|-------|
| **Web canon + ports** | `smartout.ai-master-refactor` / `campaign/master-refactor` | sibling orchestrator | MISSION-MANIFEST/DASHBOARD, campaign docs, web `-v2` ports |
| **Real-route landing + gate-harden** | `smartout.ai` / `development` | this orchestrator | land the design on REAL routes (oversikt done), hook/lint gate-harden |

> ⚠ Two Opus orchestrators shared this branch → 3 collisions (board, L-0372, ADR-registration).
> **ADR-0441 lock is written but NOT yet wired** into the write-path — until then, coordinate via
> Pontus + commit with explicit paths only. Never `git add -A` here.

## Governance — the five pillars (ADR-0441 + dossier + CLAUDE.md)

1. **Single-writer / lock-gated** — `sxtn-lock-acquire` before any `docs/campaign/` or `.sxtn/` write (ADR-0441). *Not wired yet — the open gap.*
2. **Lanes don't cross** — orchestrator dispatches · builder ports · verifier grades · commit-steward commits · Pontus pushes/G8.
3. **Evidence on disk, not claims** — done = a disk read (control.json / typecheck / activity_trail row).
4. **Telemetry-spine / L2→L3** — every element fires a registered event; done = L3; GREEN=L2≠done.
5. **DB-wall + C4** — no migration/seed/schema without founder; confident ≠ authorized; G8/push/prod = Pontus.

## Where everything lives (full corpus)

| Thing | Path | Note |
|-------|------|------|
| Operating contract | `CLAUDE.md` | rules everyone follows |
| **Operating-model ADR** | `docs/decisions/0441-multi-orchestrator-operating-model-and-l2-l3-contract.md` | the 5 pillars · L2/L3 · waves |
| Locked rules + forks | `docs/superpowers/specs/2026-06-02-design-handoff-rules-of-engagement-dossier.md` | ≈70 rules, 19 forks |
| Route/page/schema inventory | `docs/superpowers/seeds/2026-06-02-route-page-inventory-seed.md` | ~167 web pages · ~305 tables |
| **Mission roadmap** | `docs/campaign/MISSION-MANIFEST.md` | tracks · waves W0–W4 (friction-first, vaktplan LAST) · milestones M0–M5 |
| **Live status board** | `docs/campaign/MISSION-DASHBOARD.html` | self-contained, regenerated from control.json |
| **Consolidate→bootstrap plan** | `docs/campaign/CONSOLIDATE-THEN-BOOTSTRAP-PLAN.md` | clean-ground-then-arm sequence |
| **Agent onboarding** | `docs/campaign/AGENT-ONBOARDING.md` | "you just mounted, do this" front-door |
| **Design canon (19 files)** | `docs/campaign/design-canon/` | `DESIGN-CANON.md` index · `components.md` · web+mobile sitemaps · sidebar audits — frozen from sandbox fasit |
| Autonomous-loop instruction | `docs/campaign/AUTONOMOUS-SYSTEM-INSTRUCTION.md` | the telemetry-driven loop |
| Frontend tool-list (canonical) | `docs/campaign/FRONTEND-TOOL-LIST-PROPOSAL.md` | A build-skills · B gates · C router |
| Log-legibility standard | `docs/campaign/LOG-LEGIBILITY-STANDARD.md` | annotation/log format |
| **Done-oracle + loop** | `docs/campaign/telemetry-map/` | `AGGREGATE-control.json` · `gen-dashboard.sh` · per-domain `control.json` (14) · `DRIVE-TO-100.md` |
| Method lessons (42, frozen) | `docs/campaign/lessons/` | survives ingest; canonical home = sxtn plugin |
| Commit ledger | `docs/campaign/COMMIT-LEDGER.md` | hash · domain · tier · gate |
| The finished design source | `design-export/smartout/project/apps/{web,mobile}/` | **transient** — emptied on `/sxtn-design-ingest` |
| Design-system rules | `smartout-nordic-split` skill | authoritative |
| Reference port (proven) | `apps/web/src/app/dashboard/min-dag-v2/` | copy this shape — tracked, gate GREEN (`34ad5947a`) |
| Real-route landing (proven) | `smartout.ai`/`development`: `apps/web/src/app/dashboard/_components/oversikt/` + `page.tsx` swap | `d7bd69705` |
| Telemetry registry (done-oracle) | `packages/telemetry/src/registry.ts` | one registry; `events.ts` gone |
| Commit gate | `commit-steward` skill | DoD + bounce + tag by domain+tier |

## Read first (in order)

1. `CLAUDE.md` — operating contract.
2. This file — where we are + where things live.
3. `docs/decisions/0441-...` — operating model (5 pillars · L2/L3 · waves).
4. `docs/campaign/MISSION-MANIFEST.md` — the roadmap.
5. The relevant `smartout-*` skill for the surface you touch.

## Topology (one line)

PO (web, owns canon) — bridge = **Pontus** — two orchestrators (master-refactor + development) +
Database Agent (single schema writer). **No shared filesystem; verify every relayed claim on disk.**

## Open items right now

- **ADR-0047** — promote the locked ruleset to a campaign ADR (PO).
- **Wire the lock (governance pillar #1)** — `sxtn-lock-acquire` into the write-path; until then, 3-collision risk.
- **F0.3** — `no-direct-supabase-write` `warn → error` (fasit blocking item, still warn).
- **F0.1** — collapse the two diverged registries (`packages/data/.../events.ts` ↔ `packages/telemetry/registry.ts`).
- **L3 unblock** — bring up the smartout local Supabase (not sxtn-ops on `:54321`) → prove first L3.

## Next action

Wire governance pillar #1 (the lock) so the lanes stop colliding; in parallel, continue landing the
design on real routes (oversikt done → next backend-ready domain) and drive one domain to real L3
once the smartout local Supabase is up.
