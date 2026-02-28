# Repo Health Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all issues found in the repo health check so the entire monorepo builds, lints, and installs cleanly.

**Architecture:** Seven independent fix tasks targeting: landing build error, landing lint errors, gitignore lockfile policy, stale files cleanup, package version pinning, empty workspace cleanup, and missing build/lint scripts in packages.

**Tech Stack:** pnpm, Turborepo, Next.js 16, TypeScript, ESLint

---

## Task 1: Fix landing build — add "use client" directive

**Files:**

- Modify: `apps/landing/src/app/concepts/daily-session/page.tsx:1`

**Step 1: Add "use client" directive to the top of the file**

The file uses `useRouter` (line 20) and `motion` (line 21) — both require client rendering. Add the directive as the very first line.

```typescript
"use client";

import {
    CheckCircle2,
    Circle,
    Clock,
```

**Step 2: Verify landing build passes**

Run: `pnpm --filter landing build`
Expected: Build succeeds, all routes generated

**Step 3: Commit**

```bash
git add apps/landing/src/app/concepts/daily-session/page.tsx
git commit -m "fix(landing): add 'use client' directive to daily-session page

Page uses useRouter and framer-motion which require client rendering."
```

---

## Task 2: Fix landing lint errors (7 errors, 16 warnings)

**Files:**

- Modify: `apps/landing/src/app/concepts/daily-session/page.tsx:21,278`
- Modify: `apps/landing/src/app/features/shiftplanner/page.tsx:5-6,14,155,253,304,340,485`
- Modify: `apps/landing/src/app/blog/page.tsx:5`
- Modify: `apps/landing/src/app/features/staff-training/page.tsx:12`
- Modify: `apps/landing/src/app/features/task-rutines/page.tsx:5`
- Modify: `apps/landing/src/components/voice-assistant.tsx:106-113`

### Step 1: Fix `daily-session/page.tsx`

**Line 21** — Remove unused `motion` import:

```typescript
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navigation from "../../../components/navigation";
```

(Remove `import { motion } from "framer-motion";` entirely)

**Line 278** — Replace `any` with a proper type:

```typescript
type TaskCardProps = {
  title: string;
  assigned: string;
  status: string;
  time: string;
  category: string;
  claimedBy?: string;
  data?: Record<string, unknown>;
};

function TaskCard({ title, assigned, status, time, category, claimedBy, data }: TaskCardProps) {
```

### Step 2: Fix `shiftplanner/page.tsx`

**Lines 5-6** — Remove unused imports:

```typescript
import {
  ArrowLeft,
  Plus,
  Users,
  CheckCircle2,
  MoreVertical,
  Briefcase,
  Network,
  Clock,
  AlertCircle,
  Circle,
  PlayCircle,
  Ban,
  Bot,
  Mic,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
```

(Remove: `CalendarClock`, `ChevronLeft`, `ChevronRight`, `Search`, `Filter`, `Settings`, `FileText`, `MoreHorizontal`)
(Remove: `import Link from "next/link";` — unused)

**Line 14** — Remove unused state:

```typescript
const [scheduleLayout, setScheduleLayout] = useState<"daily" | "weekly" | "monthly">("daily");
const [isSidebarOpen, setIsSidebarOpen] = useState(true);
```

(Remove: `const [scheduleView, setScheduleView] = useState<'ansatt' | 'jobb' | 'team'>('ansatt');`)

**Lines 155, 253, 304, 340, 485** — Replace `any` with typed props on 5 component functions:

```typescript
type GridContentProps = {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
};

function GridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
// ...
function WeeklyGridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
// ...
function MonthlyGridContent({ isSidebarOpen, setIsSidebarOpen }: GridContentProps) {
```

```typescript
type EntityRowProps = {
  name: string;
  subtitle: string;
  hours: string;
  shifts: number;
  avatarColor: string;
  initials: string;
  contractedHours?: number;
};

function EntityRow({ name, subtitle, hours, shifts, avatarColor, initials, contractedHours = 37.5 }: EntityRowProps) {
```

```typescript
type DayColumnProps = {
  date: string;
  staff: number;
  shifts: number;
  isHoliday?: boolean;
  isToday?: boolean;
  coverageAlert?: boolean;
  children: React.ReactNode;
};

function DayColumn({ date, staff, shifts, isHoliday, isToday, coverageAlert, children }: DayColumnProps) {
```

### Step 3: Fix `blog/page.tsx`

**Line 5** — Remove unused `ArrowRight`:

```typescript
import { Building2, Quote, Heart } from "lucide-react";
```

### Step 4: Fix `staff-training/page.tsx`

**Line 12** — Remove unused state variable. Check if `currentQuestion` is used anywhere further in the file. If not:

```typescript
const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
const [isAnswered, setIsAnswered] = useState(false);
```

(Remove: `const [currentQuestion, setCurrentQuestion] = useState(0);`)

### Step 5: Fix `task-rutines/page.tsx`

**Line 5** — Remove unused `ChevronRight`:

```typescript
import {
  ArrowLeft,
  CheckCircle2,
  ListTodo,
  MoreVertical,
  Search,
  CheckSquare2,
  Square,
} from "lucide-react";
```

### Step 6: Fix `voice-assistant.tsx`

**Lines 106-113** — The `startSession` call inside `useEffect` triggers a setState cascade. Wrap with a flag to avoid the lint error:

```typescript
useEffect(() => {
  if (autoStart) {
    void startSession();
  }
  return () => {
    endSession();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [autoStart]);
```

Note: `startSession` is an async function that calls `setStatus` — the `void` prefix makes the intent explicit. The eslint-disable is appropriate here since `startSession` and `endSession` are stable refs we don't want to re-trigger on.

### Step 7: Verify lint passes

Run: `pnpm --filter landing lint`
Expected: 0 errors, 0 warnings

### Step 8: Verify build still passes

Run: `pnpm --filter landing build`
Expected: Build succeeds

### Step 9: Commit

```bash
git add apps/landing/src/app/concepts/daily-session/page.tsx \
       apps/landing/src/app/features/shiftplanner/page.tsx \
       apps/landing/src/app/blog/page.tsx \
       apps/landing/src/app/features/staff-training/page.tsx \
       apps/landing/src/app/features/task-rutines/page.tsx \
       apps/landing/src/components/voice-assistant.tsx
git commit -m "fix(landing): resolve all lint errors and warnings

- Replace 'any' types with proper TypeScript types
- Remove unused imports and state variables
- Fix useEffect setState warning in voice-assistant"
```

---

## Task 3: Fix .gitignore — stop ignoring lockfile

**Files:**

- Modify: `.gitignore:17-19`

**Step 1: Remove lockfile ignores from .gitignore**

Replace:

```
# Lock files
pnpm-lock.yaml
bun.lock
```

With:

```
# Lock files (keep pnpm-lock.yaml committed for reproducible builds)
bun.lock
```

**Step 2: Verify pnpm-lock.yaml is now trackable**

Run: `git status`
Expected: `pnpm-lock.yaml` shows as a new untracked file

**Step 3: Commit**

```bash
git add .gitignore pnpm-lock.yaml
git commit -m "fix: stop ignoring pnpm-lock.yaml for reproducible builds

Lock files ensure deterministic dependency resolution across
environments. bun.lock remains ignored as we use pnpm."
```

---

## Task 4: Delete stale files

**Files:**

- Delete: `Claude..md` (typo duplicate of CLAUDE.md — contains old Gemini context)
- Delete: `apps/storybook/next-env.d.ts` (orphan file in empty workspace)
- Delete: `apps/video/error.log` (stale log in empty workspace)

**Step 1: Delete stale files**

```bash
rm Claude..md
rm apps/storybook/next-env.d.ts
rm apps/video/error.log
```

**Step 2: Commit**

```bash
git add Claude..md apps/storybook/next-env.d.ts apps/video/error.log
git commit -m "chore: remove stale files

- Claude..md: old Gemini context file, replaced by CLAUDE.md
- storybook/next-env.d.ts: orphan in empty workspace
- video/error.log: stale log in empty workspace"
```

---

## Task 5: Pin package versions (replace all "latest")

**Files:**

- Modify: `packages/ui/package.json`
- Modify: `packages/utils/package.json`
- Modify: `packages/notifications/package.json`
- Modify: `packages/tailwind-config/package.json`
- Modify: `packages/telemetry/package.json`

**Step 1: Update `packages/ui/package.json`**

Use versions aligned with `apps/web` where possible:

```json
{
  "name": "@smartout/ui",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.4",
    "@smartout/telemetry": "workspace:*",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

Note: `react`, `react-dom`, `tailwindcss`, `postcss` moved to peerDependencies — the consuming app provides these.

**Step 2: Update `packages/utils/package.json`**

```json
{
  "name": "@smartout/utils",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "date-fns": "^4.1.0",
    "zod": "^3.25.0",
    "@smartout/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 3: Update `packages/notifications/package.json`**

```json
{
  "name": "@smartout/notifications",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@sendgrid/mail": "^8.1.0",
    "twilio": "^5.5.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 4: Update `packages/tailwind-config/package.json`**

```json
{
  "name": "@smartout/tailwind-config",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "peerDependencies": {
    "tailwindcss": "^4.0.0"
  }
}
```

**Step 5: Update `packages/telemetry/package.json`**

```json
{
  "name": "@smartout/telemetry",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "posthog-js": "^1.240.0",
    "posthog-node": "^4.5.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

**Step 6: Reinstall dependencies**

Run: `pnpm install`
Expected: Clean install, lockfile updated

**Step 7: Verify web still builds**

Run: `pnpm --filter web build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add packages/ui/package.json \
       packages/utils/package.json \
       packages/notifications/package.json \
       packages/tailwind-config/package.json \
       packages/telemetry/package.json \
       pnpm-lock.yaml
git commit -m "fix: pin all package versions, replace 'latest' with explicit ranges

Aligns versions with apps/web where possible. Moves react/tailwind
to peerDependencies in library packages."
```

---

## Task 6: Clean up empty workspaces

**Files:**

- Delete: `apps/storybook/` (empty — only had orphan files deleted in Task 4)
- Delete: `apps/video/` (empty — only had stale log deleted in Task 4)

**Step 1: Verify directories are truly empty**

```bash
ls -la apps/storybook/
ls -la apps/video/
```

Expected: Empty directories (orphan files removed in Task 4)

**Step 2: Remove empty workspace directories**

```bash
rm -rf apps/storybook apps/video
```

**Step 3: Verify pnpm workspace resolution**

Run: `pnpm install`
Expected: No errors about missing workspaces

**Step 4: Commit**

```bash
git add -A apps/storybook apps/video
git commit -m "chore: remove empty storybook and video workspace directories

These contained no package.json or source files. Can be recreated
when needed."
```

---

## Task 7: Add build scripts to packages missing them

**Files:**

- Modify: `packages/ui/package.json`
- Modify: `packages/utils/package.json`
- Modify: `packages/notifications/package.json`
- Modify: `packages/telemetry/package.json`
- Modify: `packages/i18n/package.json`

Note: These packages use `main: "src/index.ts"` — they're consumed directly as TypeScript source by the Next.js apps (which compile them via `transpilePackages` or Turbopack). They don't need `tsc` build output. But they should have lint scripts for CI.

**Step 1: Verify packages are consumed as source**

Check if `apps/web/next.config.ts` has `transpilePackages` or if Turbopack handles it:

```bash
grep -r "transpilePackages\|@smartout" apps/web/next.config*
```

**Step 2: Add lint stub scripts to packages that lack them**

For each of `packages/ui`, `packages/utils`, `packages/notifications`, `packages/telemetry`, `packages/i18n` — add to their `package.json`:

```json
"scripts": {
  "lint": "tsc --noEmit"
}
```

This ensures `turbo run lint` doesn't skip these packages.

**Step 3: Verify turbo lint runs across all packages**

Run: `pnpm lint`
Expected: All packages are included in lint

**Step 4: Commit**

```bash
git add packages/ui/package.json \
       packages/utils/package.json \
       packages/notifications/package.json \
       packages/telemetry/package.json \
       packages/i18n/package.json
git commit -m "chore: add lint scripts to all packages

Uses tsc --noEmit for type checking. Ensures turbo run lint
covers the full monorepo."
```

---

## Final Verification

After all tasks complete:

```bash
pnpm install
pnpm lint
pnpm --filter web build
pnpm --filter landing build
```

All four commands should pass cleanly.
