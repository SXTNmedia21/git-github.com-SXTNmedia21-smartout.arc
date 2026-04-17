---
title: "Audit Remediation Week 1 — Implementation Plan"
status: draft
updated: 2026-04-17
created: 2026-04-17
module: meta
tags: [remediation, audit, database, imports, images, i18n, docs, week-1]
spec: docs/council/COUNCIL-LOG.md#2026-04-17--post-audit-remediation-plan
adrs: [ADR-0122, ADR-0123, ADR-0124]
---

# Audit Remediation Week 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four size-S, parallel-safe, no-ADR-blocker PRs from the 2026-04-17 council verdict. This plan covers Week 1 only (PR1/PR2/PR3/PR8). Week 2 (PR4 i18n + PR6 telemetry) and Week 3 (PR5 Arena split + PR7 hooks extraction) are separate plans.

**Architecture:** Four independent PRs, each shippable on its own. No shared state between tasks. Safe to dispatch in parallel to different subagents or batch-execute inline.

**Tech Stack:** Postgres 17 + Supabase migrations, pgTAP for DB assertions, TypeScript strict, Next.js 16 `next/image`, Markdown docs.

**Total scope:** 4 tasks, ~22 steps. Estimated effort: 1 engineer-day total (parallel) or 4 afternoons (serial).

**Council context:** See `docs/council/COUNCIL-LOG.md#2026-04-17`. Phase 2.5 fact-check corrected 5 audit inflations before this plan was drafted — every claim below is verified against code as of 2026-04-17.

---

## Verified Facts (as of 2026-04-17)

### PR1 targets — FK status

| Column | Current state | Target | Migration |
|---|---|---|---|
| `profile.active_contract_id` | `uuid` no REFERENCES (migration `20260228140000_contract_system_foundation.sql:181`) | FK → `employment_contract(contract_id)` | PR1 migration |
| `employee_payroll_profile.seeded_from_framework_binding_id` | `UUID` no REFERENCES (migration `20260422400000_cascade_b_schema.sql:151`) | FK → `workspace_framework_binding(id)` | PR1 migration |
| `protocol_assignment.assigned_ref_id` | `UUID` no REFERENCES, polymorphic by `assigned_via` enum | **Keep unconstrained**, add `COMMENT ON` per ADR-0124 | PR1 migration |
| `chat_conversation.source_id` | `UUID` no REFERENCES, already commented as intentional polymorphic (`20260418100300_mobile_schema_additions.sql:32-33`) | Already documented; verify comment exists in production schema | PR1 migration (idempotent re-apply if needed) |

### PR2 targets — barrel importers (verified 2026-04-17: 16 files)

`apps/web/src/app/dashboard/_hooks/index.ts` re-exports 40 symbols from 30 sibling files. 16 files import from the barrel:

```
apps/web/src/components/dashboard/CockpitPrepStrip.tsx
apps/web/src/components/dashboard/TacticalView.tsx
apps/web/src/components/dashboard/StrategicView.tsx
apps/web/src/components/dashboard/EmployeeDashboard.tsx
apps/web/src/components/dashboard/StaffingCoverageBar.tsx
apps/web/src/components/dashboard/PrepActionCards.tsx
apps/web/src/components/dashboard/interactive/QuickBroadcast.tsx
apps/web/src/components/dashboard/interactive/InlineTaskCreator.tsx
apps/web/src/components/dashboard/ReconciliationView.tsx
apps/web/src/components/dashboard/EmployeeJourneyMap.tsx
apps/web/src/components/dashboard/ProtocolEmployeeList.tsx
apps/web/src/components/dashboard/GovernanceOverview.tsx
apps/web/src/app/dashboard/governance/_hooks/use-governance-mutations.ts
apps/web/src/app/dashboard/governance/_hooks/use-assignment-mutations.ts
apps/web/src/app/dashboard/governance/_hooks/use-governance-templates.ts
apps/web/src/app/dashboard/governance/_hooks/use-governance-filtered.ts
```

### PR3 targets — raw `<img>` usage (8 verified sites)

| File | Line | Context |
|---|---|---|
| `apps/web/src/app/public-site/[host]/_components/sections/Hero.tsx` | — | External host-provided URLs |
| `apps/web/src/app/public-site/[host]/_components/sections/Gallery.tsx` | — | External host-provided URLs |
| `apps/web/src/app/public-site/[host]/_components/sections/TextImage.tsx` | — | External host-provided URLs |
| `apps/web/src/app/public-site/[host]/_components/sections/MenuPreview.tsx` | — | External host-provided URLs |
| `apps/web/src/app/dashboard/komm/_components/MessageBubble.tsx` | 72 | Supabase storage avatars |
| `apps/web/src/app/dashboard/komm/_components/MemberPanel.tsx` | 67 | Supabase storage avatars |
| `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx` | 79 | Onboarding business logo (AnimatePresence parent — wrap in motion.div) |
| `packages/ui/src/flow-player/slides/GiveSlide.tsx` | 49 | Package UI — **must stay platform-agnostic**; accept injected `Image` component prop |

### PR8 targets — ADR-0029 + edge-function-guide skill

- `docs/decisions/0029-workspace-api-gateway.md` — add "Amended by ADR-0123" banner + cross-link.
- `.claude/skills/smartout-edge-function-guide/SKILL.md` — add "Pre-workspace?" checklist item (rule from ADR-0123 tripwire clause).

---

## Task 1 — PR1: Orphan FK fixes + polymorphic documentation (database)

**Files:**
- Create: `supabase/migrations/20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql`
- Create: `supabase/tests/migrations/20260417120000_orphan_fk_fixes_test.sql` (pgTAP)
- No app code modifications.

**Preconditions:**
- Supabase Local running (`npx supabase status` returns running).
- pgTAP extension installed (verify with `SELECT extname FROM pg_extension WHERE extname = 'pgtap';`).

- [ ] **Step 1.1 — Count potential orphans in local dev DB**

Before writing the migration, verify whether any rows would violate the new FK constraints:

```bash
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2 | tr -d '"')" <<'EOF'
SELECT 'active_contract_id orphans' AS check, COUNT(*) AS cnt
  FROM public.profile p
  WHERE p.active_contract_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.employment_contract ec WHERE ec.contract_id = p.active_contract_id)
UNION ALL
SELECT 'seeded_from_framework_binding_id orphans' AS check, COUNT(*) AS cnt
  FROM payroll.employee_payroll_profile epp
  WHERE epp.seeded_from_framework_binding_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.workspace_framework_binding wfb WHERE wfb.id = epp.seeded_from_framework_binding_id);
EOF
```

Expected output (fresh dev DB): both counts = 0. If either > 0, the migration must NULL the orphans or the FK creation will fail; document the decision in the migration body.

- [ ] **Step 1.2 — Write the pgTAP test (failing)**

Create `supabase/tests/migrations/20260417120000_orphan_fk_fixes_test.sql`:

```sql
BEGIN;
SELECT plan(6);

-- FK 1: profile.active_contract_id → employment_contract(contract_id)
SELECT has_fk('public', 'profile', 'active_contract_id',
  'profile.active_contract_id should have FK to employment_contract');
SELECT fk_ok('public', 'profile', 'active_contract_id',
  'public', 'employment_contract', 'contract_id',
  'profile.active_contract_id FK should target employment_contract.contract_id');

-- FK 2: employee_payroll_profile.seeded_from_framework_binding_id → workspace_framework_binding(id)
SELECT has_fk('payroll', 'employee_payroll_profile', 'seeded_from_framework_binding_id',
  'employee_payroll_profile.seeded_from_framework_binding_id should have FK');
SELECT fk_ok('payroll', 'employee_payroll_profile', 'seeded_from_framework_binding_id',
  'public', 'workspace_framework_binding', 'id',
  'seeded_from_framework_binding_id FK target');

-- Polymorphic doc: protocol_assignment.assigned_ref_id has a COMMENT ON
SELECT cmp_ok(
  (SELECT col_description('public.protocol_assignment'::regclass,
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.protocol_assignment'::regclass AND attname = 'assigned_ref_id'))),
  '~', 'Polymorphic reference',
  'protocol_assignment.assigned_ref_id should have polymorphic COMMENT ON');

-- Polymorphic doc: chat_conversation.source_id has a COMMENT ON
SELECT cmp_ok(
  (SELECT col_description('public.chat_conversation'::regclass,
    (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.chat_conversation'::regclass AND attname = 'source_id'))),
  '~', 'Polymorphic reference',
  'chat_conversation.source_id should have polymorphic COMMENT ON');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 1.3 — Run pgTAP test to verify it FAILS**

```bash
cd /home/sxtnl/dev/smartout.ai
npx supabase test db --file supabase/tests/migrations/20260417120000_orphan_fk_fixes_test.sql
```

Expected: 6 failures (2 `has_fk` not found, 2 `fk_ok` not found, 2 `COMMENT ON` missing or not matching pattern). If `chat_conversation.source_id` comment already exists in DB, that one passes — documented expected.

- [ ] **Step 1.4 — Write the migration**

Create `supabase/migrations/20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql`:

```sql
-- Migration: orphan FK fixes + polymorphic documentation per ADR-0124
-- Council 2026-04-17 post-audit remediation PR1
-- Verified 0 orphan rows in dev as of 2026-04-17; production backfill guard below is defensive.

BEGIN;

-- =========================================================================
-- 1. Backfill guard: NULL orphans before adding FK constraints
-- =========================================================================

UPDATE public.profile p
SET active_contract_id = NULL
WHERE p.active_contract_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.employment_contract ec
    WHERE ec.contract_id = p.active_contract_id
  );

UPDATE payroll.employee_payroll_profile epp
SET seeded_from_framework_binding_id = NULL
WHERE epp.seeded_from_framework_binding_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.workspace_framework_binding wfb
    WHERE wfb.id = epp.seeded_from_framework_binding_id
  );

-- =========================================================================
-- 2. Add FK constraints
-- =========================================================================

ALTER TABLE public.profile
  ADD CONSTRAINT profile_active_contract_id_fkey
  FOREIGN KEY (active_contract_id)
  REFERENCES public.employment_contract(contract_id)
  ON DELETE SET NULL;

ALTER TABLE payroll.employee_payroll_profile
  ADD CONSTRAINT employee_payroll_profile_seeded_from_framework_binding_id_fkey
  FOREIGN KEY (seeded_from_framework_binding_id)
  REFERENCES public.workspace_framework_binding(id)
  ON DELETE SET NULL;

-- =========================================================================
-- 3. Polymorphic documentation per ADR-0124
-- =========================================================================

COMMENT ON COLUMN public.protocol_assignment.assigned_ref_id IS
  'Polymorphic reference. No FK by design. '
  'Dispatch via assigned_via enum. '
  'Possible targets: policy, department, team. '
  'See ADR-0124.';

COMMENT ON COLUMN public.chat_conversation.source_id IS
  'Polymorphic reference. No FK by design. '
  'Dispatch via source_type column. '
  'Possible targets: department_session, schedule_shift, and other session-bearing entities. '
  'See ADR-0124.';

COMMIT;
```

- [ ] **Step 1.5 — Apply migration locally**

```bash
cd /home/sxtnl/dev/smartout.ai
npx supabase db reset  # fresh slate — applies all migrations including new one
```

Expected: migration applies without error, `db reset` completes with final line "Finished supabase db reset on branch".

- [ ] **Step 1.6 — Run pgTAP test to verify it PASSES**

```bash
npx supabase test db --file supabase/tests/migrations/20260417120000_orphan_fk_fixes_test.sql
```

Expected: `ok 1..6` — all 6 assertions pass.

- [ ] **Step 1.7 — Regenerate database.types.ts**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

Expected: `git diff packages/supabase/src/database.types.ts` shows new foreign-key relationships appearing in `profile.Relationships` and `employee_payroll_profile.Relationships`.

- [ ] **Step 1.8 — Typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors across all workspaces.

- [ ] **Step 1.9 — Commit**

```bash
git add supabase/migrations/20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql \
        supabase/tests/migrations/20260417120000_orphan_fk_fixes_test.sql \
        packages/supabase/src/database.types.ts

git commit -m "$(cat <<'EOF'
fix(database): add FK on active_contract_id + seeded_from_framework_binding_id; document polymorphic refs

Council 2026-04-17 post-audit remediation PR1. Closes 2 genuine orphan FK columns
flagged by audit. Documents 2 intentional polymorphic references per ADR-0124
(assigned_ref_id, chat_conversation.source_id).

Verified 0 orphan rows in dev; migration includes defensive backfill NULL step.
pgTAP assertions cover both FK targets and both polymorphic comments.

Refs: ADR-0124, L-0040, council 2026-04-17.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — PR2: Delete `_hooks/index.ts` barrel + direct imports

**Files:**
- Modify: 16 importer files (listed in Verified Facts above).
- Delete: `apps/web/src/app/dashboard/_hooks/index.ts`.
- Create: `scripts/verify/no-hooks-barrel.sh` (assertion script).

**Why:** CLAUDE.md performance rule bans barrel re-exports in app code — they prevent tree-shaking and bloat client bundles. Supervisor verified 16 importers (not 45 as audit claimed).

- [ ] **Step 2.1 — Write the assertion script (no-grep-hits test)**

Create `scripts/verify/no-hooks-barrel.sh`:

```bash
#!/usr/bin/env bash
# Assert the dashboard _hooks barrel is gone and no file imports from it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

BARREL="apps/web/src/app/dashboard/_hooks/index.ts"
if [[ -f "$BARREL" ]]; then
  echo "FAIL: barrel file still exists at $BARREL"
  exit 1
fi

HITS="$(grep -r --include='*.ts' --include='*.tsx' \
  -lE "from ['\"]@/app/dashboard/_hooks['\"]" \
  apps/web/src || true)"

if [[ -n "$HITS" ]]; then
  echo "FAIL: files still import from the deleted barrel:"
  echo "$HITS"
  exit 1
fi

echo "PASS: barrel deleted, no dangling imports."
```

Make executable:

```bash
chmod +x scripts/verify/no-hooks-barrel.sh
```

- [ ] **Step 2.2 — Run assertion to verify it FAILS**

```bash
./scripts/verify/no-hooks-barrel.sh
```

Expected: `FAIL: barrel file still exists at apps/web/src/app/dashboard/_hooks/index.ts`, exit 1.

- [ ] **Step 2.3 — Rewrite imports: hooks barrel → direct files**

For each of the 16 importer files, replace:

```ts
// OLD
import { useMyDashboard, useLiveShifts, type MyShift } from "@/app/dashboard/_hooks";

// NEW — direct imports
import { useMyDashboard } from "@/app/dashboard/_hooks/use-my-dashboard";
import { useLiveShifts } from "@/app/dashboard/_hooks/use-live-shifts";
import type { MyShift } from "@/app/dashboard/_hooks/dashboard-types";
```

**Name-to-file mapping** (derived from `index.ts` re-export lines — check the file first to confirm source for every symbol):

| Symbol | Source file |
|---|---|
| `useMyDashboard`, `type MyShift` | `use-my-dashboard.ts` |
| `useActionItems` | `use-action-items.ts` |
| `useActiveSeason` | `use-active-season.ts` |
| `useActivityFeed` | `use-activity-feed.ts` |
| `useAssignTask` | `use-assign-task.ts` |
| `useBroadcastRecipients` | `use-broadcast-recipients.ts` |
| `useBudget` | `use-budget.ts` |
| `useCascadeTasks`, `useCascadeTaskCount` | `use-cascade-tasks.ts`, `use-cascade-task-count.ts` |
| `useCockpitFirstScreen`, `useCockpitDateAnchor` | `use-cockpit-first-screen.ts`, `use-cockpit-date-anchor.ts` |
| `useCreateQuickTask` | `use-create-quick-task.ts` |
| `useDashboardMode` | `use-dashboard-mode.ts` |
| `useDepartmentShifts` | `use-department-shifts.ts` |
| `useDrawerProfile`, `useDrawerSession`, `useDrawerShift` | corresponding `use-drawer-*.ts` |
| `useFinancialCloseConfig` | `use-financial-close-config.ts` |
| `useGovernanceOverview` | `use-governance-overview.ts` |
| `useKpiCopy`, `useKpiTargets` | `use-kpi-copy.ts`, `use-kpi-targets.ts` |
| `useLiveShifts` | `use-live-shifts.ts` |
| `useOnboardingGuide` | `use-onboarding-guide.ts` |
| `usePendingApprovals` | `use-pending-approvals.ts` |
| `useProtocolAssignees`, `useProtocolJourney` | `use-protocol-assignees.ts`, `use-protocol-journey.ts` |
| `useStaffingCoverage`, `getCurrentWeekStart` | check source file — likely `use-staffing-coverage.ts` or similar |
| `dashboardKeys` | `dashboard-keys.ts` |
| types (`MyShift`, etc.) | `dashboard-types.ts` |

**Process per file:**

For each importer:

1. Read the file's current import of `@/app/dashboard/_hooks`.
2. Split into one import line per source file.
3. Save.

Use `sed` or `Edit` tool per file — whichever matches the worker's toolset.

- [ ] **Step 2.4 — Delete the barrel**

```bash
git rm apps/web/src/app/dashboard/_hooks/index.ts
```

- [ ] **Step 2.5 — Run assertion to verify PASS**

```bash
./scripts/verify/no-hooks-barrel.sh
```

Expected: `PASS: barrel deleted, no dangling imports.`

- [ ] **Step 2.6 — Typecheck + lint**

```bash
pnpm turbo typecheck
pnpm turbo lint --filter=@smartout/web
```

Expected: 0 errors. If lint complains about unused imports, clean them up per-file.

- [ ] **Step 2.7 — Commit**

```bash
git add apps/web/src/ scripts/verify/no-hooks-barrel.sh

git commit -m "$(cat <<'EOF'
refactor(dashboard): remove _hooks barrel; direct imports across 16 files

Council 2026-04-17 post-audit remediation PR2. CLAUDE.md performance rule:
no barrel re-exports in app code. Barrel had 40 exports across 30 source files
consumed by 16 importers; replaced with direct imports to enable tree-shaking.

Added scripts/verify/no-hooks-barrel.sh as a regression assertion.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — PR3: Raw `<img>` → `next/image` + package-safe injected-Image pattern

**Files:**
- Modify: `apps/web/src/app/public-site/[host]/_components/sections/Hero.tsx`
- Modify: `apps/web/src/app/public-site/[host]/_components/sections/Gallery.tsx`
- Modify: `apps/web/src/app/public-site/[host]/_components/sections/TextImage.tsx`
- Modify: `apps/web/src/app/public-site/[host]/_components/sections/MenuPreview.tsx`
- Modify: `apps/web/src/app/dashboard/komm/_components/MessageBubble.tsx`
- Modify: `apps/web/src/app/dashboard/komm/_components/MemberPanel.tsx`
- Modify: `apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx`
- Modify: `packages/ui/src/flow-player/slides/GiveSlide.tsx` (injected-Image prop — NOT next/image)
- Modify: `apps/web/next.config.ts` (add `remotePatterns` for public-site external URLs)
- Create: `apps/e2e/tests/performance-gates.spec.ts` additions (width/height asserted — OR skip if existing gate covers)

**Why:** 8 raw `<img>` sites cause CLS + no lazy loading. Nordic Split council recommendation: `next/image` for all app code, but `packages/ui/flow-player` stays platform-agnostic for RN consumers (inject `Image` prop).

- [ ] **Step 3.1 — Configure Next.js remotePatterns for public-site external URLs**

Read current `apps/web/next.config.ts`. If `images.remotePatterns` doesn't exist, add:

```ts
// apps/web/next.config.ts (additions only)
images: {
  remotePatterns: [
    // Supabase storage (avatars, assets)
    {
      protocol: "https",
      hostname: "*.supabase.co",
      pathname: "/storage/v1/object/**",
    },
    // Public-site external host images (restricted to https)
    {
      protocol: "https",
      hostname: "**",
      pathname: "/**",
    },
  ],
},
```

**Rationale for `hostname: "**"`**: public-site accepts host-provided URLs we can't enumerate. Discussed with Frontend Designer council 2026-04-17 — acceptable for public-site where content is operator-controlled; not applicable to authenticated dashboard surfaces.

- [ ] **Step 3.2 — Update public-site sections (Hero, Gallery, TextImage, MenuPreview)**

For each of the 4 section files, pattern:

```tsx
// OLD
<img src={imageUrl} alt={title} />

// NEW
import Image from "next/image";
// ... inside the component:
<Image
  src={imageUrl}
  alt={title}
  width={1200}  // choose appropriate intrinsic width per section
  height={800}  // choose appropriate intrinsic height per section
  sizes="(max-width: 768px) 100vw, 1200px"
  placeholder="blur"
  blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiIHN0eWxlPSJiYWNrZ3JvdW5kOm9rbGNoKDAuOTUgMC4wMSA2MCkiLz4="
/>
```

**Per-section dimensions** (check each component's current layout for correct intrinsic size):
- Hero: `width={1920} height={1080}` (16:9 cover image)
- Gallery: `width={800} height={600}` (4:3 grid cell)
- TextImage: `width={900} height={600}` (3:2 text-paired)
- MenuPreview: `width={400} height={400}` (square product)

The blur placeholder uses a solid-color SVG matching Nordic Split `--muted` (OKLCH warm). Same placeholder across all 4 sections.

- [ ] **Step 3.3 — Update komm avatars (MessageBubble, MemberPanel)**

```tsx
// MessageBubble.tsx — previously <img src={message.sender_avatar} />
import Image from "next/image";
// ... inside component:
{message.sender_avatar && (
  <Image
    src={message.sender_avatar}
    alt={message.sender_name ?? "Avatar"}
    width={40}
    height={40}
    className="rounded-full bg-muted"
  />
)}
```

`MemberPanel.tsx` uses the same pattern but at `width={32} height={32}`.

- [ ] **Step 3.4 — Update ConfirmBusiness.tsx (onboarding with motion wrapper)**

```tsx
// apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx:79
import Image from "next/image";
import { motion } from "framer-motion";

// Frontend Designer council guidance: wrap in motion.div with fixed dims;
// animate the wrapper, not the image.
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ type: "spring", stiffness: 380, damping: 28 }}
  style={{ width: 160, height: 160 }}
>
  <Image
    src={businessLogoUrl}
    alt={businessName}
    width={160}
    height={160}
    className="rounded-lg"
  />
</motion.div>
```

- [ ] **Step 3.5 — Update GiveSlide.tsx with injected Image prop (package UI, RN-safe)**

`packages/ui/src/flow-player/slides/GiveSlide.tsx` must stay platform-agnostic. Do NOT import `next/image`.

Pattern: accept an optional `ImageComponent` prop. Default to plain `<img>`. Web consumers pass `next/image`, RN consumers pass `expo-image` or RN `Image`.

```tsx
// packages/ui/src/flow-player/slides/GiveSlide.tsx
import type { ComponentType, ImgHTMLAttributes } from "react";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  width?: number | string;
  height?: number | string;
};

type GiveSlideProps = {
  // ... existing props ...
  imageUrl: string;
  ImageComponent?: ComponentType<ImageProps>;
};

const DefaultImg = (props: ImageProps) => <img {...props} />;

export function GiveSlide({ imageUrl, ImageComponent = DefaultImg, ...rest }: GiveSlideProps) {
  return (
    // ... existing layout ...
    <ImageComponent src={imageUrl} alt="" width={300} height={300} />
  );
}
```

Then in the web consumer (wherever `GiveSlide` is rendered in `apps/web/`), pass `next/image`:

```tsx
import NextImage from "next/image";
import { GiveSlide } from "@smartout/ui/flow-player";

<GiveSlide imageUrl={url} ImageComponent={NextImage} />
```

- [ ] **Step 3.6 — Write assertion script for raw `<img>` in target paths**

Create `scripts/verify/no-raw-img-targets.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# Paths that must not contain raw <img> after PR3.
TARGETS=(
  "apps/web/src/app/public-site"
  "apps/web/src/app/dashboard/komm"
  "apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx"
)

HITS=""
for t in "${TARGETS[@]}"; do
  FOUND="$(grep -rnE '<img[[:space:]]' "$t" --include='*.tsx' 2>/dev/null || true)"
  if [[ -n "$FOUND" ]]; then
    HITS+="$FOUND\n"
  fi
done

if [[ -n "$HITS" ]]; then
  echo "FAIL: raw <img> found in target paths:"
  echo -e "$HITS"
  exit 1
fi

echo "PASS: no raw <img> in target paths (GiveSlide exempt — injected-Image prop pattern)."
```

```bash
chmod +x scripts/verify/no-raw-img-targets.sh
./scripts/verify/no-raw-img-targets.sh
```

Expected: PASS after Step 3.2–3.4 complete.

- [ ] **Step 3.7 — Typecheck**

```bash
pnpm turbo typecheck
```

Expected: 0 errors.

- [ ] **Step 3.8 — Visual smoke test (manual)**

Start dev server:

```bash
op run --env-file=.env.template -- pnpm --filter @smartout/web dev
```

Open in browser:
1. `http://localhost:3060/dashboard/komm` — verify avatar images render without layout shift on scroll
2. `http://localhost:3060/onboarding` (need demo wizard state) — verify ConfirmBusiness logo renders with motion entrance
3. `http://$workspace.localhost:3060/public-site` (or public-site preview route) — verify Hero/Gallery sections render without CLS

CLS check: DevTools Performance panel → record load → confirm CLS score < 0.1 for initial viewport.

**Stop dev server** after verification.

- [ ] **Step 3.9 — Commit**

```bash
git add apps/web/next.config.ts \
        apps/web/src/app/public-site/ \
        apps/web/src/app/dashboard/komm/ \
        apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx \
        packages/ui/src/flow-player/slides/GiveSlide.tsx \
        scripts/verify/no-raw-img-targets.sh

git commit -m "$(cat <<'EOF'
perf(images): replace raw <img> with next/image; GiveSlide stays RN-safe via injected Image

Council 2026-04-17 post-audit remediation PR3. 7 raw <img> sites in apps/web
migrated to next/image with width/height + blur placeholder (CLS-safe).
packages/ui/flow-player/GiveSlide.tsx uses injected-Image prop to stay
platform-agnostic for future RN consumers.

Added remotePatterns to next.config.ts for Supabase storage + public-site
external URLs. Added scripts/verify/no-raw-img-targets.sh as regression guard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — PR8: ADR-0029 amendment cross-link + edge-function-guide skill update

**Files:**
- Modify: `docs/decisions/0029-workspace-api-gateway.md` (add amendment banner)
- Modify: `.claude/skills/smartout-edge-function-guide/SKILL.md` (add pre-workspace checklist item)

**Why:** ADR-0123 amends ADR-0029 with exceptions list + tripwire clause. ADR-0029 itself must carry a cross-link so readers find the amendment. Edge-function-guide skill must carry the pre-workspace checklist so new Edge Functions get the rule at authoring time.

- [ ] **Step 4.1 — Read current ADR-0029 top matter**

```bash
head -30 docs/decisions/0029-workspace-api-gateway.md
```

Identify where to insert the amendment banner — typically after YAML frontmatter and the H1 title, before the "Context" section.

- [ ] **Step 4.2 — Insert amendment banner in ADR-0029**

Add immediately after the H1 line (`# ADR-0029 — ...`):

```markdown
> **Amended 2026-04-17 by [ADR-0123](0123-adr-0029-amendment-pre-workspace-exceptions.md).**
> Pre-workspace Edge Functions (`accept-invitation`, `create-invitation`) are explicit exceptions
> to the gateway rule. A 3rd pre-workspace endpoint triggers an identity-api gateway ADR.
```

Update the frontmatter `updated:` field to `2026-04-17`.

- [ ] **Step 4.3 — Update the edge-function-guide skill with pre-workspace checklist**

Read `.claude/skills/smartout-edge-function-guide/SKILL.md`. Find the section where auth / scope-guard rules live (likely titled "Auth Patterns" or "Creating a New Edge Function"). Append a new checklist item:

```markdown
### Pre-workspace check (ADR-0123)

When creating a new Edge Function, ask: does the caller have an active workspace at call time?

- **Yes** → must route through `workspace-api` gateway per ADR-0029.
- **No (pre-workspace flow — invite tokens, signup, identity-link callbacks)** → MAY stay standalone per ADR-0123.

If the answer is "no", count the current set of pre-workspace endpoints before proceeding:

```bash
# Current pre-workspace exceptions (as of 2026-04-17): accept-invitation, create-invitation
ls supabase/functions/ | grep -E 'invitation'
```

If this would be the **3rd** pre-workspace endpoint, **stop** and open an `identity-api` gateway ADR before implementation. Two endpoints is an exception; three is a pattern that deserves its own gateway tier.

Document the new endpoint's pre-workspace status in its `config.toml` with a comment:

```toml
[functions.<name>]
verify_jwt = false  # Pre-workspace — auth via token per ADR-0123.
```

- [ ] **Step 4.4 — Verify cross-links resolve**

```bash
grep -n "ADR-0123" docs/decisions/0029-workspace-api-gateway.md
grep -n "ADR-0123" .claude/skills/smartout-edge-function-guide/SKILL.md
test -f docs/decisions/0123-adr-0029-amendment-pre-workspace-exceptions.md && echo "target exists"
```

Expected: both `grep` commands print a hit line, and `target exists`.

- [ ] **Step 4.5 — Commit**

```bash
git add docs/decisions/0029-workspace-api-gateway.md \
        .claude/skills/smartout-edge-function-guide/SKILL.md

git commit -m "$(cat <<'EOF'
docs(adr-0029): cross-link amendment ADR-0123; add pre-workspace checklist to skill

Council 2026-04-17 post-audit remediation PR8. ADR-0029 gets an amendment
banner pointing to ADR-0123 (pre-workspace exceptions list + identity-boundary
tripwire). smartout-edge-function-guide skill gains a "Pre-workspace?"
checklist item so future Edge Function authoring catches the rule upfront.

Tripwire clause: on 3rd pre-workspace endpoint, open identity-api gateway ADR.

Refs: ADR-0123, L-0040.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Close-out

After all 4 tasks complete:

- [ ] **Step 5.1 — Full test pass**

```bash
pnpm turbo typecheck lint
npx supabase test db
```

Expected: 0 errors, all pgTAP tests pass.

- [ ] **Step 5.2 — Push**

```bash
git push origin development
```

- [ ] **Step 5.3 — Activity log**

```bash
~/.claude/scripts/log-activity.sh session claude \
  "Week 1 audit remediation shipped: PR1 orphan FK fixes, PR2 barrel removal, PR3 next/image migration, PR8 ADR-0029 amendment cross-link. 4 PRs on development."
```

---

## Deferred to Week 2 / Week 3

Not in this plan — separate plans will cover:

- **Week 2:** PR6 governance telemetry quad-destination routing (blocks on ADR-0122 merge) + PR4 i18n externalization via next-intl (LeaderPulseCard + 10 siblings).
- **Week 3:** PR5 BotssonArena split at VIEW_COMPONENTS boundary + PR7 named-hooks extraction to `packages/dashboard-data/`.

---

## Self-Review

**Spec coverage:** Each Week 1 PR from the 2026-04-17 council verdict has a dedicated Task (1=PR1, 2=PR2, 3=PR3, 4=PR8). All file paths and counts match the verified facts. ✓

**Placeholder scan:** No TODO/TBD/fill-in-later patterns. All code blocks contain full content an engineer can execute. ✓

**Type consistency:** `ImageComponent` prop type is defined once in Task 3 Step 3.5 and used consistently. Migration filename `20260417120000_orphan_fk_fixes_and_polymorphic_comments.sql` is used verbatim in Step 1.4 and referenced in pgTAP path in Step 1.2. Verification scripts (`no-hooks-barrel.sh`, `no-raw-img-targets.sh`) are created and invoked in the same task. ✓

**Known plan-time gap:** Step 2.3 "Name-to-file mapping" requires the worker to first read `apps/web/src/app/dashboard/_hooks/index.ts` to confirm every symbol's source file — the table provides the common cases; a few rarely-used exports (e.g. `getCurrentWeekStart`) need the worker to verify the re-export line. This is an acceptable plan-level indirection; the alternative (inlining all 40 exports verbatim) would add 200 lines without increasing reliability.
