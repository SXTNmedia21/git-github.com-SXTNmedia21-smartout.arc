---
title: "Procedure Engine — Design Spec"
status: draft
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [spec, procedure-engine, governance, compliance, task, routine, day-line, one-truth-many-views, adr-0298, adr-0367, adr-0387]
---

# Procedure Engine — Design Spec

> **Én sannhet, flere visninger.** Prosedyren er den atomære kunnskapsenheten i Smartout. Den lagres ÉN gang og vises som dokument (Documents), opplæring (Training), oppgave (Drift), referanse (Avvik) og etterlevelse (Dashboard). Compliance blir et biprodukt av faktisk kompetanse — ikke logget dokumentasjon.

**Kort** — For admin (komponerer/autorer), ansatt (utfører/forbereder) og Botsson (forbereder/guider/vedlikeholder). "Ferdig" = admin lager rutiner med instruksjon/media + tildeler dem til lokasjon; cron materialiserer dem til dagens oppgaver; ansatt stempler inn, ser dagen sin på en tidslinje, forbereder neste vakt, og fullfører med bevis — og hele kjeden gir målbar etterlevelse mot definerte policyer.

**Modulnavn:** `procedure-engine` (omdøpt fra `task-manager`; task er bare Drift-visningen av prosedyren).

---

## 1. Den styrende modellen

```text
Policy            (prinsipp/krav — "følg HMS/IK-mat")
└── Protocol      (compliance-container mot én policy — holder ALLE datatypene)
    └── Procedure (sannheten: hvordan noe gjøres korrekt — purpose, ansvar, steg, media)
        ├── Training      (lær: manual + quiz + signering — VISNING av procedure)
        └── Routine       (gjentakende arbeidsflyt — daglig/ukentlig/hendelse)
            └── Task      (konkret handling — instans materialisert per dag)
```

**Protokollet er compliance-enheten.** Alt henger på `protocol_id`: procedure, routine, control_list, runbook, knowledge_test (quiz), confirmation (signering). Hensikten er å være compliant mot policyen protokollet tjener.

**Én sannhet, flere visninger** (verifisert i kode — alle fem ruter lever på `/dashboard/hms/*`):

| Visning | Hva den rendrer | Status i dag |
|---------|-----------------|--------------|
| Documents | procedure-hierarki (DocumentBrowser/Viewer) | ✅ implementert |
| Training | manual (procedure_step) + quiz + signering | ✅ implementert (web) |
| Drift | session_task (DriftTaskList/Timeline) | ✅ implementert |
| Avvik | deviation (Kanban/List/Drawer) | ✅ implementert |
| Dashboard | etterlevelse-KPI (OversiktDashboard) | 🟡 delvis (mangler trend) |

---

## 2. Datamodell — sannhet, beslutninger, gaps

### 2.1 Eksisterer (verifisert — gjenbrukes, bygges ikke nytt)

| Tabell | Rolle | Nøkkelfelt |
|--------|-------|-----------|
| `policy` | krav | policy_type, policy_scope (workspace/department/team/location), statement, enforcement_status |
| `protocol` | compliance-container | policy_id (**UNIQUE — 1:1**), version, status, **evidence_tier** |
| `procedure` | sannheten | protocol_id, procedure_type, skill_requirements |
| `procedure_step` | steg + **lærings-innhold** | step_order, is_required, **training_content (markdown)**, **media_urls (jsonb {type,url,caption})** |
| `routine` | gjentakelse | protocol_id, procedure_id, trigger_type, trigger_config, assigned_to_type/ref, control_list_id |
| `knowledge_test` | quiz | protocol_id, questions (jsonb), pass_threshold, max_attempts |
| `confirmation` | signering | protocol_id, confirmation_text, requires_signature |
| `control_list` / `runbook` | sjekkliste / hendelsesrespons | protocol_id, items/escalation_chain |
| `protocol_assignment` | tildeling + fremdrift | profile_id, status, **protocol_version (snapshot)**, denormaliserte tellere, next_review_at |
| `knowledge_test_attempt` / `confirmation_signature` / `procedure_step_completion` | utførelses-bevis (immutable) | score/passed, signed_at/ip, evidence (jsonb) |
| `observer_request` | four-eyes-verifisering | subject/observer, status |
| `department_session` | D6 dags-container | session_date, status, planned_open/close |
| `session_hook` | template-trigger | hook_type, trigger_offset_min, linked_procedure_id, linked_routine_id, **UNIQUE(workspace,dept,hook_type)** |
| `session_task` | **instans** (materialisert) | day_line_id, scheduled_at, assigned_to, completed_by, evidence, is_compliance_required, 7-state status |
| `day_line` | lokasjons-anker | department_session_id, **location_id**, planned_open/close, UNIQUE(dept_session, location) |
| `shift_session` | ansatt-runtime | schedule_shift_id (1:1), employee_id, location_id, **status: scheduled→clocked_in→clocked_out** |
| `shift_session_day_line` | M:N | shift kan spenne flere areal |

**Compliance-eskalering finnes:** `protocol.evidence_tier` = `quiz` → `quiz_plus_observer` → `quiz_plus_observer_plus_confirmation` → `four_eyes`. Auto-flip-triggere oppdaterer assignment-status ved step-completion / test-pass / signering.

### 2.2 Beslutninger (avgjort 2026-05-22)

1. **Manual = egen tabell med `manual_type` + polymorf kobling — IKKE duplisering av step-innhold.** To distinkte innholds-lag:
   - `procedure_step.training_content` + `media_urls` = **inline steg-innhold** ("slik gjør du steg N", utførelses-koblet).
   - **`manual` (NY tabell)** = **frittstående dokument** med `manual_type` (`routine_overview` | `procedure_intro` | `qna` | `general`, utvidbar) + nullable FK til det den beskriver (`procedure_id` / `routine_id` / `protocol_id`). `sections jsonb` (blokker: tekst/video/bilde/sjekkliste), `version`, `workspace_id`.
   - Ingen duplisering — ulik hensikt (steg-hvordan vs intro/overview/Q&A). Begge er visninger over sannheten, ikke kopier. *(Reverserer min "drop manual-tabell" — Pontus-nyanse 2026-05-22: én rutine kan ha overview-manual, en procedure kan ha intro-manual, en protocol kan ha Q&A-manual.)*
   - ManualBuilder (port `manual-builder.jsx`) autorer; ManualViewer/Guide (port) rendrer.
2. **Policy→Protocol forblir 1:1** (UNIQUE(policy_id) finnes). *(Lav-innsats default — bekreft i runde 2.)*
3. **evidence_tier gjenbrukes** som compliance-proof-modell. Ingen ny "proof"-mekanisme.
4. **Versjonering + re-bekreftelse:** ny mekanisme kreves — se 2.3. *(Snapshot-tabell vs effective-dating — bekreft i runde 2.)*
5. **routine-team = junction 0..N** (`routine_team`; null = lokasjon-bredt/pickup).
6. **procedure↔protocol = reserver M:N-junction** (`protocol_procedure`), populer 1:1 til behov. Én procedure (clean-grill) i mange protocols.
7. **Phase 1 routine-authoring = capability-tool + minimal form**; full Sesjonsplanlegger-canvas Phase 2.

### 2.3 Gaps å lukke

| Gap | Hva mangler | Fix |
|-----|-------------|-----|
| **G-loc** | `routine` har ingen `location_id`/`workspace_id` | legg til `routine.location_id` (FK location) + denormalisert `workspace_id` |
| **G-team** | `routine` team = single FK (`assigned_to_ref`), ikke 0..N | `routine_team`-junction (0..N; null = lokasjon-bredt/pickup) |
| **G-expand** | `linked_routine_id` lager ÉN stub-task, ekspanderer ikke steg (G6) | cron følger routine→procedure_id→procedure_step, materialiserer per steg |
| **G-version** | kun snapshot-ved-assignment; ingen version-history, ingen diff, ingen auto-re-confirm | `procedure_version`-snapshot + material/non-material-flagg + re-assign-trigger ved material bump + diff-render |
| **G-projection** | ingen fremtids-projeksjon (neste vakt) | RPC som projiserer routine/hook-templates på fremtidig `schedule_shift` |
| **G-manual** | `manual`-tabell (manual_type + sections + polymorf FK) finnes ikke | NY tabell — frittstående intro/overview/Q&A-dokumenter (≠ procedure_step inline-innhold) |
| **G-ui** | Sesjonsplanlegger, Prep-next-shift, Library, evidence-capture, ManualGuide/QuizGuide (prod) | se §5 |
| **G-tokens** | ~7 filer hardkoder grønn/gul/rød (ADR-0366) | map til `taskStatus.*`/`priority.*`-tokens (lagt til 2026-05-22) |

---

## 3. Scope- & assignment-modell

| Nivå | Scope | Mekanisme |
|------|-------|-----------|
| **Rutine** | lokasjon (1) + team (0..N) | `routine.location_id` + `routine_team`-junction. team null = lokasjon-bredt/pickup |
| **Task** | arver rutinens scope + valgfritt **rolle-filter** | rolle via `routine_assigned_to_type='role'` på task-nivå / session_task rolle-scope |
| **Assign** | hele rutiner ELLER enkle tasks | begge plasseres på tidslinja |

"Hvem gjør den" på instans: `session_task.assigned_to` (tildelt) eller NULL (pickup for alle på lokasjon/team). Konsistent med ADR-0387 rolle-compliance.

---

## 4. Ansatt-flyt — i dag vs forbered

| Visning | Datakilde | Handling |
|---------|-----------|----------|
| **Min dag** (i dag) | ekte `session_task` via day_line-kjede (materialisert) | fullfør + evidence + signering. Tidslinje med start/due |
| **Forbered neste vakt** (fremtid) | **projeksjon** av routine/hook-template på planlagt `schedule_shift` | les instruksjon/video · ta quiz · bekreft "forstått". Read-only til `clocked_in` |

**Prep-status (låst):** `MÅ FORBEREDES` (rød, obligatorisk, blokkerer readiness) · `FERDIG` (grønn, re-lesbar) · `VALGFRITT` (nøytral) · **`OPPDATERT — BEKREFT PÅ NYTT`** (lilla, ny versjon). Toppbanner teller "X må forberedes". Tom dag (ingen shift + ingen task) = empty state.

**Versjonering (låst):** admin publiserer ny versjon → markerer **material** (re-bekreft) vs **non-material** (skrivefeil, ingen re-bekreft) → material bump gjør forrige `confirmation_signature`/ack stale → ansatt ser **diff** ("nytt steg X") + bekrefter ny versjon. Speiler amendment-classifier (lovsen-domenet).

---

## 5. UI-flater — status & plan

### Implementert (✅) — gjenbrukes
5 lens-visninger (`/dashboard/hms/{documents,training,drift,deviations}` + Oversikt) · mobil task-execution (TaskModal/HACCPForm/ChecklistView/DeviationForm) · web quiz-guide (KnowledgeTestView) · web signering (ConfirmationSign) · web governance-editorer (Policy/Protocol/Procedure/KnowledgeTest-Form) · WebDayControl + DayTimelineStrip + DayLineCreateSheet · capabilities task/day-line/routine/timeline-template.

### Gap (🔴) — bygges
| Surface | Design-kilde | Avhenger av |
|---------|--------------|-------------|
| **Sesjonsplanlegger** (tidslinje-per-lokasjon, dra-fra-bibliotek, gjentakelse) | NY design (Nordic Split) | routine.location_id + team-junction |
| **Min dag tidslinje** (full prototype-fidelitet: day-meter, origin-badge, 3 seksjoner, filter-chips) | port `min-dag.jsx` | day_line_id på cron-tasks (G3/G-expand) |
| **Forbered neste vakt** | NY design | G-projection + G-version |
| **Library** (manual = procedure-render) | port `library.jsx` + `manual-viewer.jsx` | — (procedure_step finnes) |
| **Routine/control_list-editor** | NY (governance-form-mønster) | — |
| **evidence-capture** (generell foto/signatur på session_task) | port task-drawer evidence | — |

### Design-prinsipp
North-star = `taskmanager-DESIGNE/`-prototypen (porteres til Nordic Split + nye tokens `taskStatus`/`taskOrigin`, lagt til 2026-05-22). HEX → OKLCH-token ved port. Sesjonsplanlegger + Prep er ny design (prototypen dekker dem ikke).

### Sesjonsplanlegger — låst interaksjon
- Canvas **A**: tidslinje per lokasjon + "gjelder dager"-chip (samme metafor som ansattens Min dag). Flere views (uke-grid/tabell) senere via view-switcher.
- Dra rutine/task fra bibliotek-rail → drop på tidspunkt. Start = drop-posisjon, due = dra håndtak.
- Rutine = ÉN ekspanderbar boks ("5 steg"), klikk for steg. Cron ekspanderer til N tasks (fikser G-expand).
- Klikk boks → detalj-panel: tidsvindu · hvem (rolle/team/pickup) · gjelder dager · obligatorisk-flagg · krev bevis · koblet procedure/media.

---

## 6. Faseplan

### Phase 1 — "Lag en rutine, legg inn oppgaver, ansatt ser dagen" (dagens må-haves)

Falsifiserbar akseptanse per deliverable:

1. **Ansatt stempler inn + ser sin dag.**
   - `shift_session.status` → `clocked_in` via clock-in-action; Min dag-surface (mobil) henter session_task via day_line-kjede, viser tidslinje med start/due.
   - *Akseptanse:* ansatt med publisert shift kan stemple inn; ser kun sine/pickup-tasks for i dag på den lokasjonen; tom når ingen.
2. **Admin skaper ny rutine.**
   - Routine-authoring-UI (eller capability-tool) som skriver `routine` (+ procedure_id, trigger_config).
   - *Akseptanse:* admin lager "Stenge-rutine" knyttet til en procedure med steg; raden finnes; vises i bibliotek.
3. **Admin tildeler rutine til lokasjon.**
   - 🔴 schema: `routine.location_id` + `routine_team` (0..N). Wiring til session_hook så cron materialiserer på den lokasjonen.
   - *Akseptanse:* rutine tildelt Lokale 1 → cron lager session_task med `day_line_id` for Lokale 1 den dagen; ikke på andre lokasjoner.
4. **Definer lokasjon på et shift.**
   - `schedule_shift.location_id` finnes — UI-knapp for å sette/endre.
   - *Akseptanse:* manager setter lokasjon på en shift; `shift_session.location_id` følger; Min dag filtrerer korrekt.
5. **Notifikasjon: forsinket + ny tildelt oppgave.**
   - Overdue-deteksjon (session_task status → overdue via watchdog) + assignment-notif via notification-engine; emit ved ny `assigned_to`.
   - *Akseptanse:* task forbi due → ansatt + manager varsles; ny tildelt task → ansatt varsles (push/in-app).

**Phase 1 schema-delta:** `routine.location_id`, `routine.workspace_id` (denorm), `routine_team`-junction, cron routine→step-ekspansjon (G-expand), **provenance-triple på session_task** (`origin`, `generated_by`, `source_reference`), **`routine.executor_type`** enum (`human`|`ai`|`system`|`hybrid`, default `human`). Alt annet i Phase 1 bruker eksisterende tabeller.

> **Provenance-triple (BAKE NÅ — Pontus 2026-05-22):** ingen task skal eksistere uten `origin` (session/adhoc/routine/projection), `generated_by` (cron/manager/agent/system) og `source_reference` (hook_id/routine_id/template_id). Cheap nå, brutal debugging senere. Matcher `provenance jsonb`-mønsteret på governance-tabeller + activity_trail.
> **executor_type (BAKE NÅ):** routine bærer hvem som utfører — `human`/`ai`/`system`/`hybrid`. Samme modell, ulik executor. Kobler C4-authority (engine_authority_config). Default `human`; AI/system-routines aktiveres når Botsson-autonomi modnes.

### Phase 2 — Sesjonsplanlegger admin-canvas (tidslinje, dra-fra-bibliotek, block-config) + **Botsson bilde→rutine**

**Botsson bilde→rutine (multimodal onboarding):** Botsson mottar et bilde (f.eks. A4 med åpnings-oppgaver) → vision-ekstraksjon → søk `location` (f.eks. "restaurant"); mangler → foreslå skape → kall `routine.create` ("Åpningsrutine") → `routine.assign_to_location` → `procedure.add_step` per task funnet på arket. Bygger på Phase 1-verktøyene (samme tools), utvider `analyze-setup-documents` (G17/G18) til tasks/routines. Bilde-skapte tasks bærer `generated_by='agent'` + `source_reference` (provenance-triple fra Phase 1). Human-in-the-loop review før commit.
### Phase 3 — Min dag full fidelitet + Forbered-neste-vakt (projeksjon) + versjonering/re-bekreftelse (diff + material-flagg)
### Phase 4 — Library + manual-render (procedure-visning) + evidence-capture generell
### Phase 5 — Token-sweep (ADR-0366) + Dashboard etterlevelse-trend + mobil-paritet (quiz/signering)

> Phase 1 er uavhengig av 4→2 task-konsolideringen (council pending): Phase 1 autorer maler (routine/procedure) + leser instanser via eksisterende `fn_list_my_tasks`. Konsolideringen treffer instans-lese-siden senere.

---

## 7. Invarianter

1. Procedure er sannheten; manual/quiz/task/signering er visninger over samme procedure. Ingen duplisering.
2. Mal (procedure/routine) vs instans (session_task) holdes adskilt; cron materialiserer mal→instans.
3. Protokollet er compliance-containeren; alt henger på `protocol_id`.
4. evidence_tier styrer hvor mye bevis som kreves; readiness = mandatory-protokoller fullført (ADR-0387, "confident ≠ authorized").
5. Material versjons-endring → re-bekreftelse; non-material → ingen.
6. Mobil = utfør/forbered (ADR-0133); web = autor/komponer.
7. Alle mutasjoner emitter telemetri + gates via gate_action (ADR-0204/0287).

---

## 7b. Reserverte sømmer & fremtidig retning (Pontus-review 2026-05-22)

Innsikter som ikke bygges nå, men hvis SØM reserveres så de ikke blir brutale å legge til senere. Disiplin: bygg fra operativ virkelighet, ikke enterprise-diagrammer. Ikke bli en generisk workflow-motor — Smartout HAR en (Event Engine).

| Innsikt | Status | Søm / grense |
|---------|--------|--------------|
| **Procedure i flere protocols** | 🔧 reserver | `protocol_procedure`-junction (M:N). Én procedure (clean-grill) refereres av HACCP+HMS+Brann+Opening. Ren utvidelse av "én sannhet". Populer 1:1 til behov. Migrer FØR data vokser. |
| **Operational Digital Twin** | 🎯 framing | DayLine + ShiftSession + routine-materialisering = runtime-speil av arbeidsplassen. Den mentale modellen for hele engine. |
| **Kompetanse-decay** | 🔧 reserver | `next_review_at` finnes. Legg `validity_duration` + retraining-interval på protocol/procedure. Phase 3 versjonering utvider. Kompetanse er ferskvare. |
| **risk_classification** | 🔧 reserver | På procedure/task — styrer mandatory-before-shift + evidence_tier-eskalering. Load-bearing for prep-prioritering. |
| **cognitive_load / stress_sensitivity / expected_duration** | ⏸ utsett | `estimated_minutes` finnes. Resten trenger data/forskning før modellering. Prep = proaktiv operasjonell readiness, ikke bare "les før jobb". |
| **Policy → AI-governance** | ⛔ finnes (C4) | `engine_authority_config` + `gate_action` = allowed actions/confidence/autonomous limits ("confident ≠ authorized"). Policy kan KOMPILERE til authority-config senere — ikke duplisere. |
| **procedure_step ≠ workflow node** | ⛔ HARD GRENSE | Branching/escalation/parallel/conditions bor i **Event Engine** (engine_process→engine_state), IKKE i procedure_step. Routine som trenger orkestrering emitter til engine_process. Cascade produserer, Event Engine konsumerer (CLAUDE.md). |

**Den arkitektoniske grensa:** Procedure-engine = operativt innhold + compliance (definer + materialiser + bevis). Event Engine = orkestrering (branching, escalation, parallell). Blur dette → dupliserer du workflow-runtime i innholds-laget.

## 8. Åpne beslutninger

**Avgjort 2026-05-22 (wizard):** manual = egen tabell m/ manual_type (#1) · routine-team junction (#5) · procedure↔protocol M:N reservert (#6) · Phase 1 = capability + minimal form (#7).

**Gjenstår (runde 2 — lav-innsats):**
1. **Policy→Protocol 1:1** — behold UNIQUE (default), eller dropp for 1:N? *(Anbefaler behold; flere områder = flere policyer.)*
2. **Versjon-history for diff/re-bekreftelse:** ny `procedure_version`/`manual_version`-snapshot-tabell vs utvide effective-dating (valid_from/to)? *(Snapshot kreves for ekte diff "nytt steg X". Phase 3 — kan avgjøres da.)*
