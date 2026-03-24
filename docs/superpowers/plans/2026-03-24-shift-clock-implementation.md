---
title: "ShiftClock Implementation Plan"
status: draft
updated: 2026-03-24
created: 2026-03-24
module: operations
tags: [plan, shift-clock, punch, implementation]
---

# ShiftClock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the ShiftClock — a fullscreen punch clock view for employees to clock in/out, take breaks, register supplements, chat, take notes, and call leaders. Shared logic in a package, platform-specific UI in apps/web and apps/mobile.

**Architecture:** Shared pure-logic package (`packages/shift-clock`) with state machine, Zod schemas, break classifier, GPS distance, and points calculator. Platform-specific hooks in `apps/web/src/hooks/shift-clock/` and `apps/mobile/src/hooks/shift-clock/` handle DB mutations via Supabase. Server-side compliance via Edge Function. Two new DB tables, column additions on 3 existing tables, 10 telemetry events.

**Tech Stack:** TypeScript, Zod, TanStack Query, Supabase (PostgreSQL, Realtime, Edge Functions), React Native (expo-location, expo-haptics), Next.js (App Router), LiveKit (voice, fallback to chat)

**Spec:** `docs/superpowers/specs/2026-03-24-shift-clock-design.md`
**Animation reference:** `.superpowers/brainstorm/64049-1774371756/punch-animation.html`

> **Commit convention:** All commits MUST end with `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`. Commit messages in this plan omit it for brevity — add it when committing.

> **Schema note:** `time_entry` lives in `timesheet` schema. All Supabase queries must use `.schema("timesheet").from("time_entry")`. `manual_supplement` and `break_rule` live in `payroll` schema — use `.schema("payroll").from("manual_supplement")` etc.

---

## File Structure

### New files

```
packages/shift-clock/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    — Named exports
│   ├── types.ts                    — ShiftClockState, GPSConfig, BreakClassification, SupplementClaim
│   ├── schemas.ts                  — Zod: PunchInPayload, PunchOutPayload, BreakPayload, SupplementPayload, GPSSnapshot
│   ├── state-machine.ts            — Pure: transitions, guards, phase detection
│   └── utils/
│       ├── break-classifier.ts     — (workMinutes, breakDuration, rules) → {isPaid, rule}
│       ├── gps-distance.ts         — Haversine: (lat1, lng1, lat2, lng2) → meters
│       └── points-calculator.ts    — (punchTime, shiftStart, multipliers) → {base, bonuses, total}

supabase/migrations/
├── 20260422500000_shift_clock_config.sql
├── 20260422500100_shift_note.sql
├── 20260422500200_alter_time_entry_gps.sql
├── 20260422500300_alter_schedule_shift_adhoc.sql
├── 20260422500400_alter_manual_supplement_claims.sql

supabase/functions/shift-clock-compliance/
├── index.ts                        — Edge Function: GPS verification + rest check + weekly hours

apps/web/src/hooks/shift-clock/
├── useShiftClock.ts                — Context provider + Supabase mutations
├── useGPSGuard.ts                  — navigator.geolocation wrapper + config fetch
├── useBreakRules.ts                — Fetch payroll.break_rule, apply classifier
├── useShiftChat.ts                 — Create/join session chat + shift thread
├── useShiftNotes.ts                — CRUD shift_note via Supabase
├── useSupplements.ts               — Register/list manual supplements
└── useShiftClockConfig.ts          — Fetch cascading config

apps/web/src/app/dashboard/shift-clock/
├── page.tsx                        — Route: /dashboard/shift-clock
├── ShiftClockView.tsx              — Fullscreen employee view
├── ShiftClockHeader.tsx            — Live timer + status badge
├── ShiftClockActions.tsx           — 2x2 action grid
├── ShiftClockTabs.tsx              — Tabs: Feed | Chat | Notes
├── ShiftClockSummary.tsx           — Post-punch-out summary
├── PunchButton.tsx                 — Glowing fingerprint button + animation
├── BreakToggle.tsx                 — Start/end break
├── SupplementSheet.tsx             — Bottom sheet for supplement claims
├── NoteInput.tsx                   — Add note to shift
├── CallLeaderButton.tsx            — WalkieTalkie integration (fallback: chat)
└── LeaderOverview.tsx              — Manager view: all active shifts grid

apps/mobile/src/hooks/shift-clock/
├── useShiftClock.ts                — Offline-first mutations via sync queue
├── useGPSGuard.ts                  — expo-location wrapper
├── useBreakRules.ts                — Cached rules
├── useShiftChat.ts                 — Chat with offline queue
├── useShiftNotes.ts                — Notes with offline queue
└── useSupplements.ts               — Supplements with offline queue
```

### Modified files

```
packages/telemetry/src/registry.ts  — Add 10 shift clock events + interfaces + routing
apps/mobile/src/lib/sync/action-map.ts — Add break_start, break_end, supplement_claim actions
apps/mobile/src/hooks/mutations/use-punch.ts — Add GPS payload to punchIn/punchOut
apps/mobile/src/components/shift/PunchButton.tsx — Update to navigate to new shift-clock route
supabase/config.toml      — Add shift-clock-compliance with verify_jwt = false
packages/supabase/src/database.types.ts — Regenerate after migrations
```

---

## Phase 1: Foundation (Database + Package + Telemetry)

### Task 1: Database migrations — new tables

**Files:**

- Create: `supabase/migrations/20260422500000_shift_clock_config.sql`
- Create: `supabase/migrations/20260422500100_shift_note.sql`

- [ ] **Step 1: Write shift_clock_config migration**

```sql
-- supabase/migrations/20260422500000_shift_clock_config.sql
-- ShiftClock configuration table — cascading: team > department > workspace

CREATE TABLE shift_clock_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id           UUID REFERENCES department(department_id) ON DELETE CASCADE,
  team_id                 UUID REFERENCES team(team_id) ON DELETE CASCADE,
  gps_required            BOOLEAN NOT NULL DEFAULT false,
  gps_radius_meters       INT NOT NULL DEFAULT 200,
  gps_reference_lat       NUMERIC(10,7),
  gps_reference_lng       NUMERIC(10,7),
  adhoc_shifts_enabled    BOOLEAN NOT NULL DEFAULT false,
  adhoc_requires_approval BOOLEAN NOT NULL DEFAULT true,
  punch_window_minutes    INT NOT NULL DEFAULT 30,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_clock_config UNIQUE (workspace_id, department_id, team_id)
);

CREATE TRIGGER set_shift_clock_config_updated_at
  BEFORE UPDATE ON shift_clock_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shift_clock_config ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read
CREATE POLICY "jwt_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: admins can manage
CREATE POLICY "jwt_manage_shift_clock_config" ON shift_clock_config
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 2: Write shift_note migration**

```sql
-- supabase/migrations/20260422500100_shift_note.sql
-- Per-shift notes from employees during active shifts

CREATE TABLE shift_note (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id      UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES profile(profile_id),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_shift_note_updated_at
  BEFORE UPDATE ON shift_note
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_shift_note_shift ON shift_note(shift_id);
CREATE INDEX idx_shift_note_workspace ON shift_note(workspace_id);

ALTER TABLE shift_note ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read
CREATE POLICY "jwt_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: employees can insert own notes
CREATE POLICY "jwt_insert_shift_note" ON shift_note
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND profile_id = (SELECT p.profile_id FROM profile p WHERE p.user_id = auth.uid() LIMIT 1)
  );

-- API key: workspace-scoped read
CREATE POLICY "api_key_read_shift_note" ON shift_note
  FOR SELECT USING (workspace_id = get_api_workspace_id());
```

- [ ] **Step 3: Run both migrations against local Supabase**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422500000_shift_clock_config.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422500100_shift_note.sql
```

Expected: Both run without errors.

- [ ] **Step 4: Verify tables exist**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres -c "\dt shift_clock_config; \dt shift_note;"
```

Expected: Both tables listed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260422500000_shift_clock_config.sql supabase/migrations/20260422500100_shift_note.sql
git commit -m "feat(db): add shift_clock_config and shift_note tables with RLS"
```

---

### Task 2: Database migrations — alter existing tables

**Files:**

- Create: `supabase/migrations/20260422500200_alter_time_entry_gps.sql`
- Create: `supabase/migrations/20260422500300_alter_schedule_shift_adhoc.sql`
- Create: `supabase/migrations/20260422500400_alter_manual_supplement_claims.sql`

- [ ] **Step 1: Write time_entry GPS columns migration**

```sql
-- supabase/migrations/20260422500200_alter_time_entry_gps.sql
-- Add GPS tracking for punch-out and break start/end locations

ALTER TABLE timesheet.time_entry
  ADD COLUMN IF NOT EXISTS punch_out_location JSONB,
  ADD COLUMN IF NOT EXISTS break_locations JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN timesheet.time_entry.punch_out_location IS 'GPS at punch-out: {lat, lng, accuracy, timestamp}';
COMMENT ON COLUMN timesheet.time_entry.break_locations IS 'GPS at break start/end: [{start: {lat,lng}, end: {lat,lng}}]';
COMMENT ON COLUMN timesheet.time_entry.notes IS 'Optional employee notes during shift';
```

- [ ] **Step 2: Write schedule_shift adhoc columns migration**

```sql
-- supabase/migrations/20260422500300_alter_schedule_shift_adhoc.sql
-- Support ad-hoc shifts created at punch-in time

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS is_adhoc BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adhoc_approved_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS adhoc_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN schedule_shift.is_adhoc IS 'True if shift was created ad-hoc at punch-in (not scheduled)';
```

- [ ] **Step 3: Write manual_supplement claims migration**

```sql
-- supabase/migrations/20260422500400_alter_manual_supplement_claims.sql
-- Employee-initiated supplement claims with approval workflow

CREATE TYPE supplement_claim_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE payroll.manual_supplement -- NOTE: table is in payroll schema after migration 20260422110700
  ADD COLUMN IF NOT EXISTS employee_comment TEXT,
  ADD COLUMN IF NOT EXISTS status supplement_claim_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN payroll.manual_supplement.employee_comment IS 'Required for employee-initiated claims via ShiftClock, nullable for admin-created supplements';
COMMENT ON COLUMN payroll.manual_supplement.status IS 'Approval workflow: pending → approved/rejected by leader';
```

- [ ] **Step 4: Run all three migrations**

```bash
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422500200_alter_time_entry_gps.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422500300_alter_schedule_shift_adhoc.sql
docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres < supabase/migrations/20260422500400_alter_manual_supplement_claims.sql
```

Expected: All run without errors.

- [ ] **Step 5: Regenerate database types**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 6: Verify new columns in generated types**

Read `packages/supabase/src/database.types.ts` and search for `punch_out_location`, `is_adhoc`, `supplement_claim_status`. All three should appear.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/2026032414020*.sql supabase/migrations/2026032414030*.sql supabase/migrations/2026032414040*.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add GPS, adhoc shift, and supplement claim columns"
```

---

### Task 3: Shared package — `packages/shift-clock`

**Files:**

- Create: `packages/shift-clock/package.json`
- Create: `packages/shift-clock/tsconfig.json`
- Create: `packages/shift-clock/src/index.ts`
- Create: `packages/shift-clock/src/types.ts`
- Create: `packages/shift-clock/src/schemas.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@smartout/shift-clock",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
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

- [ ] **Step 2: Create tsconfig.json**

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

- [ ] **Step 3: Create types.ts**

```typescript
/**
 * ShiftClock types — shared between web and mobile.
 * Pure type definitions, no runtime dependencies.
 */

export type ShiftClockPhase = "idle" | "clocked_in" | "on_break" | "summary";

export type GPSSnapshot = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
};

export type GPSConfig = {
  required: boolean;
  radiusMeters: number;
  referenceLat: number | null;
  referenceLng: number | null;
};

export type BreakClassification = {
  isPaid: boolean;
  ruleId: string | null;
  ruleName: string | null;
};

export type BreakEntry = {
  start: string;
  end: string | null;
  startLocation: GPSSnapshot | null;
  endLocation: GPSSnapshot | null;
};

export type ShiftClockState = {
  phase: ShiftClockPhase;
  shiftId: string | null;
  timeEntryId: string | null;
  punchInTime: string | null;
  punchOutTime: string | null;
  currentBreak: BreakEntry | null;
  breaks: BreakEntry[];
  gpsConfig: GPSConfig | null;
};

export type SupplementOption = {
  id: string;
  name: string;
  description: string;
  salaryCode: string;
  amount: number;
  rateType: "per_hour" | "per_shift";
  commentRequired: boolean;
};

export type SupplementClaim = {
  supplementRuleId: string;
  shiftId: string;
  comment: string;
  timestamp: string;
};

export type PunchResult = {
  allowed: boolean;
  warnings: ComplianceWarning[];
  blockReason: string | null;
};

export type ComplianceWarning = {
  code: string;
  message: string;
  severity: "warning" | "block";
};
```

- [ ] **Step 4: Create schemas.ts**

```typescript
/**
 * Zod schemas for ShiftClock payloads.
 * Validates data at system boundaries (punch requests, GPS, supplements).
 */

import { z } from "zod";

export const gpsSnapshotSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export const punchInPayloadSchema = z.object({
  shiftId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
  isAdhoc: z.boolean().default(false),
});

export const punchOutPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
  comment: z.string().max(1000).optional(),
});

export const breakStartPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
});

export const breakEndPayloadSchema = z.object({
  timeEntryId: z.string().uuid(),
  gps: gpsSnapshotSchema.nullable(),
});

export const supplementClaimSchema = z.object({
  supplementRuleId: z.string().uuid(),
  shiftId: z.string().uuid(),
  comment: z.string().min(1, "Comment is required").max(1000),
  timestamp: z.string().datetime(),
});

export const shiftNoteSchema = z.object({
  shiftId: z.string().uuid(),
  content: z.string().min(1).max(2000),
});

export type PunchInPayload = z.infer<typeof punchInPayloadSchema>;
export type PunchOutPayload = z.infer<typeof punchOutPayloadSchema>;
export type BreakStartPayload = z.infer<typeof breakStartPayloadSchema>;
export type BreakEndPayload = z.infer<typeof breakEndPayloadSchema>;
export type SupplementClaimPayload = z.infer<typeof supplementClaimSchema>;
export type ShiftNotePayload = z.infer<typeof shiftNoteSchema>;
```

- [ ] **Step 5: Create index.ts**

```typescript
export {
  type ShiftClockPhase,
  type ShiftClockState,
  type GPSSnapshot,
  type GPSConfig,
  type BreakClassification,
  type BreakEntry,
  type SupplementOption,
  type SupplementClaim,
  type PunchResult,
  type ComplianceWarning,
} from "./types";

export {
  gpsSnapshotSchema,
  punchInPayloadSchema,
  punchOutPayloadSchema,
  breakStartPayloadSchema,
  breakEndPayloadSchema,
  supplementClaimSchema,
  shiftNoteSchema,
  type PunchInPayload,
  type PunchOutPayload,
  type BreakStartPayload,
  type BreakEndPayload,
  type SupplementClaimPayload,
  type ShiftNotePayload,
} from "./schemas";

export { calculateGPSDistance } from "./utils/gps-distance";
export { classifyBreak } from "./utils/break-classifier";
export { calculatePunchPoints } from "./utils/points-calculator";
export { type ShiftClockTransition, canTransition, getNextPhase } from "./state-machine";
```

- [ ] **Step 6: Run pnpm install to register the new package**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/shift-clock/
git commit -m "feat(shift-clock): scaffold shared package with types and schemas"
```

---

### Task 4: Pure utility functions with TDD

**Files:**

- Create: `packages/shift-clock/src/utils/gps-distance.ts`
- Create: `packages/shift-clock/src/utils/break-classifier.ts`
- Create: `packages/shift-clock/src/utils/points-calculator.ts`
- Create: `packages/shift-clock/src/state-machine.ts`
- Create: `packages/shift-clock/src/__tests__/gps-distance.test.ts`
- Create: `packages/shift-clock/src/__tests__/break-classifier.test.ts`
- Create: `packages/shift-clock/src/__tests__/points-calculator.test.ts`
- Create: `packages/shift-clock/src/__tests__/state-machine.test.ts`

- [ ] **Step 1: Write GPS distance test**

```typescript
// packages/shift-clock/src/__tests__/gps-distance.test.ts
import { describe, it, expect } from "vitest";
import { calculateGPSDistance } from "../utils/gps-distance";

describe("calculateGPSDistance", () => {
  it("returns 0 for identical points", () => {
    expect(calculateGPSDistance(59.9139, 10.7522, 59.9139, 10.7522)).toBe(0);
  });

  it("calculates distance between two known Oslo points (~1km)", () => {
    // Oslo Sentralstasjon → Aker Brygge ≈ 1100m
    const distance = calculateGPSDistance(59.9109, 10.753, 59.9113, 10.7306);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1300);
  });

  it("returns distance in meters", () => {
    // Two points ~100m apart
    const distance = calculateGPSDistance(59.9139, 10.7522, 59.9148, 10.7522);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Implement GPS distance (Haversine)**

```typescript
// packages/shift-clock/src/utils/gps-distance.ts
/**
 * Haversine distance between two GPS coordinates.
 * Returns distance in meters.
 */
const EARTH_RADIUS_M = 6_371_000;

export function calculateGPSDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_M * c);
}
```

- [ ] **Step 3: Run GPS test**

```bash
cd packages/shift-clock && npx vitest run src/__tests__/gps-distance.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 4: Write break classifier test**

```typescript
// packages/shift-clock/src/__tests__/break-classifier.test.ts
import { describe, it, expect } from "vitest";
import { classifyBreak } from "../utils/break-classifier";

const paidRule = {
  id: "rule-1",
  name: "Betalt pause",
  triggerType: "after_duration" as const,
  triggerMinutes: 330, // 5.5 hours
  durationMinutes: 30,
  isPaid: true,
};

const unpaidRule = {
  id: "rule-2",
  name: "Ubetalt pause",
  triggerType: "after_duration" as const,
  triggerMinutes: 0,
  durationMinutes: 30,
  isPaid: false,
};

describe("classifyBreak", () => {
  it("returns paid when work minutes exceed trigger threshold", () => {
    const result = classifyBreak(360, [paidRule, unpaidRule]);
    expect(result.isPaid).toBe(true);
    expect(result.ruleId).toBe("rule-1");
  });

  it("returns unpaid when work minutes below threshold", () => {
    const result = classifyBreak(120, [paidRule, unpaidRule]);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBe("rule-2");
  });

  it("returns unpaid with no rule when no rules match", () => {
    const result = classifyBreak(120, [paidRule]);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBeNull();
  });

  it("returns unpaid with no rule when rules array is empty", () => {
    const result = classifyBreak(360, []);
    expect(result.isPaid).toBe(false);
    expect(result.ruleId).toBeNull();
  });
});
```

- [ ] **Step 5: Implement break classifier**

```typescript
// packages/shift-clock/src/utils/break-classifier.ts
/**
 * Classifies a break as paid/unpaid based on payroll break rules.
 * Employee never sees this — only affects payroll calculation.
 */
import type { BreakClassification } from "../types";

export type BreakRule = {
  id: string;
  name: string;
  triggerType: "after_duration" | "time_of_day";
  triggerMinutes: number;
  durationMinutes: number;
  isPaid: boolean;
};

export function classifyBreak(workMinutes: number, rules: BreakRule[]): BreakClassification {
  // Find the best matching rule: paid rules that match take priority
  const matchingPaid = rules.find(
    (r) => r.isPaid && r.triggerType === "after_duration" && workMinutes >= r.triggerMinutes,
  );
  if (matchingPaid) {
    return { isPaid: true, ruleId: matchingPaid.id, ruleName: matchingPaid.name };
  }

  // Fall back to unpaid rule
  const matchingUnpaid = rules.find(
    (r) => !r.isPaid && r.triggerType === "after_duration" && workMinutes >= r.triggerMinutes,
  );
  if (matchingUnpaid) {
    return { isPaid: false, ruleId: matchingUnpaid.id, ruleName: matchingUnpaid.name };
  }

  // No rules match — default to unpaid, no rule
  return { isPaid: false, ruleId: null, ruleName: null };
}
```

- [ ] **Step 6: Run break classifier test**

```bash
cd packages/shift-clock && npx vitest run src/__tests__/break-classifier.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 7: Write points calculator test**

```typescript
// packages/shift-clock/src/__tests__/points-calculator.test.ts
import { describe, it, expect } from "vitest";
import { calculatePunchPoints } from "../utils/points-calculator";

describe("calculatePunchPoints", () => {
  const shiftStart = new Date("2026-03-24T15:00:00Z");

  it("awards 7 points for 5+ min early punch", () => {
    const punchTime = new Date("2026-03-24T14:50:00Z"); // 10 min early
    const result = calculatePunchPoints(punchTime, shiftStart);
    expect(result.base).toBe(2);
    expect(result.bonuses).toContainEqual({ label: "on_time", points: 3 });
    expect(result.bonuses).toContainEqual({ label: "early", points: 2 });
    expect(result.total).toBe(7);
  });

  it("awards 5 points for on-time punch (< 5 min early)", () => {
    const punchTime = new Date("2026-03-24T14:57:00Z"); // 3 min early
    const result = calculatePunchPoints(punchTime, shiftStart);
    expect(result.total).toBe(5); // 2 base + 3 on_time
  });

  it("deducts points for late punch", () => {
    const punchTime = new Date("2026-03-24T15:10:00Z"); // 10 min late
    const result = calculatePunchPoints(punchTime, shiftStart);
    expect(result.total).toBe(0); // 2 base - 2 late
  });

  it("deducts extra for very late punch (>15 min)", () => {
    const punchTime = new Date("2026-03-24T15:20:00Z"); // 20 min late
    const result = calculatePunchPoints(punchTime, shiftStart);
    expect(result.total).toBe(-3); // 2 base - 2 late - 3 very_late
  });

  it("applies season multiplier", () => {
    const punchTime = new Date("2026-03-24T14:50:00Z");
    const result = calculatePunchPoints(punchTime, shiftStart, { seasonMultiplier: 1.5 });
    expect(result.total).toBe(11); // 7 * 1.5 = 10.5, rounded to 11
  });
});
```

- [ ] **Step 8: Implement points calculator**

```typescript
// packages/shift-clock/src/utils/points-calculator.ts
/**
 * Calculates gamification points for a punch-in based on punctuality.
 * Pure function — no side effects, no DB access.
 */

type PointBonus = { label: string; points: number };
type PointsResult = { base: number; bonuses: PointBonus[]; total: number };
type PointsOptions = { seasonMultiplier?: number; workspaceBooster?: number };

const BASE_POINTS = 2;
const ON_TIME_BONUS = 3;
const EARLY_BONUS = 2;
const LATE_PENALTY = -2;
const VERY_LATE_PENALTY = -3;
const EARLY_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
const VERY_LATE_THRESHOLD_MS = 15 * 60 * 1000; // 15 min

export function calculatePunchPoints(
  punchTime: Date,
  shiftStart: Date,
  options: PointsOptions = {},
): PointsResult {
  const { seasonMultiplier = 1, workspaceBooster = 1 } = options;
  const diffMs = punchTime.getTime() - shiftStart.getTime();
  const bonuses: PointBonus[] = [];

  if (diffMs <= 0) {
    // On time or early
    bonuses.push({ label: "on_time", points: ON_TIME_BONUS });
    if (diffMs <= -EARLY_THRESHOLD_MS) {
      bonuses.push({ label: "early", points: EARLY_BONUS });
    }
  } else {
    // Late
    bonuses.push({ label: "late", points: LATE_PENALTY });
    if (diffMs > VERY_LATE_THRESHOLD_MS) {
      bonuses.push({ label: "very_late", points: VERY_LATE_PENALTY });
    }
  }

  const subtotal = BASE_POINTS + bonuses.reduce((sum, b) => sum + b.points, 0);
  const total = Math.round(subtotal * seasonMultiplier * workspaceBooster);

  return { base: BASE_POINTS, bonuses, total };
}
```

- [ ] **Step 9: Write state machine test**

```typescript
// packages/shift-clock/src/__tests__/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { canTransition, getNextPhase } from "../state-machine";

describe("canTransition", () => {
  it("allows idle → clocked_in", () => {
    expect(canTransition("idle", "punch_in")).toBe(true);
  });

  it("allows clocked_in → on_break", () => {
    expect(canTransition("clocked_in", "start_break")).toBe(true);
  });

  it("allows on_break → clocked_in", () => {
    expect(canTransition("on_break", "end_break")).toBe(true);
  });

  it("allows clocked_in → summary", () => {
    expect(canTransition("clocked_in", "punch_out")).toBe(true);
  });

  it("allows summary → idle", () => {
    expect(canTransition("summary", "dismiss")).toBe(true);
  });

  it("blocks idle → on_break (must clock in first)", () => {
    expect(canTransition("idle", "start_break")).toBe(false);
  });

  it("blocks on_break → summary (must end break first)", () => {
    expect(canTransition("on_break", "punch_out")).toBe(false);
  });
});

describe("getNextPhase", () => {
  it("returns clocked_in for punch_in from idle", () => {
    expect(getNextPhase("idle", "punch_in")).toBe("clocked_in");
  });

  it("returns null for invalid transition", () => {
    expect(getNextPhase("idle", "start_break")).toBeNull();
  });
});
```

- [ ] **Step 10: Implement state machine**

```typescript
// packages/shift-clock/src/state-machine.ts
/**
 * ShiftClock state machine — pure transition logic.
 * No side effects. Used by platform-specific hooks to determine valid actions.
 */
import type { ShiftClockPhase } from "./types";

export type ShiftClockAction = "punch_in" | "punch_out" | "start_break" | "end_break" | "dismiss";

export type ShiftClockTransition = {
  from: ShiftClockPhase;
  action: ShiftClockAction;
  to: ShiftClockPhase;
};

const TRANSITIONS: ShiftClockTransition[] = [
  { from: "idle", action: "punch_in", to: "clocked_in" },
  { from: "clocked_in", action: "start_break", to: "on_break" },
  { from: "on_break", action: "end_break", to: "clocked_in" },
  { from: "clocked_in", action: "punch_out", to: "summary" },
  { from: "summary", action: "dismiss", to: "idle" },
];

export function canTransition(currentPhase: ShiftClockPhase, action: ShiftClockAction): boolean {
  return TRANSITIONS.some((t) => t.from === currentPhase && t.action === action);
}

export function getNextPhase(
  currentPhase: ShiftClockPhase,
  action: ShiftClockAction,
): ShiftClockPhase | null {
  const transition = TRANSITIONS.find((t) => t.from === currentPhase && t.action === action);
  return transition?.to ?? null;
}
```

- [ ] **Step 11: Run all tests**

```bash
cd packages/shift-clock && npx vitest run
```

Expected: All tests pass (4 files, ~15 tests).

- [ ] **Step 12: Type check**

```bash
cd packages/shift-clock && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 13: Commit**

```bash
git add packages/shift-clock/
git commit -m "feat(shift-clock): add state machine, GPS distance, break classifier, points calculator with tests"
```

---

### Task 5: Telemetry registry — add shift clock events

**Files:**

- Modify: `packages/telemetry/src/registry.ts`

- [ ] **Step 1: Read current registry.ts to understand the pattern**

Read `packages/telemetry/src/registry.ts` — note the existing `ShiftCreated` interface pattern and `EVENT_ROUTING` entries.

- [ ] **Step 2: Add shift clock event interfaces**

Add after existing shift event interfaces:

```typescript
export interface ShiftPunchedIn extends BaseEvent {
  event: "shift punched_in";
  properties: {
    entity: EntityRef;
    data: {
      shift_id: string;
      time_entry_id: string;
      punch_time: string;
      is_adhoc: boolean;
      gps_verified: boolean;
      gps_distance_meters: number | null;
    };
  };
}

export interface ShiftPunchedOut extends BaseEvent {
  event: "shift punched_out";
  properties: {
    entity: EntityRef;
    data: {
      shift_id: string;
      time_entry_id: string;
      punch_time: string;
      work_minutes: number;
      break_minutes: number;
      gps_verified: boolean;
    };
  };
}

export interface ShiftBreakStarted extends BaseEvent {
  event: "shift break_started";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; time_entry_id: string };
  };
}

export interface ShiftBreakEnded extends BaseEvent {
  event: "shift break_ended";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; time_entry_id: string; break_minutes: number; is_paid: boolean };
  };
}

export interface ShiftSupplementClaimed extends BaseEvent {
  event: "shift supplement_claimed";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; supplement_rule_id: string; amount: number };
  };
}

export interface ShiftSupplementReviewed extends BaseEvent {
  event: "shift supplement_reviewed";
  properties: {
    entity: EntityRef;
    data: { supplement_id: string; status: "approved" | "rejected"; reviewed_by: string };
  };
}

export interface ShiftNoteAdded extends BaseEvent {
  event: "shift note_added";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; note_id: string };
  };
}

export interface ShiftAdhocCreated extends BaseEvent {
  event: "shift adhoc_created";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; department_id: string; requires_approval: boolean };
  };
}

export interface ShiftAdhocApproved extends BaseEvent {
  event: "shift adhoc_approved";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; approved_by: string };
  };
}

export interface ShiftCallInitiated extends BaseEvent {
  event: "shift call_initiated";
  properties: {
    entity: EntityRef;
    data: { shift_id: string; department_id: string; leaders_on_duty: number };
  };
}
```

- [ ] **Step 3: Add to SmartoutEvent union**

Add all 10 new interfaces to the `SmartoutEvent` union type.

- [ ] **Step 4: Add EVENT_ROUTING entries**

```typescript
"shift punched_in": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "operations" },
"shift punched_out": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "operations" },
"shift break_started": { destinations: ["posthog", "logger", "activity_trail"], category: "operations" },
"shift break_ended": { destinations: ["posthog", "logger", "activity_trail"], category: "operations" },
"shift supplement_claimed": { destinations: ["posthog", "logger", "activity_trail"], category: "operations" },
"shift supplement_reviewed": { destinations: ["posthog", "logger", "activity_trail"], category: "operations" },
"shift note_added": { destinations: ["logger", "activity_trail"], category: "operations" },
"shift adhoc_created": { destinations: ["posthog", "logger", "activity_trail", "engine_event"], category: "operations" },
"shift adhoc_approved": { destinations: ["posthog", "logger", "activity_trail"], category: "operations" },
"shift call_initiated": { destinations: ["posthog", "logger"], category: "operations" },
```

- [ ] **Step 5: Type check**

```bash
cd packages/telemetry && pnpm typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): add 10 shift clock events to registry"
```

---

### Task 6: Edge Function — shift-clock-compliance

**Files:**

- Create: `supabase/functions/shift-clock-compliance/index.ts`

> **Auth pattern:** JWT-only (user-facing, not public API). Default `verify_jwt = true` — no config.toml entry needed.

- [ ] **Step 1: Read existing Edge Function pattern**

Read `supabase/functions/_shared/auth-middleware.ts` and one existing JWT-only Edge Function for the pattern.

- [ ] **Step 2: Implement compliance Edge Function**

```typescript
// supabase/functions/shift-clock-compliance/index.ts
/**
 * Server-side compliance checks for ShiftClock punch-in.
 * Validates: GPS distance, 11h rest period, weekly hours limit.
 * Client does NOT have authority to determine if a punch is legal.
 *
 * Returns machine-readable codes + data. Client renders localized messages.
 * JWT-only auth — this is a user-facing function, not a public API endpoint.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EARTH_RADIUS_M = 6_371_000;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

type Warning = {
  code: string;
  severity: "warning" | "block";
  data: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // JWT auth — verified by Supabase gateway (verify_jwt = true)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { profile_id, shift_id, team_id, department_id, gps } = await req.json();
  const warnings: Warning[] = [];
  let blocked = false;
  let blockReason: string | null = null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Get shift and workspace info
  const { data: shift } = await supabase
    .from("schedule_shift")
    .select("workspace_id, employee_id, shift_date, start_time, end_time, work_hours")
    .eq("schedule_shift_id", shift_id)
    .single();

  if (!shift) {
    return new Response(JSON.stringify({ error: "Shift not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Get ShiftClock config (cascading: team > department > workspace)
  //    Filter by employee's actual team/dept with NULL fallback, pick most specific
  const { data: configs } = await supabase
    .from("shift_clock_config")
    .select("*")
    .eq("workspace_id", shift.workspace_id)
    .or(
      `and(team_id.eq.${team_id},department_id.eq.${department_id}),` +
        `and(team_id.is.null,department_id.eq.${department_id}),` +
        `and(team_id.is.null,department_id.is.null)`,
    )
    .order("team_id", { nullsFirst: false })
    .order("department_id", { nullsFirst: false })
    .limit(1);

  const config = configs?.[0];

  // 3. GPS check
  if (config?.gps_required && config.gps_reference_lat && config.gps_reference_lng) {
    if (!gps) {
      blocked = true;
      blockReason = "GPS_REQUIRED";
      warnings.push({ code: "GPS_REQUIRED", severity: "block", data: {} });
    } else {
      const distance = haversineDistance(
        gps.lat,
        gps.lng,
        Number(config.gps_reference_lat),
        Number(config.gps_reference_lng),
      );
      if (distance > config.gps_radius_meters) {
        blocked = true;
        blockReason = "GPS_TOO_FAR";
        warnings.push({
          code: "GPS_TOO_FAR",
          severity: "block",
          data: { distance, maxRadius: config.gps_radius_meters },
        });
      }
    }
  }

  // 4. Rest period check (§10-8: minimum 11 hours)
  //    IMPORTANT: time_entry is in the timesheet schema, not public
  const { data: lastPunchOut } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("punch_out")
    .eq("profile_id", profile_id)
    .eq("status", "completed")
    .not("punch_out", "is", null)
    .order("punch_out", { ascending: false })
    .limit(1)
    .single();

  if (lastPunchOut?.punch_out) {
    const restHours = (Date.now() - new Date(lastPunchOut.punch_out).getTime()) / (1000 * 60 * 60);
    if (restHours < 11) {
      warnings.push({
        code: "REST_PERIOD_SHORT",
        severity: "warning",
        data: { restHours: Math.round(restHours * 10) / 10, minimumHours: 11 },
      });
    }
  }

  // 5. Weekly hours check (§10-6: max 40 hours)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  weekStart.setHours(0, 0, 0, 0);

  const { data: weekEntries } = await supabase
    .schema("timesheet")
    .from("time_entry")
    .select("punch_in, punch_out")
    .eq("profile_id", profile_id)
    .gte("punch_in", weekStart.toISOString())
    .eq("status", "completed");

  const weekMinutes = (weekEntries ?? []).reduce((sum, entry) => {
    if (!entry.punch_out) return sum;
    return sum + (new Date(entry.punch_out).getTime() - new Date(entry.punch_in).getTime()) / 60000;
  }, 0);

  const shiftMinutes = (shift.work_hours ?? 0) * 60;
  if (weekMinutes + shiftMinutes > 40 * 60) {
    warnings.push({
      code: "WEEKLY_HOURS_EXCEEDED",
      severity: "warning",
      data: { currentWeekHours: Math.round(weekMinutes / 60), maxWeeklyHours: 40 },
    });
  }

  return new Response(
    JSON.stringify({
      allowed: !blocked,
      warnings,
      block_reason: blockReason,
      gps_distance:
        gps && config?.gps_reference_lat
          ? haversineDistance(
              gps.lat,
              gps.lng,
              Number(config.gps_reference_lat),
              Number(config.gps_reference_lng),
            )
          : null,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/shift-clock-compliance/ supabase/config.toml
git commit -m "feat(edge): add shift-clock-compliance Edge Function for GPS + rest + weekly hours"
```

---

## Phase 2: Web Implementation

### Task 7: Web hooks — ShiftClock context and mutations

**Files:**

- Create: `apps/web/src/hooks/shift-clock/useShiftClockConfig.ts`
- Create: `apps/web/src/hooks/shift-clock/useShiftClock.ts`
- Create: `apps/web/src/hooks/shift-clock/useGPSGuard.ts`

> Implementation details: Follow the mutation pattern from `apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts`. Use `createClient()` from `@smartout/supabase/client`, `useWorkspace()` for workspace context, `emit()` from `@smartout/telemetry` in onSuccess callbacks. All Supabase queries use TanStack Query.

- [ ] **Step 1: Implement useShiftClockConfig** — fetches cascading config for current workspace/dept/team. Query key: `["shift-clock-config", workspaceId]`. Returns resolved config (most specific match).

- [ ] **Step 2: Implement useGPSGuard** — wrapper around `navigator.geolocation.getCurrentPosition()`. Returns `{getPosition, isLoading, error}`. Accepts config from useShiftClockConfig.

- [ ] **Step 3: Implement useShiftClock** — the main context hook. Manages ShiftClockState using state machine from `@smartout/shift-clock`. Provides: `punchIn(shiftId, gps?)`, `punchOut(comment?, gps?)`, `startBreak(gps?)`, `endBreak(gps?)`. Each mutation: (a) calls compliance Edge Function if applicable, (b) writes to Supabase, (c) emits telemetry, (d) invalidates queries.

- [ ] **Step 4: Type check**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/shift-clock/
git commit -m "feat(web): add ShiftClock hooks — config, GPS guard, and main context"
```

---

### Task 8: Web hooks — chat, notes, supplements

**Files:**

- Create: `apps/web/src/hooks/shift-clock/useShiftChat.ts`
- Create: `apps/web/src/hooks/shift-clock/useShiftNotes.ts`
- Create: `apps/web/src/hooks/shift-clock/useSupplements.ts`

- [ ] **Step 1: Implement useShiftChat** — creates/joins `chat_conversation` for session (type='group', source_type='session') and shift thread (type='dm', source_type='shift'). Uses Supabase Realtime subscription for new messages. Returns: `{sessionMessages, shiftMessages, sendMessage, isLoading}`.

- [ ] **Step 2: Implement useShiftNotes** — CRUD for `shift_note`. Insert with profile_id from DashboardContext. Query key: `["shift-notes", shiftId]`. Emit `"shift note_added"` on success.

- [ ] **Step 3: Implement useSupplements** — fetches available `supplement_rule` (type='manual', active). Creates `manual_supplement` with `status='pending'`. Emit `"shift supplement_claimed"` on success. Query: `["shift-supplements", shiftId]`.

- [ ] **Step 4: Type check + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/hooks/shift-clock/
git commit -m "feat(web): add chat, notes, and supplements hooks for ShiftClock"
```

---

### Task 9: Web UI — PunchButton and animation

**Files:**

- Create: `apps/web/src/app/dashboard/shift-clock/PunchButton.tsx`

> **Critical:** Match the animation from `.superpowers/brainstorm/64049-1774371756/punch-animation.html` exactly. Implement with CSS animations + React state transitions. The glowing ring, fingerprint SVG, 4-step scanning sequence, confetti explosion, and crossfade are all mandatory.

- [ ] **Step 1: Implement PunchButton.tsx** — the 180px glowing fingerprint button with:
  - Pulsating conic gradient ring (CSS `@keyframes ring-rotate`)
  - Radial gradient button face
  - Fingerprint SVG icon
  - Press state: `scale(0.88)` + darker gradient
  - Scanning overlay: spinning border + 4 steps checking off sequentially
  - Success overlay: green check (stroke-dasharray animation) + confetti (60 particles) + text fade-up
  - Uses CSS variables from design system where applicable, brand colors for custom elements
  - Uses `framer-motion` for React transitions (already in deps)

- [ ] **Step 2: Verify animation matches reference HTML visually**

Open both the reference HTML and the React component side by side. The sequence, timing, and colors must match.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/dashboard/shift-clock/PunchButton.tsx
git commit -m "feat(web): add ShiftClock PunchButton with full animation sequence"
```

---

### Task 10: Web UI — ShiftClock page and components

**Files:**

- Create: `apps/web/src/app/dashboard/shift-clock/page.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/ShiftClockView.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/ShiftClockHeader.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/ShiftClockActions.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/ShiftClockTabs.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/ShiftClockSummary.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/BreakToggle.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/SupplementSheet.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/NoteInput.tsx`
- Create: `apps/web/src/app/dashboard/shift-clock/CallLeaderButton.tsx`

> Follow the dashboard page pattern from existing pages. Use `"use client"`, `DashboardContext`, shadcn/ui components, CSS variables (never hardcoded colors), Lucide icons. Read `docs/design/ren-og-varm-styleguide.html` for design system reference.

- [ ] **Step 1: Implement page.tsx** — route entry point. Wraps ShiftClockView in ShiftClockProvider context. Detects role: employee sees ShiftClockView, admin/manager sees LeaderOverview.

- [ ] **Step 2: Implement ShiftClockView.tsx** — fullscreen layout. Renders based on `phase`: idle → PunchButton, clocked_in → Header + Actions + Tabs, on_break → break timer + resume button, summary → ShiftClockSummary.

- [ ] **Step 3: Implement ShiftClockHeader.tsx** — live timer (HH:MM:SS, updates every second via `useEffect`), status badge (green PÅ VAKT / orange PAUSE), department + zone info.

- [ ] **Step 4: Implement ShiftClockActions.tsx** — 2x2 grid: BreakToggle, NoteInput trigger, SupplementSheet trigger, CallLeaderButton. Badge on supplements showing count.

- [ ] **Step 5: Implement ShiftClockTabs.tsx** — 3 tabs (Feed, Chat, Notes). Feed tab renders session tasks/briefing (read from `session_task`, `session_note`). Chat tab renders SessionChat + ShiftThread. Notes tab renders `shift_note` list with input.

- [ ] **Step 6: Implement ShiftClockSummary.tsx** — post-punch-out view. 2x2 stats grid (work time, breaks, points if available, streak if available). Task completion progress bar. Optional comment textarea. "Ferdig" button that transitions to idle.

- [ ] **Step 7: Implement BreakToggle.tsx** — button that calls `startBreak()` / `endBreak()`. Shows break timer when on break. Uses GPS guard for snapshots.

- [ ] **Step 8: Implement SupplementSheet.tsx** — shadcn Sheet (bottom drawer). Fetches available supplements from `useSupplements()`. Lists options with name, description, rate. On select: shows confirmation form with required comment + timestamp. Submit creates claim.

- [ ] **Step 9: Implement NoteInput.tsx** — simple textarea + submit. Creates `shift_note` via `useShiftNotes()`.

- [ ] **Step 10: Implement CallLeaderButton.tsx** — if LiveKit available: starts voice call to leaders on duty. If not: opens shift thread chat. Check LiveKit availability via env var or config.

- [ ] **Step 11: Type check all**

```bash
pnpm --filter web typecheck
```

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/dashboard/shift-clock/
git commit -m "feat(web): add ShiftClock page with all employee-facing components"
```

---

### Task 11: Web UI — Leader Overview

**Files:**

- Create: `apps/web/src/app/dashboard/shift-clock/LeaderOverview.tsx`

- [ ] **Step 1: Implement LeaderOverview.tsx** — grid of employee cards showing:
  - All shifts for today's department session
  - Real-time status via Supabase subscription on `timesheet.time_entry`
  - Card states: ON SHIFT (green), ON BREAK (orange), WAITING (gray, dimmed)
  - Each card: avatar, name, role, zone, timer (live), punch-in time
  - Waiting cards: "Stemple inn manuelt" button (creates time_entry for that employee)
  - Header: status badges showing counts per state

- [ ] **Step 2: Type check + commit**

```bash
pnpm --filter web typecheck
git add apps/web/src/app/dashboard/shift-clock/LeaderOverview.tsx
git commit -m "feat(web): add ShiftClock leader overview with realtime status"
```

---

## Phase 3: Mobile Implementation

### Task 12: Mobile hooks — ShiftClock with offline queue

**Files:**

- Create: `apps/mobile/src/hooks/shift-clock/useShiftClock.ts`
- Create: `apps/mobile/src/hooks/shift-clock/useGPSGuard.ts`
- Create: `apps/mobile/src/hooks/shift-clock/useBreakRules.ts`
- Create: `apps/mobile/src/hooks/shift-clock/useShiftChat.ts`
- Create: `apps/mobile/src/hooks/shift-clock/useShiftNotes.ts`
- Create: `apps/mobile/src/hooks/shift-clock/useSupplements.ts`
- Modify: `apps/mobile/src/lib/sync/action-map.ts` — add `break_start`, `break_end`, `supplement_claim`, `shift_note_add` actions

> Follow the existing mobile mutation pattern from `apps/mobile/src/hooks/mutations/use-punch.ts`: generate client UUID, enqueue to SQLite sync queue, optimistically update TanStack Query cache. Use `expo-location` for GPS, `expo-haptics` for haptic feedback.

- [ ] **Step 1: Add new sync actions to action-map.ts** — `break_start`, `break_end`, `supplement_claim`, `shift_note_add` with their Supabase table/operation mappings.

- [ ] **Step 2: Implement mobile useGPSGuard** — wrapper around `expo-location`. Requests permissions, gets current position with high accuracy, 10s timeout. Returns `{getPosition, isLoading, error, permissionStatus}`.

- [ ] **Step 3: Implement mobile useShiftClock** — same state machine as web but mutations use `enqueue()` instead of direct Supabase calls. Optimistic cache updates. GPS payloads included.

- [ ] **Step 4: Implement mobile useBreakRules, useShiftChat, useShiftNotes, useSupplements** — each uses offline queue pattern. Chat uses Supabase Realtime when online, cached messages when offline.

- [ ] **Step 5: Update existing PunchButton.tsx** — modify `apps/mobile/src/components/shift/PunchButton.tsx` to pass GPS payload to `usePunch().punchIn()`.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/hooks/shift-clock/ apps/mobile/src/lib/sync/action-map.ts apps/mobile/src/components/shift/PunchButton.tsx
git commit -m "feat(mobile): add ShiftClock hooks with offline-first sync queue"
```

---

### Task 13: Mobile UI — ShiftClock screen

**Files:**

- Create: `apps/mobile/src/app/(app)/(home)/punch-clock.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`
- Create: `apps/mobile/src/components/shift-clock/PunchAnimation.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockHeader.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockActions.tsx`
- Create: `apps/mobile/src/components/shift-clock/ShiftClockSummary.tsx`
- Create: `apps/mobile/src/components/shift-clock/BreakToggle.tsx`
- Create: `apps/mobile/src/components/shift-clock/SupplementSheet.tsx`

> **Critical:** PunchAnimation.tsx must match the HTML reference animation 1:1 using `react-native-reanimated`. The glowing button, scanning steps, confetti, and success sequence are all mandatory. Use `expo-haptics` for tactile feedback at key moments.

- [ ] **Step 1: Implement punch-clock.tsx** — Expo Router screen at `/(app)/(home)/punch-clock`. Full-screen, no tab bar visible. Wraps ShiftClockView.

- [ ] **Step 2: Implement PunchAnimation.tsx** — the flagship animation using `react-native-reanimated`:
  - Glowing button: `Animated.View` with rotating gradient (use `LinearGradient` from expo)
  - Press: `withSpring(0.88)` + `Haptics.impactAsync(Medium)`
  - Scanning: 4 steps with `useAnimatedStyle` transitions, rotating border via `withRepeat(withTiming)`
  - Success: `withSpring` bounce on check circle, confetti via `react-native-reanimated` particle system
  - Crossfade: `FadeIn`/`FadeOut` layout animations

- [ ] **Step 3: Implement remaining mobile components** — follow same structure as web but with React Native primitives (View, Text, Pressable, ScrollView). Use `@gorhom/bottom-sheet` for SupplementSheet.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(app\)/\(home\)/punch-clock.tsx apps/mobile/src/components/shift-clock/
git commit -m "feat(mobile): add ShiftClock screen with full punch animation"
```

---

## Phase 4: Integration & Polish

### Task 14: Ad-hoc shift flow

**Files:**

- Modify: `apps/web/src/app/dashboard/shift-clock/ShiftClockView.tsx` — add idle variant B (open shifts + ad-hoc)
- Modify: `apps/web/src/hooks/shift-clock/useShiftClock.ts` — add `createAdhocShift()` mutation

- [ ] **Step 1: Add idle variant B to ShiftClockView** — when no upcoming shift AND `adhoc_shifts_enabled` in config: show open shifts list + "Start ny ad-hoc vakt" button.

- [ ] **Step 2: Implement createAdhocShift mutation** — creates `schedule_shift` with `is_adhoc = true`, `start_time = now()`, `employee_id = current profile`. If `adhoc_requires_approval`: sends push notification to leaders, shows "Venter på godkjenning" state. Emits `"shift adhoc_created"`.

- [ ] **Step 3: Implement takeOpenShift mutation** — updates existing `schedule_shift` with `employee_id = current profile`. Then proceeds to normal punch-in flow.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/shift-clock/ apps/web/src/hooks/shift-clock/
git commit -m "feat(web): add ad-hoc shift creation and open shift claiming"
```

---

### Task 15: Full typecheck + lint

**Files:** All modified

- [ ] **Step 1: Run full typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all packages.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: 0 errors.

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(shift-clock): resolve typecheck and lint issues"
```

---

## Summary

| Phase          | Tasks | Deliverables                                                                                   |
| -------------- | ----- | ---------------------------------------------------------------------------------------------- |
| 1: Foundation  | 1-6   | 5 migrations, shared package with 4 tested utils, telemetry registry, compliance Edge Function |
| 2: Web         | 7-11  | 6 hooks, 12 UI components, leader overview, full punch animation                               |
| 3: Mobile      | 12-13 | 6 hooks (offline-first), screen + animation, bottom sheet                                      |
| 4: Integration | 14-15 | Ad-hoc shifts, typecheck, lint                                                                 |

**Total:** 15 tasks, ~55 files created/modified.
