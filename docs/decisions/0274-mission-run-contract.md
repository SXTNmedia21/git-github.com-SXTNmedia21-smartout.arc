---
title: "Mission Run Contract — per-step durability, lease + idempotency, recovery-protokoll, frozen snapshot"
id: ADR_0274
status: proposed
layer: decision
created: 2026-05-04
updated: 2026-05-04
depends_on:
  - ADR-0099 (unified authority gate)
  - ADR-0151 (server-side profile_id derivation)
  - ADR-0184 (session recorder)
  - ADR-0246 (engine_state vs engine_sessions ontology)
---

# ADR-0274: Mission Run Contract — Per-step Durability, Lease + Idempotency, Recovery-protokoll, Frozen Snapshot

## Context and Problem Statement

Stage Engine kjører `engine_sessions` i mission-mode (`mode='mission'`). I dag er det kun én cursor: `engine_sessions.current_stage_id`. Denne cursoren skiller ikke mellom "stage ferdig" og "stage krasjet midt-i" — begge ser like ut i DB etter et worker-krasj.

Konsekvensene per STAGE-ENGINE.md §6:

1. **Ingen per-stage durability:** `current_stage_id`-cursor kan ikke skille "stage ferdig" fra "stage krasjet". Etter kill -9 vet ingen worker om forrige stage var complete eller halvveis.
2. **Ingen lease + idempotency:** To workers kan claim samme stage-advance hvis SessionLane krasjer mellom prosesser. In-memory SessionLane fungerer single-instance; breaker ved multi-instance.
3. **Emit ikke i samme TX som mutation:** `emit()` er fire-and-forget etter DB-write. En orphan write (DB OK, emit krasjer) er mulig.
4. **Authority-snapshot ikke frosset ved spawn:** Authority-config kan endres mellom stage 1 og stage 4 i en pågående mission — stage 4 kan kjøre med annen authority enn stage 1 ble spawnet med.

Welcome Mission V0 trenger alle fire gap lukket for å være durable.

Merk: Design-dokumentet `WELCOME_MISSION_V0.md` refererer til dette som ADR-0270. Nummeret er bumped til 0274 fordi 0270 ble tatt av ADR-0270 (Business Intelligence capability godmode) etter design-skriving.

## Decision Drivers

- Welcome mission er 10-minutters arc med 4 stages — full restart ved krasj er ikke akseptabel UX
- Crash-recovery krever at ny worker kan plukke opp midt-i-stage uten å doble writes
- Authority-snapshot-freeze er CVE-class sikkerhets-krav (authority kan ikke eskaleres mellom stages)
- Agent_inquiry (cross-session open threads) er eneste tillatte cross-session-state-kanal

## Considered Options

1. **Option A** — Kun in-memory SessionLane (eksisterende) — ingen per-stage durability
2. **Option B** — `engine_session_step`-tabell med lease + idempotency + frozen snapshot (dette ADR)
3. **Option C** — Bruk `engine_state_step`-tabellen (eksisterende) for session-steps

## Decision Outcome

Chosen option: **"Option B"** — ny `engine_session_step`-tabell som parallel til `engine_state_step` (ADR-0246 sessions-gren vs state-gren). `engine_state_step` tilhører `engine_state`/cascade-gren; `engine_session_step` tilhører `engine_sessions`/agent-gren. Navn-paritet er bevisst for å synliggjøre skillet.

ADR-0274 (dette ADR) bundler inn frozen-snapshot-beslutningen fra design-dokumentets "ADR-0274 optional" — scope er liten nok.

### Forhold til ADR-0246 (B8-fix per PLAN-welcome-mission-rework)

ADR-0274 utvider ADR-0246's `engine_state` vs `engine_sessions` split ved å introdusere `engine_session_step` som per-stage durability-tabell for sessions-grenen. Dette er konsistent med ADR-0246's mandat om at conversation-state er separat fra cascade-state — `engine_state_step` er for `engine_state` (cascade journey-engine), `engine_session_step` er for `engine_sessions` (interactive mission-mode). Parallel-naming er bevisst for å gjøre skillet synlig i schema-listen. Phase A0+A1 av ADR-0246 (additive `engine_state.kind` enum) er upåvirket av denne ADR-en. ADR-0274 supersederer ikke ADR-0246 — den extender det.

## Teknisk beslutning

### `engine_session_step` — lease-protokoll

```
1. Worker claim: UPDATE step SET status='running', worker_id=$w, lease_expires_at=now()+30s, attempts+=1
2. Worker renewal: UPDATE step SET lease_expires_at=now()+30s hvert 10s
3. Krasj (kill -9): lease expires etter 30s uten renewal
4. Recovery: ny worker finner rad via idx_engine_session_step_lease_expired
             (WHERE status='running' AND lease_expires_at < now())
5. Re-claim: setter nytt worker_id + ny lease — idempotency_key beholdes
6. Idempotency: alle writes inni step-body bruker idempotency_key til unique-constraint
```

### `agent_inquiry` — eneste cross-session-state-kanal

- Open inquiries fra mission-stages bæres til neste mission via `agent_inquiry`-tabellen
- TTL-purge aldri (ulikt `engine_memory` som har `cleanExpiredMemories` worker)
- Status: `open → closed | superseded`

### Frozen authority-snapshot

- Ved spawn: hent `engine_authority_config` for workspace → sett i `engine_sessions.context.authority_snapshot`
- Channel pinnes ved spawn: `engine_sessions.context.channel_pinned_at`
- Mission kan ikke transition til høyere authority enn spawn-snapshot tillater
- Implementert via JSONB-felt på `engine_sessions.context` (ikke ny kolonne)

**H8-clarification (per PLAN-welcome-mission-rework):** Snapshot er audit-historisk; runtime authority-decision re-resolver alltid via `gate_action()` RPC ved action-tidspunkt. Snapshot konsulteres ALDRI for å gi authorisasjon — den er read-only audit-evidence i `engine_sessions.context.authority_snapshot` for å vise hva som var gjeldende ved spawn. Dette closer ADR-0099 conflict-konsernet (Steward Phase 3 — REVERSED i Phase 5 etter clarifikasjon).

### Resume-semantikk (§10.8 i design)

```
IF (now - session.updated_at) < WELCOME_MISSION_RESUME_WINDOW_HOURS:
  RESUME — re-mount session_id, last engine_session_step resumes via lease+idempotency_key

ELSE (over cutoff):
  RESTART — abandon forrige session, migrate open agent_inquiry-rader,
  åpne inquiries injiseres i system_prompt-context for kontinuitet
```

Default cutoff: 24h. Konfigurerbar via `WELCOME_MISSION_RESUME_WINDOW_HOURS` env-var (1Password vault).

### Recovery-sekvens (kill -9 scenario)

```
T+0   Worker A claim stage 2 (session_id=X, stage_idx=2)
T+5s  Worker A krasjer (kill -9)
T+35s Lease expires (30s default lease_duration_ms)
T+36s Worker B finner raden via idx_engine_session_step_lease_expired
T+37s Worker B re-claimer: same idempotency_key, ny worker_id, ny lease
T+38s Worker B fullfører stage 2 — agent_inquiry INSERT dedup via idempotency_key
T+39s CAS på engine_sessions: advance til stage 3
```

### Hard fail-modes (§5 i design)

Mission completes med `status='abandoned'` og emitter `welcome_mission.abandoned` med `last_stage` og `reason` ved:
- Bruker forlater chat før stage 1 ferdig
- Channel-feil > 30s uten recovery
- Stage 1 går > 5 min uten respons fra bruker

`agent_inquiry`-rader for missionen markeres `priority=high` ved abandon-dropout.

## Schema-endringer

Se `IMPLEMENTATION_SPEC_welcome_mission_v0.md` M3 + M4 for full SQL.

Tabeller:
- `engine_session_step` (ny) — lease + idempotency per stage-forsøk
- `agent_inquiry` (ny) — cross-session open threads

Kolonner på eksisterende tabeller (JSONB-felt, ikke nye kolonner):
- `engine_sessions.context.authority_snapshot`
- `engine_sessions.context.channel_pinned_at`
- `engine_sessions.context.mission_system_prompt`

## Rules & Consequences

- **Good, because** crash-recovery er durable og testbar — T4 i spec verifiserer uten live kill -9
- **Good, because** idempotency_key forhindrer double-writes ved re-kjøring
- **Good, because** frozen authority-snapshot eliminerer privilege-escalation mellom stages
- **Bad, because** ny tabell øker migrasjons-kompleksitet
- **Bad, because** lease-renewal krever at alle workers kjører renewal-loop (ny kode i MissionPoolSlot)
- **Agent Impact:** MissionPoolSlot i `services/stage-engine/src/workers/mission-pool-slot.ts` må implementere lease-renewal + recovery-poll. Se impl-spec §4 trinn 6.4.

## Implementation notes

- Standard lease: 30s. Renewal: hvert 10s. Konfigurerbar via `SESSION_STEP_LEASE_MS` env-var.
- `max_attempts` default 3. Over max → `status='failed'`, emit `welcome stage_failed` (space-form per L-0046).
- `evaluateOutcomes(sessionId)` er single helper kalt fra stage-manager **POST-CAS** (per B10-fix; spec OQ-2 oppdatert til å matche) + guardian-evaluator (periodic). Failure-mode: hook throw etter CAS-success → outcome eval missed → guardian-evaluator catch på neste 120s tick (secondary safety-net).

## Migration strategy

M3 (`engine_session_step`) + M4 (`agent_inquiry`) er additive. Kan rulles uten downtime. Ingen eksisterende data endres.

---

> Etter skriving: registrer i `docs/decisions/0000-decision-log.md`
