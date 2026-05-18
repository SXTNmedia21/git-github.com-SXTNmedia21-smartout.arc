---
title: JOURNEY — m6 planning polish
feature: m6-planning-polish
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: dashboard-planning
tags: [polish, journey, ui-shell, m6]
---

# JOURNEY — Planning cluster reaches production-grade polish

Three dashboard routes pass the 8-phase `smartout-page-polish` workflow.
Each journey describes the user-facing outcome after polish, not the
implementation steps (those live in `PLAN-m6-planning-polish.md`).

## Journey: Manager reviews cascade change-proposals

**Precondition:** Signed-in manager on `/dashboard/proposals`. Workspace has ≥ 1 change-proposal row (D6 → C2 path).

1. Page loads with a skeleton matching the final layout (no flash).
2. Header: "Forslag" + one-line description explaining what proposals are for.
3. List renders with Nordic Split semantic tokens — no zinc/gray hardcodes.
4. Manager taps a proposal → detail view opens; emits `proposal viewed` telemetry.
5. Manager accepts / rejects → emits `proposal accepted` / `proposal rejected`; activity_trail row lands.

**Postcondition:** Site-map registers `/dashboard/proposals` with `polished_at` + Botsson tools + common_intents.

**Error paths:** API failure → `error.tsx` boundary renders "Kunne ikke laste forslag. Prøv igjen." with retry.

## Journey: Owner plans the year on the Year-Wheel

**Precondition:** Signed-in owner on `/dashboard/year-wheel`. D4 tables seeded (`season_budget`, `day_factor`, `hour_factor`).

1. Wheel renders without skeleton flash; loading state matches final layout.
2. Header: "Årshjul" + description explaining season/budget planning purpose.
3. Visual pass uses Nordic Split (warm OKLCH hue 40-60); no hardcoded slate/zinc.
4. Owner edits a season node → emits `season updated` telemetry; mutation reaches DB.
5. Botsson opens with year-wheel surface — registered harness tools each carry one-sentence description.

**Postcondition:** Site-map `polished_at` stamp + view_change event in registry.

**Error paths:** Scheduler-coordination boundary noted in HANDOFF — defer real cascade-D4 logic changes to `world-best-wfm` campaign.

## Journey: Admin completes setup wizard hand-off

**Precondition:** Signed-in admin on `/dashboard/setup`. Workspace bootstrap from I1 in progress.

1. Page loads with progress card showing remaining bootstrap steps.
2. Header description: what setup configures + who finishes it.
3. Nordic Split sweep — no hardcoded color literals.
4. Admin taps a step → routes to bootstrap surface; emits `setup_step opened`.
5. Last step completion → emits `setup completed`; workspace flips active flag (existing logic).

**Postcondition:** Site-map registers `/dashboard/setup` with `polished_at` + tools + common_intents.

**Error paths:** Missing bootstrap dependency → `error.tsx` with deep-link to the failing prerequisite.
