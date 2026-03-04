---
title: "Agent Profile System — Implementation Plan"
status: draft
updated: 2026-03-07
created: 2026-03-07
module: ai
tags: [agent, voice, personality, posture, context, relationship, memory, plan]
---

# Agent Profile System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-workspace agent profiles with voice DNA, personality sliders, adaptive posture, relationship tracking per employee, and full context awareness to Mr. Botsson.

**Architecture:** Two new Supabase tables (`agent_profile`, `agent_relationship`), three new columns on `engine_memory`, new packages/ai modules for context collection and posture resolution, and modifications to the Stage Engine agent router and prompt builder. All personality data flows through a `collectContext() → resolvePosture() → buildBotssonPrompt()` pipeline.

**Tech Stack:** TypeScript (strict), Supabase PostgreSQL (RLS), Zod, Vitest, packages/ai, services/stage-engine (Hono)

**Design spec:** `docs/plans/2026-03-07-agent-profile-system-design.md`

---

## Existing Code Map

| What               | Path                                               | Action                                           |
| ------------------ | -------------------------------------------------- | ------------------------------------------------ |
| Capability types   | `packages/ai/src/capabilities/types.ts`            | MODIFY (add Personality, Situation types)        |
| Mission types      | `packages/ai/src/missions/types.ts`                | MODIFY (add stage voice override)                |
| Mr. Botsson prompt | `packages/ai/src/prompts/mr-botsson.ts`            | REWRITE (accept AgentContext)                    |
| Agent router       | `services/stage-engine/src/core/agent-router.ts`   | MODIFY (use collectContext, updateRelationship)  |
| Memory manager     | `services/stage-engine/src/core/memory-manager.ts` | MODIFY (add scope, importance, agent_profile_id) |
| Authority loader   | `services/stage-engine/src/core/authority.ts`      | KEEP                                             |
| Ultravox lib       | `services/stage-engine/src/lib/ultravox.ts`        | MODIFY (stage voice override)                    |
| Package exports    | `packages/ai/package.json`                         | MODIFY (add context, posture exports)            |

---

## Phase 1: Database Migration

### Task 1: Write and apply migration

**Files:**

- Create: `supabase/migrations/20260307000000_agent_profile_system.sql`

**Step 1: Write the migration**

```sql
-- ============================================
-- Agent Profile System
-- Two new tables + engine_memory extensions
-- Design: docs/plans/2026-03-07-agent-profile-system-design.md
-- ============================================

-- 1. agent_profile — one per workspace, Mr. Botsson's DNA
CREATE TABLE agent_profile (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,

  -- Identity
  display_name       text NOT NULL DEFAULT 'Mr. Botsson',
  greeting           text NOT NULL DEFAULT 'Hei! Hva kan jeg hjelpe deg med?',
  language           text NOT NULL DEFAULT 'no' CHECK (language IN ('no', 'en', 'sv')),

  -- Voice DNA
  default_voice      text NOT NULL DEFAULT 'mark',
  voice_speed        decimal NOT NULL DEFAULT 1.0 CHECK (voice_speed BETWEEN 0.5 AND 2.0),
  voice_temperature  decimal NOT NULL DEFAULT 0.3 CHECK (voice_temperature BETWEEN 0.0 AND 1.0),
  voice_stability    decimal NOT NULL DEFAULT 0.7 CHECK (voice_stability BETWEEN 0.0 AND 1.0),

  -- Personality (0.0–1.0 sliders)
  formality          decimal NOT NULL DEFAULT 0.5 CHECK (formality BETWEEN 0.0 AND 1.0),
  assertiveness      decimal NOT NULL DEFAULT 0.5 CHECK (assertiveness BETWEEN 0.0 AND 1.0),
  warmth             decimal NOT NULL DEFAULT 0.7 CHECK (warmth BETWEEN 0.0 AND 1.0),
  humor              decimal NOT NULL DEFAULT 0.2 CHECK (humor BETWEEN 0.0 AND 1.0),
  verbosity          decimal NOT NULL DEFAULT 0.4 CHECK (verbosity BETWEEN 0.0 AND 1.0),

  -- Posture adaptation flags
  adapt_to_role      boolean NOT NULL DEFAULT true,
  adapt_to_situation boolean NOT NULL DEFAULT true,
  adapt_to_authority boolean NOT NULL DEFAULT true,

  -- Metadata
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES user_identity(id),

  CONSTRAINT unique_workspace_agent UNIQUE (workspace_id)
);

ALTER TABLE agent_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

CREATE POLICY "agent_profile_write" ON agent_profile
  FOR ALL USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "api_key_agent_profile_read" ON agent_profile
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

COMMENT ON TABLE agent_profile IS 'Per-workspace AI agent identity: voice DNA, personality sliders, posture adaptation flags.';


-- 2. agent_relationship — one per agent × employee
CREATE TABLE agent_relationship (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  agent_profile_id    uuid NOT NULL REFERENCES agent_profile(id) ON DELETE CASCADE,
  profile_id          uuid NOT NULL REFERENCES profile(id) ON DELETE CASCADE,

  -- Familiarity
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

  -- Sentiment
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

CREATE POLICY "agent_relationship_read_own" ON agent_relationship
  FOR SELECT USING (
    profile_id IN (SELECT p.id FROM profile p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "agent_relationship_read_admin" ON agent_relationship
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND is_admin_in_workspace(auth.uid(), workspace_id)
  );

CREATE POLICY "api_key_agent_relationship_read" ON agent_relationship
  FOR SELECT USING (
    workspace_id = (current_setting('app.workspace_id', true))::uuid
  );

CREATE INDEX idx_agent_relationship_workspace ON agent_relationship(workspace_id);
CREATE INDEX idx_agent_relationship_profile ON agent_relationship(profile_id);
CREATE INDEX idx_agent_relationship_composite ON agent_relationship(agent_profile_id, relationship_score DESC);

COMMENT ON TABLE agent_relationship IS 'Per-agent-per-employee relationship: familiarity, trust/competence, sentiment.';


-- 3. Extend engine_memory
ALTER TABLE engine_memory
  ADD COLUMN agent_profile_id uuid REFERENCES agent_profile(id) ON DELETE SET NULL,
  ADD COLUMN scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team', 'workspace')),
  ADD COLUMN importance decimal NOT NULL DEFAULT 0.5 CHECK (importance BETWEEN 0.0 AND 1.0);

CREATE INDEX idx_engine_memory_agent ON engine_memory(agent_profile_id);
CREATE INDEX idx_engine_memory_scope ON engine_memory(workspace_id, scope);

COMMENT ON COLUMN engine_memory.scope IS 'personal = this profile only, team = team-wide, workspace = everyone';
COMMENT ON COLUMN engine_memory.importance IS '0-1 ranking for retrieval priority';
```

**Step 2: Apply the migration**

Run: `npx supabase migration up` (local) or start local Supabase if not running.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

**Step 4: Commit**

```
feat(db): add agent_profile, agent_relationship tables and engine_memory extensions
```

---

## Phase 2: Types & Posture Resolver (packages/ai)

### Task 2: Add Personality and Situation types

**Files:**

- Modify: `packages/ai/src/capabilities/types.ts`
- Modify: `packages/ai/package.json` (add context exports)

**Step 1: Add types to capabilities/types.ts**

Append after line 31 (after the `CapabilityDefinition` type):

```typescript
// -- Personality & Posture --

export type Personality = {
  formality: number;
  assertiveness: number;
  warmth: number;
  humor: number;
  verbosity: number;
};

export type ResolvedPosture = Personality;

export type Situation =
  | "onboarding"
  | "haccp"
  | "scheduling"
  | "training"
  | "operations"
  | "general";

export type PostureAdaptFlags = {
  role: boolean;
  situation: boolean;
  authority: boolean;
};

export type ProfileRole = "employee" | "manager" | "admin" | "owner";
```

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(ai): add Personality, Situation, PostureAdaptFlags types
```

---

### Task 3: Create posture resolver

**Files:**

- Create: `packages/ai/src/prompts/posture.ts`

**Step 1: Write posture.ts**

```typescript
import type {
  Personality,
  ResolvedPosture,
  Situation,
  AuthorityLevel,
  ProfileRole,
  PostureAdaptFlags,
} from "../capabilities/types.js";

type PostureAdjustment = Partial<Personality>;

const ROLE_ADJUSTMENTS: Record<string, PostureAdjustment> = {
  trainee: { formality: -0.15, warmth: 0.15, verbosity: 0.2 },
  employee: {},
  manager: { formality: 0.05 },
  admin: { formality: 0.05, assertiveness: -0.05 },
  owner: { formality: 0.1, assertiveness: -0.1 },
};

const SITUATION_ADJUSTMENTS: Record<Situation, PostureAdjustment> = {
  onboarding: { warmth: 0.2, verbosity: 0.1 },
  haccp: { assertiveness: 0.2, warmth: -0.1, humor: -0.2 },
  scheduling: { assertiveness: 0.1, verbosity: -0.1 },
  training: { warmth: 0.1, verbosity: 0.1 },
  operations: { assertiveness: 0.1 },
  general: {},
};

const AUTHORITY_ADJUSTMENTS: Record<string, PostureAdjustment> = {
  autonomous: { assertiveness: 0.1 },
  confirm: {},
  suggest: { assertiveness: -0.2 },
  read_only: { formality: 0.1, assertiveness: -0.3, verbosity: -0.1 },
  disabled: {},
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function applyAdjustment(base: Personality, adj: PostureAdjustment): Personality {
  return {
    formality: clamp(base.formality + (adj.formality ?? 0)),
    assertiveness: clamp(base.assertiveness + (adj.assertiveness ?? 0)),
    warmth: clamp(base.warmth + (adj.warmth ?? 0)),
    humor: clamp(base.humor + (adj.humor ?? 0)),
    verbosity: clamp(base.verbosity + (adj.verbosity ?? 0)),
  };
}

export function resolvePosture(
  base: Personality,
  role: ProfileRole,
  situation: Situation,
  authority: AuthorityLevel,
  relationshipScore: number,
  adaptFlags: PostureAdaptFlags,
): ResolvedPosture {
  let posture = { ...base };

  // Adapt to role
  if (adaptFlags.role) {
    posture = applyAdjustment(posture, ROLE_ADJUSTMENTS[role] ?? {});
  }

  // Adapt to situation
  if (adaptFlags.situation) {
    posture = applyAdjustment(posture, SITUATION_ADJUSTMENTS[situation]);
  }

  // Adapt to authority
  if (adaptFlags.authority) {
    posture = applyAdjustment(posture, AUTHORITY_ADJUSTMENTS[authority] ?? {});
  }

  // Adapt to relationship (always applied)
  if (relationshipScore > 0.6) {
    posture = applyAdjustment(posture, { formality: -0.1, humor: 0.1, verbosity: -0.05 });
  } else if (relationshipScore < 0.2) {
    posture = applyAdjustment(posture, { formality: 0.1, humor: -0.05, verbosity: 0.1 });
  }

  return posture;
}
```

**Step 2: Add export to package.json**

Add to `exports` in `packages/ai/package.json`:

```json
"./prompts/posture": {
  "types": "./dist/prompts/posture.d.ts",
  "default": "./dist/prompts/posture.js"
}
```

**Step 3: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(ai): add posture resolver with role/situation/authority/relationship adaptation
```

---

### Task 4: Add stage voice override to mission types

**Files:**

- Modify: `packages/ai/src/missions/types.ts`

**Step 1: Add stage voice override type**

After line 10 (after `MissionId` type), add:

```typescript
export type MissionStageOverride = {
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
```

Add `stages?: MissionStageOverride[]` to the `AgentMission` type (after `uiDescription`).

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(ai): add MissionStageOverride type for per-stage voice and posture
```

---

## Phase 3: Context Collector

### Task 5: Create context types

**Files:**

- Create: `packages/ai/src/context/types.ts`

**Step 1: Write types**

```typescript
import type {
  Personality,
  ResolvedPosture,
  PostureAdaptFlags,
  ProfileRole,
} from "../capabilities/types.js";

export type AgentProfileData = {
  id: string;
  displayName: string;
  greeting: string;
  language: "no" | "en" | "sv";
  defaultVoice: string;
  voiceSpeed: number;
  voiceTemperature: number;
  voiceStability: number;
  personality: Personality;
  adaptFlags: PostureAdaptFlags;
};

export type RelationshipData = {
  familiarityScore: number;
  trustScore: number;
  sentimentScore: number;
  relationshipScore: number;
  totalConversations: number;
  lastInteraction: string | null;
};

export type AgentContext = {
  // Who
  profile: {
    id: string;
    name: string;
    role: ProfileRole;
    department: string | null;
    team: string | null;
    status: string;
    preferredLanguage: string;
  };

  // When
  currentTime: string;
  dayOfWeek: string;
  activeShift: {
    start: string;
    end: string;
    role: string;
    department: string;
  } | null;

  // Relationship
  relationship: RelationshipData;

  // Memory
  relevantMemories: {
    content: string;
    type: string;
    scope: string;
    importance: number;
  }[];

  // Agent identity
  agentProfile: AgentProfileData;

  // Resolved posture
  resolvedPosture: ResolvedPosture;
};
```

**Step 2: Add export to package.json**

Add to `exports` in `packages/ai/package.json`:

```json
"./context/types": {
  "types": "./dist/context/types.d.ts",
  "default": "./dist/context/types.js"
}
```

**Step 3: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(ai): add AgentContext and AgentProfileData types
```

---

### Task 6: Create context collector

**Files:**

- Create: `packages/ai/src/context/collector.ts`

**Step 1: Write collector**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthorityLevel, Situation, ProfileRole } from "../capabilities/types.js";
import { resolvePosture } from "../prompts/posture.js";
import type { AgentContext, AgentProfileData, RelationshipData } from "./types.js";

const DEFAULT_PERSONALITY = {
  formality: 0.5,
  assertiveness: 0.5,
  warmth: 0.7,
  humor: 0.2,
  verbosity: 0.4,
};

const DEFAULT_AGENT_PROFILE: AgentProfileData = {
  id: "",
  displayName: "Mr. Botsson",
  greeting: "Hei! Hva kan jeg hjelpe deg med?",
  language: "no",
  defaultVoice: "mark",
  voiceSpeed: 1.0,
  voiceTemperature: 0.3,
  voiceStability: 0.7,
  personality: DEFAULT_PERSONALITY,
  adaptFlags: { role: true, situation: true, authority: true },
};

const DEFAULT_RELATIONSHIP: RelationshipData = {
  familiarityScore: 0,
  trustScore: 0,
  sentimentScore: 0.5,
  relationshipScore: 0,
  totalConversations: 0,
  lastInteraction: null,
};

export async function collectContext(params: {
  workspaceId: string;
  profileId: string;
  situation: Situation;
  authority: AuthorityLevel;
  supabaseAdmin: SupabaseClient;
}): Promise<AgentContext> {
  const { workspaceId, profileId, situation, authority, supabaseAdmin: sb } = params;

  // Fetch all data in parallel
  const [profileRow, agentProfileRow, relationshipRow, memories, activeShiftRow] =
    await Promise.all([
      sb
        .from("profile")
        .select(
          "id, display_name, role, status, preferred_language, department:department_id(name), team:team_id(name)",
        )
        .eq("id", profileId)
        .single()
        .then((r) => r.data),
      sb
        .from("agent_profile")
        .select("*")
        .eq("workspace_id", workspaceId)
        .single()
        .then((r) => r.data),
      sb
        .from("agent_relationship")
        .select("*")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .single()
        .then((r) => r.data),
      sb
        .from("engine_memory")
        .select("content, memory_type, scope, importance")
        .eq("workspace_id", workspaceId)
        .or(`profile_id.eq.${profileId},scope.neq.personal`)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10)
        .then((r) => r.data ?? []),
      sb
        .from("schedule_shift")
        .select("start_time, end_time, role, department:department_id(name)")
        .eq("employee_id", profileId)
        .eq("status", "active")
        .limit(1)
        .single()
        .then((r) => r.data),
    ]);

  // Build agent profile
  const agentProfile: AgentProfileData = agentProfileRow
    ? {
        id: agentProfileRow.id,
        displayName: agentProfileRow.display_name,
        greeting: agentProfileRow.greeting,
        language: agentProfileRow.language as "no" | "en" | "sv",
        defaultVoice: agentProfileRow.default_voice,
        voiceSpeed: Number(agentProfileRow.voice_speed),
        voiceTemperature: Number(agentProfileRow.voice_temperature),
        voiceStability: Number(agentProfileRow.voice_stability),
        personality: {
          formality: Number(agentProfileRow.formality),
          assertiveness: Number(agentProfileRow.assertiveness),
          warmth: Number(agentProfileRow.warmth),
          humor: Number(agentProfileRow.humor),
          verbosity: Number(agentProfileRow.verbosity),
        },
        adaptFlags: {
          role: agentProfileRow.adapt_to_role,
          situation: agentProfileRow.adapt_to_situation,
          authority: agentProfileRow.adapt_to_authority,
        },
      }
    : DEFAULT_AGENT_PROFILE;

  // Build relationship
  const relationship: RelationshipData = relationshipRow
    ? {
        familiarityScore: Number(relationshipRow.familiarity_score),
        trustScore: Number(relationshipRow.trust_score),
        sentimentScore: Number(relationshipRow.sentiment_score),
        relationshipScore: Number(relationshipRow.relationship_score),
        totalConversations: relationshipRow.total_conversations,
        lastInteraction: relationshipRow.last_interaction_at,
      }
    : DEFAULT_RELATIONSHIP;

  // Build profile context
  const role = (profileRow?.role ?? "employee") as ProfileRole;
  const profile = {
    id: profileId,
    name: profileRow?.display_name ?? "Ansatt",
    role,
    department: (profileRow?.department as { name: string } | null)?.name ?? null,
    team: (profileRow?.team as { name: string } | null)?.name ?? null,
    status: profileRow?.status ?? "active",
    preferredLanguage: profileRow?.preferred_language ?? "no",
  };

  // Resolve posture
  const resolvedPosture = resolvePosture(
    agentProfile.personality,
    role,
    situation,
    authority,
    relationship.relationshipScore,
    agentProfile.adaptFlags,
  );

  // Time context
  const now = new Date();
  const days = ["sondag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag"];
  const dayOfWeek = days[now.getDay()] ?? "ukjent";
  const timeStr = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return {
    profile,
    currentTime: timeStr,
    dayOfWeek,
    activeShift: activeShiftRow
      ? {
          start: activeShiftRow.start_time,
          end: activeShiftRow.end_time,
          role: activeShiftRow.role ?? "",
          department: (activeShiftRow.department as { name: string } | null)?.name ?? "",
        }
      : null,
    relationship,
    relevantMemories: memories.map((m) => ({
      content: m.content,
      type: m.memory_type,
      scope: m.scope,
      importance: Number(m.importance),
    })),
    agentProfile,
    resolvedPosture,
  };
}
```

**Step 2: Add export to package.json**

Add to `exports` in `packages/ai/package.json`:

```json
"./context/collector": {
  "types": "./dist/context/collector.d.ts",
  "default": "./dist/context/collector.js"
}
```

**Step 3: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(ai): add context collector — parallel data fetching for agent pipeline
```

---

## Phase 4: Prompt Builder Upgrade

### Task 7: Rewrite buildBotssonPrompt to accept AgentContext

**Files:**

- Modify: `packages/ai/src/prompts/mr-botsson.ts`

**Step 1: Rewrite the file**

Replace entire contents of `packages/ai/src/prompts/mr-botsson.ts`:

```typescript
import type { AgentContext } from "../context/types.js";
import type { ResolvedPosture } from "../capabilities/types.js";

// Keep backwards-compatible type for existing callers during migration
export type BotssonPromptInput = {
  workspaceName: string;
  employeeName: string;
  employeeRole: string;
  departmentName: string;
  teamName: string;
  teamLeader: string;
  status: string;
  readinessScore: number | null;
  recentMemories: string[];
  toolDescriptions: string[];
  language: "no" | "en";
};

function postureToText(p: ResolvedPosture): string {
  const traits: string[] = [];

  if (p.formality > 0.7) traits.push("formell og profesjonell");
  else if (p.formality < 0.3) traits.push("uformell og avslappet");

  if (p.assertiveness > 0.7) traits.push("direkte og handlekraftig");
  else if (p.assertiveness < 0.3) traits.push("forsiktig og radgivende");

  if (p.warmth > 0.7) traits.push("varm og empatisk");
  else if (p.warmth < 0.3) traits.push("saklig og noyaktig");

  if (p.humor > 0.5) traits.push("bruk litt humor der det passer");

  if (p.verbosity > 0.7) traits.push("gi detaljerte forklaringer");
  else if (p.verbosity < 0.3) traits.push("vær kort og konsis");

  return traits.length > 0 ? traits.join(", ") : "vennlig og profesjonell";
}

function relationshipToText(r: AgentContext["relationship"], name: string): string {
  if (r.totalConversations === 0) {
    return `Dette er forste gang du snakker med ${name}. Introduser deg og vær ekstra hjelpsom.`;
  }

  const famText =
    r.familiarityScore > 0.6
      ? `Du kjenner ${name} godt (${r.totalConversations} samtaler).`
      : `Du har snakket med ${name} ${r.totalConversations} ganger.`;

  const sentText =
    r.sentimentScore > 0.7
      ? "Samtalene har vært positive."
      : r.sentimentScore < 0.3
        ? "Vær ekstra oppmerksom — tidligere samtaler har vært utfordrende."
        : "";

  return [famText, sentText].filter(Boolean).join(" ");
}

/**
 * Build system prompt from full AgentContext.
 * Primary path — used by the new pipeline.
 */
export function buildBotssonPromptFromContext(
  ctx: AgentContext,
  toolDescriptions: string[],
): string {
  const { profile, agentProfile, resolvedPosture, relationship, relevantMemories } = ctx;

  const lang = profile.preferredLanguage === "en" ? "English" : "Norwegian";

  const memorySection =
    relevantMemories.length > 0
      ? relevantMemories.map((m) => `- [${m.scope}] ${m.content}`).join("\n")
      : "Ingen tidligere minner registrert.";

  const toolSection =
    toolDescriptions.length > 0
      ? toolDescriptions.map((t) => `- ${t}`).join("\n")
      : "Ingen verktoy tilgjengelig.";

  return `# ${agentProfile.displayName} — AI-kollega

Du er ${agentProfile.displayName}. Du snakker ${lang === "Norwegian" ? "norsk" : "engelsk"} med ${profile.name}.

## Din personlighet
Vær ${postureToText(resolvedPosture)}.
Aldri lat som du vet noe du ikke vet.

## Om ${profile.name}
- Rolle: ${profile.role}${profile.department ? ` i ${profile.department}` : ""}
- Team: ${profile.team ?? "Ikke tilordnet"}
- Status: ${profile.status}
- Tidspunkt: ${ctx.currentTime}${ctx.activeShift ? `\n- På vakt: ${ctx.activeShift.start}–${ctx.activeShift.end} som ${ctx.activeShift.role}` : ""}

## Deres relasjon
${relationshipToText(relationship, profile.name)}

## Minner
${memorySection}

## Tilgjengelige handlinger
${toolSection}

## Regler
- Svar alltid pa ${lang === "Norwegian" ? "norsk" : "engelsk"} med mindre brukeren skifter sprak
- Bruk verktoyene dine for a sla opp informasjon — aldri gjett
- Hvis du er usikker, si det og foresla hvem de kan kontakte
- Aldri del sensitiv informasjon om andre ansatte
- Hvis et verktoy feiler, si fra og foresla en alternativ losning`;
}

/**
 * Legacy prompt builder — kept for backwards compatibility.
 * Used by callers that haven't migrated to AgentContext yet.
 */
export function buildBotssonPrompt(input: BotssonPromptInput): string {
  const memorySection =
    input.recentMemories.length > 0
      ? input.recentMemories.map((m) => `- ${m}`).join("\n")
      : "Ingen tidligere samtaler registrert.";

  const toolSection =
    input.toolDescriptions.length > 0
      ? input.toolDescriptions.map((t) => `- ${t}`).join("\n")
      : "Ingen verktoy tilgjengelig.";

  const lang = input.language === "en" ? "English" : "Norwegian";

  return `# Mr. Botsson — AI-kollega hos ${input.workspaceName}

Du er Mr. Botsson, en hjelpsom AI-kollega. Du snakker ${lang === "Norwegian" ? "norsk" : "engelsk"} med ${input.employeeName}.

## Din personlighet
- Vennlig, direkte, profesjonell
- Tilpass tonen til konteksten (casual for daglige sporsmal, formell for HR-saker)
- Aldri lat som du vet noe du ikke vet
- Hold svarene korte og konsise med mindre brukeren ber om detaljer

## Om ${input.employeeName}
- Rolle: ${input.employeeRole} i ${input.departmentName}
- Team: ${input.teamName} (teamleder: ${input.teamLeader})
- Status: ${input.status}${input.readinessScore !== null ? `\n- Readiness: ${input.readinessScore}%` : ""}

## Nylige samtaler
${memorySection}

## Tilgjengelige handlinger
${toolSection}

## Regler
- Svar alltid pa ${lang === "Norwegian" ? "norsk" : "engelsk"} med mindre brukeren skifter sprak
- Bruk verktoyene dine for a sla opp informasjon — aldri gjett
- Hvis du er usikker, si det og foresla hvem de kan kontakte
- Aldri del sensitiv informasjon om andre ansatte
- Hvis et verktoy feiler, si fra og foresla en alternativ losning`;
}
```

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/ai typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(ai): rewrite prompt builder with posture-aware buildBotssonPromptFromContext
```

---

## Phase 5: Stage Engine Integration

### Task 8: Create relationship manager

**Files:**

- Create: `services/stage-engine/src/core/relationship-manager.ts`

**Step 1: Write relationship-manager.ts**

```typescript
import { supabaseAdmin } from "../lib/supabase.js";

export type Relationship = {
  familiarityScore: number;
  trustScore: number;
  sentimentScore: number;
  relationshipScore: number;
  totalConversations: number;
  lastInteraction: string | null;
};

/**
 * Loads or creates the relationship between agent and profile.
 */
export async function loadRelationship(
  workspaceId: string,
  profileId: string,
): Promise<Relationship> {
  // First get agent_profile for this workspace
  const { data: agentProfile } = await supabaseAdmin
    .from("agent_profile")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!agentProfile) {
    return {
      familiarityScore: 0,
      trustScore: 0,
      sentimentScore: 0.5,
      relationshipScore: 0,
      totalConversations: 0,
      lastInteraction: null,
    };
  }

  const { data: rel } = await supabaseAdmin
    .from("agent_relationship")
    .select("*")
    .eq("agent_profile_id", agentProfile.id)
    .eq("profile_id", profileId)
    .single();

  if (!rel) {
    // Auto-create relationship on first interaction
    const { data: newRel } = await supabaseAdmin
      .from("agent_relationship")
      .insert({
        workspace_id: workspaceId,
        agent_profile_id: agentProfile.id,
        profile_id: profileId,
      })
      .select()
      .single();

    return {
      familiarityScore: 0,
      trustScore: 0,
      sentimentScore: 0.5,
      relationshipScore: 0,
      totalConversations: 0,
      lastInteraction: null,
    };
  }

  return {
    familiarityScore: Number(rel.familiarity_score),
    trustScore: Number(rel.trust_score),
    sentimentScore: Number(rel.sentiment_score),
    relationshipScore: Number(rel.relationship_score),
    totalConversations: rel.total_conversations,
    lastInteraction: rel.last_interaction_at,
  };
}

/**
 * Updates relationship after a session ends.
 * Increments conversation count, updates familiarity, and recomputes composite.
 */
export async function updateRelationshipAfterSession(
  workspaceId: string,
  profileId: string,
  sessionMinutes: number,
  sentiment: "positive" | "neutral" | "negative",
): Promise<void> {
  const { data: agentProfile } = await supabaseAdmin
    .from("agent_profile")
    .select("id")
    .eq("workspace_id", workspaceId)
    .single();

  if (!agentProfile) return;

  const { data: rel } = await supabaseAdmin
    .from("agent_relationship")
    .select("*")
    .eq("agent_profile_id", agentProfile.id)
    .eq("profile_id", profileId)
    .single();

  if (!rel) return;

  const newConversations = rel.total_conversations + 1;
  const newMinutes = Number(rel.total_minutes) + sessionMinutes;

  // Familiarity: logarithmic growth, caps at 1.0
  const familiarity = Math.min(1.0, Math.log10(newConversations + 1) / Math.log10(50));

  // Sentiment update
  const posCount = rel.positive_count + (sentiment === "positive" ? 1 : 0);
  const neuCount = rel.neutral_count + (sentiment === "neutral" ? 1 : 0);
  const negCount = rel.negative_count + (sentiment === "negative" ? 1 : 0);
  const total = posCount + neuCount + negCount;
  const sentimentScore = total > 0 ? (posCount + neuCount * 0.5) / total : 0.5;

  // Composite: 0.3 familiarity + 0.4 trust + 0.3 sentiment
  const composite = 0.3 * familiarity + 0.4 * Number(rel.trust_score) + 0.3 * sentimentScore;

  await supabaseAdmin
    .from("agent_relationship")
    .update({
      total_conversations: newConversations,
      total_minutes: newMinutes,
      last_interaction_at: new Date().toISOString(),
      familiarity_score: familiarity,
      positive_count: posCount,
      neutral_count: neuCount,
      negative_count: negCount,
      sentiment_score: sentimentScore,
      relationship_score: Math.min(1.0, composite),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rel.id);
}
```

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/stage-engine typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(stage-engine): add relationship manager — load, create, update after sessions
```

---

### Task 9: Update agent-router to use context collector

**Files:**

- Modify: `services/stage-engine/src/core/agent-router.ts`

**Step 1: Update imports and pipeline**

Replace the full file content. Key changes:

1. Import `collectContext` from `@smartout/ai/context/collector`
2. Import `buildBotssonPromptFromContext` from `@smartout/ai/prompts/mr-botsson`
3. Replace `loadProfileContext()` + `loadRecentMemories()` with single `collectContext()` call
4. Use `buildBotssonPromptFromContext()` with full `AgentContext`
5. Add `updateRelationshipAfterSession()` call after response

The new `routeAgentMessage` function:

```typescript
import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { classifyIntent } from "@smartout/ai/router/intent-classifier";
import { selectTools } from "@smartout/ai/router/tool-selector";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getSecrets } from "../secrets.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

// ... getOpenRouter() stays the same ...

type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
  situation?: Situation;
};

export async function routeAgentMessage(input: AgentRouterInput): Promise<AgentChatResponse> {
  const {
    message,
    sessionId,
    workspaceId,
    profileId,
    userId,
    conversationHistory,
    situation = "general",
  } = input;

  // Step 1: Load authority config
  const authorityConfig = await loadAuthorityConfig(workspaceId);

  // Step 2: Classify intent
  const intent = await classifyIntent(message, "", {
    apiKey: getSecrets().openrouterApiKey ?? undefined,
  });

  // Determine situation from intent if not provided
  const resolvedSituation: Situation =
    situation !== "general"
      ? situation
      : intent.capability === "schedule"
        ? "scheduling"
        : intent.capability === "training"
          ? "training"
          : intent.capability === "operations"
            ? "operations"
            : "general";

  // Determine authority for the matched capability
  const authority = authorityConfig[intent.capability] ?? "suggest";

  // Step 3: Collect full context (parallel fetch)
  const ctx = await collectContext({
    workspaceId,
    profileId,
    situation: resolvedSituation,
    authority,
    supabaseAdmin,
  });

  // Step 4: Select tools
  const selectedTools = selectTools(intent, authorityConfig);

  // Step 5: Build prompt from full context
  const systemPrompt = buildBotssonPromptFromContext(
    ctx,
    selectedTools.map((t) => `${t.name}: ${t.description}`),
  );

  // Build messages
  const messages = conversationHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: message });

  // Step 6: Run LLM
  const toolContext = { workspaceId, profileId, userId, sessionId, supabaseAdmin };
  const vercelTools = toVercelTools(selectedTools, toolContext);

  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4"),
    system: systemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(5),
  });

  return {
    session_id: sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };
}
```

**Step 2: Typecheck**

Run: `pnpm --filter @smartout/stage-engine typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(stage-engine): integrate context collector and posture-aware prompts into agent router
```

---

## Phase 6: Auto-Create Agent Profile

### Task 10: Create default agent_profile on workspace activation

**Files:**

- Modify: `supabase/functions/activate-workspace/index.ts`

**Step 1: Add agent_profile creation**

After the existing workspace activation logic, add:

```typescript
// Create default agent profile for Mr. Botsson
await supabaseAdmin
  .from("agent_profile")
  .insert({
    workspace_id: workspaceId,
  })
  .single();
```

This uses all column defaults (Mr. Botsson, mark voice, standard personality).

**Step 2: Commit**

```
feat(edge-fn): auto-create default agent_profile on workspace activation
```

---

## Phase 7: Typecheck & Build

### Task 11: Full typecheck and build

**Step 1: Typecheck all packages**

Run: `pnpm turbo typecheck`
Expected: All packages PASS (18/18)

**Step 2: Build AI package**

Run: `pnpm --filter @smartout/ai build`
Expected: PASS — all new exports compile

**Step 3: Build Stage Engine**

Run: `pnpm --filter @smartout/stage-engine build`
Expected: PASS

**Step 4: Commit any fixes**

```
chore: fix typecheck issues from agent profile integration
```

---

## Summary

| Phase | Tasks     | What                                            |
| ----- | --------- | ----------------------------------------------- |
| 1     | Task 1    | Migration: 2 new tables + 3 ALTER columns       |
| 2     | Tasks 2–4 | Types, posture resolver, stage voice override   |
| 3     | Tasks 5–6 | Context types + collector                       |
| 4     | Task 7    | Prompt builder upgrade                          |
| 5     | Tasks 8–9 | Relationship manager + agent router integration |
| 6     | Task 10   | Auto-create on workspace activation             |
| 7     | Task 11   | Full typecheck + build                          |

**Total: 11 tasks across 7 phases.**
