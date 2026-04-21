---
title: "Journey Runner Suite — Mental Model"
status: ready_for_council_review
version: 1.6.0
updated: 2026-04-21
created: 2026-04-21
module: testing
tags: [journey, mental-model, runner, botsson, onboarding, docs]
---

# Journey Runner Suite — Mental Model

**Les dette først. Hvis noe annet sier noe annet, har dette dokumentet forrang til det er eksplisitt revidert.**

---

## Kjernesetningen

> Én journey-definisjon → tre journeys som bruker den → fem artefakter som kompileres fra den.

Det er alt. Resten av dokumentet utdyper denne setningen.

---

## De tre journeys (de viktigste — dette må alltid være klart)

### Journey 1 — **Dev: Test-kjøring med fjernkontroll**

**Når:** Utvikler har nettopp kjørt `/close-feature`. Nye journeys ligger klare i portalen.

**Hvor:** Platform Admin → Journeys.

**Flyten:**
1. Dropdown: velg **Feature** (eller filter: "Not Run").
2. Velg én journey fra listen.
3. Trykk **Initialize E2E**.
4. Vi genererer E2E-scriptet fra journey-spec.
5. **Synlig browser** åpnes på utviklerens maskin.
6. Fjernkontroll i Platform Admin:
   - **Hastighet** (slider: sakte / normal / rask)
   - **Record video** (av/på)
   - **Screenshots** (av/på)
   - **Mode:** Auto (kjører selv) eller Manuell (Next-knapp per steg)
   - **Vis musepeker** (av/på)
   - **Live-logg:** events, telemetry, DB-writes, service-responses — alt som triggeres ved hvert klikk

**Hensikt:** Verifisere at funksjonen gjør det den skal, samtidig som vi dokumenterer med video/bilder.

### Journey 2 — **Docs & Mission: Publiser journey som onboarding-innhold**

**Når:** En journey er `verified` i portalen.

**Hvor:** Platform Admin → Journeys → valgt journey.

**Flyten:**
1. Velg verifisert journey.
2. Klikk **Publish to Docs** → journey blir onboarding-guide på docs-siden (med skjermbilder fra Journey 1).
3. Klikk **Activate Mission** → journey blir AI-mission som agenten kan kjøre.
4. Admin tildeler mission til en ny ansatt. Agenten har brukermanualen klar.

**Hensikt:** Gjenbruke journey-en som pedagogisk innhold — både skriftlig (docs) og interaktivt (agent-mission).

### Journey 3 — **Runtime: Agenten guider ekte bruker**

**Når:** Ny bruker spør agenten "hva kan jeg gjøre?" eller admin trigger en mission.

**Hvor:** Mobilappen (eller web der det er relevant).

**Flyten:**
1. Agenten leter i journey-biblioteket: `status = verified AND published = true`.
2. Tilbyr: "Skal jeg lære deg å stemple inn?"
3. Guider gjennom stegene i ekte UI — highlighter knapper, venter på klikk, bekrefter progresjon.
4. Journey-completion registreres (gamification, readiness, audit).

**Hensikt:** Samme journey-definisjon som ble testet i Journey 1 og publisert i Journey 2, kjøres nå av en ekte bruker med agent som navigatør.

---

## Én kilde, én IR, fem kompilerte artefakter

Journey-definisjonen lever som **markdown i git** (deep spec — 10 dimensjoner). Compile er ikke ett steg — det er **to steg** med en tydelig mellomliggende kontrakt:

```
markdown (menneske-redigert)
      │
      ▼  parser + validator (ett sted, én sannhet)
      │
[ JourneyIR ]  ← deterministisk, versjonert, sjema-validert
      │
      ├──▶ 1. Playwright-script
      ├──▶ 2. E2E-test-spec
      ├──▶ 3. USER-GUIDE.md + media
      ├──▶ 4. Mission-prompt + navigasjonsplan
      └──▶ 5. Inference-pattern (events + rekkefølge)
```

**Hvorfor IR (Intermediate Representation):**

- Én parser validerer markdown mot Zod-schema. Alle feil fanges der — ikke spredt ut i fem emittere.
- Fem emittere kan antatt gyldig input. De blir små og rene funksjoner (IR → artefakt).
- IR kan serialiseres (JSON) — vi kan diffe to versjoner av samme journey og se *nøyaktig* hva som endret seg.
- Tester kan snapshot-teste IR uten å kjøre hele compile-kjeden.

**Compile-trigger:** Kjøres ved merge til `development`. Resultatet: IR lagres i DB + de fem artefaktene skrives til respektive destinasjoner (kode-repo for Playwright-script, `docs/guides/` for USER-GUIDE, `mission`-tabell for mission, `engine_trigger` med `trigger_subtype='journey_inference'` for inference — se egen seksjon).

**Markdown er sannheten. IR er kontrakten. Artefaktene er avledede.**

| # | Artefakt | Bruk |
|---|---|---|
| 1 | **Playwright-script** | Journey 1 kjører dette |
| 2 | **E2E-test-spec** | Smoke-test i CI |
| 3 | **USER-GUIDE.md + media** | Journey 2 publiserer dette til docs |
| 4 | **Mission-prompt + navigasjonsplan** | Journey 3 kjører dette |
| 5 | **Inference-pattern** (events + rekkefølge) | Runtime: detekter completion + stuck |

## Formatkontrakter per artefakt

Hver emitter har en eksplisitt output-kontrakt som er testbar uavhengig:

| # | Kontrakt | Form |
|---|---|---|
| 1 | Playwright-script | `.spec.ts` som importerer en delt helper, definerer én `test.describe` per journey, ett `test.step` per steg. Testids refereres via konstant-lookup (ikke hardkodet). Typecheck + lint skal passere. |
| 2 | E2E-test-spec | Samme `.spec.ts` kjørt i CI-mode (headless, ingen video, kort timeout per steg). Ingen separat fil — samme artefakt, ulik kjøre-kontekst. |
| 3 | USER-GUIDE | MDX-fil i `docs/guides/{slug}.mdx` med YAML-frontmatter + skjermbilde-refs til canonical run. Validert mot MDX-schema. |
| 4 | Mission | Rad i `mission`-tabell (JSONB `plan`-kolonne) med steg-liste, highlight-targets (testid), forventet event per steg, og dialog-prompt. |
| 5 | Inference-pattern | Rad i `engine_trigger` med `trigger_subtype='journey_inference'` + `journey_version_id` FK. JSONB `condition` bærer event-sekvens, rekkefølge-flagg, entitets-kriterier, terskler for stuck. |

En artefakt som ikke møter sin kontrakt er en compile-feil — merge blokkeres.

---

## Versjons-bundet publisering

**Kritisk regel:** `verified` og `published` refererer aldri til en journey ved navn alene. De er alltid knyttet til en konkret **journey_version**.

### Modell

```
journey                  (1) ───── (N) journey_version        (1) ── (N) journey_artifact
  slug                                    version_id                     artifact_type (1–5)
  title                                   content_hash                   content_ref
  module                                  source_commit_sha
                                          ir_json (snapshot)
                                          status enum:
                                            draft | ready_test | verified | published | superseded
                                          verified_at / verified_by
                                          published_at / published_by
```

- **`journey`** — navnet (stable identifier).
- **`journey_version`** — en frozen compile-output. `content_hash` av IR gjør at to identiske compiles deler versjon; en endring lager ny versjon.
- **`journey_artifact`** — de fem artefaktene per versjon. Immutable.

### Regler

1. En ny merge som endrer markdown → compile → hvis IR-hash er ny, opprett ny `journey_version` med `status = draft`.
2. Journey 1 (test) kjøres mot en spesifikk `version_id`. Passerer den, kan versjonen flippes til `verified`.
3. Journey 2 (publish) flipper status `verified → published` på samme `version_id`. Tidligere `published`-versjon blir `superseded` (ikke slettet).
4. Journey 3 (runtime agent) leser *alltid* den versjonen som har `status = published` for en gitt slug. Aldri navnet alene.
5. Inference-pattern + mission kjører mot versjonen som var `published` da brukeren startet journey-en — ikke den nye som akkurat ble publisert midt-i-flyten.

### Konsekvenser

- Rollback er trivielt: sett tidligere versjon tilbake til `published`.
- Audit: vi kan alltid si *hvilken versjon* en ansatt fullførte, selv om journey-en er endret siden.
- Docs er alltid konsistente med mission og runtime — alle tre leser samme `version_id`.
- Completion-detektoren kan ikke feilaktig gi completion for en ny versjon basert på events logget mot gammel versjon — fordi `engine_trigger`-raden (`trigger_subtype='journey_inference'`) er bundet til `journey_version_id`.

## Hvem leser hva

| Konsument | Leser | Skriver |
|---|---|---|
| **Utvikler (Journey 1)** | Playwright-script (#1) | Ingenting — bare observerer |
| **CI** | E2E-test-spec (#2) | Pass/fail-rapport |
| **Docs-side** | USER-GUIDE + media (#3) | Statisk HTML |
| **Botsson (Journey 3)** | Mission-prompt + plan (#4) | `journey_event` (completion) |
| **Stuck-detector / admin-highlighter** | Inference-pattern (#5) | `guardian_signal` |

Ingen av disse skriver tilbake til markdown. Alle endringer i journey-definisjonen går gjennom PR + merge + compile.

---

## Hva som EKSISTERER i dag (verifisert 2026-04-21)

Basert på parallell research av tre agenter (se samtalelogg):

| Komponent | Status | Detalj |
|---|---|---|
| E2E-runner (Smoke) | ✅ VIRKER | Portal-knapp → `/api/platform-admin/e2e/run` → spawn Playwright → SSE-stream |
| Playwright-config | ✅ VIRKER | `apps/e2e/playwright.config.ts` med custom SSE-reporter |
| Telemetry-registry | ✅ RIK | `packages/telemetry/src/registry.ts` — events har actor_id, workspace_id, correlation_id, destinations |
| `compile.ts` | ⚠️ DELVIS | Produserer 3 artefakter (engine_process, engine_step, engine_trigger) — ikke de 5 vi trenger |
| DB-schema for journey_step | ⚠️ DELVIS | 11 kolonner, dekker 3 av 10 deep-spec-dimensjoner |
| 12 markdown-journeys | ⚠️ STATISK | `apps/mobile/store-listing/journeys/*/` — hånd­skrevet, ingen kode leser dem |
| `journey_event`-tabellen | ⚠️ FEIL SEMANTIKK | Logger status-endringer, IKKE steg-completion |
| `journey-stuck-detector` Edge Function | ⚠️ HARDKODET | Kun Journey 03, hardkodet step 2 og 24h-terskel |
| `guardian_signal`-tabellen + trigger | ✅ FOUNDATION | Skriver push ved `domain='journey_health'` |
| Playwright MCP | ❌ FINNES IKKE | `.mcp.json` har bare strike-mcp. Playwright kjører som child_process, ikke MCP |
| Botsson UI-guidance (highlighter, klikk-vent) | ❌ FINNES IKKE | Ingen overlay-komponent i mobil eller web |
| Fjernkontroll i Platform Admin | ❌ FINNES IKKE | Bare "Kör smoke" / "Kör alle" i dag |
| Synlig browser i dev med speed-slider | ❌ FINNES IKKE | Dagens runner kjører headless i child_process |
| Proaktiv "agenten foreslår journey" | ❌ FINNES IKKE | Ingen workspace-state-detektor |
| Inference-regel-lagring | ✅ FOUNDATION | `engine_trigger.condition` JSONB finnes. Mangler: `trigger_subtype`-kolonne + `journey_version_id` FK + subtype-aware dispatcher-branch. Ingen ny `journey_pattern`-tabell. |
| Markdown → Playwright-generator | ❌ FINNES IKKE | |
| Markdown → mission-prompt-generator | ❌ FINNES IKKE | |
| Markdown → USER-GUIDE-generator | ❌ FINNES IKKE | USER-GUIDE.md er hånd­skrevet |

---

## Relasjon til ADR-0074 Protocol Verification Engine

**Vedtak: UNIFY.** Ikke supersede, ikke coexist.

### Hvorfor

ADR-0074 Protocol Verification Engine er ikke død infrastruktur — den er en fungerende markdown→IR→emittere-pipeline med samme formål som Journey Runner Suite: deklarativ spec kompileres til kjørbare artefakter. Parallelle pipelines med ulike IR-er drifter alltid fra hverandre innen 3 måneder. Coexist er ikke et valg, det er en utsettelse av problemet.

### Hva som eksisterer i ADR-0074 (som vi unifier med)

| Fil | Rolle |
|---|---|
| `apps/e2e/protocols/schema.ts` | Zod-validert declarative-spec-schema (`ProtocolDefinition`) |
| `apps/e2e/generators/mission-generator.ts` | Genererer agent-mission fra `ProtocolDefinition` |
| `apps/e2e/generators/docs-generator.ts` | Genererer docs-innhold fra `ProtocolDefinition` |
| `apps/e2e/generators/audit-generator.ts` | Genererer audit-rapport fra `ProtocolDefinition` |

### Unification-kontrakt

1. **JourneyIR erstatter `ProtocolDefinition`.** Én kanonisk IR for hele systemet. Zod-schema flyttes til `packages/ai/src/journey/ir.ts` og importeres av både `apps/e2e/`-generatorer og nye emittere.
2. **Eksisterende generatorer retargetes** til JourneyIR-input. Deres interne logikk bevares, men input-typen byttes fra `ProtocolDefinition` → `JourneyIR`.
3. **Én pipeline, to doc-entrypoints.** Markdown-spec → parser → JourneyIR → 5 emittere (Playwright-script, E2E-test-spec, USER-GUIDE, Mission-prompt, Inference-pattern). `ProtocolDefinition` som type slettes etter migrasjon.
4. **Ingen ny `apps/e2e/protocols/schema.ts`.** Filen beholdes midlertidig som re-export fra `packages/ai/src/journey/ir.ts` under migrasjon, deretter fjernes.
5. **Generator-entrypoints samlokaliseres.** Enten flyttes `apps/e2e/generators/*` til `packages/ai/src/journey/emitters/`, eller emittere i `packages/ai/` importerer fra `apps/e2e/generators/`. Valget bestemmes i ADR-0074-unify-ADR-en — default: flytt til `packages/ai/` for cross-app-gjenbruk.

### Migrasjonsrekkefølge

1. Definer JourneyIR i `packages/ai/src/journey/ir.ts` som superset av `ProtocolDefinition` (additive felt).
2. Re-export `ProtocolDefinition = JourneyIR` midlertidig fra `apps/e2e/protocols/schema.ts` for bakoverkompatibilitet.
3. Retarget `mission-generator.ts`, `docs-generator.ts`, `audit-generator.ts` til å lese fra JourneyIR.
4. Bygg nye emittere (`playwright-script`, `user-guide`, `inference-pattern`) i samme generator-mappe.
5. Slett `ProtocolDefinition`-type og re-export.
6. Slett `apps/e2e/protocols/schema.ts` når ingen referanser gjenstår.

### Konsekvenser

- **Eksisterende `apps/e2e/generators/*.ts` bevares som kode** — bare input-type endres. Det vi har bygget forsvinner ikke.
- **`audit-generator.ts` blir ikke "netto ny kode".** Den er en eksisterende emitter som retargetes.
- **Item #6 (mission-compiler) og item #7 (USER-GUIDE-generator) i build-listen er ikke net-new** — de er henholdsvis retarget av `mission-generator.ts` og ny emitter som deler IR med `docs-generator.ts`.
- **Én markdown-path i repo.** `docs/journeys/JOURNEY-*.md` blir kanonisk — ikke `apps/mobile/store-listing/journeys/` (som er en annen scope).

### ADR-krav

Dedikert ADR "**Journey Runner / ADR-0074 Unification**" må skrives før spec v1.6.0 merges. ADR-en definerer:
- JourneyIR som kanonisk type (supersedes `ProtocolDefinition`).
- Migrasjonsrekkefølge (punkt 1–6 over).
- Flytt-beslutning for `apps/e2e/generators/*` (packages/ai/ vs apps/e2e/).
- Hva som skjer med eksisterende `ProtocolDefinition`-callsites.

---

## Inference-pattern = `engine_trigger` (ikke egen tabell)

**Vedtak: Ingen ny `journey_pattern`-tabell.** Inference-regler lagres som utvidelser av eksisterende `engine_trigger`-rader.

### Hvorfor

`engine_trigger.condition` (JSONB) lagrer allerede per-process match-regler og brukes av Event Engine til å avansere `engine_state`. En parallell `journey_pattern`-tabell ville skape split-brain: `engine_trigger` advarer state, `journey_pattern` sier "completed?" — de kan være uenige. Én tabell, én sannhet.

### Kontrakt

1. **Nye kolonner på `engine_trigger`** (via migrasjon):
   - `trigger_subtype` enum: `state_advance` (default, dagens semantikk) | `journey_inference` (ny — brukes av completion-detektor, stuck-detektor, admin-highlighter)
   - `journey_version_id` FK (nullable — kun satt for `journey_inference`-rader)
2. **`condition` JSONB beholder sitt eksisterende schema**, men for `journey_inference`-rader valideres det mot `journey_pattern_rule_schema` (Zod — event-sekvens, rekkefølge-flagg, entitets-kriterier, terskler).
3. **Én matcher-motor.** Event Engine evaluerer `condition` for begge subtyper — forskjellen ligger i *handling*:
   - `state_advance` → dispatch via `engine_dispatch` (som i dag).
   - `journey_inference` → emit telemetri (`journey.completed`, `journey.stuck`, `journey.step_reached`) + evt. `guardian_signal` for Botsson.
4. **Begge subtyper er versjonsbundet** via `engine_trigger → engine_process → journey_version_id` (eksplisitt FK for `journey_inference`).
5. **Compile-pipeline emitterer begge subtyper** fra samme JourneyIR. State-advance-reglene er implisitt i step-definisjonen; inference-reglene kommer fra deep-spec-dimensjonen "Events + expected sequence".

### Konsekvenser for modell og build-liste

- **Artefakt #5 "Inference-pattern"** er fortsatt én av de fem artefaktene, men lagringsdestinasjonen er `engine_trigger` (subtype=`journey_inference`) — ikke ny tabell.
- **Build item #8** omdefineres: ikke "ny `journey_pattern`-tabell + matcher", men "utvidelse av `engine_trigger` (nye kolonner + subtype-enum) + subtype-aware dispatcher-branch i Event Engine".
- **`journey-stuck-detector` Edge Function** erstattes ikke av en ny matcher — den blir en konsument som queryer `engine_trigger` med `trigger_subtype='journey_inference'`. Samme for admin-highlighter og agent-proaktivitet.
- **L-0023-brudd unngås fullstendig.** Det finnes ingen `journey_pattern`-tabell som kunne mutere state.
- **Språklig:** "pattern-regel" / "Inference-pattern" er konseptuelle begreper for artefaktet. Tabell-lagring skjer i `engine_trigger`.

### Migrasjonskrav

Samme migrasjon som legger til `trigger_subtype`-enum og `journey_version_id` FK må også:
- Default-sette `trigger_subtype = 'state_advance'` på alle eksisterende rader.
- Ikke forcere backfill av `journey_version_id` (null OK for `state_advance`).
- CHECK constraint: `trigger_subtype = 'journey_inference' ⇒ journey_version_id IS NOT NULL`.

### ADR-krav

Unification-ADR-en fra forrige seksjon inkluderer dette vedtaket. Alternativt, hvis man vil splitte: egen ADR "**Inference-Pattern Storage: `engine_trigger` Extension, Not New Table**" med samme kontrakt.

---

## Hva vi MÅ bygge (netto ny kode)

Minimumslisten for å realisere de tre journeys:

1. **Deep-spec-schema for journey_step** — nye kolonner (eller ny `journey_step_dimension` tabell) som bærer testId, ui_elements, screen_states, events, expects. Migration med korrekt timestamp (>= dagens repo-tip).
2. **Full compile-pipeline** — `packages/ai/src/journey/compile.ts` utvides. Input: markdown deep spec. Output: 5 artefakter.
3. **Playwright-script-generator** — fra deep spec → runnable `.spec.ts` fil.
4. **Remote control-UI + backend** — Platform Admin får fjernkontroll. Backend starter Playwright i **headed mode** med CDP-session som kan styres eksternt. **Dette er arkitektur-rewrite, ikke extension** — dagens runner er `child_process` + SSE (one-way). Manuell Next-per-step er arkitektonisk umulig på Playwright test-runner. Krever Node-resident driver + CDP session + WS bridge. **Splittes ut til egen sub-spec:** `docs/superpowers/specs/2026-04-XX-journey-runner-cdp-infrastructure.md` (se egen seksjon nedenfor). Denne mental-modellen definerer *hva* fjernkontrollen gjør (state-maskin, kommandoer, events); sub-spec-en definerer *hvordan* den bygges (CDP, WSL display, authn, concurrent-session isolation).
5. **Recording + screenshot-pipeline** — lokal disk default, Supabase Storage for "canonical" runs.
6. **Mission-compiler** — fra deep spec → agent-mission-definisjon + navigasjonsplan.
7. **USER-GUIDE-generator** — fra deep spec + canonical media → `docs/guides/{slug}.md` + MDX-side.
8. **`engine_trigger`-utvidelse for inference** — ny `trigger_subtype`-enum (`state_advance | journey_inference`), ny `journey_version_id` FK, CHECK constraint, subtype-aware dispatcher-branch i Event Engine. Erstatter hardkoded stuck-detector. Samme tabell, samme matcher-motor, ulik handling per subtype. **Ingen ny `journey_pattern`-tabell.**
9. **Completion-detektor (lese-only mot runtime-state)** — detekterer at en ekte bruker har fullført en journey ved å **lese `engine_state.current_step` + `engine_state_step.completed_at`** (autoritativ runtime-state, allerede brukt av `journey-stuck-detector`). Detektoren skriver **ikke** til `journey_event` — `journey_event`-enumen er rent dev-tracking per L-0023 og må aldri huse runtime-state. Ved completion emitter detektoren telemetri-event (`journey.completed`) og dispatcher via `engine_dispatch` for downstream-konsumenter (gamification, readiness, audit). Enum-utvidelser `step_completed` / `journey_completed` på `journey_event` er **eksplisitt fjernet** fra scope.
10. **Botsson UI-guidance-komponent** — overlay i mobilapp som highlighter knapper og venter på klikk. Leser fra mission-navigasjonsplan.
11. **Publish-knapper i Platform Admin** — "Publish to Docs" + "Activate Mission". Idempotent, versjonert.
12. **Agent-proaktivitet** — agent queryer `engine_trigger` med `trigger_subtype='journey_inference'` + workspace-state → tilbyr journeys.

---

## Database-regler (må respekteres)

Fra `smartout-database-guide`:

- Nye tabeller: `workspace_id`, `created_at`, `updated_at`, UUID PK, RLS både JWT + API-key.
- Migrasjons-timestamp MÅ være strengt større enn repo-tip. Kjør `ls supabase/migrations/ | tail -1` før timestamp velges.
- Enum: sjekk `database.types.ts` før nytt enum lages.
- Aldri hardkode regulatoriske rater.
- `workspace_id` kan være null bare hvis det er eksplisitt dokumentert platform-nivå (som `tariff_rate_table`).
- D6-tabeller tilhører `campaign/daily-operation`-worktreen. Journey-runner-pipeline er **crossdomain** (telemetry, engine, agent, journey-portal) — den tilhører et eget worktree.

---

## Edge Function-regler (må respekteres)

Fra `smartout-edge-function-guide`:

- Ny Edge Function for Playwright-kontroll krever `config.toml`-registrering.
- Ikke skriv egen auth — bruk `_shared/auth-middleware.ts`.
- Scope-guard før DB-queries.
- Cron-funksjoner (som oppdatert stuck-detector) bruker `WATCHDOG_CRON_SECRET`-mønsteret.

---

## Skillet mellom failure og success — disiplin, ikke verktøy

Alt i dette dokumentet — IR, kontrakter, CI-gater, versjonsbinding — er nødvendig, men **ikke tilstrekkelig**. Forskjellen mellom suksess og havari ligger i ett spørsmål:

> **Starter hver endring i spesifikasjonen, eller tar vi snarveier når det haster?**

### Dette er failure

Failure skjer ikke på dag 1. Det skjer på dag 90, når noen trenger en rask endring før en demo:

- En utvikler legger til en testid i koden uten å oppdatere journey-markdown → Playwright-script er utdatert neste compile, men CI passerer fordi golden-file-snapshot ble "midlertidig" oppdatert.
- En admin redigerer en mission-prompt direkte i DB fordi "det går raskere" → docs og runtime divergerer. Ingen spor av hvem som endret hva.
- En bug-fix i runtime-agenten hardkoder en workaround for Journey 03 → `engine_trigger`-raden (`trigger_subtype='journey_inference'`) blir ikke lenger sannheten; agenten gjør noe annet enn det spec-en sier.
- En ny kollega skriver en ny journey direkte i DB for å spare tid → versjonshistorikken får et hull; rollback til forrige versjon gjenskaper ikke faktisk tilstand.
- Noen legger `--no-verify` i en commit fordi CI-gaten var "feil konfigurert" → presedens etablert, neste gang går det raskere å omgå enn å fikse roten.

Etter 10 slike snarveier er markdown-spesifikasjonen ikke lenger sannheten. Den er en *beskrivelse* av noe som en gang var sant. Hele modellen kollapser stille.

### Dette er success

Success er kjedelig, tregt å starte, og lønner seg over tid:

- Hver endring starter i markdown. Uten unntak.
- CI-gater som blokkerer merge fikses ved å oppdatere spec-en, ikke ved å bypasse gaten.
- En runtime-bug fixes ved at spec-en endres, compile kjøres, ny versjon publiseres. Runtime endrer aldri sin egen oppførsel uten å hente det fra spec.
- Når det haster, er veien fortsatt den samme — bare kortere PR. Aldri "vi compiler senere".
- Nye team-medlemmer læres opp i én regel først: *start alltid i markdown*. Alt annet er sekundært.

### Den harde kontrakten

Denne regelen er ufravikelig, håndhevet av to mekanismer:

1. **Teknisk:** CI-gater, immutable versjoner, compile-bypass umulig (runtime leser kun `journey_version` + `journey_artifact`, aldri markdown direkte).
2. **Kulturelt:** Enhver PR som ser ut til å ta en snarvei rundt spec-en avvises i review — selv om den er teknisk korrekt. Review-kommentar: *"Start i markdown. Ikke her."*

### Én tommelfingerregel

Hvis du står overfor en endring og spør deg selv *"skal jeg oppdatere spec først eller fikse koden først?"* — svaret er alltid **spec først**. Også når det er irriterende. Også når det er sent en fredag. Også når bare én testid skal legges til.

Den dagen du tar en snarvei én gang fordi "det er et spesialtilfelle", er den dagen modellen begynner å råtne.

## Tekniske kontrakter og immutable prosess

Dette er ikke retningslinjer — det er håndhevede kontrakter. Brudd blokkerer merge.

### Kontrakt 1 — Input (markdown journey-spec)

- **Schema:** Zod-schema i `packages/journey-ir/src/markdown-schema.ts`. Dekker alle 10 deep-spec-dimensjoner.
- **Validering:** `npm run validate:journeys` kjører på alle endrede `docs/journeys/JOURNEY-*.md` i PR.
- **CI-gate:** PR-check `journey-input-validate` — rød = merge blokkert.
- **Tester:** `__tests__/markdown-parser.test.ts` — golden-file-tester per deep-spec-dimensjon.

### Kontrakt 2 — Mellomledd (JourneyIR)

- **Schema:** Zod-schema i `packages/journey-ir/src/ir-schema.ts`. Strengt typet, JSON-serialiserbart.
- **Determinisme:** Samme markdown → samme IR. `content_hash` er stabil (sortert keys, normalisert whitespace).
- **Validering:** Parser returnerer enten `IR` eller `ParseError[]` — aldri delvis gyldig.
- **CI-gate:** Snapshot-tester på IR-output for alle 12 eksisterende journeys. Endring krever eksplisitt snapshot-oppdatering i PR.
- **Tester:** `__tests__/ir-determinism.test.ts` — kjør parse × 100 på samme input, verifiser identisk hash.

### Kontrakt 3 — Output (fem artefakter)

Hver emitter har sin egen kontrakt-test:

| # | Emitter | Kontrakt-test |
|---|---|---|
| 1 | Playwright-script | Generert `.spec.ts` består `tsc --noEmit` + `eslint` + `playwright test --list` (spec er oppdagbar) |
| 2 | E2E-smoke | Samme fil, kjøres i CI mod; pass/fail-rapport validert mot schema |
| 3 | USER-GUIDE (MDX) | Valideres mot `@mdx-js/mdx` compile + frontmatter-schema |
| 4 | Mission (JSONB) | Valideres mot `mission_plan_schema` Zod |
| 5 | Inference-pattern (JSONB i `engine_trigger.condition`, subtype=`journey_inference`) | Valideres mot `journey_pattern_rule_schema` Zod før insert |

- **CI-gate:** `journey-emitters-validate` — rød = merge blokkert.
- **Tester:** `__tests__/emitters/*.test.ts` — én golden-file-test per emitter per eksempel-journey.

### Kontrakt 4 — Version-control policy

- **Tre ting er versjonert:** markdown-kilden (git), IR-snapshot (`journey_version.ir_json`), og hver compile-kjøring (`compile_run`-tabell med tid, commit-sha, resultat).
- **`journey_version.content_hash`:** SHA-256 av kanonisk serialisert IR. Deterministisk.
- **`journey_version.source_commit_sha`:** git-SHA av merge-commiten som produserte denne versjonen.
- **Immutable etter compile:** en `journey_version`-rad kan ikke endres. Ny merge = ny rad. `superseded`-statusen er en flipp av en flagg, ikke en redigering av innholdet.
- **Artefakter er immutable:** `journey_artifact.content_ref` peker på en immutable ressurs (fil i repo ved commit-SHA, eller Supabase Storage-objekt med versjons-ID).
- **Status-flipper logges:** enhver `draft → verified → published → superseded`-endring skriver rad til `journey_version_audit` med actor, tid, og begrunnelse.

### Kontrakt 5 — Compile-prosess er ufravikelig

- **Én entry-point:** `packages/journey-ir/src/compile.ts` eksporterer `compileJourney(markdown) → { ir, artifacts } | { errors }`.
- **Ingen bypass:** kode som trenger journey-data må lese fra `journey_version` eller `journey_artifact`. Ingen leser markdown direkte i runtime.
- **CI-triggerpunkt:** compile kjøres kun på `development`-branch ved merge. Preview-branches compiler til isolert schema (Supabase branch-DB).
- **Failed compile blokkerer promotion:** hvis compile feiler på `development`, blokkeres `development → preview` fast-forward inntil feilen er fikset.

### Testbarhet i hver fase

| Fase | Test-type | Kjøres når |
|---|---|---|
| Markdown parsing | Unit (Zod-valider) | Pre-commit + PR |
| IR determinisme | Property-based (100 runs per journey) | PR |
| IR snapshot | Golden-file (én per journey) | PR |
| Emitter-output | Golden-file per artefakt | PR |
| Compile end-to-end | Integration (markdown → DB) | Merge til development |
| Journey 1 run | E2E (Playwright mot live dev-browser) | Manuell + canonical-run-merking |
| Journey 2 publish | Integration (verified version → mission + docs) | Ved publish-klikk |
| Journey 3 runtime | E2E (mobil-simulator med agent-overlay) | Nightly + per-journey når verified |

### Forankring i utviklingsrutiner

- **`/start-feature`:** Når en feature erklærer journeys, skriver den også stub-markdown som valideres mot Kontrakt 1.
- **`/close-feature`:** Journey Guardian-gaten kjører Kontrakt 1 + 2 + 3 på alle declared journeys. Rødt stopper merge.
- **ADR kreves ved brudd:** Hvis en PR har *gyldig grunn* til å avvike fra en kontrakt (feks midlertidig mock-IR under debugging), må den ha en ADR som refererer denne filen og begrunner unntaket. Ikke-dokumenterte unntak blokkeres.
- **Ingen `--no-verify`.** Kontraktene er CI-gater, ikke pre-commit-hooks som kan omgås.

## Governance og lifecycle

Kontraktene over definerer *hva* som må være sant. Denne seksjonen definerer *hvem* som tar avgjørelser, *når* de tas, og *hva* som skjer når noe går galt.

### Roller og ansvar

| Rolle | Ansvar | Kan endre |
|---|---|---|
| **Journey Author** (utvikleren som skrev spec) | Skriver og vedlikeholder markdown-spec. Ansvarlig for at deep-spec-dimensjonene er komplette og korrekte. | `draft` versjoner, egen spec |
| **Feature Owner** (den som eier modulen) | Reviewer spec-endringer. Godkjenner at spec matcher modulens behov. | Review-approval nødvendig for `draft → ready_test` |
| **QA / Testansvarlig** | Kjører Journey 1 (runner) mot ny versjon. Verifiserer alle fem artefakter mot kontrakt-testene. Merker canonical run. | `ready_test → verified` |
| **Platform Admin (Pontus)** | Godkjenner publisering. Vurderer om journey er klar for docs + mission + runtime. | `verified → published`, `published → superseded` |
| **Journey Inference Agent** (nattevakt) | Ukentlig helse-sjekk. Flagger drift, stale content, broken gates. Aldri publiserer eller endrer selv. | Ingenting — bare rapporterer |
| **Compile Pipeline** (automatisert) | Kjører ved merge til development. Produserer `journey_version` + `journey_artifact`. | Oppretter nye `draft` versjoner |

**Review-kravet:** Hver spec-endring krever minst én annen person enn Journey Author for approval (PR-review på GitHub). Dette er *ufravikelig*, ikke praktikabelt.

### Lifecycle states og transisjoner

```
        ┌──────────────────────────────┐
        │  merge til development       │
        │  (compile kjører)            │
        ▼                              │
    ┌───────┐                          │
    │ draft │  ←────────────────────── ┘  ny IR-hash
    └───┬───┘
        │  Feature Owner approval (PR)
        ▼
  ┌────────────┐
  │ ready_test │
  └─────┬──────┘
        │  QA kjører Journey 1, merker canonical run
        │  Alle kontrakt-tester grønne
        ▼
   ┌──────────┐
   │ verified │  ←── kan rulles tilbake hit fra published
   └────┬─────┘
        │  Platform Admin klikker Publish
        │  Tidligere published-versjon flippes til superseded
        ▼
   ┌───────────┐
   │ published │
   └────┬──────┘
        │  Ny versjon publiseres, eller rollback
        ▼
   ┌────────────┐
   │ superseded │  (aldri slettet — audit + rollback)
   └────────────┘
```

**Ingen transisjon skjer uten eksplisitt handling.** Ingen auto-promotering basert på tid eller coverage.

### Invarianter per fase

Hver state-transisjon har invarianter som *må* være sanne. Brudd blokkerer transisjonen.

**`draft → ready_test`:**
1. Alle 10 deep-spec-dimensjoner har innhold (kan være `N/A` for P2, men må være utfylt).
2. IR-parse passerer uten errors.
3. Alle 5 emittere produserer artefakter som møter sine kontrakter.
4. PR har minst én approver som ikke er Journey Author.
5. `docs/decisions/0000-decision-log.md` er oppdatert hvis spec innfører arkitektur-valg.

**`ready_test → verified`:**
1. Journey 1 (runner) har kjørt end-to-end med `result = pass`.
2. Canonical run er merket: video, screenshots, trace lagret i Supabase Storage.
3. UI-gate: alle testids i spec finnes i faktisk UI.
4. State-gate: alle events i spec dukker opp i `engine_event` under kjøring.
5. Inference-pattern matcher: completion detekteres av `engine_trigger`-raden (`trigger_subtype='journey_inference'`) som evalueres av Event Engine.
6. QA-rollen har eksplisitt signert (`verified_by` fylt).

**`verified → published`:**
1. Versjonen er `verified` (ikke hopp fra `draft`).
2. Ingen åpne blokkere-issues knyttet til denne `journey.slug` i Linear/GitHub.
3. USER-GUIDE MDX compiler uten errors og rendrer i docs preview.
4. Mission er registrert i `mission`-tabell og agent-router har indeksert den.
5. Platform Admin har eksplisitt klikket Publish (`published_by` fylt).
6. Forrige `published` versjon (hvis finnes) auto-flippes til `superseded` i samme transaksjon.

**`published → superseded`:** Kun via ny `verified → published`-transisjon på nyere versjon, eller eksplisitt rollback.

### Rollback-mekanisme

Når en `published` versjon feiler i produksjon (brukere blir stuck, completion rate faller, bug rapporteres):

**Nivå 1 — Soft rollback (sekunder):**
- Platform Admin → Journeys → valgt journey → "Rollback to previous"
- Flipper forrige `superseded` versjon til `published` i én transaksjon
- Gjeldende `published` versjon flippes til `superseded`
- Audit-rad skrives: actor, tid, begrunnelse (påkrevd)
- Agent, docs, inference-pattern — alle leser ny `published` versjon umiddelbart neste request

**Nivå 2 — Stop-all (kritisk incident):**
- Platform Admin → "Disable journey" — setter `journey.disabled_at` på slug-nivå
- Agent slutter å tilby denne journey-en uansett versjon
- Docs-siden viser "midlertidig utilgjengelig"
- Pågående brukere som er i flyten fullfører (inference-triggere i `engine_trigger` svarer fortsatt på events), men ingen ny kan starte
- Krever ADR før gjenaktivering

**Nivå 3 — Bruker-spesifikk rescue:**
- Hvis en spesifikk bruker er stuck pga versjons-endring: `guardian_signal` med `signal_type='user_journey_stuck'` + `entity_id=profile_id`
- Botsson får dette som rescue-trigger og tilbyr å guide brukeren gjennom til fullføring på den versjonen *de startet på*
- Ingen bruker blir tvunget over på ny versjon midt i en flyt

**Brukere som er midt i flyten under rollback:**
- De fortsetter på versjonen de startet på. Nevnes i Versjons-bundet publisering-seksjonen, men re-stadfestes her.
- Inference-matcheren i Event Engine leser `journey_version.version_id` fra brukerens `engine_state.context` og finner tilhørende `engine_trigger`-rader (`trigger_subtype='journey_inference'`) for den versjonen — ikke fra gjeldende `published`.

### Versjonsstabilitet for brukere i midtveisflyt

Dette er den hardeste regelen i hele modellen: **en bruker som har startet en journey fullfører alltid på den versjonen de startet på — uansett hva som skjer med `published`-peker siden.** Alt annet bryter audit, completion-semantikk og brukeropplevelse.

**Pinning-regel:**

Når en bruker starter en journey, binder runtime versjonen til flyten deres:

```
engine_state.context = {
  journey_slug: "stempling-onboarding",
  journey_version_id: "v_01HXXX...",   ← pinned ved start
  pinned_at: "2026-04-21T09:12:00Z",
  pinned_published_at: "2026-04-19T…"  ← hvilken versjon var published da?
}
```

Alle downstream-konsumenter (agent, inference-pattern, completion-writer, docs-preview for den brukeren) **leser `journey_version_id` fra `engine_state.context`** — ikke fra `journey.published_version_id`.

**Leve-regler for pinnede versjoner:**

1. En `superseded` versjon er **aldri slettet**. Artefaktene (`journey_artifact`) forblir lesbare så lenge minst én aktiv `engine_state` peker til dem.
2. Inference-regler er versjonsbundet via `engine_trigger.journey_version_id` FK. Gamle rader matcher events fra gammel event-semantikk. Nye rader matcher ny. Gamle rader slettes først når siste aktive `engine_state` på gammel versjon har closed.
3. Completion-writer leser brukerens pinnede `version_id`, henter tilhørende pattern, og evaluerer kun mot de eventene *den versjonen* forventer.

**Hva hvis en ny versjon endrer kritiske events** (f.eks. `shift.punched_in` → `shift.clocked_in`)?

- Gammel pattern matcher fortsatt `shift.punched_in` (event-navnet er frozen i pattern-IR).
- Emit-laget kan fortsette å sende begge navnene i en overgangsperiode (ADR kreves) — men behovet forsvinner når siste aktive `engine_state` på gammel versjon har closed.
- Compile-pipeline detekterer breaking event-rename og markerer ny versjon med `breaking_events: true` i IR — Platform Admin ser advarsel ved Publish.

**Migrering av pågående brukere — eksplisitt policy:**

Default: **ingen migrering.** Brukere fullfører på sin pinnede versjon. Dette er den trygge veien.

Tre unntak (hver krever eksplisitt Platform Admin-handling + audit):

| Scenario | Handling | Kommando |
|---|---|---|
| **Gammel versjon er kompromittert** (sikkerhet, datakorrupsjon) | Tvungen abort — `engine_state.context.journey_migration = "aborted_security"`. Bruker får varsel + ny entry-trigger på ny versjon. | `force_abort_version(version_id, reason)` |
| **Gammel versjon er komplett erstattet** (samme logikk, bare refaktor) og IR-diff er "semantisk ekvivalent" (flagg i compile) | Opt-in migrasjon — bruker får tilbud om å re-pinne: "Vi har oppdatert flyten. Vil du fortsette her eller starte på nytt?" | `offer_migration(version_id_from, version_id_to)` |
| **Gammel versjon er stuck for alle brukere** (Nivå 3 rescue er utilstrekkelig) | Rescue-cohort migrering — alle `engine_state` med `journey_version_id = X AND status = in_flight` får rescue-signal til Botsson, som tilbyr guided avslutning på ny versjon med tapte steg markert som "skipped (version migration)". | `migrate_stuck_cohort(version_id_from, version_id_to, reason)` |

**Ingen automatisk migrering.** Hver av de tre krever Platform Admin-klikk, begrunnelse (TEXT), og skriver rad til `journey_version_migration_audit`:

```
journey_version_migration_audit:
  id, profile_id, journey_slug,
  from_version_id, to_version_id,
  migration_type enum: force_abort | offer_accepted | offer_declined | cohort_rescue,
  initiated_by, initiated_at,
  reason TEXT (påkrevd),
  outcome enum: completed_old | completed_new | aborted
```

**Compile-pipeline ansvar ved versjonskonflikter:**

Når compile oppdager at ny versjon endrer noe av følgende i forhold til forrige `published`:
- Event-navn endret eller fjernet
- Required assertion endret
- Pattern-regel ikke lenger bakoverkompatibel
- UI-gate testid endret

→ Compile markerer versjonen med `compat: "breaking"` og lister konkret hva som brytes. Platform Admin kan ikke klikke Publish uten å kvittere: "Jeg forstår at pågående brukere forblir på forrige versjon, og har vurdert om migrering er nødvendig."

**Konsekvens:** Versjonsstabilitet er ikke en funksjon vi legger til — det er en **invariant i lifecycle-kontrakten**. Pinning skjer ved start, vedvarer gjennom rollback, og kan bare brytes med eksplisitt, audited Platform Admin-handling.

### Audit-kravet

Hver transisjon i lifecycle skriver rad til `journey_version_audit`:

```
journey_version_audit:
  id, version_id, from_status, to_status,
  actor_id, actor_role, action_at,
  reason (TEXT, påkrevd for verified/published/superseded/rollback),
  related_run_id (nullable — peker til canonical run for verified)
```

Ingen state-flipp er mulig uten audit-rad. Dette er en transaksjonell invariant (CHECK constraint + trigger).

### Incident-flow når ting går galt i produksjon

1. **Detect:** Journey Inference Agent flagger i ukentlig runde, eller completion rate-alarm trigges, eller bruker rapporterer.
2. **Triage:** Feature Owner + Platform Admin vurderer alvorlighetsgrad:
   - Kosmetisk → opprett issue, fix i neste versjon
   - Blokkering for noen brukere → Nivå 3 rescue + fix i neste versjon
   - Blokkering for alle → Nivå 1 soft rollback umiddelbart
   - Datakorrupsjon eller sikkerhet → Nivå 2 stop-all + incident response
3. **Fix:** Rot-årsak fikses i markdown-spec. PR → review → merge → compile → ny `draft` versjon.
4. **Re-verify:** QA kjører Journey 1 mot ny versjon.
5. **Re-publish:** Platform Admin publiserer ny versjon.
6. **Document:** Learning i `docs/learnings/` hvis mønsteret er generaliserbart.

## Fjernkontrollen — tilstandsmaskin, kommandoer, sanntidstransparens

Fjernkontrollen i Journey 1 er ikke en dashboard med knapper. Den er et **kommando-grensesnitt mot en journey-agent** som kjører i eget prosess. Kontrakt mellom de to er det som gjør Journey 1 trygg og reproduserbar.

### Tilstandsmodell (runner-state)

Hver kjøring eksisterer i nøyaktig én tilstand til enhver tid. Tilstandene er endelige og transisjonene eksplisitte.

```
   ┌───────────┐  initialize       ┌─────────┐
   │  idle     │ ─────────────────▶│  ready  │
   └───────────┘                   └────┬────┘
                                        │  start
                                        ▼
   ┌───────────┐  pause           ┌──────────┐
   │  paused   │ ◀────────────────│  running │
   └─────┬─────┘  resume          └────┬─────┘
         │                             │  step-complete (alle steg)
         │                             ▼
         │                        ┌──────────┐
         │                        │ finished │
         │                        └──────────┘
         │       abort                  ▲
         └──────────────────────────────┤
                                        │
                        ┌───────────┐   │
                        │  failed   │ ──┘
                        └───────────┘
                        (uncaught error / assertion fail)
```

| State | Betydning | Tillatte kommandoer |
|---|---|---|
| `idle` | Ingen kjøring aktiv. | `initialize` |
| `ready` | Script kompilert, browser klar, steg køet. Ingen klikk ennå. | `start`, `set_speed`, `set_recording`, `set_screenshots`, `set_mode`, `abort` |
| `running` | Agent utfører steg. | `pause`, `screenshot_now`, `set_speed`, `abort` |
| `paused` | Midt i flyten, venter på `resume` (eller Manuell mode: på `next`). | `resume`, `next`, `screenshot_now`, `set_speed`, `abort` |
| `finished` | Alle steg grønne. Canonical run-kandidat. | `mark_canonical`, `close` |
| `failed` | Steg brøt en assertion, kastet exception, eller timeout. | `inspect`, `close` |

**Ufravikelig:** Agent kan aldri selv-transisjonere til `finished` uten å ha fullført *alle* steg. Alternativet er `failed`. Ingen delvis success.

### Kommando-sett (Platform Admin → Agent)

Kommandoer sendes via websocket eller Supabase Realtime channel. Hver kommando har idempotency-nøkkel.

| Kommando | Payload | Gyldig i state | Effekt |
|---|---|---|---|
| `initialize` | `{ version_id, mode: "auto" \| "manual" }` | `idle` | Kompilerer script, starter browser, laster første side, går til `ready` |
| `start` | `{}` | `ready` | Starter eksekvering, går til `running` (eller `paused` hvis `mode=manual`) |
| `pause` | `{}` | `running` | Stopper etter nåværende steg, går til `paused` |
| `resume` | `{}` | `paused` | Fortsetter eksekvering (auto mode) |
| `next` | `{}` | `paused` (manuell mode) | Kjører nøyaktig ett steg, går tilbake til `paused` |
| `set_speed` | `{ speed: "slow" \| "normal" \| "fast" }` | `ready`, `running`, `paused` | Endrer inter-step delay og typing speed |
| `set_recording` | `{ enabled: bool }` | `ready`, `paused` | Start/stopp video-opptak (kun mellom steg) |
| `set_screenshots` | `{ enabled: bool }` | alle aktive | Toggle automatisk screenshot per steg |
| `screenshot_now` | `{ label?: string }` | `running`, `paused` | Tar manuelt screenshot umiddelbart |
| `set_mode` | `{ mode: "auto" \| "manual" }` | `ready`, `paused` | Bytter modus (ikke tillatt mid-step i `running`) |
| `set_cursor` | `{ visible: bool }` | alle aktive | Viser/skjuler syntetisk musepeker-overlay |
| `abort` | `{ reason: string }` | `ready`, `running`, `paused` | Stopper alt, går til `failed`, lukker browser. `reason` påkrevd. |
| `mark_canonical` | `{}` | `finished` | Marker denne kjøringen som canonical run for `journey_version`. |
| `close` | `{}` | `finished`, `failed` | Rydder browser-session, lukker kontekst, går til `idle`. |

**Ugyldig kommando** (feil state) returneres med `command_rejected`-event — aldri silent drop.

### Sanntids fremdriftsvisning

Platform Admin-UI-et speiler agentens state 1:1. Hvert steg har en rad:

```
┌────────────────────────────────────────────────────────────────┐
│ ● 1. Åpne login-siden                      [PASSED]  0.8s      │ ← klikkbar
│ ● 2. Fyll inn e-post                        [PASSED]  1.2s      │ ← klikkbar
│ ◉ 3. Klikk "Logg inn"                       [RUNNING] 0.4s      │ ← klikkbar, utvidet
│ ○ 4. Vent på dashbord                       [QUEUED]            │
│ ○ 5. Verifiser velkomst-modal               [QUEUED]            │
└────────────────────────────────────────────────────────────────┘
```

**Indikatorer:**
- `○` queued, `◉` running (pulserer), `●` completed (grønn), `✕` failed (rød), `❚❚` paused
- Tidsmåling per steg (start → ferdig)
- Samlet progress-bar øverst (X av Y steg)

**Klikk på et steg** åpner sidepanel med:
- **Event-logg:** alle `engine_event` som ble emittert under dette steget, i rekkefølge
- **Telemetri:** hvilke `emit()`-kall som gikk til PostHog / activity_trail / engine_event
- **DB-writes:** mutasjoner observert i Supabase (via realtime-subscription eller query-trace)
- **Kritiske triggere:** hvilke `engine_trigger`-rader (begge subtyper) som matchet
- **Assertions:** hvilke UI-gate (testid) og state-gate (event-navn) ble verifisert
- **Screenshot:** bilde tatt ved steg-slutt (hvis `screenshots=on`)
- **Raw Playwright trace:** link til `.zip` for trace-viewer

Dette panelet er ikke etterarbeid — det fylles ut *mens agenten kjører*, på hvert eneste steg.

### Agent → Fjernkontroll rapportering

Agent publiserer eventer kontinuerlig til en kanal som UI-et subscriber til. Kontrakt:

| Event-type | Når emittert | Payload-felter |
|---|---|---|
| `state_changed` | Ved hver state-transisjon | `from`, `to`, `reason?` |
| `step_started` | Før steg begynner | `step_index`, `step_label`, `started_at` |
| `step_progress` | Under langt steg (opsjonelt) | `step_index`, `note` |
| `step_completed` | Etter steg ferdig | `step_index`, `duration_ms`, `assertions_passed` |
| `step_failed` | Steg feilet | `step_index`, `error`, `screenshot_url`, `trace_url` |
| `event_observed` | Hver `engine_event` agent ser | `step_index`, `event_name`, `payload` |
| `emit_observed` | Hver `emit()`-destinasjon som ble truffet | `step_index`, `event_name`, `destinations[]` |
| `db_write_observed` | Hver Supabase-mutasjon i den aktuelle sesjonen | `step_index`, `table`, `op`, `row_pk` |
| `trigger_fired` | `engine_trigger`-rad matchet (enten `state_advance` eller `journey_inference`) | `step_index`, `trigger_id`, `trigger_subtype`, `matched_rule` |
| `screenshot_captured` | Nytt screenshot | `step_index`, `url`, `label?` |
| `video_chunk` | Video-segment lagret | `chunk_index`, `url`, `range_ms` |
| `assertion_result` | Hver UI-gate + state-gate-assertion | `step_index`, `gate_type`, `target`, `passed` |
| `command_rejected` | Ugyldig kommando mottatt | `command`, `current_state`, `reason` |
| `heartbeat` | Hvert 2. sekund | `state`, `current_step`, `uptime_ms` |

**Ingen silent state.** Hvis agenten jobber, sender den `heartbeat`. Hvis heartbeat uteblir i > 5 sek → UI merker kjøringen `disconnected` og tilbyr `abort`.

**Transport:**
- Primært: Supabase Realtime på `channel: journey_run:{run_id}`
- Fallback: Polling på `/api/platform-admin/journeys/runs/{run_id}/events?since=<ts>`
- Alle eventer persisteres i `journey_run_event` for etteranalyse — live-loggen er ikke bare UI, den er den lagrede sannheten.

### Konsekvenser

- **Ingen skjult tilstand.** Det UI-et viser er det agenten gjør, rapportert av agenten selv, verifiserbart mot `journey_run_event`-tabellen.
- **Reproduserbar debugging.** Siden hver kjøring er full event-stream lagret, kan en failed run kjøres gjennom på nytt i UI-et uten å spinne opp browser — som en replay-logg.
- **Canonical run er bare en `finished`-run merket.** Samme eventer og artefakter er allerede samlet — marking er bare en flagg-endring.
- **Fjernkontrollen er selv-testbar.** State-maskinen + kommandokontraktet kan kjøres unit-testet mot en mock-agent.

## CDP-infrastruktur — egen sub-spec

Fjernkontrollen beskrevet i forrige seksjon krever teknisk arkitektur som ligger utenfor denne mental-modellens scope. Detaljene flyttes til dedikert sub-spec:

**Plassering:** `docs/superpowers/specs/2026-04-XX-journey-runner-cdp-infrastructure.md` (skrives som prerequisite før build av item #4).

**Scope for sub-spec:**
- **Node-resident driver** — langlivet prosess (ikke spawn-per-run) med lifecycle på tvers av fjernkontroll-kommandoer.
- **CDP session management** — Chrome DevTools Protocol direkte (ikke via Playwright test-runner). Playwright brukes fortsatt til element-selektorer + waits, men script-eksekveringen går steg-for-steg under ekstern kontroll.
- **WS bridge fra Platform Admin** — websocket som oversetter fjernkontroll-kommandoer til CDP-calls og stream-er agent-events tilbake. Authn på WS-socket (Supabase JWT) ikke-forhandlingbar.
- **WSL display-strategi** — Xvfb (virtuelt display i WSL) som default; X-forwarding til Windows-host som fallback. Velger én, dokumenterer valget.
- **Concurrent-session isolation** — hver `run_id` får egen Chrome context + `--user-data-dir`; ingen deling av cookies, localStorage, service-worker state.
- **Process lifecycle** — hva skjer når CDP-sessionen dør midt-i-kjøring; retry-logikk; graceful abort.
- **MVP-vurdering** — kan Journey 1 lanseres med video-recording + step-pause (enklere teknikk) før full CDP-arkitektur? Sub-spec-en svarer eksplisitt.

**Hva som IKKE flyttes dit:** state-maskinen, kommando-settet, event-kontrakten — de er mental-modell-forankret og gjelder uansett underliggende teknisk implementasjon. Sub-spec-en honorerer kontraktene; de endres ikke.

---

## Migrasjons-plan (L-0075 0a/0b/0c-sekvens)

Alle nye enums og tabeller introdusert av denne modellen må landes i en koordinert sekvens. Enkelt-migrasjoner på 0.5–2 ukers mellomrom skaper inkonsistent mellomstatus i produksjon. L-0075-mønsteret (0a/0b/0c) brukes for å holde hver fase atomisk.

### 0a — Enum og tabell-fundament

| Endring | Type | Nøkkel-detaljer |
|---|---|---|
| `journey_status`-enum-utvidelse | ALTER TYPE | Legger til `ready_test`, `verified`, `published`, `superseded`. Default for eksisterende rader: `draft`. |
| `trigger_subtype`-enum | CREATE TYPE | `state_advance` (default) \| `journey_inference`. |
| `engine_trigger` kolonner | ALTER TABLE | `trigger_subtype trigger_subtype NOT NULL DEFAULT 'state_advance'`, `journey_version_id UUID NULL REFERENCES journey_version(id)`. CHECK: `trigger_subtype='journey_inference' ⇒ journey_version_id IS NOT NULL`. |
| `journey_version` tabell | CREATE TABLE | id, journey_id FK, content_hash, source_commit_sha, ir_json JSONB, status journey_status, timestamps, verified_at/by, published_at/by. RLS både JWT + API-key. |
| `journey_artifact` tabell | CREATE TABLE | id, version_id FK, artifact_type enum (5 verdier), content_ref, content_hash, created_at. Immutable (INSERT only, no UPDATE trigger). |
| `journey_version_audit` tabell | CREATE TABLE | id, version_id, from_status, to_status, actor_id, actor_role, action_at, reason TEXT, related_run_id UUID NULL. CHECK: `reason IS NOT NULL` for verified/published/superseded/rollback. |
| `journey_version_migration_audit` tabell | CREATE TABLE | id, profile_id, journey_slug, from_version_id, to_version_id, migration_type enum (force_abort/offer_accepted/offer_declined/cohort_rescue), initiated_by, initiated_at, reason TEXT, outcome enum. |
| `journey_run_event` tabell | CREATE TABLE | id, run_id, event_type, payload JSONB, emitted_at. Partisjoneres etter `emitted_at` (daglig partisjon). |

**Timestamp-regel:** Kjør `ls supabase/migrations/ | tail -1` før hver migrasjon; timestamp må være strengt større. Alle tabeller har `workspace_id` (med unntak for platform-scoped tabeller hvor det er eksplisitt erklært).

### 0b — Data-backfill og content-forankring

| Endring | Type | Nøkkel-detaljer |
|---|---|---|
| Backfill `engine_trigger.trigger_subtype` | UPDATE | Alle eksisterende rader → `'state_advance'` (idempotent via default, men eksplisitt backfill-sjekk før 0c CHECK constraint). |
| Migrer 68 `journey`-records → markdown | ETL-script | Se "Source-of-truth-migrasjon" nedenfor. Kjøres som Node-script i `apps/e2e/` eller `scripts/`. |
| Opprett `journey_version` for hver eksisterende journey | INSERT | Én rad per `journey` med status='draft', content_hash basert på eksportert markdown, source_commit_sha peker til migrasjons-commit. |

### 0c — Constraint-aktivering og cutover

| Endring | Type | Nøkkel-detaljer |
|---|---|---|
| Aktiver CHECK constraint på `engine_trigger` | ALTER TABLE | `trigger_subtype='journey_inference' ⇒ journey_version_id IS NOT NULL`. Gyldig fordi 0b har sikret default. |
| Immutability-trigger på `journey_artifact` | CREATE TRIGGER | Blokkerer UPDATE + DELETE (transaksjonell invariant). |
| Immutability-trigger på `journey_run_event` | CREATE TRIGGER | Samme. |
| Audit-trigger på `journey_version.status` | CREATE TRIGGER | Enhver state-transisjon → automatisk INSERT til `journey_version_audit`. Blokkerer state-flipp uten audit-rad. |
| RLS-policies | CREATE POLICY | Alle nye tabeller: JWT + API-key begge. Platform-admin-bare for migration-audit. |

**Hver fase kjøres som én PR, mergegatet av typecheck + lint + Supabase Local-validering.** Ingen 0a-merge uten 0b-plan klar. Ingen 0c uten 0b fullført og verifisert.

---

## Source-of-truth-migrasjon (68 DB-records → markdown)

**Problem:** DB har 68 `journey`-records. `apps/mobile/store-listing/journeys/` har 12 uavhengige markdown-filer som ingen kode leser. Mental-modellen erklærer "markdown er sannheten" — men virkeligheten er motsatt.

### Kanonisk markdown-path

`docs/journeys/JOURNEY-<slug>.md` — ikke `apps/mobile/store-listing/journeys/`.

### Frontmatter-schema (påkrevd på hver journey-markdown)

```yaml
---
title: "<Human-readable title>"
slug: "<unique-slug>"
status: draft | ready_test | verified | published | superseded
module: "<module-name>"   # f.eks. schedule, operations, onboarding
actor: "employee" | "manager" | "admin" | "new_hire"
journey_version: "1.0.0"
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tag1, tag2]
---
```

Parser i compile-pipeline Zod-valideres. Brudd → compile fails, PR blokkeres.

### Migrasjonsflyt (kjøres i 0b)

1. **Eksport** — script leser alle 68 `journey`-rader + tilhørende `journey_step` + `engine_trigger` → genererer markdown med deep-spec-skjellet.
2. **Validering** — hver generert fil parses av JourneyIR-parser. Feil → markeres i rapport, ikke committet.
3. **PR** — alle 68 markdown-filer som én stor PR til `development`. Human review på ≥20 % (stratifisert utvalg per module).
4. **Merge** — compile kjører, oppretter `journey_version` for hver med `status='draft'`.
5. **Trust Gate** — gamle DB-rader (de 68) flagges som `legacy_source=true` i `journey_version`; kan ikke flippes til `verified` uten at en journey-author har re-validert.
6. **Cleanup** — eksporter-scriptet slettes etter migrasjon (engangs-verktøy).

### Skjebnen til `apps/mobile/store-listing/journeys/*/`

**Vedtak: Slettes.** De 12 filene er ikke autoritative, ikke lest av kode, ikke synkronisert med DB. Når `docs/journeys/` etableres som kanonisk:
- Innhold inspiseres for unikt materiale (trolig none — kontekst peker på at de er eksperimenter).
- Hvis unikt innhold → flettes inn i tilsvarende `docs/journeys/JOURNEY-<slug>.md` via PR.
- Mappen `apps/mobile/store-listing/journeys/` fjernes i samme PR som 0b-migrasjonen lander.

### GitHub Action for compile-at-merge

Ikke eksisterende i dag. Må opprettes:

```
.github/workflows/journey-compile.yml
  on: push til development, paths: docs/journeys/**
  steps: checkout → pnpm install → pnpm journey:compile → commit artefakter til samme branch
```

Alternativt, hvis GitHub Action-risiko er høy: compile forblir manuell Server Action (`compileJourneyAction`), men da må "compile ved merge"-claim fjernes fra modellen. Valget erklæres i `Journey Runner / ADR-0074 Unification`-ADR-en.

---

## Extends vs net-new — build-listen re-klassifisert

Alle 12 build items klassifiseres eksplisitt. "Extends" = utvider eksisterende kode/skjema. "Net-new" = ny kode uten eksisterende fundament. Dette tvinger ærlighet om faktisk kompleksitet.

| # | Item | Klassifisering | Eksisterende fundament |
|---|---|---|---|
| 1 | Deep-spec-schema for journey_step | **Extends** | `journey_step`-tabell finnes (11 kolonner, dekker 3 av 10 dimensjoner). Utvidelse = nye kolonner eller `journey_step_dimension`-tabell. |
| 2 | Full compile-pipeline | **Extends** | `packages/ai/src/journey/compile.ts` produserer 3 artefakter i dag. Utvidelse til 5. IR-laget er net-new (JourneyIR). |
| 3 | Playwright-script-generator | **Net-new** | Ingen eksisterende generator for `.spec.ts`-filer fra journey-spec. |
| 4 | Remote control-UI + backend | **Arkitektur-rewrite** (ikke extension) | Dagens runner er `child_process` + one-way SSE. Fjernkontroll krever Node-resident driver + CDP + WS. Sub-spec påkrevd. |
| 5 | Recording + screenshot-pipeline | **Extends** | Playwright har innebygd video + screenshot. Trengs: orkestrering + Supabase Storage-kobling for canonical runs. |
| 6 | Mission-compiler | **Extends / retarget** | `apps/e2e/generators/mission-generator.ts` eksisterer (ADR-0074). Retarget til JourneyIR-input. |
| 7 | USER-GUIDE-generator | **Net-new emitter, deler IR** | `docs-generator.ts` eksisterer for ADR-0074-docs. USER-GUIDE-emitter er ny, men bruker samme JourneyIR. |
| 8 | `engine_trigger`-utvidelse for inference | **Extends** | `engine_trigger.condition` JSONB finnes. Utvidelse = nye kolonner + subtype-aware dispatcher-branch. **Ingen ny tabell.** |
| 9 | Completion-detektor | **Extends** | `engine_state.current_step` + `engine_state_step.completed_at` finnes og brukes av `journey-stuck-detector`. Detektor-funksjonen leser kun derfra. |
| 10 | Botsson UI-guidance-komponent | **Net-new (split descriptor/renderer)** | Descriptor (target testid, timeout, copy) genereres her. Renderer (`AgentSpotlight`) bor i mobil-worktree (`campaign/daily-operation`). ADR "Botsson Overlay Descriptor/Renderer Split" påkrevd. |
| 11 | Publish-knapper i Platform Admin | **Net-new UI + extends backend** | UI = nye knapper. Backend = idempotent version-flipp mot `journey_version` + audit-rad (eksisterende tabell per 0a). |
| 12 | Agent-proaktivitet | **Extends** | Agent-router finnes. Ny query: `engine_trigger WHERE trigger_subtype='journey_inference'`. Ingen ny agent-capability — utvidelse av eksisterende. |

**Implikasjon:** Kun items #3, #4, #7, #10, #11 er (helt eller delvis) net-new. Resten utvider eksisterende systemer. Dette bør reflekteres i tids-estimater og i sub-sortie-planlegging.

---

## Design-addendum (Nordic Split, ikke-forhandlingbar)

All journey-runner-UI — Platform Admin-portal, mobil-overlay, docs-sider — følger **Nordic Split**-systemet. Ikke-negotiable per `smartout-nordic-split`-skillet.

### Referanse-dokumenter

- `docs/design/ren-og-varm-styleguide.html` — autoritativ styleguide (25 seksjoner, interaktiv)
- `docs/design/orb-generator.html` — for AgentSpotlight-orb-tuning
- `packages/design-tokens/src/tokens.ts` — kanoniske tokens (OKLCH, spring-parametre)
- `.claude/skills/smartout-nordic-split` — skillet lastes før enhver `.tsx`/`.css`-edit

### Komponent-inventar (net-new primitives)

| Komponent | Plassering | Bor i |
|---|---|---|
| `RemoteControlSheet` | Platform Admin portal | `apps/web/src/app/platform-admin/journeys/_components/` |
| `StepTimeline` | Brukes i Platform Admin (Journey 1) og docs (Journey 2) | `packages/ui/src/journey/` (shared) |
| `MirrorPane` | Live-preview av browser (CDP screencast eller "focus local"-affordance) | `apps/web/src/app/platform-admin/journeys/_components/` |
| `AgentSpotlight` | Runtime-overlay som highlighter knapper og venter på klikk (Journey 3) | `apps/mobile/src/components/agent/` + `packages/ui/src/journey/` (web-variant) |
| `PublishVersionButton` | Platform Admin — "Publish to Docs" / "Activate Mission" | `apps/web/src/app/platform-admin/journeys/_components/` |

**Regel:** Alt som brukes i *både* web og mobil (StepTimeline, AgentSpotlight-base) flyttes til `packages/ui/`. Plattform-spesifikk rendering kan leve i `apps/`.

### Motion-kontrakt

- **Spring-fysikk** — `stiffness: 35`, `damping: 22`, `mass: 2.2` (default for ambient/entry-animasjoner)
- **Ambient pulse** — `animate-ambient-pulse`-utility, 3s syklus (brukes på AgentSpotlight-orb)
- **Reduced motion** — *alle* animasjoner sjekker `useReducedMotion()` og har statisk fallback. Ikke-forhandlingbar.
- **Entry-timing** — StepTimeline step-rader animerer inn med 40ms stagger.

### Farge-kontrakt

- **Ingen hardkodede farger.** `text-rose-500`, `zinc-800`, `gray-*` er forbudt. Bruk CSS-variabler: `bg-background`, `text-foreground`, `border-border`, `text-destructive`, `bg-muted`.
- **Eksisterende brudd:** `apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx` har `text-rose-500` → må erstattes med `text-destructive` som del av item #4.
- **AgentSpotlight-orb-halo:** warm OKLCH, hue 50, L 0.7, C 0.12, alpha 0.25, radius 1.5× target, `mix-blend-mode: plus-lighter`.

### Accessibility-kontrakt

| Komponent | Krav |
|---|---|
| StepTimeline | `role="log"` + `aria-live="polite"`; ved step-completion announces programmatically |
| AgentSpotlight (mobil) | Orb-halo har programmatic focus; skjermleser leser target-beskrivelse |
| Speed slider | Keyboard-operable (arrow keys), `aria-valuenow` oppdateres live |
| Mode toggle (Auto/Manual) | Annonserer state change via `aria-live` |
| Publish-knapper | `aria-describedby` peker til versjon + consequence-tekst |
| Mirror pane | Alt-tekst + `aria-label` forklarer hva som vises |

### Display-resolusjon for Journey 1

Fjernkontrollen viser hva browser gjør. Én av to løsninger (valg tas i CDP-sub-spec):

1. **"Focus local browser"-affordance** — UI forklarer at den faktiske browseren er utviklerens eget vindu; ingen live-speiling i portal.
2. **MirrorPane via CDP `Page.screencastFrame`** — live-video-strøm av browser inn i portal.

**Ikke begge. Ikke ingen.** Default (om CDP-sub-spec ikke lander først): alternativ 1.

### Design self-review-krav (ved close-feature)

Før `/close-feature` for journey-runner-sortier:
- [ ] Zero hardcoded colors (grep: `zinc-|gray-|rose-|slate-`).
- [ ] `useReducedMotion()` referert i alle Framer Motion-komponenter.
- [ ] `packages/ui/`-kandidater ikke duplisert i `apps/web/` og `apps/mobile/`.
- [ ] A11y-sjekk: kjør `@axe-core/react` i Storybook-story for nye komponenter.

---

## Hva dette ikke er

For å unngå drift fra scope:

- **Ikke en erstatning for eksisterende E2E-runner.** Den videreføres som "Smoke"-modus — Journey 1 "Auto"-mode kan kalle samme kodepath.
- **Ikke en ny telemetry-pipeline.** Vi bruker eksisterende `activity_trail` + `engine_event` + `guardian_signal`.
- **Ikke scheduling-authoring, helpdesk, eller voice.** De tilhører andre kampanjer.
- **Ikke en erstatning for Guardian-dashboardet.** Guardian overvåker AI-agentens atferd (stage-engine sessions). Journey Runner overvåker brukerens progresjon i journeys. To forskjellige ting.

---

## Enkle regler for å sjekke at vi er på sporet

Hvis en endring bryter en av disse reglene, stopp og re-konsulter dette dokumentet:

1. **Én journey-definisjon.** Finnes det en versjon av en journey som ikke kommer fra markdown-kilden? → Feil.
2. **Én IR, én parser.** Har en emitter sin egen tolkning av markdown? → Feil — alt går via IR.
3. **Fem artefakter.** Prøver vi å hoppe over compile og skrive direkte til runtime-DB? → Feil.
4. **Tre journeys.** Prøver vi å slå Journey 1 og Journey 3 sammen til én implementasjon? → Feil — Journey 1 er utvikler-fjernkontroll, Journey 3 er bruker-veiledning.
5. **Markdown er sannheten.** Redigerer noen journey-definisjonen direkte i DB eller portalen? → Feil — det må være PR mot markdown.
6. **Versjons-bundet.** Refererer kode til en journey ved navn alene når den leser `verified`/`published`? → Feil — alltid `version_id`.
7. **Publisert + verified på versjon.** Lar runtime-agenten tilby en versjon som ikke er `published`? → Feil — brukere får ikke se utkast eller superseded versjoner.
8. **Inference-triggere muterer aldri `engine_state`.** Prøver en `engine_trigger`-rad med `trigger_subtype='journey_inference'` å skrive direkte til runtime-state? → Feil. `engine_state.current_step` er write-authority (oppdateres kun av `state_advance`-subtype via Event Engine). Inference-subtype **leser** og emitter signaler/dispatcher via `engine_dispatch`. `journey_event` forblir dev-tracking per L-0023.

---

## Ordbok

| Term | Betyr |
|---|---|
| **Journey-definisjon** | Markdown-fil i `docs/journeys/JOURNEY-*.md` med deep spec (10 dimensjoner) |
| **IR (JourneyIR)** | Deterministisk, Zod-validert mellomformat mellom markdown og emittere |
| **Compile** | Parse markdown → IR → 5 emittere → artefakter. Kjører ved merge. |
| **journey_version** | Frozen compile-output identifisert ved `content_hash` av IR |
| **journey_artifact** | Én av de fem outputene, immutabelt knyttet til én `journey_version` |
| **Runner (Platform Admin)** | UI med fjernkontroll, dropdown, logg. Journey 1. |
| **Mission** | Agent-task basert på journey-definisjon. Journey 3. |
| **Inference-pattern** | JSONB-regel i `engine_trigger.condition` med `trigger_subtype='journey_inference'` + `journey_version_id` FK. Matcher events → completion/stuck/step_reached. Versjonsbundet. Én av de fem kompilerte artefaktene — ikke egen tabell. |
| **Canonical run** | E2E-kjøring merket som referanse. Video/bilder fra denne brukes i docs. Knyttet til én `version_id`. |
| **Published journey** | En `journey_version` med `status = published`. Agent og docs leser bare denne. |
| **Superseded** | Tidligere publisert versjon erstattet av nyere. Beholdt for audit og rollback. |

---

## Endringslogg

| Dato | Versjon | Endring |
|---|---|---|
| 2026-04-21 | 1.0.0 | Første versjon — etablerer tre journeys + fem artefakter som autoritativ modell |
| 2026-04-21 | 1.1.0 | Tilføyd: JourneyIR som mellomliggende kontrakt, formatkontrakt per artefakt, versjons-bundet publisering (`journey_version` + `journey_artifact`). |
| 2026-04-21 | 1.2.0 | Tilføyd: Tekniske kontrakter og immutable prosess — fem kontrakter (input/IR/output/version-control/compile), CI-gater, testbarhet per fase, forankring i `/start-feature` + `/close-feature`, ADR kreves ved unntak. |
| 2026-04-21 | 1.3.0 | Tilføyd: Skillet mellom failure og success — disiplinkontrakten. Spec først, alltid. Snarveier er roten til systemkollaps. |
| 2026-04-21 | 1.4.0 | Tilføyd: Governance og lifecycle — roller og godkjenneransvar, lifecycle states (draft → ready_test → verified → published → superseded), invarianter per fase, rollback-mekanisme i tre nivåer (soft flip / stop-all / user-specific rescue), audit-krav (`journey_version_audit`), incident-flow. |
| 2026-04-21 | 1.5.0 | Tilføyd: Fjernkontrollens tilstandsmaskin — seks states (idle/ready/running/paused/finished/failed), 13 kommandoer med state-gating og idempotency, sanntids steg-visning med klikkbart sidepanel, agent→UI event-kontrakt (13 event-typer inkl. heartbeat), Supabase Realtime + `journey_run_event`-persistering. |
| 2026-04-21 | 1.5.1 | Tilføyd (patch): Versjonsstabilitet for brukere i midtveisflyt — eksplisitt pinning-regel (`engine_state.context.journey_version_id`), leve-regler for pinnede versjoner, håndtering av breaking event-renames via `breaking_events`-flagg + overgangs-emit, migrerings-policy med tre eksplisitte scenarier (force_abort / offer_migration / cohort_rescue) + `journey_version_migration_audit`, compile-pipeline ansvar for `compat: breaking`-merking. Utvider rollback-seksjonen, ingen arkitektur-endring. v1.6.0 reservert for council-redesign-respons. |
| 2026-04-21 | 1.5.2 | Council-respons (tiltak #1 + #2 av 12): Item #9 omskrevet — completion-detektor leser fra `engine_state.current_step` + `engine_state_step.completed_at` (autoritativ runtime-state), `journey_event` forblir dev-tracking per L-0023. `step_completed`/`journey_completed` enum-utvidelse fjernet fra scope. Detektoren emitter telemetri + dispatcher via `engine_dispatch`. Ny Regel 8 i "Enkle regler": `journey_pattern` muterer aldri `engine_state`. Resterende 10 tiltak + ADR-0074-unify + enum-migrasjon gjenstår før v1.6.0 kan merges. |
| 2026-04-21 | 1.5.3 | Council-respons (tiltak #3 av 12): Ny seksjon "Relasjon til ADR-0074 Protocol Verification Engine" med UNIFY-vedtak (ikke supersede, ikke coexist). JourneyIR erstatter `ProtocolDefinition`; eksisterende `apps/e2e/generators/{mission,docs,audit}-generator.ts` retargetes til JourneyIR-input. Én pipeline, to doc-entrypoints. Migrasjonsrekkefølge i 6 steg. ADR "Journey Runner / ADR-0074 Unification" påkrevd før v1.6.0. Item #6 og #7 i build-listen re-klassifisert som retargets/emitter-tillegg, ikke netto ny kode. |
| 2026-04-21 | 1.5.4 | Council-respons (tiltak #4 av 12): `journey_pattern` slettet som egen tabell. Inference-regler lagres som `engine_trigger`-rader med ny `trigger_subtype`-enum (`state_advance \| journey_inference`) + `journey_version_id` FK + CHECK constraint. Én tabell, én matcher-motor, ulik handling per subtype (state_advance → dispatch; journey_inference → telemetri + guardian_signal). Build item #8 omdefinert fra ny tabell til kolonne-utvidelse + subtype-aware dispatcher-branch. Oppdaterte alle referanser gjennom spec: artefakt #5, build-liste, Hva-EKSISTERER-tabell, lifecycle-invarianter, rollback-seksjon, fjernkontroll-events, Regel 8, Ordbok. Unngår split-brain mellom `engine_trigger` og `journey_pattern`. |
| 2026-04-21 | 1.6.0 | **Council-redesign-respons ferdig (tiltak #5–#11 av 12).** Nye seksjoner: CDP-infrastruktur-scope (tiltak #7, item #4 flagget som arkitektur-rewrite + egen sub-spec); Migrasjons-plan med L-0075 0a/0b/0c-sekvens (tiltak #5 — enum, tabeller, backfill, constraint-aktivering); Source-of-truth-migrasjon for 68 DB-records (tiltak #6 — kanonisk path `docs/journeys/`, frontmatter-schema, ETL-flyt); Skjebnen til `apps/mobile/store-listing/journeys/` erklært (tiltak #10 — slettes); Extends vs net-new-tabell for alle 12 build items (tiltak #9 — kun 5 av 12 er net-new); Design-addendum med Nordic Split-kontrakt (tiltak #8 — komponent-inventar, motion, farge, a11y, display-resolusjon, close-feature self-review). Frontmatter status → `ready_for_council_review`. Tiltak #12: klar for ny council-review. ADR-er (7 stk) må skrives før merge til development. |
