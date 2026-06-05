---
title: Oppgaver — Telemetry Map
status: draft
updated: 2026-05-31
created: 2026-05-31
module: oppgaver
tags: [telemetry, oppgaver, task-board, P11]
---

# Telemetry Map — oppgaver domain

Design source: `Smartout.ai_re-designe/apps/web/pages/oppgaver.jsx` (1069 lines) + `oppgaver-form.jsx` (292 lines)

**Gate: FAIL** — 2 events missing from registry, 14 mutations have no real hook (in-memory only or flagged ADR-anti-pattern).

---

## Summary counts

| Metric                                  | Value     |
| --------------------------------------- | --------- |
| Interactive elements total              | 38        |
| Elements mapped                         | 38 (100%) |
| Mutations (DB writes or side effects)   | 14        |
| Events required                         | 19        |
| Events in registry                      | 17        |
| Events missing from registry            | 2         |
| Hooks found (reusable)                  | 4         |
| Hook gaps (new hooks needed or flagged) | 9         |

---

## Interactive Elements — Full Map

### 1. Tab navigation (5 tabs)

| Tab       | Element                                        | Mutation? | Telemetry event              | Registry status |
| --------- | ---------------------------------------------- | --------- | ---------------------------- | --------------- |
| Oversikt  | `<button onClick={() => setTab("oversikt")}>`  | No        | `oppgaver.view_mode_changed` | IN REGISTRY     |
| Dag       | `<button onClick={() => setTab("dag")}>`       | No        | `oppgaver.view_mode_changed` | IN REGISTRY     |
| Dagslinje | `<button onClick={() => setTab("dagslinje")}>` | No        | `oppgaver.view_mode_changed` | IN REGISTRY     |
| Oppgaver  | `<button onClick={() => setTab("oppgaver")}>`  | No        | `oppgaver.view_mode_changed` | IN REGISTRY     |
| Rutiner   | `<button onClick={() => setTab("rutiner")}>`   | No        | `oppgaver.view_mode_changed` | IN REGISTRY     |

### 2. Overview tab

| Control                            | onClick / trigger                       | Mutation?          | Telemetry event                  | Registry    | Hook                                                       |
| ---------------------------------- | --------------------------------------- | ------------------ | -------------------------------- | ----------- | ---------------------------------------------------------- |
| Pulse card — Fullført              | `setTab("oppgaver")`                    | No                 | `oppgaver.pulse_now_clicked`     | IN REGISTRY | noop                                                       |
| Pulse card — Forsinket             | `setTab("oppgaver")`                    | No                 | `oppgaver.pulse_now_clicked`     | IN REGISTRY | noop                                                       |
| Pulse card — Aktive rutiner        | `setTab("rutiner")`                     | No                 | `oppgaver.pulse_now_clicked`     | IN REGISTRY | noop                                                       |
| Pulse card — Proaktiv andel        | `setTab("oppgaver")`                    | No                 | `oppgaver.pulse_now_clicked`     | IN REGISTRY | noop                                                       |
| Botsson "Tildel Ida B."            | `toast("Renhold tildelt Ida B.", undo)` | **YES** — reassign | `session_task.assigned`          | IN REGISTRY | **MISSING** — needs useAssignTask wired (FLAGGED ADR-0134) |
| Botsson "Avvis"                    | `toast("Forslaget avvist")`             | No                 | none / `oppgaver.context_pinned` | -           | noop                                                       |
| Botsson "Se rutinen"               | `setTab("rutiner")`                     | No                 | `oppgaver.view_mode_changed`     | IN REGISTRY | noop                                                       |
| Routine status "Alle rutiner" link | `setTab("rutiner")`                     | No                 | `oppgaver.view_mode_changed`     | IN REGISTRY | noop                                                       |
| Routine status row click           | `onOpenRoutine(r.id)`                   | No                 | `oppgaver.task_focused`          | IN REGISTRY | noop                                                       |

### 3. AdhocCompose (Overview + all tabs)

| Control                       | Trigger                    | Mutation?                     | Telemetry event                              | Registry    | Hook                                                                                 |
| ----------------------------- | -------------------------- | ----------------------------- | -------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Assignee picker button        | `setAOpen` toggle          | No                            | none                                         | -           | noop                                                                                 |
| Assignee menu item select     | `setAssignee(uid)`         | No                            | none                                         | -           | noop (local state pre-submit)                                                        |
| Priority picker button        | `setPOpen` toggle          | No                            | none                                         | -           | noop                                                                                 |
| Priority menu item select     | `setPri(k)`                | No                            | none                                         | -           | noop                                                                                 |
| When (deadline) picker button | `setWOpen` toggle          | No                            | none                                         | -           | noop                                                                                 |
| When menu item select         | `setWhen(w)`               | No                            | none                                         | -           | noop                                                                                 |
| Title input                   | `setTitle(e.target.value)` | No                            | none                                         | -           | noop                                                                                 |
| Enter key on input            | `submit()`                 | **YES** — insert session_task | `session_task.created` / `task.added_manual` | IN REGISTRY | **FLAGGED** useCreateQuickTask → direct browser .insert (ADR-0114/0134 anti-pattern) |
| "Opprett & tildel" button     | `submit()`                 | **YES** — insert session_task | `session_task.created` / `task.added_manual` | IN REGISTRY | **FLAGGED** useCreateQuickTask → direct browser .insert (ADR-0114/0134 anti-pattern) |

### 4. TaskList (Oppgaver tab)

| Control                                 | Trigger                | Mutation? | Telemetry event                | Registry    | Hook |
| --------------------------------------- | ---------------------- | --------- | ------------------------------ | ----------- | ---- |
| Search input                            | `setQ(e.target.value)` | No        | none                           | -           | noop |
| Sort button                             | `setSortOpen` toggle   | No        | none                           | -           | noop |
| Sort menu item                          | `setSort(k)`           | No        | none                           | -           | noop |
| Filter chip (status/me/critical)        | `setFilter(f.id)`      | No        | `oppgaver.area_filter_changed` | IN REGISTRY | noop |
| Origin filter chip (proaktivt/reaktivt) | `setOrigin(f.id)`      | No        | `oppgaver.area_filter_changed` | IN REGISTRY | noop |
| "Koordinér" / "Avbryt" button           | `setCoord(true/false)` | No        | none                           | -           | noop |

### 5. TaskRow (reusable — used in TaskList, DayBoard, Dagslinje)

| Control                                 | Trigger                     | Mutation?                    | Telemetry event               | Registry                  | Hook                                                                            |
| --------------------------------------- | --------------------------- | ---------------------------- | ----------------------------- | ------------------------- | ------------------------------------------------------------------------------- |
| Row click (non-coord)                   | `onOpen(task.id)`           | No                           | `oppgaver.task_focused`       | IN REGISTRY               | noop                                                                            |
| Row click (coord mode)                  | `onToggleSel(task.id)`      | No                           | none                          | -                         | noop                                                                            |
| Toggle status button (circle check)     | `onToggleStatus(task.id)`   | **YES** — update task_status | **`oppgaver.task_completed`** | **MISSING FROM REGISTRY** | **MISSING** — needs useCompleteTask (ADR-0298 gate)                             |
| Assignee avatar (open reassign)         | `setReassign(v => !v)`      | No                           | none                          | -                         | noop                                                                            |
| Reassign menu item                      | `onReassign(task.id, uid)`  | **YES** — update assigned_to | `session_task.assigned`       | IN REGISTRY               | **FLAGGED** useAssignTask → direct browser .update + fire-and-forget (ADR-0134) |
| Rediger (pen) button                    | `onOpen(task.id)`           | No                           | `oppgaver.task_focused`       | IN REGISTRY               | noop                                                                            |
| Mer (sliders) button                    | `setMore(v => !v)`          | No                           | none                          | -                         | noop                                                                            |
| More menu: "Dupliser"                   | `onDuplicate(task.id)`      | **YES** — insert copy        | none / `task.added_manual`    | partial                   | **MISSING** — no hook for duplicate                                             |
| More menu: "Send påminnelse"            | `toast("Påminnelse sendt")` | No — stub                    | none                          | -                         | noop (stub)                                                                     |
| More menu: "Til Dagslinjen"             | `toast("Oppgave flyttet")`  | No — stub                    | `oppgaver.task_re_timed`      | IN REGISTRY               | noop (stub — move-to-timeline not built)                                        |
| More menu: "Marker ferdig" / "Gjenåpne" | `onToggleStatus(task.id)`   | **YES** — update task_status | **`oppgaver.task_completed`** | **MISSING FROM REGISTRY** | **MISSING** — same as toggle above                                              |

### 6. BulkAction bar (coord mode)

| Control                      | Trigger                             | Mutation?                           | Telemetry event                     | Registry                  | Hook                                        |
| ---------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ------------------------- | ------------------------------------------- |
| "Marker ferdig" bulk button  | `bulkDone()`                        | **YES** — bulk update N tasks       | **`oppgaver.task_completed`** (× N) | **MISSING FROM REGISTRY** | **MISSING** — no bulk-complete hook         |
| BulkAssign dropdown open     | `setOpen(v => !v)`                  | No                                  | none                                | -                         | noop                                        |
| BulkAssign menu item         | `onAssign(uid)` → `bulkAssign(uid)` | **YES** — bulk update N assigned_to | `session_task.assigned`             | IN REGISTRY               | **FLAGGED** same useAssignTask anti-pattern |
| "Til Dagslinjen" bulk button | `toast(...)`                        | No — stub                           | `oppgaver.task_re_timed`            | IN REGISTRY               | noop (stub)                                 |

### 7. Drawer (quick-edit)

| Control                               | Trigger                     | Mutation?                     | Telemetry event                | Registry                  | Hook                                 |
| ------------------------------------- | --------------------------- | ----------------------------- | ------------------------------ | ------------------------- | ------------------------------------ |
| Backdrop click                        | `onClose()`                 | No                            | none                           | -                         | noop                                 |
| Close (X) button                      | `onClose()`                 | No                            | none                           | -                         | noop                                 |
| Edit toggle (pen icon)                | `setEdit(v => !v)`          | No                            | none                           | -                         | noop                                 |
| Status segment (todo/inprogress/done) | `setStatus(k)`              | **YES** — update task_status  | **`oppgaver.task_completed`**  | **MISSING**               | **MISSING**                          |
| Priority segment                      | `setPri(p)`                 | **YES** — update priority     | none                           | -                         | **MISSING** — no event or hook       |
| Assignee person picker                | `setAssignee(a)`            | **YES** — update assigned_to  | `session_task.assigned`        | IN REGISTRY               | **FLAGGED** same anti-pattern        |
| "Marker pågår" button                 | `setStatus("inprogress")`   | **YES** — update task_status  | none (partial)                 | -                         | **MISSING**                          |
| "Rediger" button                      | `setEdit(true)`             | No                            | none                           | -                         | noop                                 |
| Chapter link / "Ikke knyttet"         | `onChapter(null/book,ch)`   | No                            | `oppgaver.context_pinned`      | IN REGISTRY               | noop                                 |
| Manual link                           | `onOpenManual(manual)`      | No                            | `oppgaver.task_focused`        | IN REGISTRY               | noop                                 |
| Subtask row click                     | `toggleSub(s.id)`           | **YES** — update subtask.done | **`oppgaver.subtask_toggled`** | **MISSING FROM REGISTRY** | **MISSING**                          |
| Evidence "Ta bilde" button            | `toast("Kamera åpnet")`     | No — stub                     | none                           | -                         | noop (stub)                          |
| Evidence "Vedlegg" button             | `toast("Vedlegg lagt til")` | No — stub                     | none                           | -                         | noop (stub)                          |
| Evidence "Signér" button              | `toast("Signert")`          | No — stub                     | none                           | -                         | noop (stub)                          |
| Comment textarea                      | `setDraft(e.target.value)`  | No                            | none                           | -                         | noop                                 |
| "Bilde" media button                  | `addMedia("Bilde")`         | **YES** — appends to activity | none                           | -                         | **MISSING**                          |
| "Video" media button                  | `addMedia("Video")`         | **YES** — appends to activity | none                           | -                         | **MISSING**                          |
| "Kommentér" button                    | `addComment()`              | **YES** — appends comment     | none                           | -                         | **MISSING**                          |
| "Følg" bell button                    | `toast("Du følger")`        | No — stub                     | none                           | -                         | noop (stub)                          |
| "Marker ferdig" (footer)              | `setStatus("done")`         | **YES** — update task_status  | **`oppgaver.task_completed`**  | **MISSING**               | **MISSING** — useCompleteTask needed |
| "Gjenåpne" (footer)                   | `setStatus("todo")`         | **YES** — update task_status  | **`oppgaver.task_completed`**  | **MISSING**               | **MISSING**                          |

### 8. Dagslinje (timeline view)

| Control                                             | Trigger                        | Mutation?                       | Telemetry event              | Registry    | Hook                                                             |
| --------------------------------------------------- | ------------------------------ | ------------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------- |
| Group-by mode selector (ansatt/avdeling/omrade/lag) | `setMode(k)`                   | No                              | `oppgaver.view_mode_changed` | IN REGISTRY | noop                                                             |
| Task chip drag (onDragStart/End)                    | drag state                     | No                              | none                         | -           | noop                                                             |
| Task chip drop on lane                              | `drop(g, e)` → `setTasks(...)` | **YES** — reschedule + reassign | `oppgaver.task_re_timed`     | IN REGISTRY | **MISSING** — task.update_session_task capability hook not built |
| Task chip click                                     | `onOpen(t.id)`                 | No                              | `oppgaver.task_focused`      | IN REGISTRY | noop                                                             |

### 9. Routines tab

| Control                             | Trigger                        | Mutation?                       | Telemetry event                | Registry    | Hook        |
| ----------------------------------- | ------------------------------ | ------------------------------- | ------------------------------ | ----------- | ----------- |
| Category filter chip                | `setCat(c)`                    | No                              | `oppgaver.area_filter_changed` | IN REGISTRY | noop        |
| Cadence filter chip                 | `setCad(c)`                    | No                              | none                           | -           | noop        |
| "Foreslå rutine" (Botsson)          | `toast(...)`                   | No — stub                       | none                           | -           | noop (stub) |
| "Ny rutine" button                  | `toast(...)`                   | No — stub                       | none                           | -           | noop (stub) |
| Routine card switch (toggle active) | `toggle(r)`                    | **YES** — update routine.active | none                           | -           | **MISSING** |
| Routine chapter link                | `onChapter(r.book, r.chapter)` | No                              | `oppgaver.context_pinned`      | IN REGISTRY | noop        |
| "Se generert oppgave" arrow         | `onOpenTask(r.task)`           | No                              | `oppgaver.task_focused`        | IN REGISTRY | noop        |

### 10. FormViewer (oppgaver-form.jsx)

| Control                                        | Trigger                          | Mutation?                                    | Telemetry event                                                    | Registry    | Hook        |
| ---------------------------------------------- | -------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | ----------- | ----------- |
| Question inputs (tall/sjekk/vurdering/foto/qr) | `onChange(v)`                    | No                                           | none                                                               | -           | noop        |
| "Signér" button                                | `setDone(true)` + `toast(...)`   | **YES** — locks answers + generates evidence | none (should be `oppgaver.task_completed` or separate form_signed) | -           | **MISSING** |
| Post-sign "Ferdig" button                      | `onComplete(task.id); onClose()` | **YES** — sets task status done              | `oppgaver.task_completed`                                          | **MISSING** | **MISSING** |
| Overlay click (close)                          | `onClose`                        | No                                           | none                                                               | -           | noop        |

### 11. FlowPlayer (oppgaver-form.jsx)

| Control                          | Trigger       | Mutation?                               | Telemetry event | Registry | Hook                                                                         |
| -------------------------------- | ------------- | --------------------------------------- | --------------- | -------- | ---------------------------------------------------------------------------- |
| "Forrige" / "Neste" step buttons | `setI(x+/-1)` | No                                      | none            | -        | noop                                                                         |
| Quiz option select               | `setAns(...)` | No                                      | none            | -        | noop                                                                         |
| "Fullfør" button                 | `toast(...)`  | **YES** — read-receipt / completion log | none            | -        | **MISSING** (read-receipt: should emit `oppgaver.task_focused` or new event) |
| Overlay click (close)            | `onClose`     | No                                      | none            | -        | noop                                                                         |

### 12. ChapterViewer (oppgaver-form.jsx)

| Control                            | Trigger                          | Mutation? | Telemetry event           | Registry    | Hook |
| ---------------------------------- | -------------------------------- | --------- | ------------------------- | ----------- | ---- |
| "Åpne i Bibliotek" button          | `toast(...)`                     | No        | `oppgaver.context_pinned` | IN REGISTRY | noop |
| External doc links (PDF/Prosedyre) | `toast(...)`                     | No        | `oppgaver.context_pinned` | IN REGISTRY | noop |
| Expand icon                        | `toast("Åpner i Dokumentmodus")` | No        | none                      | -           | noop |
| Close (X)                          | `onClose`                        | No        | none                      | -           | noop |

---

## Registry Gap Analysis

### Events MISSING from registry (blockers)

| Event needed               | Where fired                                                                                                           | Priority                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `oppgaver.task_completed`  | TaskRow toggle, Drawer setStatus("done"/"todo"/"inprogress"), DayBoard, FormViewer sign+complete, BulkAction bulkDone | P0 — primary mutation of this surface    |
| `oppgaver.subtask_toggled` | Drawer toggleSub                                                                                                      | P1 — partial update, should be auditable |

### Events IN registry, not yet emitted (implementation gaps)

| Event                              | Where it should fire                         | Notes                            |
| ---------------------------------- | -------------------------------------------- | -------------------------------- |
| `oppgaver.view_opened`             | Page mount (OppgaverPage)                    | Read-surface entry point         |
| `oppgaver.view_mode_changed`       | Tab clicks, Dagslinje mode selector          | UI state                         |
| `oppgaver.area_filter_changed`     | Filter chips, origin filter                  | UI state                         |
| `oppgaver.task_focused`            | onOpen(task.id) calls                        | Read-path                        |
| `oppgaver.context_pinned`          | ChapterLink, ChapterViewer open              | UI intent                        |
| `oppgaver.task_re_timed`           | Dagslinje DnD drop                           | Write mutation — also needs hook |
| `oppgaver.pulse_now_clicked`       | Pulse card clicks                            | UI                               |
| `oppgaver.template_apply_clicked`  | Routine "Apply template" (not in design yet) | Placeholder                      |
| `oppgaver.location_filter_changed` | Area/location filter changes                 | UI intent                        |
| `oppgaver.close_day_clicked`       | Dag-close CTA (not in current design)        | Placeholder stub                 |

---

## Hook / Backend Wiring Status

| Hook                                               | Status                                | Controls wired to it                                            | Flag                                                   |
| -------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `useCompleteTask` (hms/\_hooks)                    | EXISTS, NOT wired to oppgaver surface | TaskRow toggle, Drawer footer, DayBoard, FormViewer complete    | Must wire — Server Action path (ADR-0298)              |
| `useCascadeTasks`                                  | EXISTS (read query)                   | Not applicable to mutations                                     | OK for data loading                                    |
| `useTaskCompletion`                                | EXISTS (read query)                   | Overview stats display                                          | OK for read                                            |
| `useAssignTask`                                    | EXISTS, **FLAGGED ADR-0134**          | TaskRow reassign, BulkAssign, Drawer assignee, Botsson "Tildel" | needs-gating F0.3 — direct .update + void emit         |
| `useCreateQuickTask`                               | EXISTS, **FLAGGED ADR-0114/0134**     | AdhocCompose submit                                             | needs-gating F0.3 — direct .insert + void emit         |
| Hook for routine toggle                            | MISSING                               | Routines tab switch                                             | New hook needed                                        |
| Hook for subtask toggle                            | MISSING                               | Drawer toggleSub                                                | New hook needed                                        |
| Hook for task.update_session_task (DnD reschedule) | MISSING                               | Dagslinje drop                                                  | New hook needed (capability: task.update_session_task) |
| Hook for duplicate task                            | MISSING                               | TaskRow "Dupliser"                                              | New hook needed                                        |
| Hook for add comment                               | MISSING                               | Drawer addComment                                               | New hook needed                                        |
| Hook for add evidence/media                        | MISSING                               | Drawer addMedia, FormViewer sign                                | New hook needed                                        |
| Hook for FlowPlayer read-receipt                   | MISSING                               | FlowPlayer "Fullfør"                                            | New hook needed                                        |
| Hook for bulk-done                                 | MISSING                               | BulkAction "Marker ferdig"                                      | Extends useCompleteTask (batch)                        |
| Hook for priority update                           | MISSING                               | Drawer setPri                                                   | New hook or extend useCompleteTask                     |
