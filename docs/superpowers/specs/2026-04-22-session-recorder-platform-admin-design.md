---
title: "Session Recorder + Platform Admin Intervention — Design Spec"
status: draft
updated: 2026-04-22
created: 2026-04-22
module: MODULE_BOTSSON
tags: [spec, botsson, stage-engine, session-recorder, platform-admin, guardian, observability]
---

# Session Recorder + Platform Admin Intervention

> **Council verdict (2026-04-22):** APPROVE WITH CHANGES.
> 2 ADRs: 0184 (Session Recorder) + 0185 (Platform Admin Intervention).
> Phase 0 prerequisite chain: A3 memory-writer + A5 intent-classifier context + A6 guardian-bus → Realtime MUST land first.
> Trust Gate FAIL as originally scoped; PASS gated on Phase 0.
> Phase 2 (cross-workspace fleet-view) deferred pending new design handoff.

> **Links:**
> - [`BOTSSON-SYSTEM-MAP.md`](../../architecture/BOTSSON-SYSTEM-MAP.md) — L1-L5 status. Updates when this lands.
> - [`CAMPAIGN-botsson-arena.md`](../../plans/CAMPAIGN-botsson-arena.md) — active campaign.
> - Council log: `docs/council/COUNCIL-LOG.md` 2026-04-22 entry.

---

## 1. Problem

Emma fungerte i demo, fungerer ikke nå. Regressions oppstår uten evidens. `agent_session_recording`-tabell finnes ikke — vi kan ikke rekonstruere en turn, kan ikke sammenligne "god kjøring" mot "dårlig kjøring", kan ikke bevise at en fix traff.

Platform Admin trenger **fleet-innsyn**: "alle sessions skal synes og håndteres derfra." Guardian-bus er i dag in-process `EventEmitter` uten cross-process lyttere (A6-gap), og agent-router passerer `context = ""` til intent-classifier (A5-gap). Så selv om vi bygger recorder nå, ville den fanget tomhet.

Eksisterende UI i `apps/web/src/app/platform-admin/guardian/_components/` (SessionList, SessionDetails, EventFeed, StageAnalysis, WhisperInput) dekker 80% av Platform Admin-flaten — vi **utvider**, bygger ikke nytt.

---

## 2. Non-Goals

- Ingen takeover (admin prater som Emma) — bryter "confident ≠ authorized"
- Ingen ny recorder-service — hooker inn i eksisterende stage-engine core
- Ingen replay-motor (kjør gammel sesjon gjennom ny modell) — fase 2
- Ingen diff-UI (to sesjoner side ved side) — fase 2
- Ingen cross-workspace fleet-dashboard — fase 2 (ny design-handoff kreves)
- Ingen nye capabilities registrert — recorder er infrastruktur, ikke capability
- Ingen Supabase Realtime-erstatning av eksisterende telemetry — FK-refs til `engine_event` og `activity_trail`, ingen unified emit

---

## 3. Architecture

### 3.1 Data model

**Ny tabell:** `public.agent_session_recording` (schema placement: `public` — tett koblet til `engine_state` + `activity_trail` + `engine_event` som lever i public).

```sql
CREATE TABLE public.agent_session_recording (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL,                              -- logical session identifier
  workspace_id         uuid NOT NULL REFERENCES workspace(id),
  profile_id           uuid REFERENCES profile(id),                -- null for pre-auth turns
  engine_state_id      uuid REFERENCES engine_state(id),           -- FK when mission-bound, nullable
  turn_index           int NOT NULL,                               -- 0-based per session
  turn_kind            text NOT NULL,                              -- 'user_input'|'agent_response'|'tool_call'|'tool_result'|'guardian_verdict'|'memory_read'|'memory_write'|'whisper'
  phase                text NOT NULL,                              -- 'classifier_input'|'classifier_output'|'authority_load'|'context_collect'|'prompt_built'|'llm_request'|'llm_response'|'tool_exec'|'guardian_eval'|'post_turn'
  content_redacted     jsonb NOT NULL,                             -- redacted-at-write payload (structured)
  content_envelope_id  uuid REFERENCES agent_session_envelope(id), -- break-glass reference for PII reveal
  meta                 jsonb NOT NULL DEFAULT '{}',                -- model, git_sha, latency_ms, pinned_date, etc.
  is_flagged           boolean NOT NULL DEFAULT false,
  flag_reason          text,
  flagged_by_profile_id uuid REFERENCES profile(id),
  attention_score      numeric(4,2),                               -- 0.00-1.00 composite
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON agent_session_recording (session_id, turn_index);
CREATE INDEX ON agent_session_recording (workspace_id, created_at DESC);
CREATE INDEX ON agent_session_recording (engine_state_id) WHERE engine_state_id IS NOT NULL;
CREATE INDEX ON agent_session_recording (is_flagged, created_at DESC) WHERE is_flagged = true;
CREATE INDEX ON agent_session_recording (attention_score DESC) WHERE attention_score > 0.7;
```

**Støttetabell:** `public.agent_session_envelope` — reversible redaction for platform-admin break-glass.

```sql
CREATE TABLE public.agent_session_envelope (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspace(id),
  encrypted_payload    bytea NOT NULL,                             -- pgcrypto symmetric encrypt
  pii_class            text NOT NULL,                              -- 'personnummer'|'bank'|'address'|'salary'|'medical'|'free_text'
  created_at           timestamptz NOT NULL DEFAULT now(),
  redact_after         timestamptz NOT NULL                        -- raw-payload TTL
);
CREATE INDEX ON agent_session_envelope (redact_after);
```

**Whisper tabell:** `public.agent_session_whisper` — admin-injected metadata for next-turn prompt.

```sql
CREATE TABLE public.agent_session_whisper (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid NOT NULL,
  workspace_id         uuid NOT NULL REFERENCES workspace(id),
  admin_profile_id     uuid NOT NULL REFERENCES profile(id),
  content              text NOT NULL,                              -- injected into next turn's <admin_note> block
  is_consumed          boolean NOT NULL DEFAULT false,
  consumed_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON agent_session_whisper (session_id, is_consumed) WHERE is_consumed = false;
```

**Retention policy (tiered):**

| Layer | Data | TTL |
|-------|------|-----|
| Metadata (session_id, workspace, turn_kind, phase, latency, verdict) | Permanent | — |
| Redacted content (`content_redacted`) | 90 days | `pg_cron` purge |
| Break-glass envelope (`encrypted_payload`) | 30 days | `redact_after` column |
| Raw flagged session | 1 year | retention-extended by flag |

### 3.2 Capture points (stage-engine core hooks)

Per code-trace from `system-agent-coordinator` Phase 3 review — 4 steps are invisible today. Recorder hooks into:

| File | Hook | Writes phase |
|------|------|--------------|
| `services/stage-engine/src/core/prompt-builder.ts` | Before return | `prompt_built` |
| `services/stage-engine/src/core/agent-router.ts` (line 83) | After `classifyIntent()` | `classifier_input`, `classifier_output` |
| `services/stage-engine/src/core/authority.ts` | After authority load | `authority_load` |
| `services/stage-engine/src/core/agent-router.ts` | Before/after LLM call via `adapters/vercel-ai.ts` | `llm_request`, `llm_response` |
| `services/stage-engine/src/core/guardian-evaluator.ts` | After verdict | `guardian_eval` |
| `services/stage-engine/src/core/memory-manager.ts` | Read + (Phase A3) write | `memory_read`, `memory_write` |

All hooks call a single helper:

```typescript
// services/stage-engine/src/core/session-recorder.ts
export async function recordTurn(opts: {
  sessionId: string;
  workspaceId: string;
  profileId?: string;
  engineStateId?: string;
  turnKind: TurnKind;
  phase: TurnPhase;
  content: unknown;       // validated Zod schema, then redacted before INSERT
  meta?: Record<string, unknown>;
}): Promise<void>
```

Fire-and-forget with in-memory ring buffer → async flush. Hard ceiling; drop-oldest on overflow; metric on drop-rate. Recorder failure **never** blocks Emma (Q8b).

### 3.3 Redaction pipeline

**Known-PII redact-on-write** (Q10b) — regex + allowlist classifier before INSERT:

| PII class | Pattern | Placement |
|-----------|---------|-----------|
| Personnummer | `\b\d{6}[-\s]?\d{5}\b` | `content_envelope_id` → envelope |
| Bank account | `\b\d{4}[.\s]?\d{2}[.\s]?\d{5}\b` | same |
| Email | RFC 5321 simplified | same |
| Phone (+47) | `\b(?:\+47|0047)?\s?\d{8}\b` | same |
| Address | Heuristic (street + number + postal) | same |
| Salary (NOK) | `\b\d{4,7}\s?(kr|NOK|,-)\b` | same |

**Render-time redact** (Q10c) — free-text LLM output renders as `<personnummer>`-style warm-muted pill per Frontend Designer spec:

```tsx
// apps/web/src/app/platform-admin/guardian/_components/RedactedPill.tsx
<span className="bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded-sm font-mono text-[0.85em]">
  <ShieldIcon className="inline h-2.5 w-2.5 mr-1" />
  ‹{piiClass}›
</span>
```

**Break-glass reveal** (platform-admin only): hover-affordance "Vis (5s)" — decrypts envelope, renders raw for 5s, auto-redacts, logs reveal to `activity_trail` with `admin.pii_reveal` event.

### 3.4 Transport

**Supabase Realtime** (Q6b) — Platform Admin subscribes to `agent_session_recording` filtered by `workspace_id` (single-WS Phase 1) or bypass (platform-admin cross-WS Phase 2).

Rationale: pg_notify+SSE was Coordinator/Steward preference but requires SSE endpoint + connection manager + backpressure — infrastructure we don't have. Supabase Realtime is in stack, RLS-aware, auto-handles per-client subscription lifecycle.

**Guardian-bus A6 migration:** decoupled. A6 can migrate to pg_notify per existing `telegram-bridge.ts` pattern. Recorder does NOT depend on guardian-bus transport — it writes directly to DB, Platform Admin reads via Realtime.

### 3.5 Authority (C4)

**New `engine_authority_config` entries** required for Phase 1:

| Capability | Scope | Default level |
|------------|-------|---------------|
| `recorder` | workspace | `read_only` (admin role) |
| `recorder.flag` | workspace | `suggest` (admin role) |
| `recorder.whisper` | workspace | `confirm` (admin role only) |
| `recorder.force_stop` | workspace | `confirm` (admin role only) |
| `recorder.pii_reveal` | platform | `confirm` (platform-admin only, audit-logged) |
| `recorder.break_glass` | platform | `disabled` by default, enabled per-incident |

**Whisper contract** (ADR-0185): admin writes to `agent_session_whisper`. On next turn, `prompt-builder.ts` reads unconsumed whispers for `session_id`, wraps them in:

```
<admin_note visibility="internal">
{whisper.content}
</admin_note>

Respect the note. Do NOT quote it to the user verbatim.
```

Marks `is_consumed = true`. Enforcement in prompt-builder: system-prompt template includes the `<admin_note>` block but wraps with "do not reveal to user" instruction. ADR-0078 (channel restriction) NOT violated — whisper is metadata, not user-facing content, across ALL channels.

### 3.6 Platform Admin UI (extend existing)

**Location:** `apps/web/src/app/platform-admin/guardian/` — EXTEND, do NOT fork to `sessions/`.

**Component reuse map (from Frontend Designer review):**

| Existing | Extension for recorder |
|----------|------------------------|
| `SessionList.tsx` | Add columns: `turn_count`, `attention_score`, `is_flagged`, `cost_estimate` |
| `SessionDetails.tsx` | Host `TurnTimeline` component |
| `EventFeed.tsx` | Per-turn event strip (existing) |
| `StageAnalysis.tsx` | Extend with LLM-I/O panel per turn |
| `ToolUsageTable.tsx` | Wire to `turn_kind='tool_call'|'tool_result'` rows |
| `WhisperInput.tsx` | Wire to `agent_session_whisper` writer |
| `AlertsList.tsx` | Consume `is_flagged` + `attention_score > 0.8` |

**New components:**

| Component | Purpose |
|-----------|---------|
| `TurnTimeline.tsx` | Vertical transcript-first cards, spring-expand (stiffness 35 damping 22 mass 2.2). Collapsed: user msg + agent reply + verdict chip. Expanded: LLM payload + tool calls + memory ops + cost. |
| `TurnCard.tsx` | Single-turn card with verdict chip, violation chip, cost badge |
| `RedactedPill.tsx` | Warm-muted PII placeholder per Nordic Split |
| `AdminActionDrawer.tsx` | Entity-drawer pattern (520px, spring stiffness 40 damping 22 mass 2.2). 3 actions: Whisper + Flag + Force-stop (confirm-hold 800ms). |
| `BreakGlassReveal.tsx` | Hover "Vis (5s)" affordance, auto-redact, audit emit |

**Attention score** (Q7d composite):

```
attention_score = w1·guardian_block_count
                + w2·guardian_warn_count
                + w3·retry_loop_detected
                + w4·latency_anomaly
                + w5·pii_leak_flagged
                + w6·manual_flag
```

Weights in `packages/ai/src/lib/attention-score.ts`, tunable per workspace.

### 3.7 Bug-report workflow (Q13)

**Arena Log-view hover-affordance** (not a button — Nordic Split 40% reduction). Each log row gets:

```tsx
<button
  className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
  onClick={() => flagSessionTurn(turnId)}
  aria-label="Flag til Platform Admin"
>
  <FlagIcon className="h-3.5 w-3.5 text-muted-foreground" />
</button>
```

Clicking → inline confirm ("Send til Platform Admin?") → spring-collapse on action. No modal, no toast.

Frontend sends `{ session_id, turn_id, reason }` to `POST /api/botsson/recorder/flag`. BFF writes `is_flagged=true`, `flag_reason`, `flagged_by_profile_id`. Extends retention automatically.

---

## 4. Phase Plan

### Phase 0 (blocking prerequisites — NOT in this spec)

These MUST land before Phase 1 implementation:

- **A3 memory-writer** — `services/stage-engine/src/core/memory-manager.ts` writer path. Recorded sessions feed embeddings here.
- **A5 intent-classifier context** — agent-router.ts:83 must pass role/department/relationship, not `""`. Else recorder captures empty string and masks real bug.
- **A6 guardian-bus migration** — in-process EventEmitter → pg_notify (not required for recorder itself, but required for cross-process guardian consumers). Can use `telegram-bridge.ts` pattern.

**CI gate:** recorder deploy blocked until `pnpm turbo typecheck` confirms all three ship. Check in `.github/workflows/` or pre-deploy script.

### Phase 1 (this spec's scope)

1. Migration: `agent_session_recording` + `agent_session_envelope` + `agent_session_whisper`
2. `services/stage-engine/src/core/session-recorder.ts` (helper + ring buffer)
3. Hooks into 4 stage-engine core files (prompt-builder, agent-router, authority, guardian-evaluator)
4. Redaction pipeline (`packages/ai/src/lib/pii-redact.ts`)
5. Attention-score calculator (`packages/ai/src/lib/attention-score.ts`)
6. BFF endpoints:
   - `POST /api/botsson/recorder/flag`
   - `POST /api/botsson/recorder/whisper`
   - `GET /api/botsson/recorder/sessions/:id` (JSON dump for debug)
7. Platform Admin UI extensions (columns + TurnTimeline + AdminActionDrawer + RedactedPill)
8. Supabase Realtime subscription wiring in `useGuardianSocket.ts`
9. Arena LogView hover-flag affordance (`BotssonArena.tsx` LogView region line ~2140+)
10. Authority seed migration (`engine_authority_config` rows for `recorder.*`)
11. `pg_cron` purge jobs for tiered retention
12. Update `BOTSSON-SYSTEM-MAP.md` — `agent_session_recording` 🔴 → 🟢, session-recorder component 🔴 → 🟢
13. E2E test: schedule-wrong-day bug replay (acceptance test Q17)

### Phase 2 (deferred)

- Cross-workspace fleet view (aggregated dashboard, violation-rate charts)
- Session diff view (two recordings side-by-side)
- Replay engine (rerun old session through new model)
- Prompt extraction reports

**Blocker:** new design handoff commission — current handoff (`docs/design/botsson/project/Botsson Arena.html`) does NOT cover cross-workspace fleet view.

---

## 5. The 17 Answers (final)

| Q | Answer | Rationale |
|---|--------|-----------|
| 1 | **c (whisper)** | Read + flag + comment + whisper + force-stop. Whisper = `<admin_note>` prompt injection, never user-facing. Takeover rejected. |
| 2 | **d (tiered)** | Metadata permanent, redacted 90d, envelope 30d, flagged 1y. |
| 3 | **c (full LLM I/O)** | Diagnosis requires full payload. Retention tiered per Q10. |
| 4 | **b (migration separated)** | Guardian-bus A6 migration decoupled from recorder transport. |
| 5 | **c (aggregate + drill)** | Phase 1 single-WS; Phase 2 fleet. |
| 6 | **b (Supabase Realtime)** | Infra already in stack. pg_notify+SSE overkill without manager. |
| 7 | **d (composite attention-score)** | Guardian verdicts + heuristics + manual flag. |
| 8 | **b (ring buffer + retry)** | Recorder never blocks Emma. Drop-oldest on overflow. |
| 9 | **a+d (WS session + FK)** | `recorder_session` + `engine_state_id` FK nullable. |
| 10 | **b + c + reversible envelope** | Layered: redact-on-write + render-redact + break-glass. |
| 11 | **b (FK refs)** | No unified emit. FK to `engine_event`, `activity_trail`, `engine_state`. |
| 12 | **EXTEND `guardian/`** | 80% component reuse. Fork fragments mental model. |
| 13 | **b (hover-flag affordance)** | Not a button. Hover-revealed Lucide Flag icon. |
| 14 | **2 ADRs** | 0184 Recorder + 0185 Platform Admin Intervention. Bus migration = A6, no new ADR. |
| 15 | **Phase 0 prereq** | A3 + A5 + A6 land first; recorder is Phase 1. |
| 16 | Stage-engine writes | L2 write path, service-role to recorder tables. |
| 17 | Schedule wrong-day replay | Acceptance test below. |

---

## 6. Acceptance Tests

### 6.1 Schedule wrong-day bug replay (Q17)

**Given:** Bruker rapporterer "Emma la til vakt på feil dag" tirsdag 2026-04-22.
**When:** Platform Admin åpner Guardian → filtrerer workspace + dato + `schedule.shift_created` tool.
**Then:**
1. `SessionList` viser én session matchende filter innen 2s.
2. Klikk → `SessionDetails` → `TurnTimeline` viser chronological turns.
3. Admin ser per turn: (a) raw user message, (b) classifier output (`{intent: "schedule", confidence: 0.87}`), (c) selected tools, (d) system prompt hash, (e) `<admin_note>` whispers (om noen), (f) LLM response, (g) tool call with args, (h) tool result, (i) Guardian verdict.
4. `pinned_date` i meta bekrefter hvilken "i dag" Emma trodde det var.
5. Admin flagger turn → `is_flagged=true`, retention forlenget.
6. Admin skriver whisper: "Bruker mente tirsdag 29. april, ikke 22."
7. Neste turn i sesjonen viser `<admin_note>` i system-prompt logged.

### 6.2 PII break-glass

**Given:** Session recording inneholder personnummer i LLM-respons.
**When:** Admin hover "Vis (5s)" på `<personnummer>`-pille.
**Then:**
1. Envelope dekrypteres, raw verdi rendres i 5s.
2. Auto-redact etter 5s.
3. `activity_trail` får `admin.pii_reveal` event med `admin_profile_id`, `envelope_id`, `duration_ms=5000`.

### 6.3 Reproducibility

**Given:** Samme session replay-ed 2×.
**When:** Samme input, samme model, samme git_sha.
**Then:** Output identisk (modulo LLM temperature jitter i toleranseband).

### 6.4 Recorder-failure resilience

**Given:** DB connection drops mid-turn.
**When:** `recordTurn()` kalles.
**Then:**
1. Helper fanger exception, logger til pino.
2. Drop-rate metric øker.
3. Emma's turn fullfører normalt — bruker ser ingen feil.

---

## 7. Risks + Mitigation

| Risiko | Alvor | Mitigation |
|--------|-------|------------|
| Redact-on-write misser PII-former | CVE-class | Render-redact som andre lag + kvartalsvis regex-audit + break-glass audit-logging |
| Supabase Realtime kapasitet (1000 events/min/workspace) | Medium | Ring buffer + async flush. Downgrade til polling hvis over limit. |
| A6 guardian-bus slipper — blokkerer recorder | High | ADRs kan merge selvstendig. Implementation CI-gated. |
| PII-envelope krypto-nøkkel mismanaged | CVE-class | 1Password-managed, rotates 90d, `pgcrypto` symmetric, no plaintext fallback |
| Phase 2 fleet-view design slipper | Low | Phase 1 leverer verdi standalone (single-WS bug-triage) |
| Whisper misbrukes (admin "chatter" gjennom Emma) | Medium | Whisper content NOT user-facing per ADR-0185. Auditable via `agent_session_whisper` table. Pontus reviews. |
| Agent Trust Gate: Phase 0 ikke ferdig → recorder logger tomhet | High | CI gate blocks deploy. Implementation PR sequenced after A3+A5+A6 merged. |

---

## 8. Dependencies

**Blocks this spec:**
- A3 (`PLAN-engine-memory-writer.md`) — memory-writer
- A5 (intent-classifier context fix — small PR per campaign A5)
- A6 (`PLAN-botsson-observability-foundation.md`) — guardian-bus Realtime migration

**This spec blocks:**
- Phase 2 fleet-view (design commission)
- Schedule capability diagnostics (D2) — recorder is the debug surface
- Future replay engine / diff UI

---

## 9. ADRs (to write)

- **ADR-0184** Session Recorder Architecture — schema, hook points, transport (Realtime), retention tiers, PII envelope
- **ADR-0185** Platform Admin Session Intervention — whisper semantics, force-stop contract, break-glass pattern, C4 authority surface

---

## 10. Files

### Create
```
supabase/migrations/YYYYMMDDHHMMSS_agent_session_recording.sql
supabase/migrations/YYYYMMDDHHMMSS_agent_session_envelope.sql
supabase/migrations/YYYYMMDDHHMMSS_agent_session_whisper.sql
supabase/migrations/YYYYMMDDHHMMSS_recorder_authority_seed.sql
supabase/migrations/YYYYMMDDHHMMSS_recorder_retention_cron.sql
services/stage-engine/src/core/session-recorder.ts
packages/ai/src/lib/pii-redact.ts
packages/ai/src/lib/attention-score.ts
apps/web/src/app/api/botsson/recorder/flag/route.ts
apps/web/src/app/api/botsson/recorder/whisper/route.ts
apps/web/src/app/api/botsson/recorder/sessions/[id]/route.ts
apps/web/src/app/platform-admin/guardian/_components/TurnTimeline.tsx
apps/web/src/app/platform-admin/guardian/_components/TurnCard.tsx
apps/web/src/app/platform-admin/guardian/_components/RedactedPill.tsx
apps/web/src/app/platform-admin/guardian/_components/AdminActionDrawer.tsx
apps/web/src/app/platform-admin/guardian/_components/BreakGlassReveal.tsx
apps/web/src/app/platform-admin/guardian/_hooks/useRecorderSessions.ts
docs/decisions/0184-session-recorder.md
docs/decisions/0185-platform-admin-session-intervention.md
docs/journeys/JOURNEY-session-recorder-platform-admin.md
```

### Modify
```
services/stage-engine/src/core/prompt-builder.ts         (add whisper read + recorder hook)
services/stage-engine/src/core/agent-router.ts           (recorder hooks around classifier + LLM)
services/stage-engine/src/core/authority.ts              (recorder hook after authority load)
services/stage-engine/src/core/guardian-evaluator.ts     (recorder hook after verdict)
services/stage-engine/src/core/memory-manager.ts         (recorder hook on read+write — after A3)
apps/web/src/app/platform-admin/guardian/_components/SessionList.tsx
apps/web/src/app/platform-admin/guardian/_components/SessionDetails.tsx
apps/web/src/app/platform-admin/guardian/_components/StageAnalysis.tsx
apps/web/src/app/platform-admin/guardian/_components/AlertsList.tsx
apps/web/src/app/platform-admin/guardian/_components/WhisperInput.tsx
apps/web/src/app/platform-admin/guardian/_hooks/useGuardianSocket.ts
apps/web/src/app/Botsson/_components/BotssonArena.tsx   (LogView hover-flag affordance)
docs/architecture/BOTSSON-SYSTEM-MAP.md                  (status updates)
docs/plans/CAMPAIGN-botsson-arena.md                     (Phase 0 + D1 binding)
docs/decisions/0000-decision-log.md                      (register 0184, 0185)
docs/learnings/0000-learning-log.md                      (register L-0105..0108)
```

---

## 11. Journeys (write at close-feature)

- **Admin triages buggy session** — åpne Guardian, filter, drill, flag, whisper, resolve
- **Platform Admin break-glass PII reveal** — hover, confirm, 5s window, audit-trail
- **Developer replays schedule bug** — dump session JSON, diff mot good-run, identifies TZ issue
- **User flagger fra Arena Log-view** — hover, click, inline confirm, session marked

---

## 12. Open Questions (resolved in council, noted for plan)

1. ~~Redacted rendering style?~~ → Warm-muted pill with Lucide shield icon (Frontend Designer).
2. ~~pg_notify vs Supabase Realtime?~~ → Realtime (existing infra).
3. ~~Metadata vs full LLM?~~ → Full, with tiered retention.
4. ~~ADR count?~~ → 2 (Recorder + Intervention).
5. ~~Whisper — what exactly?~~ → `<admin_note>` injection into next-turn system prompt, never rendered to user, honored by prompt-builder enforcement.

---

## 13. Spec Self-Review

- [x] No placeholders / TBD remaining
- [x] Internal consistency verified (capture points match hook table; redaction classes match PII spec)
- [x] Scope bounded to Phase 1 (Phase 2 explicitly deferred)
- [x] Every requirement has acceptance criteria
- [x] Migration timestamps: use strictly greater than repo tip at implementation time (per L-0042)
- [x] Database conventions: workspace_id, created_at, updated_at, UUID PK — all present
- [x] RLS: JWT policy + API key policy needed for each new table
- [x] No secrets in spec (PII envelope keys via 1Password, referenced by name not value)

---

**Klar for writing-plans. Pontus — vennligst review og bekreft før vi går til implementation plan.**
