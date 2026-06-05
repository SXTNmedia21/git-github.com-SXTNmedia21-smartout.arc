---
title: "Handoff — Restaurant Week Simulation"
status: done
created: 2026-05-25
updated: 2026-05-25
module: meta
tags: [handoff, simulation, audit]
---

# Handoff — Restaurant Week Simulation

## Summary

Three-phase autonomous gap/bug sweep of Smartout via 11 industry-intelligence council-persona agents simulating real hospitality operations:

- **Phase 1** — Bistro week, 18-employee Oslo restaurant "Bella Vista" (7 days)
- **Phase 2** — Hotel wedding, 80-guest 3-day event at Grand Hotel Sjølyst
- **Phase 3** — Concert/festival, 1200-guest single-day "Sjølyst Sommerfest" with 60 staff

Output: `docs/test-runs/2026-05-25-restaurant-week-sim/` containing 3 phase plans, 11 raw findings, and 3 consolidated sheets.

## What was built

**No code.** This is an audit deliverable. Code-side outputs:

| Path | Size | Purpose |
|---|---|---|
| `docs/test-runs/2026-05-25-restaurant-week-sim/INDEX.md` | small | Run navigation |
| `docs/test-runs/2026-05-25-restaurant-week-sim/SIMULATION-PLAN.md` | small | Bistro week journey scaffolding |
| `docs/test-runs/2026-05-25-restaurant-week-sim/HOTEL-WEDDING-PLAN.md` | small | Hotel scaffolding |
| `docs/test-runs/2026-05-25-restaurant-week-sim/CONCERT-FESTIVAL-PLAN.md` | small | Festival scaffolding |
| `docs/test-runs/2026-05-25-restaurant-week-sim/findings/agent-{1..11}-*.md` | ~2700L | Raw per-agent findings, retained for downstream verification |
| `docs/test-runs/2026-05-25-restaurant-week-sim/BUGS.md` | 316L | 28 NEW bugs (4 CRITICAL, 9 HIGH, 12 MEDIUM, 3 LOW) |
| `docs/test-runs/2026-05-25-restaurant-week-sim/GAPS.md` | 604L | 47 NEW gaps (7 CRITICAL, 27 HIGH, 13 MEDIUM) |
| `docs/test-runs/2026-05-25-restaurant-week-sim/SYNTHESIS.md` | 258L | 10 cross-cutting patterns + strategic roadmap |
| `docs/journeys/JOURNEY-restaurant-week-sim.md` | this file | Journey doc |
| `docs/HANDOFF-restaurant-week-sim.md` | this file | Closure handoff |
| `docs/plans/PLAN-restaurant-week-sim.md` | stub | Plan from `/start-feature` |

## Decisions made (none committed to decision log)

The sim itself made **no architectural decisions**. It surfaced **decision candidates** for future ADRs:

| Candidate | Source | Recommended next step |
|---|---|---|
| Event-as-first-class entity (`event` + `event_phase` + `event_settlement`) | A6, A7, A8, A10 | Draft ADR — single decision unlocks 12+ gaps |
| `employment_form_enum` extension (volunteer, casual/dagarbeid, tilkalling clarification) | A1, A5, A9, A11 | Draft ADR — Norwegian labor-law shapes |
| Compliance gates at `lock_period` (Ferieloven §10, OTP-loven, Bokf. §13) | A5 | Draft ADR — silent statutory breach risk |
| Bootstrap-cascade completeness audit (workspace_settings + capability_default_registry triggers) | A1, A4 | Run audit-cascade audit + fix one trigger |
| `tip_pool` cross-department parent entity | A6, A7, A8 (5 agents) | Schema migration ADR |
| Multi-vendor sub-workspace model | A9, A11 | Architecture ADR (likely scoped out → "Smartout Events" product line per SYNTHESIS) |
| C2 intelligence pipeline (auto-shift-briefing) | A4 | Campaign-sized — highest leverage per SYNTHESIS |

None of these are registered in `0000-decision-log.md` — they belong to future sorties that pick up the work.

## Learnings

### L-SIM-1 — Industry-intelligence personas surface gaps generic-code-trace agents miss

Five agents (A6/A7/A8/A10/A11) flagged event-entity gaps that the existing `adr-contract-audit` skill never detected because the audit only checks against existing ADRs. Council-persona simulation surfaced what's NOT yet an ADR. **Implication:** pair adr-contract-audit (verification) with role-immersion sims (discovery) on a quarterly cadence.

### L-SIM-2 — Built-but-disconnected is a recurring class of defect

7 surfaces flagged across A1/A3/A4/A5 had registry entries / capability declarations / DB tables / migrations but NO UI binding. Examples:
- `useGPSGuard` exists; `usePunch.punchIn()` never calls it (A3)
- Tips capability bodies all return `not_implemented` despite DB schema + authority seeds applied (A3)
- `payroll.period.approved_by` column + enum exists, no BFF route (A5)
- `communication` capability registered, capability_default_registry doesn't seed for new workspaces (A4, root of BUG-1)

**Implication:** Wire-up audit is its own class of work. The 14-axis adr-contract-audit skill should grow a "registered but unwired" check.

### L-SIM-3 — Cascade architecture bends to hotel naturally; festival is a different beast

A6's verdict: hotel cascade gap is a missing `hospitality.no.hotel.v1` industry sub-package (D5 parameterization), not a cascade architecture flaw. The schema already supports `location_type:'event'`, `Hotelloverenskomsten` tariff data, NACE 55.101 department presets.

A11's verdict: festival surfaces (pop-up departments, multi-vendor sub-workspaces, casual labor, capacity tracking, real-time security incidents) likely warrant a **separate product line ("Smartout Events")** rather than feature extension.

**Implication:** Roadmap should split — hotel = sub-package campaign in current product. Festival = new product line evaluation.

### L-SIM-4 — Compliance silence at period close is the highest-stakes single gap

A5 found `lock_period` ALLOWS advancing without:
- `vacation_pay_pct ≥ 10.2%` (Ferieloven §10)
- mandatory pension scheme for OTP-loven-qualifying employees
- `approved_by` populated for Bokf. §13 audit provenance

Each is a statutory breach risk. **Implication:** any sortie touching payroll period flow must close these BEFORE next paid workspace ships.

### L-SIM-5 — Eleven parallel sonnet agents + one opus synthesizer is a working pattern

~11 agents × ~5 min each + 1 synthesizer × ~12 min = ~17 min wall time for ~2700-line audit output. Total token use modest given output volume. **Implication:** pattern reusable for any future cross-vertical or cross-feature audit. Document as a sortie blueprint.

## Known issues / debt left behind

| Item | Severity | Owner |
|---|---|---|
| 28 NEW bugs un-shipped — none touched in this sortie | varies | Future sorties, prioritized via BUGS.md fast-wins table |
| 47 NEW gaps un-addressed — none touched in this sortie | varies | Future ADRs + campaigns |
| Findings cite file:line on `feat/restaurant-week-sim` branch (= dev as of merge time). Drift risk after 30 days. | systemic | Re-verify on any sim-derived sortie kickoff |
| No ADR drafted yet for the 7 decision candidates | sortie scope-out | Whichever ADR-author picks one up first |

## Next steps

**Immediate (this week):**
1. Pontus reviews SYNTHESIS.md
2. Pick top 3 actions from "this week" recommendations (BUG-1 root fix, HelpDesk → `open_ticket` wire-up, mechanical fast-wins)
3. Dispatch 1-2 hotfix sorties off `development` to land

**This month:**
1. Draft ADR — event-as-first-class entity
2. Draft ADR — employment_form_enum extension
3. Draft ADR — compliance gates at period close

**This quarter:**
1. Campaign C2 intelligence pipeline (auto-shift-briefing in session channel)
2. Hotel `hospitality.no.hotel.v1` sub-package campaign
3. Evaluate festival = new product line "Smartout Events"

## Closure

Branch: `feat/restaurant-week-sim`
Worktree: `~/wsl/smartout.ai-wt-1`
Base: `development`
Typecheck: docs-only feature (no code change, no type impact — expect cache hit)
Merge: ready via `~/.claude/scripts/close-feature.sh 1` (sortie pool wt-1)
Post-merge: suggest `/promote-preview` (only Pontus runs this per CLAUDE.md)
