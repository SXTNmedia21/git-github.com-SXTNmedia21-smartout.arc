---
title: "Agent Profile System — Voice DNA, Posture & Context Awareness"
status: draft
updated: 2026-03-07
created: 2026-03-07
module: ai
tags: [agent, voice, personality, posture, context, relationship, memory, design]
---

# Agent Profile System — Voice DNA, Posture & Context Awareness

> **Goal:** Give Mr. Botsson a persistent identity per workspace with voice DNA, adaptive personality, relationship memory per employee, and full context awareness.

---

## 1. Overview

Three new capabilities layered on the existing Stage Engine + packages/ai architecture:

1. **Agent Profile** — Per-workspace agent identity stored in Supabase. Voice config, personality sliders, posture adaptation flags.
2. **Relationship Index** — Per-agent-per-employee composite score (familiarity + trust/competence + sentiment). Agent adapts tone based on how well it knows you.
3. **Context Collector + Posture Resolver** — Gathers profile, time, shift, session, relationship, and memory into a struct. Resolves personality into situation-appropriate posture. Injected into system prompt.

Additionally:

- **Stage voice override** — Missions define a default voice; individual stages can override it.
- **Memory scope extension** — Existing `engine_memory` table gains agent ownership and scope (personal/team/workspace).

---

## 2. Database Schema

### 2.1 `agent_profile` (NEW)

One row per workspace. Mr. Botsson's DNA.

```sql
CREATE TABLE agent_profile (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

  -- Identity
  display_name      text NOT NULL DEFAULT 'Mr. Botsson',
  greeting          text NOT NULL DEFAULT 'Hei! Hva kan jeg hjelpe deg med?',
  language          text NOT NULL DEFAULT 'no' CHECK (language IN ('no', 'en', 'sv')),

  -- Voice DNA
  default_voice     text NOT NULL DEFAULT 'mark',
  voice_speed       decimal NOT NULL DEFAULT 1.0 CHECK (voice_speed BETWEEN 0.5 AND 2.0),
  voice_temperature decimal NOT NULL DEFAULT 0.3 CHECK (voice_temperature BETWEEN 0.0 AND 1.0),
  voice_stability   decimal NOT NULL DEFAULT 0.7 CHECK (voice_stability BETWEEN 0.0 AND 1.0),

  -- Personality (0.0–1.0 sliders)
  formality         decimal NOT NULL DEFAULT 0.5 CHECK (formality BETWEEN 0.0 AND 1.0),
  assertiveness     decimal NOT NULL DEFAULT 0.5 CHECK (assertiveness BETWEEN 0.0 AND 1.0),
  warmth            decimal NOT NULL DEFAULT 0.7 CHECK (warmth BETWEEN 0.0 AND 1.0),
  humor             decimal NOT NULL DEFAULT 0.2 CHECK (humor BETWEEN 0.0 AND 1.0),
  verbosity         decimal NOT NULL DEFAULT 0.4 CHECK (verbosity BETWEEN 0.0 AND 1.0),

  -- Posture adaptation flags
  adapt_to_role     boolean NOT NULL DEFAULT true,
  adapt_to_situation boolean NOT NULL DEFAULT true,
  adapt_to_authority boolean NOT NULL DEFAULT true,

  -- Metadata
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES user_identity(id),

  CONSTRAINT unique_workspace_agent UNIQUE (workspace_id)
);

ALTER TABLE agent_profile ENABLE ROW LEVEL SECURITY;

-- JWT policy: workspace members can read
CREATE POLICY "agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

-- JWT policy: admin/owner can update
CREATE POLICY "agent_profile_write" ON agent_profile
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- API key policy
CREATE POLICY "api_key_agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

COMMENT ON TABLE agent_profile IS 'Per-workspace AI agent identity: voice DNA, personality sliders, posture adaptation flags.';
```

### 2.2 `agent_relationship` (NEW)

One row per agent × employee. Builds over time.

```sql
CREATE TABLE agent_relationship (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  agent_profile_id    uuid NOT NULL REFERENCES agent_profile(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,

  -- Familiarity (conversation count + recency)
  total_conversations integer NOT NULL DEFAULT 0,
  total_minutes       decimal NOT NULL DEFAULT 0,
  last_interaction_at timestamptz,
  familiarity_score   decimal NOT NULL DEFAULT 0.0 CHECK (familiarity_score BETWEEN 0.0 AND 1.0),

  -- Trust & Competence
  protocols_completed integer NOT NULL DEFAULT 0,
  protocols_assigned  integer NOT NULL DEFAULT 0,
  readiness_score     decimal NOT NULL DEFAULT 0.0 CHECK (readiness_score BETWEEN 0.0 AND 1.0),
  accuracy_score      decimal NOT NULL DEFAULT 0.5 CHECK (accuracy_score BETWEEN 0.0 AND 1.0),
  trust_score         decimal NOT NULL DEFAULT 0.0 CHECK (trust_score BETWEEN 0.0 AND 1.0),

  -- Sentiment (rolling window)
  positive_count      integer NOT NULL DEFAULT 0,
  neutral_count       integer NOT NULL DEFAULT 0,
  negative_count      integer NOT NULL DEFAULT 0,
  sentiment_trend     decimal NOT NULL DEFAULT 0.0 CHECK (sentiment_trend BETWEEN -1.0 AND 1.0),
  sentiment_score     decimal NOT NULL DEFAULT 0.5 CHECK (sentiment_score BETWEEN 0.0 AND 1.0),

  -- Composite
  relationship_score  decimal NOT NULL DEFAULT 0.0 CHECK (relationship_score BETWEEN 0.0 AND 1.0),

  -- Metadata
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_agent_profile_rel UNIQUE (agent_profile_id, profile_id)
);

ALTER TABLE agent_relationship ENABLE ROW LEVEL SECURITY;

-- JWT: users see their own relationship + admins see all in workspace
CREATE POLICY "agent_relationship_read_own" ON agent_relationship
  FOR SELECT USING (
    profile_id IN (
      SELECT p.id FROM profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "agent_relationship_read_admin" ON agent_relationship
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

-- Service role only for writes (updated by Stage Engine after sessions)
CREATE POLICY "agent_relationship_service_write" ON agent_relationship
  FOR ALL USING (true)
  WITH CHECK (true);
-- Note: service_role bypasses RLS; this policy exists for completeness.

-- API key policy
CREATE POLICY "api_key_agent_relationship_read" ON agent_relationship
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

CREATE INDEX idx_agent_relationship_workspace ON agent_relationship(workspace_id);
CREATE INDEX idx_agent_relationship_profile ON agent_relationship(profile_id);
CREATE INDEX idx_agent_relationship_composite ON agent_relationship(agent_profile_id, relationship_score DESC);

COMMENT ON TABLE agent_relationship IS 'Per-agent-per-employee relationship: familiarity, trust/competence, sentiment. Composite score drives posture adaptation.';
```

### 2.3 `engine_memory` Extensions (ALTER)

```sql
-- Add agent ownership and scope to existing engine_memory table
ALTER TABLE engine_memory
  ADD COLUMN agent_profile_id uuid REFERENCES agent_profile(id) ON DELETE SET NULL,
  ADD COLUMN scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'workspace')),
  ADD COLUMN importance decimal NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0.0 AND 1.0);

CREATE INDEX idx_engine_memory_agent ON engine_memory(agent_profile_id);
CREATE INDEX idx_engine_memory_scope ON engine_memory(workspace_id, scope);

COMMENT ON COLUMN engine_memory.scope IS 'personal = this profile only, team = team-wide, workspace = everyone';
COMMENT ON COLUMN engine_memory.importance IS '0–1 ranking for retrieval priority';
```

---

## 3. Stage Voice Override

Extend the `AgentMission` TypeScript type:

```typescript
type MissionStageVoiceOverride = {
  id: string;
  voice?: UltravoxVoice;
  temperature?: number;
  posture_override?: Partial<{
    formality: number;
    assertiveness: number;
    warmth: number;
    humor: number;
    verbosity: number;
  }>;
};

// Add to AgentMission:
type AgentMission = {
  // ...existing fields...
  stages?: MissionStageVoiceOverride[];
};
```

**Resolution order:** Stage override → Mission default → Agent profile default.

When Stage Engine advances to a new stage, if the stage has a voice override, the next Ultravox call uses that voice. `buildUltravoxTools()` reads the current stage's voice config.

---

## 4. Context Collector

New module: `packages/ai/src/context/collector.ts`

```typescript
type AgentContext = {
  // Who
  profile: {
    id: string;
    name: string;
    role: "employee" | "manager" | "admin" | "owner";
    department: string | null;
    team: string | null;
    status: "trainee" | "active" | "inactive" | "offboarding";
    preferredLanguage: string;
  };

  // When
  currentTime: string; // "Fredag 14:32"
  dayOfWeek: string; // "friday"
  activeShift: {
    start: string;
    end: string;
    role: string;
    department: string;
  } | null;
  activeDepartmentSession: {
    status: string;
    department: string;
  } | null;

  // Relationship
  relationship: {
    familiarity: number;
    trust: number;
    sentiment: number;
    composite: number;
    totalConversations: number;
    lastInteraction: string | null;
  };

  // Memory
  relevantMemories: {
    content: string;
    type: string;
    scope: string;
    importance: number;
  }[];

  // Agent identity
  agentProfile: {
    displayName: string;
    greeting: string;
    language: string;
    defaultVoice: string;
    personality: Personality;
    adaptFlags: {
      role: boolean;
      situation: boolean;
      authority: boolean;
    };
  };

  // Resolved (after posture adaptation)
  resolvedPosture: ResolvedPosture;
};

async function collectContext(params: {
  workspaceId: string;
  profileId: string;
  userId?: string;
  sessionId: string;
  situation: Situation;
  authority: AuthorityLevel;
  supabaseAdmin: SupabaseClient;
}): Promise<AgentContext>;
```

All data fetched via `Promise.all()` — profile, agent_profile, agent_relationship, engine_memory, schedule_shift (active), department sessions.

---

## 5. Posture Resolver

New module: `packages/ai/src/prompts/posture.ts`

```typescript
type Personality = {
  formality: number;
  assertiveness: number;
  warmth: number;
  humor: number;
  verbosity: number;
};

type ResolvedPosture = Personality;

type Situation = "onboarding" | "haccp" | "scheduling" | "training" | "operations" | "general";

function resolvePosture(
  base: Personality,
  role: ProfileRole,
  situation: Situation,
  authority: AuthorityLevel,
  relationshipScore: number,
  adaptFlags: { role: boolean; situation: boolean; authority: boolean },
): ResolvedPosture;
```

**Adaptation rules (additive, clamped 0–1):**

| Factor                | Condition          | formality | assertiveness | warmth | humor | verbosity |
| --------------------- | ------------------ | --------- | ------------- | ------ | ----- | --------- |
| Role: trainee         | adapt_to_role      | -0.15     |               | +0.15  |       | +0.20     |
| Role: owner           | adapt_to_role      | +0.10     | -0.10         |        |       |           |
| Situation: HACCP      | adapt_to_situation |           | +0.20         | -0.10  | -0.20 |           |
| Situation: onboarding | adapt_to_situation |           |               | +0.20  |       | +0.10     |
| Situation: scheduling | adapt_to_situation |           | +0.10         |        |       | -0.10     |
| Authority: suggest    | adapt_to_authority |           | -0.20         |        |       |           |
| Authority: read_only  | adapt_to_authority | +0.10     | -0.30         |        |       | -0.10     |
| Relationship > 0.6    | always             | -0.10     |               |        | +0.10 | -0.05     |
| Relationship < 0.2    | always             | +0.10     |               |        | -0.05 | +0.10     |

---

## 6. Integration Points

### 6.1 Stage Engine `routeAgentMessage()`

Current pipeline:

```
message → classify intent → select tools → build prompt → generateText()
```

New pipeline:

```
message → collectContext() → classify intent → select tools → resolvePosture() → build prompt → generateText() → updateRelationship()
```

### 6.2 Prompt Builder

`buildBotssonPrompt()` gains new sections:

- **Identity block** — agent name, greeting style from agent_profile
- **Posture instructions** — "Be [warmth] warm, [formality] formal, [assertiveness] assertive..."
- **Relationship context** — "You've had [N] conversations with [name]. [familiarity text]."
- **Memory block** — relevant memories injected as context

### 6.3 Session End Hook

After each session completes:

1. Increment `total_conversations` and `total_minutes` on agent_relationship
2. Run lightweight sentiment classification on conversation
3. Recompute composite: `0.3 × familiarity + 0.4 × trust + 0.3 × sentiment`
4. Save any new memories with appropriate scope and importance

### 6.4 Workspace Creation

When a workspace is created (activate-workspace Edge Function), auto-create a default `agent_profile` row with standard personality values.

---

## 7. File Map (New/Modified)

| File                                                          | Action | Purpose                                                 |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `supabase/migrations/YYYYMMDDHHMMSS_agent_profile_system.sql` | CREATE | Migration: 2 new tables + 3 ALTER columns               |
| `packages/ai/src/context/collector.ts`                        | CREATE | Context collector                                       |
| `packages/ai/src/context/types.ts`                            | CREATE | AgentContext, Situation types                           |
| `packages/ai/src/prompts/posture.ts`                          | CREATE | resolvePosture()                                        |
| `packages/ai/src/prompts/mr-botsson.ts`                       | MODIFY | Accept AgentContext, add identity/posture/memory blocks |
| `packages/ai/src/missions/types.ts`                           | MODIFY | Add MissionStageVoiceOverride, stages field             |
| `packages/ai/src/capabilities/types.ts`                       | MODIFY | Export Personality, ResolvedPosture types               |
| `services/stage-engine/src/core/agent-router.ts`              | MODIFY | Use collectContext(), updateRelationship()              |
| `services/stage-engine/src/core/relationship-manager.ts`      | CREATE | CRUD + scoring for agent_relationship                   |
| `services/stage-engine/src/lib/ultravox.ts`                   | MODIFY | Stage voice override in buildUltravoxTools()            |

---

## 8. What This Does NOT Include

- Admin UI for editing agent_profile (deferred — can be done via Supabase Studio initially)
- Automated trust_score recalculation from protocol_assignment changes (future trigger)
- Voice preview/testing in UI
- Multi-agent per workspace (one Mr. Botsson per workspace for now)
