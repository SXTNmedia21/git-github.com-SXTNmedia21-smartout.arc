---
title: "Telemetry & Audit Trail Architecture"
id: TELEMETRY_ARCH
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on: []
tags:
  - telemetry
  - posthog
  - analytics
  - audit-trail
  - logging
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout Telemetry & Audit Trail Architecture

> Design document for the unified event system covering product analytics, structured logging, and user-facing activity trails.
> Authored: February 24, 2026 — Phase 0 addition to BUILD_ORDER.

---

## 1. The Problem

Three needs, one event:

1. **Product Analytics** — "How are people using Smartout?" → PostHog
2. **Structured Logging** — "What happened on the server?" → JSON logs (stdout/Supabase Logs)
3. **Activity Trail** — "What did I do to my shifts?" → Queryable table in Supabase, visible in UI

Retrofitting any of these is painful. If you build Department CRUD in Phase 2 without tracking, you'll never go back and add it. The solution: a single typed event registry that feeds all three destinations from day one.

---

## 2. Architecture: One Registry, Three Destinations

```
┌─────────────────────────────────────────────────────┐
│                   Event Registry                     │
│         (TypeScript discriminated union)              │
│                                                       │
│  Every event that can happen in Smartout is defined   │
│  here. No event can be emitted without being in the   │
│  registry. One file. One source of truth.             │
└──────────────┬───────────────┬───────────────┬───────┘
               │               │               │
        ┌──────▼──────┐ ┌─────▼──────┐ ┌──────▼──────┐
        │   PostHog   │ │  Structured │ │  Activity   │
        │  (Product   │ │   Logger    │ │   Trail     │
        │  Analytics) │ │  (Server)   │ │ (Supabase)  │
        └─────────────┘ └────────────┘ └─────────────┘
              ▲                ▲               ▲
        Client-side      Edge Functions    Mutations
        UI events        API routes        (create/update/delete)
```

**The key insight:** Not every event goes to every destination. The registry marks where each event should route:

| Event Type               | PostHog | Logger | Activity Trail |
| ------------------------ | ------- | ------ | -------------- |
| `page_viewed`            | ✅      | ❌     | ❌             |
| `shift_created`          | ✅      | ✅     | ✅             |
| `department_updated`     | ✅      | ✅     | ✅             |
| `auth_failed`            | ❌      | ✅     | ❌             |
| `button_clicked`         | ✅      | ❌     | ❌             |
| `session_task_completed` | ✅      | ✅     | ✅             |
| `rls_policy_denied`      | ❌      | ✅     | ❌             |

---

## 3. The Event Registry

One TypeScript file. Every module adds its events here. The naming convention follows PostHog's recommended `[object] [verb]` pattern (e.g. `shift created`, `department updated`).

### 3.1 Registry Structure

```typescript
// packages/telemetry/src/registry.ts

// ─── Base Event Shape ───────────────────────────
interface BaseEvent {
  workspace_id: string;
  actor_id: string; // profile_id of who did this
  timestamp?: string; // ISO 8601, auto-set if omitted
  correlation_id?: string; // for tracing request chains
}

// ─── Routing Metadata ───────────────────────────
type EventDestination = "posthog" | "logger" | "activity_trail";

interface EventMeta {
  destinations: EventDestination[];
  category: EventCategory;
}

type EventCategory =
  | "auth"
  | "onboarding"
  | "org_structure"
  | "scheduling"
  | "operations"
  | "haccp"
  | "training"
  | "communication"
  | "system"
  | "navigation";

// ─── Entity Reference (for activity trail) ──────
interface EntityRef {
  entity_type: EntityType;
  entity_id: string;
  entity_label?: string; // human-readable: "Anna Nordström" or "Tuesday 10:00-18:00"
}

type EntityType =
  | "company"
  | "workspace"
  | "profile"
  | "department"
  | "location"
  | "zone"
  | "asset"
  | "position"
  | "team"
  | "season"
  | "shift"
  | "shift_template"
  | "department_session"
  | "session_task"
  | "policy"
  | "protocol"
  | "procedure"
  | "routine"
  | "runbook"
  | "invitation"
  | "announcement"
  | "chat_message";

// ─── Action Verbs ───────────────────────────────
type ActionVerb =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "restored"
  | "published"
  | "assigned"
  | "unassigned"
  | "completed"
  | "started"
  | "signed"
  | "approved"
  | "rejected"
  | "escalated"
  | "viewed"
  | "exported"
  | "invited"
  | "swapped"
  | "transferred";
```

### 3.2 Event Definitions (Per Module)

```typescript
// ─── Module: Auth ───────────────────────────────
interface AuthSignedUp extends BaseEvent {
  event: "auth signed_up";
  properties: { method: "email" | "google" | "invite_link" };
}

interface AuthSignedIn extends BaseEvent {
  event: "auth signed_in";
  properties: { method: "email" | "google" };
}

interface AuthSignedOut extends BaseEvent {
  event: "auth signed_out";
  properties: {};
}

// ─── Module: Org Structure ──────────────────────
interface DepartmentCreated extends BaseEvent {
  event: "department created";
  properties: {
    entity: EntityRef;
    data: { name: string; color?: string; leader_id?: string };
  };
}

interface DepartmentUpdated extends BaseEvent {
  event: "department updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

interface DepartmentArchived extends BaseEvent {
  event: "department archived";
  properties: {
    entity: EntityRef;
    data: { name: string };
  };
}

// ─── Module: Scheduling ─────────────────────────
interface ShiftCreated extends BaseEvent {
  event: "shift created";
  properties: {
    entity: EntityRef;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      position_id?: string;
    };
  };
}

interface ShiftUpdated extends BaseEvent {
  event: "shift updated";
  properties: {
    entity: EntityRef;
    changes: Record<string, { before: unknown; after: unknown }>;
  };
}

interface ShiftDeleted extends BaseEvent {
  event: "shift deleted";
  properties: {
    entity: EntityRef;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
    };
  };
}

// ─── Module: Navigation / UI ────────────────────
interface PageViewed extends BaseEvent {
  event: "page viewed";
  properties: { path: string; referrer?: string };
}

interface ButtonClicked extends BaseEvent {
  event: "button clicked";
  properties: { button_id: string; context?: string };
}

// ─── The Union ──────────────────────────────────
type SmartoutEvent =
  | AuthSignedUp
  | AuthSignedIn
  | AuthSignedOut
  | DepartmentCreated
  | DepartmentUpdated
  | DepartmentArchived
  | ShiftCreated
  | ShiftUpdated
  | ShiftDeleted
  | PageViewed
  | ButtonClicked;
// ... each module adds its events here

// ─── Routing Map ────────────────────────────────
const EVENT_ROUTING: Record<SmartoutEvent["event"], EventMeta> = {
  "auth signed_up": { destinations: ["posthog", "logger"], category: "auth" },
  "auth signed_in": { destinations: ["posthog", "logger"], category: "auth" },
  "auth signed_out": { destinations: ["posthog"], category: "auth" },
  "department created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "department updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "department archived": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "org_structure",
  },
  "shift created": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift updated": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "shift deleted": {
    destinations: ["posthog", "logger", "activity_trail"],
    category: "scheduling",
  },
  "page viewed": { destinations: ["posthog"], category: "navigation" },
  "button clicked": { destinations: ["posthog"], category: "navigation" },
};
```

### 3.3 Why This Pattern

**Discriminated union on `event` field** = TypeScript won't let you:

- Emit an event that doesn't exist in the registry
- Pass wrong properties for a given event
- Forget to add routing for a new event

When you add `ShiftSwapped` in Phase 3, TypeScript will error until you also add it to `EVENT_ROUTING`. This is the discipline that prevents the mess.

---

## 4. The Activity Trail Table

This is NOT `supa_audit` or `pgAudit`. Those are database-level auditing tools — they capture every SQL operation (including internal triggers, RLS checks, migrations). That's noisy and not human-readable.

What we need is an **application-level activity trail** — one row per meaningful business action, written by the application, queryable in the UI.

### 4.1 Schema

```sql
-- Migration: [timestamp]_activity_trail.sql

CREATE TABLE activity_trail (
  id              BIGSERIAL PRIMARY KEY,

  -- Scoping
  workspace_id    UUID NOT NULL REFERENCES workspace(id),

  -- Who
  actor_id        UUID NOT NULL REFERENCES profile(id),

  -- What
  event           TEXT NOT NULL,                        -- 'shift created', 'department updated'
  action_verb     TEXT NOT NULL,                        -- 'created', 'updated', 'deleted'
  category        TEXT NOT NULL,                        -- 'scheduling', 'org_structure'

  -- Which entity
  entity_type     TEXT NOT NULL,                        -- 'shift', 'department'
  entity_id       UUID NOT NULL,                        -- the affected entity's PK
  entity_label    TEXT,                                 -- "Anna — Tue 10:00-18:00" (human readable)

  -- Change data (JSONB, lightweight)
  data            JSONB DEFAULT '{}',                   -- for creates/deletes: snapshot of key fields
  changes         JSONB DEFAULT '{}',                   -- for updates: { "field": { "before": x, "after": y } }

  -- Context
  correlation_id  UUID,                                 -- ties to a request chain
  source          TEXT DEFAULT 'web',                   -- 'web', 'mobile', 'api', 'system', 'ai'
  ip_address      INET,

  -- Timing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ────────────────────────────────────────
-- Primary query: "Show activity for this entity"
CREATE INDEX idx_activity_entity
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC);

-- Secondary query: "Show everything this person did"
CREATE INDEX idx_activity_actor
  ON activity_trail (workspace_id, actor_id, created_at DESC);

-- Tertiary query: "Show all activity in this workspace today"
CREATE INDEX idx_activity_workspace_time
  ON activity_trail (workspace_id, created_at DESC);

-- Category filter: "Show all scheduling activity"
CREATE INDEX idx_activity_category
  ON activity_trail (workspace_id, category, created_at DESC);

-- ─── RLS ────────────────────────────────────────────
ALTER TABLE activity_trail ENABLE ROW LEVEL SECURITY;

-- Managers/admins can see all activity in their workspace
CREATE POLICY "Workspace members can view activity" ON activity_trail
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user()));

-- Only the system (service role) can insert
-- Application writes via Edge Functions with service role
CREATE POLICY "System can insert activity" ON activity_trail
  FOR INSERT
  WITH CHECK (TRUE);  -- Inserts happen via Edge Function with service role

-- Nobody deletes activity (immutable trail)
-- No DELETE or UPDATE policies = no deletion possible through RLS
```

### 4.2 Why Not `supa_audit`?

|                     | `supa_audit`                          | Our `activity_trail`                                |
| ------------------- | ------------------------------------- | --------------------------------------------------- |
| **Level**           | Database triggers on every row change | Application-level, only meaningful business actions |
| **Content**         | Full row snapshots (large JSONB)      | Lightweight: key fields + changed fields only       |
| **Actor**           | Database role (`authenticated`)       | Actual `profile_id` of the person                   |
| **Human readable**  | Raw column names and values           | `entity_label`: "Anna — Tue 10:00-18:00"            |
| **Performance**     | Trigger overhead on every write       | One INSERT per business action (batched if needed)  |
| **Queryable in UI** | Not designed for it                   | Built for it: indexes, RLS, entity scoping          |
| **AI consumable**   | Noisy, hard to parse                  | Clean, structured, perfect for AI context           |

**Recommendation:** Enable `supa_audit` later (Phase 10) for compliance/security auditing on sensitive tables only (profile, company, payments). Use our `activity_trail` for the user-facing activity log from day one.

### 4.3 Data Principles

**Lightweight captures, not full snapshots:**

```jsonc
// ✅ Good — captures just what matters
{
  "event": "shift created",
  "entity_label": "Anna Nordström — Tue Feb 25, 10:00-18:00",
  "data": {
    "assigned_to_name": "Anna Nordström",
    "date": "2026-02-25",
    "start_time": "10:00",
    "end_time": "18:00",
    "position": "Servitør"
  }
}

// ❌ Bad — full row dump
{
  "record": { "id": "...", "workspace_id": "...", "created_at": "...",
              "updated_at": "...", "assigned_to": "...", ... 30 more fields }
}
```

**Changes track only what changed:**

```jsonc
// shift updated — time changed
{
  "changes": {
    "start_time": { "before": "10:00", "after": "11:00" },
    "end_time": { "before": "18:00", "after": "19:00" },
  },
}
```

---

## 5. The `@smartout/telemetry` Package

### 5.1 Package Structure

```
packages/telemetry/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Barrel export
    ├── registry.ts           # Event definitions + routing map
    ├── types.ts              # Shared types (EntityType, ActionVerb, etc.)
    ├── emit.ts               # Core emit() function — routes to destinations
    ├── providers/
    │   ├── posthog.ts        # PostHog client wrapper (client + server)
    │   ├── logger.ts         # Structured JSON logger (server-side)
    │   └── activity-trail.ts # Supabase insert (server-side)
    └── hooks/
        └── use-track.ts      # React hook for client-side tracking
```

### 5.2 Core `emit()` Function

```typescript
// packages/telemetry/src/emit.ts

import { SmartoutEvent, EVENT_ROUTING } from "./registry";
import { sendToPostHog } from "./providers/posthog";
import { logToStdout } from "./providers/logger";
import { writeActivityTrail } from "./providers/activity-trail";

export async function emit(event: SmartoutEvent): Promise<void> {
  const routing = EVENT_ROUTING[event.event];

  // Fire all destinations in parallel, don't block the caller
  const promises: Promise<void>[] = [];

  if (routing.destinations.includes("posthog")) {
    promises.push(sendToPostHog(event));
  }

  if (routing.destinations.includes("logger")) {
    promises.push(logToStdout(event, routing));
  }

  if (routing.destinations.includes("activity_trail")) {
    promises.push(writeActivityTrail(event, routing));
  }

  // Fire-and-forget: don't let telemetry failures break the app
  await Promise.allSettled(promises);
}
```

### 5.3 PostHog Provider

```typescript
// packages/telemetry/src/providers/posthog.ts

// Client-side: uses posthog-js (loaded via Next.js provider)
// Server-side: uses posthog-node

import { SmartoutEvent } from "../registry";

// ─── Client-side ────────────────────────────────
export function sendToPostHogClient(event: SmartoutEvent): void {
  if (typeof window === "undefined") return;

  const posthog = (window as any).posthog;
  if (!posthog) return;

  posthog.capture(event.event, {
    ...event.properties,
    workspace_id: event.workspace_id,
    $set: { last_active_workspace: event.workspace_id },
  });
}

// ─── Server-side ────────────────────────────────
export async function sendToPostHogServer(event: SmartoutEvent): Promise<void> {
  // posthog-node with flushAt: 1 for Edge Functions
  const { PostHog } = await import("posthog-node");
  const client = new PostHog(process.env.POSTHOG_API_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });

  client.capture({
    distinctId: event.actor_id,
    event: event.event,
    properties: {
      ...event.properties,
      workspace_id: event.workspace_id,
      correlation_id: event.correlation_id,
    },
    groups: { workspace: event.workspace_id },
  });

  await client.shutdown();
}
```

### 5.4 Structured Logger

```typescript
// packages/telemetry/src/providers/logger.ts

import { SmartoutEvent, EventMeta } from "../registry";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  action: string;
  category: string;
  actor_id: string;
  workspace_id: string;
  correlation_id?: string;
  properties: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
}

export function logToStdout(event: SmartoutEvent, meta: EventMeta): void {
  const entry: LogEntry = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    level: "info",
    action: event.event,
    category: meta.category,
    actor_id: event.actor_id,
    workspace_id: event.workspace_id,
    correlation_id: event.correlation_id,
    properties: event.properties as Record<string, unknown>,
    status: "ok",
  };

  // Structured JSON to stdout → picked up by Supabase Logs / any log aggregator
  console.log(JSON.stringify(entry));
}
```

### 5.5 Activity Trail Writer

```typescript
// packages/telemetry/src/providers/activity-trail.ts

import { SmartoutEvent, EventMeta } from "../registry";
import { createClient } from "@supabase/supabase-js";

// Uses service role — activity trail writes bypass RLS
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function writeActivityTrail(event: SmartoutEvent, meta: EventMeta): Promise<void> {
  // Extract entity info from properties (if present)
  const props = event.properties as any;
  const entity = props?.entity;

  if (!entity) {
    console.warn(`[telemetry] Activity trail event "${event.event}" missing entity ref`);
    return;
  }

  // Extract the verb from the event name: "shift created" → "created"
  const parts = event.event.split(" ");
  const actionVerb = parts[parts.length - 1];

  const { error } = await supabase.from("activity_trail").insert({
    workspace_id: event.workspace_id,
    actor_id: event.actor_id,
    event: event.event,
    action_verb: actionVerb,
    category: meta.category,
    entity_type: entity.entity_type,
    entity_id: entity.entity_id,
    entity_label: entity.entity_label,
    data: props.data ?? {},
    changes: props.changes ?? {},
    correlation_id: event.correlation_id,
    source: props.source ?? "web",
  });

  if (error) {
    console.error(`[telemetry] Activity trail write failed:`, error);
  }
}
```

### 5.6 React Hook for Client-Side Tracking

```typescript
// packages/telemetry/src/hooks/use-track.ts

import { useCallback } from "react";
import { SmartoutEvent, EVENT_ROUTING } from "../registry";
import { sendToPostHogClient } from "../providers/posthog";

// Context will provide workspace_id and actor_id
import { useWorkspace } from "@smartout/supabase";

export function useTrack() {
  const { workspaceId, profileId } = useWorkspace();

  const track = useCallback(
    <E extends SmartoutEvent>(event: E["event"], properties: E["properties"]) => {
      const fullEvent = {
        event,
        properties,
        workspace_id: workspaceId,
        actor_id: profileId,
        timestamp: new Date().toISOString(),
      } as SmartoutEvent;

      const routing = EVENT_ROUTING[event];

      // Client-side: only PostHog
      if (routing.destinations.includes("posthog")) {
        sendToPostHogClient(fullEvent);
      }

      // Activity trail + logger: send to server via beacon/API
      if (
        routing.destinations.includes("activity_trail") ||
        routing.destinations.includes("logger")
      ) {
        // Use navigator.sendBeacon for non-blocking delivery
        navigator.sendBeacon("/api/telemetry", JSON.stringify(fullEvent));
      }
    },
    [workspaceId, profileId],
  );

  return { track };
}
```

---

## 6. Usage Patterns

### 6.1 In a Server Action / Edge Function

```typescript
// apps/web/src/app/api/shifts/route.ts

import { emit } from "@smartout/telemetry";

export async function POST(req: Request) {
  const { data, error } = await supabase.from("shift").insert(shiftData).select().single();

  if (data) {
    await emit({
      event: "shift created",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      correlation_id: ctx.correlationId,
      properties: {
        entity: {
          entity_type: "shift",
          entity_id: data.id,
          entity_label: `${assigneeName} — ${formatDate(data.date)} ${data.start_time}-${data.end_time}`,
        },
        data: {
          assigned_to_name: assigneeName,
          date: data.date,
          start_time: data.start_time,
          end_time: data.end_time,
          position: positionName,
        },
      },
    });
  }

  return Response.json(data);
}
```

### 6.2 In a React Component

```typescript
// apps/web/src/components/department-form.tsx

import { useTrack } from '@smartout/telemetry';

export function DepartmentForm() {
  const { track } = useTrack();

  async function onSubmit(values: FormValues) {
    const result = await createDepartment(values);

    if (result.data) {
      track('department created', {
        entity: {
          entity_type: 'department',
          entity_id: result.data.id,
          entity_label: values.name,
        },
        data: {
          name: values.name,
          color: values.color,
        },
      });
    }
  }

  return <form>...</form>;
}
```

### 6.3 Querying the Activity Trail in UI

```typescript
// "Activity" tab on a shift detail page
const { data: activity } = await supabase
  .from("activity_trail")
  .select("*")
  .eq("workspace_id", workspaceId)
  .eq("entity_type", "shift")
  .eq("entity_id", shiftId)
  .order("created_at", { ascending: false })
  .limit(50);

// Renders as:
// 14:32 — Maria opprettet vakt: Anna — Tue 10:00-18:00
// 14:35 — Maria endret vakt: starttid 10:00 → 11:00
// 14:41 — Maria slettet vakt: Erik — Tue 12:00-20:00
```

```typescript
// "My Activity" page — what did I do today?
const { data: myActivity } = await supabase
  .from("activity_trail")
  .select("*")
  .eq("workspace_id", workspaceId)
  .eq("actor_id", profileId)
  .gte("created_at", startOfDay)
  .order("created_at", { ascending: false });
```

### 6.4 AI Context — Feed Activity Trail to Mr. Botsson

```typescript
// When Mr. Botsson needs context about recent changes:
const recentActivity = await supabase
  .from("activity_trail")
  .select("event, entity_label, actor_id, changes, created_at")
  .eq("workspace_id", workspaceId)
  .eq("category", "scheduling")
  .gte("created_at", last24Hours)
  .order("created_at", { ascending: false })
  .limit(20);

// AI prompt context:
// "Here's what happened with scheduling in the last 24 hours:
//  - Maria created 5 shifts for next Tuesday
//  - Maria deleted Erik's shift (Tue 12:00-20:00)
//  - Jonas updated the Kitchen schedule template"
```

---

## 7. PostHog Setup (Minimal)

### 7.1 Client-Side Provider

```typescript
// apps/web/src/app/providers.tsx

'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
      capture_pageview: false,          // We track manually via registry
      capture_pageleave: true,
      autocapture: false,               // We use typed events only
      persistence: 'localStorage+cookie',
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

**Why `autocapture: false`?** Because we want every event to go through the typed registry. Autocapture is noisy, untyped, and breaks when UI changes. Our approach gives us complete control and a clean PostHog dashboard from day one.

### 7.2 Reverse Proxy (Ad-Blocker Bypass)

```typescript
// next.config.ts — rewrites to avoid tracking blockers
async rewrites() {
  return [
    {
      source: '/ingest/static/:path*',
      destination: 'https://eu-assets.i.posthog.com/static/:path*',
    },
    {
      source: '/ingest/:path*',
      destination: 'https://eu.i.posthog.com/:path*',
    },
  ];
},
```

### 7.3 Group Analytics (Workspace-Level)

```typescript
// On login / workspace switch:
posthog.group("workspace", workspaceId, {
  name: workspaceName,
  plan: "pro",
  industry: "restaurant",
  employee_count: 25,
});
```

This enables PostHog to show analytics per workspace, not just per user.

---

## 8. Data Retention & Performance

### 8.1 Table Partitioning (When Needed)

For now, a single table with good indexes is fine. When it grows past ~10M rows (likely 12+ months), partition by month:

```sql
-- Future: convert to partitioned table
CREATE TABLE activity_trail (
  -- same columns --
) PARTITION BY RANGE (created_at);

CREATE TABLE activity_trail_2026_01
  PARTITION OF activity_trail
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 8.2 Retention Policy

- **Hot data:** Last 90 days — indexed, fast queries
- **Warm data:** 90 days to 1 year — still queryable but partial indexes
- **Cold data:** 1+ year — export to object storage (Supabase Storage), delete from table

```sql
-- Partial index for recent data (most queries)
CREATE INDEX idx_activity_recent
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC)
  WHERE created_at >= NOW() - INTERVAL '90 days';
```

### 8.3 Write Performance

Activity trail writes are async and fire-and-forget. They never block the main operation. If the insert fails, the logger catches the error but the user's action succeeds.

Expected volume: a busy restaurant workspace might generate ~500-1000 activity trail entries per day. At 30 workspaces, that's ~30K rows/day = ~11M rows/year. Well within PostgreSQL's comfort zone with proper indexes.

---

## 9. Adding Events — The Developer Workflow

When building a new feature (e.g., Shift Swap in Phase 3):

**Step 1: Define the events in the registry**

```typescript
// packages/telemetry/src/registry.ts

interface ShiftSwapRequested extends BaseEvent {
  event: 'shift swap_requested';
  properties: {
    entity: EntityRef;   // the shift being swapped
    data: {
      requester_name: string;
      target_profile_id: string;
      target_name: string;
      original_date: string;
    };
  };
}

interface ShiftSwapApproved extends BaseEvent {
  event: 'shift swap_approved';
  properties: {
    entity: EntityRef;
    data: { approver_name: string; requester_name: string; target_name: string };
  };
}

// Add to the union
type SmartoutEvent = ... | ShiftSwapRequested | ShiftSwapApproved;

// Add routing
'shift swap_requested': { destinations: ['posthog', 'logger', 'activity_trail'], category: 'scheduling' },
'shift swap_approved':  { destinations: ['posthog', 'logger', 'activity_trail'], category: 'scheduling' },
```

**Step 2: Emit in the feature code**

```typescript
await emit({ event: 'shift swap_requested', ... });
```

**Step 3: Done.** PostHog picks it up. Logger logs it. Activity trail stores it. The UI "Activity" component already knows how to render it.

---

## 10. Implementation in BUILD_ORDER

Add as **Phase 0.11** (after 0.10 Seed Data):

### 0.11 — Telemetry & Activity Trail

| Task   | Deliverable                                  |
| ------ | -------------------------------------------- |
| 0.11.1 | `packages/telemetry/` package scaffold       |
| 0.11.2 | Event registry with auth + navigation events |
| 0.11.3 | PostHog provider (client + server)           |
| 0.11.4 | Structured logger (stdout JSON)              |
| 0.11.5 | `activity_trail` migration + RLS             |
| 0.11.6 | Activity trail writer                        |
| 0.11.7 | `useTrack()` React hook                      |
| 0.11.8 | `/api/telemetry` endpoint (beacon receiver)  |
| 0.11.9 | PostHog reverse proxy in `next.config.ts`    |

**Estimated time: 1 day**

Every subsequent phase (1, 2, 3, ...) then adds its events to the registry as part of the normal feature work. The infrastructure is ready; the events grow organically.

---

## 11. What This Enables Long-Term

- **"What happened to my shift?"** — Activity tab on any entity detail page
- **"What did I do today?"** — Personal activity feed
- **"What changed in the kitchen this week?"** — Department activity stream
- **AI context** — Mr. Botsson knows recent changes without querying every table
- **Undo support** — `changes` JSONB has before/after, enabling future "undo last action"
- **Compliance** — Norwegian labor law requires traceability for scheduling decisions
- **Product analytics** — PostHog dashboards show feature adoption, drop-off, usage patterns
- **Debugging** — Structured logs with correlation IDs trace any issue end-to-end
