---
title: "Welcome Mission V0 — Implementerings-spec"
id: IMPL_SPEC_WELCOME_MISSION_V0
version: "1.0"
status: draft
layer: implementation-spec
created: 2026-05-04
updated: 2026-05-04
author: botsson-harness-builder
derived_from: WELCOME_MISSION_V0.md (v0.4)
depends_on:
  - ADR-0274 (Mission Run Contract)
  - ADR-0271 (Multi-criteria Exit Criteria)
  - ADR-0272 (Mission Template Registry)
  - ADR-0273 (Two-Brain emit-pattern)
---

# Welcome Mission V0 — Implementerings-spec

Derivert fra `WELCOME_MISSION_V0.md` v0.4. Pontus er design-eier. Botsson eier spec-derivasjonen.
ADR-0271/0272/0273/0274 må være `accepted` før migrasjoner landes.

**Nummeringsnotat:** Design-doc refererer til ADR-0270–0274. ADR-0270 er tatt av Business Intelligence
capability (godmode scraping). Mission Run Contract er ADR-0274; de andre beholder 0271/0272/0273.

---

## 1. Migrasjoner

Timestamp-prefix: `20260525` (neste ledige etter `20260524000000`). Alle er additive; ingen downtime.

### Dependency-rekkefølge

```
ADR-0274 accepted → M3 (engine_session_step) + M4 (agent_inquiry)
ADR-0271 accepted → M2 (stage-kolonner)
ADR-0272 accepted → M1 (base_instruction) → M6 (seed)
ADR-0273 accepted → M5 (engine_audit_outbox)
M1 + M2 landed + template.test.ts grønt → M6 (seed)
M3 + M4 landed → M7 (authority backfill)
```

### M1 — `engine_missions.base_instruction`

**Fil:** `supabase/migrations/20260525100000_engine_missions_base_instruction.sql`

```sql
ALTER TABLE public.engine_missions
  ADD COLUMN IF NOT EXISTS base_instruction TEXT NULL;

COMMENT ON COLUMN public.engine_missions.base_instruction IS
  'Mission-level prompt-frame injisert FØR stage personality_override.
   packages/ai/src/missions/welcome/template.ts er source-of-truth (ADR-0272).';
```

### M2 — `engine_stages` nye kolonner

**Fil:** `supabase/migrations/20260525100100_engine_stages_mission_columns.sql`

```sql
ALTER TABLE public.engine_stages
  ADD COLUMN IF NOT EXISTS tool_allowlist TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER NULL
    CHECK (target_duration_seconds IS NULL OR target_duration_seconds > 0),
  ADD COLUMN IF NOT EXISTS exit_criteria_jsonb JSONB NULL;

COMMENT ON COLUMN public.engine_stages.tool_allowlist IS
  'Strict tool-allowlist. Tom array = ingen restriksjon (bakover-kompatibel). ADR-0271.';
COMMENT ON COLUMN public.engine_stages.target_duration_seconds IS
  'Soft tids-mål (sekunder). Guardian bruker som nudge-hint. ADR-0271.';
COMMENT ON COLUMN public.engine_stages.exit_criteria_jsonb IS
  'Strukturerte exit-kriterier any_of-disjunktiv. Overstyrer success_criteria TEXT. ADR-0271.
   Shape: {"any_of":[{"type":"time","seconds":N},{"type":"event","name":"X"}]}';

CREATE INDEX IF NOT EXISTS idx_engine_stages_exit_criteria
  ON public.engine_stages (mission_id)
  WHERE exit_criteria_jsonb IS NOT NULL;
```

### M3 — `engine_session_step` (ny tabell)

**Fil:** `supabase/migrations/20260525100200_engine_session_step.sql`

Durable per-stage state med lease-protokoll + idempotency. Parallell til `engine_state_step` (ADR-0246-skille).

```sql
CREATE TABLE IF NOT EXISTS public.engine_session_step (
  session_id        UUID    NOT NULL REFERENCES public.engine_sessions(id) ON DELETE CASCADE,
  stage_idx         INTEGER NOT NULL CHECK (stage_idx >= 0),
  PRIMARY KEY (session_id, stage_idx),

  stage_id          TEXT    NOT NULL,

  status            TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped')),

  -- Lease (ADR-0274): worker_id + lease_expires_at. Kill -9 → lease expired etter 30s.
  worker_id         TEXT    NULL,
  lease_expires_at  TIMESTAMPTZ NULL,
  lease_duration_ms INTEGER NOT NULL DEFAULT 30000 CHECK (lease_duration_ms > 0),

  -- Idempotency (ADR-0274): propageres til writes inni step-body
  idempotency_key   UUID    NOT NULL DEFAULT gen_random_uuid(),

  attempts          INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts      INTEGER NOT NULL DEFAULT 3  CHECK (max_attempts > 0),

  output            JSONB   NULL,
  last_error        TEXT    NULL,

  started_at        TIMESTAMPTZ NULL,
  completed_at      TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_terminal_has_timestamp
    CHECK ((status NOT IN ('completed','failed','skipped')) OR (completed_at IS NOT NULL)),
  CONSTRAINT chk_running_has_lease
    CHECK (status != 'running' OR (worker_id IS NOT NULL AND lease_expires_at IS NOT NULL))
);

COMMENT ON TABLE public.engine_session_step IS
  'Per-stage durable state for mission-sessions. ADR-0274.
   Parallell-naming med engine_state_step (ADR-0246 sessions-gren vs state-gren).';

CREATE INDEX IF NOT EXISTS idx_engine_session_step_lease_expired
  ON public.engine_session_step (lease_expires_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_engine_session_step_session
  ON public.engine_session_step (session_id, stage_idx)
  WHERE status IN ('pending','running');

CREATE OR REPLACE FUNCTION public.set_engine_session_step_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_engine_session_step_updated_at
  BEFORE UPDATE ON public.engine_session_step
  FOR EACH ROW EXECUTE FUNCTION public.set_engine_session_step_updated_at();

ALTER TABLE public.engine_session_step ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_engine_session_step" ON public.engine_session_step
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.engine_sessions es
      WHERE es.workspace_id IN (
        SELECT p.workspace_id FROM public.profile p WHERE p.user_id = auth.uid()
      )
      AND (
        es.profile_id IN (SELECT p2.profile_id FROM public.profile p2 WHERE p2.user_id = auth.uid())
        OR public.is_admin_in_workspace(auth.uid(), es.workspace_id)
      )
    )
  );

CREATE POLICY "service_role_all_engine_session_step" ON public.engine_session_step
  FOR ALL USING (auth.role() = 'service_role');
```

### M4 — `agent_inquiry` (ny tabell)

**Fil:** `supabase/migrations/20260525100300_agent_inquiry.sql`

Open inquiries som bæres på tvers av missions. Ingen TTL (ulikt engine_memory).

```sql
CREATE TABLE IF NOT EXISTS public.agent_inquiry (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  profile_id           UUID        NOT NULL REFERENCES public.profile(profile_id) ON DELETE CASCADE,

  source_mission_id    TEXT        REFERENCES public.engine_missions(id) ON DELETE SET NULL,
  source_stage_id      TEXT        NULL,
  source_session_id    UUID        REFERENCES public.engine_sessions(id) ON DELETE SET NULL,

  inquiry_type         TEXT        NOT NULL,
  CONSTRAINT chk_inquiry_type_non_empty CHECK (length(trim(inquiry_type)) > 0),
  -- Welcome mission-typer: 'name' | 'vision' | 'startpoint' | 'demonstrated' | 'general'

  notes                TEXT        NULL,

  status               TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','closed','superseded')),
  priority             TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),

  closed_by_session_id UUID        REFERENCES public.engine_sessions(id) ON DELETE SET NULL,
  closed_at            TIMESTAMPTZ NULL,

  CONSTRAINT chk_closed_has_timestamp
    CHECK (status = 'open' OR closed_at IS NOT NULL),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_inquiry IS
  'Open inquiries fra missions. Ingen TTL — purges aldri automatisk. ADR-0274.';

CREATE INDEX IF NOT EXISTS idx_agent_inquiry_open
  ON public.agent_inquiry (profile_id, priority DESC, created_at) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_agent_inquiry_workspace_status
  ON public.agent_inquiry (workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_inquiry_source_session
  ON public.agent_inquiry (source_session_id) WHERE source_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_agent_inquiry_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_agent_inquiry_updated_at
  BEFORE UPDATE ON public.agent_inquiry
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_inquiry_updated_at();

ALTER TABLE public.agent_inquiry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_agent_inquiry" ON public.agent_inquiry
  FOR SELECT USING (
    profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
    OR (
      workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
      AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

CREATE POLICY "service_role_all_agent_inquiry" ON public.agent_inquiry
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "api_key_rw_agent_inquiry" ON public.agent_inquiry
  FOR ALL USING (workspace_id = public.get_api_workspace_id());
```

### M5 — `engine_audit_outbox` (ny tabell)

**Fil:** `supabase/migrations/20260525100400_engine_audit_outbox.sql`

Audit-side outbox. `engine_event` er **forbudt** i destinations (ADR-0273 two-brain).

```sql
CREATE TABLE IF NOT EXISTS public.engine_audit_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  UUID NOT NULL UNIQUE,

  session_id       UUID REFERENCES public.engine_sessions(id) ON DELETE SET NULL,
  stage_idx        INTEGER NULL,
  workspace_id     UUID REFERENCES public.workspace(workspace_id) ON DELETE SET NULL,

  destinations     TEXT[] NOT NULL CHECK (cardinality(destinations) > 0),
  -- Gyldige: 'activity_trail' | 'posthog' | 'logger'
  -- FORBUDT: 'engine_event' — engine_event skrives sync i TX (ADR-0273)

  payload          JSONB  NOT NULL,
  event_name       TEXT   NOT NULL,

  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','flushing','flushed','failed')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 5,
  last_error       TEXT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  flushed_at       TIMESTAMPTZ NULL,

  CONSTRAINT chk_flushed_has_timestamp
    CHECK (status != 'flushed' OR flushed_at IS NOT NULL)
);

COMMENT ON TABLE public.engine_audit_outbox IS
  'ADR-0273 audit-side outbox. Fanout til activity_trail + PostHog + logger.
   engine_event er FORBUDT — skrives i SAMME TX som mutation for sync cascade-trigger.';

CREATE INDEX IF NOT EXISTS idx_audit_outbox_pending
  ON public.engine_audit_outbox (created_at) WHERE status = 'pending';

ALTER TABLE public.engine_audit_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_audit_outbox" ON public.engine_audit_outbox
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "godmode_read_audit_outbox" ON public.engine_audit_outbox
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profile p WHERE p.user_id = auth.uid() AND p.is_godmode = true)
  );
```

### M6 — Seed `welcome_mission_v1`

**Fil:** `supabase/migrations/20260525100500_seed_welcome_mission_v1.sql`

Idempotent (ON CONFLICT DO NOTHING). Innhold MÅ matche `packages/ai/src/missions/welcome/template.ts`
ord-for-ord (ADR-0272). Template.test.ts (T0) verifiserer parity.

Migrasjon INSERT:
1. `engine_missions` — id=`welcome_mission_v1`, mode=`sequential`, workspace_id=NULL (global), is_active=true, base_instruction=`<§4.1-tekst>`
2. `engine_stages` × 4 — alle felter per §4.2–4.5 inkl. exit_criteria_jsonb, tool_allowlist, personality_override

**Merk:** Dollar-quoting (`$P1$...$P1$`) for personality_override og base_instruction for å unngå quote-escaping. Se WELCOME_MISSION_V0.md §4 for eksakt tekst-innhold.

### M7 — Authority-backfill (CVE-class fix)

**Fil:** `supabase/migrations/20260525100600_welcome_mission_authority_backfill.sql`

Backfill for alle eksisterende workspaces som mangler rad i `engine_authority_config`:
- `inquiry`: level=`autonomous` (lav-risiko, profile-scoped notater)
- `mission`: level=`confirm` (medium-risiko, switcher session-kontekst)

Per ADR-0274 §7 — adresserer kanaler-som-helpdesk council 2026-04-19 side-finding.

---

## 2. Kode-endringer

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `packages/ai/src/capabilities/inquiry/tools.ts` | `note_inquiry`. ADR-0078 chat-only. gate_action FØR INSERT. emit("inquiry.noted"). workspace_id scope. |
| `packages/ai/src/capabilities/inquiry/index.ts` | `inquiryCapability`. allowedChannels=["chat"]. defaultAuthority="autonomous". emitPrefix="inquiry". |
| `packages/ai/src/missions/welcome/template.ts` | TypeScript source-of-truth. Eksporterer `welcomeMissionV1`, `WELCOME_STAGES`, `WELCOME_MISSION_BASE_INSTRUCTION`. Typed `WelcomeStageId`, `ExitCriteria`. |
| `packages/ai/src/missions/welcome/template.test.ts` | Paritets-sjekk. 7 assertions. Pure (ingen DB). |
| `apps/web/src/app/api/botsson/session/init/route.ts` | BFF spawn-trigger. ADR-0151 server-derive profile_id. Resume-window check via `WELCOME_MISSION_RESUME_WINDOW_HOURS`. 3 actions: skip / resume / spawned. |
| `services/stage-engine/src/workers/audit-outbox-flusher.ts` | Polles hvert 5s. Fanout audit_outbox→activity_trail+PostHog+logger. Kan defer til Phase A. |

### Eksisterende filer — endringer

| Fil | Endring |
|-----|---------|
| `packages/ai/src/capabilities/registry.ts` | Legg til `inquiry: inquiryCapability` + import |
| `packages/ai/src/capabilities/types.ts` | Legg til `"inquiry"` i CapabilityName union |
| `packages/ai/src/router/intent-classifier.ts` | Legg til `"inquiry"` i z.enum() |
| `packages/ai/src/router/tool-selector.ts` | Ny `applyToolAllowlist(tools, allowlist)`. Legg til opsjonell `stageContext?: { tool_allowlist?: string[] }` i `selectTools`. |
| `packages/ai/src/capabilities/mission/tools.ts` | Ny `transition_to_other_mission` tool. Muterer engine_sessions. gate_action + emit required. |
| `packages/ai/src/capabilities/ui/tools.ts` | Nye tools: `point_at_setting` (wrapper for highlight) + `show_demo` (ny broadcast-event). |
| `services/stage-engine/src/core/prompt-builder.ts` | Ny `buildStagePromptWithMissionFrame(stage, ctx, collected, missionBaseInstruction?, sessionId, supabase)`. Kaller eksisterende whisper-injeksjon internt. |
| `services/stage-engine/src/core/stage-manager.ts` | Ny `shouldAdvanceStage(stage, session, elapsedSeconds, recentEvents): boolean` (pure function). Ny `evaluateOutcomes(sessionId, supabase): Promise<void>`. Kall evaluateOutcomes post-CAS i advanceStage. |
| `services/stage-engine/src/core/guardian-evaluator.ts` | I evaluateSession(): kall `evaluateOutcomes(sessionId, supabaseAdmin)` som secondary safety-net (fire-and-forget catch). |
| `services/stage-engine/src/core/session-manager.ts` | I createSession(): frozen authority-snapshot + base_instruction henting + channel-pin i context JSONB. |
| `services/stage-engine/src/types/session.ts` | `Stage` type: legg til `tool_allowlist?: string[]`, `target_duration_seconds?: number`, `exit_criteria_jsonb?: ExitCriteria`. |

---

## 3. Tester

### T0 — Unit: template paritets-sjekk (bygg-tid gate)

**Fil:** `packages/ai/src/missions/welcome/template.test.ts`

7 assertions. Pure. Ingen DB. Kjøres i CI ved `pnpm turbo typecheck`.

| Assert |
|--------|
| Mission ID = 'welcome_mission_v1' |
| 4 stages i korrekt rekkefølge (velkommen → vis_det_smarte → hor → knytt_og_avrund) |
| Stage 1 tool_allowlist = ['transition_to_other_mission', 'note_inquiry'] |
| Stage 3 tool_allowlist = ['note_inquiry', 'transition_to_other_mission'] |
| Stage 4 next_stage = null |
| base_instruction inneholder ikke "Først må vi", "sjekkliste", "For at vi skal fortsette" |
| Alle stages har exit_criteria med any_of ≥ 2 elementer |

### T1 — Unit: exit-criteria evaluator

**Fil:** `packages/ai/src/missions/welcome/__tests__/exit-criteria.test.ts`

Pure function test av `shouldAdvanceStage`. Ingen DB.

| Input | Forventet |
|-------|-----------|
| elapsed=180, events=[] | true (tid nådd) |
| elapsed=90, events=["user.asked_question"] | true (event oppfylt) |
| elapsed=90, events=[] | false |
| exit_criteria_jsonb=null, target_duration=180, elapsed=200 | true (fallback) |
| signal "user.declared_done_sharing"="achieved" i collected_data | true |

### T2 — Unit: tool-selector allowlist

**Fil:** `packages/ai/src/router/__tests__/tool-selector-allowlist.test.ts`

| Input | Forventet |
|-------|-----------|
| allowlist=["note_inquiry"], 10 tools | kun note_inquiry returneres |
| allowlist=[], 10 tools | alle 10 (bakover-kompatibel) |
| allowlist=null | alle 10 |
| stage 1 allowlist, navigate_to i input | navigate_to ikke i output |

### T3 — Integration: stage-advance CAS

**Fil:** `apps/e2e/tests/welcome-mission/stage-advance-cas.spec.ts`

Supabase Local. To parallelle /advance-kall til samme session.

Assertions: én returnerer 200, én returnerer 409. `current_stage_id` oppdatert én gang. `engine_session_step.status='completed'` for stage 1.

### T4 — Integration: crash-recovery

**Fil:** `apps/e2e/tests/welcome-mission/crash-recovery.spec.ts`

Setup: Direkte INSERT av `engine_session_step` med `status='running'`, `lease_expires_at = now() - interval '1 minute'`.

Assertions: Recovery-worker plukker opp expired lease. `worker_id` oppdateres. `idempotency_key` endres IKKE. `attempts` inkrementeres. Step fullføres uten dobbel-advance.

### T5 — Integration: two-brain emit

**Fil:** `services/stage-engine/src/__tests__/two-brain-emit.test.ts`

Assertions:
- `engine_event` INSERT i SAMME kode-flyt som step-completion
- Feil i `engine_event` INSERT → kaster (ikke silent)
- `engine_event.event_type` er dot-notation (`"welcome.stage_advanced"`)
- `engine_audit_outbox` INSERT ETTER step (uavhengig)
- `destinations` inneholder IKKE `"engine_event"`

### T6 — E2E: welcome mission full flow

**Fil:** `apps/e2e/tests/welcome-mission/full-flow.spec.ts`

Supabase Local + Stage Engine kjørende. Ny profil uten earlier welcome session.

Assertions:
- `POST /api/botsson/session/init` → `action: "spawned"`
- 4 stage-advances (mock LLM-trigger)
- `engine_sessions.status = 'complete'`
- `engine_sessions.collected_data.mission_outcomes` finnes
- `agent_inquiry`-rader for open outcomes
- `guardian_log` inneholder `stage.advanced` × 4

### T7 — E2E: hard fail abandoned

**Fil:** `apps/e2e/tests/welcome-mission/hard-fail-abandoned.spec.ts`

Setup: Session i stage 1. `stage_started_at = now() - interval '6 minutes'`. Kjør guardian periodic.

Assertions:
- `engine_sessions.status = 'abandoned'`
- `agent_inquiry`-rader med `priority = 'high'`
- `guardian_log` inneholder `welcome_mission.abandoned`
- `engine_audit_outbox` rad med `event_name = 'welcome.mission_abandoned'`

---

## 4. Implementerings-rekkefølge

| Trinn | Hva | Avhengigheter |
|-------|-----|--------------|
| 1.1 | ADR-0274 accepted | — |
| 1.2 | ADR-0271 accepted | — |
| 1.3 | ADR-0272 accepted | — |
| 1.4 | ADR-0273 accepted | ADR-0274 |
| 2.1 | M1: base_instruction kolonne | ADR-0272 accepted |
| 2.2 | M2: stage-kolonner | ADR-0271 accepted |
| 2.3 | M3: engine_session_step | ADR-0274 accepted |
| 2.4 | M4: agent_inquiry | ADR-0274 accepted |
| 2.5 | M5: engine_audit_outbox | ADR-0273 accepted |
| 3.1 | inquiry capability: tools.ts + index.ts | M4 landed |
| 3.2 | registry.ts: legg til inquiry | 3.1 |
| 3.3 | types.ts CapabilityName + intent-classifier enum | 3.2 |
| 4.1 | template.ts + template.test.ts | ADR-0272 accepted |
| 4.2 | T0: template.test.ts passerer | 4.1 |
| 5.1 | M6: seed welcome_mission_v1 | M1 + M2 + 4.2 grønt |
| 5.2 | M7: authority backfill | M3 + M4 landed |
| 6.1 | shouldAdvanceStage + evaluateOutcomes i stage-manager | M2 + M3 landed |
| 6.2 | applyToolAllowlist + stageContext i tool-selector | M2 landed |
| 6.3 | buildStagePromptWithMissionFrame i prompt-builder | M1 landed |
| 6.4 | frozen snapshot i session-manager | M3 landed |
| 6.5 | evaluateOutcomes i guardian-evaluator | 6.1 |
| 6.6 | transition_to_other_mission i mission capability | M3 + M7 |
| 6.7 | point_at_setting + show_demo i ui capability | — |
| 7.1 | BFF /api/botsson/session/init | M4 + 3.1 |
| 8.1-8.7 | Tester T1–T7 | Respektive kode-trinn |
| 9.1 | BotssonShell connect → kall /api/botsson/session/init | 7.1 (frontend-designer koordinerer) |

---

## 5. Åpne implementasjons-spørsmål

| # | Spørsmål | Konsekvens | Anbefaling |
|---|---------|------------|------------|
| OQ-1 | Standard lease-varighet? | Crash-recovery window | 30s default, renewal 10s. `SESSION_STEP_LEASE_MS` env-var. |
| OQ-2 | `evaluateOutcomes` FØR eller ETTER next_stage-update i CAS? | Stage-felt på outcome feil hvis POST | Kall PRE-CAS. Stage settes til current_stage_id. |
| OQ-3 | Tool-selector: hard-blokkere eller soft-filtrere? | Hard = sikrere; soft = mer forgiving | Hard-blokkerer + warn-log. |
| OQ-4 | `idempotency_key` leak til capability tools? | Propagert = double-insert prevention | Ikke leak. UNIQUE-constraint på agent_inquiry via gate_action. |
| OQ-5 | Hvem trigger audit-outbox flush-worker? | Ny worker vs pg_cron | Ny worker `audit-outbox-flusher`. Kan defer til Phase A. |
| OQ-6 | Fallback når base_instruction mangler (legacy missions)? | buildStagePromptWithMissionFrame feiler | Null-check: fall tilbake til buildStagePromptWithWhispers. |
| OQ-7 | `stage_1_questions_asked`-counter: collected_data vs dedikert tabell? | collected_data enklere | collected_data for V0. Migrere til `engine_session_counter`-tabell ved repeterende mønster. |
| OQ-8 | Hvordan propageres activeStage.tool_allowlist til tool-selector? | Signatur-endring | Opsjonell `stageContext?: { tool_allowlist?: string[] }` parameter. Bakover-kompatibelt. |
| OQ-9 | `transition_to_other_mission` finnes ikke i mission capability? | Blokkerer stage 1/4 tool_allowlist | Ny tool i mission/tools.ts. gate_action + emit required. |
| OQ-10 | `point_at_setting` og `show_demo` finnes ikke i ui capability? | Blokkerer stage 2 | Legg til. Koordiner broadcast-event-format med frontend-designer. |
| OQ-11 | `WELCOME_MISSION_RESUME_WINDOW_HOURS` i .env.template? | Konfigurerbarhet mangler | Legg til med op://-ref + default 24 i .env.template. |

---

## Avhengigheter som ikke løses i V0

- `emit("inquiry.noted")` krever at `"inquiry"` er lagt til i `packages/telemetry/src/registry.ts` — system-steward-territorium
- True atomicity for two-brain emit (ADR-0273 OQ) — defer til Phase A via Postgres RPC
- M7 authority-backfill antar `updated_by`-kolonne finnes på `engine_authority_config` — verifiser mot eksisterende skjema
- BotssonShell-integrasjon (9.1) er frontend-designer-territorium — harness-builder leverer BFF-route; designer kobler opp connect-kallet
