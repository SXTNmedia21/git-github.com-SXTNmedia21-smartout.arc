---
title: "Journey — Manager attaches a routine (session_hook + child tasks) to a slot on a location-scoped line"
feature: timeline-location-awareness
journey: manager-attach-routine
status: draft
created: 2026-05-17
updated: 2026-05-17
module: MODULE_COMMUNICATION
tags: [journey, timeline, routine, session-hook, slot-picker, location-scope]
---

# Journey: Manager attaches a routine to a slot

**Role:** manager | admin | owner

**Precondition:**
- A `day_line` exists for the day, bound to `(location, department|team)`.
- Authority gate `routine.attach_to_line` granted.
- At least one `session_hook_template` exists for this `(location|department|team)` scope OR for the workspace.

## Happy Path

1. Manager clicks a hit-zone at `09:00` → `SlotPicker` opens at click (see anchor journey).
2. Manager picks "Rutine" in the PRODUKSJON lane (new entry below "Oppgave") → System closes `SlotPicker` and opens `AttachRoutineDialog` with two views: "Bruk mal" (default) and "Bygg fra bunnen".
3. **Bruk mal view** → System lists `session_hook_template` rows filtered by scope: templates matching the line's `(location, department|team)` first, workspace-level templates below → User sees cards with hook label + child task count + estimated duration.
4. Manager picks "Åpningsrutine kjøkken" (5 tasks, 45 min) → System shows a preview panel: anchor time `09:00`, child task list, expected completion `09:45`.
5. Manager clicks "Fest til linjen" → System calls Server Action `attachRoutineAction` → calls capability tool `routine.attach_to_line` with `{ day_line_id, template_id, anchor_time, override_owner? }` → wraps `gate_action("routine.attach_to_line", ...)`.
6. Server-side: inserts one `session_hook` row (parent) inheriting `location_id` + `(dept|team)_id` from line, then N `session_task` rows linked to that hook, with task times computed from template offsets relative to anchor.
7. System emits `"routine attached"` telemetry with `template_id` + `task_count` → revalidates strip → User sees an anchor marker at `09:00` and N child task markers laid out per template offsets.

**Postcondition:** One `session_hook` parent + N `session_task` children created, all sharing `location_id` + `(dept|team)_id` from the line. Strip renders the routine as a connected cluster (or expandable hook marker depending on density).

## Error Paths

- **No templates for this scope** → Dialog shows empty state "Ingen rutiner finnes — opprett mal under Innstillinger → Rutiner" + CTA, or offers "Bygg fra bunnen" tab.
- **Template has placeholders not yet filled** (e.g. `{location_name}`) → Preview panel surfaces unresolved placeholders; submit disabled until resolved.
- **Anchor time + longest child offset extends past line's `planned_close`** → Confirmation "Rutinen strekker seg utenfor lukketid — bekrefte?" → User confirms or shifts anchor.
- **gate_action denies** → toast "Ingen tilgang til å feste rutiner på denne linjen" + emit `"routine attach_denied"`.
- **Network failure after parent insert but before children** → Server uses single transaction; on failure rolls back; no partial routine.
- **Duplicate routine same anchor** → Confirmation "Lignende rutine eksisterer kl 09:00 — legg til likevel?" with side-by-side preview.

## Verification

- [ ] `routine.attach_to_line` capability tool inserts hook + children in a single transaction.
- [ ] `session_hook` + child `session_task` rows inherit `location_id` + `(dept|team)_id` from `day_line` (server-resolved per ADR-0151).
- [ ] AttachRoutineDialog filters templates by scope before listing.
- [ ] Out-of-window confirmation modal works without losing selection.
- [ ] E2E covers: template-pick happy path, scope-filter, out-of-window confirm, denied gate.

**Mark `status: verified` when implementation lands.**

---

## Related

- Sibling: [manager-add-single-task](JOURNEY-timeline-location-awareness-manager-add-single-task.md) — single-task path of the same SlotPicker entry.
- Cascade: **D6** (production hook + tasks), inherits **D1** (location) + **D2** (dept|team). Template lives in **K1b** workspace knowledge.
- ADR ref: ADR-0151 (server-resolved IDs), ADR-0204 (gatedMutation), ADR-0298 (Task Ontology — children written via task.create_session).
- Touches: `apps/web/src/components/day/AttachRoutineDialog.tsx` (new),
  `apps/web/src/app/dashboard/_actions/attach-routine-action.ts` (new),
  `packages/ai/src/capabilities/routine/tools.ts` (new — `attach_to_line` tool),
  `session_hook_template` table (may need scope columns: location_id NULL, dept_id NULL, team_id NULL).
