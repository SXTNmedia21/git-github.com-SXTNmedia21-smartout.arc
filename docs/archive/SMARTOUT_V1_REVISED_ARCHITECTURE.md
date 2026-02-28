---
title: "Smartout V1 Revised Architecture"
id: ARCH_V1_REVISED
version: "1.0"
status: archived
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
superseded_by: CORE_ARCH_V2
tags: [archived, architecture, v1]
changelog:
  - date: 2026-02-28
    change: "Archived — superseded by CORE_ARCH_V2"
---

# SMARTOUT V1 — Revised Architecture (Post-Discovery)

> **Date:** February 24, 2026  
> **Status:** Updated after repo agent discovery  
> **Key finding:** 80% of the voice infrastructure already exists

---

## 1. What We Don't Need to Build

The repo discovery revealed that the entire voice pipeline is operational:

| Component               | Status                                         | Location                                                                       |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Voice MCP server        | ✅ Production on Vercel                        | `mcp-servers/intervju-mcp/`                                                    |
| Journey/mission system  | ✅ Working with 4 missions                     | `mission_definitions` + `stage_definitions` + `interview_sessions` in Supabase |
| Ultravox WebRTC client  | ✅ Full implementation                         | `ai_layer/apps/dashboard/src/components/voice-calls/browser-call.tsx`          |
| Call creation API       | ✅ Working                                     | `ai_layer/apps/dashboard/src/app/api/voice-calls/`                             |
| Stage prompt builder    | ✅ Generic, works for any mission              | `buildStagePrompt()`                                                           |
| Norwegian voice config  | ✅ Configured (languageHint: "no")             | Call creation payload                                                          |
| Mute/unmute/transcripts | ✅ Built into BrowserCall                      | Component props                                                                |
| Status indicators       | ✅ Color-coded (gray→yellow→cyan→blue→magenta) | BrowserCall component                                                          |
| Tool proxy pattern      | ✅ Exists for advance_stage                    | `/api/voice-calls/tools/`                                                      |
| Session persistence     | ✅ Supabase with JSONB collected_data          | `interview_sessions` table                                                     |

**This means V1 voice work reduces to:**

1. Insert 1 mission + 7 stage definitions into Supabase
2. Write system prompts for each stage (Norwegian, restaurant context)
3. Register additional tools (create_department, etc.) alongside advance_stage
4. Build the wizard UI that syncs with BrowserCall + MCP session state
5. Wire entity-creation tools to Supabase Core tables

---

## 2. The Integration Pattern

### How a wizard session works (end to end):

```
ADMIN CLICKS "Start oppsett" ON WIZARD PAGE
  │
  ├── 1. Dashboard calls POST /api/voice-calls
  │       Body: { mission_id: "workspace-setup", workspace_id: ws_123 }
  │
  ├── 2. API route calls intervju-mcp POST /api/interview/start
  │       ← Returns: { session_id, mission, user_prompt, stage: "departments", progress: "1/7" }
  │
  ├── 3. API route builds system prompt via buildStagePrompt(mission, sessionId, "1/7")
  │       Prompt: "Du er Mr. Botsson. Du hjelper en restaurantsjef å sette opp avdelinger..."
  │
  ├── 4. API route registers tools in Ultravox call payload:
  │       - advance_stage (existing HTTP tool → MCP)
  │       - create_department (NEW HTTP tool → Supabase Edge Function)
  │       - create_location (NEW)
  │       - create_zone (NEW)
  │       - create_asset (NEW)
  │       - create_position (NEW)
  │       - create_team (NEW)
  │       - suggest_defaults (NEW → returns industry suggestions)
  │       - get_wizard_state (NEW → returns what's been created so far)
  │
  ├── 5. API route calls POST https://api.ultravox.ai/api/calls
  │       ← Returns: { callId, joinUrl }
  │
  ├── 6. Dashboard receives joinUrl, passes to <BrowserCall joinUrl={joinUrl} />
  │       WebRTC connects. Mr. Botsson starts speaking.
  │
  └── 7. WIZARD LOOP:
          │
          ├── Mr. Botsson explains the step (voice)
          ├── Admin responds (voice or UI form)
          │
          ├── If voice: Ultravox calls create_department tool (HTTP)
          │     → Supabase Edge Function creates department row
          │     → Returns confirmation to Ultravox
          │     → Mr. Botsson: "Flott! Kjøkken er lagt til. Har dere flere avdelinger?"
          │
          ├── If UI form: Admin types/clicks in wizard form
          │     → React mutation creates department row via TanStack Query
          │     → UI updates
          │     → (Mr. Botsson can see via get_wizard_state tool)
          │
          ├── When stage goals met:
          │     Ultravox calls advance_stage tool (HTTP → MCP)
          │     → MCP advances session to next stage
          │     → Returns new system prompt via X-Ultravox-Response-Type: new-stage
          │     → Mr. Botsson seamlessly transitions to next topic
          │     → Wizard UI advances to next step (via callback_url or polling)
          │
          └── Repeat until stage 7 complete → session status: 'complete'
```

### Dual input model (voice + UI):

```
┌─────────────────────────────────────────────────────────────────┐
│                        WIZARD STEP UI                           │
│                                                                 │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │                          │  │  Mr. Botsson               │  │
│  │  Department Form         │  │  ┌──────────────────────┐  │  │
│  │                          │  │  │ ● Speaking           │  │  │
│  │  [Kjøkken        ] ✓    │  │  │   "Hvilke avdelinger │  │  │
│  │  [Sal            ] ✓    │  │  │    har dere?"        │  │  │
│  │  [Bar            ] ✓    │  │  └──────────────────────┘  │  │
│  │  [              ] + Add  │  │                            │  │
│  │                          │  │  [🔇 Mute] [⏭ Skip voice] │  │
│  │  AI Suggestions:         │  │                            │  │
│  │  Based on restaurant:    │  │  Transcript:               │  │
│  │  ○ Renhold               │  │  Mr. B: "Bra! Tre avd..." │  │
│  │  ○ Lager                 │  │  You: "Vi har også en..."  │  │
│  │                          │  │                            │  │
│  └──────────────────────────┘  └────────────────────────────┘  │
│                                                                 │
│  ████████░░░░░░ Step 1 of 7: Avdelinger                        │
│  [← Back]                              [Next: Lokasjoner →]    │
└─────────────────────────────────────────────────────────────────┘
```

Both paths write to the same Supabase tables. The wizard form and Mr. Botsson tools are two interfaces to the same data. Real-time sync via:

- Voice creates entity → Supabase Realtime subscription → UI updates
- UI creates entity → get_wizard_state tool → Mr. Botsson knows

---

## 3. Mission & Stage Definitions

### Mission: workspace-setup

```sql
INSERT INTO mission_definitions (id, name, description, estimated_duration, is_active, workspace_id)
VALUES (
  'workspace-setup',
  'Workspace Setup',
  'Guided 7-step journey to configure a restaurant workspace in Smartout',
  '15-20 minutes',
  true,
  null  -- global, available to all workspaces
);
```

### 7 Stage Definitions

```sql
-- Stage 1: Departments
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'departments', 1, 'departments', 'locations',
  'Understand and create the departments for this restaurant',
  'Warm, educational, direct. You are teaching the admin to think in terms of organizational divisions.',
  'Explain what a department means in Smartout (fixed organizational division — Kitchen, Service, Bar, etc.). Suggest defaults based on industry. Help create each department. Ask if they have more. Confirm the full list before advancing.',
  'At least 1 department created. Admin confirms the list is complete.',
  'Let''s set up your restaurant''s departments. What divisions do you work with?',
  'La oss sette opp avdelingene i restauranten din. Hvilke avdelinger har dere?'
);

-- Stage 2: Locations
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'locations', 2, 'locations', 'zones',
  'Map the physical areas of the workspace',
  'Curious, practical. Help the admin see their restaurant as distinct physical spaces.',
  'Explain that locations are physical areas (Inside, Outside, Kitchen area, etc.). Different from departments — a department can span locations. Give examples. Help create each location.',
  'At least 1 location created. Admin confirms.',
  'Now let''s map out your physical spaces. Where does the work happen?',
  'Nå skal vi kartlegge de fysiske områdene. Hvor foregår arbeidet?'
);

-- Stage 3: Zones
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'zones', 3, 'zones', 'assets',
  'Define service zones within locations',
  'Patient, clear. This is the most abstract concept — use concrete examples.',
  'Explain zones as sections within a location (Zone 1, Seaside section, Bar area within Inside). Link to scheduling: "shifts can be assigned to zones." This step is OPTIONAL — if the admin says they don''t need zones, that''s fine. Skip gracefully.',
  'Admin either creates zones or explicitly skips. No zombie state.',
  'Within your locations, do you have distinct service sections?',
  'Innenfor områdene deres, har dere adskilte seksjoner for servering?'
);

-- Stage 4: Assets
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'assets', 4, 'assets', 'positions',
  'Identify equipment and assets that need tracking',
  'Practical, forward-thinking. Connect assets to future features (training, maintenance, HACCP).',
  'Explain assets as equipment that needs training or maintenance — registers, fridges, ovens, dishwashers. Mention that assets can later have policies (temperature checks, cleaning schedules). OPTIONAL step — skip if not relevant.',
  'Admin either creates assets or explicitly skips.',
  'Do you have equipment that requires training or regular maintenance?',
  'Har dere utstyr som krever opplæring eller regelmessig vedlikehold?'
);

-- Stage 5: Positions
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'positions', 5, 'positions', 'teams',
  'Define position types per department',
  'Organized, helpful. Connect to previously created departments.',
  'Explain that positions are role types within departments (Kokk in Kitchen, Servitør in Service). Suggest defaults based on industry + the departments already created. Mention that positions are assigned per shift, not per person — a person can work different positions on different days.',
  'At least 1 position per department. Admin confirms.',
  'What roles exist in each department?',
  'Hvilke stillinger finnes i hver avdeling?'
);

-- Stage 6: Teams
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'teams', 6, 'teams', 'settings',
  'Create optional team groupings',
  'Encouraging, flexible. Teams are advanced — be ready to skip.',
  'Explain teams as dynamic groups (Lunch crew, Event team, cross-departmental HSE group). Different from departments: departments are fixed structure, teams are flexible. This is OPTIONAL and can be done later. Don''t pressure.',
  'Admin either creates teams or explicitly skips.',
  'Do you want to set up any teams? These are flexible groups that can cross departments.',
  'Vil dere sette opp noen team? Dette er fleksible grupper som kan gå på tvers av avdelinger.'
);

-- Stage 7: Settings
INSERT INTO stage_definitions (
  mission_id, stage_id, stage_order, field_to_collect, next_stage,
  goal, personality, instructions, success_when,
  user_prompt, user_prompt_no
) VALUES (
  'workspace-setup', 'settings', 7, 'settings', null,  -- null = terminal stage
  'Confirm workspace settings and celebrate completion',
  'Celebratory, summarizing. This is the finish line.',
  'Review and confirm: timezone, language, default shift length, break rules. Summarize everything that was created (X departments, Y locations, Z positions...). Celebrate completion. Explain what comes next (inviting employees, scheduling).',
  'Admin confirms settings. Summary acknowledged.',
  'Almost done! Let''s confirm your settings and review what we built.',
  'Nesten ferdig! La oss bekrefte innstillingene og se over det vi har bygget.'
);
```

---

## 4. New Tools to Register

These are HTTP tools that Ultravox calls during the wizard. Each hits a Supabase Edge Function or Next.js API route.

### Tool Definitions (added to selectedTools array in call creation)

```typescript
const wizardTools = [
  // EXISTING — stage advancement
  {
    temporaryTool: {
      modelToolName: "advance_stage",
      description: "Call when the current stage goal is achieved and admin is ready to move on",
      dynamicParameters: [
        {
          name: "result",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Summary of what was accomplished in this stage" },
          required: true,
        },
      ],
      staticParameters: [
        { name: "session_id", value: "{mcpSessionId}" },
        { name: "goal_achieved", value: "true" },
      ],
      http: {
        baseUrlPattern: "{INTERVJU_MCP_URL}/api/ultravox/interview-respond",
        httpMethod: "POST",
      },
    },
  },

  // NEW — entity creation tools
  {
    temporaryTool: {
      modelToolName: "create_department",
      description: "Create a new department in the workspace. Use when admin names a department.",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Department name (e.g., Kjøkken, Sal, Bar)" },
          required: true,
        },
        {
          name: "color",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Hex color code for UI" },
          required: false,
        },
        {
          name: "icon",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Emoji icon" },
          required: false,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-department",
        httpMethod: "POST",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "create_location",
      description: "Create a new physical location in the workspace.",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Location name (e.g., Innendørs, Utendørs, Kjøkken)",
          },
          required: true,
        },
        {
          name: "description",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Brief description of the location" },
          required: false,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-location",
        httpMethod: "POST",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "create_zone",
      description: "Create a service zone within a location.",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Zone name (e.g., Zone 1, Seaside, Penthouse)" },
          required: true,
        },
        {
          name: "location_name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Name of the parent location" },
          required: true,
        },
        {
          name: "capacity",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "integer", description: "Seating capacity" },
          required: false,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-zone",
        httpMethod: "POST",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "create_asset",
      description: "Register an equipment asset at a location.",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Asset name (e.g., Oppvaskmaskin, Kjøleskap)" },
          required: true,
        },
        {
          name: "location_name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Name of the location this asset belongs to" },
          required: true,
        },
        {
          name: "asset_type",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Type: equipment, safety, storage, or other" },
          required: true,
        },
        {
          name: "requires_training",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "boolean", description: "Does this asset require training to operate?" },
          required: false,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-asset",
        httpMethod: "POST",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "create_position",
      description: "Create a position/role type within a department.",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Position name (e.g., Kokk, Servitør, Bartender)",
          },
          required: true,
        },
        {
          name: "department_name",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description: "Name of the department this position belongs to",
          },
          required: true,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-position",
        httpMethod: "POST",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "create_team",
      description: "Create a team (dynamic group of employees).",
      dynamicParameters: [
        {
          name: "name",
          location: "PARAMETER_LOCATION_BODY",
          schema: { type: "string", description: "Team name (e.g., Lunsjteam, Eventcrew)" },
          required: true,
        },
        {
          name: "department_name",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              'Department name if team is department-specific, or "cross" for cross-departmental',
          },
          required: false,
        },
      ],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/create-team",
        httpMethod: "POST",
      },
    },
  },

  // NEW — state tools
  {
    temporaryTool: {
      modelToolName: "get_wizard_state",
      description:
        "Get the current state of the wizard — what has been created so far across all steps.",
      dynamicParameters: [],
      staticParameters: [{ name: "workspace_id", value: "{workspaceId}" }],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/state",
        httpMethod: "GET",
      },
    },
  },
  {
    temporaryTool: {
      modelToolName: "suggest_defaults",
      description:
        "Get AI-suggested defaults for the current wizard step based on industry and what has been created so far.",
      dynamicParameters: [
        {
          name: "step",
          location: "PARAMETER_LOCATION_BODY",
          schema: {
            type: "string",
            description:
              "Current wizard step: departments, locations, zones, assets, positions, teams, settings",
          },
          required: true,
        },
      ],
      staticParameters: [
        { name: "workspace_id", value: "{workspaceId}" },
        { name: "industry", value: "{industry}" },
      ],
      http: {
        baseUrlPattern: "{DASHBOARD_URL}/api/wizard/suggest",
        httpMethod: "POST",
      },
    },
  },
];
```

---

## 5. Revised Build Order (What's Actually New)

| Phase                           | What                                                                                                                                                     | Duration | Why                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------- |
| **0. Database**                 | SQL migrations for Core tables + RLS + seed data + mission/stage inserts                                                                                 | 3-4 days | Foundation everything else needs      |
| **1. Auth + Company/Workspace** | Signup, login, company creation, workspace creation (auto-creates profile + default season)                                                              | 2-3 days | Must exist before wizard              |
| **2. Wizard API routes**        | 9 routes under `/api/wizard/` (create-department, create-location, create-zone, create-asset, create-position, create-team, state, suggest, settings)    | 3-4 days | HTTP endpoints for Ultravox tools     |
| **3. Wizard UI shell**          | 7-step wizard with progress bar, navigation, state management. Forms for each step. Supabase Realtime subscriptions for voice-created entities.          | 5-7 days | The visual experience                 |
| **4. Voice integration**        | Import BrowserCall component. Wire up call creation with workspace-setup mission + all tools. Handle stage transitions (MCP callback → UI step advance). | 2-3 days | Plugging into existing infrastructure |
| **5. Infographics**             | 7 SVG/React visual explanations                                                                                                                          | 3-4 days | Educational layer                     |
| **6. Dashboard**                | Read-only org structure view + edit mode                                                                                                                 | 2-3 days | Post-wizard landing                   |
| **7. Polish**                   | Completion celebration, error states, resume-from-last-step, loading states                                                                              | 2-3 days | Production readiness                  |

**Revised total: 4-5 weeks** (down from 6-8, because phases 7-8 from the original plan are now just phase 4)

---

## 6. Gotcha Mitigations

| Gotcha                               | Solution                                                                                                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **One tool per call currently**      | Register all 10 tools in the selectedTools array. Ultravox supports multiple tools — the repo just only used one.                                                                                                                          |
| **collected_data is flat JSONB**     | Use it for session metadata only. Actual entities (departments, locations) are written to Core tables directly via the HTTP tools. collected_data tracks stage summaries.                                                                  |
| **No undo/go-back in MCP**           | Wizard UI handles back navigation independently. MCP tracks the "furthest stage reached." Going back in the UI doesn't reverse the MCP stage — it just lets the admin edit. advance_stage only fires when moving to a genuinely NEW stage. |
| **System prompt replaced per stage** | Perfect for the wizard. Each stage gets fresh context. Include a summary of collected_data so Mr. Botsson knows what was already created in previous stages.                                                                               |
| **5-min stage cache**                | Not an issue — wizard stages are static seed data, not dynamically edited.                                                                                                                                                                 |
| **24h session expiry**               | Fine for wizard. Add a "resume wizard" flow: check for active interview_session with mission_id='workspace-setup' on login → offer to continue.                                                                                            |

---

## 7. Key Files to Touch in Existing Repo

| File/Location                                                         | Action                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `ai_layer/apps/dashboard/src/app/api/voice-calls/route.ts`            | Extend to support workspace-setup mission + additional tools |
| `ai_layer/apps/dashboard/src/components/voice-calls/browser-call.tsx` | Import as-is into wizard page                                |
| `ai_layer/apps/dashboard/src/lib/voice-calls/`                        | Reuse MCP client, prompt builders, types                     |
| `mcp-servers/intervju-mcp/`                                           | No changes needed — just seed the mission/stage data         |
| NEW: `src/app/api/wizard/*.ts`                                        | 9 new API routes for entity creation + state                 |
| NEW: `src/app/(setup)/wizard/`                                        | 7 wizard step pages                                          |
| NEW: `src/components/wizard/`                                         | Wizard shell, step components, infographics                  |
| NEW: `supabase/migrations/`                                           | Core schema SQL                                              |

---

_The voice infrastructure is a multiplier, not a blocker. What would have been the hardest part of V1 (Ultravox + WebRTC + session management + Norwegian voice) is already solved. The work is now: database schema, wizard UI, and wiring the two together through HTTP tools._
