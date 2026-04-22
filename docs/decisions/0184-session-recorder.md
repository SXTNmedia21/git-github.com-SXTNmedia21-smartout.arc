---
id: ADR-0184
title: "Session Recorder Architecture"
status: accepted
date: 2026-04-22
accepted: 2026-04-22
module: MODULE_BOTSSON
tags: [adr, botsson, stage-engine, observability, recorder, guardian]
supersedes: null
amends: null
---

# ADR-0184 — Session Recorder Architecture

## Status
**Accepted** — 2026-04-22. Phase 0 prereq chain (A3 memory-writer + A5 intent-classifier-context + A6 guardian-bus pg_notify) all landed on 2026-04-22 — recorder implementation followed same day in Phase D1.

### Accepted scope (delivered)
- 3 tabeller (`agent_session_recording`, `agent_session_envelope`, `agent_session_whisper`) + pgcrypto envelope + cron TTL (90d redacted / 30d envelope / 365d flagged)
- Hooks in 5 stage-engine core modules (prompt-builder, agent-router, authority, guardian-evaluator, memory-manager)
- `services/stage-engine/src/core/session-recorder.ts` — fire-and-forget ring buffer
- 4 BFF endpoints: `flag`, `whisper`, `sessions/[id]`, `break-glass/[envelope_id]` (+ `decrypt_envelope` RPC)
- PII redact-on-write + audit-logged reversible envelope
- Platform Admin UI primitives (`useRecorderSessions`, `SessionList`-overlay, `TurnTimeline`, `TurnCard`, `RedactedPill`, `AdminActionDrawer`)
- Arena LogView hover-flag affordance (ADR-0184 Q13)
- 3 E2E acceptance-tester (TDD-pending-infra; skip-gated until Phase 2 composition)

### Implementation divergences (documented, non-blocking)
1. **Authority seed per-workspace, not NULL workspace_id.** Spec §3.5 intended platform-scope `workspace_id=NULL` rows for `recorder.pii_reveal` + `recorder.break_glass_enable`. Schema's NOT NULL constraint on `engine_authority_config.workspace_id` blocked this — we seeded per-workspace rows with `level='disabled'` instead. Platform-admin godmode-access is handled via RLS `is_godmode` predicate, not NULL authority rows. Functionally equivalent; cleaner separation (authority config = permission matrix; RLS = identity gate).
2. **Phase 2 endpoints pending.** `/api/botsson/recorder/flag-session`, `/force-stop`, and `/_metrics` are referenced by AdminActionDrawer + Arena LogView but not yet implemented. Drawer + LogView handle 404 gracefully with alert-fallback.
3. **UI composition pending.** `TurnTimeline` + `AdminActionDrawer` + `RedactedPill` components are built but not composed into `GuardianDashboard`. Phase 2 follow-up. `SessionList`-overlay is fully wired.

## Context

Emma har ingen måte å rekonstruere en turn på. Regressions skjer uten evidens. `agent_session_recording`-tabell finnes ikke. Platform Admin Guardian-view viser live sessions via `useGuardianSocket` (in-process `EventEmitter`), men historiske sesjoner er borte når WebSocket-en lukkes.

Code-trace (council Phase 3) bekreftet at 4 steg i stage-engine er usynlige i dag:
- `services/stage-engine/src/core/agent-router.ts:83` — intent-classifier I/O (context = `""`)
- `services/stage-engine/src/core/authority.ts` — authority load
- `services/stage-engine/src/core/prompt-builder.ts` — built prompt
- `services/stage-engine/src/core/agent-router.ts` — LLM request/response

Uten capture kan vi ikke diagnostisere "Emma fungerte i demo, fungerer ikke nå". Ingen sammenligning mellom sesjoner, ingen replay, ingen evidens for fixes.

Platform Admin trenger "fleet-innsyn" — user requirement: "alle sessions skal synes i Platform Admin og håndteres derfra."

## Decision

Vi bygger en **Session Recorder** som:

1. **Skriver én rad per turn** til ny tabell `agent_session_recording` (JSONB `content_redacted` + `meta`).
2. **Hooker inn i eksisterende stage-engine core** på 4 steg — capture classifier I/O, authority, prompt, LLM, tool, guardian, memory.
3. **Tiered retention:**
   - Metadata (session, turn, verdict, latency) → permanent
   - Redacted content → 90 dager
   - Raw envelope (break-glass) → 30 dager, kryptert via pgcrypto
   - Flagged sessions → 1 år
4. **PII redaction:** Regex-based redact-on-write for kjente klasser (personnummer, bank, email, phone, address, salary). Raw verdi lagres i separat `agent_session_envelope`-tabell med `redact_after` TTL.
5. **Transport:** Supabase Realtime (allerede i stack, RLS-aware) — ikke pg_notify+SSE.
6. **FK-kobling:** `engine_state_id` (nullable) til `engine_state` når mission-bound; `workspace_id` alltid. Ingen unified emit — recorder er sink som JOIN-er, ikke duplikator.
7. **Fire-and-forget:** ring buffer + async flush. Recorder-feil blokkerer aldri Emma. Drop-oldest på overflow + metric på drop-rate.
8. **Attention-score:** Composite av guardian verdicts + latency anomaly + retry loop + PII flag + manual flag. Stored per turn. Index for `attention_score > 0.7`.

### Schema (abbreviated)

```sql
CREATE TABLE public.agent_session_recording (
  id uuid PK,
  session_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES workspace(id),
  profile_id uuid REFERENCES profile(id),
  engine_state_id uuid REFERENCES engine_state(id),  -- nullable, FK when mission-bound
  turn_index int NOT NULL,
  turn_kind text NOT NULL,       -- user_input|agent_response|tool_call|tool_result|guardian_verdict|memory_read|memory_write|whisper
  phase text NOT NULL,           -- classifier_input|classifier_output|authority_load|context_collect|prompt_built|llm_request|llm_response|tool_exec|guardian_eval|post_turn
  content_redacted jsonb NOT NULL,
  content_envelope_id uuid REFERENCES agent_session_envelope(id),
  meta jsonb NOT NULL DEFAULT '{}',
  is_flagged boolean NOT NULL DEFAULT false,
  attention_score numeric(4,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Full schema + authority seed i spec `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md` §3.1.

### RLS

| Policy | Read | Write |
|--------|------|-------|
| JWT (admin) | `workspace_id IN (get_workspace_ids_for_user(auth.uid())) AND is_admin_in_workspace()` | ❌ (stage-engine writes via service-role) |
| Platform Admin | cross-WS via `is_godmode` | ❌ |
| Service role (stage-engine) | bypass | INSERT only via `session-recorder.ts` helper |

## Alternatives Considered

### Alt 1 — Utvide `activity_trail`
**Rejected.** `activity_trail` er mutation-audit (ADR-0152 fail-fast contract). Recorder er agent-behavior observability. Different domain. ADR-0116 forbyr et andre event-system, men FK-kobling gir oss join-verdien uten domeneblanding.

### Alt 2 — Filbasert JSONL til S3/Storage
**Rejected.** Ikke query-spørbart. Vi vil "vis alle sesjoner siste uke hvor Emma valgte feil dag" — krever SQL.

### Alt 3 — pg_notify+SSE (council initial pref)
**Rejected.** Ingen SSE-manager i stacken, krever backpressure-håndtering vi ikke har. Supabase Realtime gir det gratis.

### Alt 4 — Metadata only, ingen LLM-payload
**Rejected.** Uten LLM I/O kan admin ikke diagnostisere "hvorfor valgte Emma dette svaret". Metadata alene viser *at* feil skjedde, ikke *hvorfor*. Tiered retention løser kost/PII-problemet.

### Alt 5 — Ingen separat envelope-tabell, redact-only
**Rejected.** Uten break-glass kan admin ikke verifisere "var dette virkelig personnummeret brukeren oppga?". Envelope med TTL + audit-logging er kompromisset.

## Consequences

### Positive
- Regressions synlige via sammenligning av sesjoner
- Platform Admin kan diagnostisere live
- Replay blir mulig (fase 2)
- Schedule wrong-day bug (D2) får debug-surface
- CI-gate mulig: "ingen nye feil observert i recorder siste 24h"

### Negative
- DB-størrelse øker merkbart (estimat: 100 aktive sessions × 10 turns × 10 KB = ~10 MB/min/workspace peak). Mitigation: tiered retention + ring buffer.
- PII-ansvar flyttes til recorder. Redact-on-write + envelope TTL + audit — må overvåkes.
- Rekorder-feil kan skjule seg bak fire-and-forget. Mitigation: drop-rate metric med alarm.

### Dependencies (load-bearing)
- **ADR-0116** (auto-emit telemetry) — recorder FK-refererer `engine_event.id` / `activity_trail.id`, ikke duplikator.
- **ADR-0078** (channel restriction) — recorder fanger PII, men redact-on-write + envelope beskytter.
- **ADR-0099** (unified gate action) — recorder-skriv er stage-engine-intern, bruker ikke gate_action.
- **ADR-0042** (agent architecture) — recorder er infrastruktur, ikke capability. Ingen registry-entry.
- **Phase 0 (A3 + A5 + A6)** — recorder som logger tomhet er verre enn ingen recorder. Implementation PR blokkert på disse.

## Trust Gate

Per Phase 5 steward synthesis: **FAIL as originally scoped**, **PASS gated on Phase 0**. ADR kan aksepteres nå; implementation PR blokkert til A3 + A5 + A6 lander.

## References
- Spec: `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`
- Related: ADR-0185 (Platform Admin Session Intervention)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22 entry
- Learnings: L-0105 (recorder-before-writer dead-letter), L-0107 (tiered retention), L-0108 (grep vs code-trace)
- System map: `docs/architecture/BOTSSON-SYSTEM-MAP.md` (D1 row flips 🔴 → 🟢 on landing)
