---
title: Journey — Timeline Templates
status: draft
updated: 2026-05-16
created: 2026-05-16
module: web-day-control
tags: [journey, d6, timeline-template]
---

# Journey — Timeline Templates

Companion to `docs/superpowers/specs/2026-05-16-timeline-templates-design.md`.

## Journey 1: Admin saves a scope-filtered timeline as template

**Precondition:** Admin signed in, has admin/owner/manager role in workspace, on `/dashboard` → Dagslinjen tab, viewing today's date with at least 1 event.

1. Admin clicks `ScopeFilterPill` → System opens scope picker → Admin sees options "Avdeling", "Team", "Lokasjon", "Vakt"
2. Admin selects "Team" → "Servitørteam Lørdag" → System updates URL `?scope=team:<uuid>` → TimelineTab refetches → Admin sees only items matching team scope
3. Admin clicks empty 14:00 slot → System opens `SlotPicker` → Admin sees 6 item options (Vakt, Hook, Oppgave, Notat, Avvik, Fri tekst)
4. Admin picks "Hook" → fills in `hook_type=open`, `linked_procedure_id=<oppstart>` → confirms → System renders hook on timeline
5. Admin repeats step 3–4 for 14:00, 14:15, 16:00, 22:00 — building a 5-item Saturday-dinner template
6. Admin clicks "Lagre tidslinje" on `SavedTimelinesDropdown` → System opens `SaveTemplateDialog`
7. Admin enters `name="Lørdag middag – Servitørteam"`, notes empty → confirms
8. System POSTs `/api/timeline-template` → BFF validates → capability `save_template` runs `mutateWithGate` → INSERT `timeline_template` → emit `timeline_template.saved` → returns `{ template_id }`
9. Dialog closes → dropdown refetches → toast "Lagret"

**Postcondition:** `timeline_template` row exists, scope_type=`team`, scope_id=servitør-team-uuid, items_json contains 5 items. Telemetry `timeline_template.saved` fired to PostHog + logger + activity_trail + engine_event.

**Error paths:**
- Name collision → UNIQUE index rejects → BFF returns 409 → Dialog shows "Navn finnes allerede" → Admin renames + retry
- Network error → Toast "Kunne ikke lagre. Prøv igjen." → Dialog stays open
- Admin loses role mid-flow → `mutateWithGate` rejects → 403 → Toast "Manglende rettigheter"

---

## Journey 2: Admin applies saved template to future date

**Precondition:** Admin on Dagslinjen tab, `dateISO=2026-05-23` (future Saturday), saved template "Lørdag middag – Servitørteam" exists in dropdown.

1. Admin clicks `SavedTimelinesDropdown` → System lists 3 templates matching current scope
2. Admin picks "Lørdag middag – Servitørteam" → System loads template preview → Admin sees 5 items listed
3. Admin clicks "Bruk på 23. mai" → System opens `ApplyTemplateDialog`
4. Dialog shows: target date `2026-05-23`, item count 5, scope `Team: Servitørteam Lørdag`. Free-form item count: 0 (none in this template).
5. Admin clicks "Bekreft"
6. System POSTs `/api/timeline-template/apply` → BFF validates `target_date >= today (Oslo TZ)` → calls capability `apply_template`
7. Capability:
   - Runs `mutateWithGate` with `p_action=timeline_template.apply`
   - Resolves `department_session` for (department_id, 2026-05-23) — creates `status='upcoming'` via `openSessionAction` if missing
   - BEGIN transaction
   - Per item: INSERT into respective table (`schedule_shift`, `session_hook`, etc.) with `source='template:<id>'` marker
   - For `session_task` items: insert with `session_hook_id=NULL`
   - COMMIT
   - emit `timeline_template.applied` + per-row existing event ids
8. BFF returns `{ materialized: { hook: 1, task: 3, shift: 1 }, errors: [] }`
9. Dialog closes → TimelineTab refetches → Admin sees 5 materialized items on 23. mai
10. Toast "5 elementer lagt til på 23. mai"

**Postcondition:** Real D6 rows exist for 2026-05-23 with `source='template:<id>'` provenance. Cron `session_hook_executor` will materialize tasks from the inserted hook at hook's anchor time on 2026-05-23. Telemetry emitted.

**Error paths:**
- Past date → BFF rejects 400 → Dialog disabled, button greyed
- Scope entity deleted → 409 → Toast "Mål-team finnes ikke lenger. Arkiver malen."
- Mid-transaction failure (e.g. RLS denial on one INSERT) → Rollback → `{ materialized: {}, errors: [{ item_index, reason }] }` → Toast "Påføring feilet, prøv igjen"
- Concurrent apply by another admin → either succeeds independently (no race protection in v1; future enhancement)

---

## Journey 3: Admin applies template with free-form chips

**Precondition:** Admin saved a template "Julebuffet – Kjøkken" with 3 items: 1 hook, 1 task, 1 free_form chip labeled "Sett opp julestjerne på bord 5".

1. Admin on 2026-12-20 Dagslinjen, picks template from dropdown
2. `ApplyTemplateDialog` opens. Free-form section shows: "1 fri-tekst-element trenger valg"
3. Per-chip picker: "Sett opp julestjerne på bord 5" → options: `Oppgave` (default) / `Notat` / `Hopp over`
4. Admin picks `Notat` → confirms
5. BFF processes:
   - Hook → INSERT `session_hook`
   - Task → INSERT `session_task` (session_hook_id=NULL)
   - Free-form (mapping=note) → INSERT `session_note(content='Sett opp julestjerne på bord 5')`
6. Returns success → Toast "3 elementer lagt til"

**Postcondition:** session_note row created with the chip's label as content.

**Error paths:** Same as Journey 2 plus mapping-key mismatch returns 400.

---

## Journey 4: Admin archives a template

**Precondition:** Admin has stale template "Sommermeny 2024 – Servitørteam".

1. Admin opens `SavedTimelinesDropdown`, right-clicks (or context-menu icon) on the template
2. Menu shows "Arkiver" + "Vis bruksstatistikk"
3. Admin clicks "Arkiver" → System opens confirm modal "Arkiver 'Sommermeny 2024 – Servitørteam'? Kan ikke gjenopprettes via UI."
4. Admin confirms → PATCH `/api/timeline-template/<id>` → capability `archive_template` runs `mutateWithGate` → UPDATE `is_archived=true` → emit `timeline_template.archived`
5. Dropdown refetches → template no longer in active list

**Postcondition:** Row exists with `is_archived=true`. Future apply flows do not show it.

**Error paths:**
- Lost admin role → 403 → Toast "Manglende rettigheter"
- Network error → Toast "Kunne ikke arkivere"

---

## Journey 5: Manager filters by location and sees shifts-only warning

**Precondition:** Manager on Dagslinjen with workspace containing 2 locations.

1. Manager picks `ScopeFilterPill` → "Lokasjon" → "Lokasjon Sentrum"
2. System filters timeline → `schedule_shift` rows for that location appear
3. **System renders explicit notice in TimelineTab header:** "Lokasjonsfilter viser kun vakter. Hooks, oppgaver og notater er ikke lokasjons-merket."
4. SavedTimelinesDropdown lists templates with `scope_type=location` only
5. Manager attempts to save a template — `SaveTemplateDialog` Zod check enforces: items array may only contain `kind=schedule_shift` when `scope_type=location`. Picker hides non-shift options.

**Postcondition:** Manager understands location filter limits; cannot save invalid mixed-kind templates under location scope.

**Error paths:**
- Manager tries to mix kinds → SlotPicker disables non-shift options with tooltip "Lokasjons-malt godtar kun vakter"
- If somehow body bypasses (API direct hit) → BFF Zod check rejects 400

---

## Manual test cases (v1)

| ID | Test | Expected |
|---|---|---|
| TT-01 | Filter by team → save 3-item template → apply to today+7 | 3 rows materialize with `source='template:<id>'` |
| TT-02 | Apply same template twice to same date | Both apply succeed; duplicate rows acceptable (operator cleans) |
| TT-03 | Save with name collision in same scope | 409, dialog highlights name field |
| TT-04 | Apply to past date | Button disabled |
| TT-05 | Apply with 5 free-form chips, mix mappings | 2 task + 2 note + 1 skip = 4 new rows |
| TT-06 | Archive template, dropdown excludes it | Confirmed |
| TT-07 | Location scope save with `kind=session_task` in items | Zod 400 |
| TT-08 | Cron fires at hook anchor time on applied date | Tasks materialize from procedure_step normally |
