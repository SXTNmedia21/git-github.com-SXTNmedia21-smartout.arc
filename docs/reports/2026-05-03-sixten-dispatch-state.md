---
title: "Sixten + Dispatch — Full state report"
status: report
updated: 2026-05-03
created: 2026-05-03
module: botsson-harness
tags: [sixten, agent-dispatch, stage-engine, heartbeat, persona, claude-cli]
---

# Sixten + Dispatch — Full Rapport (2026-05-03)

## 1. Hva det ER

Sixten = developer-rettet persona-agent. Wakes ved at en mission-folder (`docs/journeys/<slug>/`) sendes til en HTTP-endpoint i stage-engine. Endpoint spawner `claude` CLI som subprocess med agent-fil + mission-prompt, venter på terminal-signal, returnerer output.

**Fjernkontrollen** = `POST /agent/dispatch` (Hono, port 5010). Pluss en pasiv polling-loop (`sixten-orchestrator`) som plukker opp pulse-events fra `engine_event` og kjører 5 helsesjekker.

## 2. Hva er BYGD (Phase 0 + 0d + 0d.1)

| Komponent | Sti | Status |
|---|---|---|
| `POST /agent/dispatch` Hono route | `services/stage-engine/src/routes/agent/dispatch.ts` (264 linjer) | ✅ |
| Mission folder reader (4 files: MISSION/LICENSE/FLOW/RESCUE-PROMPT) | samme fil | ✅ |
| Claude CLI subprocess invoker (`spawn`, 300s timeout) | samme fil | ✅ |
| Sixten persona definition | `.claude/agents/sixten.md` (302 linjer, model: opus, color: amber, heartbeat_coupled: true) | ✅ |
| Smoke-test mission | `docs/journeys/dev-sixten-hello/` (MISSION/LICENSE/FLOW/RESCUE/OUTPUT/ir) | ✅ |
| Mission-pool worker integrasjon | `services/stage-engine/src/workers/mission-pool-slot.ts` (`dispatchToSixten`) | ✅ |
| `heartbeat_pickup` RPC (atomic SELECT FOR UPDATE SKIP LOCKED + UPDATE + pg_notify) | migration `20260520110050` | ✅ |
| `heartbeat-dispatcher` cron-trigger (Edge Function) | `supabase/functions/heartbeat-dispatcher/` + migration `20260520110100` (pg_cron registration, skipped on Local) | ✅ |
| `sixten-orchestrator` polling worker (Phase 0d.1) | `services/stage-engine/src/workers/sixten-orchestrator.ts` | ✅ |
| 5 helsesjekker | `services/stage-engine/src/workers/sixten-checks.ts` | ✅ |
| ADR-0246/0247/0248 (state-vs-sessions ontology, schema relax, B5 emit producer) | `docs/decisions/` | ✅ accepted |
| ADR-0255 (Sixten dispatch design) | `docs/decisions/0255-sixten-stage-engine-integration.md` | ⚠️ **status: proposed** |

## 3. Hva er IKKE bygd

| Komponent | Hvor den nevnes | Status |
|---|---|---|
| `wake-sixten.sh` CLI-script | ADR-0255 + dispatch.ts kommentar | ❌ **filen finnes ikke** i tree (verken `~/.claude/scripts` eller `scripts/`) |
| `engine_state.persona` kolonne | ADR-0255 Phase 1 | ❌ migration ikke skrevet — kolonne mangler i DB |
| Heartbeat-native dispatch (engine_state-row + persona) | ADR-0255 Phase 1 | ❌ |
| Anthropic SDK direct (eliminere CLI dep) | dispatch.ts kommentar (Phase 1) | ❌ |
| Andre personaer enn `sixten` | `REGISTERED_PERSONAS` const = `["sixten"]` | ❌ kun sixten |

## 4. Hvordan den kalles (i dag)

**Manual HTTP-trigger:**

```bash
curl -X POST http://localhost:5010/agent/dispatch \
  -H 'Content-Type: application/json' \
  -d '{"persona":"sixten","missionPath":"docs/journeys/dev-sixten-hello"}'
```

Stage-engine:

1. Validerer `persona ∈ {"sixten"}` + `missionPath` non-empty (zod)
2. Leser 4 markdown-filer fra mission-folder (parallel `readFile`)
3. Bygger startup-prompt (concat alle 4 filer + terminal-signal-instruks)
4. Spawner `claude --agent .claude/agents/sixten.md --print "<prompt>"` med `cwd: REPO_ROOT`
5. Kapter stdout/stderr, killer ved 300s timeout
6. Returnerer `{ ok, persona, missionPath, missionComplete, missionBlocked, exitCode, durationMs, outputPreview (2000 char) }`

**Auto-trigger pipe (Phase 0d):**

Heartbeat → pulse webhook → emit `sixten.pulse_received` engine_event → `sixten-orchestrator` polling-loop plukker opp → kjører 5 helsesjekker → emitter `sixten.check_result` / `sixten.nudge` / `sixten.escalation` per status. **Ikke en wake av sixten-personaen** — heller en automatisk overvåkning som bruker sixten-vokabular.

## 5. Mission folder kontrakt

4 påkrevde filer per mission:

| Fil | Innhold |
|---|---|
| `MISSION.md` | Frontmatter (mission_id, persona, phase) + stages med konkrete steg |
| `LICENSE.md` | Authority-grenser: `Allowed:` / `Denied:` listes — Sixten må respektere |
| `FLOW.md` | Sekvens-diagram av stages |
| `RESCUE-PROMPT.md` | Hva Sixten gjør hvis han sitter fast |
| `OUTPUT.md` | (skrivbar) — der Sixten legger output |
| `ir/journey.yaml` | Mission ID, capability, persona, phase, stages-array |

## 6. Terminal-signaler

Sixten må avslutte med ÉN av:

- `SIXTEN_MISSION_COMPLETE: <mission_id>` → `missionComplete: true` i response
- `SIXTEN_MISSION_BLOCKED: <reason>` → `missionBlocked: true`, `ok: false`

Stage-engine grep-er stdout etter disse strengene. Hvis ingen → `missionComplete: false` men `ok` følger exitCode.

## 7. Audit & telemetri

Dispatch-route logger via `baseLogger`. **Ingen `engine_event`-row skrives i Phase 0** (eksplisitt — kommentar: "Phase 0 Sixten is a manual-trigger persona. engine_state integration is Phase 1+").

`sixten-orchestrator` skriver fire event-typer:

- `sixten.pulse_processing_claimed` (idempotency-row)
- `sixten.check_result` (per-check)
- `sixten.nudge` (warn-status)
- `sixten.escalation` (breach-status, non-D6)

Idempotency via `idempotency_key` på `engine_event` med `ON CONFLICT DO NOTHING`.

## 8. Authority/guardrails

**Eneste mekanisme:** `LICENSE.md` legges inn i startup-prompten. Sixten BES respektere "Denied"-listen. Ingen runtime-enforcement — Sixten er ærens-system. Hvis han bryter `Denied`, blir det fanget post-hoc i git-diff eller telemetry, ikke prevented.

**Ingen capability gate.** `routeAgentMessage` (chat-pipeline) brukes IKKE — dispatch er rå CLI subprocess. Authority-config og frozen-4 capability-grenser gjelder ikke.

**Ingen workspace-RLS.** Subprocess kjører som userrettighetene som starter stage-engine — vanligvis service-role i development. Sixten kan i teorien skrive hvor som helst i repoet hvis han ignorerer LICENSE.md.

## 9. Observability — hva du faktisk ser

Når du curler:

- HTTP response = JSON med outputPreview (første 2000 char av stdout)
- Stage-engine log = `[agent-dispatch] dispatch request received` + `[agent-dispatch] dispatch complete`
- Stderr capture (warn-loggret hvis non-empty)
- ALL tekst Sixten genererer = stdout (capturet helt, men kun preview returneres)

**Ingen live streaming.** Subprocess venter i 300s eller til Sixten skriver terminal-signal. For "lange baner" — du venter på CURL-response. Ingen progress-updates.

## 10. Implikasjoner for admin-agent-harness

Sixten dispatch er **ikke** mønsteret for Erik-rettet agent. Forskjellene:

| Sixten dispatch | Erik / Botsson chat |
|---|---|
| One-shot subprocess, 300s timeout | Multi-turn, sesjons-basert |
| Mission-folder-drevet (4 filer) | Page-context + user-message |
| Ingen capability tools | Capability gate + tool registry |
| Ingen end-user UI | BotssonShell + Orb |
| LICENSE.md = honor system | Authority config + RLS |
| Returnerer outputPreview (string) | Streaming chat-response + tool-calls |
| Ingen workspace_id | Workspace OR cross-tenant accountant context |

**For apps/admin = Botsson-chat-mønster (ADR-0255 nevner ikke admin-portal). Phase 1+2A i `PLAN-admin-agent-harness.md` står — sixten dispatch er ortogonal infrastruktur.**

## 11. Quick wins du kan trigge nå

```bash
# Smoke-test sixten via dispatch
curl -X POST http://localhost:5010/agent/dispatch \
  -H 'Content-Type: application/json' \
  -d '{"persona":"sixten","missionPath":"docs/journeys/dev-sixten-hello"}'
```

Forutsetter:

- Stage-engine kjører på 5010
- `claude` CLI tilgjengelig på PATH inne i container ELLER `CLAUDE_CLI_PATH` satt
- `REPO_ROOT` mountet for å lese mission-folder

## 12. Spørsmål som ikke er besvart

1. ADR-0255 fortsatt `proposed`. Phase 0d.1 er bygd uten council-godkjenning av designet. Bør promoteres til `accepted` eller council kjøres.
2. `wake-sixten.sh` er referert i kode-kommentarer + ADR men finnes ikke. Enten slettet eller aldri skrevet. Trenger avklaring.
3. Heartbeat-native dispatch (engine_state-row med persona) er Phase 1 — ingen migration ennå. Manual HTTP-trigger er eneste vei.
4. Sixten-only registrert. Andre agenter (harness-builder, docs-tutor) er nevnt som extension-point men ingen kode legger til i `REGISTERED_PERSONAS`.
5. Multi-tenant — Sixten kjører som service-role globalt. Hvis andre tenants får sixten-missions, hvordan isoleres data?

## 13. Referanser

- ADR-0246 — engine_state vs engine_sessions ontology (accepted)
- ADR-0247 — engine_state schema relaxation (accepted)
- ADR-0248 — B5 action handlers canonical emit producer (accepted)
- ADR-0255 — Sixten Stage Engine Integration (proposed) — `docs/decisions/0255-sixten-stage-engine-integration.md`
- `services/stage-engine/src/routes/agent/dispatch.ts` — dispatch HTTP route
- `services/stage-engine/src/workers/mission-pool-slot.ts` — auto-dispatch fra heartbeat
- `services/stage-engine/src/workers/sixten-orchestrator.ts` — Phase 0d.1 polling worker
- `services/stage-engine/src/workers/sixten-checks.ts` — 5 helsesjekker
- `.claude/agents/sixten.md` — persona definition
- `docs/journeys/dev-sixten-hello/` — smoke-test mission folder
- migration `20260520110050_heartbeat_pickup_rpc.sql` — atomic pickup RPC
- migration `20260520110100_heartbeat_dispatcher_cron.sql` — pg_cron registration
- `supabase/functions/heartbeat-dispatcher/` — cron-trigger Edge Function
- `PLAN-admin-agent-harness.md` — admin-portal Botsson-mønster (ortogonal til sixten)
