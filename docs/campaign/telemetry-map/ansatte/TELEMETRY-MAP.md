---
title: Telemetry Map — ansatte domain
status: draft
created: 2026-05-31
updated: 2026-05-31
module: ansatte
tags: [telemetry, interactive-elements, hooks, registry]
---

# Telemetry Map — Ansatte Domain

Sourced from: 9 design files + mock data at `/mnt/c/Users/sxtnl/Downloads/Smartout.ai_re-designe/apps/web/pages/`

Legend:

- **REGISTRY: IN** = event exists verbatim in `packages/telemetry/src/registry.ts`
- **REGISTRY: MISSING** = event name does NOT exist in registry — must be added
- **NOOP** = client-only UI state toggle (no backend write, no telemetry required)
- **IDENTITY FLAG** = joins `user_identity` — flag per schema trap rule

---

## 1. ansatte-directory.jsx — Directory Surface

| #   | Element                              | File      | Action                                                     | Mutation                            | Proposed Event                              | Registry Status | Backend Hook                                      |
| --- | ------------------------------------ | --------- | ---------------------------------------------------------- | ----------------------------------- | ------------------------------------------- | --------------- | ------------------------------------------------- |
| 1   | Surface switch "Ansatte" button      | directory | `onClick → setSurface("ansatte")`                          | No                                  | —                                           | NOOP            | —                                                 |
| 2   | Surface switch "Kontrakter" button   | directory | `onClick → setSurface("kontrakter")`                       | No                                  | —                                           | NOOP            | —                                                 |
| 3   | "Ny ansatt" button                   | directory | `onClick → toast("Ny ansatt — onboarding-veiviser åpnet")` | **YES** — triggers onboarding flow  | `people.employee.onboarding_wizard_started` | **MISSING**     | useDrawerProfile (new profile)                    |
| 4   | "Eksport" button (contracts surface) | directory | `onClick → toast("Eksporterer kontrakter")`                | **YES** — export action             | `contracts.export.initiated`                | **MISSING**     | useEmploymentContracts                            |
| 5   | KPI Pulse "Totalt"                   | directory | `onClick → setTab("all")`                                  | No                                  | —                                           | NOOP            | —                                                 |
| 6   | KPI Pulse "Under opplæring"          | directory | `onClick → setTab("trainee")`                              | No                                  | —                                           | NOOP            | —                                                 |
| 7   | KPI Pulse "Klare for vakt"           | directory | `onClick → setTab("all")`                                  | No                                  | —                                           | NOOP            | —                                                 |
| 8   | KPI Pulse "Usignerte avtaler"        | directory | `onClick → setTab("all")`                                  | No                                  | —                                           | NOOP            | —                                                 |
| 9   | Botsson "Se Petter" button           | directory | `onClick → onOpen("pk")`                                   | No                                  | —                                           | NOOP (nav)      | —                                                 |
| 10  | Lifecycle tab "Alle"                 | directory | `onClick → setTab("all")`                                  | No                                  | —                                           | NOOP            | —                                                 |
| 11  | Lifecycle tab "Aktive"               | directory | `onClick → setTab("active")`                               | No                                  | —                                           | NOOP            | —                                                 |
| 12  | Lifecycle tab "Under opplæring"      | directory | `onClick → setTab("trainee")`                              | No                                  | —                                           | NOOP            | —                                                 |
| 13  | Lifecycle tab "Inaktive"             | directory | `onClick → setTab("inactive")`                             | No                                  | —                                           | NOOP            | —                                                 |
| 14  | Lifecycle tab "Avslutter"            | directory | `onClick → setTab("offboarding")`                          | No                                  | —                                           | NOOP            | —                                                 |
| 15  | Search input                         | directory | `onChange → setQ`                                          | No                                  | —                                           | NOOP            | —                                                 |
| 16  | Filter "Avdeling" button             | directory | `onClick → setDeptOpen`                                    | No                                  | —                                           | NOOP            | —                                                 |
| 17  | Filter pop "Alle avdelinger"         | directory | `onClick → setDeptF(null)`                                 | No                                  | —                                           | NOOP            | —                                                 |
| 18  | Filter pop dept item (per dept)      | directory | `onClick → setDeptF(d.id)`                                 | No                                  | —                                           | NOOP            | —                                                 |
| 19  | View toggle "Tabell"                 | directory | `onClick → setView("table")`                               | No                                  | —                                           | NOOP            | —                                                 |
| 20  | View toggle "Kort"                   | directory | `onClick → setView("cards")`                               | No                                  | —                                           | NOOP            | —                                                 |
| 21  | Row checkbox (select/deselect)       | directory | `onClick ev.stopPropagation → onToggle(e.id)`              | No                                  | —                                           | NOOP            | —                                                 |
| 22  | Select-all checkbox in thead         | directory | `onClick → toggleAll()`                                    | No                                  | —                                           | NOOP            | —                                                 |
| 23  | Table row (open employee)            | directory | `onClick → onOpen(e.id)`                                   | No                                  | —                                           | NOOP (nav)      | —                                                 |
| 24  | Card (open employee)                 | directory | `onClick → onOpen(e.id)`                                   | No                                  | —                                           | NOOP (nav)      | —                                                 |
| 25  | Bulk "Tildel opplæring" button       | directory | `onClick → bulk("Tildelt opplæring")`                      | **YES** — batch protocol assignment | `people.bulk.training_assigned`             | **MISSING**     | useWorkforceReadiness + protocol assignment write |
| 26  | Bulk "Melding" button                | directory | `onClick → bulk("Sendt melding")`                          | **YES** — batch message             | `people.bulk.message_sent`                  | **MISSING**     | No hook wired yet                                 |
| 27  | Bulk "Sett avdeling" button          | directory | `onClick → bulk("Satt avdeling")`                          | **YES** — batch dept assignment     | `people.bulk.department_set`                | **MISSING**     | No hook wired yet                                 |
| 28  | Bulk "X" (clear selection)           | directory | `onClick → setSel({})`                                     | No                                  | —                                           | NOOP            | —                                                 |

---

## 2. ansatte-contracts.jsx — Contracts Surface

| #   | Element                                  | File      | Action                                                    | Mutation                 | Proposed Event               | Registry Status     | Backend Hook                        |
| --- | ---------------------------------------- | --------- | --------------------------------------------------------- | ------------------------ | ---------------------------- | ------------------- | ----------------------------------- |
| 29  | Contracts sub-tab "Avtaler"              | contracts | `onClick → setView("avtaler")`                            | No                       | —                            | NOOP                | —                                   |
| 30  | Contracts sub-tab "Maler"                | contracts | `onClick → setView("maler")`                              | No                       | —                            | NOOP                | —                                   |
| 31  | "Legg til kontrakt" button               | contracts | `onClick → setAdd(true)`                                  | No                       | —                            | NOOP (opens drawer) | —                                   |
| 32  | "Ny mal" button (maler view)             | contracts | `onClick → setEditTpl(null)`                              | No                       | —                            | NOOP (opens editor) | —                                   |
| 33  | KPI Pulse "Aktive avtaler"               | contracts | `onClick → setFilter("alle")`                             | No                       | —                            | NOOP                | —                                   |
| 34  | KPI Pulse "Til signering"                | contracts | `onClick → setFilter("signering")`                        | No                       | —                            | NOOP                | —                                   |
| 35  | KPI Pulse "Nysignerte"                   | contracts | `onClick → setFilter("nysignerte")`                       | No                       | —                            | NOOP                | —                                   |
| 36  | KPI Pulse "Utløper snart"                | contracts | `onClick → setFilter("utloper")`                          | No                       | —                            | NOOP                | —                                   |
| 37  | Filter chip "Alle"                       | contracts | `onClick → setFilter("alle")`                             | No                       | —                            | NOOP                | —                                   |
| 38  | Filter chip "Nysignerte"                 | contracts | `onClick → setFilter("nysignerte")`                       | No                       | —                            | NOOP                | —                                   |
| 39  | Filter chip "Til signering"              | contracts | `onClick → setFilter("signering")`                        | No                       | —                            | NOOP                | —                                   |
| 40  | Filter chip "Utløper snart"              | contracts | `onClick → setFilter("utloper")`                          | No                       | —                            | NOOP                | —                                   |
| 41  | Contract activity row click (nysignerte) | contracts | `onClick → onOpen(a.profile, "kontrakt")`                 | No                       | —                            | NOOP (nav)          | —                                   |
| 42  | Contract row click (standard list)       | contracts | `onClick → onOpen(e.id, "kontrakt")`                      | No                       | —                            | NOOP (nav)          | —                                   |
| 43  | "Purr" (bell) button on sent contract    | contracts | `onClick ev.stopPropagation → toast("Påminnelse sendt…")` | **YES** — sends reminder | `contracts.resend.submitted` | **IN**              | useSendContract / invitation resend |

### AddContract Drawer

| #   | Element                                               | File      | Action                    | Mutation                              | Proposed Event                                | Registry Status | Backend Hook       |
| --- | ----------------------------------------------------- | --------- | ------------------------- | ------------------------------------- | --------------------------------------------- | --------------- | ------------------ |
| 44  | AddContract backdrop click                            | contracts | `onClick → onClose()`     | No                                    | —                                             | NOOP            | —                  |
| 45  | AddContract close (X) button                          | contracts | `onClick → onClose()`     | No                                    | —                                             | NOOP            | —                  |
| 46  | "Velg ansatt" select                                  | contracts | `onChange → setEmpId`     | No                                    | —                                             | NOOP            | —                  |
| 47  | Ansettelsesform segment "Fast/Midlertidig/Tilkalling" | contracts | `onClick → setForm(f)`    | No                                    | —                                             | NOOP            | —                  |
| 48  | Lønnstype segment "Timelønn/Fastlønn"                 | contracts | `onClick → setPay(p)`     | No                                    | —                                             | NOOP            | —                  |
| 49  | "Legg til vedlegg" button (toggle menu)               | contracts | `onClick → setAttach(!a)` | No                                    | —                                             | NOOP            | —                  |
| 50  | Attach option "Generer fra mal"                       | contracts | `onClick → toast(…)`      | **YES** — generates doc from template | `contracts.compose.template_selected`         | **IN**          | useComposeContract |
| 51  | Attach option "Last opp fil"                          | contracts | `onClick → toast(…)`      | **YES** — file upload intent          | `contract_attachment.upload_initiated`        | **MISSING**     | No hook wired      |
| 52  | "Avbryt" button                                       | contracts | `onClick → onClose()`     | No                                    | —                                             | NOOP            | —                  |
| 53  | "Lagre utkast" button                                 | contracts | `onClick → send(true)`    | **YES** — persists draft              | `contracts.compose.submitted` (persist:false) | **IN**          | useComposeContract |
| 54  | "Send til signering" button                           | contracts | `onClick → send(false)`   | **YES** — sends for signing           | `contract.send_initiated`                     | **IN**          | useSendContract    |

---

## 3. ansatte-controls.jsx — Control Center Modals

### ProfileCC Modal

| #   | Element                       | File     | Action                               | Mutation                         | Proposed Event                                        | Registry Status                                    | Backend Hook                        |
| --- | ----------------------------- | -------- | ------------------------------------ | -------------------------------- | ----------------------------------------------------- | -------------------------------------------------- | ----------------------------------- |
| 55  | ProfileCC backdrop (scrim)    | controls | `onMouseDown → close()`              | No                               | —                                                     | NOOP                                               | —                                   |
| 56  | ProfileCC X button            | controls | `onClick → close()`                  | No                               | —                                                     | NOOP                                               | —                                   |
| 57  | Quick link "Tilgang & ansvar" | controls | `onClick → AnCtl.open("access")`     | No                               | —                                                     | NOOP (nav)                                         | —                                   |
| 58  | Quick link "Plassering"       | controls | `onClick → AnCtl.open("placement")`  | No                               | —                                                     | NOOP (nav)                                         | —                                   |
| 59  | Quick link "Kompetanse"       | controls | `onClick → AnCtl.open("competence")` | No                               | —                                                     | NOOP (nav)                                         | —                                   |
| 60  | "Lagre endringer" button      | controls | `onSave → toast("Profil oppdatert")` | **YES** — updates profile fields | `profile role updated` / `profile department updated` | **IN** (partial — full profile edit event MISSING) | useDrawerProfile (needs write hook) |

### AccessEdit Modal

| #   | Element                               | File     | Action                                          | Mutation                           | Proposed Event         | Registry Status | Backend Hook                                        |
| --- | ------------------------------------- | -------- | ----------------------------------------------- | ---------------------------------- | ---------------------- | --------------- | --------------------------------------------------- |
| 61  | Access level radio buttons            | controls | `onClick → setAcc(a.id)`                        | No                                 | —                      | NOOP            | —                                                   |
| 62  | Authority level segment buttons       | controls | `onClick → setAuth(a.id)`                       | No                                 | —                      | NOOP            | —                                                   |
| 63  | Leadership toggle rows (4 toggles)    | controls | `onClick → Toggle sets value`                   | No (local state)                   | —                      | NOOP            | —                                                   |
| 64  | Fine-grained scope toggles (existing) | controls | `onClick → Toggle sets value`                   | No (local state)                   | —                      | NOOP            | —                                                   |
| 65  | Fine-grained scope toggles (extra)    | controls | `onClick → Toggle sets value`                   | No (local state)                   | —                      | NOOP            | —                                                   |
| 66  | "Lagre — logg endring" button         | controls | `onSave → toast("Tilgang oppdatert · logget…")` | **YES** — updates access/authority | `profile role updated` | **IN**          | needs write hook (no upsert hook exists for access) |

### PlacementEdit Modal

| #   | Element                   | File     | Action                                   | Mutation                                         | Proposed Event               | Registry Status | Backend Hook                                         |
| --- | ------------------------- | -------- | ---------------------------------------- | ------------------------------------------------ | ---------------------------- | --------------- | ---------------------------------------------------- |
| 67  | Primary dept select       | controls | `onChange → setPrimary`                  | No                                               | —                            | NOOP            | —                                                    |
| 68  | Dept chip toggles         | controls | `onClick → tog(depts, setDepts, d.id)`   | No                                               | —                            | NOOP            | —                                                    |
| 69  | Location chip toggles     | controls | `onClick → tog(locs, setLocs, l.id)`     | No                                               | —                            | NOOP            | —                                                    |
| 70  | Team select               | controls | `defaultValue` — no onChange             | No                                               | —                            | NOOP            | —                                                    |
| 71  | Dept leader select        | controls | `defaultValue` — no onChange             | No                                               | —                            | NOOP            | —                                                    |
| 72  | "Lagre plassering" button | controls | `onSave → toast("Plassering oppdatert")` | **YES** — updates placement (dept/team/location) | `profile department updated` | **IN**          | needs write hook (team: `profile team_member added`) |

### AddCompetence Modal

| #   | Element                                                          | File     | Action                                  | Mutation                                      | Proposed Event            | Registry Status | Backend Hook                                                 |
| --- | ---------------------------------------------------------------- | -------- | --------------------------------------- | --------------------------------------------- | ------------------------- | --------------- | ------------------------------------------------------------ |
| 73  | Competence type segment (stilling/profesjon/juridisk/sertifikat) | controls | `onClick → setType(id)`                 | No                                            | —                         | NOOP            | —                                                            |
| 74  | Stilling select                                                  | controls | select                                  | No                                            | —                         | NOOP            | —                                                            |
| 75  | "Sett som primær stilling" toggle                                | controls | `onClick → Toggle`                      | No                                            | —                         | NOOP            | —                                                            |
| 76  | Profesjon select                                                 | controls | select                                  | No                                            | —                         | NOOP            | —                                                            |
| 77  | Juridisk funksjon select                                         | controls | select                                  | No                                            | —                         | NOOP            | —                                                            |
| 78  | Tildelt av select (juridisk)                                     | controls | select                                  | No                                            | —                         | NOOP            | —                                                            |
| 79  | "Legg til" button                                                | controls | `onSave → toast("Kompetanse lagt til")` | **YES** — adds position/profession/legal/cert | `people.competence.added` | **MISSING**     | No hook wired (protocol_assignment / profile_position write) |

### NewAbsence Modal

| #   | Element                                          | File     | Action                                      | Mutation                         | Proposed Event              | Registry Status | Backend Hook                        |
| --- | ------------------------------------------------ | -------- | ------------------------------------------- | -------------------------------- | --------------------------- | --------------- | ----------------------------------- |
| 80  | Absence type select                              | controls | select                                      | No                               | —                           | NOOP            | —                                   |
| 81  | Fra input (date)                                 | controls | input                                       | No                               | —                           | NOOP            | —                                   |
| 82  | Til input (date)                                 | controls | input                                       | No                               | —                           | NOOP            | —                                   |
| 83  | Kommentar input                                  | controls | input                                       | No                               | —                           | NOOP            | —                                   |
| 84  | Fravær → link to "Personalhåndboken" in gov hint | controls | `onClick → toast("Åpner Personalhåndbok…")` | No                               | —                           | NOOP (nav)      | —                                   |
| 85  | "Registrer" button                               | controls | `onSave → toast("Fravær registrert…")`      | **YES** — creates absence record | `people.absence.registered` | **MISSING**     | No hook wired (absence table write) |

### AssignCenter Modal (hub + sub-modes)

| #   | Element                                                  | File     | Action                                      | Mutation                                | Proposed Event                 | Registry Status | Backend Hook                                      |
| --- | -------------------------------------------------------- | -------- | ------------------------------------------- | --------------------------------------- | ------------------------------ | --------------- | ------------------------------------------------- |
| 86  | "Tildel opplæring" card                                  | controls | `onClick → setMode("opplaering")`           | No                                      | —                              | NOOP (nav)      | —                                                 |
| 87  | "Tildel oppgave" card                                    | controls | `onClick → setMode("oppgave")`              | No                                      | —                              | NOOP (nav)      | —                                                 |
| 88  | "Legg i dagsliste" card                                  | controls | `onClick → setMode("dagsliste")`            | No                                      | —                              | NOOP (nav)      | —                                                 |
| 89  | "Send dokument" card                                     | controls | `onClick → setMode("dokument")`             | No                                      | —                              | NOOP (nav)      | —                                                 |
| 90  | "Sett opp vakt" card                                     | controls | `onClick → toast("Åpner vaktplan…")`        | No (opens schedule)                     | —                              | NOOP (nav)      | —                                                 |
| 91  | "Tildel juridisk verv" card                              | controls | `onClick → toast("Juridisk verv tildelt…")` | **YES** — assigns legal role            | `legal_function assigned`      | **IN**          | No hook wired (profile_legal_function write)      |
| 92  | Opplæring filter chips (alle/relevante/mangler/fullfort) | controls | `onClick → setF(x.id)`                      | No                                      | —                              | NOOP            | —                                                 |
| 93  | Opplæring search input                                   | controls | `onChange → setQ`                           | No                                      | —                              | NOOP            | —                                                 |
| 94  | Opplæring pick row                                       | controls | `onClick → toggle(it.id)`                   | No                                      | —                              | NOOP            | —                                                 |
| 95  | Opplæring "Tilbake" button                               | controls | `onClick → goHub()`                         | No                                      | —                              | NOOP            | —                                                 |
| 96  | Opplæring confirm button                                 | controls | `onClick → toast("X opplæring tildelt…")`   | **YES** — assigns protocol(s)           | `protocol assigned`            | **IN**          | useWorkforceReadiness (protocol_assignment write) |
| 97  | Dokument filter chips                                    | controls | `onClick → setF(x.id)`                      | No                                      | —                              | NOOP            | —                                                 |
| 98  | Dokument search input                                    | controls | `onChange → setQ`                           | No                                      | —                              | NOOP            | —                                                 |
| 99  | Dokument pick row                                        | controls | `onClick → toggle(it.id)`                   | No                                      | —                              | NOOP            | —                                                 |
| 100 | Dokument "Tilbake" button                                | controls | `onClick → goHub()`                         | No                                      | —                              | NOOP            | —                                                 |
| 101 | Dokument confirm "Send" button                           | controls | `onClick → toast("X dokument sendt…")`      | **YES** — sends document(s) to employee | `people.document.sent`         | **MISSING**     | No hook wired                                     |
| 102 | Oppgave search input                                     | controls | `onChange → setQ`                           | No                                      | —                              | NOOP            | —                                                 |
| 103 | Oppgave pick row                                         | controls | `onClick → toggle(it.id)`                   | No                                      | —                              | NOOP            | —                                                 |
| 104 | Oppgave "Legg også i dagslisten" toggle                  | controls | `onClick → Toggle`                          | No                                      | —                              | NOOP            | —                                                 |
| 105 | Oppgave "Tilbake" button                                 | controls | `onClick → goHub()`                         | No                                      | —                              | NOOP            | —                                                 |
| 106 | Oppgave confirm "Tildel" button                          | controls | `onClick → toast("X oppgave tildelt…")`     | **YES** — assigns task(s)               | `people.task.assigned`         | **MISSING**     | No hook wired                                     |
| 107 | Dagsliste search input                                   | controls | `onChange → setQ`                           | No                                      | —                              | NOOP            | —                                                 |
| 108 | Dagsliste pick row                                       | controls | `onClick → toggle(it.id)`                   | No                                      | —                              | NOOP            | —                                                 |
| 109 | Dagsliste confirm "Legg til" button                      | controls | `onClick → toast("X lagt i dagsliste…")`    | **YES** — adds to daily list            | `people.task.daily_list_added` | **MISSING**     | No hook wired                                     |

### RecertPlan Modal

| #   | Element                                                 | File     | Action                                         | Mutation                          | Proposed Event                    | Registry Status | Backend Hook  |
| --- | ------------------------------------------------------- | -------- | ---------------------------------------------- | --------------------------------- | --------------------------------- | --------------- | ------------- |
| 110 | Recert preset buttons (1 uke/2 uker/1 mnd/Egendefinert) | controls | `onClick → setWhen(p)`                         | No                                | —                                 | NOOP            | —             |
| 111 | Custom date input (Egendefinert)                        | controls | input                                          | No                                | —                                 | NOOP            | —             |
| 112 | Ansvarlig select                                        | controls | select                                         | No                                | —                                 | NOOP            | —             |
| 113 | "Send påminnelse til ansatt" toggle                     | controls | `onClick → Toggle`                             | No                                | —                                 | NOOP            | —             |
| 114 | "Varsle nærmeste leder" toggle                          | controls | `onClick → Toggle`                             | No                                | —                                 | NOOP            | —             |
| 115 | "Forleng frist" button                                  | controls | `onClick → toast("Frist forlenget 30 dager")`  | **YES** — extends recert deadline | `people.recert.deadline_extended` | **MISSING**     | No hook wired |
| 116 | "Planlegg re-sertifisering" button                      | controls | `onSave → toast("Re-sertifisering planlagt…")` | **YES** — schedules recert        | `people.recert.scheduled`         | **MISSING**     | No hook wired |

### VideoCall Modal

| #   | Element          | File     | Action                      | Mutation     | Proposed Event       | Registry Status | Backend Hook  |
| --- | ---------------- | -------- | --------------------------- | ------------ | -------------------- | --------------- | ------------- |
| 117 | "Demp" button    | controls | `onClick` (no handler)      | No           | —                    | NOOP            | —             |
| 118 | "Avslutt" button | controls | `onClick → toast + close()` | No (UI only) | `channel.call.ended` | **IN**          | No hook wired |
| 119 | "Video" button   | controls | `onClick` (no handler)      | No           | —                    | NOOP            | —             |

### MessageThread Modal

| #   | Element                   | File     | Action                                         | Mutation                                                        | Proposed Event        | Registry Status | Backend Hook  |
| --- | ------------------------- | -------- | ---------------------------------------------- | --------------------------------------------------------------- | --------------------- | --------------- | ------------- |
| 120 | Chat input                | controls | `onChange → setV` / `onKeyDown Enter → send()` | No                                                              | —                     | NOOP            | —             |
| 121 | Chat send button          | controls | `onClick → send()`                             | **YES** (local state only in design — real impl writes message) | `people.message.sent` | **MISSING**     | No hook wired |
| 122 | "Ring" button (from chat) | controls | `onClick → AnCtl.open("call")`                 | No                                                              | —                     | NOOP (nav)      | —             |
| 123 | Chat X close button       | controls | `onClick → close()`                            | No                                                              | —                     | NOOP            | —             |

---

## 4. ansatte-panels.jsx — Readiness & Contract Panels

| #   | Element                                               | File   | Action                                                           | Mutation                                        | Proposed Event                    | Registry Status     | Backend Hook    |
| --- | ----------------------------------------------------- | ------ | ---------------------------------------------------------------- | ----------------------------------------------- | --------------------------------- | ------------------- | --------------- |
| 124 | Botsson assist action buttons (x1–x2, context-driven) | panels | `onClick → setDone + toast(a.t)`                                 | **YES** — Botsson action (e.g. remind, suggest) | `people.botsson.action_invoked`   | **MISSING**         | No hook wired   |
| 125 | ProtoCard expand (hasProof)                           | panels | `onClick → setOpen(!o)`                                          | No                                              | —                                 | NOOP                | —               |
| 126 | Recert "Påminn" button                                | panels | `onClick ev.stopPropagation → toast("Påminnelse sendt")`         | **YES** — sends reminder notification           | `people.recert.reminder_sent`     | **MISSING**         | No hook wired   |
| 127 | Recert "Forleng" button                               | panels | `onClick ev.stopPropagation → toast("Frist forlenget 30 dager")` | **YES** — extends recert deadline               | `people.recert.deadline_extended` | **MISSING**         | No hook wired   |
| 128 | Recert "Planlegg" button                              | panels | `onClick ev.stopPropagation → AnCtl.open("recert", …)`           | No                                              | —                                 | NOOP (opens modal)  | —               |
| 129 | Readiness blocker "Løs" button                        | panels | `onClick → toast("Botsson foreslår tiltak")`                     | No (advisory)                                   | —                                 | NOOP                | —               |
| 130 | ContractPanel "Ny kontrakt" button                    | panels | `onClick → setAddOpen(true)`                                     | No                                              | —                                 | NOOP (opens drawer) | —               |
| 131 | Contract "Purr" (bell) on sent status                 | panels | `onClick → toast("Påminnelse om signering sendt")`               | **YES** — reminder                              | `contracts.resend.submitted`      | **IN**              | useSendContract |
| 132 | Contract "Send" on draft status                       | panels | `onClick → toast("Avtale sendt til signering")`                  | **YES** — sends contract                        | `contract.send_initiated`         | **IN**              | useSendContract |

---

## 5. ansatte-panels2.jsx — Competence, Access, Placement, Absence, PII, Offboarding, Audit

| #   | Element                                    | File    | Action                                         | Mutation                              | Proposed Event          | Registry Status    | Backend Hook                                                      |
| --- | ------------------------------------------ | ------- | ---------------------------------------------- | ------------------------------------- | ----------------------- | ------------------ | ----------------------------------------------------------------- |
| 133 | CompetencePanel "Legg til" button          | panels2 | `onClick → AnCtl.open("competence")`           | No                                    | —                       | NOOP (opens modal) | —                                                                 |
| 134 | AccessPanel "Endre" button                 | panels2 | `onClick → AnCtl.open("access")`               | No                                    | —                       | NOOP (opens modal) | —                                                                 |
| 135 | PlacementPanel "Endre" button              | panels2 | `onClick → AnCtl.open("placement")`            | No                                    | —                       | NOOP (opens modal) | —                                                                 |
| 136 | AbsencePanel "Nytt" button                 | panels2 | `onClick → AnCtl.open("absence")`              | No                                    | —                       | NOOP (opens modal) | —                                                                 |
| 137 | PII "Se innsynslogg" link                  | panels2 | `onClick → toast("Åpner revisjonslogg…")`      | No                                    | —                       | NOOP (nav)         | —                                                                 |
| 138 | PII reveal/hide button (per field, 5 rows) | panels2 | `onClick → setAsk(r) / setShown(…false)`       | **YES** — PII reveal is audited write | `admin.pii_reveal`      | **IN**             | audit log write (IDENTITY FLAG: field reveal joins user_identity) |
| 139 | PII ConfirmModal "Avbryt"                  | panels2 | `onClick → setAsk(null)`                       | No                                    | —                       | NOOP               | —                                                                 |
| 140 | PII ConfirmModal "Vis og logg innsyn"      | panels2 | `onConfirm → reveal(ask.k)`                    | **YES** — audit log write             | `admin.pii_reveal`      | **IN**             | audit log write (IDENTITY FLAG)                                   |
| 141 | AuditPanel "Eksport" button                | panels2 | `onClick → toast("Eksporterer revisjonslogg")` | **YES** — export                      | `people.audit.exported` | **MISSING**        | No hook wired                                                     |

---

## 6. ansatte-profile.jsx — Profile Host

| #   | Element                                           | File    | Action                                     | Mutation                                      | Proposed Event                  | Registry Status      | Backend Hook                        |
| --- | ------------------------------------------------- | ------- | ------------------------------------------ | --------------------------------------------- | ------------------------------- | -------------------- | ----------------------------------- |
| 142 | "Alle ansatte" back button                        | profile | `onClick → onBack()`                       | No                                            | —                               | NOOP (nav)           | —                                   |
| 143 | Profile tab bar (9 tabs)                          | profile | `onClick → setTab(t.id)`                   | No                                            | —                               | NOOP                 | —                                   |
| 144 | "Botsson" button                                  | profile | `onClick → toast("Mr. Botsson åpnet…")`    | No (advisory panel)                           | `contract.botsson_chip_invoked` | **IN**               | —                                   |
| 145 | Summary "Aktiver ansatt" button (trainee)         | profile | `onClick → setActivate(true)`              | No                                            | —                               | NOOP (opens confirm) | —                                   |
| 146 | Summary "Avslutningsløp" button (offboarding)     | profile | `onClick → toast("Avslutningsløp åpnet")`  | No                                            | —                               | NOOP (nav)           | —                                   |
| 147 | Summary "Reaktiver" button (inactive)             | profile | `onClick → toast + undo`                   | **YES** — reactivates employee                | `profile reactivated`           | **IN**               | useDrawerProfile (needs write hook) |
| 148 | Summary "Rediger profil" button (active)          | profile | `onClick → AnCtl.open("profile")`          | No                                            | —                               | NOOP (opens modal)   | —                                   |
| 149 | Summary "Ring" quick action                       | profile | `onClick → AnCtl.open("call")`             | No                                            | —                               | NOOP (opens modal)   | —                                   |
| 150 | Summary "Melding" quick action                    | profile | `onClick → AnCtl.open("message")`          | No                                            | —                               | NOOP (opens modal)   | —                                   |
| 151 | Summary "Tildel" quick action                     | profile | `onClick → AnCtl.open("assign")`           | No                                            | —                               | NOOP (opens modal)   | —                                   |
| 152 | ConfirmModal "Avbryt" (activate)                  | profile | `onClick → setActivate(false)`             | No                                            | —                               | NOOP                 | —                                   |
| 153 | ConfirmModal "Aktiver ansatt" / "Aktiver likevel" | profile | `onConfirm → toast(display + " aktivert")` | **YES** — lifecycle transition trainee→active | `profile activated`             | **IN**               | useDrawerProfile (needs write hook) |

---

## 7. ansatte-templates.jsx — Template Library & Document Editor

| #   | Element                                       | File      | Action                                     | Mutation                                       | Proposed Event                                                                       | Registry Status     | Backend Hook  |
| --- | --------------------------------------------- | --------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------- | ------------- |
| 154 | Template grid item (edit existing)            | templates | `onClick → onEdit(t)`                      | No                                             | —                                                                                    | NOOP (opens editor) | —             |
| 155 | Template grid "Ny mal" card                   | templates | `onClick → onEdit(null)`                   | No                                             | —                                                                                    | NOOP (opens editor) | —             |
| 156 | Editor "Maler" back button                    | templates | `onClick → onClose()`                      | No                                             | —                                                                                    | NOOP                | —             |
| 157 | Editor "Forhåndsvis / Rediger" toggle         | templates | `onClick → setPreview(!p)`                 | No                                             | —                                                                                    | NOOP                | —             |
| 158 | Editor "Lagre" button                         | templates | `onClick → toast("Mal lagret som utkast")` | **YES** — saves template draft                 | `contracts.template.viewed` (closest) → real: `contract_template.draft_saved`        | **MISSING**         | No hook wired |
| 159 | Editor "Publiser" button                      | templates | `onClick → toast + onClose()`              | **YES** — publishes template                   | `contracts.template.opened_in_admin` (closest) → real: `contract_template.published` | **MISSING**         | No hook wired |
| 160 | System field chip buttons (insert into block) | templates | `onClick → insert("{{token}}")`            | No                                             | —                                                                                    | NOOP                | —             |
| 161 | Deep link buttons (insert [[label]])          | templates | `onClick → insert("[[label]]")`            | No                                             | —                                                                                    | NOOP                | —             |
| 162 | Auto-vedlegg toggle                           | templates | `onClick → setAuto(!a)`                    | **YES** — sets auto-attach setting on template | `contract_template.auto_attach_toggled`                                              | **MISSING**         | No hook wired |
| 163 | Document block (select active block)          | templates | `onClick → setActive(key)`                 | No                                             | —                                                                                    | NOOP                | —             |
| 164 | Template name input (title edit)              | templates | `defaultValue` — no onSubmit               | No                                             | —                                                                                    | NOOP                | —             |

---

## Schema / Identity Flags

| Element                                             | Flag          | Reason                                                                                                                                                                            |
| --------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PII reveal (items 138, 140)                         | IDENTITY FLAG | PII fields (personnr, bank, address) are tied to `user_identity` (PK `user_id`). Any reveal query that joins identity directly must use `user_identity`, NOT `user`/`auth.users`. |
| ProfileCC save identity fields (name, email, phone) | IDENTITY FLAG | `e-post` and `telefon` live on `user_identity`, not `profile`. Saving these fields must write to `user_identity` via a privileged server route, not directly from client.         |

---

## Summary Table — Events Status

| Status                                       | Count |
| -------------------------------------------- | ----- |
| NOOP (no event needed)                       | 82    |
| Mutations with event IN registry             | 14    |
| Mutations with event MISSING from registry   | 20    |
| Hooks found (existing, reusable)             | 6     |
| Hooks missing (mutation has no backing hook) | 18    |
