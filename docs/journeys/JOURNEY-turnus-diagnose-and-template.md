---
title: Journey — Turnus diagnose + template
status: in_progress
updated: 2026-05-25
created: 2026-05-25
module: schedule
tags: [journey, scheduler, phase-1]
---

# Journey — Manager fra blank uke til plan via Botsson

## J1 — Manager: "hvorfor kan jeg ikke planlegge uke 26?"

**Role:** Manager (capability `scheduler` authority ≥ `read`)
**Precondition:**
- Workspace exists, manager has profile in workspace
- Week 26 (2026-06-22 → 2026-06-28) has NO `planning_cycle` row OR missing one of D1/D2/D3/D4 prereqs

**Steps:**
1. Manager opens Botsson chat on `/dashboard/schedule` → types "hvorfor kan jeg ikke planlegge uke 26"
2. Intent classifier routes → `diagnose_turnus` intent → scheduler capability `diagnose_turnus_disabled` tool
3. Stage engine calls `diagnoseTurnusDisabled.execute({ target_week_iso: "2026-W26" })`
4. Capability reads D1+D2+D3+D4+D5+D6 prereq state, returns structured missing-list
5. Botsson surfaces in chat: "Du kan ikke planlegge uke 26 fordi: (a) ingen aktiv `planning_cycle` for perioden — opprett under /dashboard/year-wheel, (b) D4 demand-signal mangler `season_budget` for sommer-sesong"

**Postcondition:**
- Manager sees actionable list with fix-hints
- Telemetry `scheduler.diagnose.requested` emitted with workspace_id + missing_count
- NO writes to DB

**Error paths:**
- Capability returns ready=true on a happy workspace: "Alt klart for uke 26 — bruk `bruk mal fra uke 24` eller `foreslå plan` for å starte"
- workspace_id missing from session → 401 (ADR-0151 + L-0177 fail-fast)
- No active season at all (D4 fully empty) → first missing entry: "Ingen aktiv sesong — aktiver via /dashboard/year-wheel"

## J2 — Manager: "bruk mal fra uke 24 på uke 26"

**Role:** Manager (capability `scheduler` authority ≥ `confirm`)
**Precondition:**
- Workspace has 2 planning_cycle rows: cycle_a (uke 24, status=archived, has shifts) and cycle_b (uke 26, status=draft, empty)
- J1 ready=true OR missing-list empty for cycle_b

**Steps:**
1. Manager types "bruk mal fra uke 24 på uke 26"
2. Intent classifier routes → `apply_week_template` intent
3. Stage engine calls `applyWeekTemplate.execute({ source_cycle_id: <cycle_a>, target_cycle_id: <cycle_b>, department_id: <kitchen> })`
4. Capability resolves source shifts (D6 from cycle_a), maps weekday-aligned to target dates, writes change_proposal kind=`template_apply` (or `scheduler_bundle` per Track C)
5. Botsson surfaces: "Mal-forslag opprettet (proposal_id=..., N vakter foreslått). Gå til /dashboard/schedule/proposed-plan for å godta eller avvise."

**Postcondition:**
- 1 change_proposal row written with shifts derived from cycle_a, dates remapped to cycle_b's week
- gate_evaluated allow=true, telemetry `scheduler.template.applied` emitted
- NO shifts written directly (per ADR-0309: proposal first, accept later)

**Error paths:**
- source_cycle has no shifts → "Uke 24 har ingen vakter — kan ikke kopiere tom mal"
- target_cycle has existing shifts → "Uke 26 har allerede N vakter — bruk `slett uke 26` først eller `legg til mal` (V2)"
- Channel = voice → "apply_week_template er bare tilgjengelig i chat" (ADR-0288)
- mutateWithGate denies (manager authority < confirm) → "Ikke tillatt — krever vakt-leder rolle"

## J3 — Manager: "vis maler"

**Role:** Manager (capability `scheduler` authority ≥ `read`)
**Precondition:** Workspace has ≥1 past archived planning_cycle

**Steps:**
1. Manager types "vis maler" eller "hvilke uker kan jeg kopiere fra"
2. Intent → `list_week_templates`
3. Capability returns list of past archived cycles + shift-counts + date-ranges
4. Botsson surfaces table: "Tilgjengelige maler: Uke 24 (35 vakter, 2026-06-15..21), Uke 23 (32 vakter, 2026-06-08..14)..."

**Postcondition:** Manager has list to pick from for J2
**Error paths:** No past cycles → "Ingen tidligere uker å bruke som mal"

## What changes vs broken state

BEFORE: Manager sees empty schedule → no Botsson awareness → no recovery path. Manager either opens year-wheel/cascade docs OR gives up.

AFTER: Manager asks "hvorfor" → gets actionable list. Asks "bruk mal" → gets proposal. Self-recovery without leaving chat.
