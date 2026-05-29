---
sortie: day-line-zone-readback
domain: day-session
state: S5
sub_state: plans-generated
tier: T3
test_mode: continuous
design_link: docs/domains/day-session/day-planner/project/Manager Timeline.html (BINDING Cloud Design — pixel-match)
adr_refs: [ADR-0367 (D6 tri-layer department_session→day_line→shift_session), ADR-0430 (zone M:N readback), ADR-0133 (mobile reader-only + packages/data parity), ADR-0366 (OKLCH literal ban), ADR-0112 (same-commit Zod+enum), L-0042, L-0176]
created_at: 2026-05-29T02:00:00Z
updated_at: 2026-05-29T02:00:00Z
campaign: development (sortie from main; merges to development via /close-feature)
worktree: /home/sxtnl/dev/smartout.ai-wt-1 (verified; branch feat/day-line-zone-readback @ 6ac7593ea)
import_mode: false
structural_block: "suspended — Agent/Task tool NOT exposed this session (per memory feedback_hard_rule_8_vs_tool_layer). Pontus mandate 2026-05-29 'komplett delivery, no stops' = Path 1 endemic auth. T3 design-binding → Path 1 with self-review against the binding mockup + the design+a11y axis (L-NEW-3). frontend-designer dispatch impossible (no Agent tool); orchestrator self-runs the fidelity + a11y axis checklist manually against Manager Timeline.html + v6.png, documents in reports/."
---

# STATE — day-line-zone-readback (day-line P1: zone readback + design-fidelity build)

> Pontus's ORIGINAL ask: make the day-line working + match the binding Cloud Design.
> ADR-0430 dropped scalar zone/location_id; the readback paths were stubbed null in Phase b.
> This sortie restores them AND builds the right-rail + un-stubs the bands to match `Manager Timeline.html`.

## Tier rationale

**T3** — design-binding (pixel-match mockup), multi-route (web Tidslinjen + mobile reader), real build (right-rail
from scratch + bands un-stub + new schema column). Reduced product-accept: no Agent tool → orchestrator self-runs
the frontend-designer fidelity + a11y axis (L-NEW-3) against the binding mockup, documents verdict in reports/.

## Binding design contract

`docs/domains/day-session/day-planner/project/Manager Timeline.html` + imports (`timeline-app.jsx` RightRail/NowSnapshot/KpiBox,
`timeline-styles.css` / inline `.rail*`, `tokens.css`). Render targets: `scraps/v6.png` (band-columns + rail). The
main grid is `1fr 380px`; `.rail` = tabs (Akkurat nå / Detalj / Melding / Avvik) + STATUS (4 KPI) + Krever-oppmerksomhet
+ Pågående + Neste. **KpiBox DERIVES counts from source rows (onShift/activeNow/openDevs/upcoming .length) — Pontus law: never increment.**

## Scope (5 plans)

| # | File | Plan-tier | Scope |
|---|------|-----------|-------|
| 1 | `plans/PLAN-1-web-location-readback.md` | T2 | #2 — `use-day-timeline-events.ts:336` locationByShift null → resolve via shift_session→shift_session_day_line→day_line.location_id. Restores Tidslinjen chip-bar location filter. |
| 2 | `plans/PLAN-2-mobile-zones-embed.md` | T2 | #1 — mobile shift query zones[] M:N embed. Relocate shift query logic to packages/data (ADR-0133 parity), mobile re-export shim. Propagate zones[] to ShiftCard/BeforeShiftView/ShiftClockView (READER only). |
| 3 | `plans/PLAN-3-right-rail.md` | T3 | Design-fidelity RED — build the missing right-rail. main grid 1fr→`1fr 380px`; rail tabs + STATUS KPI cards + Krever/Pågående/Neste. KPI DERIVE (never increment). frontend-designer fidelity gate. |
| 4 | `plans/PLAN-4-bands-unstub.md` | T3 | bands derive employees from task-assignees only → land useEmployeesForDate (schedule_shift + profile) for real roster + EmpStrip. session_task.duration column (migration > 20260801000006, L-0042) replaces hardcoded 60min. |
| 5 | `plans/PLAN-5-ux-a11y-token.md` | T2 | UX-council deferrals: P4 NowLine SR current-time announce; P6 text-2xs token (WCAG 1.4.4, 9.6px→token). text-2xs touches packages/design-tokens = ADR-0366 → run-council design-token gate BEFORE sweep. |

## Test mode

**continuous** — per-plan verify green before next. PLAN-4 adds a migration (irreversible-ish); PLAN-3 is the
fidelity centerpiece (self-accept against mockup before generalizing).

## Gate history

| Gate | State | Result | Timestamp | Note |
|------|-------|--------|-----------|------|
| G1 | S1 | PASS | 2026-05-29 | Binding Cloud Design reachable (local file + v6.png render read). |
| G2 | S2 | PASS | 2026-05-29 | INVENTORY: 3 readback targets verified (use-day-timeline-events:336, mobile use-my-shifts:94+168, ManagerTimelineShell:338-354+315+496). Join schema verified vs live DB (shift_session.schedule_shift_id FK, shift_session_day_line, day_line.location_id). packages/data/day-session is the ADR-0133 home. |
| G3 | S3 | PASS | 2026-05-29 | No open questions; mockup is the fixed contract. |
| G4 | S4 | PASS | 2026-05-29 | No SPEC — binding mockup + this STATE = the contract. |
| G5 | S5 | PASS | 2026-05-29 | 5 plans, continuous. Auto-pass (Pontus delegated full delivery). |
| G6 | S6 PLAN-1..5 | PENDING | — | Per-plan verify. frontend-designer fidelity gate on PLAN-3 + PLAN-4. |
| G6 council | PLAN-5 | PENDING | — | run-council design-token gate (text-2xs) BEFORE the token sweep. |
| G7 | S7 | PENDING | — | turbo typecheck + lint at close. |
| G8 | S8 | PENDING (reduced) | — | Self-run frontend-designer fidelity verdict vs Manager Timeline.html + v6.png; documented in reports/FIDELITY-VERDICT.md. |

## Next action

Build PLAN-1..5 in order (Path 1 self-write, sonnet-equivalent for build / opus for the fidelity+council gates).
Plans committed to feat branch first (propagation rule).
