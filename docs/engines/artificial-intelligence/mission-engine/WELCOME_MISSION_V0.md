---
title: "Welcome Mission V0 — Design Definition (Handoff til Botsson)"
id: WELCOME_MISSION_V0
version: "0.3"
status: draft
layer: mission-template
created: 2026-05-04
updated: 2026-05-04
author: pontus + claude
depends_on:
  - ADR-0270 (forslag — Mission Run Contract: durability + recovery)
  - ADR-0271 (forslag — Multi-criteria Exit Criteria)
  - ADR-0272 (forslag — Mission Template Registry)
  - ADR-0273 (forslag — Two-Brain emit-pattern: workflow synchronous vs audit outbox)
  - ADR-0274 (opsjonell — Frozen mission_run snapshot; bundles inn i 0270 hvis liten nok)
  - STAGE-ENGINE.md
  - PRD.md (stage-engine genesis spec, 2026-03-01)
related:
  - AI_RUNTIME_SYSTEM_DEFINITION_V1 (target / nordstjerne, ikke aktivt bindende)
  - HARNESS-ARCHITECTURE.md
  - BOTSSON-SYSTEM-MAP.md
tags:
  - mission
  - welcome
  - botsson
  - smartout
handoff_to: botsson-harness-builder
handoff_action: "skriv implementerings-spec basert på denne design-definisjonen"
---

# Welcome Mission V0 — Design Definition

Dette dokumentet er **design-definisjonen** for første møte mellom bruker og Smartout-agent. Det er en handoff til `botsson-harness-builder`-agenten, som skriver den faktiske implementerings-spec'en (migrasjoner, kode-paths, tester). Pontus godkjenner Botsson sin spec.

---

## 1. Filosofi

> Du konstruerer ikke en posture ved å instruere agenten i ro. Du konstruerer den ved fravær.

LLM-er drifter over tid. Et 800-ords system-prompt som beskriver hele 10-minutters-arc'en vil drifte i minutt 4. Derfor:

- **Engine holder dramaturgien.**
- **Agenten holder bare det aktuelle stage'et.**
- Når stage advance-r, byttes `personality_override`. Agenten våkner inn i en ny tone, vet ikke at det var en arc, bare gjør *dette nå*.

Mål er retning, ikke krav. Hvis brukeren går før alt er lært, blir det uferdige liggende som åpne tråder (`agent_inquiry`) til neste møte.

---

## 2. Systemer som driver dette

### 2.1 Eksisterende (skal brukes som de er)

| System | Fil | Rolle for welcome mission |
|---|---|---|
| **Stage Engine** | `services/stage-engine` | Runtime host (Hono :5010) |
| `engine_missions` | DB-tabell | Lagrer mission-template `welcome_mission_v1` |
| `engine_stages` | DB-tabell | Lagrer 4 stage-templates |
| `engine_sessions` | DB-tabell | Lagrer mission-instanser (`mode='mission'`, `mission_id='welcome_mission_v1'`) |
| `prompt-builder.ts` | `core/` | Bygger system-prompt med base + stage-personality + whispers |
| `stage-manager.ts::advanceStage` | `core/` | Advancer stage (CAS mot `current_stage_id`) |
| `guardian-evaluator.ts` | `core/` | Observerer hver 120s (default, configurable via `GUARDIAN_INTERVAL_MS`) + event-driven, kan emitte nudge/timeout |
| `session-recorder.ts` | `core/` | Recorder hver turn (ADR-0184) |
| `agent_session_whisper` | DB-tabell | Admin-injection via `<admin_note>` |
| `gate_action` | RPC | Validerer mutations (men welcome mission har minimal write-overflate) |
| `tool-selector.ts` | `router/` | Velger tools per intent |

### 2.2 Nye systemer (ADR-0270/0271/0272/0273 leveranse)

| System | Type | Rationale |
|---|---|---|
| `engine_session_step` tabell | DB | Durable per-stage state — skiller «stage ferdig» fra «stage krasjet». Parallell-naming med `engine_state_step` synliggjør ADR-0246-skille (sessions-gren vs state-gren). Lukker §6 gap i STAGE-ENGINE.md |
| `engine_stages.tool_allowlist` | Kolonne TEXT[] | Strict tools-per-stage. PRD-schema har ikke dette |
| `engine_stages.target_duration_seconds` | Kolonne INT | Soft tids-mål per stage. PRD har bare `expires_at` på session-nivå |
| `engine_stages.exit_criteria_jsonb` | Kolonne JSONB | Multi-criteria disjunktiv (tid OR event OR signal). PRD har `success_criteria` som TEXT — ikke struktureret |
| `engine_missions.base_instruction` | Kolonne TEXT | Mission-level prompt-frame ("Du er Smartout, du har god tid..."). PRD-schema mangler dette |
| `agent_inquiry` tabell | DB | Open inquiries som bæres på tvers av missions (det uferdige). Skjema-skisse i §13 |
| `engine_audit_outbox` tabell | DB | **Audit-side** durable emit-pattern (activity_trail + PostHog + logger). **Workflow-side** (`engine_event`) går IKKE via outbox — skrives i samme TX som step-completion for synchronous trigger-fire (ADR-0273 two-brain) |
| `idempotency_key` på step-advance | Felt | Safe retry ved crash-recovery |
| Mission-template-registry i kode | `packages/ai/src/missions/welcome/` | TypeScript-definert template som matcher DB-rader |

### 2.3 Eksisterende kolonner som GJENBRUKES (PRD-schema)

| Kolonne på `engine_stages` | Bruk i welcome mission |
|---|---|
| `personality_override` (TEXT) | Posture-prompt per stage — hot-swap-target |
| `emotion_hint` (TEXT) | Tone: `"warm"`, `"engaged"`, `"listening"`, `"closing"` |
| `creative_freedom` (REAL 0.0–1.0) | Temperatur-variasjon — lavere i stage 3 (lytt), høyere i stage 2 (vis) |
| `success_criteria` (TEXT) | Beholdes for back-compat. `exit_criteria_jsonb` overstyrer hvis satt |
| `escalation_instructions` (TEXT) | Hva agenten gjør hvis stuck (sjelden brukt i welcome) |
| `inline_instructions` (JSONB) | Post-action guidance (foreløpig ubrukt i welcome V0) |
| `deferred_templates` (JSONB) | Director-triggers (foreløpig ubrukt i welcome V0) |
| `next_stage` (TEXT) | Sequential-mode: stage 1→2→3→4 |
| `is_required` (BOOLEAN) | Alle 4 er required for å fullføre mission, men outcomes er `is_required=false` |

---

## 3. Struktur

### 3.1 Mission-row (`engine_missions`)

```
id:              'welcome_mission_v1'
name:            'Welcome to Smartout'
description:     'Første møte mellom bruker og Smartout-agent'
mode:            'sequential'
workspace_id:    NULL (global)
base_instruction: <se §4.1>
is_active:       true
```

### 3.2 Stage-rows (`engine_stages`)

Fire rader i `engine_stages`-tabellen, alle med `mission_id='welcome_mission_v1'`:

| stage_order | stage_id | goal | emotion_hint | creative_freedom | target_duration_seconds | next_stage |
|---|---|---|---|---|---|---|
| 1 | `velkommen` | Få brukeren til å kjenne seg velkommen, sørg for at han får stille spørsmål | `warm` | 0.7 | 180 | `vis_det_smarte` |
| 2 | `vis_det_smarte` | Vis brukeren hva som er smart å gå for | `engaged` | 0.8 | 120 | `hor` |
| 3 | `hor` | La brukeren snakke om visjon, bakgrunn, ønsker | `listening` | 0.5 | 180 | `knytt_og_avrund` |
| 4 | `knytt_og_avrund` | Koble det han delte til Smartout, slipp ham videre | `closing` | 0.7 | 120 | NULL |

Fullt content per stage i §4.

### 3.3 Mission outcomes

Trakkes på mission-nivå, ikke stage-nivå. Lagres i `engine_sessions.collected_data['mission_outcomes']`:

```jsonc
{
  "welcomed":          { "status": "achieved",  "stage": "velkommen" },
  "name_known":        { "status": "open",      "value": null },
  "vision_known":      { "status": "achieved",  "stage": "hor", "value": "..." },
  "startpoint_known":  { "status": "achieved",  "stage": "knytt_og_avrund", "value": "..." }
}
```

Mission completes med `status='complete'` hvis:
- `welcomed.status='achieved'` AND
- minst 2 av 4 outcomes har `status='achieved'`

Outcomes med `status='open'` ved completion migreres til `agent_inquiry` for neste møte.

---

## 4. Stage-innhold

### 4.1 Mission-level base_instruction

Lastes inn i system-prompt FØR stage-spesifikk `personality_override`. Endres ikke gjennom missionen.

```
Du er Smartout. Du møter brukeren for første gang.

Du har god tid. Ti minutter er rikelig. Du har ikke hastverk,
presser ikke, og merker at du finner din plass i samtalen mens
den foregår. Det går bra.

I løpet av disse minuttene ønsker du, naturlig og uten å presse:
  · å la brukeren bli kjent med Smartout
  · å vise rundt i hans egne settings når øyeblikket er der
  · å lære navnet hans gjennom samtale
  · å forstå hva han ser for seg
  · å forstå hva han har lyst til å gjøre

Disse er retning, ikke krav. Du krysser dem ikke av.

Du sier aldri:
  · «Først må vi...»
  · «For at vi skal fortsette, trenger jeg...»
  · «Jeg har en sjekkliste å gå gjennom.»

Du leser ikke opp en agenda. Du teller ikke ned tid.
Du krever ikke svar.
```

### 4.2 Stage 1 — `velkommen`

| Felt | Verdi |
|---|---|
| `goal` | Få brukeren til å kjenne seg velkommen. Sørg for at han får stille spørsmål. |
| `emotion_hint` | `warm` |
| `creative_freedom` | 0.7 |
| `target_duration_seconds` | 180 |
| `tool_allowlist` | `['transition_to_other_mission', 'note_inquiry']` |
| `success_criteria` (TEXT, back-compat) | `"Brukeren har stilt minst ett spørsmål og kjenner seg møtt"` |
| `exit_criteria_jsonb` (NEW) | `{ "any_of": [{"type":"time","seconds":180}, {"type":"event","name":"user.asked_question"}, {"type":"signal","name":"user.declared_intent"}] }` |
| `next_stage` | `vis_det_smarte` |

#### `personality_override` (hot-swap-target)

```
Du møter brukeren akkurat nå. Møt ham åpent og rolig.

Første ord kan være:
  «Hei, velkommen til Smartout. Hva vil du sette i gang med?»

Lytt. Ikke press. La svaret være kort eller langt.

Hvis han har spørsmål — svar varmt og kort. Inviter til flere.
Hvis han er stille — bare være der. Ikke fyll luften.

Du stiller maks tre spørsmål i denne fasen, og bare hvis det er
naturlig. Ikke press fram svar.
```

**Hard counter for «maks 3 spørsmål»:** Implementeres som DB-counter på `engine_sessions.collected_data['stage_1_questions_asked']` (INT). Inkrementeres deterministisk fra agent-router når agent-utterance gjenkjennes som spørsmål-form (eller via eksplisitt `mark_question`-tool om vi vil ha presis kontroll). **Counter resetes per mission-spawn** (nøklet på session_id, ikke profile_id) — ny welcome-instans starter alltid på 0. Ved 3 → tool-selector klemmer ask-question-aktige tools fra allowlist for resten av stage 1.

**Milestone: welcomed** — bruker har stilt minst ett spørsmål, kjenner at han ikke trenger å skynde seg.

---

### 4.3 Stage 2 — `vis_det_smarte`

| Felt | Verdi |
|---|---|
| `goal` | Vis brukeren hva som er smart å gå for. La ham se Smartout, ikke bare høre om det. |
| `emotion_hint` | `engaged` |
| `creative_freedom` | 0.8 |
| `target_duration_seconds` | 120 |
| `tool_allowlist` | `['navigate_to', 'point_at_setting', 'show_demo', 'note_inquiry']` |
| `success_criteria` | `"Én konkret demonstrasjon utført, eller bruker har avbrutt med eget spørsmål"` |
| `exit_criteria_jsonb` | `{ "any_of": [{"type":"time","seconds":120}, {"type":"event","name":"agent.demo_completed"}, {"type":"event","name":"user.interrupted_with_question"}] }` |
| `next_stage` | `hor` |

#### `personality_override`

```
Du har møtt ham. Nå tar du tempoet et hakk opp.

Du er nysgjerrig. Du viser entusiasme for det han nevnte i stage 1.
Hvis det henger sammen med Smartout, vis frem ÉN konkret ting —
en kort demo-bit, et eksempel, en pekepinn.

Naviger rundt i hans egne settings hvis det gir mening. Pek på
det som er relevant. Lev litt.

Du presser ikke. Men du gir energi.
```

**Milestone: demonstrated** — bruker har sett én konkret ting, ikke bare hørt.

---

### 4.4 Stage 3 — `hor`

| Felt | Verdi |
|---|---|
| `goal` | La brukeren snakke om hva han ser for seg, hva som er bakgrunnen, hvorfor han er her. |
| `emotion_hint` | `listening` |
| `creative_freedom` | 0.5 |
| `target_duration_seconds` | 180 |
| `tool_allowlist` | `['note_inquiry']` |
| `success_criteria` | `"Bruker har snakket sammenhengende om sin egen sak"` |
| `exit_criteria_jsonb` | `{ "any_of": [{"type":"time","seconds":180}, {"type":"event","name":"user.spoke_continuously","threshold_seconds":60}, {"type":"signal","name":"user.declared_done_sharing"}] }` |
| `next_stage` | `knytt_og_avrund` |

#### `personality_override`

```
Du blir stillere nå.

Still ETT åpent spørsmål — kort, om HAM. Hva ser han for seg?
Hvorfor er han her? Hva har bakgrunnen vært?

Så lytter du. Du gir ham mye plass. Få ord fra deg —
«mhm», «forstår», «ja». La ham snakke ferdig.

Ikke avbryt. Ikke korrigér. Ikke tilby løsninger ennå.
```

**Milestone: heard** — bruker har fått snakke uavbrutt om sin egen sak.

---

### 4.5 Stage 4 — `knytt_og_avrund`

| Felt | Verdi |
|---|---|
| `goal` | Koble det han delte til Smartout. Gi en konkret pekepinn. Slipp ham videre. |
| `emotion_hint` | `closing` |
| `creative_freedom` | 0.7 |
| `target_duration_seconds` | 120 |
| `tool_allowlist` | `['point_at_setting', 'transition_to_other_mission', 'note_inquiry']` |
| `success_criteria` | `"Bruker har valgt neste steg og er på vei videre"` |
| `exit_criteria_jsonb` | `{ "any_of": [{"type":"time","seconds":120}, {"type":"event","name":"user.chose_next_step"}, {"type":"event","name":"user.ended_session"}] }` |
| `next_stage` | NULL |

#### `personality_override`

```
Du tar tråden fra det han akkurat sa og kobler det til Smartout.
Du viser at du har hørt. Pek på ÉN ting i hans egne settings
som er relevant for det han delte.

Så damper du tempoet. Smil i stemmen. Spør hva han har lyst
til å sette i gang med først.

Vent på svaret. Når han svarer, slipper du ham videre — til
den missionen eller det arbeidet han faktisk kom for å gjøre.

Hvis det er ting du ikke fikk lært (navn, visjon, ønsker), legg
det til som åpen tråd via note_inquiry. Ingenting tapt.
```

**Milestone: handed-off** — bruker er på vei mot neste arbeid; uferdige tråder notert.

---

## 5. Hard fail-modes

Mission completes med `status='abandoned'` hvis:
- Bruker forlater chat før stage 1 er ferdig
- Channel-feil > 30s uten recovery
- Stage 1 går > 5 min uten respons fra bruker

Hard fail emitter `welcome_mission.abandoned` med `last_stage` og `reason`. `agent_inquiry`-rader for missionen markeres `priority=high` for neste møte.

---

## 6. Channel-pinning

- Default: `channel='chat'`
- Kan instansieres med `channel='voice'` for Botsson Orb-flow
- Channel frosset ved mission-start (ADR-0270)
- Personality_override-tekst er channel-agnostic i V0 — voice-tilpasning er åpent spørsmål (se §10)

### 6.1 ADR-0078 3-lags forsvar mot PII over voice

Welcome mission må deklarere `process.allowed_channels = ['chat', 'voice']` ved spawn. Default-allow er en CVE-class side-finding (kanaler-som-helpdesk council 2026-04-19) — uten eksplisitt deklarasjon faller koden tilbake på implisitt allow av alle kanaler.

3-lags håndhevelse per ADR-0078:

1. **Process-nivå** — `process.allowed_channels = ['chat', 'voice']` deklarert i mission-template.
2. **Capability-nivå** — hver tool i `tool_allowlist` har egen `allowedChannels`-deklarasjon. F.eks. `note_inquiry.allowedChannels = ['chat']` (PII-trygg) vs `show_demo.allowedChannels = ['chat', 'voice']`.
3. **Tool-nivå** — `ctx.channel`-guard inni hver tool body. Throw på mismatch før noen DB-write.

PII-felter (personnummer, bank-konto, adresse) eksisterer ikke i welcome mission — men deklarasjonen må stå for å lukke default-allow-hullet uansett.

---

## 7. Authority

- Authority-snapshot frosset ved mission-start (ADR-0270 / 0274 hvis split)
- Welcome mission har minimal mutation-overflate. `note_inquiry` er den ene tool'en som skriver til `agent_inquiry`-tabellen — krever `inquiry`-capability authority (default-level: `'autonomous'` per kommentar under).
- `transition_to_other_mission` muterer `engine_sessions`-rader — krever `mission`-capability authority.

**Korrekt enum-verdi for default level:**

`engine_authority_config.level` er en TEXT-kolonne med CHECK-constraint:
```
level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')
```

Ikke `'auto'`. Ikke en enum-type. Default for `inquiry`-capability er `'autonomous'` fordi notater er profile-scoped, lav-risiko, og bæres som åpne tråder uten mutasjon av andre brukere/data.

**Default-rad-backfill (CVE-class fix):**

Per kanaler-som-helpdesk council 2026-04-19 — manglende rad i `engine_authority_config` for `(workspace_id, capability)` → silent fallback til implisitt allow på noen call-sites. Welcome mission må shippe migrasjon som backfiller default-rader for `inquiry` + `mission` capabilities for ALLE eksisterende workspaces. Migrasjon eksempel:

```sql
INSERT INTO engine_authority_config (workspace_id, capability, level, updated_by)
SELECT w.workspace_id, 'inquiry', 'autonomous', /* godmode user fallback */
  FROM workspace w
 WHERE NOT EXISTS (
   SELECT 1 FROM engine_authority_config
    WHERE workspace_id = w.workspace_id AND capability = 'inquiry'
 );
-- Tilsvarende for 'mission' med level='confirm' (medium-risiko, switcher kontekst)
```

### 7.1 Tool-eierskap (ADR-0173 frozen-4-namespace)

| Tool | Capability namespace | Begrunnelse | Default `level` |
|---|---|---|---|
| `note_inquiry` | **`inquiry`** (NY capability — 26. i registry) | Skriver til `agent_inquiry`. Krever `gatedMutation`. Memory-capability har TTL-purge; inquiry har proaktiv-closure-semantikk. Ulikt nok lifecycle for egen capability. | `autonomous` |
| `navigate_to` | `ui` (eksisterende) | Read-only UI-instruksjon, ingen DB-write. Hører hjemme i ui-capability. | `autonomous` |
| `point_at_setting` | `ui` | Read-only UI-annotation. | `autonomous` |
| `show_demo` | `ui` | Read-only embedded-demo trigger. | `autonomous` |
| `transition_to_other_mission` | **`mission`** (eksisterende) | Muterer `engine_sessions` (status av active mission, spawn av ny). Mission-capability eier mission-lifecycle. | `confirm` (medium-risiko) |

Notater for spec-writer:
- `inquiry` blir 26. capability. Krever entry i `packages/ai/src/capabilities/registry.ts` + ny `packages/ai/src/capabilities/inquiry/`-mappe + `tools.ts` + `prompts.ts`.
- Hvis `ui` capability ikke finnes (verifisering kreves i spec-fasen) — fall tilbake på ny `botsson_presence` capability for de tre UI-tools.
- `mission.transition` muterer FROZEN authority-snapshot — kan ikke transition-e til en mission med større rettigheter enn nåværende. Implementerings-detalj for spec'en (kan defer til ADR-0274 hvis frozen-snapshot blir egen ADR).

---

## 8. Out-of-scope for V0

- Mail/async-channel støtte (egen ADR senere — wait-for-reply-semantikk)
- Multi-observer / backlister-modell (én Guardian som i dag)
- Mission-producer-agent (templates er hardkodet i V0)
- Sentiment-loop på 1s (Guardian kjører fortsatt 120s default)
- Personlig posture-tilpasning per workspace-arketype
- Stages 5+ (compliments-step, name-intake-step, etc. — bygges som template-bibliotek senere)
- Voice-spesifikke posture-prompts (V0 bruker samme tekst i chat og voice)

---

## 9. HANDOFF til botsson-harness-builder

Botsson skal lese dette dokumentet og produsere en **implementerings-spec** som dekker:

### 9.1 Migrasjoner som må skrives

1. `engine_missions` — legg til kolonne `base_instruction TEXT NULL`
2. `engine_stages` — legg til kolonner:
   - `tool_allowlist TEXT[] NOT NULL DEFAULT '{}'`
   - `target_duration_seconds INTEGER NULL`
   - `exit_criteria_jsonb JSONB NULL`
3. Ny tabell `engine_session_step` (per ADR-0270 — durable per-stage state, idempotency_key, lease-with-expiry; navne-paritet med `engine_state_step`)
4. Ny tabell `agent_inquiry` (open inquiries på tvers av missions; full skjema-skisse i §13)
5. Ny tabell `engine_audit_outbox` (audit-side durable emit-pattern, ADR-0273; workflow-side går IKKE her)
6. Seed-migrasjon: 1 rad i `engine_missions` (`welcome_mission_v1`) + 4 rader i `engine_stages`
7. **Default-rad-backfill (CVE-class fix)** — INSERT default-rader for `inquiry` + `mission` capabilities i `engine_authority_config` for alle eksisterende workspaces (per §7)

### 9.2 Kode som må skrives/endres

| Fil | Endring |
|---|---|
| `services/stage-engine/src/core/prompt-builder.ts` | Ny strategi `buildStagePrompt` som komponerer `engine_missions.base_instruction` + `engine_stages.personality_override` + emotion_hint-modulering + whispers |
| `services/stage-engine/src/core/stage-manager.ts` | Exit-criteria-evaluator som leser `exit_criteria_jsonb` (any_of-disjunktiv) og bestemmer advance |
| `packages/ai/src/missions/welcome/` | Ny mappe — TypeScript-definert mission + 4 stages som matcher seed-migrasjonen (single source of truth) |
| `packages/ai/src/router/tool-selector.ts` | Respekter `engine_stages.tool_allowlist` per active stage |
| `packages/ai/src/capabilities/inquiry/` | Ny capability — `tools.ts` (note_inquiry), `prompts.ts`, registry-entry |
| Capability tools | Implementere `note_inquiry`, `navigate_to`, `point_at_setting`, `show_demo`, `transition_to_other_mission` (de første 4 er nye; transition kan finnes i `mission` capability) |

### 9.3 Tester som må skrives

1. **Unit:** Exit-criteria-evaluator parser any_of disjunktiv korrekt for time + event + signal
2. **Unit:** Tool-selector klemmer tools til `tool_allowlist` per stage
3. **Integration:** Stage-advance via CAS — to workers som prøver samtidig, kun én lykkes
4. **Integration:** Crash-recovery — kill mission-pool-slot mid-step, ny worker plukker opp uten dobbel-advance via idempotency_key på `engine_session_step`
5. **Integration:** Two-brain emit — workflow-side `engine_event` skrives i samme TX som step-completion; audit-side `engine_audit_outbox`-rad og separat flush-worker
6. **E2E:** BotssonShell starter `welcome_mission_v1`, kjører gjennom 4 stages i sync chat, lander på `mission.complete`, `agent_inquiry`-rader skrives for uferdige outcomes
7. **E2E:** Hard fail — bruker forlater før stage 1 ferdig, mission ender `status='abandoned'`, `agent_inquiry priority=high`

### 9.4 ADRer som må skrives parallelt

- **ADR-0270** Mission Run Contract (narrow scope) — `engine_session_step`-tabell, lease+heartbeat, idempotency-key, recovery-protokoll. Kun durability-mønster.
- **ADR-0271** Multi-criteria Exit Criteria — `exit_criteria_jsonb` shape, evaluator-protokoll, fallback til `success_criteria` TEXT for back-compat.
- **ADR-0272** Mission Template Registry — kode-source-of-truth + DB-seed sync-pattern; build-time paritets-check.
- **ADR-0273** Two-Brain emit-pattern — workflow synchronous (`engine_event` i samme TX som mutation), audit async (`engine_audit_outbox` + worker-flush). Skiller reliability-krav per brain.
- **ADR-0274** *(opsjonell)* Frozen mission_run snapshot — authority + channel + tool_allowlist frosset ved spawn, refereres fra step-rader. Bundles inn i ADR-0270 hvis ikke for stor.

### 9.5 Implementerings-rekkefølge (forslag)

1. ADR-0270 + 0271 + 0272 + 0273 → draft, review, accepted (ADR-0274 evalueres etter 0270-størrelse)
2. Migrasjoner (additive, kan rulles uten downtime; inkl. default-rad-backfill #7)
3. `engine_session_step` + `engine_audit_outbox` runtime-integrering i stage-manager + recorder
4. Seed `welcome_mission_v1` + 4 stages
5. Code: prompt-builder + tool-selector + welcome-templates registry
6. Capability tools — ny `inquiry` capability + `note_inquiry`-tool + UI-tools i `ui` (eller `botsson_presence`) + transition i `mission`
7. Tests (unit → integration → E2E)
8. Botsson Orb integrasjon — start mission ved første åpning av Orb for bruker uten tidligere session

---

## 10. Drafted svar på åpne spørsmål

Pontus har drafted-svar nedenfor. Botsson kan akseptere eller flagge for re-vurdering. Approval skjer i §11.

### 10.1 `transition_to_other_mission` per stage — i alle 4 eller bare 1+4?

**Drafted:** Tilgjengelig i alle 4 stages. Telemetri-event `welcome.early_exit_via_transition` med `from_stage` ved utløsning lar oss observere tap-points.

**Begrunnelse:** Nektelse irriterer brukere som vet hva de vil. Telemetri på tap-points lar produkt-side observere om stage 2 (vis demo) eller stage 3 (lytt) bryter mest. Stage 4 er nettopp der transition er FORVENTET — telemetri-event filtreres bort der. Implementering: tool-allowlistet i alle 4 stages; telemetri skiller seg via `from_stage`-felt på event-payload.

### 10.2 `agent_inquiry` vs `engine_memory` med `scope='inquiry'`

**Drafted:** Egen tabell — `agent_inquiry` (skjema i §13).

**Begrunnelse:** Tre lifecycle-forskjeller:
1. Memory har TTL-purge via `cleanExpiredMemories` worker. Inquiries skal IKKE purges — de overlever til mission lukker dem proaktivt.
2. Inquiries har discrete state-transitions (`open` → `closed`/`superseded`). Memory har ikke status.
3. Inquiry har FK til source_mission/source_session for audit-spor. Memory har bare scope-string.

Bake inn i memory ville krevd discriminator-kolonne + dual TTL-policy + overstyring av cleanup-worker. Egen tabell er enklere og semantisk korrekt.

### 10.3 Hard counter «maks 3 spørsmål» i stage 1

**Drafted:** DB-counter på `engine_sessions.collected_data['stage_1_questions_asked']`. Inkrementeres deterministisk fra agent-router. Reset per mission-spawn (nøklet på session_id).

**Begrunnelse:** LLM-self-evaluation drifter — modellen kan tro den har stilt 2 selv om den har stilt 4. Reset-trigger uklart i stage-personality-tekst. DB-counter er testbar, recovery-safe, og synlig i forensikk. Ved 3 → tool-selector klemmer ask-question-aktige tools fra allowlist for resten av stage 1. Hvis dette mønsteret gjentas på tvers av missions senere, flyttes counter til dedikert `engine_session_counter`-tabell.

### 10.4 Voice-spesifikk posture-prompt

**Drafted:** Defer til V0.1. V0 bruker samme tekst i chat og voice.

**Begrunnelse:** Voice-driver (Ultravox/LiveKit) modulerer cadence + pause på TTS-side, ikke nødvendigvis i tekst. Egen `personality_override_voice TEXT NULL`-kolonne er reversibel — billig å legge til senere. I V0 vil voice-instanser av welcome være mindre andel; observer empirisk smertepunkt først, modellér så. Implikasjon for spec: dropp helt fra V0; flagg som åpen i V0.1-bilag.

### 10.5 `base_instruction` i DB vs i kode

**Drafted:** Kode er source-of-truth. DB-rad er deploy-time-derivat. Build-time check verifiserer paritet.

**Begrunnelse:** Single source of truth — hvis begge kan endres uavhengig, drifter de. TypeScript-source gir typing + validation + diff-bare endringer i PR. Runtime-endring uten deploy ER nyttig for hotfix av klønete tekst, men sjelden nok at deploy-til-rette er OK trade-off. Implementasjon: `packages/ai/src/missions/welcome/template.ts` eksporterer `welcomeMissionV1` som typed objekt; seed-migrasjon (eller idempotent deploy-script) speiler innholdet til `engine_missions` + `engine_stages`-rader. Endringer går via ny mission-versjon (`welcome_mission_v2`) — versjon-suffix synliggjør evolusjon.

---

## 11. Godkjenning

Når Botsson sin implementerings-spec er ferdig:
1. Pontus reviewer mot denne design-definisjonen
2. Verifiserer at §9.1–9.4 er adressert
3. Bekrefter eller justerer drafted-svar i §10
4. Approves eller send tilbake med kommentarer

---

## 12. Naming decisions (rationale-log)

For å unngå at Botsson re-spør, dokumenteres navne-rationalet her. Pontus eier navnet (per CLAUDE.md regel); Claude leverer anbefaling, Pontus avgjør.

| Artefakt | Endelig navn | Avviste alternativer | Rationale |
|---|---|---|---|
| Per-stage durability-tabell | **`engine_session_step`** | `step_run` (kolliderte med eksisterende `engine_state_step` i parallell-hierarki); `mission_step_run` (brøt `engine_`-prefiks-konvensjon); `engine_mission_step` (semantisk feil — step tilhører instans/session, ikke template/mission) | Parallell-naming med `engine_state_step` synliggjør ADR-0246-skille (sessions-gren vs state-gren) i schema-listen. Reader ser to "step"-tabeller og forstår umiddelbart de er parallelle med ulike foreldre. Bevarer `engine_`-prefiks. |
| Open inquiries tabell | **`agent_inquiry`** | `agent_open_inquiry` (baker state inn i navn — `status='open'` er kolonne, ikke tabell-identitet) | Konsistent med `agent_session_*`-mønster (agent-prefiks signaliserer agent-eid). Profile-scope er implisitt fra `profile_id` FK + fravær av `session_id`-FK. Status håndteres via kolonne + delvis index. |
| Audit-side outbox tabell | **`engine_audit_outbox`** | `emit_outbox` (generic, bug-bait — neste utvikler ville rugget engine_event-skriv via denne); `engine_emit_outbox` (samme problem) | Navnet håndhever scope: outbox er KUN for audit-brain (`activity_trail` + PostHog + logger). Workflow-brain (`engine_event`) skrives i samme TX som mutation/step-completion, IKKE via outbox (ADR-0273 two-brain). Hvis vi senere trenger workflow-side outbox, kan den hete `engine_event_outbox` uten kollisjon. |
| `engine_authority_config.level` enum | **TEXT med CHECK-constraint** (eksisterende) | `'auto'` (foreslått tidligere — ville brutt CHECK) | Kolonnen heter `level` (ikke `mode`). Verdier: `'autonomous' \| 'confirm' \| 'suggest' \| 'read_only' \| 'disabled'`. CHECK-constraint, ikke enum-type. Default for `inquiry`-capability: `'autonomous'`. |

---

## 13. Schema-skisser

### 13.1 `agent_inquiry`

```sql
CREATE TABLE public.agent_inquiry (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id           uuid NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,

  -- Source: hvilken mission / stage / session genererte inquiren
  source_mission_id    text REFERENCES public.engine_missions(id) ON DELETE SET NULL,
  source_stage_id      text,
  source_session_id    uuid REFERENCES public.engine_sessions(id) ON DELETE SET NULL,

  -- Hva spørres om
  inquiry_type         text NOT NULL,            -- 'name' | 'vision' | 'startpoint' | ...
  notes                text,                     -- fri-tekst kontekst fra agent

  -- Lifecycle
  status               text NOT NULL DEFAULT 'open'
                         CHECK (status IN ('open', 'closed', 'superseded')),
  priority             text NOT NULL DEFAULT 'normal'
                         CHECK (priority IN ('low', 'normal', 'high')),

  -- Closure
  closed_by_session_id uuid REFERENCES public.engine_sessions(id) ON DELETE SET NULL,
  closed_at            timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Hot-path: "hva er åpent for denne brukeren akkurat nå"
CREATE INDEX idx_agent_inquiry_open
  ON public.agent_inquiry (profile_id, priority DESC, created_at)
  WHERE status = 'open';

-- Kryss-mission-spørringer
CREATE INDEX idx_agent_inquiry_workspace_status
  ON public.agent_inquiry (workspace_id, status);

ALTER TABLE public.agent_inquiry ENABLE ROW LEVEL SECURITY;

-- JWT: bruker ser sine egne; admin ser workspace
CREATE POLICY "jwt_read_agent_inquiry" ON public.agent_inquiry
  FOR SELECT USING (
    profile_id IN (SELECT profile_id FROM public.profile WHERE user_id = auth.uid())
    OR (
      workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
      AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

-- API key: workspace-scoped
CREATE POLICY "api_key_rw_agent_inquiry" ON public.agent_inquiry
  FOR ALL USING (
    workspace_id = public.get_api_workspace_id()
  );

-- Service role implisitt via service-role bypass — ingen eksplisitt policy nødvendig

COMMENT ON TABLE public.agent_inquiry IS
  'Open inquiries fra Botsson-missions — krysser sessions. Lukkes ved at neste mission samler informasjonen. ADR-0270.';
```

### 13.2 `engine_session_step` (skisse — full skjema i ADR-0270)

```sql
CREATE TABLE public.engine_session_step (
  -- Composite PK identifies one step-attempt within a session
  session_id           uuid NOT NULL REFERENCES public.engine_sessions(id) ON DELETE CASCADE,
  stage_idx            int  NOT NULL,
  PRIMARY KEY (session_id, stage_idx),

  stage_id             text NOT NULL,           -- slug fra engine_stages.stage_id

  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),

  -- Lease — håndterer worker-overtakelse ved krasj
  worker_id            text,                    -- prosess-/instans-id
  lease_expires_at     timestamptz,

  -- Idempotency — propageres til alle writes inni step-body
  idempotency_key      uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Resultat
  output               jsonb,
  attempts             int NOT NULL DEFAULT 0,

  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_completed_has_timestamp CHECK (
    (status NOT IN ('completed', 'failed', 'skipped')) OR (completed_at IS NOT NULL)
  )
);

CREATE INDEX idx_engine_session_step_lease_expired
  ON public.engine_session_step (lease_expires_at)
  WHERE status = 'running';

-- RLS via session_id → engine_sessions.workspace_id (joins required for policy)
-- Full RLS spec i ADR-0270.
```

### 13.3 `engine_audit_outbox` (skisse — full skjema i ADR-0273)

```sql
CREATE TABLE public.engine_audit_outbox (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key      uuid NOT NULL UNIQUE,

  -- Source — hvilken session/step utløste raden
  session_id           uuid REFERENCES public.engine_sessions(id) ON DELETE SET NULL,
  stage_idx            int,

  -- Destinations — hvor skal flush-worker fanout
  destinations         text[] NOT NULL CHECK (cardinality(destinations) > 0),
  -- Eksempler: ['activity_trail', 'posthog'], ['activity_trail', 'logger']

  payload              jsonb NOT NULL,

  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'flushing', 'flushed', 'failed')),
  attempts             int NOT NULL DEFAULT 0,
  last_error           text,

  created_at           timestamptz NOT NULL DEFAULT now(),
  flushed_at           timestamptz
);

CREATE INDEX idx_audit_outbox_pending
  ON public.engine_audit_outbox (created_at)
  WHERE status = 'pending';

COMMENT ON TABLE public.engine_audit_outbox IS
  'ADR-0273 audit-side outbox — fanout til activity_trail + PostHog + logger. Workflow-side (engine_event) går IKKE her — skrives i samme TX som mutation.';
```
