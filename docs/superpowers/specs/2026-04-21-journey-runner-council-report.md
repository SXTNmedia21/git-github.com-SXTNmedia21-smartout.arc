---
title: "Council Report — Journey Runner Suite Mental Model (v1.5.0 review)"
status: review
updated: 2026-04-21
created: 2026-04-21
module: testing
tags: [journey, council, report, review, mental-model]
---

# Council Report — Journey Runner Suite Mental Model

**Spec:** `docs/superpowers/specs/2026-04-21-journey-runner-suite-mental-model.md`
**Spec-versjon reviewed:** 1.5.0 (siste HEAD ved rapport-tid)
**Verdict:** REJECT AS SPECIFIED — REDESIGN REQUIRED
**Agenter konsultert:** system-steward (chair), supervisor, system-agent-coordinator (code-tracer), frontend-designer
**Alle fire svarte.** Ingen degraded mode.

---

## Formål med denne rapporten

Ta med til andre terminal der spec-en redigeres. Gir prioritert liste over hva som må endres i spec-en før build kan starte, hvilke ADR-er som må skrives, og hvilke bekymringer som allerede er adressert i v1.5.0.

---

## TL;DR

Det mentale rammeverket (én definisjon → tre journeys → fem artefakter) er sunt og bevares. **Spec v1.5.0 har bygget vakker struktur rundt problemet** (lifecycle, kommandokontrakter, disiplin-kontrakt) **uten å løse kjernefunnene**. 8 av council-funnene gjelder fortsatt, inkludert alle tre hard blockers. Build kan ikke starte før ADR-ene under er skrevet og spec v1.6.0 er revidert.

---

## Hard blockers (må løses i spec før build)

### 1. L-0023-brudd — completion-writer til `journey_event`

**Hvor i spec:** Build item #9 (linje 221). Kontrakt 3 (linje 322) refererer `journey_pattern_rule_schema`.
**Problem:** Item #9 skriver fortsatt `step_completed` / `journey_completed` til `journey_event`. `journey_event`-enumen er rent dev-tracking per L-0023 — må aldri huse runtime-state. `engine_state.current_step` er allerede autoritativ (stuck-detector bruker den i dag).
**Fiks i spec:**
- Omskriv item #9 til: "Completion-deteksjon leses fra `engine_state.current_step` + `engine_state_step.completed_at`. `journey_event` forblir dev-tracking only."
- Fjern `step_completed` / `journey_completed` enum-utvidelse fullstendig.
- Legg til Regel 8 i "Enkle regler": "`journey_pattern` muterer aldri `engine_state`. Detektor emitter signaler og dispatcher via `engine_dispatch`."
- Linje 470 nevner allerede `engine_state.context` for version_id — utvid samme mønster til write-authority.

### 2. ADR-0074-duplikasjon ikke adressert

**Hvor i spec:** "Hva dette ikke er" (linje 633) erklærer kun at E2E-runner videreføres som Smoke. Generator-pipelinen (`apps/e2e/generators/{mission,docs,audit}-generator.ts`) er fortsatt usynlig.
**Problem:** Spec foreslår artefakter #1–#4 som strukturelt duplikerer eksisterende Protocol Verification Engine (ADR-0074). To parallelle markdown→IR→artefakter-pipelines drifter innen én release-syklus.
**Ruling:** **Unify** (ikke Supersede, ikke Non-overlap).
**Fiks i spec:**
- Ny seksjon "Relasjon til ADR-0074 Protocol Verification Engine" med eksplisitt Unify-vedtak.
- Navngi `apps/e2e/protocols/schema.ts`, `apps/e2e/generators/mission-generator.ts`, `apps/e2e/generators/docs-generator.ts`, `apps/e2e/generators/audit-generator.ts`.
- JourneyIR erstatter `ProtocolDefinition`; eksisterende emittere retargetes til JourneyIR-input. Én pipeline, to doc-entrypoints.

### 3. Enum og tabeller fins ikke

**Hvor i spec:** Linje 144 lister `draft | ready_test | verified | published | superseded` som gitt.
**Problem:** Faktisk `journey_status`-enum har 13 verdier — hverken `verified` eller `published`. Tabeller `journey_version`, `journey_artifact`, `journey_version_audit`, `compile_run` fins ikke. Også nye tabeller introdusert i v1.5.0 (`journey_run_event`) har ingen migrasjonsreferanse.
**Fiks i spec:**
- Eksplisitt migrasjonsavsnitt som lister alle nye enums + tabeller.
- L-0075-style sekvensplan (0a/0b/0c).
- `ls supabase/migrations/ | tail -1` før timestamp velges (spec sier dette generelt, men nevner det ikke per tabell).
- Angi at `draft → ready_test → verified → published → superseded` kommer som ALTER TYPE på eksisterende enum, eller erstatter den helt (velg én).

---

## Ikke-blokkerende men må adresseres

### 4. `journey_pattern` vs `engine_trigger.condition`

**Hvor i spec:** Linje 202 sier `journey_pattern` "FINNES IKKE". Ingen diskusjon av forholdet til `engine_trigger.condition` JSONB.
**Problem:** `engine_trigger.condition` lagrer allerede per-process match-regler (se `compile.ts:105-112`). Nytt `journey_pattern` dupliserer. Split-brain-risiko: `engine_trigger` avanserer state, `journey_pattern` sier "completed?" — de kan være uenige.
**Ruling:** Slett `journey_pattern` som separat tabell. Utvid `engine_trigger` (eventuelt med `trigger_subtype`-kolonne) i stedet.
**Alternativ:** Behold `journey_pattern` eksplisitt som *derived from* engine-rules, eller som *authoring input* som kompilerer til både `engine_trigger.condition` og UI-highlighter-metadata. Valget må erklæres.

### 5. Source-of-truth-migrasjon understated

**Hvor i spec:** "Markdown er sannheten" (linje 105). Disiplin-kontrakten (1.3.0) adresserer kultur, ikke migrasjon.
**Problem:** 68 journey-records i DB. 12 markdown-journeys i `apps/mobile/store-listing/journeys/` uleste av null kode. "Compile på merge" har ingen GitHub Action i dag. `compileJourneyAction` er manuell Server Action.
**Fiks i spec:**
- Kanonisk markdown-path erklært (sannsynlig `docs/journeys/JOURNEY-*.md`, ikke `store-listing/`).
- Frontmatter-schema definert.
- Migrasjonsplan: DB → markdown-export → validert → ny compile-flyt inn. L-0075 0a/0b/0c.
- GitHub Action wiring for merge-triggered compile (eller alternativ: behold manuell trigger og slett "ved merge"-claim).
- Skjebnen til de 12 `store-listing/`-filene erklært: slettes, flyttes, eller blir migrasjons-kilder.

### 6. Unpaid ADR-gjeld fra 2026-04-06

**Hvor i spec:** Ikke nevnt.
**Problem:** Council 2026-04-06 mandaterte to ADR-er aldri skrevet: "Mobile Telemetry Offline Emit" + "Journey Progress via Domain Process Engine". Den andre er *akkurat* L-0023-reconciliation over. 15 dager gammel gjeld.
**Fiks:** Skriv begge før spec v1.6.0 merges. Begge er precondisjoner — særlig Journey 3 mobile completion-writes avhenger av Offline Emit-ADR.

### 7. Headed Playwright + CDP — arkitektur-rewrite, ikke extension

**Hvor i spec:** Ny seksjon 1.5.0 (Fjernkontrollen) designer state machine, kommandoer, events.
**Problem:** Seksjonen er mye bedre strukturert, men spec'en behandler fortsatt dette som "videreføring av eksisterende runner". Faktisk: dagens runner er `child_process` + SSE (one-way). Manuell Next-per-step er arkitektonisk umulig på Playwright test-runner. Krever Node-resident driver + CDP session + WS bridge fra Platform Admin. Det er net-new infrastruktur.
**Fiks i spec:**
- Erklær item #4 eksplisitt som "arkitektur-rewrite, ikke extension".
- Split ut egen sub-spec: `docs/superpowers/specs/2026-04-XX-journey-runner-cdp-infrastructure.md`.
- Inkluder: WSL display strategy (Xvfb eller X-forwarding), authn på CDP socket, concurrent-session isolation, process lifecycle på tvers av fjernkontroll-kommandoer.

### 8. Nordic Split / design ikke i spec

**Hvor i spec:** Ikke nevnt.
**Problem:** Spec-språket er operasjonelt ("fjernkontroll", "live-log"). Null referanse til Nordic Split, motion, reduced-motion, design tokens. Eksisterende `runner-tab.tsx` har også hardkodet `text-rose-500` (brudd).
**Fiks i spec:**
- Design-addendum som refererer `docs/design/ren-og-varm-styleguide.html` + `smartout-nordic-split`-skillet som non-negotiable.
- Komponent-inventar for net-new primitives: `RemoteControlSheet`, `StepTimeline`, `MirrorPane`, `AgentSpotlight` (mobil + web), `PublishVersionButton`. Angi hvilke bor i `packages/ui/`.
- Motion-kontrakt: spring stiffness 35, damping 22, mass 2.2. `animate-ambient-pulse`. Alle animasjoner sjekker `useReducedMotion()`.
- Farge-kontrakt: ingen hardkodede farger. `text-rose-500` → `text-destructive` som del av dette arbeidet.
- Accessibility-kontrakt: Step Timeline `role="log"` + `aria-live="polite"`, mobil orb-halo programmatic focus, speed slider keyboard-operable, mode toggle annonserer state change, publish-knapper `aria-describedby`.
- Split display-resolusjon: enten "focus local browser"-affordance eller mirror-pane via CDP `Page.screencastFrame`. Ikke begge, ikke ingen.
- Orb-halo-spec for mobile AgentSpotlight: warm OKLCH hue 50, L 0.7, C 0.12, alpha 0.25, radius 1.5x target, `mix-blend-mode: plus-lighter`, spring entry, 3s ambient-pulse, reduced-motion fallback.

---

## Adressert i v1.5.0 (ikke behov for endring)

| Council-concern | Hvor adressert |
|---|---|
| Runner-arkitektur som "svart boks" | Seksjon 1.5.0 — state machine, 13 kommandoer, 13 event-typer, heartbeat, `journey_run_event`-persistering |
| Governance, roller, lifecycle | Seksjon 1.4.0 — seks roller, invarianter per transisjon, tre-nivå rollback, `journey_version_audit` |
| Disiplin (spec-først-regelen) | Seksjon 1.3.0 — kulturell kontrakt, ikke-fravikelig |
| Formatkontrakt per artefakt | Seksjon 1.2.0 + Kontrakter 1–5 |
| Versjons-bundet publisering | Seksjon "Versjons-bundet publisering" + Kontrakt 4 |

---

## Semantisk konflikt-oppløsning (fra chair's synthesis)

Disse er løst — referanse for redigeringsterminal:

- **`engine_state.current_step` = write-authority. `engine_state_step.completed_at` + `engine_event` = read-sources. `journey_event` = dev-tracking only.** Hardt gate.
- **Journey Runner emitter *descriptor* (target testid, timeout, copy). `AgentSpotlight` renderer bor i mobil (D6-territorium).** Koordineringsnotat med `campaign/daily-operation` påkrevd.
- **`journey_pattern` slettes som separat tabell.** Utvid `engine_trigger`.
- **Ett pipeline, ikke to.** JourneyIR + ADR-0074-generators unifiseres.

---

## Agent Trust Gate

**Status: REJECTED.** Ingen journey-capability får registreres før:

1. ADR-ene under er skrevet og akseptert.
2. Enum + tabell-migrasjoner landet.
3. `engine_authority_config`-entry for `journey`-capability med default `suggest` (ikke `autonomous`) per ADR-0132 mobile AI routing.
4. Alle `emit()`-kall fra nye journey-mutasjoner registrert i `packages/telemetry/src/registry.ts` med alle fire destinasjoner wiret.

---

## ADR-er som må skrives (før spec v1.6.0 merger)

| # | Tittel | Scope (én linje) |
|---|---|---|
| 1 | Journey Runner / ADR-0074 Unification | JourneyIR erstatter ProtocolDefinition; existing generators retargetes |
| 2 | Journey Status Lifecycle | Enum-migrasjon (`verified` + `published` + `superseded`); `journey_version` + `journey_artifact` tabeller; transisjons-regler |
| 3 | Dev-tracking vs Runtime-state Separation for Journeys | Kodifiserer L-0023 for journey-domenet; `engine_state` = authoritative |
| 4 | Mobile Telemetry Offline Emit (pending 2026-04-06) | Queued offline emit-kontrakt; blocker for Journey 3 mobile |
| 5 | Journey Progress via Domain Process Engine (pending 2026-04-06) | Canonical resolution av split-brain mellom `engine_state` og `journey_event` |
| 6 | Botsson Overlay Descriptor/Renderer Split | Descriptor = Journey Runner worktree. Renderer = `apps/mobile/src/components/agent/AgentSpotlight.tsx` |
| 7 | Source-of-Truth Migration Plan | DB → markdown-eksport for 68 eksisterende journey-records; L-0075 0a/0b/0c |

**Step 0 av Phase 8 krever nummerreservasjon via `git log --all` mot alle branches** — 5th-occurrence-regel. Ikke velg ADR-nummer før denne sjekken er kjørt.

---

## Learnings å logge

1. **Markdown-as-source-of-truth krever migrasjonsbevis, ikke bare arkitektonisk påstand.** 68 frossen-records er virkeligheten.
2. **"Extends existing system"-claims trenger extends-vs-new-tabell på spec-tidspunkt, ikke council-tidspunkt.** Kostet 4 agenter parallell code-trace.
3. **Parallelle pipelines drifter innen én release-syklus.** Unify over coexist.
4. **Phase 2.5 code-trace fanger ~30 % av arkitektoniske falske claims.** Uten det: reject-rate på "vakker mental modell"-specs ~80 %.
5. **Worktree-grense-brudd dukker opp som "mobil primitive"-forslag.** Alltid split descriptor (authoring worktree) fra renderer (execution worktree).
6. **Spec kan ha vakker struktur bygget oppå uavklart ontologi.** v1.5.0 lagt til lifecycle + kommandoer + disiplin uten å løse L-0023 eller ADR-0074 — strukturen forsterker feil fundament.

---

## Risici

**Hvis vi fortsetter uten redesign:**
- L-0023-brudd skaper parallelt runtime-state-system; `journey-stuck-detector` breaker eller divergerer stille.
- ADR-0074-pipeline og JourneyIR-pipeline forker; 3 måneder fra nå har vi to markdown-compilers med ulike IR-er.
- `journey_pattern` + `engine_trigger.condition` split-brain på event-matching.
- 68 eksisterende journey-records foreldreløse eller retroaktivt inkonsistente.
- Mobile Trust Gate bypass: journey-capability registrert før `engine_authority_config` eksisterer.

**Hvis vi utsetter:**
- Journey 1 (dev test-run med fjernkontroll) utsettes — reell utvikler-friksjon fortsetter.
- Mental modell-erosjon: uten v1.6.0 kan "én definisjon → tre journeys → fem artefakter" bli utvannet i urelaterte PR-er.
- Pending 2026-04-06 ADR-er forblir pending (har vært det i 15 dager).

**Defer-risiko er reell men lavere enn proceed-risiko. Redesign er billigere enn å rulle tilbake L-0023-brudd post-merge.**

---

## Tiltaksliste for redigeringsterminal (i rekkefølge)

1. Omskriv item #9 (completion-writer) til å lese fra `engine_state.current_step`.
2. Legg til Regel 8 i "Enkle regler" (`journey_pattern` muterer aldri `engine_state`).
3. Legg til seksjon "Relasjon til ADR-0074 Protocol Verification Engine" med Unify-vedtak.
4. Slett `journey_pattern` som separat tabell — erstatt med `engine_trigger`-utvidelse.
5. Legg til migrasjons-seksjon med L-0075 0a/0b/0c-plan for alle nye enums og tabeller.
6. Legg til source-of-truth-migrasjonsplan (68 records).
7. Split item #4 (headed Playwright + CDP) ut til egen sub-spec.
8. Legg til design-addendum (Nordic Split, komponent-inventar, motion-, farge- og a11y-kontrakter).
9. Legg til "extends vs net-new"-tabell for alle 12 build items.
10. Erklær skjebnen til `apps/mobile/store-listing/journeys/*/`.
11. Bumpe versjon til 1.6.0 i endringsloggen.
12. Signaler klar for ny council-review.

---

## Sitatnyttige filreferanser

For redigeringsterminal:

- `packages/ai/src/journey/compile.ts:68-114` — produserer 3 artefakter i dag
- `apps/web/src/app/platform-admin/journeys/actions/compile.ts:22-40` — leser DB, ikke markdown
- `apps/web/src/app/api/platform-admin/e2e/run/route.ts:36-132` — child_process + SSE one-way
- `apps/web/src/app/platform-admin/journeys/_hooks/use-e2e-runner.ts:56-92` — SSE-kontrakt
- `supabase/functions/journey-stuck-detector/index.ts:34,74-80` — hardkodet journey_03, step 2, queries `engine_state`
- `supabase/migrations/20260301140000_journey_system.sql:14-20` — faktisk enum (13 values)
- `supabase/migrations/20260301140000_journey_system.sql:57-59` — journey_event_type enum
- `apps/e2e/protocols/schema.ts` — eksisterende Zod-validert declarative-spec-schema
- `apps/e2e/generators/{mission,docs,audit}-generator.ts` — eksisterende generator-pipeline
- `apps/web/src/app/platform-admin/journeys/_components/runner-tab.tsx` — `text-rose-500` brudd
- `packages/design-tokens/src/tokens.ts` — kanoniske design-tokens
- `docs/decisions/0000-decision-log.md` — sjekk mot ADR-0074, ADR-0132, ADR-0133, ADR-0134

---

**End of report.** Denne rapporten kan konsumeres direkte av redigeringsterminal. Neste trinn er spec-revisjon til v1.6.0 pluss 7 ADR-er.
