---
title: "Procedure Engine — Roadmap"
id: ROADMAP_PROCEDURE_ENGINE
version: "1.1"
status: archived
superseded_by: docs/domains/procedure-engine/
module: procedure-engine
created: 2026-05-22
updated: 2026-05-22
author: Claude (Pontus)
tags:
  - roadmap
  - procedure-engine
  - task-manager
  - governance
  - policy
  - protocol
  - procedure
  - routine
  - task
  - one-truth-many-views
  - day-line
  - min-dag
  - role-compliance
  - botsson-setup
  - adr-0298
  - adr-0367
  - adr-0387
journeys:
  - J-proc-min-dag
  - J-proc-location-list
  - J-proc-cron-procedure
  - J-proc-routine-list
  - J-proc-personal-emma
  - J-proc-day-adhoc
  - J-proc-readwrite-foundation
  - J-proc-botsson-setup
  - J-proc-role-compliance
  - J-proc-admin-authoring
  - J-proc-doc-extraction
  - J-proc-wizard-routines
  - J-proc-window-push
---

# Procedure Engine — Roadmap

> **Én sannhet, flere visninger.** Prosedyren er den atomære kunnskapsenheten i Smartout — lagret én gang, vist som dokument, opplæring, oppgave, avvik og etterlevelse. Compliance er et biprodukt av faktisk kompetanse, ikke logget dokumentasjon.

**Modulnavn:** `procedure-engine` (omdøpt fra `task-manager` 2026-05-22 — task er bare Drift-visningen av prosedyren).

**Spec:** [`docs/superpowers/specs/2026-05-22-procedure-engine-design.md`](../../superpowers/specs/2026-05-22-procedure-engine-design.md) — read for governing model, data decisions, phase plan, gaps.

**Kort** — For admin (komponerer/autorer), ansatt (utfører/forbereder) og Botsson (forbereder/guider/vedlikeholder). "Ferdig" = admin lager rutiner med instruksjon/media + tildeler dem til lokasjon; cron materialiserer dem til dagens oppgaver; ansatt stempler inn, ser dagen sin på en tidslinje, forbereder neste vakt, og fullfører med bevis — og hele kjeden gir målbar etterlevelse mot definerte policyer.

**Styrende modell:**

```
Policy → Protocol (1:1) → Procedure → { Training (manual+quiz+signering) | Routine (+location,+team) → Task (instans) }
```

**Mellom** — Modulen forener tre uavhengig-vokste subsystemer: governance-spine (policy→protocol→procedure/routine, spec §1), lese/skrive-unifisering (ADR-0298, shipped), og D6-produksjonsstruktur (ADR-0367 day_line, schema shipped/wiring delvis). **In:** alt "en person må gjøre" på tvers av 4 kilder. **Out:** `engine_state_step` (control-plane runtime, ekskludert per ADR-0298 R2). Denne roadmapen er et **levende journey-status-dokument** — fase-detalj + falsifiserbar akseptanse bor i [BLUEPRINT.md](./BLUEPRINT.md); verifiserte gaps i [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Oppdater status her når en journey endrer tilstand.

**Faseplan (spec §6):** Phase 1 — Lag rutine, legg inn oppgaver, ansatt ser dagen (schema-delta: G-loc, G-team, G-expand, provenance-triple, executor_type). Phase 2 — Sesjonsplanlegger admin-canvas. Phase 3 — Min dag full fidelitet + Forbered-neste-vakt + versjonering. Phase 4 — Library + manual-render + evidence-capture. Phase 5 — Token-sweep (ADR-0366) + etterlevelse-trend + mobil-paritet.

---

## Status — les først

| Verdi | Betydning |
| ----- | --------- |
| `live` | Fungerer — brukbar i prod/pilot, akseptanse oppfylt |
| `in_progress` | Pågår — aktiv utvikling eller utrulling |
| `planned` | Planlagt — prioritert, ikke startet |
| `blocked` | Blokkert — avhengighet eller beslutning mangler |
| `deferred` | Utsett — bevisst parkert |

---

## Oversikt (ett blikk)

| # | UX-journey | Aktør | Status | Kommentar |
| - | ---------- | ----- | ------ | --------- |
| 1 | Min dag — dagens shift-oppgaver | Ansatt | `in_progress` | Mobil rendrer kjeden; cron-tasks mangler `day_line_id` (G3 🔴) + status-gate (G6) |
| 2 | Lokasjons-tasklist (day_line) | Manager | `in_progress` | Phase R1 — manager-løftet. Skrive-vei ✅, UI binder ikke `day_line_id` konsistent |
| 3 | Cron materialiserer fra prosedyre | System | `in_progress` | Path A ✅; spawnet task får ikke `day_line_id` → når aldri shift (G3) |
| 4 | Routine som ekte task-liste | Manager/System | `blocked` | Path B stub (G6/G7) — fyrer én flat task, ekspanderer ikke steg |
| 5 | Personlige + Emma-oppgaver | Ansatt/Botsson | `live` | `personal_task` + `emma_task` (max-3) via `fn_list_my_tasks` ✅ |
| 6 | Manager ad-hoc dag-oppgave | Manager | `live` | `schedule_day_task` dato-anker ✅ |
| 7 | Les/skriv-fundament (5 kilder, 1 RPC, 1 capability) | Alle | `live` | ADR-0298 shipped 2026-05-13 ✅ |
| 8 | **Botsson eier setup + verifisering** | Botsson | `blocked` | **Need #1.** Ingen setup-mission; G20 🔴 templates kjøres aldri ved onboarding → ny workspace tom |
| 9 | **Auto-compliance per rolle/bransje/vern** | System | `in_progress` | **Need #2.** ADR-0387a shipped, 0387b proposed (council-gated) |
| 10 | **Admin definerer + endrer egne oppgaver, alle nivåer** | Admin | `planned` | **Need #3.** S4 admin-surface; prototype `taskmanager-DESIGNE/` mock/uwired (G24) |
| 11 | Doc-drop → task/routine-ekstraksjon | Admin | `planned` | S1 — doc-drop virker, ekstraherer 0 tasks i dag (G17/G18) |
| 12 | Wizard: velg starter-routines | Admin | `blocked` | S2 — templates eksisterer, kjøres kun i dev-seed (G20 🔴) |
| 13 | Tids-vindu push-dispatch | System | `planned` | R2 — `scheduled_at`-kolonne + indeks finnes, ingen cron leser dem (G16) |

> **Tips:** Hold oversiktstabellen synkron med seksjonene under. Den er det mennesker skanner først.

---

## 1. Min dag — dagens shift-oppgaver

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **ansatt** vil jeg **åpne "Min dag" og se nøyaktig oppgavene for shiften jeg er på i dag (rett team, rett lokasjon, due i dag/forfalt)** slik at **jeg vet hva jeg skal gjøre uten å lete**. | `in_progress` | "Min dag" = alltid i dag; egen rute (L-0252, ikke tab i kalender). Mobil resolver `shift_session → shift_session_day_line → day_line → session_task` (`use-shift-session.ts:65` + `useDayLineItems`). **Gjenstår:** cron/hook-tasks får ikke `day_line_id` (G3 🔴) → usynlige for shift-visning; status-gate mangler (G6 — vis kun ved `scheduled`/`clocked_in`). Tom dag (ingen shift + ingen privat) = empty state ✅. |

---

## 2. Lokasjons-tasklist (day_line) — manager-løftet

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **manager** vil jeg **lage en oppgaveliste festet til en lokasjon, der hver oppgave har et tidsvindu, og listen kan også bære en routine** slik at **oppgavene dukker opp inne i de relevante shiftene**. | `in_progress` | Phase R1 (BLUEPRINT). `day_line` = lokasjons-anker (`location_id` + `planned_open/close`). Skrive-vei `add-day-line-item-action → task.create_session{day_line_id}` ✅. **Gjenstår:** UI passerer ikke `day_line_id` konsistent (Flow A steg 2–3); routine-attach er stub (→ journey 4). |

---

## 3. Cron materialiserer oppgaver fra prosedyre

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **systemet** vil jeg **automatisk lage session_task fra hook-koblede prosedyrer ved sesjons-livssykluspunkter** slik at **dagens drift-oppgaver finnes uten manuell innskriving**. | `in_progress` | `session-hook-executor` (cron, hvert 5. min) ekspanderer `procedure_step` → én `session_task` per steg ✅. Alle 5 session-cron live etter pg_cron-reaktivering (ADR-0388, vault-migrasjon `20260621202000`). **Gjenstår:** spawnet task har `day_line_id=NULL` → når aldri en shift via area-kjeden (G3 🔴 — core anchor-gap). |

---

## 4. Routine som ekte task-liste

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **manager** vil jeg **feste en routine til en dag/lokasjon og få dens prosedyre-steg ut som individuelle oppgaver** slik at **"en liste som bærer en routine" gir routinens steg, ikke én ugjennomsiktig oppgave**. | `blocked` | Phase R3. Path B (`session_hook.linked_routine_id`) lager én flat task med routine-UUID i description, ekspanderer IKKE steg (G6). `routine.attach_to_line` leser ikke `routine`-tabellen (G7). `control_list` har ingen per-item runtime-state (G9 → ADR). |

---

## 5. Personlige + Emma-oppgaver

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **ansatt** vil jeg **be Botsson huske noe for meg**, og som **Botsson** vil jeg **auto-planlegge påminnelser** slik at **løse to-dos og agent-nudges samles i Min dag**. | `live` | `create_personal → personal_task` (chat-only) ✅. `emma_task` max-3, cron flipper `pending→triggered` ved `due_at` ✅. Begge surfacer via `fn_list_my_tasks`, fullføres via `complete{source}`. Latent: `personal_task` mangler `completed_at` (G13). |

---

## 6. Manager ad-hoc dag-oppgave

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **manager** vil jeg **legge til en engangsoppgave for en gitt dato uten en sesjon** slik at **"dyprens i morgen" havner i Min dag for den dagen**. | `live` | `create_day_ad_hoc → schedule_day_task` (dato-anker) ✅. Latent: `task_status` er fri TEXT uten CHECK (G14); RLS krever `is_admin` mens tool gater på manager+ (G15, skjult av service_role). |

---

## 7. Les/skriv-fundament

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **enhver konsument (web, mobil, voice, agent)** vil jeg **lese alle oppgaver via ett RPC og skrive via én capability** slik at **5 ulike kilder ser ut som én oppgave-type**. | `live` | ADR-0298 shipped 2026-05-13. `fn_list_my_tasks` v2 (4-arms union, normalisert), `task` capability (6 verktøy), voice-mirror, mobil-BFF ✅. **Skjørhet:** `list_mine` TS-body duplikerer RPC for hånd (ADR-0317 lockstep, G11) — drift-fare; 4 divergente skjemaer (G12). Hardening Track H1 samler bak `v_task_unified`. |

---

## 8. Botsson eier setup + verifisering  *(Need #1)*

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **Botsson** vil jeg **via en mission guide en admin gjennom å sette opp department_session + session_hook + tasks for sin workspace, og verifisere at det faktisk fungerer** slik at **Smartout blir riktig satt opp og admin slipper å vite hvordan plumbingen virker**. | `blocked` | **Plumbing live** (alle 5 cron kjører etter ADR-0388). **Røret tomt:** G20 🔴 — bransje-templates (24 routines/18 control_lists/337 assignments) kjøres BARE i dev-seed; `finalize-workspace → bootstrap-cascade` kaller dem aldri. Derfor er ny workspace tom og status uobserverbar. Mangler: (a) setup-mission, (b) auto-apply templates ved finalize (= S2/journey 12), (c) diagnostisk surface ("fyrer hooks? lages tasks?") — `fn_cron_jobs_health()` finnes, ingen UI. Avhenger av journey 12. |

---

## 9. Auto-compliance per rolle/bransje/vern  *(Need #2)*

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **systemet** vil jeg **auto-tildele obligatoriske compliance-oppgaver basert på vern, bransje og rolle ved ansettelse, og gate readiness på dem** slik at **compliance blir et biprodukt av faktisk kompetanse (moaten), ikke logget dokumentasjon**. | `in_progress` | ADR-0387 (canonical, accepted 2026-05-21). **0387a shipped** (`campaign/daily-operation @ 0dd9528d6`): gjenoppliv `profession_training`-spine, I1 seeder rolle→protokoll, `list_mandatory_protocols_for_role`-verktøy. **0387b proposed** (council-gated): auto-assign-trigger på `profile_position` INSERT, governance.sql som SECURITY DEFINER RPC, rewire `evaluateReadinessGate → callGateAction('governance.readiness_gate')`, backfill eksisterende workspaces. Adresserer G20/G21/G22/G23/G25. "Confident ≠ Authorized" — C4 eier permission. |

---

## 10. Admin definerer + endrer egne oppgaver, alle nivåer  *(Need #3)*

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **admin** vil jeg **legge til egendefinerte oppgaver på alle nivåer (workspace/avdeling/team/lokasjon/rolle/dag/sesjon) og endre eksisterende** slik at **jeg har én samlet hjemmebase for oppgaver, bibliotek og maler**. | `planned` | Phase S4. Prototype `taskmanager-DESIGNE/` har HELE visjonen (Min dag, TaskKort 10-elementer, Bibliotek, Maler, task-drawer, manual-builder, quizmaster) men er mock/in-memory (G24). Authoring-UI for routine/runbook/control_list mangler (G10; kun `procedure` har `ProcedureBuilder.tsx`). **MOCKUP-SOURCE HARD RULE (Pontus 2026-05-20):** port fra prototype til Nordic Split + nye tokens (`taskStatus`/`taskOrigin`), IKKE redesign. Avhenger av journey 1 (R1-lese) + journey 9/11/12 (innhold). |

---

## 11. Doc-drop → task/routine-ekstraksjon

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **admin** vil jeg **slippe en SOP/manual/sjekkliste og få systemet til å ekstrahere oppgaver, routines, prosedyrer og sjekklister** slik at **jeg ikke skriver inn alt manuelt**. | `planned` | Phase S1. `analyze-setup-documents` ekstraherer 6 kategorier (policies/payroll/employees/shifts/terms/handbook) — INGEN tasks/routines (G17). Ingen persisterings-vei fra ekstrahert innhold → governance-tabeller (G18). Krever human-in-the-loop review før commit (speil prototype manual-builder confidence-per-block). |

---

## 12. Wizard: velg starter-routines

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **admin** vil jeg **under onboarding velge hvilke bransje-routines og sjekklister som aktiveres** slik at **ny workspace er ikke-tom og compliance-klar fra dag én**. | `blocked` | Phase S2. `ConfirmProcedures` plukker kun prosedyre-NAVN → bare `procedure`-rader. Fulle restaurant-templates eksisterer men kjøres KUN i dev showcase-seed (G20 🔴). Wire `bootstrap-cascade` til å applye valgt subset for live workspace. **Dette er den direkte blokkereren for journey 8 (Botsson setup).** |

---

## 13. Tids-vindu push-dispatch

| Statement | Status | Kommentar |
| --------- | ------ | --------- |
| Som **systemet** vil jeg **pushe tids-vindu-oppgaver til ansatte som er stemplet inn på riktig lokasjon nær riktig tid** slik at **oppgaver dukker opp akkurat når de skal gjøres**. | `planned` | Phase R2 (ADR-0367 Rule 4). `session_task.scheduled_at`-kolonne + indeks finnes; ingen Edge Function selekterer dem (G16). JOIN clocked-in `shift_session_day_line` → fan ut til `shift_session.push_topic`. |

---

## Åpne arkitektur-spørsmål (UAVKLART — ikke besluttet)

| # | Spørsmål | Status | Notat |
| - | -------- | ------ | ----- |
| Q1 | **4→2 kilde-konsolidering før første kunde** | `blocked` (council) | Ingen live data + første kunde foran = eneste gratis vindu å endre task-skjema. Forslag: slå sammen langs cascade-rolle — `session_task`+`schedule_day_task` → ett D6-`task` (workspace-delt RLS); `personal_task`+`emma_task` → ett C2-`agent_task` (eier-privat RLS). IKKE 4→1 (krysser RLS-grensa). Superseder premisset for ADR-0298/0300/0301/0317/0344. **Krever `/run-council` før ADR.** Hvis vedtatt: påvirker journey 7-fundament + alle gaps som nevner kilde-tabeller. |
| Q2 | Cron-helse som setup-gate | `planned` | pg_cron var stille død i prod (ADR-0388, 27 jobs registrerte 0). Fikset via vault-secrets. `fn_cron_jobs_health()` finnes — bør bli del av journey 8 verifiserings-surface + heartbeat. |

---

## Koblinger

| Type | Referanse |
| ---- | --------- |
| Spec (canonical) | [docs/superpowers/specs/2026-05-22-procedure-engine-design.md](../../superpowers/specs/2026-05-22-procedure-engine-design.md) |
| Modul-doc | [MODULE_PROCEDURE_ENGINE.md](./MODULE_PROCEDURE_ENGINE.md) |
| Fase-plan + akseptanse | [BLUEPRINT.md](./BLUEPRINT.md) |
| Verifiserte gaps (25+) | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) |
| User-flows A–F | [USER-FLOWS.md](./USER-FLOWS.md) |
| Datamodell (governance + D6) | [DATA-MODEL.md](./DATA-MODEL.md) |
| Kode-kart L1–L5 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Compliance-ADR | [docs/decisions/0387-role-mandatory-compliance-hospitality-intelligence.md](../../decisions/0387-role-mandatory-compliance-hospitality-intelligence.md) |
| Kilde-ontologi | ADR-0298 (5 kilder), ADR-0367 (day_line tri-layer), ADR-0317 (RPC↔TS lockstep) |
| UI mockup-source | [taskmanager-DESIGNE/](./taskmanager-DESIGNE/) — port til Nordic Split + tokens, ikke redesign |
| Prototype Min dag | [taskmanager-DESIGNE/components/min-dag.jsx](./taskmanager-DESIGNE/) |

---

> Levende dokument. Oppdater `updated` i frontmatter + oversiktstabellen når en journey endrer status. Fase-detalj hører hjemme i BLUEPRINT; denne roadmapen holder journey-tilstand på ett blikk. Lagt inn i `docs/INDEX.md` under task-manager.
