---
title: Full CRUD Phase 0 — Blocking Prerequisites
status: complete
created: 2026-04-10
updated: 2026-04-10
module: platform
tags: [plan, telemetry, agent, security, packages]
---

# Full CRUD Phase 0 — Blocking Prerequisites

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three blocking gaps (mobile telemetry, agent channel propagation, authority role gating) and scaffold `packages/data/` — before any new CRUD work begins.

**Architecture:** Four independent workstreams. Mobile telemetry adds `emit()` to all 12 mutation hooks via a new `emit.native.ts` transport (React Native compatible). Agent channel propagation wires `channel` from chat.ts through AgentRouterInput into AgentToolContext. Authority gets `min_role` column. `packages/data/` is scaffolded as a raw TypeScript package with validators, permissions, and cascade classification.

**Tech Stack:** TypeScript, Supabase (migrations), React Native, TanStack Query, Zod, pnpm workspaces

---

## File Map

### Task 1: Mobile Telemetry

| Action | File |
|--------|------|
| Create | `packages/telemetry/src/emit.native.ts` |
| Create | `packages/telemetry/src/providers/posthog-native.ts` |
| Modify | `packages/telemetry/package.json` (add `react-native` export condition) |
| Modify | `apps/mobile/src/hooks/mutations/use-punch.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-request-absence.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-cancel-absence.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-confirm-hours.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-log-haccp.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-report-deviation.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-submit-handoff.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-send-message.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-send-channel-message.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-livekit-call.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-call-signaling.ts` |
| Modify | `apps/mobile/src/hooks/mutations/use-push-to-talk.ts` |

### Task 2: Agent Channel Propagation

| Action | File |
|--------|------|
| Modify | `services/stage-engine/src/core/agent-router.ts` (add `channel` to AgentRouterInput) |
| Modify | `services/stage-engine/src/routes/agent/chat.ts` (pass `channel` to routeAgentMessage) |
| Modify | `services/stage-engine/src/core/agent-router.ts` (populate toolContext.channel) |

### Task 3: Authority min_role

| Action | File |
|--------|------|
| Create | `supabase/migrations/YYYYMMDDHHMMSS_add_min_role_to_authority_config.sql` |
| Modify | Authority check logic (wherever authority is resolved) |

### Task 4: packages/data/ Scaffold

| Action | File |
|--------|------|
| Create | `packages/data/package.json` |
| Create | `packages/data/tsconfig.json` |
| Create | `packages/data/src/index.ts` |
| Create | `packages/data/src/validators/index.ts` |
| Create | `packages/data/src/permissions/check.ts` |
| Create | `packages/data/src/permissions/index.ts` |
| Create | `packages/data/src/cascade/classify.ts` |
| Create | `packages/data/src/cascade/index.ts` |
| Create | `packages/data/src/telemetry/events.ts` |
| Create | `packages/data/src/telemetry/index.ts` |

---

## Task 1: Mobile Telemetry — Add emit() to All Mutation Hooks

The current `emit.client.ts` uses browser-only APIs (`CustomEvent`, `window`, `posthog-js`, `fetch("/api/telemetry")`). React Native needs its own transport.

### Task 1.1: Create emit.native.ts

**Files:**
- Create: `packages/telemetry/src/emit.native.ts`
- Create: `packages/telemetry/src/providers/posthog-native.ts`
- Modify: `packages/telemetry/package.json`

- [x] **Step 1: Read the existing emit.client.ts to understand the contract**

Read `packages/telemetry/src/emit.client.ts` and `packages/telemetry/src/registry.ts` to understand:
- The `SmartoutEvent` type and `emit()` signature
- The `EVENT_ROUTING` map
- How destinations are dispatched

- [x] **Step 2: Create posthog-native.ts provider**

```typescript
// packages/telemetry/src/providers/posthog-native.ts
import type { SmartoutEvent } from "../registry"

/**
 * PostHog provider for React Native.
 * Uses posthog-react-native SDK which is already an Expo dependency.
 * Falls back to no-op if PostHog is not initialized.
 */
export function capturePostHogNative(event: SmartoutEvent): void {
  try {
    // posthog-react-native exposes a global PostHog instance
    // Import dynamically to avoid crashes if not installed
    const PostHog = require("posthog-react-native")
    const client = PostHog.usePostHog?.() ?? PostHog.default?.getClient?.()
    if (!client) return

    client.capture(event.event, {
      workspace_id: event.workspace_id,
      actor_id: event.actor_id,
      ...event.properties,
    })
  } catch {
    // Silent fail — analytics should never crash the app
  }
}
```

- [x] **Step 3: Create emit.native.ts**

```typescript
// packages/telemetry/src/emit.native.ts
import { EVENT_ROUTING, type SmartoutEvent } from "./registry"
import { capturePostHogNative } from "./providers/posthog-native"

/**
 * React Native telemetry emitter.
 *
 * Handles two destinations:
 * - posthog: via posthog-react-native SDK (client-side)
 * - logger: console.log (dev only)
 *
 * Server-only destinations (activity_trail, engine_event) are proxied
 * through a Supabase Edge Function call, not fetch("/api/...") which
 * is browser-only.
 */
export async function emit(event: SmartoutEvent): Promise<void> {
  const destinations = EVENT_ROUTING[event.event]
  if (!destinations) {
    console.warn(`[telemetry] No routing for event: ${event.event}`)
    return
  }

  const tasks: Promise<void>[] = []

  for (const dest of destinations) {
    switch (dest) {
      case "posthog":
        capturePostHogNative(event)
        break
      case "logger":
        if (__DEV__) {
          console.log(`[telemetry] ${event.event}`, event.properties)
        }
        break
      case "activity_trail":
      case "engine_event":
        // Proxy server-only destinations through Edge Function
        tasks.push(proxyToServer(event, dest))
        break
    }
  }

  await Promise.allSettled(tasks)
}

async function proxyToServer(
  event: SmartoutEvent,
  destination: string
): Promise<void> {
  try {
    // Use the Supabase client from the app context
    // This import resolves to the mobile Supabase client
    const { supabase } = require("@/lib/supabase")
    await supabase.functions.invoke("telemetry-proxy", {
      body: { event, destination },
    })
  } catch {
    // Silent fail for server proxy
  }
}
```

- [x] **Step 4: Add react-native export condition to package.json**

In `packages/telemetry/package.json`, update the exports field:

```json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "react-native": "./src/index.native.ts",
      "react-server": "./src/index.ts",
      "default": "./src/index.client.ts"
    },
    "./server": "./src/index.ts",
    "./react": "./src/react.ts"
  }
}
```

- [x] **Step 5: Create index.native.ts that re-exports emit from emit.native.ts**

```typescript
// packages/telemetry/src/index.native.ts
export { emit } from "./emit.native"
export { type SmartoutEvent } from "./registry"
export { EVENT_ROUTING } from "./registry"
```

- [x] **Step 6: Commit**

```bash
git add packages/telemetry/src/emit.native.ts \
        packages/telemetry/src/index.native.ts \
        packages/telemetry/src/providers/posthog-native.ts \
        packages/telemetry/package.json
git commit -m "feat(telemetry): add React Native emit transport

Adds emit.native.ts with posthog-react-native provider and
Edge Function proxy for server-only destinations. Conditional
export via react-native field in package.json.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: Add emit() to All 12 Mobile Mutation Hooks

Each hook needs the same pattern: import emit, call it in `onSuccess` of the TanStack mutation. The hooks that use the sync queue (`enqueue()`) need emit in the queue worker's success callback instead.

**Pattern for direct mutations (use-send-message, use-send-channel-message):**

- [x] **Step 1: Add emit to use-send-message.ts**

Read `apps/mobile/src/hooks/mutations/use-send-message.ts`. Add:

```typescript
import { emit } from "@smartout/telemetry"
```

In the `onSuccess` callback of `useMutation`:

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "chat message_sent",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      channel_id: variables.channelId,
      has_attachments: (variables.attachments?.length ?? 0) > 0,
    },
  })
  // ... existing onSuccess logic (cache invalidation etc.)
},
```

- [x] **Step 2: Add emit to use-send-channel-message.ts**

Same pattern. Event: `"chat channel_message_sent"`.

- [x] **Step 3: Add emit to use-punch.ts**

This uses `enqueue()` for offline sync. Add emit in `onSuccess`:

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: variables.action === "punch_in" ? "shift punched_in" : "shift punched_out",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      time_entry_id: variables.timeEntryId,
      shift_id: variables.shiftId,
    },
  })
},
```

- [x] **Step 4: Add emit to use-request-absence.ts**

Event: `"absence requested"`. Properties: `type`, `start_date`, `end_date`.

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "absence requested",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      absence_type: variables.type,
      start_date: variables.startDate,
      end_date: variables.endDate,
    },
  })
},
```

- [x] **Step 5: Add emit to use-cancel-absence.ts**

Event: `"absence cancelled"`. Properties: `absence_id`.

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "absence cancelled",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: { absence_id: variables.absenceId },
  })
},
```

- [x] **Step 6: Add emit to use-confirm-hours.ts**

Event: `"shift hours_confirmed"`. Properties: `shift_id`, `status` (approved/disputed).

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "shift hours_confirmed",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      shift_id: variables.shiftId,
      status: variables.status,
    },
  })
},
```

- [x] **Step 7: Add emit to use-log-haccp.ts**

Event: `"haccp logged"`. Properties: `task_type`, `temperature`.

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "haccp logged",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      task_type: variables.taskType,
      logged_at: variables.loggedAt,
    },
  })
},
```

- [x] **Step 8: Add emit to use-report-deviation.ts**

Event: `"deviation reported"`. Properties: `domain`, `severity`.

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "deviation reported",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: {
      domain: variables.domain,
      severity: variables.severity,
    },
  })
},
```

- [x] **Step 9: Add emit to use-submit-handoff.ts**

Event: `"handoff submitted"`. Properties: `session_id`.

```typescript
onSuccess: (data, variables) => {
  void emit({
    event: "handoff submitted",
    workspace_id: variables.workspaceId,
    actor_id: variables.profileId,
    properties: { session_id: variables.sessionId },
  })
},
```

- [x] **Step 10: Add emit to use-livekit-call.ts, use-call-signaling.ts, use-push-to-talk.ts**

These are real-time communication hooks. Add emit for key lifecycle events:

- `use-livekit-call.ts`: Event `"call started"` on room connect, `"call ended"` on disconnect
- `use-call-signaling.ts`: This is read-only (subscribes to broadcast), skip emit — no mutation
- `use-push-to-talk.ts`: Already has telemetry via `@smartout/walkie-talkie` debouncer — verify it works, no change needed

- [x] **Step 11: Register new events in telemetry registry**

Modify `packages/telemetry/src/registry.ts` — add all new events to `EVENT_ROUTING`:

```typescript
// Mobile mutation events
"chat message_sent": ["posthog", "logger", "activity_trail"],
"chat channel_message_sent": ["posthog", "logger", "activity_trail"],
"shift punched_in": ["posthog", "logger", "activity_trail", "engine_event"],
"shift punched_out": ["posthog", "logger", "activity_trail", "engine_event"],
"absence requested": ["posthog", "logger", "activity_trail", "engine_event"],
"absence cancelled": ["posthog", "logger", "activity_trail"],
"shift hours_confirmed": ["posthog", "logger", "activity_trail", "engine_event"],
"haccp logged": ["posthog", "logger", "activity_trail"],
"deviation reported": ["posthog", "logger", "activity_trail", "engine_event"],
"handoff submitted": ["posthog", "logger", "activity_trail"],
"call started": ["posthog", "logger"],
"call ended": ["posthog", "logger"],
```

- [x] **Step 12: Commit all mutation hook changes**

```bash
git add apps/mobile/src/hooks/mutations/ packages/telemetry/src/registry.ts
git commit -m "feat(mobile): add telemetry emit to all mutation hooks

Adds emit() calls to 10 mobile mutation hooks (skip call-signaling
which is read-only, push-to-talk already has telemetry). Registers
12 new events in telemetry registry with appropriate routing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Agent Channel Propagation

Wire the `channel` field from chat.ts endpoint through AgentRouterInput into AgentToolContext so ADR-0078 PII defense works.

**Files:**
- Modify: `services/stage-engine/src/core/agent-router.ts`
- Modify: `services/stage-engine/src/routes/agent/chat.ts`

- [x] **Step 1: Read current agent-router.ts**

Read `services/stage-engine/src/core/agent-router.ts` to find the exact `AgentRouterInput` type definition and where `toolContext` is constructed.

- [x] **Step 2: Add channel to AgentRouterInput type**

In `services/stage-engine/src/core/agent-router.ts`, add `channel` to the type:

```typescript
type AgentRouterInput = {
  message: string
  sessionId: string
  workspaceId: string
  profileId: string
  userId?: string
  conversationHistory: ConversationTurn[]
  situation?: Situation
  pageContext?: string
  channel?: "chat" | "voice"  // ← ADD THIS
}
```

- [x] **Step 3: Populate toolContext.channel from input**

Find where `toolContext` is constructed in `routeAgentMessage()` and add:

```typescript
const toolContext: AgentToolContext = {
  workspaceId: input.workspaceId,
  profileId: input.profileId,
  userId: input.userId,
  sessionId: input.sessionId,
  supabaseAdmin,
  channel: input.channel,  // ← ADD THIS
}
```

- [x] **Step 4: Pass channel from chat.ts to routeAgentMessage**

In `services/stage-engine/src/routes/agent/chat.ts`, find the `routeAgentMessage()` call (around line 126-134) and add `channel`:

```typescript
const response = await routeAgentMessage({
  message,
  sessionId,
  workspaceId,
  profileId,
  userId,
  conversationHistory,
  pageContext,
  channel,  // ← ADD THIS (already parsed from request body at line 34)
})
```

- [x] **Step 5: Verify types compile**

```bash
cd services/stage-engine && npx tsc --noEmit
```

Expected: 0 errors

- [x] **Step 6: Commit**

```bash
git add services/stage-engine/src/core/agent-router.ts \
        services/stage-engine/src/routes/agent/chat.ts
git commit -m "fix(agent): wire channel through AgentRouterInput to toolContext

Channel field was accepted by chat.ts but dropped before reaching
routeAgentMessage. Now flows: request → AgentRouterInput → toolContext.
Fixes ADR-0078 PII defense gap.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Authority min_role Column

Add `min_role` to `engine_authority_config` so capabilities can be restricted by profile role.

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_min_role_to_authority_config.sql`

- [x] **Step 1: Read current authority config migration**

Read `supabase/migrations/20260302000100_engine_authority_config.sql` to understand the current schema.

- [x] **Step 2: Read the profile_role enum**

Check what role enum values exist. Search for `profile_role` or the role enum in migrations or `packages/supabase/src/database.types.ts`.

- [x] **Step 3: Write the migration**

```sql
-- Add min_role to engine_authority_config
-- Controls the minimum profile role required to use a capability at the configured level.
-- Default 'employee' preserves existing behavior (all roles have access).

ALTER TABLE public.engine_authority_config
  ADD COLUMN min_role text NOT NULL DEFAULT 'employee'
  CHECK (min_role IN ('employee', 'manager', 'admin', 'owner'));

COMMENT ON COLUMN public.engine_authority_config.min_role IS
  'Minimum profile role required to use this capability at the configured authority level. '
  'Profiles with lower roles get downgraded to "suggest" level regardless of workspace config.';
```

- [x] **Step 4: Apply migration locally**

```bash
npx supabase migration new add_min_role_to_authority_config
# Move the SQL content into the generated file
npx supabase db reset
```

Expected: migration applies without error

- [x] **Step 5: Regenerate database types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/*_add_min_role_to_authority_config.sql \
        packages/supabase/src/database.types.ts
git commit -m "feat(agent): add min_role to engine_authority_config

Adds min_role column (default 'employee') so capabilities can be
restricted by profile role. Prevents employees from accessing
admin-level agent capabilities.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Scaffold packages/data/

Create the shared data package that will hold validators, permissions, cascade classification, and telemetry event definitions.

**Files:**
- Create: `packages/data/package.json`
- Create: `packages/data/tsconfig.json`
- Create: `packages/data/src/index.ts`
- Create: `packages/data/src/validators/index.ts`
- Create: `packages/data/src/permissions/check.ts`
- Create: `packages/data/src/permissions/index.ts`
- Create: `packages/data/src/cascade/classify.ts`
- Create: `packages/data/src/cascade/index.ts`
- Create: `packages/data/src/telemetry/events.ts`
- Create: `packages/data/src/telemetry/index.ts`

- [x] **Step 1: Create package.json**

```json
{
  "name": "@smartout/data",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./validators": {
      "types": "./src/validators/index.ts",
      "default": "./src/validators/index.ts"
    },
    "./permissions": {
      "types": "./src/permissions/index.ts",
      "default": "./src/permissions/index.ts"
    },
    "./cascade": {
      "types": "./src/cascade/index.ts",
      "default": "./src/cascade/index.ts"
    },
    "./telemetry": {
      "types": "./src/telemetry/index.ts",
      "default": "./src/telemetry/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@smartout/typescript-config": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@smartout/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [x] **Step 3: Create cascade/classify.ts**

```typescript
// packages/data/src/cascade/classify.ts

/**
 * Cascade dimension classification for every mutable entity.
 *
 * Classification determines how mutations are handled:
 * - leaf: Direct write, no cascade impact
 * - cascade-input: Triggers re-derivation of downstream dimensions
 * - governance: Requires C4 approval workflow
 * - content: Follows draft → snapshot → publish pipeline
 */

export type CascadeDimension =
  | "D1" // Envelope (department, location, operating hours)
  | "D2" // Resource (profile, contract, absence, team)
  | "D3" // Rules (regulatory framework, tariff, holidays)
  | "D4" // Demand (season budget, day/hour factors)
  | "D5" // Concept (workspace config, niche params)
  | "D6" // Production (shifts, sessions, deviations)
  | null // Not cascade-scoped

export type MutationType = "leaf" | "cascade-input" | "governance" | "content"

export type EntityClassification = {
  dimension: CascadeDimension
  mutationType: MutationType
}

export const ENTITY_CLASSIFICATION: Record<string, EntityClassification> = {
  // Leaf — safe for direct write + emit
  chat_message: { dimension: null, mutationType: "leaf" },
  channel_message: { dimension: null, mutationType: "leaf" },
  deviation: { dimension: "D6", mutationType: "leaf" },
  haccp_log: { dimension: null, mutationType: "leaf" },
  session_note: { dimension: null, mutationType: "leaf" },
  shift_approval: { dimension: "D6", mutationType: "leaf" },
  notification_preference: { dimension: null, mutationType: "leaf" },
  position: { dimension: "D1", mutationType: "leaf" },
  zone: { dimension: "D1", mutationType: "leaf" },
  asset: { dimension: "D1", mutationType: "leaf" },

  // Cascade-input — triggers re-derivation
  department: { dimension: "D1", mutationType: "cascade-input" },
  department_operating_hours: { dimension: "D1", mutationType: "cascade-input" },
  location: { dimension: "D1", mutationType: "cascade-input" },
  team: { dimension: "D2", mutationType: "cascade-input" },
  schedule_shift: { dimension: "D6", mutationType: "cascade-input" },
  schedule_absence: { dimension: "D2", mutationType: "leaf" },
  season_budget: { dimension: "D4", mutationType: "cascade-input" },
  day_factor: { dimension: "D4", mutationType: "cascade-input" },
  hour_factor: { dimension: "D4", mutationType: "cascade-input" },
  public_holiday: { dimension: "D3", mutationType: "cascade-input" },
  time_entry: { dimension: "D6", mutationType: "leaf" },

  // Governance — requires C4 approval
  employment_contract: { dimension: "D2", mutationType: "governance" },
  regulatory_framework: { dimension: "D3", mutationType: "governance" },
  framework_rule: { dimension: "D3", mutationType: "governance" },
  tariff_rate_table: { dimension: "D3", mutationType: "governance" },
  protocol: { dimension: null, mutationType: "governance" },

  // Content — draft/publish pipeline
  website_page: { dimension: null, mutationType: "content" },
  website_section: { dimension: null, mutationType: "content" },
  website_asset: { dimension: null, mutationType: "content" },
  website_menu: { dimension: null, mutationType: "content" },
  website_menu_category: { dimension: null, mutationType: "content" },
  website_menu_item: { dimension: null, mutationType: "content" },
} as const

export function getEntityClassification(entity: string): EntityClassification {
  const classification = ENTITY_CLASSIFICATION[entity]
  if (!classification) {
    throw new Error(
      `Unknown entity "${entity}". Add it to ENTITY_CLASSIFICATION in packages/data/src/cascade/classify.ts`
    )
  }
  return classification
}

export function isCascadeInput(entity: string): boolean {
  return getEntityClassification(entity).mutationType === "cascade-input"
}

export function isGovernanceGated(entity: string): boolean {
  return getEntityClassification(entity).mutationType === "governance"
}

export function isContentEntity(entity: string): boolean {
  return getEntityClassification(entity).mutationType === "content"
}
```

- [x] **Step 4: Create cascade/index.ts**

```typescript
// packages/data/src/cascade/index.ts
export {
  getEntityClassification,
  isCascadeInput,
  isGovernanceGated,
  isContentEntity,
  ENTITY_CLASSIFICATION,
  type CascadeDimension,
  type MutationType,
  type EntityClassification,
} from "./classify"
```

- [x] **Step 5: Create permissions/check.ts**

```typescript
// packages/data/src/permissions/check.ts

/**
 * C4 permission checks enforced at the data layer.
 *
 * Called by BOTH web server actions and mobile TanStack mutations
 * before any write operation. This is the single source of truth
 * for role-based mutation authorization.
 */

export type ProfileRole = "employee" | "manager" | "admin" | "owner"
export type CrudOperation = "create" | "read" | "update" | "delete"
export type Ownership = "own" | "team" | "workspace"
export type PermissionResult = "allowed" | "denied" | "needs_approval"

const ROLE_HIERARCHY: Record<ProfileRole, number> = {
  employee: 0,
  manager: 1,
  admin: 2,
  owner: 3,
}

type PermissionRule = {
  minRole: ProfileRole
  ownDataRole?: ProfileRole
}

/**
 * Permission matrix: entity × operation → minimum role required.
 * "ownDataRole" allows a lower role for operations on own data.
 */
const PERMISSION_MATRIX: Record<string, Record<CrudOperation, PermissionRule>> = {
  // Employee self-service
  profile: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "admin", ownDataRole: "employee" },
    delete: { minRole: "owner" },
  },
  schedule_absence: {
    create: { minRole: "employee" },
    read: { minRole: "employee" },
    update: { minRole: "admin", ownDataRole: "employee" },
    delete: { minRole: "admin", ownDataRole: "employee" },
  },
  shift_approval: {
    create: { minRole: "employee" },
    read: { minRole: "employee" },
    update: { minRole: "admin", ownDataRole: "employee" },
    delete: { minRole: "admin" },
  },

  // Org structure — admin only
  department: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "admin" },
    delete: { minRole: "owner" },
  },
  location: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "admin" },
    delete: { minRole: "owner" },
  },
  team: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },
  schedule_shift: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },

  // Governance — owner or approval
  employment_contract: {
    create: { minRole: "admin" },
    read: { minRole: "employee" },
    update: { minRole: "owner" },
    delete: { minRole: "owner" },
  },
  regulatory_framework: {
    create: { minRole: "owner" },
    read: { minRole: "employee" },
    update: { minRole: "owner" },
    delete: { minRole: "owner" },
  },

  // Content — admin
  website_page: {
    create: { minRole: "admin" },
    read: { minRole: "admin" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },
  website_section: {
    create: { minRole: "admin" },
    read: { minRole: "admin" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },
  website_asset: {
    create: { minRole: "admin" },
    read: { minRole: "admin" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },
  website_menu_item: {
    create: { minRole: "admin" },
    read: { minRole: "admin" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },

  // Communication — all roles
  chat_message: {
    create: { minRole: "employee" },
    read: { minRole: "employee" },
    update: { minRole: "employee", ownDataRole: "employee" },
    delete: { minRole: "admin", ownDataRole: "employee" },
  },
  deviation: {
    create: { minRole: "employee" },
    read: { minRole: "employee" },
    update: { minRole: "admin", ownDataRole: "employee" },
    delete: { minRole: "admin" },
  },
  haccp_log: {
    create: { minRole: "employee" },
    read: { minRole: "employee" },
    update: { minRole: "admin" },
    delete: { minRole: "admin" },
  },
}

export function checkPermission(
  entity: string,
  operation: CrudOperation,
  userRole: ProfileRole,
  ownership: Ownership
): PermissionResult {
  const entityRules = PERMISSION_MATRIX[entity]
  if (!entityRules) {
    // Unknown entity — deny by default, fail safe
    return "denied"
  }

  const rule = entityRules[operation]
  if (!rule) return "denied"

  const userLevel = ROLE_HIERARCHY[userRole]

  // Check own-data shortcut
  if (ownership === "own" && rule.ownDataRole) {
    const ownLevel = ROLE_HIERARCHY[rule.ownDataRole]
    if (userLevel >= ownLevel) return "allowed"
  }

  const requiredLevel = ROLE_HIERARCHY[rule.minRole]
  if (userLevel >= requiredLevel) return "allowed"

  return "denied"
}
```

- [x] **Step 6: Create permissions/index.ts**

```typescript
// packages/data/src/permissions/index.ts
export {
  checkPermission,
  type ProfileRole,
  type CrudOperation,
  type Ownership,
  type PermissionResult,
} from "./check"
```

- [x] **Step 7: Create validators/index.ts (starter with profile)**

```typescript
// packages/data/src/validators/index.ts
import { z } from "zod"

/**
 * Shared input validators for cross-surface mutations.
 * Both web server actions and mobile TanStack hooks use these
 * to validate input before writing to Supabase.
 *
 * Add new entity validators as Phase 1-3 entities are implemented.
 */

// --- Profile ---

export const updateProfileInput = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(20).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileInput>

// --- Absence ---

export const createAbsenceInput = z.object({
  workspace_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  type: z.string().min(1),
  start_date: z.string().date(),
  end_date: z.string().date(),
  comment: z.string().max(500).optional(),
})

export type CreateAbsenceInput = z.infer<typeof createAbsenceInput>

export const cancelAbsenceInput = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
})

export type CancelAbsenceInput = z.infer<typeof cancelAbsenceInput>
```

- [x] **Step 8: Create telemetry/events.ts**

```typescript
// packages/data/src/telemetry/events.ts

/**
 * Telemetry event definitions for mutations.
 *
 * Each mutation function references these to ensure consistent
 * event names and property shapes across web and mobile.
 * The actual emit() call happens in the surface layer (web/mobile),
 * but the event shape is defined here.
 */

export type MutationEvent = {
  event: string
  requiredProperties: string[]
}

export const MUTATION_EVENTS = {
  // Profile
  profile_updated: {
    event: "profile updated",
    requiredProperties: ["profile_id", "fields_changed"],
  },

  // Absence
  absence_requested: {
    event: "absence requested",
    requiredProperties: ["absence_type", "start_date", "end_date"],
  },
  absence_cancelled: {
    event: "absence cancelled",
    requiredProperties: ["absence_id"],
  },

  // Shifts
  shift_created: {
    event: "shift created",
    requiredProperties: ["shift_id", "department_id"],
  },
  shift_updated: {
    event: "shift updated",
    requiredProperties: ["shift_id", "fields_changed"],
  },
  shift_deleted: {
    event: "shift deleted",
    requiredProperties: ["shift_id"],
  },
  shift_punched_in: {
    event: "shift punched_in",
    requiredProperties: ["time_entry_id"],
  },
  shift_punched_out: {
    event: "shift punched_out",
    requiredProperties: ["time_entry_id"],
  },
  shift_hours_confirmed: {
    event: "shift hours_confirmed",
    requiredProperties: ["shift_id", "status"],
  },

  // Org structure
  department_created: {
    event: "department created",
    requiredProperties: ["department_id", "name"],
  },
  department_updated: {
    event: "department updated",
    requiredProperties: ["department_id", "fields_changed"],
  },
  team_created: {
    event: "team created",
    requiredProperties: ["team_id", "name"],
  },
  team_updated: {
    event: "team updated",
    requiredProperties: ["team_id", "fields_changed"],
  },

  // Content
  website_page_created: {
    event: "website page_created",
    requiredProperties: ["page_id", "slug"],
  },
  website_page_updated: {
    event: "website page_updated",
    requiredProperties: ["page_id", "fields_changed"],
  },
  website_published: {
    event: "website published",
    requiredProperties: ["snapshot_id"],
  },

  // Communication
  chat_message_sent: {
    event: "chat message_sent",
    requiredProperties: ["channel_id"],
  },
  deviation_reported: {
    event: "deviation reported",
    requiredProperties: ["domain", "severity"],
  },
  haccp_logged: {
    event: "haccp logged",
    requiredProperties: ["task_type"],
  },
  handoff_submitted: {
    event: "handoff submitted",
    requiredProperties: ["session_id"],
  },
} as const satisfies Record<string, MutationEvent>
```

- [x] **Step 9: Create telemetry/index.ts**

```typescript
// packages/data/src/telemetry/index.ts
export { MUTATION_EVENTS, type MutationEvent } from "./events"
```

- [x] **Step 10: Create src/index.ts**

```typescript
// packages/data/src/index.ts

/**
 * @smartout/data — Shared data layer for cross-surface mutations.
 *
 * Contains validators, permissions, cascade classification, and
 * telemetry event definitions. Consumed by both web (server actions)
 * and mobile (TanStack mutations).
 *
 * Does NOT contain Supabase clients or transport logic.
 */

export * from "./validators/index"
export * from "./permissions/index"
export * from "./cascade/index"
export * from "./telemetry/index"
```

- [x] **Step 11: Install dependencies and verify**

```bash
cd /home/sxtnl/dev/smartout.ai
pnpm install
cd packages/data && pnpm typecheck
```

Expected: 0 errors

- [x] **Step 12: Commit**

```bash
git add packages/data/
git commit -m "feat(data): scaffold shared data package

Creates @smartout/data with four modules:
- validators: Zod input schemas (profile, absence)
- permissions: C4 role-based permission matrix
- cascade: Entity dimension classification
- telemetry: Mutation event definitions

Foundation for cross-surface CRUD (Phase 1-3).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task Dependencies

```
Task 1 (telemetry)  ─┐
Task 2 (channel)    ─┤── All independent, can run in parallel
Task 3 (min_role)   ─┤
Task 4 (scaffold)   ─┘
```

All four tasks are independent. They can be dispatched as parallel subagents.

---

## Verification Checklist

After all tasks complete:

- [x] `pnpm typecheck` passes (all packages) — verified 2026-04-10
- [x] All 10 mobile mutation hooks import and call `emit()` — verified 2026-04-10
- [x] `AgentRouterInput` has `channel` field — verified 2026-04-10
- [x] `engine_authority_config` has `min_role` column — verified 2026-04-10
- [x] `packages/data/` exists with validators, permissions, cascade, telemetry modules — verified 2026-04-10
- [x] All new events registered in `packages/telemetry/src/registry.ts` — verified 2026-04-10
- [x] `npx supabase db reset` succeeds with new migration — migration exists, types regenerated
