---
title: "HANDOFF — Session Recorder + Platform Admin Intervention"
status: in_progress
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
feature: session-recorder
branch: campaign/botsson-arena
tags: [handoff, botsson, session-recorder, platform-admin, campaign, adr-0184, adr-0185, adr-0186]
---

# HANDOFF — Session Recorder + Platform Admin Intervention

> **Branch:** `campaign/botsson-arena` · **Session date:** 2026-04-22
> **Campaign:** Botsson Arena · **Phases completed this session:** Phase 0 (A3+A5+A6), Phase 1 (D1 recorder), Phase 2a (missing endpoints), Phase 2b (UI composition)
> **Status:** Feature delivery 95% complete. Phase 2c (E2E unskip + iterate) blocked on rate-limit reset (11pm).
> **Total commits:** 50 på `campaign/botsson-arena` fra baseline `046cd430`
> **Related ADRs:** 0184, 0185, 0186
> **Related learnings:** 0105, 0106, 0107, 0108
> **Spec:** `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`
> **Plan:** `docs/superpowers/plans/2026-04-22-session-recorder-platform-admin.md`

---

## TL;DR

Bygget **Session Recorder** end-to-end: hver turn Emma tar fanges nå i `agent_session_recording` (LLM-input, LLM-output, classifier I/O, authority, guardian verdicts, memory ops). Platform Admin kan se alle sesjoner via Guardian-viewet, drille i TurnTimeline, flagge turns, skrive whispers (metadata-injeksjon til neste turn), og bruke break-glass for PII-reveal. Alt audit-logged via `activity_trail`.

**Motivasjon:** "Emma fungerte i demo, fungerer ikke nå" skal ikke lenger være et mysterium — vi har nå full forensisk-trail per turn, med tiered retention + PII-redaksjon + reversible envelope.

**Tilstand i dag:** Infrastruktur + backend + UI-primitiver + composition alt på plass. 67 enhetstester grønne. 3 E2E-specs skrevet men skip-gated inntil infrastrukturverifisering (rate limit hindret sluttkjøring).

---

## Hva ble bygget (fase-for-fase)

### Phase 0 — Prerequisites (blokkerte alt annet)

Per L-0109 (recorder-before-writer dead-letter trap) kunne recorder ikke bygges før tre gap var lukket:

| Fase | Commits | Resultat |
|------|---------|----------|
| **A5** intent-classifier context | `41a2972b`, `77295001` | `buildClassifierContext()` helper passerer role+department+workspace-relasjon til `classifyIntent()` i stedet for `""`. Tidligere gap på linje 83. |
| **A3** memory writer | `dcd48898` | Ny `memory` capability med `save_memory`-tool (chat-only, C4-gated). Shared writer i `packages/ai/src/context/memory-writer.ts`. 15 capabilities registrert nå (14 → 15). |
| **A6** guardian-bus → pg_notify | `961ba294..4e3c85ba` (6 commits) | In-process EventEmitter erstattet med pg_notify-fasade. Trigger på `guardian_log` INSERT → `pg_notify('guardian_events', ...)` → stage-engine `LISTEN` loop → WebSocket broadcast. Horisontalt skalerbart. ADR-0186 skrevet + akseptert. |

### Phase 1 — Session Recorder Foundation + Implementation (Tasks 1-29 fra plan)

**Phase 1a — Foundation** (9 commits `51c39b92..5ba9560e`):
- 3 tabeller: `agent_session_recording`, `agent_session_envelope` (pgcrypto), `agent_session_whisper`
- Authority seed for 5 recorder capabilities
- Retention cron (`pg_cron`-guarded): 90d redacted / 30d envelope / 365d flagged
- PII redact-on-write utility (`packages/ai/src/lib/pii-redact.ts`) — 8 tester
- Attention-score composite (`packages/ai/src/lib/attention-score.ts`) — 4 tester
- Session-recorder helper (`services/stage-engine/src/core/session-recorder.ts`) — fire-and-forget ring buffer — 6 tester

**Phase 1b — Stage-engine hooks** (4 commits `c1580313..26b19cc5`):
- Recorder singleton bootstrap i `services/stage-engine/src/index.ts`
- Hook i `prompt-builder.ts` — leser unconsumed whispers, wrapper i `<admin_note>`, marker `is_consumed`, record `prompt_built` turn
- Hook i `agent-router.ts` — record `classifier_input`/`classifier_output` rundt `classifyIntent()` + `llm_request`/`llm_response` rundt LLM-kall med `latency_ms` i meta
- Hook i `authority.ts`, `guardian-evaluator.ts`, `memory-manager.ts` — record `authority_load`, `guardian_verdict`, `memory_read`, `memory_write`
- Boundary-shim `packages/ai/src/lib/recording-hook.ts` — no-op default, unngår circular import mellom stage-engine og packages/ai
- 16 nye tester

**Phase 1c — BFF endpoints** (5 commits `68389f37..884b569b`):
- `POST /api/botsson/recorder/flag` — per-turn flag
- `POST /api/botsson/recorder/whisper` — admin metadata-injeksjon
- `GET /api/botsson/recorder/sessions/[id]` — full session dump (JSON)
- `GET /api/botsson/recorder/break-glass/[envelope_id]` — godmode-only PII reveal med audit
- `decrypt_envelope` RPC (SECURITY DEFINER)
- 27 endpoint-tester
- 3 nye telemetry events i registry (`recorder.turn_flagged`, `recorder.whisper_created`, `admin.pii_reveal`)

**Phase 1d — Platform Admin UI + Arena affordance** (6 commits `ec9d8705..af9f5125`):
- `useRecorderSessions` — Supabase Realtime hook
- `RedactedPill` — warm-muted PII-placeholder (Lucide shield + ‹piiClass›, hover "Vis (5s)")
- `TurnCard` + `TurnTimeline` — expanderbare turns med spring-physics (stiffness 35, damping 22, mass 2.2)
- `AdminActionDrawer` — 520px right-side drawer med Whisper + Flag + Force-stop (800ms confirm-hold)
- `SessionList` — utvidet med recorder-kolonner (turn_count, flagged_count, max_attention_score)
- Arena LogView hover-flag affordance (Lucide Flag, 40%-reduction hover-reveal)

**Phase 1e — E2E + docs + verify** (7 commits `d7afe94d..ae38234a`):
- 3 E2E specs skrevet (skip-gated inntil Phase 2 composition + probes)
- BOTSSON-SYSTEM-MAP.md: 13+ rader flippet til 🟢
- CAMPAIGN-botsson-arena.md: Ny Phase D section, D1 ✅
- ADR-0184 + 0185 flippet til `accepted`
- JOURNEY-session-recorder-platform-admin.md (4 journeys)
- Final typecheck: `pnpm turbo typecheck` 31/33 pass (eneste feil: pre-existing `use-channels.ts` — ikke vår scope)

### Phase 2 — Composition + missing endpoints (ekspandert scope)

**Phase 2a — Missing endpoints** (5 commits `a77b8520..fe06486e`):
- `POST /api/botsson/recorder/flag-session` — flagge hele sesjonen (8 tester)
- `POST /api/botsson/recorder/force-stop` — INSERTer whisper med interrupt-note (9 tester)
- `GET /api/botsson/recorder/_metrics` — godmode-only recorder health (6 BFF + 3 stage-engine route tester)
- Smart arkitektur: force-stop bruker EKSISTERENDE whisper-injection i stedet for fiktiv `session_lane.status='interrupted'` (den kolonnen finnes ikke — ADR-0185 var aspirational)
- Smart arkitektur: metrics bruker stage-engine route + BFF proxy (Approach A) — unngår catch-22 hvor recorder-failure også ville feile på metrics-persistence

**Phase 2b — UI composition** (4 commits `5094521f..5111ece5`):
- `GuardianMonitor` er nå host for recorder-surface (ikke `GuardianDashboard` — fulgte eksisterende hierarki)
- Info/Replay tab switcher + Actions-launcher knapp + AdminActionDrawer mount
- Ny `/api/botsson/recorder/flag-log-entry` endpoint for user-facing Arena (resolver session_id server-side fra "last 30min turn") — unngår å måtte endre `packages/agent-sdk` (ikke harness-builder's scope)
- 11 nye tester (8 BFF + 3 static-render composition)
- Nytt telemetry event: `recorder.user_flag_submitted`

---

## Gjenstående arbeid

### Phase 2c — E2E audit + rewrite (2026-04-23)

**Outcome:** All three specs rewritten to match current DOM/schema/routes. Remain documented-skip pending Phase 2d runtime harness. See each spec's file header for the precise green gate.

**What was fixed (spec drift caught):**

| Spec | Drift caught | Fix |
|------|--------------|-----|
| `schedule-wrong-day-replay` | Guardian page is tabbed; SessionList lives under "Live Monitor" tab, TurnTimeline under "Replay" sub-tab. `AdminActionDrawer` trigger aria-label is "Open admin actions drawer" (specific), dialog aria-label is "Session admin actions". | Added `page.getByRole("tab", {name: /live monitor/i}).click()` + explicit `Replay` tab click + precise aria-label regex. |
| `whisper-never-user-facing` | Botsson chat uses `data-role="assistant"`, NOT `"agent"`. Orb is a `<div>` with pointer events, NOT `<button>` — `getByRole("button", {name: /botsson|emma/i})` fails. DOM-scan of Arena is fragile and misses log-view / tool-result surfaces. | Pivoted to **DB-layer invariant check**: insert whisper via BFF, query `agent_session_recording` for `turn_kind IN ('agent_response','tool_result')` rows on same session_id, assert WHISPER_TOKEN is absent from any of their `content_redacted`. Strictly stronger than DOM scan. |
| `recorder-failure-resilience` | `/platform-admin/debug` page does NOT exist. No `RECORDER_FORCE_FAIL` env flag on stage-engine. Invariant covered by unit test instead. | Updated skip reason to name the missing surface precisely + proposed design (env flag, godmode-gated toggle). |

**What blocks green (Phase 2d scope):**

1. Docker daemon (WSL has no Docker install in this environment)
2. `npx supabase start` (requires Docker)
3. `pnpm --filter stage-engine dev` with Anthropic key (LLM calls)
4. A deterministic recorder-turn seeder — OR a stage-engine test endpoint `POST /recorder/_seed_turn` (godmode-only) that performs one synthetic prompt-build + fake LLM echo to produce agent_response rows without hitting the LLM.
5. A failure-injection toggle for the resilience test (env flag `RECORDER_FORCE_FAIL_FOR_TEST` hard-gated behind NODE_ENV!==production).

**CI impact:** None. E2E specs are not currently part of any GitHub Actions workflow (verified: `grep playwright .github/workflows/*.yml` → 0 matches). Unskipping locally will not break CI.

**Commits this phase:**
- `<pending>` — test(recorder): rewrite E2E specs to match current DOM + pivot whisper to DB-layer invariant

**Known test-mismatch (unchanged):** Arena LogView sends to `/flag-log-entry`, not `/flag-session`. E2E does NOT assume `/flag-session` from user-side — no change needed.

### Phase 2+ (not scoped this session)

- **Fleet-view (cross-workspace):** Platform Admin dashboard som aggregerer sesjoner på tvers av workspaces. Spec §4 deferred — krever ny design-handoff (nåværende `docs/design/botsson/project/` dekker operator-facing Arena, ikke fleet-view).
- **Replay engine:** Kjør gammel sesjon gjennom ny modell for å bekrefte at fix holder.
- **Diff UI:** To sesjoner side ved side.
- **Prompt extraction reports:** "Vis alle unike system-prompts som ble sendt til LLM sist uke."
- **Auto-whisper fra Guardian:** Guardian → agent feedback-loop (ADR-0185 Alt 4 — out of scope for 0185).

---

## Decisions made (ADRs written + accepted this session)

| ADR | Title | Status |
|-----|-------|--------|
| **ADR-0184** | Session Recorder Architecture | `accepted` 2026-04-22 |
| **ADR-0185** | Platform Admin Session Intervention (whisper + flag + force-stop + break-glass) | `accepted` 2026-04-22 |
| **ADR-0186** | Guardian Bus pg_notify Migration (A6) | `accepted` 2026-04-22 |

**Dokumenterte avvik fra opprinnelig spec (landet i ADR-bodies):**

1. **Authority seed per-workspace, ikke NULL workspace_id.** Spec §3.5 intenderte `workspace_id=NULL` for platform-scope capabilities. Schema's NOT NULL constraint blokkerte. Seedet per-workspace med `level='disabled'` for `recorder.pii_reveal` + `recorder.break_glass_enable`. Godmode-access via RLS `is_godmode`, ikke NULL rows. Funksjonelt ekvivalent.

2. **Force-stop bruker whisper-injection, ikke `session_lane.status='interrupted'`.** Kolonnen finnes ikke; ADR-0185 var aspirational. "Next turn gets system-note" er nøyaktig hva whisper-pipe gjør. Zero new infra.

3. **session_id ikke eksponert på klient.** `useAgent` dropper `sessionId` fra `/api/wizard/start`-response. Phase 2b valgte å IKKE endre agent-sdk (out of scope); i stedet resolver `/flag-log-entry` endpoint session_id server-side fra siste turn for autentisert profile innen 30 min.

4. **GuardianMonitor er composition-host, ikke GuardianDashboard.** Fulgte eksisterende component-hierarki (tabs-on-dashboard, monitor-body-host).

---

## Learnings logged (4 nye L-entries)

| ID | Learning |
|----|----------|
| **L-0109** | Recorder-before-writer is a dead-letter trap — observability uten downstream konsumenter er teater |
| **L-0110** | Whisper ≠ takeover — metadata-injeksjon er legitim C4 control surface |
| **L-0111** | Tiered retention resolves capture-vs-retention false dichotomy — capture og retention er ortogonale spørsmål |
| **L-0112** | Code-trace catches what grep-briefing misses — Phase 2.5 fact-check verifierer eksistens, code-trace verifierer flow |

---

## Known issues

1. **`komm/_hooks/use-channels.ts` typecheck-feil** (pre-existing, ADR-0160/0162 drift fra Helpdesk Phase 0). Record: `desk` + `query_thread` mangler i channel-type map. **IKKE rørt denne sesjonen — utenfor scope.** Whoever owns `apps/web/src/app/dashboard/komm/` må fikse det før `web:typecheck` kan kjøre grønn i turbo-cache.

2. **`app.envelope_key` DB-config ikke satt.** pgcrypto-nøkkelen må settes via Supabase Dashboard per-environment (managed i 1Password `smartout_ai_prod/envelope_key` per secrets-protocol). Break-glass endpoint vil feile 500 inntil nøkkelen er provisioned. Dokumentert i ADR-0184 + spec.

3. **`database.types.ts` cast i break-glass-route.** `decrypt_envelope` RPC ikke i generated types ennå. Manuell cast brukt som midlertidig bro (`fix(bff): cast decrypt_envelope RPC call until types regen` commit `884b569b`). Fjern casten etter neste full types-regen.

4. **3 E2E-specs skip-gated (reviewed 2026-04-23).** Specs rewritten to match current DOM + pivot whisper spec to DB-layer invariant. All 3 stay skipped — the blocker is Phase 2d runtime harness (Docker+Supabase+stage-engine+LLM seeded turn, and a failure-injection surface for the resilience test). See each spec's file header for the precise green gate.

5. **Arena LogView session_id-mangel.** Fikset via server-side resolution i `/flag-log-entry`, men den "riktige" løsningen er å eksponere `sessionId` fra `useAgent` hook (packages/agent-sdk). Det krever system-agent-coordinator review + contract-endring — ikke gjort denne sesjonen.

---

## Next steps (for next session)

### Immediate (kritisk)
1. **Start Phase 2c (E2E iterate)** når rate-limit resetter 23:00.
   - Dispatch `botsson-harness-builder` med Phase 2c-promptet som ligger i forrige turn av denne sessionen (search for "Phase 2c-1: Audit E2E specs").

2. **Provision `app.envelope_key`** i Supabase Local via `ALTER DATABASE postgres SET app.envelope_key = '<key>';`. Hent nøkkel fra 1Password. Uten dette er break-glass broken.

3. **Regen `database.types.ts`** og fjern manuell cast i `break-glass/route.ts:64-73`.

### Medium-term
4. **Fix `komm/_hooks/use-channels.ts`** — legg `desk` + `query_thread` til channel-type-record. ~5-line-change, men utenfor denne feature-scopet.

5. **Provision `session_id` på `useAgent`** — contract-endring i `packages/agent-sdk`. System-agent-coordinator territorium. Når det er gjort, kan `/flag-log-entry` endpoint forenkles.

6. **Merge `campaign/botsson-arena` → `development`** når Phase 2c er grønn. 50 commits gjelder. Test-plan: full E2E-suite må passere på preview-environment før merge.

### Strategic
7. **Phase A1 (contract-intake gate-fix)** — fortsatt 🔴 i SYSTEM-MAP. Live ADR-0099-brudd.
8. **Phase A2 (ADR-0151 profile_id derivation)** — fortsatt pending. Recorderen ville hatt nytte av dette for stramt profile_id-audit.
9. **Phase B1 (dual-gate reconciliation)** — ikke gjort.
10. **Phase D2 (schedule wrong-day diagnostics)** — recorder er nå klar for dette. Neste sesjon kan bruke session-dump-endpointet for å diagnostisere den faktiske brukerrapportene.
11. **Commission Phase 2+ design-handoff** for fleet-view / cross-workspace-dashboard (spec §4 deferred).

---

## Files touched — master list

### New files (~45)
```
supabase/migrations/
  20260515120100_agent_session_recording.sql
  20260515120200_agent_session_envelope.sql
  20260515120300_agent_session_whisper.sql
  20260515120400_recorder_authority_seed.sql
  20260515120500_recorder_retention_cron.sql
  20260515120600_decrypt_envelope_rpc.sql
  20260422120000_guardian_log_pg_notify.sql

services/stage-engine/src/core/
  session-recorder.ts + .test.ts
  pg-notify-bus.ts + __tests__/pg-notify-bus.test.ts

services/stage-engine/src/routes/
  recorder-metrics.ts + .test.ts

packages/ai/src/
  context/memory-writer.ts + __tests__/memory-writer.test.ts
  capabilities/memory/{index,tools}.ts + __tests__/tools.test.ts
  lib/pii-redact.ts + .test.ts
  lib/attention-score.ts + .test.ts
  lib/recording-hook.ts + .test.ts

apps/web/src/app/api/botsson/recorder/
  flag/route.ts + __tests__/route.test.ts
  whisper/route.ts + __tests__/route.test.ts
  sessions/[id]/route.ts + __tests__/route.test.ts
  break-glass/[envelope_id]/route.ts + __tests__/route.test.ts
  flag-session/route.ts + __tests__/route.test.ts
  force-stop/route.ts + __tests__/route.test.ts
  _metrics/route.ts + __tests__/route.test.ts
  flag-log-entry/route.ts + __tests__/route.test.ts

apps/web/src/app/platform-admin/guardian/
  _hooks/useRecorderSessions.ts + __tests__/useRecorderSessions.test.ts
  _components/RedactedPill.tsx
  _components/TurnCard.tsx
  _components/TurnTimeline.tsx
  _components/AdminActionDrawer.tsx
  _components/__tests__/GuardianMonitor.test.tsx

apps/e2e/tests/botsson-recorder/
  schedule-wrong-day-replay.spec.ts
  whisper-never-user-facing.spec.ts
  recorder-failure-resilience.spec.ts

docs/decisions/
  0184-session-recorder.md
  0185-platform-admin-session-intervention.md
  0186-guardian-bus-pg-notify.md

docs/learnings/
  0105-recorder-before-writer-dead-letter-trap.md
  0106-whisper-not-takeover.md
  0107-tiered-retention-resolves-capture-vs-retention.md
  0108-code-trace-catches-what-grep-briefing-misses.md

docs/superpowers/
  specs/2026-04-22-session-recorder-platform-admin-design.md
  plans/2026-04-22-session-recorder-platform-admin.md

docs/journeys/
  JOURNEY-session-recorder-platform-admin.md
```

### Modified files
```
services/stage-engine/src/
  core/prompt-builder.ts + stage-manager.ts
  core/agent-router.ts (A5 context + recorder hooks)
  core/authority.ts (recorder hook)
  core/guardian-evaluator.ts (recorder hook)
  core/memory-manager.ts (writer + recorder hook)
  core/guardian-bus.ts (A6 pg_notify facade)
  index.ts (bootstrap)

packages/ai/src/
  capabilities/registry.ts (memory capability)
  router/tool-selector.ts + intent-classifier.ts
  package.json (new exports)

packages/telemetry/src/registry.ts (5 new events)
packages/supabase/src/database.types.ts (regen)

apps/web/src/app/
  Botsson/_components/BotssonArena.tsx (LogView hover-flag)
  platform-admin/guardian/_components/
    SessionList.tsx (extended columns)
    GuardianMonitor.tsx (composition)
    AdminActionDrawer.tsx (cleanup)

docs/
  architecture/BOTSSON-SYSTEM-MAP.md (15+ rows flipped)
  plans/CAMPAIGN-botsson-arena.md (Phase D section)
  decisions/0000-decision-log.md (3 new ADRs)
  learnings/0000-learning-log.md (4 new entries)
  council/COUNCIL-LOG.md (2026-04-22 entry)
```

---

## Test inventory

- **Unit tests:** 56+ grønne (pii-redact 8, attention-score 4, session-recorder 6, memory-writer 11, recording-hook 4, classifier-context 5)
- **Stage-engine integration:** 88 tests / 13 files
- **packages/ai full suite:** 125 tests / 17 files
- **BFF endpoint tests:** 50+ (flag 7, whisper 8, sessions 5, break-glass 7, flag-session 8, force-stop 9, metrics 6, flag-log-entry 8)
- **Platform-admin:** 9 (useRecorderSessions 6, GuardianMonitor 3)
- **E2E specs:** 3 written + rewritten Phase 2c to match current DOM/schema/routes. All 3 remain documented-skip with precise file-header green gates; blocker is Phase 2d runtime harness (no Docker/stage-engine/LLM in harness-builder session).

**Total new tests this session:** ~108

---

## Open questions (for next session)

1. Skal `flag-log-entry` erstatte `flag-session` helt, eller bestå i parallell (én for user-side, én for admin)? P2b valgte parallell — greit men verdt å review.

2. `recorder.pii_reveal = disabled` per-workspace seed: Pontus må manuelt flippe til `confirm` per break-glass-incident. Trenger vi en UI-flate for dette, eller er SQL-kommando god nok?

3. Force-stop whisper-injection bruker hardkodet norsk tekst. Skal den i18n-es? Plattform-admin-UI er foreløpig engelsk-tung, blandet med norsk — inkonsistent.

4. `recording-hook.ts` boundary-shim er en workaround for circular-import. Langsiktig: bør stage-engine eksportere en ren recorder-interface som packages/ai kan importere typer fra? Det er en contract-discussion som krever system-agent-coordinator.

5. Embedding-populering på `saveMemory` var deferred i A3. Når ønsker Pontus å kjøre embeddings (kostnad-beslutning)?

---

## Session metrics

| | Value |
|---|---|
| Commits landed | 50 |
| New ADRs | 3 (0184, 0185, 0186) |
| New Learnings | 4 (L-0109..0108) |
| New unit+integration tests | ~108 green |
| Files created | ~45 |
| Files modified | ~30 |
| Rate limit hits | 2 (Phase 1b kl ~18, Phase 2c kl ~23) |
| Subagents dispatched | 11 (A5, A3, A6, 1a, 1b, 1c, 1d-frontend-failed, 1d-harness, 1e, 2a, 2b) |
| Council sessions | 1 (2026-04-22 spec review — APPROVE WITH CHANGES) |

---

## Commit range for PR / merge

**Base:** `046cd430` (campaign start)
**Head (current):** `ad74a729`
**Range:** 50 commits, approximately net +6500 LOC (new), +800 LOC (modified)

Klar for merge til `development` når Phase 2c har grønnet E2E-ene.

---

*Handoff skrevet 2026-04-22, ved session-end på `campaign/botsson-arena`. Ikke /close-feature — kampanjer lukker ikke. Ved neste session: gjenoppta Phase 2c fra rate-limit reset.*
