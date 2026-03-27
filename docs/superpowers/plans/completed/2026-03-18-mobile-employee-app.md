---
title: "Smartout Employee App — Implementation Plan"
status: draft
updated: 2026-03-18
created: 2026-03-18
module: mobile
tags: [mobile, expo, react-native, plan, agent-teams]
---

# Smartout Employee App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) employee app for restaurant workers that enables a complete shift lifecycle — punch, tasks, HACCP, handoff, chat, deviations — with offline-first compliance-critical writes.

**Architecture:** Expo Router file-system routing, TanStack Query + Zustand for state, SQLite write queue + MMKV read cache for offline, Supabase direct client (no gateway). Shares `@smartout/types`, `@smartout/design-tokens/native`, `@smartout/telemetry`, `@smartout/utils` from monorepo.

**Tech Stack:** Expo 52+, Expo Router, React Native, TypeScript, TanStack Query, Zustand, expo-sqlite, react-native-mmkv, react-native-reanimated, Supabase, Expo Notifications

**Spec:** `docs/superpowers/specs/2026-03-18-mobile-employee-app-design.md`

---

## Execution Model: Agent Teams in Tmux

This plan is designed for parallel execution across multiple Claude Code agents, each in its own git worktree and tmux session.

### Phase Dependencies

```
Phase 0 (Foundation)     ← MUST complete first, all other phases depend on this
  ↓
Phase 1 (Migrations)     ← MUST complete before Phase 3-8
  ↓
┌─────────────────────────────────────────────────┐
│ PARALLEL BLOCK A (after Phase 0 + 1)            │
│                                                 │
│  Agent wt-A: Phase 2 (Offline infra)            │
│  Agent wt-B: Phase 3 (Shift phase engine)       │
│  Agent wt-C: Phase 4 (UI primitives)            │
│  Agent wt-D: Phase 5 (Auth screens)             │
└─────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────┐
│ PARALLEL BLOCK B (after Block A)                │
│                                                 │
│  Agent wt-A: Phase 6 (Home + Shifts tabs)       │
│  Agent wt-B: Phase 7 (Punch clock)              │
│  Agent wt-C: Phase 8 (Chat)                     │
│  Agent wt-D: Phase 9 (Tasks + HACCP + Deviations│
└─────────────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────────────┐
│ PARALLEL BLOCK C (after Block B)                │
│                                                 │
│  Agent wt-A: Phase 10 (Push notifications)      │
│  Agent wt-B: Phase 11 (AI FAB / Botsson)        │
│  Agent wt-C: Phase 12 (Me tab + polish)         │
└─────────────────────────────────────────────────┘
  ↓
Phase 13 (Integration)   ← MUST be last, single agent
```

### Worktree Setup

Each agent gets spawned with:

```bash
# Example for Phase 2 agent
git branch feat/mobile-offline-infra development
git worktree add ~/dev/wt-A feat/mobile-offline-infra
tmux new -s aA -c ~/dev/wt-A
```

All agents branch from `development`. After each phase completes, merge to `development` before starting dependent phases.

### Agent Instructions Template

When spawning each agent, include:

1. Branch name and worktree path
2. Which phase/tasks to execute
3. Path to this plan + spec
4. "Done" criteria: typecheck passes, tests pass, committed
5. "When finished, report back with what was done and any blockers"

---

## Phase 0: Foundation (Sequential — Single Agent)

> Creates the Expo app, monorepo wiring, Supabase client, providers. Everything else depends on this.

### Task 0.1: Scaffold Expo App

**Files:**

- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/babel.config.js`
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/+not-found.tsx`
- Modify: `pnpm-workspace.yaml` (add apps/mobile)
- Modify: `turbo.json` (add mobile tasks)

- [ ] **Step 1: Create Expo project**

```bash
cd apps && npx create-expo-app mobile --template blank-typescript
cd mobile && rm -rf .git  # remove nested git
```

- [ ] **Step 2: Configure monorepo dependencies**

Add to `apps/mobile/package.json`:

```json
{
  "dependencies": {
    "@smartout/types": "workspace:*",
    "@smartout/design-tokens": "workspace:*",
    "@smartout/telemetry": "workspace:*",
    "@smartout/utils": "workspace:*",
    "@smartout/supabase": "workspace:*",
    "@supabase/supabase-js": "^2",
    "@tanstack/react-query": "^5",
    "zustand": "^5",
    "expo-sqlite": "~15",
    "react-native-mmkv": "^3",
    "react-native-reanimated": "~3",
    "expo-secure-store": "~14",
    "expo-notifications": "~0.29",
    "expo-linking": "~7",
    "expo-haptics": "~14",
    "expo-router": "~4",
    "@react-native-community/netinfo": "^11",
    "@gorhom/bottom-sheet": "^5",
    "react-native-gesture-handler": "~2"
  }
}
```

- [ ] **Step 3: Configure Metro for monorepo**

Create `apps/mobile/metro.config.js`:

```javascript
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;
```

- [ ] **Step 4: Configure tsconfig with path alias**

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Add to pnpm-workspace.yaml and turbo.json**

Verify `apps/mobile` is picked up by pnpm workspace. Add `typecheck` and `lint` tasks to turbo.json for mobile.

- [ ] **Step 6: Run `pnpm install` and verify Metro starts**

```bash
cd ~/dev/smartout.ai && pnpm install
cd apps/mobile && npx expo start --clear
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/ pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "feat(mobile): scaffold expo app with monorepo wiring"
```

---

### Task 0.2: Supabase Client Adapter

**Files:**

- Create: `apps/mobile/src/lib/supabase.ts`

- [ ] **Step 1: Create Supabase client with SecureStore adapter**

```typescript
// apps/mobile/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import type { Database } from "@smartout/types";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// These come from app.json extra or env
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL-based auth on mobile
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/supabase.ts
git commit -m "feat(mobile): add supabase client with SecureStore adapter"
```

---

### Task 0.3: Root Layout with Providers

**Files:**

- Create: `apps/mobile/src/providers/query-provider.tsx`
- Create: `apps/mobile/src/providers/auth-provider.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Create QueryProvider**

Wraps TanStack QueryClientProvider. Standard setup.

- [ ] **Step 2: Create AuthProvider**

Listens to `supabase.auth.onAuthStateChange`. Exposes `session`, `user`, `isLoading`. Redirects to `(auth)/welcome` if no session, to `(app)` if session exists.

- [ ] **Step 3: Wire root \_layout.tsx**

```typescript
// apps/mobile/app/_layout.tsx
export default function RootLayout() {
  return (
    <QueryProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </QueryProvider>
  );
}
```

- [ ] **Step 4: Create placeholder (auth) and (app) layouts**

Minimal `_layout.tsx` in each group so Expo Router resolves.

- [ ] **Step 5: Verify app boots with providers**

```bash
npx expo start --clear
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add root layout with query + auth providers"
```

---

## Phase 1: Database Migrations (Sequential — Single Agent)

> All schema changes. Must complete before any feature work touches the DB.

### Task 1.1: Timesheet Schema + time_entry Table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_timesheet_schema.sql`

- [ ] **Step 1: Write migration**

Full SQL from spec section 3.1. Includes:

- `CREATE SCHEMA timesheet`
- `CREATE TYPE timesheet.time_entry_status`
- `CREATE TABLE timesheet.time_entry` with all columns (PK: `time_entry_id`)
- RLS policies (JWT workspace-scoped + API key)
- Indexes on `(workspace_id, profile_id)` and `(shift_id)`
- `set_updated_at()` trigger
- Realtime publication
- Employee self-update policy (own entries only)

- [ ] **Step 2: Run migration locally**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/<file>.sql
```

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(db): add timesheet schema with time_entry table"
```

---

### Task 1.2: HACCP Log Table

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_haccp_log.sql`

- [ ] **Step 1: Write migration from spec section 3.2**

- [ ] **Step 2: Run migration, regenerate types, commit**

```bash
git commit -m "feat(db): add haccp_log table for compliance temperature logging"
```

---

### Task 1.3: Workspace Join Code + Searchability

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_workspace_join_code.sql`

- [ ] **Step 1: Write migration**

- `ALTER TABLE workspace ADD COLUMN join_code CHAR(6) UNIQUE`
- `ALTER TABLE workspace ADD COLUMN is_searchable BOOLEAN NOT NULL DEFAULT true`
- `CREATE FUNCTION lookup_workspace_by_code(code TEXT)` — returns `{workspace_id, name, logo_url}`
- `CREATE FUNCTION search_workspaces(query TEXT)` — min 3 chars, max 10 results, `is_searchable = true`
- Both functions `SECURITY DEFINER`, anon-accessible

- [ ] **Step 2: Generate join codes for existing workspaces**

```sql
UPDATE workspace SET join_code = upper(substr(md5(random()::text), 1, 6))
WHERE join_code IS NULL;
```

- [ ] **Step 3: Run migration, regenerate types, commit**

```bash
git commit -m "feat(db): add workspace join_code, is_searchable, lookup RPCs"
```

---

### Task 1.4: Shift Confirmation + Chat Source + Invitation Direction + Push Token

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_mobile_schema_additions.sql`

- [ ] **Step 1: Write migration**

All remaining schema changes in one migration:

- `ALTER TABLE schedule_shift ADD COLUMN confirmed_at TIMESTAMPTZ`
- `ALTER TABLE schedule_shift ADD COLUMN confirmed_by UUID REFERENCES profile(profile_id)`
- Employee self-confirm RLS policy
- `ALTER TABLE conversation ADD COLUMN source_type TEXT` + CHECK constraint: `source_type IN ('department', 'team', 'session')` or NULL
- `ALTER TABLE conversation ADD COLUMN source_id UUID` — polymorphic reference, NO FK constraint (references department_id, team_id, or department_session_id depending on source_type)
- `ALTER TABLE invitation ADD COLUMN direction TEXT NOT NULL DEFAULT 'outbound'`
- `ALTER TABLE invitation ADD COLUMN requested_by UUID REFERENCES profile(profile_id)`
- `ALTER TABLE profile ADD COLUMN expo_push_token TEXT`

- [ ] **Step 2: Run migration, regenerate types, commit**

```bash
git commit -m "feat(db): add shift confirmation, chat source, invitation direction, push token"
```

---

### Task 1.5: Remove Punch Columns from shift_approval

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_remove_shift_approval_punch.sql`
- Modify: `apps/web/src/app/dashboard/reconciliation/_components/ShiftApprovalSection.tsx`
- Modify: `apps/web/src/app/dashboard/reconciliation/_components/DayApproval.tsx`

> **IMPORTANT:** This migration MUST have the highest timestamp of all Phase 1 migrations and MUST run last. The web reconciliation components actively reference `punch_in`/`punch_out` — update them BEFORE running the migration.

- [ ] **Step 1: Update web reconciliation components**

Remove `punch_in`/`punch_out` references from `ShiftApprovalSection.tsx` (lines ~13-14, ~115) and `DayApproval.tsx` (lines ~61-62). Replace with reads from `timesheet.time_entry` joined via `shift_id`, or remove display if not needed in V1.

- [ ] **Step 2: Write migration**

```sql
ALTER TABLE shift_approval DROP COLUMN IF EXISTS punch_in;
ALTER TABLE shift_approval DROP COLUMN IF EXISTS punch_out;
```

- [ ] **Step 3: Run migration, regenerate types, commit**

```bash
git commit -m "refactor(db): remove punch_in/punch_out from shift_approval (moved to timesheet.time_entry)"
```

---

## Phase 2: Offline Infrastructure (Agent wt-A)

> SQLite write queue + MMKV read cache + sync worker. No UI dependency.

### Task 2.1: SQLite Write Queue

**Files:**

- Create: `apps/mobile/src/lib/sync/db.ts` — SQLite database init + pending_writes table
- Create: `apps/mobile/src/lib/sync/queue.ts` — enqueue/dequeue operations
- Create: `apps/mobile/src/lib/sync/types.ts` — Action type, PendingWrite type

- [ ] **Step 1: Create SQLite database and pending_writes table**

`db.ts`: Opens SQLite database, creates `pending_writes` table (schema from spec section 6.1). Exports `getDb()`.

- [ ] **Step 2: Create queue operations**

`queue.ts`: Exports `enqueue(action, payload, rowId)`, `dequeueNext()`, `markSynced(id)`, `markFailed(id)`, `retryFailed(id)`, `getPendingCount()`, `getFailedCount()`.

- [ ] **Step 3: Create types**

`types.ts`: `Action` union type (all 9 actions from spec section 6.3), `PendingWrite` type, `WriteStatus` type.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add SQLite write queue for offline operations"
```

---

### Task 2.2: Action Map + Sync Worker

**Files:**

- Create: `apps/mobile/src/lib/sync/action-map.ts` — Maps actions to Supabase calls
- Create: `apps/mobile/src/lib/sync/worker.ts` — Sync loop with NetInfo + backoff

- [ ] **Step 1: Create action map**

`action-map.ts`: Record mapping each action string to a Supabase client call. Exact code from spec section 6.2.

- [ ] **Step 2: Create sync worker**

`worker.ts`: Exports `SyncWorker` class with `start()`, `stop()`, `flush()`. Listens to NetInfo. FIFO processing. Exponential backoff on failure (2^n seconds, max 60s). Retry limit 5. Handles 409 (mark synced), 401 (re-auth + retry).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add action map and sync worker with NetInfo integration"
```

---

### Task 2.3: MMKV Read Cache

**Files:**

- Create: `apps/mobile/src/lib/cache/mmkv.ts` — MMKV instance + cache helpers
- Create: `apps/mobile/src/lib/cache/persister.ts` — TanStack Query persister adapter

- [ ] **Step 1: Create MMKV helpers**

`mmkv.ts`: Creates MMKV instance. Exports `cacheGet<T>(key)`, `cacheSet(key, data)`, `cacheClear(key)`.

- [ ] **Step 2: Create TanStack Query persister**

`persister.ts`: Wraps MMKV as `placeholderData` source. Exports `createCachedQuery(key, queryFn)` helper that returns query options with MMKV-backed placeholderData + auto-persist on success.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add MMKV read cache with TanStack Query persister"
```

---

### Task 2.4: Sync Status Store + Indicator Component

**Files:**

- Create: `apps/mobile/src/hooks/stores/use-sync-status.ts` — Zustand store
- Create: `apps/mobile/src/components/common/SyncIndicator.tsx` — UI banner

- [ ] **Step 1: Create Zustand sync status store**

Exposes `pendingCount`, `failedCount`, `isOnline`, `lastSyncedAt`. Updated by sync worker.

- [ ] **Step 2: Create SyncIndicator component**

Animated banner: yellow (syncing), orange (offline + pending), red (failed + retry button), green (synced, fades out after 3s). Uses `react-native-reanimated` for fade.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add sync status store and indicator component"
```

---

## Phase 3: Shift Phase Engine (Agent wt-B)

> Pure logic + Zustand store. No UI. Testable in isolation.

### Task 3.1: Phase Calculation Function

**Files:**

- Create: `apps/mobile/src/lib/shift-phase.ts` — Pure function: `calculateShiftPhase()`
- Create: `apps/mobile/src/lib/__tests__/shift-phase.test.ts`

- [ ] **Step 1: Write tests for all phase transitions**

Test cases:

- No shifts within 24h → `no_shift`
- Shift in 3h, no punch → `before_shift`
- Shift started 10min ago, no punch → `before_shift` (NOT `during_shift`)
- Active `time_entry` with `clocked_in` → `during_shift`
- `time_entry` with `punch_out`, no handoff/confirmation → `after_shift`
- `time_entry` with `punch_out`, handoff done + hours confirmed → `no_shift`

- [ ] **Step 2: Implement `calculateShiftPhase()`**

Pure function. Inputs: `{ shifts, activeTimeEntry, now, beforeShiftHours }`. Returns `ShiftPhase`.

- [ ] **Step 3: Run tests**

```bash
cd apps/mobile && npx jest src/lib/__tests__/shift-phase.test.ts
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add shift phase calculation with tests"
```

---

### Task 3.2: Query Hooks (shifts + time entry)

**Files:**

- Create: `apps/mobile/src/hooks/queries/use-my-shifts.ts`
- Create: `apps/mobile/src/hooks/queries/use-active-time-entry.ts`

> **NOTE:** These hooks are created here (not Phase 6) because the shift phase store depends on them. Phase 6 Task 6.1 creates the remaining query hooks (use-my-tasks, use-day-info, use-shift-colleagues).

- [ ] **Step 1: Build useMyShifts hook**

Queries `schedule_shift` WHERE `employee_id = me` for next 7 days. Uses MMKV placeholderData if Phase 2 cache is available (graceful fallback if not merged yet).

- [ ] **Step 2: Build useActiveTimeEntry hook**

Queries `timesheet.time_entry` WHERE `profile_id = me` AND `status = 'clocked_in'`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add shift and time entry query hooks"
```

---

### Task 3.3: Shift Phase Zustand Store

**Files:**

- Create: `apps/mobile/src/hooks/stores/use-shift-phase.ts`

- [ ] **Step 1: Create store**

Zustand store wrapping `calculateShiftPhase()`. Subscribes to `useMyShifts()` and `useActiveTimeEntry()` (created in Task 3.2). Recalculates on data change + 1-minute interval timer.

Exports: `useShiftPhase()` → `{ phase, activeShift, activeTimeEntry, nextShift }`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add shift phase zustand store"
```

---

## Phase 4: UI Primitives (Agent wt-C)

> Core components built with design tokens. No business logic.

### Task 4.1: Theme + Design Token Setup

**Files:**

- Create: `apps/mobile/src/theme/index.ts` — Re-exports design tokens + adds RN-specific utils
- Create: `apps/mobile/src/theme/spacing.ts`
- Create: `apps/mobile/src/theme/colors.ts`
- Create: `apps/mobile/src/theme/typography.ts`
- Create: `apps/mobile/src/constants/strings.ts`

- [ ] **Step 1: Create theme module**

Import from `@smartout/design-tokens/native`. Add RN-specific helpers: `createStyles()` factory (typed StyleSheet.create wrapper with theme access), shadow presets, safe area constants.

- [ ] **Step 2: Create strings.ts**

Central file for all hardcoded Norwegian strings. All UI text imports from here. Makes future i18n migration trivial (swap this file for i18n keys).

```typescript
// apps/mobile/src/constants/strings.ts
export const strings = {
  tabs: { home: "Hjem", shifts: "Vakter", chat: "Chat", me: "Meg" },
  home: { greeting: "Hei", nextShift: "Neste vakt", noShift: "Ingen kommende vakter" },
  shift: { confirm: "Bekreft vakt", punchIn: "Stemple inn", punchOut: "Stemple ut" },
  // ... all UI strings centralized here
} as const;
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add theme module and centralized Norwegian strings"
```

---

### Task 4.2: Core UI Components

**Files:**

- Create: `apps/mobile/src/components/ui/Button.tsx`
- Create: `apps/mobile/src/components/ui/Card.tsx`
- Create: `apps/mobile/src/components/ui/Input.tsx`
- Create: `apps/mobile/src/components/ui/Badge.tsx`
- Create: `apps/mobile/src/components/ui/BottomSheet.tsx`
- Create: `apps/mobile/src/components/ui/EmptyState.tsx`
- Create: `apps/mobile/src/components/ui/index.ts`

- [ ] **Step 1: Build each component**

All components use StyleSheet + design tokens. Button has haptic feedback (`expo-haptics`) on press. All touchables respond within 100ms (design rule #5). BottomSheet wraps `@gorhom/bottom-sheet`.

- [ ] **Step 2: Commit per component or batch**

```bash
git commit -m "feat(mobile): add core UI primitives (Button, Card, Input, Badge, BottomSheet, EmptyState)"
```

---

### Task 4.3: Common Components

**Files:**

- Create: `apps/mobile/src/components/common/Avatar.tsx`
- Create: `apps/mobile/src/components/common/SectionHeader.tsx`
- Create: `apps/mobile/src/components/common/StatusBadge.tsx`

- [ ] **Step 1: Build each component**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add common components (Avatar, SectionHeader, StatusBadge)"
```

---

## Phase 5: Auth Screens (Agent wt-D)

> Complete auth flow: welcome, verify, workspace select. Independent of other mobile features.

### Task 5.1: Welcome Screen (Three Paths)

**Files:**

- Create: `apps/mobile/app/(auth)/welcome.tsx`
- Create: `apps/mobile/src/components/auth/InviteEntry.tsx`
- Create: `apps/mobile/src/components/auth/CodeEntry.tsx`
- Create: `apps/mobile/src/components/auth/WorkspaceSearch.tsx`

- [ ] **Step 1: Build welcome screen**

Three buttons: "Jeg har en invitasjon", "Jeg har en kode", "Finn min arbeidsplass". Each opens respective entry component.

- [ ] **Step 2: Build InviteEntry**

Handles deep link token validation. Calls `supabase.from('invitation').select()` with token.

- [ ] **Step 3: Build CodeEntry**

6-digit input. Calls `lookup_workspace_by_code()` RPC. Shows workspace name + logo for confirmation.

- [ ] **Step 4: Build WorkspaceSearch**

Text input (min 3 chars). Calls `search_workspaces()` RPC. Shows list. Selected workspace → "Send forespørsel?" → creates inbound invitation.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): add welcome screen with three auth paths"
```

---

### Task 5.2: Verification Screen

**Files:**

- Create: `apps/mobile/app/(auth)/verify.tsx`

- [ ] **Step 1: Build OTP verification**

Phone number input → `supabase.auth.signInWithOtp({ phone })`. 6-digit OTP input → `supabase.auth.verifyOtp({ phone, token })`. Magic link fallback: email input → `supabase.auth.signInWithOtp({ email })`.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add SMS OTP + magic link verification screen"
```

---

### Task 5.3: Workspace Selector + Join Request Wait

**Files:**

- Create: `apps/mobile/app/(auth)/workspace-select.tsx`
- Create: `apps/mobile/app/(auth)/pending.tsx`

- [ ] **Step 1: Build workspace selector**

Fetches profiles for `auth.uid()`. If 1 → auto-redirect. If >1 → show list. If 0 → show pending screen.

- [ ] **Step 2: Build pending screen**

"Forespørsel sendt. Du får beskjed når admin godkjenner." Polls or subscribes to invitation status change.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add workspace selector and join request pending screen"
```

---

### Task 5.4: Deep Link Configuration

**Files:**

- Modify: `apps/mobile/app.json` — Add scheme + Universal Links config
- Create: `apps/mobile/app/(auth)/invite/[token].tsx` — Deep link handler

- [ ] **Step 1: Configure app.json**

```json
{
  "scheme": "smartout",
  "ios": { "associatedDomains": ["applinks:app.smartout.ai"] },
  "android": {
    "intentFilters": [
      {
        "action": "VIEW",
        "data": [{ "scheme": "https", "host": "app.smartout.ai", "pathPrefix": "/invite" }]
      }
    ]
  }
}
```

- [ ] **Step 2: Build invite deep link handler**

Route `/invite/[token]` extracts token, validates, redirects to verify screen with workspace context.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add deep link handling for invite flow"
```

---

## Phase 6: Home + Shifts Tabs (Agent wt-A)

> Depends on Phase 3 (shift phase engine) + Phase 4 (UI primitives).

### Task 6.1: Remaining TanStack Query Hooks

**Files:**

- Create: `apps/mobile/src/hooks/queries/use-my-tasks.ts`
- Create: `apps/mobile/src/hooks/queries/use-day-info.ts`
- Create: `apps/mobile/src/hooks/queries/use-shift-colleagues.ts`

> **NOTE:** `use-my-shifts.ts` and `use-active-time-entry.ts` were created in Phase 3 (Task 3.2).

- [ ] **Step 1: Build each hook**

Each hook uses `createCachedQuery()` from Phase 2 for MMKV placeholderData. Queries Supabase directly. Workspace-scoped via auth JWT.

- `useMyTasks()` — `session_task` joined through `department_session` WHERE `department_session.date = today` AND `assigned_to = me`. NOTE: `session_task` has no `shift_date` column — filter via the session's date.
- `useDayInfo()` — bookings, messages, active deviations for today
- `useShiftColleagues()` — profiles with shifts on same date+department

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add TanStack Query hooks for shifts, tasks, day info"
```

---

### Task 6.2: Shift Card Component

**Files:**

- Create: `apps/mobile/src/components/shift/ShiftCard.tsx`
- Create: `apps/mobile/src/components/shift/ShiftCardRich.tsx`

- [ ] **Step 1: Build ShiftCard (compact)**

Shows: date, time, position, department, work_hours, confirmation status. Used in shifts list.

- [ ] **Step 2: Build ShiftCardRich (expanded)**

Shows all ShiftCard fields + colleagues, leader notes, day info, bookings, active deviations. Used in home before_shift view and shift detail.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add ShiftCard and ShiftCardRich components"
```

---

### Task 6.3: Home Screen (Phase-Driven)

**Files:**

- Create: `apps/mobile/app/(app)/(home)/index.tsx`
- Create: `apps/mobile/src/components/home/NoShiftView.tsx`
- Create: `apps/mobile/src/components/home/BeforeShiftView.tsx`
- Create: `apps/mobile/src/components/home/DuringShiftView.tsx`
- Create: `apps/mobile/src/components/home/AfterShiftView.tsx`

- [ ] **Step 1: Build home screen**

Switch on `useShiftPhase().phase` → render correct view component. Wrap with SyncIndicator.

- [ ] **Step 2: Build NoShiftView**

Next shift card, unread messages count, locked V2 section.

- [ ] **Step 3: Build BeforeShiftView**

Rich shift card with confirm button, day brief, pre-shift tasks. Late punch-in warning if shift started.

- [ ] **Step 4: Build DuringShiftView**

Timer since punch-in, punch-out button (full-width), task feed sorted by priority, deviation button, chat shortcut, ring leder button.

- [ ] **Step 5: Build AfterShiftView**

Handoff text field + send (non-blocking). Hours confirmation (planned vs registered). Points summary.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(mobile): add phase-driven home screen with all 4 views"
```

---

### Task 6.4: Shifts Tab

**Files:**

- Create: `apps/mobile/app/(app)/(shifts)/index.tsx`
- Create: `apps/mobile/app/(app)/(shifts)/[id].tsx`
- Create: `apps/mobile/app/(app)/(shifts)/_layout.tsx`

- [ ] **Step 1: Build shifts list**

FlatList of upcoming shifts using `useMyShifts()`. Each row = ShiftCard. Inline confirm button if unconfirmed.

- [ ] **Step 2: Build shift detail**

ShiftCardRich + colleagues list + leader notes + day bookings.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add shifts tab with list and detail views"
```

---

### Task 6.5: Tab Bar + AI FAB

**Files:**

- Create: `apps/mobile/app/(app)/_layout.tsx`
- Create: `apps/mobile/src/components/navigation/TabBar.tsx`
- Create: `apps/mobile/src/components/navigation/AIFab.tsx`
- Create: `apps/mobile/src/components/navigation/QuickActions.tsx`

- [ ] **Step 1: Build custom tab bar**

4 tabs (Hjem, Vakter, Chat, Meg) with center FAB cutout. Unread badge on Chat tab.

- [ ] **Step 2: Build AI FAB**

Circular button centered in tab bar, elevated. Tap → opens Botsson sheet (placeholder in Phase 11). Swipe-up gesture → opens QuickActions.

- [ ] **Step 3: Build QuickActions**

Animated menu above FAB. Actions driven by `useShiftPhase().phase`. Each action maps to navigation or modal.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add custom tab bar with AI FAB and context-aware quick actions"
```

---

## Phase 7: Punch Clock (Agent wt-B)

> Depends on Phase 2 (offline queue) + Phase 3 (shift phase).

### Task 7.1: Punch Button Component

**Files:**

- Create: `apps/mobile/src/components/shift/PunchButton.tsx`
- Create: `apps/mobile/src/hooks/mutations/use-punch.ts`

- [ ] **Step 1: Build usePunch hook**

`punchIn(shiftId)`: generates UUID client-side, enqueues `punch_in` action, updates TanStack Query cache optimistically. `punchOut(timeEntryId)`: enqueues `punch_out` action with `punch_out: new Date()`.

Both use `enqueue()` from sync queue — they work offline.

- [ ] **Step 2: Build PunchButton**

Full-width button. Shows "STEMPLE INN" or "STEMPLE UT" based on active time entry. Haptic feedback + animated press state. One touch = done.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add punch clock with offline queue integration"
```

---

## Phase 8: Chat (Agent wt-C)

> Depends on Phase 4 (UI primitives).

### Task 8.1: Chat Query Hooks

**Files:**

- Create: `apps/mobile/src/hooks/queries/use-conversations.ts`
- Create: `apps/mobile/src/hooks/queries/use-messages.ts`
- Create: `apps/mobile/src/hooks/mutations/use-send-message.ts`

- [ ] **Step 1: Build hooks**

- `useConversations()` — all conversations for current profile, sorted by last message
- `useMessages(conversationId)` — paginated, 50 per page
- `useSendMessage()` — enqueues via sync queue for offline support, optimistic update in query cache

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add chat query hooks with offline message queueing"
```

---

### Task 8.2: Chat Screens

**Files:**

- Create: `apps/mobile/app/(app)/(chat)/index.tsx`
- Create: `apps/mobile/app/(app)/(chat)/[id].tsx`
- Create: `apps/mobile/app/(app)/(chat)/_layout.tsx`
- Create: `apps/mobile/src/components/chat/ChannelRow.tsx`
- Create: `apps/mobile/src/components/chat/MessageBubble.tsx`
- Create: `apps/mobile/src/components/chat/MessageInput.tsx`
- Create: `apps/mobile/src/components/chat/ReactionBar.tsx`

- [ ] **Step 1: Build channel list**

Sectioned FlatList: "Aktiv vakt" (session channel if during_shift), "Kanaler" (department/team groups), "Direktmeldinger" (DMs). Each row shows channel name, last message preview, timestamp, unread badge.

- [ ] **Step 2: Build conversation screen**

Inverted FlatList for messages. MessageBubble with sender avatar, timestamp, pending sync icon. MessageInput at bottom. Keyboard-aware.

- [ ] **Step 3: Build reactions + reply**

Long-press → reaction bar (6 emojis). Swipe right → reply context.

- [ ] **Step 4: Add Supabase Realtime subscription**

Subscribe to `postgres_changes` on `chat_message` filtered by `conversation_id`. Update query cache on new message.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(mobile): add chat screens with realtime and offline support"
```

---

## Phase 9: Tasks + HACCP + Deviations (Agent wt-D)

> Depends on Phase 4 (UI primitives) + Phase 2 (offline queue).

### Task 9.1: Task Modal Framework

**Files:**

- Create: `apps/mobile/src/components/task/TaskModal.tsx`
- Create: `apps/mobile/src/components/task/TaskFeed.tsx`
- Create: `apps/mobile/src/lib/resolve-task-type.ts`

- [ ] **Step 1: Build resolveTaskType()**

Pure function. Derives task_type from session_task data (spec section 5.3). Returns `'haccp' | 'checklist' | 'confirmation' | 'procedure' | 'general'`.

- [ ] **Step 2: Build TaskModal**

Bottom sheet. Switch on task_type → renders appropriate form. Each form follows "one screen, one task" rule.

- [ ] **Step 3: Build TaskFeed**

FlatList of tasks sorted by priority (compliance first, then deadline, then general). Each row shows priority indicator + label + deadline.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add universal task modal with type resolution"
```

---

### Task 9.2: HACCP Form

**Files:**

- Create: `apps/mobile/src/components/task/HACCPForm.tsx`
- Create: `apps/mobile/src/hooks/mutations/use-log-haccp.ts`

- [ ] **Step 1: Build useLogHaccp hook**

Enqueues `haccp_log` action via sync queue. Payload: `{ ccp_reference, temperature, unit, is_within_range, corrective_action, session_id, profile_id, workspace_id }`.

- [ ] **Step 2: Build HACCPForm**

CCP reference (pre-filled from task), numeric temperature input (large, thumb-friendly), within/outside range toggle, corrective action text (only if outside range). Submit → enqueue → close modal.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add HACCP temperature logging form with offline queue"
```

---

### Task 9.3: Deviation Reporting

**Files:**

- Create: `apps/mobile/src/components/task/DeviationForm.tsx`
- Create: `apps/mobile/src/hooks/mutations/use-report-deviation.ts`

- [ ] **Step 1: Build useReportDeviation hook**

Enqueues `report_deviation` action. Payload matches `deviation` table columns.

- [ ] **Step 2: Build DeviationForm**

Bottom sheet accessible from any context. Domain picker (safety/customer/procedure/system/material), severity, title, description, optional photo. Minimal friction.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add deviation reporting form with offline queue"
```

---

### Task 9.4: Handoff + Hours Confirmation

**Files:**

- Create: `apps/mobile/src/components/shift/HandoffForm.tsx`
- Create: `apps/mobile/src/components/shift/HoursConfirmation.tsx`
- Create: `apps/mobile/src/hooks/mutations/use-submit-handoff.ts`
- Create: `apps/mobile/src/hooks/mutations/use-confirm-hours.ts`

- [ ] **Step 1: Build HandoffForm**

Text input for handoff notes. Submit enqueues `submit_handoff` action. Non-blocking — skipping shows "ej innlevert" label.

- [ ] **Step 2: Build HoursConfirmation**

Shows planned vs registered hours + break time. "Bekreft" enqueues `confirm_hours`. "Bestrid" opens text input for justification.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add handoff and hours confirmation components"
```

---

## Phase 10: Push Notifications (Agent wt-A)

> Depends on Phase 1 (migrations) for `expo_push_token` column.

### Task 10.1: Push Registration

**Files:**

- Create: `apps/mobile/src/lib/push.ts`

- [ ] **Step 1: Build push registration**

On app start (after auth): request permission, get Expo push token, compare with `profile.expo_push_token`, update if different.

- [ ] **Step 2: Wire into AuthProvider**

Call `registerPushToken()` after successful auth.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): add push notification token registration"
```

---

### Task 10.2: Push Dispatch Edge Function

**Files:**

- Create: `supabase/functions/push-dispatch/index.ts`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_push_dispatch_triggers.sql`
- Modify: `supabase/functions/config.toml` — add `verify_jwt = false` for push-dispatch

- [ ] **Step 1: Build Edge Function**

Validates `PUSH_DISPATCH_SECRET`. Takes `{ event, profile_id, workspace_id, payload }`. Fetches `expo_push_token` from profile. Posts to Expo Push API. Falls back to SMS via Twilio for critical events.

- [ ] **Step 2: Create Postgres trigger migration**

Migration file: `supabase/migrations/YYYYMMDDHHMMSS_push_dispatch_triggers.sql`. One trigger function per event type (shift published, task assigned, deviation reported, etc.). Each calls `push-dispatch` via `net.http_post()`. Run migration via `docker exec`.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(push): add push-dispatch Edge Function with Postgres triggers"
```

---

### Task 10.3: Push Notification Handler (Mobile)

**Files:**

- Modify: `apps/mobile/src/lib/push.ts` — Add notification received/tapped handlers

- [ ] **Step 1: Handle incoming notifications**

When app is foregrounded: show in-app banner. When tapped: extract deep link from notification data → `router.push()` to correct screen.

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add push notification handler with deep link navigation"
```

---

## Phase 11: AI FAB / Botsson (Agent wt-B)

> Depends on Phase 6 (FAB component exists as placeholder).

### Task 11.1: Botsson Chat Sheet

**Files:**

- Create: `apps/mobile/src/components/ai/BotssonSheet.tsx`
- Create: `apps/mobile/src/components/ai/BotssonMessage.tsx`
- Create: `apps/mobile/src/hooks/queries/use-botsson-chat.ts`

- [ ] **Step 1: Build chat hook**

Fetches conversation WHERE `type = 'ai'` for current profile. Sends messages to same conversation. Stage Engine picks them up via existing backend.

Context payload per message (spec section 9.3): `{ profile_id, workspace_id, role, department_id, shift_phase, active_shift_id, active_session_id, trainee_status, pending_tasks_count }`.

- [ ] **Step 2: Build BotssonSheet**

Bottom sheet (70% height). Message list + input. Context-aware greeting based on shift phase.

- [ ] **Step 3: Wire into AIFab**

Replace placeholder. Tap → open BotssonSheet.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add Mr. Botsson text chat via Stage Engine"
```

---

## Phase 12: Me Tab + Polish (Agent wt-C)

> Depends on Phase 5 (auth) + Phase 4 (UI).

### Task 12.1: Me Tab

**Files:**

- Create: `apps/mobile/app/(app)/(me)/index.tsx`
- Create: `apps/mobile/app/(app)/(me)/_layout.tsx`

- [ ] **Step 1: Build Me screen**

Profile info (name, role, department, avatar). Notification preferences toggle. "Ring leder" shortcut (during_shift only). Logout button. Locked V2 section (training, certificates).

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(mobile): add Me tab with profile and settings"
```

---

### Task 12.2: Empty States

**Files:**

- Modify: All view components that can be empty

- [ ] **Step 1: Add instructional empty states everywhere**

Design rule #7: empty states are instructions. "Ingen oppgaver" → "Alt klart. Neste vakt: fredag 16:00." Review every FlatList and view for empty state handling.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(mobile): add instructional empty states to all views"
```

---

### Task 12.3: Haptic Feedback Pass

- [ ] **Step 1: Audit all touchable components**

Design rule #5: every touch gets visual response + haptic within 100ms. Add `expo-haptics` to every Button, PunchButton, tab press, FAB, quick action.

- [ ] **Step 2: Commit**

```bash
git commit -m "fix(mobile): add haptic feedback to all touch interactions"
```

---

## Phase 13: Integration (Sequential — Single Agent)

> Final pass. Merges all feature branches, runs typecheck, verifies e2e.

### Task 13.1: Merge All Feature Branches

- [ ] **Step 1: Merge each phase branch to development in dependency order**

```bash
git checkout development
git merge feat/mobile-foundation
git merge feat/mobile-migrations
# ... etc for each phase branch
```

- [ ] **Step 2: Resolve any merge conflicts**

- [ ] **Step 3: Run full typecheck**

```bash
pnpm turbo typecheck
```

- [ ] **Step 4: Run mobile app**

```bash
cd apps/mobile && npx expo start --clear
```

Verify: app boots, auth flow works, home screen renders correct phase, punch works, chat connects.

- [ ] **Step 5: Commit any integration fixes**

```bash
git commit -m "fix(mobile): resolve integration issues from parallel development"
```

---

### Task 13.2: ADR for Hardcoded Norwegian

**Files:**

- Create: `docs/decisions/NNNN-mobile-hardcoded-norwegian.md`

- [ ] **Step 1: Write ADR**

Documents the decision to override CLAUDE.md's "never hardcode Norwegian" rule for V1 mobile. Justification: web does same thing, i18n infrastructure (`@smartout/i18n`) ready for V2, translation effort not justified for MVP.

- [ ] **Step 2: Register in decision log**

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(decisions): ADR for hardcoded Norwegian in mobile V1"
```

---

## File Map Summary

```
apps/mobile/
├── app/
│   ├── _layout.tsx                          # Task 0.3
│   ├── +not-found.tsx                       # Task 0.1
│   ├── (auth)/
│   │   ├── _layout.tsx                      # Task 0.3
│   │   ├── welcome.tsx                      # Task 5.1
│   │   ├── verify.tsx                       # Task 5.2
│   │   ├── workspace-select.tsx             # Task 5.3
│   │   ├── pending.tsx                      # Task 5.3
│   │   └── invite/[token].tsx               # Task 5.4
│   └── (app)/
│       ├── _layout.tsx                      # Task 6.5
│       ├── (home)/
│       │   ├── _layout.tsx                  # Task 6.3
│       │   └── index.tsx                    # Task 6.3
│       ├── (shifts)/
│       │   ├── _layout.tsx                  # Task 6.4
│       │   ├── index.tsx                    # Task 6.4
│       │   └── [id].tsx                     # Task 6.4
│       ├── (chat)/
│       │   ├── _layout.tsx                  # Task 8.2
│       │   ├── index.tsx                    # Task 8.2
│       │   └── [id].tsx                     # Task 8.2
│       └── (me)/
│           ├── _layout.tsx                  # Task 12.1
│           └── index.tsx                    # Task 12.1
├── src/
│   ├── components/
│   │   ├── ui/                              # Task 4.2
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── index.ts
│   │   ├── common/                          # Task 2.4, 4.3
│   │   │   ├── SyncIndicator.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── SectionHeader.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── shift/                           # Task 6.2, 7.1, 9.4
│   │   │   ├── ShiftCard.tsx
│   │   │   ├── ShiftCardRich.tsx
│   │   │   ├── PunchButton.tsx
│   │   │   ├── HandoffForm.tsx
│   │   │   └── HoursConfirmation.tsx
│   │   ├── task/                            # Task 9.1-9.3
│   │   │   ├── TaskModal.tsx
│   │   │   ├── TaskFeed.tsx
│   │   │   ├── HACCPForm.tsx
│   │   │   └── DeviationForm.tsx
│   │   ├── chat/                            # Task 8.2
│   │   │   ├── ChannelRow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── MessageInput.tsx
│   │   │   └── ReactionBar.tsx
│   │   ├── home/                            # Task 6.3
│   │   │   ├── NoShiftView.tsx
│   │   │   ├── BeforeShiftView.tsx
│   │   │   ├── DuringShiftView.tsx
│   │   │   └── AfterShiftView.tsx
│   │   ├── navigation/                      # Task 6.5
│   │   │   ├── TabBar.tsx
│   │   │   ├── AIFab.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── auth/                            # Task 5.1
│   │   │   ├── InviteEntry.tsx
│   │   │   ├── CodeEntry.tsx
│   │   │   └── WorkspaceSearch.tsx
│   │   └── ai/                              # Task 11.1
│   │       ├── BotssonSheet.tsx
│   │       └── BotssonMessage.tsx
│   ├── hooks/
│   │   ├── queries/                         # Task 6.1, 8.1, 11.1
│   │   │   ├── use-my-shifts.ts
│   │   │   ├── use-active-time-entry.ts
│   │   │   ├── use-my-tasks.ts
│   │   │   ├── use-day-info.ts
│   │   │   ├── use-shift-colleagues.ts
│   │   │   ├── use-conversations.ts
│   │   │   ├── use-messages.ts
│   │   │   └── use-botsson-chat.ts
│   │   ├── mutations/                       # Task 7.1, 8.1, 9.2-9.4
│   │   │   ├── use-punch.ts
│   │   │   ├── use-send-message.ts
│   │   │   ├── use-log-haccp.ts
│   │   │   ├── use-report-deviation.ts
│   │   │   ├── use-submit-handoff.ts
│   │   │   └── use-confirm-hours.ts
│   │   └── stores/                          # Task 2.4, 3.2
│   │       ├── use-sync-status.ts
│   │       └── use-shift-phase.ts
│   ├── lib/
│   │   ├── supabase.ts                      # Task 0.2
│   │   ├── push.ts                          # Task 10.1, 10.3
│   │   ├── shift-phase.ts                   # Task 3.1
│   │   ├── resolve-task-type.ts             # Task 9.1
│   │   ├── sync/                            # Task 2.1-2.2
│   │   │   ├── db.ts
│   │   │   ├── queue.ts
│   │   │   ├── action-map.ts
│   │   │   ├── worker.ts
│   │   │   └── types.ts
│   │   └── cache/                           # Task 2.3
│   │       ├── mmkv.ts
│   │       └── persister.ts
│   ├── providers/                           # Task 0.3
│   │   ├── query-provider.tsx
│   │   └── auth-provider.tsx
│   ├── theme/                               # Task 4.1
│   │   ├── index.ts
│   │   ├── spacing.ts
│   │   ├── colors.ts
│   │   └── typography.ts
│   └── constants/                           # Various
│       └── strings.ts
├── metro.config.js                          # Task 0.1
├── babel.config.js                          # Task 0.1
├── app.json                                 # Task 0.1, 5.4
├── tsconfig.json                            # Task 0.1
└── package.json                             # Task 0.1

supabase/
├── migrations/
│   ├── YYYYMMDDHHMMSS_timesheet_schema.sql           # Task 1.1
│   ├── YYYYMMDDHHMMSS_haccp_log.sql                  # Task 1.2
│   ├── YYYYMMDDHHMMSS_workspace_join_code.sql        # Task 1.3
│   ├── YYYYMMDDHHMMSS_mobile_schema_additions.sql    # Task 1.4
│   └── YYYYMMDDHHMMSS_remove_shift_approval_punch.sql # Task 1.5
└── functions/
    └── push-dispatch/index.ts                         # Task 10.2

docs/decisions/
└── NNNN-mobile-hardcoded-norwegian.md                 # Task 13.2
```

**Total: ~65 files, 13 phases, 30 tasks.**

---

## Council Verdict

**Date:** 2026-03-26
**Verdict:** APPROVED_WITH_CONDITIONS
**Reviewer:** Council Agent (automated review)

### Status Note

This plan is dated 2026-03-18 with status "draft", but the implementation is **already complete** as of 2026-03-26. All Phase 1 migrations have been applied (`20260418100001`–`20260418100400`), all lib/hook/component files exist in `apps/mobile/src/`, and the mobile app structure is fully scaffolded. This is a **retrospective review**.

---

### What Was Done Well

- **Cascade compliance**: `timesheet` schema correctly isolated from `public`. DB traps respected (no `operating_hours`, proper RLS on all new tables).
- **Security**: Anon-accessible RPCs (`lookup_workspace_by_code`, `search_workspaces`) expose only `workspace_id, name, logo_url` — acceptable for pre-auth workspace discovery.
- **Offline architecture**: SQLite write queue + MMKV read cache is well-designed and complete (`apps/mobile/src/lib/sync/`, `cache/`).
- **Phase sequencing**: Foundation → Migrations → Parallel blocks is correct. Sequential gates are enforced.
- **Mobile parity intention**: Plan respects the mobile parity principle with monorepo-shared packages (`@smartout/types`, `@smartout/design-tokens/native`, `@smartout/telemetry`).
- **Design tokens**: Uses `packages/design-tokens/native.ts` — no hardcoded values in components.
- **Supabase direct client with SecureStore**: Correct pattern for mobile auth (no gateway required).

---

### Blocking Conditions (must resolve)

**1. Missing `emit()` calls in all mutation hooks**

All 11 mutation files (`use-punch.ts`, `use-log-haccp.ts`, `use-report-deviation.ts`, `use-submit-handoff.ts`, `use-confirm-hours.ts`, `use-send-message.ts`, `use-request-absence.ts`, `use-cancel-absence.ts`, `use-send-channel-message.ts`, `use-livekit-call.ts`, `use-call-signaling.ts`) have zero `emit()` calls.

CLAUDE.md: **"Never create a TanStack Query mutation without an emit() call in onSuccess. No mutation without emit. No second event system."**

Fix: Add `import { emit } from '@smartout/telemetry'` + `emit('mobile.punch.clocked_in', {...})` pattern in each `onSuccess` callback. Register events in `packages/telemetry/src/registry.ts` first.

**2. Missing ADR for hardcoded Norwegian strings**

`apps/mobile/src/constants/strings.ts` documents the decision inline (`// i18n via @smartout/i18n planned for V2`) but Plan Task 13.2 explicitly calls for `docs/decisions/NNNN-mobile-hardcoded-norwegian.md`. This ADR was never created.

Fix: Create the ADR and register it in `docs/decisions/0000-decision-log.md`. Record the decision: V1 uses `strings.ts` as single-source; V2 migrates to `@smartout/i18n` keys.

---

### Non-Blocking Observations

- **Mobile hooks not in packages/**: Query hooks live in `apps/mobile/src/hooks/` rather than `packages/`. This is acceptable — they are RN-specific (TanStack Query on mobile) and cannot be shared with web. The shared types and telemetry correctly live in packages.
- **`push-dispatch` edge function present**: `supabase/functions/push-dispatch/index.ts` exists. Confirm it's registered in `supabase/functions/config.toml` with `verify_jwt = false` since it handles platform-level push delivery.
- **Plan step 13.2 ADR pending**: See blocking condition #2 above.

---

### Required Actions Before Considering Feature Complete

1. Add `emit()` to all 11 mutation hooks (blocking — CLAUDE.md law)
2. Create `docs/decisions/NNNN-mobile-hardcoded-norwegian.md` and register in decision log (blocking — knowledge system compliance)
3. Verify `push-dispatch` is in `config.toml` (non-blocking, sanity check)

Once conditions 1 and 2 are resolved, this feature is **APPROVED** for closure via `/close-feature`.
