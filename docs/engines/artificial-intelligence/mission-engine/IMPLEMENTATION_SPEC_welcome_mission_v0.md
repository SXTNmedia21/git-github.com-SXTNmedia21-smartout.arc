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
ADR-0272 accepted → M6 (seed)
ADR-0273 accepted → M5 (engine_audit_outbox)
M2 landed + template.test.ts grønt → M6 (seed)
M3 + M4 landed → M7 (authority backfill)
```

### M1 — DROPPED (B3 fix, plan PLAN-welcome-mission-rework)

`engine_missions.system_prompt` already exists via `20260318120000_engine_tuning_notes_and_mission_prompt.sql`. No new column needed. All references previously named `base_instruction` now use `system_prompt`. `Mission` type in `services/stage-engine/src/types/session.ts:33` already has `system_prompt: string | null`; `stage-manager.ts:197` reads it.

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

DROP POLICY IF EXISTS "jwt_read_engine_session_step" ON public.engine_session_step;
CREATE POLICY "jwt_read_engine_session_step" ON public.engine_session_step
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.engine_sessions es
      WHERE es.workspace_id = ANY (public.get_workspace_ids_for_user())
      AND (
        es.profile_id IN (
          SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
        )
        OR public.is_admin_in_workspace(auth.uid(), es.workspace_id)
      )
    )
  );

DROP POLICY IF EXISTS "service_role_all_engine_session_step" ON public.engine_session_step;
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

DROP POLICY IF EXISTS "jwt_read_agent_inquiry" ON public.agent_inquiry;
CREATE POLICY "jwt_read_agent_inquiry" ON public.agent_inquiry
  FOR SELECT USING (
    profile_id IN (SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid())
    OR (
      workspace_id = ANY (public.get_workspace_ids_for_user())
      AND public.is_admin_in_workspace(auth.uid(), workspace_id)
    )
  );

DROP POLICY IF EXISTS "service_role_all_agent_inquiry" ON public.agent_inquiry;
CREATE POLICY "service_role_all_agent_inquiry" ON public.agent_inquiry
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "api_key_rw_agent_inquiry" ON public.agent_inquiry;
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
  workspace_id     UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,

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

DROP POLICY IF EXISTS "service_role_all_audit_outbox" ON public.engine_audit_outbox;
CREATE POLICY "service_role_all_audit_outbox" ON public.engine_audit_outbox
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "godmode_read_audit_outbox" ON public.engine_audit_outbox;
CREATE POLICY "godmode_read_audit_outbox" ON public.engine_audit_outbox
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.user_identity ui
      WHERE ui.user_id = auth.uid()
        AND ui.is_godmode = true
    )
  );

DROP POLICY IF EXISTS "workspace_read_audit_outbox" ON public.engine_audit_outbox;
CREATE POLICY "workspace_read_audit_outbox" ON public.engine_audit_outbox
  FOR SELECT USING (
    workspace_id = ANY (public.get_workspace_ids_for_user())
  );
```

### M6 — Seed `welcome_mission_v1`

**Fil:** `supabase/migrations/20260525100500_seed_welcome_mission_v1.sql`

Idempotent (ON CONFLICT DO NOTHING). Innhold MÅ matche `packages/ai/src/missions/welcome/template.ts`
ord-for-ord (ADR-0272). Template.test.ts (T0) verifiserer parity.

Migrasjon INSERT:
1. `engine_missions` — id=`welcome_mission_v1`, mode=`sequential`, workspace_id=NULL (global), is_active=true, system_prompt=`<§4.1-tekst>`
2. `engine_stages` × 4 — alle felter per §4.2–4.5 inkl. exit_criteria_jsonb, tool_allowlist, personality_override

**Merk:** Dollar-quoting (`$P1$...$P1$`) for personality_override og system_prompt for å unngå quote-escaping. Se WELCOME_MISSION_V0.md §4 for eksakt tekst-innhold.

### M7 — Authority-backfill (CVE-class fix)

**Fil:** `supabase/migrations/20260525100600_welcome_mission_authority_backfill.sql`

Backfill for alle eksisterende workspaces som mangler rad i `engine_authority_config`:
- `inquiry`: level=`autonomous` (lav-risiko, profile-scoped notater)
- `mission`: level=`confirm` (medium-risiko, switcher session-kontekst)

Per ADR-0274 §7 — adresserer kanaler-som-helpdesk council 2026-04-19 side-finding.

**H7-fix safety guarantees** (per PLAN-welcome-mission-rework, mønster fra `20260515130500_seed_session_authority.sql`):

```sql
-- Idempotent + safe re-run + non-default-allow + workspace-scoped
DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  -- updated_by-fallback: første godmode-bruker (per existing pattern)
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping welcome-mission authority backfill. Re-run after first admin is created.';
    RETURN;
  END IF;

  -- Workspace-scoped, non-default-allow: explicit level per capability
  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, cap.capability, cap.level, cap.min_role,
         false, 24, v_updated_by
  FROM public.workspace w
  CROSS JOIN (
    VALUES
      ('inquiry', 'autonomous', 'employee'),
      ('mission', 'confirm',    'manager')
  ) AS cap(capability, level, min_role)
  -- Re-run safety: WHERE NOT EXISTS guard via ON CONFLICT
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;
```

Safety-guarantees:
- **Non-default-allow:** explicit level per capability (`autonomous` vs `confirm`), aldri implisitt allow
- **updated_by populated:** godmode-fallback med RAISE NOTICE hvis ingen godmode-bruker eksisterer (skipper i stedet for å feile)
- **Workspace-scoped:** `CROSS JOIN public.workspace` per workspace, aldri cross-workspace mass-set
- **Re-run safety:** `ON CONFLICT (workspace_id, capability) DO NOTHING` — eksisterende rader røres ikke, ny migrasjon ved re-deploy er no-op

---

## 1.8 Per-tool compliance table (H1-fix per L-0175 + L-0176)

5 nye/utvidede tools må hver verifisere body — ikke docstring — mot cross-cutting laws:

| Tool | gate_action | gatedMutation | emit() | allowedChannels | Verdict |
|------|-------------|---------------|--------|-----------------|---------|
| `note_inquiry` (inquiry capability, NEW) | YES — `inquiry.note` action FØR INSERT i `agent_inquiry` | YES — wrap INSERT i `gatedMutation` (ADR-0204) | `emit("inquiry noted", { workspace_id, profile_id, inquiry_type })` (B5 space-form, ADR-0134 non-null IDs) | `["chat"]` (ADR-0078 — inquiries kan inneholde PII via free-text notes) | Compliant when implemented per template |
| `transition_to_other_mission` (mission capability, NEW tool i eksisterende capability) | YES — `mission.transition` action; muterer `engine_sessions.status` + spawn ny session | YES — wrap UPDATE+INSERT i `gatedMutation` | `emit("mission transitioned", { workspace_id, profile_id, from_mission_id, to_mission_id, from_stage_id })` (direct call — `mission` capability `emitPrefix: null`, see C2-note below) | `["chat", "voice"]` (transition er navigation-action, ingen PII) | Compliant when implemented |
| `point_at_setting` (ui capability, NEW tool) | NO — read-only UI-annotation, ingen DB-write | NO — ikke mutation | `emit("ui pointed_at_setting", { workspace_id, profile_id, setting_path })` (audit-only, direct call — `ui` capability `emitPrefix: null`) | `["chat", "voice"]` (UI-pek er channel-agnostic) | Compliant when implemented |
| `show_demo` (ui capability, NEW tool) | NO — read-only embedded-demo trigger | NO — ikke mutation | `emit("ui demo_shown", { workspace_id, profile_id, demo_id })` (audit-only, direct call) | `["chat", "voice"]` | Compliant when implemented |
| `navigate_to` (ui capability, EKSISTERENDE — uendret) | NO — read-only navigation | NO — ikke mutation | INGEN emit() i body i dag (kun `ctx.broadcast()`) — uendret. Welcome-mission bruker eksisterende `navigate_to` som-er; ingen ny telemetri-burden i denne sortien. | `["chat", "voice"]` (eksisterende tool, uendret) | No change |

**Implementasjons-rekkefølge (B6-fix):** Disse 4 NYE tools (note_inquiry, transition_to_other_mission, point_at_setting, show_demo) MÅ være implementert + registrert FØR M6 (seed welcome_mission_v1) kjøres. M6 referer `tool_allowlist` som peker på tool-navn — hvis tool-navn ikke finnes i registry når seed kjører, blir allowlist tom-effektiv ved runtime (silent failure). `navigate_to` finnes allerede; ingen ny build-task. Korrekt sekvens i §4 implementerings-rekkefølge:

1. Trinn 3.1–3.3: inquiry capability + registry + intent-classifier
2. Trinn 6.6: transition_to_other_mission i mission capability
3. Trinn 6.7: point_at_setting + show_demo i ui capability
4. **DEN tre over MÅ være ferdig FØR trinn 5.1 (M6 seed)**

### 1.8.1 emitPrefix-konsekvens for ui + mission capabilities (C2-fix per agent-coord R2 trace)

`packages/ai/src/capabilities/ui/index.ts:22` har `emitPrefix: null`. `packages/ai/src/capabilities/mission/index.ts:28` har `emitPrefix: null`. Dette betyr:

- Eksisterende ui-tools (`navigate_to`, `fill_field`, `highlight_element`, `show_panel`, ...) bruker IKKE `emit()` i body — kun `ctx.broadcast()` for UI-kommando-fanout. Ingen domain-events emittes fra ui-capability i dag.
- Eksisterende mission-tools (`get_active_missions`, `get_workspace_roadmap`) er read-only — ingen emit-behov.

Welcome-mission introduserer FIRE nye emit-call-sites i disse capabilitiene. Valg:

- **Option (a) — flip `emitPrefix` til `"ui"` / `"mission"`:** Bryter eksisterende mønster (verktøy som ikke trenger emit ville få automatisk-prefix-burden). Avvist.
- **Option (b) — direct emit-calls med full event-navn (chosen):** Tools kaller `emit("ui pointed_at_setting", ...)` direkte med full event-navn. `emitPrefix: null` forblir uendret. Konsistent med tips-capability og lovsen-capability (begge har `emitPrefix: null` og direct-call emit i tools).

Implementerings-konsekvens for §2 changes table (oppdatert under): ingen endring i `ui/index.ts` eller `mission/index.ts` (emitPrefix uendret); kun nye tools i `*/tools.ts` med direct-call `emit()`.

### 1.8.2 `point_at_setting` vs eksisterende `highlight_element` (C3-fix per agent-coord R2 trace)

`packages/ai/src/capabilities/ui/tools.ts:52` har eksisterende `highlight_element`-tool som tar `{ target, duration }` og broadcaster `action: "highlight"`. `point_at_setting` er semantisk distinkt:

- **`highlight_element`:** generic CSS-selector / element-ID highlighting med duration. Brukt for "draw the user's attention" i hvilken som helst UI-kontekst.
- **`point_at_setting`:** semantisk peker mot en spesifikk **setting-path** (f.eks. `dashboard/season/year-wheel`) — ikke en CSS-selector, ikke en duration. Welcome-mission's stage 2 ("vis_det_smarte") trenger semantikk om "dette er innstillingen jeg snakker om" som matcher domenet, ikke generisk highlight.

Forskjellen er på input-shape (setting-path vs CSS-selector) + telemetri-event (`ui pointed_at_setting` lar oss observere hvilke settings welcome-flow viser, separat fra alle andre highlights). Beholdes som separat tool.

**Alternativ vurdert + avvist:** Utvide `highlight_element` med `setting_path?: string` opsjonell parameter og emit conditional. Avvist fordi: (a) bryter input-shape, (b) blander to tools' semantikk, (c) intent-classifier ville få vanskeligere routing-beslutning.

## 1.9 tool_allowlist consumer-wiring path (H2-fix per agent-coord trace #4)

`engine_stages.tool_allowlist` er en TEXT[]-kolonne — den må nå `tool-selector.selectTools()` for å virke. Wiring-path:

1. **Spawn-tid:** `session-manager.createSession()` leser `engine_stages.tool_allowlist` for current_stage → lagrer i `engine_sessions.context.active_tool_allowlist`-JSONB
2. **Stage-advance:** `stage-manager.advanceStage()` post-CAS leser ny stages tool_allowlist → oppdaterer `engine_sessions.context.active_tool_allowlist`
3. **Per-turn:** `agent-router.routeIntent()` leser `engine_sessions.context.active_tool_allowlist` → propagerer som `stageContext.tool_allowlist?: string[]` til `tool-selector.selectTools(intent, stageContext)`
4. **Tool-filter:** `tool-selector.applyToolAllowlist(tools, allowlist)` hard-filterer (B6-fix per OQ-3); tom array = ingen restriksjon (bakover-kompatibel)

**Hvorfor ikke AgentToolContext-utvidelse:** Det vil tvinge alle 26 capabilities til å håndtere allowlist-felt i typescript-signature. Bevaring som `stageContext`-parameter på selectTools() er smal endring + bakover-kompatibel.

**Hvorfor session.context.JSONB ikke ny kolonne:** `engine_sessions.context` er allerede JSONB-fri-form for mission-state. Allowlist er per-session-state, ikke per-stage template — endrer seg ved hver advance. Ny kolonne ville kreve trigger eller dual-write.

## 2. Kode-endringer

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `packages/ai/src/capabilities/inquiry/tools.ts` | `note_inquiry`. ADR-0078 chat-only. gate_action FØR INSERT. emit("inquiry noted") (space-form per L-0046). workspace_id scope. |
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
| `services/stage-engine/src/core/session-manager.ts` | I createSession(): frozen authority-snapshot + system_prompt henting + channel-pin i context JSONB. |
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
| system_prompt inneholder ikke "Først må vi", "sjekkliste", "For at vi skal fortsette" |
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
- `engine_audit_outbox` rad med `event_name = 'welcome mission_abandoned'` (space-form per L-0046)

---

## 4. Implementerings-rekkefølge

| Trinn | Hva | Avhengigheter |
|-------|-----|--------------|
| 1.1 | ADR-0274 accepted | — |
| 1.2 | ADR-0271 accepted | — |
| 1.3 | ADR-0272 accepted | — |
| 1.4 | ADR-0273 accepted | ADR-0274 |
| 2.1 | ~~M1: system_prompt kolonne~~ DROPPED (B3) — kolonne eksisterer | — |
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
| 6.3 | buildStagePromptWithMissionFrame i prompt-builder | system_prompt finnes (no migration needed) |
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
| OQ-2 | `evaluateOutcomes` FØR eller ETTER next_stage-update i CAS? | Race-risk PRE-CAS; outcome-loss POST-CAS hvis throw | **POST-CAS** (matcher ADR-0274:138). Outcome evaluert mot committed state. Failure-mode: hook throw etter CAS → outcome eval missed → guardian-evaluator catch på neste 120s tick (secondary safety-net per §10.6 i WELCOME_MISSION_V0.md). Stage-felt på outcome settes til `current_stage_id` ved tidspunkt status flippet til 'achieved'. |
| OQ-3 | Tool-selector: hard-blokkere eller soft-filtrere? | Hard = sikrere; soft = mer forgiving | Hard-blokkerer + warn-log. |
| OQ-4 | `idempotency_key` leak til capability tools? | Propagert = double-insert prevention | Ikke leak. UNIQUE-constraint på agent_inquiry via gate_action. |
| OQ-5 | Hvem trigger audit-outbox flush-worker? | Ny worker vs pg_cron | Ny worker `audit-outbox-flusher`. Kan defer til Phase A. |
| OQ-6 | Fallback når system_prompt mangler (legacy missions)? | buildStagePromptWithMissionFrame feiler | Null-check: fall tilbake til buildStagePromptWithWhispers. |
| OQ-7 | `stage_1_questions_asked`-counter: collected_data vs dedikert tabell? | collected_data enklere | collected_data for V0. Migrere til `engine_session_counter`-tabell ved repeterende mønster. |
| OQ-8 | Hvordan propageres activeStage.tool_allowlist til tool-selector? | Signatur-endring | Opsjonell `stageContext?: { tool_allowlist?: string[] }` parameter. Bakover-kompatibelt. |
| OQ-9 | `transition_to_other_mission` finnes ikke i mission capability? | Blokkerer stage 1/4 tool_allowlist | Ny tool i mission/tools.ts. gate_action + emit required. |
| OQ-10 | `point_at_setting` og `show_demo` finnes ikke i ui capability? | Blokkerer stage 2 | Legg til. Koordiner broadcast-event-format med frontend-designer. |
| OQ-11 | `WELCOME_MISSION_RESUME_WINDOW_HOURS` i .env.template? | Konfigurerbarhet mangler | Legg til med op://-ref + default 24 i .env.template. |

---

## Avhengigheter som ikke løses i V0

- `emit("inquiry noted")` krever at `"inquiry"` er lagt til i `EventCategory` union (`packages/telemetry/src/registry.ts:26-58`) + registrert i `EVENT_ROUTING` map med space-form (per L-0046, B5-fix). Tilsvarende for `"welcome stage_advanced"`, `"welcome mission_abandoned"`, `"welcome session_resumed"`, `"welcome session_restarted_after_window"`, `"welcome early_exit_via_transition"`, `"welcome spawn_evaluated"`, `"welcome spawn_skipped_existing_session"`.
- True atomicity for two-brain emit (ADR-0273 OQ) — defer til Phase A via Postgres RPC
- M7 authority-backfill antar `updated_by`-kolonne finnes på `engine_authority_config` — verifiser mot eksisterende skjema
- BotssonShell-integrasjon (9.1) er frontend-designer-territorium — harness-builder leverer BFF-route; designer kobler opp connect-kallet
