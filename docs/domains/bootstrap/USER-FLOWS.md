---
title: "Bootstrap Domain — User Flows"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, user-flows, journeys, onboarding, setup-wizard]
---

# Bootstrap — User Flows

> Flow index only. Full journey definitions live in `docs/journeys/`. This file links, never duplicates.

---

## Verified Flows

### 1. New Workspace Voice Onboarding (admin)

**Status:** Verified — mission `onboarding-interview` exists and ships (`packages/ai/src/missions/registry.ts:14`).

**Surface:** `/onboarding` — voice-driven, Botsson as `Mark`

**High-level:**
1. Admin starts `/onboarding`, voice session begins
2. Botsson asks for name, business name, city
3. Botsson triggers BRREG + scrapling lookup
4. Botsson confirms/corrects: name, industry, employee count, departments, locations, zones
5. Botsson adds procedures (chat-only guard for PII)
6. Admin confirms `finalizeOnboarding` — explicit confirmation required
7. `finalize-workspace` EF runs → `bootstrap-cascade` EF (11 steps) → `onboarding_completed = true`
8. Admin redirected to `/dashboard`

**Journey file:** `docs/journeys/JOURNEY-onboarding-interview.md` — (not-yet-authored as a formal journey doc, mission exists in code)

---

### 2. Admin Self-Serve Setup Wizard (fallback)

**Status:** Verified — wizard exists at `apps/web/src/app/dashboard/setup/`, 9 adapters.

**Surface:** `/dashboard/setup` — shown when `!workspace.setup_guide_completed`

**High-level:**
1. Post-bootstrap: admin lands on `/dashboard`, sees setup guide prompt
2. Steps: Welcome → DocumentDrop → Governance → Payroll → Employment → Team → ShiftTemplate → Season → Handbook
3. Completion sets `workspace.setup_guide_completed = true`
4. Admin enters normal dashboard operation

**Journey file:** `docs/journeys/JOURNEY-dashboard-setup-wizard.md` — (not-yet-authored as formal journey, flow exists)

**Deviation note:** This wizard is admin self-serve (manual). The architectural intent is that Botsson drives this progressively. Current state is a tolerated deviation — see GAPS-AND-DEBT §Deviations.

---

## Aspirational Flows (not built)

### 3. Day-1 Critical Gate Closure — Botsson-Driven (aspirational)

**Status:** Not built. Requires bootstrap-coordinator + workspace_readiness table.

**Planned surface:** `/dashboard` or dedicated `/dashboard/bootstrap`

**Sketch:**
1. Admin returns for day-1 session
2. Botsson session starts → coordinator reads readiness
3. Open gates: `framework_binding`, `tariff_binding_decision`
4. Botsson surfaces: "Today let's confirm your Riksavtalen binding"
5. Botsson guides admin through tariff binding flow
6. Gate `tariff_binding_decision` closes → `workspace_readiness` row updated
7. Session ends — Botsson summarizes what was done, what's next tomorrow

**Journey file:** (not-yet-authored) — `docs/journeys/JOURNEY-bootstrap-day1-gate-closure.md`

---

### 4. Day-2-through-7 Progressive Setup — Week-1 Plan (aspirational)

**Status:** Not built. Requires bootstrap-coordinator + week-1 day plan algorithm.

**Sketch (day progression):**
- Day 1: Critical gates — framework binding + tariff decision
- Day 2: Employment contracts — confirm owner/admin contract
- Day 3: Governance — seed Mattilsynet routines + first policy
- Day 4: Season + budget — confirm season dates + budget coefficients
- Day 5: Team structure — assign team members, link positions
- Day 6: Shift templates — define first week's patterns
- Day 7: Review — Botsson reviews all gates, marks workspace fully ready

**Journey file:** (not-yet-authored) — `docs/journeys/JOURNEY-bootstrap-week1-progression.md`

---

### 5. Bootstrap State Review — Admin (aspirational)

**Status:** Not built.

**Surface:** A "readiness panel" on `/dashboard` or in DashboardShell

**Sketch:**
1. Admin sees visual checklist: which gates are open/closed
2. Each open gate shows: what it is, why it matters, how to close it
3. Clicking a gate → Botsson opens or deep-links to the relevant flow

**Journey file:** (not-yet-authored)
