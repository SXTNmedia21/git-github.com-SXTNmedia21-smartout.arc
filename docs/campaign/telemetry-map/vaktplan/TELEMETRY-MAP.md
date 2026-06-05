---
title: Vaktplan — Telemetry Map
status: draft
created: 2026-05-31
updated: 2026-05-31
domain: vaktplan
---

# Vaktplan — Telemetry Map

> Source files: `apps/web/pages/vaktplan*.jsx` (7 files, design contract)
> Backend hooks: `apps/web/src/app/dashboard/schedule/_hooks/`
> Registry: `packages/telemetry/src/registry.ts`

## Legend

- **noop** = pure view/navigation, no backend mutation needed
- **MISSING** = event name not found in registry.ts
- **cascade-gate needed** = shift writes bypass C4 authority gate; must be gated before prod

---

## A — Navigation / Mode Switches (vaktplan.jsx)

| #   | Element                              | File:loc         | Type           | Mutation/Action                     | Telemetry event                          | In registry?      | Reuse hook | noop? |
| --- | ------------------------------------ | ---------------- | -------------- | ----------------------------------- | ---------------------------------------- | ----------------- | ---------- | ----- |
| 1   | Mode tab: Vaktplan                   | vaktplan.jsx:274 | button/onClick | setMode("vaktplan")                 | `page viewed` (route param)              | yes               | none       | yes   |
| 2   | Mode tab: Turnus                     | vaktplan.jsx:274 | button/onClick | setMode("turnus")                   | `page viewed`                            | yes               | none       | yes   |
| 3   | Mode tab: Tilgjengelighet            | vaktplan.jsx:274 | button/onClick | setMode("tilgjengelighet")          | `page viewed`                            | yes               | none       | yes   |
| 4   | Mode tab: Vaktbørs                   | vaktplan.jsx:274 | button/onClick | setMode("vaktbors")                 | `page viewed`                            | yes               | none       | yes   |
| 5   | Mode tab: Bytteforespørsler          | vaktplan.jsx:274 | button/onClick | setMode("bytter")                   | `page viewed`                            | yes               | none       | yes   |
| 6   | Week nav: Forrige uke (←)            | vaktplan.jsx:285 | button/onClick | shiftWeek(-1) — local state only    | MISSING: `schedule.week_navigated`       | **MISSING**       | none       | no    |
| 7   | Week nav: Neste uke (→)              | vaktplan.jsx:285 | button/onClick | shiftWeek(+1) — local state only    | MISSING: `schedule.week_navigated`       | **MISSING**       | none       | no    |
| 8   | Group-by: Ansatt                     | vaktplan.jsx:302 | button/onClick | setGroupBy("ansatt")                | MISSING: `schedule.grouping_changed`     | **MISSING**       | none       | no    |
| 9   | Group-by: Jobb                       | vaktplan.jsx:302 | button/onClick | setGroupBy("jobb")                  | MISSING: `schedule.grouping_changed`     | **MISSING**       | none       | no    |
| 10  | Group-by: Team                       | vaktplan.jsx:302 | button/onClick | setGroupBy("team")                  | MISSING: `schedule.grouping_changed`     | **MISSING**       | none       | no    |
| 11  | Dept filter chip (per dept)          | vaktplan.jsx:308 | button/onClick | toggleDep(k) — filter toggle        | MISSING: `schedule.filter_changed`       | **MISSING**       | none       | no    |
| 12  | Span toggle: 1 uke                   | vaktplan.jsx:316 | button/onClick | setSpan("1") — view toggle          | `schedule.density_changed` (closest)     | yes (approximate) | none       | yes   |
| 13  | Span toggle: 2 uker                  | vaktplan.jsx:316 | button/onClick | setSpan("2") — view toggle          | `schedule.density_changed` (closest)     | yes (approximate) | none       | yes   |
| 14  | Density cog toggle                   | vaktplan.jsx:319 | button/onClick | setDensityOpen — popover open       | noop                                     | noop              | none       | yes   |
| 15  | Density toggle: Vaktantall           | vaktplan.jsx:325 | button/onClick | setDensity.count toggle             | `schedule.density_changed`               | yes               | none       | no    |
| 16  | Density toggle: Timetotal            | vaktplan.jsx:325 | button/onClick | setDensity.hours toggle             | `schedule.density_changed`               | yes               | none       | no    |
| 17  | Density toggle: Timeprogresjon       | vaktplan.jsx:325 | button/onClick | setDensity.bar toggle               | `schedule.density_changed`               | yes               | none       | no    |
| 18  | Density: Kompakt visning             | vaktplan.jsx:332 | button/onClick | setDensity all false                | `schedule.density_changed`               | yes               | none       | no    |
| 19  | Density: Vis alt                     | vaktplan.jsx:333 | button/onClick | setDensity all true                 | `schedule.density_changed`               | yes               | none       | no    |
| 20  | AI-planlegger button                 | vaktplan.jsx:288 | button/onClick | setPlanner(true) — opens VPPlanner  | MISSING: `scheduler.planner_opened`      | **MISSING**       | none       | no    |
| 21  | Eksporter / Skriv ut (download icon) | vaktplan.jsx:289 | button/onClick | setPrintOpen(true)                  | MISSING: `schedule.export_opened`        | **MISSING**       | none       | no    |
| 22  | Publiser (main toolbar)              | vaktplan.jsx:290 | button/onClick | publish(null) → setPubScope         | MISSING: `schedule.publish_modal_opened` | **MISSING**       | none       | no    |
| 23  | Banner dismiss (×)                   | vaktplan.jsx:346 | button/onClick | setBanner(null)                     | noop                                     | noop              | none       | yes   |
| 24  | Day header click (open inspector)    | vaktplan.jsx:363 | div/onClick    | setInspDay(src) — opens VPInspector | `shift list_viewed`                      | yes               | none       | yes   |

---

## B — Vaktplan Grid Interactions (vaktplan.jsx)

| #   | Element                               | File:loc         | Type           | Mutation/Action                         | Telemetry event                           | In registry? | Reuse hook       | noop? |
| --- | ------------------------------------- | ---------------- | -------------- | --------------------------------------- | ----------------------------------------- | ------------ | ---------------- | ----- |
| 25  | Chip click (unlocked shift) — Edit    | vaktplan.jsx:22  | div/onClick    | openCtl(s, "detaljer")                  | `shift detail_viewed`                     | yes          | —                | yes   |
| 26  | Chip click (locked shift) — Lifecycle | vaktplan.jsx:22  | div/onClick    | openCtl(s, "livslop")                   | `shift detail_viewed`                     | yes          | —                | yes   |
| 27  | Chip QA: Rediger button               | vaktplan.jsx:33  | button/onClick | onEdit(s) → openCtl                     | `shift detail_viewed`                     | yes          | —                | yes   |
| 28  | Chip QA: Kopier button                | vaktplan.jsx:34  | button/onClick | copyShift(s) — creates local draft      | `shift created` (**cascade-gate needed**) | yes          | `useCreateShift` | no    |
| 29  | Chip QA: Livsløp button               | vaktplan.jsx:35  | button/onClick | openCtl(s, "livslop")                   | `shift detail_viewed`                     | yes          | —                | yes   |
| 30  | Employee row click (open profile)     | vaktplan.jsx:409 | div/onClick    | openProfile(emp.id)                     | MISSING: `profile.schedule_viewed`        | **MISSING**  | none             | yes   |
| 31  | Add shift button (+ per cell)         | vaktplan.jsx:434 | button/onClick | openCtl(null, "detaljer", slot)         | `shift detail_viewed`                     | yes          | —                | yes   |
| 32  | Gap chip click (Finn vikar)           | vaktplan.jsx:459 | button/onClick | fillGap(g) → setMode("tilgjengelighet") | MISSING: `schedule.gap_fill_initiated`    | **MISSING**  | none             | no    |

---

## C — Day Inspector Overlay (vaktplan-parts.jsx: Inspector)

| #   | Element                 | File:loc               | Type           | Mutation/Action                  | Telemetry event                             | In registry? | Reuse hook         | noop? |
| --- | ----------------------- | ---------------------- | -------------- | -------------------------------- | ------------------------------------------- | ------------ | ------------------ | ----- |
| 33  | Close (×)               | vaktplan-parts.jsx:192 | button/onClick | onClose                          | noop                                        | noop         | none               | yes   |
| 34  | Finn vikar (gap issue)  | vaktplan-parts.jsx:224 | button/onClick | onFillGap(g)                     | MISSING: `schedule.gap_fill_initiated`      | **MISSING**  | none               | no    |
| 35  | Se (warn shift)         | vaktplan-parts.jsx:234 | button/onClick | onShift(s) — opens controller    | `shift detail_viewed`                       | yes          | —                  | yes   |
| 36  | AI button               | vaktplan-parts.jsx:285 | button/onClick | onPlanner()                      | MISSING: `scheduler.planner_opened`         | **MISSING**  | none               | no    |
| 37  | Publiser dag (N)        | vaktplan-parts.jsx:287 | button/onClick | onPublishDay() → publish(dayIdx) | `shift published` (**cascade-gate needed**) | yes          | `usePublishShifts` | no    |
| 38  | Ny vakt (+ button)      | vaktplan-parts.jsx:288 | button/onClick | onShift(null, slot) → openCtl    | `shift detail_viewed`                       | yes          | —                  | yes   |
| 39  | Se livsløp (locked day) | vaktplan-parts.jsx:282 | button/onClick | onShift(shifts[0])               | `shift detail_viewed`                       | yes          | —                  | yes   |

---

## D — AI Planner Overlay (vaktplan-parts.jsx: Planner)

| #   | Element                 | File:loc               | Type           | Mutation/Action                                         | Telemetry event                                                                                       | In registry? | Reuse hook                          | noop? |
| --- | ----------------------- | ---------------------- | -------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ----- |
| 40  | Close / Forkast alt (×) | vaktplan-parts.jsx:332 | button/onClick | onClose                                                 | `scheduler.proposal.rejected`                                                                         | yes          | —                                   | no    |
| 41  | Godta forslag (4)       | vaktplan-parts.jsx:393 | button/onClick | onAccept() → acceptPlan() — bulk creates/updates shifts | `scheduler.proposal.accepted` + `shift created` (×2) + `shift updated` (×2) (**cascade-gate needed**) | yes          | `useCreateShift` / `useUpdateShift` | no    |

---

## E — Shift Controller (vaktplan-controller.jsx)

| #   | Element                                      | File:loc                    | Type              | Mutation/Action                          | Telemetry event                                                          | In registry?  | Reuse hook                          | noop? |
| --- | -------------------------------------------- | --------------------------- | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------ | ------------- | ----------------------------------- | ----- |
| 42  | Close (×) / scrim mousedown                  | vaktplan-controller.jsx:159 | button/onClick    | onClose                                  | noop                                                                     | noop          | none                                | yes   |
| 43  | Tab: Detaljer                                | vaktplan-controller.jsx:191 | button/onClick    | setTab("detaljer")                       | noop                                                                     | noop          | none                                | yes   |
| 44  | Tab: Funksjoner                              | vaktplan-controller.jsx:191 | button/onClick    | setTab("funksjoner")                     | noop                                                                     | noop          | none                                | yes   |
| 45  | Tab: Historikk                               | vaktplan-controller.jsx:191 | button/onClick    | setTab("historikk")                      | noop                                                                     | noop          | none                                | yes   |
| 46  | Tab: Lønnsgrunnlag                           | vaktplan-controller.jsx:191 | button/onClick    | setTab("lonn")                           | noop                                                                     | noop          | none                                | yes   |
| 47  | Tab: Oppgaver                                | vaktplan-controller.jsx:191 | button/onClick    | setTab("oppgaver")                       | noop                                                                     | noop          | none                                | yes   |
| 48  | Tab: Livsløp                                 | vaktplan-controller.jsx:191 | button/onClick    | setTab("livslop")                        | noop                                                                     | noop          | none                                | yes   |
| 49  | Tab: Innstillinger                           | vaktplan-controller.jsx:191 | button/onClick    | setTab("innst")                          | noop                                                                     | noop          | none                                | yes   |
| 50  | Detaljer: Ansatt picker open                 | vaktplan-controller.jsx:207 | button/onClick    | setEmpPick toggle                        | noop                                                                     | noop          | none                                | yes   |
| 51  | Detaljer: Velg ansatt (in picker)            | vaktplan-controller.jsx:215 | button/onClick    | setEmpId + mark()                        | noop (dirty local)                                                       | noop          | none                                | yes   |
| 52  | Detaljer: Åpen vakt (in picker)              | vaktplan-controller.jsx:213 | button/onClick    | setEmpId("") + mark()                    | noop (dirty local)                                                       | noop          | none                                | yes   |
| 53  | Detaljer: Start time input                   | vaktplan-controller.jsx:224 | input/onChange    | setSt + mark()                           | noop (dirty local)                                                       | noop          | none                                | yes   |
| 54  | Detaljer: Slutt time input                   | vaktplan-controller.jsx:225 | input/onChange    | setEn + mark()                           | noop (dirty local)                                                       | noop          | none                                | yes   |
| 55  | Detaljer: Pause segmented buttons            | vaktplan-controller.jsx:227 | button/onClick    | setBrk + mark()                          | noop (dirty local)                                                       | noop          | none                                | yes   |
| 56  | Detaljer: Rolle input                        | vaktplan-controller.jsx:229 | input/onChange    | setRole + mark()                         | noop (dirty local)                                                       | noop          | none                                | yes   |
| 57  | Detaljer: Avdeling segment                   | vaktplan-controller.jsx:231 | button/onClick    | setDep + mark()                          | noop (dirty local)                                                       | noop          | none                                | yes   |
| 58  | Detaljer: Notat textarea                     | vaktplan-controller.jsx:234 | textarea/onChange | setNotes + mark()                        | noop (dirty local)                                                       | noop          | none                                | yes   |
| 59  | Issues bar: Foreslå fiks (Botsson)           | vaktplan-controller.jsx:183 | button/onClick    | toast only (stub)                        | MISSING: `botsson.tool_invoked` (when wired)                             | yes (partial) | none                                | no    |
| 60  | Historikk: Sammenlign button                 | vaktplan-controller.jsx:275 | button/onClick    | setCompare toggle                        | noop                                                                     | noop          | none                                | yes   |
| 61  | Lonn: Manuell justering button               | vaktplan-controller.jsx:316 | button/onClick    | toast (stub)                             | MISSING: `shift supplement_claimed` (when wired)                         | yes (partial) | none                                | no    |
| 62  | Lonn: Se livsløp link                        | vaktplan-controller.jsx:314 | button/onClick    | setTab("livslop")                        | noop                                                                     | noop          | none                                | yes   |
| 63  | Oppgaver: task checkbox toggle               | vaktplan-controller.jsx:326 | button/onClick    | toggleTask(id) — local state             | MISSING: `session_task completed` (when wired)                           | yes (partial) | none                                | no    |
| 64  | Oppgaver: Legg til oppgave                   | vaktplan-controller.jsx:335 | button/onClick    | toast (stub)                             | MISSING: `task created` (when wired)                                     | yes (partial) | none                                | no    |
| 65  | Oppgaver: Dagslinjen link                    | vaktplan-controller.jsx:322 | button/onClick    | toast (stub)                             | noop (nav, no mutation)                                                  | noop          | none                                | yes   |
| 66  | Livsløp: Publiser/Republiser/Godkjenn action | vaktplan-controller.jsx:359 | button/onClick    | act(type) → onAction                     | `shift published` / `shift_lifecycle approved` (**cascade-gate needed**) | yes           | `usePublishShifts`                  | no    |
| 67  | Innst: notify toggle                         | vaktplan-controller.jsx:374 | button/onClick    | setSettings.notify                       | MISSING: `shift updated` (settings sub-field)                            | yes (partial) | `useUpdateShift`                    | no    |
| 68  | Innst: marketplace toggle                    | vaktplan-controller.jsx:374 | button/onClick    | setSettings.marketplace                  | MISSING: `shift updated`                                                 | yes (partial) | `useUpdateShift`                    | no    |
| 69  | Innst: swap toggle                           | vaktplan-controller.jsx:374 | button/onClick    | setSettings.swap                         | MISSING: `shift updated`                                                 | yes (partial) | `useUpdateShift`                    | no    |
| 70  | Innst: template toggle                       | vaktplan-controller.jsx:374 | button/onClick    | setSettings.template                     | MISSING: `shift updated`                                                 | yes (partial) | `useUpdateShift`                    | no    |
| 71  | Innst: audit toggle                          | vaktplan-controller.jsx:374 | button/onClick    | setSettings.audit                        | MISSING: `shift updated`                                                 | yes (partial) | `useUpdateShift`                    | no    |
| 72  | Footer: Lagre utkast                         | vaktplan-controller.jsx:394 | button/onClick    | doSave() → onSave() → saveShift()        | `shift updated` or `shift created` (**cascade-gate needed**)             | yes           | `useUpdateShift` / `useCreateShift` | no    |
| 73  | Footer: Slett (delete)                       | vaktplan-controller.jsx:395 | button/onClick    | onDelete(shift) → deleteShift()          | `shift deleted` (**cascade-gate needed**)                                | yes           | `useDeleteShift`                    | no    |
| 74  | Footer: Dupliser                             | vaktplan-controller.jsx:396 | button/onClick    | act("duplicate") → copyShift()           | `shift created` (**cascade-gate needed**)                                | yes           | `useCreateShift`                    | no    |
| 75  | Footer: Publiser vakt                        | vaktplan-controller.jsx:391 | button/onClick    | act("publish")                           | `shift published` (**cascade-gate needed**)                              | yes           | `usePublishShifts`                  | no    |
| 76  | Footer: Republiser                           | vaktplan-controller.jsx:391 | button/onClick    | act("republish")                         | `shift published` (**cascade-gate needed**)                              | yes           | `usePublishShifts`                  | no    |
| 77  | Footer: Angre endringer                      | vaktplan-controller.jsx:391 | button/onClick    | act("revert")                            | MISSING: `shift updated` (revert sub-action)                             | yes (partial) | `useUpdateShift`                    | no    |
| 78  | Footer: Til vaktbørs                         | vaktplan-controller.jsx:391 | button/onClick    | act("marketplace") → setMode("vaktbors") | `shift_offer.posted` (**cascade-gate needed**)                           | yes           | `useCreateOpenShift`                | no    |
| 79  | Footer: Be om bytte                          | vaktplan-controller.jsx:391 | button/onClick    | act("swap") → setMode("bytter")          | `shift_swap.requested`                                                   | yes           | `useInitiateSwap`                   | no    |
| 80  | Footer: Avpubliser                           | vaktplan-controller.jsx:391 | button/onClick    | act("unpublish")                         | MISSING: `shift updated` (unpublish action)                              | yes (partial) | `useUpdateShift` (patch status)     | no    |
| 81  | Footer: Send oppdatering                     | vaktplan-controller.jsx:391 | button/onClick    | act("sendupdate") — toast stub           | MISSING: `communication sent` (when wired)                               | yes (partial) | none                                | no    |
| 82  | Footer: Godkjenn for lønn (settled)          | vaktplan-controller.jsx:391 | button/onClick    | act("approve")                           | `shift_lifecycle approved`                                               | yes           | none                                | no    |

---

## F — Publish Modal (vaktplan-parts.jsx: PublishModal)

| #   | Element                            | File:loc               | Type           | Mutation/Action                               | Telemetry event                                 | In registry? | Reuse hook         | noop? |
| --- | ---------------------------------- | ---------------------- | -------------- | --------------------------------------------- | ----------------------------------------------- | ------------ | ------------------ | ----- |
| 83  | Close (×) / Avbryt                 | vaktplan-parts.jsx:655 | button/onClick | onClose                                       | noop                                            | noop         | none               | yes   |
| 84  | Row checkbox toggle (include/hold) | vaktplan-parts.jsx:701 | button/onClick | toggle(r.id) — local select state             | noop                                            | noop         | none               | yes   |
| 85  | Row expand/changelog (history)     | vaktplan-parts.jsx:719 | button/onClick | toggleOpen(r.id)                              | noop                                            | noop         | none               | yes   |
| 86  | Row hold/take-back button          | vaktplan-parts.jsx:720 | button/onClick | toggle(r.id)                                  | noop                                            | noop         | none               | yes   |
| 87  | Issue bar: Tildel ansatt link      | vaktplan-parts.jsx:724 | span/onClick   | fillGapHint(toast) — toast only               | noop (stub)                                     | noop         | none               | yes   |
| 88  | Publiser N vakter (confirm)        | vaktplan-parts.jsx:760 | button/onClick | confirm() → onConfirm(ids) → confirmPublish() | `shift published` × N (**cascade-gate needed**) | yes          | `usePublishShifts` | no    |
| 89  | Ferdig (post-publish)              | vaktplan-parts.jsx:672 | button/onClick | onClose                                       | noop                                            | noop         | none               | yes   |

---

## G — Lifecycle Modal (vaktplan-parts.jsx: Lifecycle)

| #   | Element                     | File:loc               | Type           | Mutation/Action | Telemetry event            | In registry? | Reuse hook | noop? |
| --- | --------------------------- | ---------------------- | -------------- | --------------- | -------------------------- | ------------ | ---------- | ----- |
| 90  | Godkjenn for lønn (settled) | vaktplan-parts.jsx:604 | button/onClick | toast + onClose | `shift_lifecycle approved` | yes          | none       | no    |
| 91  | Lukk                        | vaktplan-parts.jsx:606 | button/onClick | onClose         | noop                       | noop         | none       | yes   |

---

## H — Vaktbørs / Marketplace (vaktplan.jsx: marketplace section)

| #   | Element                           | File:loc         | Type           | Mutation/Action                            | Telemetry event                          | In registry?  | Reuse hook           | noop? |
| --- | --------------------------------- | ---------------- | -------------- | ------------------------------------------ | ---------------------------------------- | ------------- | -------------------- | ----- |
| 92  | Claim avatar click (open profile) | vaktplan.jsx:515 | span/onClick   | openProfile(c.id, "oversikt", offerFit(o)) | MISSING: `profile.schedule_viewed`       | **MISSING**   | none                 | yes   |
| 93  | Del på nytt (re-share offer)      | vaktplan.jsx:525 | button/onClick | toast (stub)                               | MISSING: `shift_offer.posted` (re-share) | yes (partial) | `useCreateOpenShift` | no    |
| 94  | Tildel (assign offer)             | vaktplan.jsx:526 | button/onClick | approveOffer(o.id)                         | `shift_offer.approved`                   | yes           | `useAssignOpenShift` | no    |

---

## I — Bytteforespørsler (vaktplan.jsx: swap section)

| #   | Element                        | File:loc         | Type           | Mutation/Action          | Telemetry event                    | In registry? | Reuse hook         | noop? |
| --- | ------------------------------ | ---------------- | -------------- | ------------------------ | ---------------------------------- | ------------ | ------------------ | ----- |
| 95  | Swap from-person profile click | vaktplan.jsx:555 | div/onClick    | openProfile(w.from.id)   | MISSING: `profile.schedule_viewed` | **MISSING**  | none               | yes   |
| 96  | Swap to-person profile click   | vaktplan.jsx:559 | div/onClick    | openProfile(w.to.id)     | MISSING: `profile.schedule_viewed` | **MISSING**  | none               | yes   |
| 97  | Godkjenn bytte                 | vaktplan.jsx:572 | button/onClick | resolveSwap(w.id, true)  | `shift_swap.approved`              | yes          | `useApproveSwap`   | no    |
| 98  | Avslå                          | vaktplan.jsx:573 | button/onClick | resolveSwap(w.id, false) | `shift_swap.rejected`              | yes          | `useRespondToSwap` | no    |

---

## J — Tilgjengelighet / Availability (vaktplan-availability.jsx)

| #   | Element                                                   | File:loc                      | Type           | Mutation/Action                            | Telemetry event                                                     | In registry? | Reuse hook           | noop? |
| --- | --------------------------------------------------------- | ----------------------------- | -------------- | ------------------------------------------ | ------------------------------------------------------------------- | ------------ | -------------------- | ----- |
| 99  | Match context: Avslutt                                    | vaktplan-availability.jsx:101 | button/onClick | onClearMatch()                             | noop                                                                | noop         | none                 | yes   |
| 100 | Preset tabs (tilgjengelig, best, trenger, vil, over, syk) | vaktplan-availability.jsx:107 | button/onClick | setPreset(k)                               | noop                                                                | noop         | none                 | yes   |
| 101 | Dept filter chips                                         | vaktplan-availability.jsx:110 | button/onClick | setDepFilter toggle                        | MISSING: `schedule.filter_changed`                                  | **MISSING**  | none                 | no    |
| 102 | Flag chips (trenger, vil, rolle)                          | vaktplan-availability.jsx:89  | button/onClick | setFlags toggle                            | noop                                                                | noop         | none                 | yes   |
| 103 | Staff row click (select employee)                         | vaktplan-availability.jsx:127 | div/onClick    | setSel(r.e.id)                             | noop                                                                | noop         | none                 | yes   |
| 104 | Staff row name click (open profile)                       | vaktplan-availability.jsx:131 | div/onClick    | onOpenProfile(r.e.id, "avtale")            | MISSING: `profile.schedule_viewed`                                  | **MISSING**  | none                 | yes   |
| 105 | Tildel button (row, match mode)                           | vaktplan-availability.jsx:146 | button/onClick | onAssign(r.e.id, matchCtx) → assignToShift | `shift assigned` (**cascade-gate needed**)                          | yes          | `useUpdateShift`     | no    |
| 106 | Se vakter button (row, browse mode)                       | vaktplan-availability.jsx:147 | button/onClick | setSel(r.e.id)                             | noop                                                                | noop         | none                 | yes   |
| 107 | Side panel: Tildel [name] vakten                          | vaktplan-availability.jsx:169 | button/onClick | onAssign(selRow.e.id, matchCtx)            | `shift assigned` (**cascade-gate needed**)                          | yes          | `useUpdateShift`     | no    |
| 108 | Side panel: Se avtale & tilgjengelighet                   | vaktplan-availability.jsx:170 | button/onClick | onOpenProfile(selRow.e.id, "avtale")       | MISSING: `profile.schedule_viewed`                                  | **MISSING**  | none                 | yes   |
| 109 | Open shift Tildel button (side panel)                     | vaktplan-availability.jsx:193 | button/onClick | onAssign(selRow.e.id, o)                   | `shift assigned` or `open_shift assigned` (**cascade-gate needed**) | yes          | `useAssignOpenShift` | no    |

---

## K — Turnus (vaktplan-turnus.jsx)

| #   | Element                             | File:loc                | Type           | Mutation/Action                                     | Telemetry event                                                               | In registry? | Reuse hook       | noop? |
| --- | ----------------------------------- | ----------------------- | -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ | ---------------- | ----- |
| 110 | Sub-tab: Måned                      | vaktplan-turnus.jsx:97  | button/onClick | setSub("maned")                                     | noop                                                                          | noop         | none             | yes   |
| 111 | Sub-tab: Bygg turnus                | vaktplan-turnus.jsx:97  | button/onClick | setSub("bygg")                                      | noop                                                                          | noop         | none             | yes   |
| 112 | Columns: Ansatt / Jobb / Lokasjon   | vaktplan-turnus.jsx:105 | button/onClick | setGrp(k)                                           | MISSING: `schedule.grouping_changed`                                          | **MISSING**  | none             | no    |
| 113 | Skriv ut turnus                     | vaktplan-turnus.jsx:112 | button/onClick | onPrint()                                           | MISSING: `schedule.export_opened`                                             | **MISSING**  | none             | no    |
| 114 | Turnus Publiser                     | vaktplan-turnus.jsx:113 | button/onClick | onPublish(null)                                     | MISSING: `schedule.publish_modal_opened`                                      | **MISSING**  | none             | no    |
| 115 | Month row: Uke N click              | vaktplan-turnus.jsx:133 | button/onClick | setSub("bygg") + scroll                             | noop                                                                          | noop         | none             | yes   |
| 116 | Åpne turnusbygger (month foot)      | vaktplan-turnus.jsx:151 | button/onClick | setSub("bygg")                                      | noop                                                                          | noop         | none             | yes   |
| 117 | Week collapse toggle (chevron)      | vaktplan-turnus.jsx:164 | button/onClick | setCollapsed toggle                                 | noop                                                                          | noop         | none             | yes   |
| 118 | Publiser uke (per-week)             | vaktplan-turnus.jsx:170 | button/onClick | onPublish(null)                                     | MISSING: `schedule.publish_modal_opened`                                      | **MISSING**  | none             | no    |
| 119 | Fjern uke (trash)                   | vaktplan-turnus.jsx:171 | button/onClick | removeWeek(wk) — local state                        | MISSING: `schedule.week_removed`                                              | **MISSING**  | none             | no    |
| 120 | Turnus chip click (existing shift)  | vaktplan-turnus.jsx:196 | button/onClick | onOpenCtl(s, ...)                                   | `shift detail_viewed`                                                         | yes          | —                | yes   |
| 121 | Add cell (+ per cell)               | vaktplan-turnus.jsx:202 | button/onClick | onOpenCtl(null, "detaljer", slot)                   | `shift detail_viewed`                                                         | yes          | —                | yes   |
| 122 | ColHead emp click (open profile)    | vaktplan-turnus.jsx:243 | div/onClick    | onOpenProfile(e.id, "avtale")                       | MISSING: `profile.schedule_viewed`                                            | **MISSING**  | none             | yes   |
| 123 | Legg til uke button                 | vaktplan-turnus.jsx:217 | button/onClick | setAddOpen toggle                                   | noop                                                                          | noop         | none             | yes   |
| 124 | Add week: Kopier forrige uke        | vaktplan-turnus.jsx:221 | button/onClick | addWeek("prev") — creates local week + draft shifts | MISSING: `schedule.week_added`                                                | **MISSING**  | none             | no    |
| 125 | Add week: Kopier bestemt uke        | vaktplan-turnus.jsx:221 | button/onClick | addWeek("specific")                                 | MISSING: `schedule.week_added`                                                | **MISSING**  | none             | no    |
| 126 | Add week: Start på nytt             | vaktplan-turnus.jsx:221 | button/onClick | addWeek("scratch")                                  | MISSING: `schedule.week_added`                                                | **MISSING**  | none             | no    |
| 127 | Add week: Bruk mal                  | vaktplan-turnus.jsx:221 | button/onClick | addWeek("template")                                 | `scheduler.template.applied`                                                  | yes          | none             | no    |
| 128 | Add week: AI-forslag                | vaktplan-turnus.jsx:221 | button/onClick | addWeek("ai") → bulk draft shifts                   | `scheduler.proposal.proposed` + `shift created` × N (**cascade-gate needed**) | yes          | `useCreateShift` | no    |
| 129 | Kopier forrige uke hit (empty week) | vaktplan-turnus.jsx:179 | button/onClick | addWeek("prev")                                     | MISSING: `schedule.week_added`                                                | **MISSING**  | none             | no    |

---

## L — Employee Profile Drawer (vaktplan-profile.jsx)

| #   | Element                                                                     | File:loc                 | Type                   | Mutation/Action                   | Telemetry event                                                   | In registry?  | Reuse hook         | noop? |
| --- | --------------------------------------------------------------------------- | ------------------------ | ---------------------- | --------------------------------- | ----------------------------------------------------------------- | ------------- | ------------------ | ----- |
| 130 | Close (×)                                                                   | vaktplan-profile.jsx:124 | button/onClick         | onClose                           | noop                                                              | noop          | none               | yes   |
| 131 | Profile tabs (oversikt, avtale, tilgj, timer, foresp, oppg, hist, detaljer) | vaktplan-profile.jsx:144 | button/onClick         | setTab(k)                         | noop                                                              | noop          | none               | yes   |
| 132 | Fit panel: Tildel [name] denne vakten                                       | vaktplan-profile.jsx:166 | button/onClick         | onAssign(emp.id, fit)             | `shift assigned` (**cascade-gate needed**)                        | yes           | `useUpdateShift`   | no    |
| 133 | Oversikt: Se detaljer (timer link)                                          | vaktplan-profile.jsx:172 | button/onClick         | setTab("timer")                   | noop                                                              | noop          | none               | yes   |
| 134 | Oversikt: Full plan link                                                    | vaktplan-profile.jsx:179 | button/onClick         | onOpenShift(empId)                | noop (nav)                                                        | noop          | none               | yes   |
| 135 | Oversikt: Venter på deg — Godkjenn (ReqRow)                                 | vaktplan-profile.jsx:343 | button/onClick         | setDone("ok") + toast             | MISSING: `shift_swap.approved` or `absence approved` (when wired) | yes (partial) | `useApproveSwap`   | no    |
| 136 | Oversikt: Venter på deg — Avslå (ReqRow)                                    | vaktplan-profile.jsx:343 | button/onClick         | setDone("no") + toast             | MISSING: `shift_swap.rejected` or `absence rejected` (when wired) | yes (partial) | `useRespondToSwap` | no    |
| 137 | Avtale: Avtaletype card (no agreement)                                      | vaktplan-profile.jsx:205 | button/onClick         | setEditAgr(true) + toast          | MISSING: `roster updated` (when wired)                            | yes (partial) | `useUpsertRoster`  | no    |
| 138 | Avtale: Rediger button                                                      | vaktplan-profile.jsx:212 | button/onClick         | setEditAgr toggle                 | noop                                                              | noop          | none               | yes   |
| 139 | Avtale: Agreement type card (change)                                        | vaktplan-profile.jsx:215 | div (no click handler) | display only                      | noop                                                              | noop          | none               | yes   |
| 140 | Avtale: field inputs (hpw, max, etc.)                                       | vaktplan-profile.jsx:219 | input/onChange         | local defaultValue (uncontrolled) | noop                                                              | noop          | none               | yes   |
| 141 | Avtale: Lagre avtale                                                        | vaktplan-profile.jsx:228 | button/onClick         | setEditAgr(false) + toast         | MISSING: `roster updated`                                         | yes (partial) | `useUpsertRoster`  | no    |
| 142 | Tilgj: Rediger button                                                       | vaktplan-profile.jsx:236 | button/onClick         | toast (stub)                      | MISSING: `roster updated` (when wired)                            | yes (partial) | `useUpsertRoster`  | no    |
| 143 | Foresp: Godkjenn (ReqRow full)                                              | vaktplan-profile.jsx:343 | button/onClick         | setDone("ok") + toast             | MISSING: `shift_swap.approved` or `absence approved`              | yes (partial) | `useApproveSwap`   | no    |
| 144 | Foresp: Avslå (ReqRow full)                                                 | vaktplan-profile.jsx:343 | button/onClick         | setDone("no") + toast             | MISSING: `shift_swap.rejected` or `absence rejected`              | yes (partial) | `useRespondToSwap` | no    |
| 145 | Oppg: Følg opp button                                                       | vaktplan-profile.jsx:285 | button/onClick         | toast (stub)                      | MISSING: `task created` (follow-up, when wired)                   | yes (partial) | none               | no    |
| 146 | Footer: Full plan                                                           | vaktplan-profile.jsx:323 | button/onClick         | onOpenShift(empId)                | noop (nav)                                                        | noop          | none               | yes   |
| 147 | Footer: Tildel vakt (fit context)                                           | vaktplan-profile.jsx:325 | button/onClick         | onAssign(emp.id, fit)             | `shift assigned` (**cascade-gate needed**)                        | yes           | `useUpdateShift`   | no    |
| 148 | Footer: Melding (no fit context)                                            | vaktplan-profile.jsx:326 | button/onClick         | toast (stub)                      | MISSING: `communication sent` (when wired)                        | yes (partial) | none               | no    |

---

## M — Print / Export Modal (vaktplan-print.jsx)

| #   | Element                              | File:loc              | Type           | Mutation/Action            | Telemetry event                  | In registry? | Reuse hook | noop? |
| --- | ------------------------------------ | --------------------- | -------------- | -------------------------- | -------------------------------- | ------------ | ---------- | ----- |
| 149 | Close (×)                            | vaktplan-print.jsx:62 | button/onClick | onClose                    | noop                             | noop         | none       | yes   |
| 150 | Scope: Uke / Måned                   | vaktplan-print.jsx:47 | button/onClick | setScope(k)                | noop                             | noop         | none       | yes   |
| 151 | Orientering: Ansatt×dag / Dag×ansatt | vaktplan-print.jsx:51 | button/onClick | setOrient(k)               | noop                             | noop         | none       | yes   |
| 152 | Month metric: Vakter / Ansatte       | vaktplan-print.jsx:55 | button/onClick | setMetric(k)               | noop                             | noop         | none       | yes   |
| 153 | Skriv ut / Lagre som PDF             | vaktplan-print.jsx:61 | button/onClick | doPrint() → window.print() | MISSING: `schedule.pdf_exported` | **MISSING**  | none       | no    |

---

## Summary Counts

| Metric                             | Count   |
| ---------------------------------- | ------- |
| Total interactive elements         | **153** |
| Elements mapped                    | **153** |
| noop (no mutation, view-only)      | **62**  |
| Mutations requiring telemetry      | **91**  |
| Events clearly in registry         | **38**  |
| Events MISSING from registry       | **33**  |
| Hooks available for reuse          | 5       |
| Mutations needing hook wiring      | 25      |
| Cascade-gate needed (shift writes) | 18      |
