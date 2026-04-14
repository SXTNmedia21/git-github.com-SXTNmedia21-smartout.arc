---
title: "Module 6 Training — Sub-project B: Mobile Training UI"
status: draft
updated: 2026-04-14
created: 2026-04-14
module: training
tags: [training, module-6, mobile, react-native, shared-hooks]
---

# Module 6 Training — Sub-project B: Mobile Training UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the mobile training screen to the shared `@smartout/training` package from Sub-project 0, replacing the current standalone Supabase queries with workspace-scoped shared hooks. Add status badges, source badges, and use the canonical `ReadinessScore` type — while keeping the existing Nordic Split bento layout fully functional.

**Architecture:** Thin-wrapper approach. The mobile `useTrainingData` hook becomes a compatibility shim that calls `useAssignedProtocols` and `useReadinessScore` from `@smartout/training`, then maps the `AssignedProtocol[]` shape back to the existing `TrainingCourse[]`, `TrainingProcedure[]`, `TrainingCertificate[]` types the screen expects. The workspace_id is resolved from the profile's `workspace_id` field via `useMyProfile`. No new screens in this sub-project — course-detail and procedure stepper are deferred to Sub-project B2.

**Tech Stack:** React Native, Expo Router, TanStack Query v5, Zustand, `@smartout/training`, `@smartout/supabase`, reanimated, lucide-react-native

**Source documents:**

- `docs/superpowers/plans/2026-04-14-training-module6-subproject0-schema-foundation.md` — Sub-project 0 (schema + shared hooks)
- `packages/training/src/index.ts` — shared package exports
- `packages/training/src/types.ts` — canonical types (`AssignedProtocol`, `ReadinessScore`, etc.)

---

## File Structure

### Modified files

| File | Change |
|------|--------|
| `apps/mobile/package.json` | Add `@smartout/training` workspace dependency |
| `apps/mobile/src/hooks/queries/use-training-data.ts` | Rewrite to thin wrapper over `@smartout/training` hooks |
| `apps/mobile/app/(app)/(home)/training.tsx` | Add status badges, source badges, use `ReadinessScore` type |

### No new files

This sub-project modifies existing files only. No new screens or components.

---

## Prerequisites

- [ ] Sub-project 0 is merged: `packages/training/` exists with `useAssignedProtocols`, `useReadinessScore`, and all types exported
- [ ] `protocol_assignment` table has `workspace_id`, `assigned_via`, `protocol_version` columns (from Sub-project 0 migration)
- [ ] `useMyProfile` hook returns `workspace_id` on the profile (it already does — `ProfileRow` includes `workspace_id`)

---

## Task 1: Add @smartout/training dependency to mobile

**What:** Add the shared training package as a workspace dependency so mobile can import shared hooks and types.

**Files:**
- Modify: `apps/mobile/package.json`

**Acceptance:** `pnpm install` completes without errors. `@smartout/training` resolves from `apps/mobile/`.

- [ ] **Step 1a: Add dependency to package.json**

Add `@smartout/training` to the `dependencies` section of `apps/mobile/package.json`:

```jsonc
// In apps/mobile/package.json → dependencies, add:
"@smartout/training": "workspace:*",
```

Place it alphabetically after `@smartout/telemetry` and before `@smartout/types`.

- [ ] **Step 1b: Run pnpm install**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
pnpm install
```

- [ ] **Step 1c: Verify resolution**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
pnpm ls --filter @smartout/mobile @smartout/training
```

Confirm `@smartout/training` appears as a linked workspace dependency.

---

## Task 2: Refactor use-training-data.ts to use shared hooks

**What:** Replace the standalone Supabase queries in `use-training-data.ts` with a thin compatibility wrapper that delegates to `useAssignedProtocols` and `useReadinessScore` from `@smartout/training`. The existing return type (`TrainingData`) is preserved so the training screen continues to work without changes until Task 3.

**Files:**
- Modify: `apps/mobile/src/hooks/queries/use-training-data.ts`

**Acceptance:** The `useTrainingData` hook returns the same `TrainingData` shape. The training screen renders identically. Data is now workspace-scoped via the shared hooks.

**Key design decisions:**
- `workspace_id` is resolved from `useMyProfile().data.workspace_id` — the profile already carries this field
- `profileId` comes from `useWorkspaceStore` (same as before)
- The `supabase` client is the mobile singleton from `@/lib/supabase`
- The mapping layer converts `AssignedProtocol[]` to the legacy `TrainingCourse[]`, `TrainingProcedure[]`, `TrainingCertificate[]` types
- The hook is `enabled` only when both `profileId` and `workspaceId` are available (prevents fetching before profile loads)

- [ ] **Step 2a: Replace the file contents**

Replace the entire contents of `apps/mobile/src/hooks/queries/use-training-data.ts` with:

```typescript
/**
 * Training data hook — thin compatibility wrapper over @smartout/training.
 *
 * Delegates to the shared hooks (useAssignedProtocols, useReadinessScore)
 * and maps the result to the legacy TrainingData shape expected by the
 * training screen. This preserves backwards compatibility while gaining
 * workspace-scoped queries, step-level progress, and shared types.
 *
 * workspace_id is resolved from the profile row (via useMyProfile).
 * profileId comes from useWorkspaceStore (persisted in MMKV).
 */

import { useMemo } from "react";
import { useAssignedProtocols, useReadinessScore } from "@smartout/training";
import type { AssignedProtocol, AssignedConfirmation } from "@smartout/training";
import { supabase } from "@/lib/supabase";
import { useWorkspaceStore } from "@/hooks/stores/use-workspace-store";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

// ── Legacy types (kept for backwards compatibility with training.tsx) ──

/** A protocol assignment in the format the training screen expects */
export type TrainingCourse = {
  assignment_id: string;
  protocol_id: string;
  status: "not_started" | "in_progress" | "completed" | "expired" | "waived";
  assigned_at: string;
  completed_at: string | null;
  assigned_via: string | null;
  protocol_version: string | null;
  protocol: { name: string; description: string | null; status: string } | null;
  progress: { totalSteps: number; completedSteps: number; percent: number };
};

/** A procedure with its parent protocol name for context */
export type TrainingProcedure = {
  procedure_id: string;
  name: string;
  description: string | null;
  protocol_id: string;
  sort_order: number | null;
  created_at: string;
  protocol: { name: string } | null;
};

/** A completed confirmation signature with the confirmation name */
export type TrainingCertificate = {
  id: string;
  confirmation_name: string;
  signed_at: string;
  confirmation_id: string;
};

export type TrainingData = {
  courses: TrainingCourse[];
  procedures: TrainingProcedure[];
  certificates: TrainingCertificate[];
  readinessPercent: number;
};

// ── Mapping functions ──

function mapProtocolToCourse(p: AssignedProtocol): TrainingCourse {
  return {
    assignment_id: p.assignmentId,
    protocol_id: p.protocolId,
    status: p.assignmentStatus,
    assigned_at: p.assignedAt,
    completed_at: p.completedAt,
    assigned_via: p.assignedVia,
    protocol_version: p.protocolVersion,
    protocol: {
      name: p.protocolName,
      description: p.protocolDescription,
      status: p.assignmentStatus,
    },
    progress: p.progress,
  };
}

function mapProtocolsToProcedures(protocols: AssignedProtocol[]): TrainingProcedure[] {
  const procedures: TrainingProcedure[] = [];
  for (const p of protocols) {
    for (const proc of p.procedures) {
      procedures.push({
        procedure_id: proc.procedureId,
        name: proc.name,
        description: proc.description,
        protocol_id: p.protocolId,
        sort_order: proc.sortOrder,
        // Use the protocol assignment date as a fallback since procedures
        // don't carry their own created_at in the shared type
        created_at: p.assignedAt,
        protocol: { name: p.protocolName },
      });
    }
  }
  return procedures;
}

function mapConfirmationToCertificate(
  c: AssignedConfirmation,
): TrainingCertificate | null {
  // Only include signed confirmations as certificates
  if (!c.isSigned || !c.signedAt) return null;
  return {
    id: c.confirmationId,
    confirmation_name: c.name,
    signed_at: c.signedAt,
    confirmation_id: c.confirmationId,
  };
}

function mapProtocolsToCertificates(protocols: AssignedProtocol[]): TrainingCertificate[] {
  const certs: TrainingCertificate[] = [];
  for (const p of protocols) {
    for (const c of p.confirmations) {
      const cert = mapConfirmationToCertificate(c);
      if (cert) certs.push(cert);
    }
  }
  return certs;
}

// ── Hook ──

/**
 * Hook: returns training data for the current employee.
 *
 * Delegates to @smartout/training shared hooks, then maps to the legacy
 * TrainingData shape for backwards compatibility with the training screen.
 */
export function useTrainingData() {
  const selectedProfileId = useWorkspaceStore((s) => s.selectedProfileId);
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id ?? "";

  const {
    data: protocols,
    isLoading: protocolsLoading,
    isError: protocolsError,
    error: protocolsErrorObj,
  } = useAssignedProtocols({
    profileId: selectedProfileId,
    workspaceId,
    supabase,
  });

  const { score, isLoading: scoreLoading } = useReadinessScore({
    profileId: selectedProfileId,
    workspaceId,
    supabase,
  });

  const data: TrainingData | undefined = useMemo(() => {
    if (!protocols) return undefined;

    return {
      courses: protocols.map(mapProtocolToCourse),
      procedures: mapProtocolsToProcedures(protocols),
      certificates: mapProtocolsToCertificates(protocols),
      readinessPercent: score.percent,
    };
  }, [protocols, score.percent]);

  return {
    data,
    isLoading: protocolsLoading || scoreLoading,
    isError: protocolsError,
    error: protocolsErrorObj,
  };
}
```

- [ ] **Step 2b: Verify types resolve**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
pnpm --filter @smartout/mobile typecheck 2>&1 | head -30
```

Fix any import path issues. Common traps:
- `@smartout/training` might need the `.js` extension stripped if metro resolves differently than tsc
- The `useMyProfile` hook must be imported from `@/hooks/queries/use-my-profile` (already exists)

---

## Task 3: Update training.tsx screen to handle new data shape

**What:** Update the training screen to take advantage of the richer data now available from the shared hooks. Specifically:
1. Show `assignedVia` source badge on course cards (e.g. "Avdeling", "Team", "Manuell")
2. Show `protocolVersion` on course cards when available
3. Replace the hardcoded progress calculation with the real `progress.percent` from the shared hook
4. Use the full 5-status model for status badges: `not_started`, `in_progress`, `completed`, `expired`, `waived`
5. Update the readiness card to display `completed/total` counts from `ReadinessScore`

**Files:**
- Modify: `apps/mobile/app/(app)/(home)/training.tsx`

**Acceptance:** Training screen renders with real progress percentages, source badges, and 5-status model. No visual regressions for existing data.

- [ ] **Step 3a: Update the CourseStatus type and mapCourseStatus function**

Replace the existing `CourseStatus` type and `mapCourseStatus` function in `training.tsx`:

```typescript
// ── Types ──

type CourseStatus = "not_started" | "in_progress" | "completed" | "expired" | "waived";

/** Map assignment status to a display label (Norwegian) */
function getStatusDisplay(status: CourseStatus): { label: string; colorKey: StatusColorKey } {
  switch (status) {
    case "not_started":
      return { label: "Ikke startet", colorKey: "not_started" };
    case "in_progress":
      return { label: "Pagaende", colorKey: "in_progress" };
    case "completed":
      return { label: "Fullfort", colorKey: "completed" };
    case "expired":
      return { label: "Utlopt", colorKey: "expired" };
    case "waived":
      return { label: "Fritatt", colorKey: "waived" };
  }
}

type StatusColorKey = "not_started" | "in_progress" | "completed" | "expired" | "waived";
```

- [ ] **Step 3b: Update the CourseCard component**

Replace the `CourseCard` component to use real progress, source badges, and the 5-status model:

```typescript
/** Norwegian labels for assignment_source enum values */
const SOURCE_LABELS: Record<string, string> = {
  workspace: "Bedrift",
  department: "Avdeling",
  team: "Team",
  location: "Lokasjon",
  position: "Stilling",
  manual: "Manuell",
  season: "Sesong",
};

/** Single course card with real progress bar, status badge, and source badge */
function CourseCard({ course, index }: { course: TrainingCourse; index: number }) {
  const styles = useCourseStyles();
  const theme = useTheme();
  const router = useRouter();

  const { label, colorKey } = getStatusDisplay(course.status);
  const progress = course.progress.percent;

  const tagColors: Record<StatusColorKey, { bg: string; border: string; text: string }> = {
    not_started: {
      bg: withOpacity(theme.colors.mutedForeground, 0.06),
      border: withOpacity(theme.colors.mutedForeground, 0.2),
      text: theme.colors.mutedForeground,
    },
    in_progress: {
      bg: withOpacity(theme.colors.info, 0.06),
      border: withOpacity(theme.colors.info, 0.2),
      text: theme.colors.info,
    },
    completed: {
      bg: withOpacity(theme.colors.success, 0.06),
      border: withOpacity(theme.colors.success, 0.2),
      text: theme.colors.success,
    },
    expired: {
      bg: withOpacity(theme.colors.destructive, 0.06),
      border: withOpacity(theme.colors.destructive, 0.2),
      text: theme.colors.destructive,
    },
    waived: {
      bg: withOpacity(theme.colors.warning, 0.06),
      border: withOpacity(theme.colors.warning, 0.2),
      text: theme.colors.warning,
    },
  };

  const tag = tagColors[colorKey];
  const title = course.protocol?.name ?? "Ukjent kurs";
  const subtitle = course.protocol?.description ?? "";
  const sourceLabel = course.assigned_via ? SOURCE_LABELS[course.assigned_via] : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 100)
        .duration(400)
        .springify()}
    >
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: "/(app)/(home)/course-detail",
            params: { protocolId: course.protocol_id },
          });
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {/* Top row: icon + badges */}
        <View style={styles.topRow}>
          <View style={styles.iconBox}>
            <BookOpen size={20} color={theme.colors.brandOrange} strokeWidth={1.6} />
          </View>
          <View style={styles.badgeRow}>
            {sourceLabel && (
              <View style={[styles.sourceBadge]}>
                <Text style={styles.sourceBadgeText}>{sourceLabel}</Text>
              </View>
            )}
            <View style={[styles.tag, { backgroundColor: tag.bg, borderColor: tag.border }]}>
              <Text style={[styles.tagText, { color: tag.text }]}>{label}</Text>
            </View>
          </View>
        </View>

        {/* Title + subtitle + version */}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
          {course.protocol_version && (
            <Text style={styles.versionText}>v{course.protocol_version}</Text>
          )}
        </View>

        {/* Progress bar — now uses real progress from shared hook */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progress}%</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 3c: Update CourseCard styles to support badge row and version text**

Add these additional styles to the existing `useCourseStyles`:

```typescript
const useCourseStyles = createStyles((theme) => ({
  card: {
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.card, 0.4)
      : withOpacity(theme.colors.background, 0.6),
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.1),
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: theme.spacing.md,
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.brandOrange, 0.08),
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.isDark
      ? withOpacity(theme.colors.muted, 0.5)
      : withOpacity(theme.colors.muted, 0.8),
  },
  sourceBadgeText: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.5,
    color: theme.colors.mutedForeground,
    textTransform: "uppercase",
  },
  textBlock: {
    gap: 4,
  },
  title: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
  },
  subtitle: {
    ...theme.typography.caption,
    color: withOpacity(theme.colors.mutedForeground, 0.7),
  },
  versionText: {
    fontSize: 10,
    fontWeight: "400",
    color: withOpacity(theme.colors.mutedForeground, 0.5),
    fontStyle: "italic",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.muted,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
}));
```

- [ ] **Step 3d: Update the ReadinessCard to show completed/total counts**

Update the `ReadinessCard` component to accept and display the readiness breakdown:

```typescript
/** Readiness progress card with gradient bar and completion counts */
function ReadinessCard({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed?: number;
  total?: number;
}) {
  const styles = useReadinessStyles();

  const subtitle =
    percent === 0
      ? "Du har ingen aktive kurs enna."
      : percent >= 100
        ? "Gratulerer! Du er fullsertifisert."
        : "Du er godt pa vei til a bli fullsertifisert for sesongen.";

  const countText =
    completed !== undefined && total !== undefined ? `${completed} av ${total} fullfort` : null;

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(500).springify()} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Din beredskap: {percent}%</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {countText && <Text style={styles.countText}>{countText}</Text>}
        </View>
        <Text style={styles.decorNumber}>01</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>BEGYNNER</Text>
        <Text style={styles.barLabel}>EKSPERT</Text>
      </View>
    </Animated.View>
  );
}
```

Add the `countText` style to `useReadinessStyles`:

```typescript
countText: {
  ...theme.typography.caption,
  color: theme.colors.brandOrange,
  fontWeight: "500",
  marginTop: 2,
},
```

- [ ] **Step 3e: Update the main TrainingScreen to pass readiness counts**

In the `TrainingScreen` component, update the data destructuring and `ReadinessCard` usage.

Import `useReadinessScore` to access the `completed` and `total` counts separately:

```typescript
// At the top of TrainingScreen, update data extraction:
export default function TrainingScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading, isError } = useTrainingData();

  const courses = data?.courses ?? [];
  const procedures = data?.procedures ?? [];
  const certificates = data?.certificates ?? [];
  const readinessPercent = data?.readinessPercent ?? 0;

  // Extract counts from the first course's parent data if available
  // The readiness score is already baked into readinessPercent by the hook
  const completedCount = courses.filter((c) => c.status === "completed").length;
  const totalCount = courses.length;

  // ... rest of the component

  // In the JSX, update ReadinessCard:
  // <ReadinessCard percent={readinessPercent} completed={completedCount} total={totalCount} />
```

Update the `ReadinessCard` call in the JSX:

```tsx
<ReadinessCard
  percent={readinessPercent}
  completed={completedCount}
  total={totalCount}
/>
```

- [ ] **Step 3f: Remove unused imports**

After the refactor, the following imports are no longer needed in `training.tsx`:

- Remove: the old `CourseStatus` type (replaced by the new 5-value union)
- Remove: the old `mapCourseStatus` function (replaced by `getStatusDisplay`)

Verify no other references to the removed function/type remain in the file.

---

## Task 4: Typecheck and commit

**What:** Verify the entire monorepo typechecks cleanly, then commit all changes.

**Files:** No new files — verification only.

**Acceptance:** `pnpm turbo typecheck` passes with 0 errors. Changes are committed on `feat/training-schema-foundation`.

- [ ] **Step 4a: Run typecheck for mobile**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
pnpm --filter @smartout/mobile typecheck
```

Fix any errors. Common issues:
- Theme color keys: `warning` may not exist on the theme — check `@/theme` for available color keys and substitute if needed (e.g. use `brandOrange` as fallback)
- `withOpacity` argument types
- `course.progress` field might need optional chaining if the types don't guarantee it

- [ ] **Step 4b: Run full monorepo typecheck**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-2
pnpm turbo typecheck
```

- [ ] **Step 4c: Commit**

```bash
git add apps/mobile/package.json \
  apps/mobile/src/hooks/queries/use-training-data.ts \
  apps/mobile/app/\(app\)/\(home\)/training.tsx \
  pnpm-lock.yaml

git commit -m "feat(mobile): wire training screen to @smartout/training shared hooks

Replace standalone Supabase queries with shared useAssignedProtocols
and useReadinessScore from @smartout/training. Add 5-status model,
source badges, version display, and completion counts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Validation Checklist

- [ ] `pnpm install` succeeds — `@smartout/training` linked as workspace dependency
- [ ] `pnpm --filter @smartout/mobile typecheck` passes with 0 errors
- [ ] `pnpm turbo typecheck` passes with 0 errors (full monorepo)
- [ ] Training screen loads and shows courses with real progress percentages
- [ ] Status badges display all 5 states correctly (not_started, in_progress, completed, expired, waived)
- [ ] Source badges show Norwegian labels when `assigned_via` is set
- [ ] Protocol version displays below subtitle when available
- [ ] Readiness card shows "X av Y fullfort" completion count
- [ ] Course cards navigate to course-detail screen on tap
- [ ] Procedure rows still render and navigate to flow-player
- [ ] Certificate rows still render with download action
- [ ] Empty states display correctly when no data exists
- [ ] No console errors or warnings in React Native logs

## Post-Implementation

- [ ] Update CLAUDE.md if conventions changed
- [ ] Write ADR if architectural decision was made
- [ ] Register in `docs/INDEX.md`
- [ ] Move to `docs/plans/completed/` when done

---

## Out of Scope (deferred to future sub-projects)

- **Course detail screen** — currently a stub with placeholder data. Wiring to real protocol data is Sub-project B2.
- **Procedure step flow** — mobile equivalent of `ProcedureStepper`. Requires new screen + `useCompleteStep` mutation wiring.
- **Knowledge test view** — mobile test taking UI. Requires new screen + `useSubmitTest` mutation wiring.
- **Confirmation signing** — mobile signature capture. Requires new screen + `useSignConfirmation` mutation wiring.
- **Offline support** — caching training data for offline procedure viewing.
- **Push notifications** — new assignment or deadline alerts.

---

> After writing: add to `docs/INDEX.md` under Plans.
