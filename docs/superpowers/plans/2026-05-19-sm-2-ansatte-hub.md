# SM-2 — Ansatte Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Ansatte hub to match the canonical tab set `Liste · Roller · Kontrakter · Trening`. Add placeholder pages for Roller + Trening. Drop the Policys cross-jump tab. Drop the Innkalling tab (semantics moved to Planlegging → Kalender per spec §5.1). Surface workspace invitations as a status-filter chip with count badge on the Liste tab. Contracts URL move is deferred to a follow-up sortie.

**Architecture:** Two new pages (`/dashboard/people/roles` + `/dashboard/people/training`). Roller page is a server component that mirrors `/dashboard/people/page.tsx` data-fetching pattern: `resolveDashboardContext()` + `fetchWorkspacePeople()` from `@smartout/utils`, then groups results by `profile.role` (`employee/manager/admin/owner/system` enum). Renders KPI cards per role with live counts + list of profiles under each role — **real D2 (Resource) cascade data, not a hardcoded catalog**. Trening page is a clean "Kommer snart" placeholder until the protocol_assignment query layer is ready. PEOPLE_TAB_DEFS rewritten to four entries. Liste tab gains an "Invitert" filter chip with count badge.

Per Pontus 2026-05-19 (revised after recon): the original plan proposed extracting `ROLE_DEFINITIONS` from the wizard to a shared K1a module. That was incorrect — the wizard's inline array is *job titles for hospitality* (daglig-leder, restaurantsjef, kjøkkensjef…), not the canonical `profile_role` enum (`employee/manager/admin/owner`). These are two different concepts (operational job-title vs auth permission level). The Roller hub-page should answer "who has which permission level" → query `profile.role`. The hospitality job-title catalog belongs to the wizard surface only, until a future workspace_position DB-tier sortie surfaces it elsewhere.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript strict, Lucide icons. No new dependencies, no migrations, no API changes.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §3 (tabs map), §5.3 (Invitasjoner-as-filter), §6 (status-as-filter principle).

**Scope deferred:** Contracts URL move (`/dashboard/contracts/*` → `/dashboard/people/contracts/*`) is SM-2-followup. The Kontrakter tab in this sortie cross-jumps to `/dashboard/contracts` — a documented temporary state until the follow-up sortie lands. This preserves all 20+ existing references to `/dashboard/contracts/*` (API routes, drawer imports, layout deep-links, tests) without modification.

---

## File Structure

| Operation | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/app/dashboard/people/roles/page.tsx` | Roller server component — `resolveDashboardContext` + `fetchWorkspacePeople`, groups by `profile.role`, renders KPI strip + per-role profile list. Real D2 data. |
| Create | `apps/web/src/app/dashboard/people/roles/loading.tsx` | Skeleton fallback. |
| Create | `apps/web/src/app/dashboard/people/training/page.tsx` | Trening clean "Kommer snart" placeholder. Real data lands in followup sortie wired to `protocol_assignment`. |
| Create | `apps/web/src/app/dashboard/people/training/loading.tsx` | Skeleton. |
| Modify | `apps/web/src/app/dashboard/_lib/people-tabs.ts` | Replace PEOPLE_TAB_DEFS with new four-entry array: Liste · Roller · Kontrakter · Trening. Drop Policys + Innkalling. Update icon imports. |
| Modify | `apps/web/src/app/dashboard/people/_components/people-page-client.tsx` | Add "Invitert" filter chip with count badge above the data table. Driven by `invitations.length`. Click toggles `statusFilter === "invited"`. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Append keys: `people.tab_roles`, `people.tab_training`, `people.tab_contracts`, `people.tab_list`, `people.roles_coming_soon`, `people.training_coming_soon`, `people.filter_invited` |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same keys, English values. |

No deletions. No file moves. No URL changes outside the two new pages.

---

## Phase A — Roller (workspace D2 data)

### Task A0: ~~Extract ROLE_DEFINITIONS to shared module~~ DROPPED

Decision recorded 2026-05-19 after recon. The wizard's inline `ROLE_DEFINITIONS` array is a hospitality job-title catalog (12 entries: daglig-leder, restaurantsjef, kjøkkensjef, etc) — NOT the canonical role source for the Ansatte hub. The Roller hub-page answers a workspace question ("who has which role here?") which is properly answered by querying `profile.role` (the `profile_role` enum: employee/manager/admin/owner/system). The hospitality job-title catalog stays inside the wizard surface where it belongs; extracting it would have shipped a static "catalog" view that ignored the actual workspace state.

The wizard step itself is untouched in this sortie.

### ~~Task A0 superseded~~ — proceed directly to Task A1

**Files:**
- Create: `packages/ai/src/industry/cascade-roles.ts`
- Modify: `apps/web/src/app/onboarding/steps/ConfirmRoles.tsx` (replace inline array with import)
- Modify: `packages/ai/src/industry/index.ts` (re-export)

Per Pontus 2026-05-19: roles in the Ansatte → Roller tab must be the SAME roles selectable in the onboarding wizard. ROLE_DEFINITIONS is currently inlined in `ConfirmRoles.tsx`. Extract it so both wizard + people-roles can import from one source. Future DB-tier sortie will replace this constant with a queryable workspace table.

- [ ] **Step 1: Read existing ROLE_DEFINITIONS array**

Run: `sed -n '1,80p' apps/web/src/app/onboarding/steps/ConfirmRoles.tsx`

Identify the `RoleDefinition` type + the full `ROLE_DEFINITIONS` array (likely ~12 entries: daglig-leder, restaurantsjef, kjøkkensjef, barsjef, skiftleder, verneombud, brannvernleder, etc).

- [ ] **Step 2: Create cascade-roles module**

Path: `packages/ai/src/industry/cascade-roles.ts`

```ts
/**
 * Cascade K1a — Industry-level role definitions for hospitality.
 *
 * Single source of truth for roles offered by:
 *   - Onboarding wizard's ConfirmRoles step
 *   - Ansatte → Roller page in the dashboard
 *
 * When a workspace-scoped role table lands (workspace_role per
 * docs/design/sitemap/web/00-CANONICAL.md §13 O-future), both
 * call-sites switch to that table simultaneously.
 *
 * Reference: docs/design/sitemap/web/00-CANONICAL.md §8 (Cascade Mapping)
 */

export type CascadeRoleDefinition = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  selected: boolean;
  required: boolean;
};

export const ROLE_DEFINITIONS: CascadeRoleDefinition[] = [
  // Paste the full array verbatim from ConfirmRoles.tsx here.
  // Implementer: copy the existing inline array exactly, no edits.
];
```

The implementer should paste the actual array contents from `ConfirmRoles.tsx` lines ~26-100 verbatim. Do not edit values, ordering, or required flags. Field-name parity required — the new shared type matches the existing inline type.

- [ ] **Step 3: Update wizard step to import**

In `apps/web/src/app/onboarding/steps/ConfirmRoles.tsx`:

1. Remove the `interface RoleDefinition` declaration.
2. Remove the `const ROLE_DEFINITIONS: RoleDefinition[] = [...]` declaration.
3. Add import: `import { ROLE_DEFINITIONS, type CascadeRoleDefinition } from "@smartout/ai/industry/cascade-roles";`
4. Replace any `RoleDefinition` references in the file with `CascadeRoleDefinition` (the type name changed for explicitness).

- [ ] **Step 4: Re-export from industry index**

In `packages/ai/src/industry/index.ts`, append:

```ts
export * from "./cascade-roles";
```

If the file uses named exports only, change to:

```ts
export { ROLE_DEFINITIONS, type CascadeRoleDefinition } from "./cascade-roles";
```

Match whichever style the existing index.ts uses.

- [ ] **Step 5: Build the ai package + typecheck web**

```bash
pnpm --filter @smartout/ai build 2>&1 | tail -5
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -10
```

Both expected: 0 errors. If the ai-package build is required for the web typecheck to resolve the new export, the build must run first (sibling pattern from L-stage-engine-subpath-imports trap).

- [ ] **Step 6: Commit**

```bash
git add packages/ai/src/industry/cascade-roles.ts packages/ai/src/industry/index.ts apps/web/src/app/onboarding/steps/ConfirmRoles.tsx
git commit -m "refactor(industry): extract ROLE_DEFINITIONS to K1a cascade module (SM-2 A0)

Wizard ConfirmRoles step + Ansatte → Roller page now read from one
shared source. Future workspace_role DB table replaces this constant;
both call-sites migrate together.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task A1: Create `/dashboard/people/roles/page.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/people/roles/page.tsx`

- [ ] **Step 1: Verify directory exists**

Run: `ls apps/web/src/app/dashboard/people/`

Expected: shows `page.tsx`, `_components`, `_actions`, etc. — confirm `roles/` and `training/` do not yet exist.

- [ ] **Step 2: Read sibling page for style reference**

Run: `head -60 apps/web/src/app/dashboard/people/page.tsx`

Expected: server component, async function, fetches data, renders client component. We mirror the OUTER SHELL pattern only — the placeholder body is intentionally minimal.

- [ ] **Step 3: Create roles/page.tsx**

Server component. Reuses the same data-fetching pattern as `/dashboard/people/page.tsx`: `resolveDashboardContext` + `fetchWorkspacePeople`. Groups results by `profile.role`. Renders KPI strip per role (employee, manager, admin, owner — system rows excluded from UI), then per-role profile listings.

Path: `apps/web/src/app/dashboard/people/roles/page.tsx`

```tsx
import { Briefcase, Users, ShieldCheck, Crown } from "lucide-react";
import { createClient } from "@smartout/supabase/server";
import { fetchWorkspacePeople } from "@smartout/utils";
import { resolveDashboardContext } from "../../_data/resolve-page-context";

export const dynamic = "force-dynamic";

const ROLE_META = [
  { key: "owner", label: "Eier", icon: Crown, accent: "amber" },
  { key: "admin", label: "Admin", icon: ShieldCheck, accent: "orange" },
  { key: "manager", label: "Manager", icon: Briefcase, accent: "blue" },
  { key: "employee", label: "Ansatt", icon: Users, accent: "emerald" },
] as const;

export default async function RolesPage() {
  const { workspace } = await resolveDashboardContext();
  const supabase = await createClient();
  const result = await fetchWorkspacePeople(supabase, workspace.workspace_id);

  // Group profiles by role (filter out 'system' from operator view).
  const byRole = new Map<string, typeof result.profiles>();
  for (const p of result.profiles) {
    if (p.role === "system") continue;
    const bucket = byRole.get(p.role) ?? [];
    bucket.push(p);
    byRole.set(p.role, bucket);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Roller
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Rolle-fordeling i workspace</span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-mono tabular-nums">{result.profiles.filter((p) => p.role !== "system").length} ansatte</span>
          </div>
        </div>
      </div>

      {/* KPI strip — count per role */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {ROLE_META.map((meta) => {
          const count = byRole.get(meta.key)?.length ?? 0;
          const Icon = meta.icon;
          return (
            <div
              key={meta.key}
              className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm"
              data-role-key={meta.key}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
                <span className="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
                  {meta.label}
                </span>
              </div>
              <div className="font-mono text-[36px] font-black leading-none tracking-tight tabular-nums">
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body — per-role profile listings */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {ROLE_META.map((meta) => {
            const profiles = byRole.get(meta.key) ?? [];
            if (profiles.length === 0) return null;
            return (
              <section
                key={meta.key}
                className="bg-card border-border rounded-2xl border p-5 shadow-sm"
                aria-label={`Rolle: ${meta.label}`}
              >
                <h2 className="text-foreground mb-3 text-sm font-bold tracking-tight">
                  {meta.label}{" "}
                  <span className="text-muted-foreground font-mono font-normal tabular-nums">
                    ({profiles.length})
                  </span>
                </h2>
                <ul className="space-y-1.5">
                  {profiles.map((p) => (
                    <li
                      key={p.profile_id}
                      className="text-foreground text-sm"
                      data-profile-id={p.profile_id}
                    >
                      {p.user_identity?.display_name ?? p.user_identity?.email ?? "Ukjent"}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

If `fetchWorkspacePeople` return shape uses different property names than `user_identity.display_name` / `user_identity.email`, inspect the type signature (`grep -n 'fetchWorkspacePeople' packages/utils/src` to locate) and adjust. The list-item line is the only place this matters — adjust to whatever the actual shape exposes.

If the package import resolves but `result.profiles[].role` is typed as something other than the `profile_role` enum directly (e.g. wrapped in a transform), cast explicitly: `const role = p.role as "employee" | "manager" | "admin" | "owner" | "system";` and continue.

- [ ] **Step 4: Typecheck**

`pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 5: Verify page renders**

Start dev server briefly OR rely on Next.js compilation log. Navigate to `/dashboard/people/roles` — expects placeholder body with Construction icon + "Kommer snart" text. No console errors.

Skip if dev server is not running and the implementer is dispatched from a CI-style context — typecheck is sufficient at this stage.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/dashboard/people/roles/page.tsx
git commit -m "feat(people): scaffold Roller placeholder page (SM-2 phase A)

Empty page with canonical shell + 'Kommer snart' notice. Roller-matrix
content shipped in follow-up sortie. Route exists so Ansatte tab
strip can point to it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task A2: Create `/dashboard/people/roles/loading.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/people/roles/loading.tsx`

- [ ] **Step 1: Read sibling loading.tsx for shape reference**

Run: `cat apps/web/src/app/dashboard/people/loading.tsx`

Expected: a simple skeleton wrapper.

- [ ] **Step 2: Create roles/loading.tsx**

Path: `apps/web/src/app/dashboard/people/roles/loading.tsx`

```tsx
export default function RolesLoading() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-48 animate-pulse rounded" />
      </div>
      <div className="bg-card border-border min-h-0 flex-1 animate-pulse rounded-2xl border shadow-sm" />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -3
git add apps/web/src/app/dashboard/people/roles/loading.tsx
git commit -m "feat(people): add Roller loading skeleton (SM-2 phase A)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase B — Trening placeholder

### Task B1: Create `/dashboard/people/training/page.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/people/training/page.tsx`

Same shape as A1. Different page-title + body text.

- [ ] **Step 1: Create training/page.tsx**

Pure "Kommer snart" placeholder. Real data lives in `protocol_assignment` + `knowledge_test` (HMS schema). Wiring those queries + building a workforce-readiness matrix is a separate sortie (SM-2-followup-training). Until then, the tab needs to exist so PEOPLE_TAB_DEFS can point to it.

Path: `apps/web/src/app/dashboard/people/training/page.tsx`

```tsx
import { Construction } from "lucide-react";

export const dynamic = "force-dynamic";

export default function TrainingPage() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Trening
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Workforce readiness per ansatt</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="bg-card border-border flex h-full flex-col items-center justify-center rounded-2xl border p-12 shadow-sm">
          <Construction className="text-muted-foreground mb-4 h-12 w-12" aria-hidden />
          <h2 className="text-foreground text-lg font-semibold">Kommer snart</h2>
          <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
            Trenings-matrise viser hvem som har gjennomført hvilke protokoller, hvem
            som er forfalt, og workforce readiness per avdeling. Samme data som
            /hms/training men fra ansatt-perspektiv. Bygges i SM-2-followup-training.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -3
git add apps/web/src/app/dashboard/people/training/page.tsx
git commit -m "feat(people): scaffold Trening placeholder page (SM-2 phase B)

Empty page with canonical shell + 'Kommer snart' notice. Trenings-
matrix content shipped in follow-up. Route exists so Ansatte tab
strip can point to it.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task B2: Create `/dashboard/people/training/loading.tsx`

Same shape as A2 with title "Trening".

- [ ] **Step 1: Create loading.tsx**

```tsx
export default function TrainingLoading() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-48 animate-pulse rounded" />
      </div>
      <div className="bg-card border-border min-h-0 flex-1 animate-pulse rounded-2xl border shadow-sm" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -3
git add apps/web/src/app/dashboard/people/training/loading.tsx
git commit -m "feat(people): add Trening loading skeleton (SM-2 phase B)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Phase C — Tab definitions update

### Task C1: Rewrite PEOPLE_TAB_DEFS

**Files:**
- Modify: `apps/web/src/app/dashboard/_lib/people-tabs.ts`

- [ ] **Step 1: Read current shape**

Run: `cat apps/web/src/app/dashboard/_lib/people-tabs.ts`

Expected: 4 tabs — Ansatte / Kontrakter / Policys / Innkalling.

- [ ] **Step 2: Replace file contents**

Path: `apps/web/src/app/dashboard/_lib/people-tabs.ts`

```ts
import { Users, ShieldUser, FileSignature, GraduationCap } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type PeopleTabDef = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * Ansatte hub tabs per docs/design/sitemap/web/00-CANONICAL.md §3.
 *
 * Tab keys are full pathnames so PageTabNav variant="route" can drive them
 * directly. Active state is derived from pathname match.
 *
 * - Liste: master person table + status filters (Aktive/Trainee/Invitert/...)
 * - Roller: role-assignment matrix (placeholder until SM-2-followup)
 * - Kontrakter: cross-jumps to /dashboard/contracts until SM-2-followup
 *   moves it under /people/contracts. Documented temporary cross-jump.
 * - Trening: workforce readiness matrix (placeholder until SM-2-followup)
 *
 * Dropped per canonical spec:
 * - Policys: was cross-jump to /hms/governance — spec §3.3 forbids
 *   cross-group navigation tabs (one hub = one sidebar group).
 * - Innkalling: semantics moved to calendar event in Planlegging
 *   (spec §5.1). Workspace-invitation state surfaces as Invitert
 *   filter chip on Liste (spec §5.3 + §6).
 */
export const PEOPLE_TAB_DEFS: readonly PeopleTabDef[] = [
  { key: "/dashboard/people", label: "Liste", icon: Users },
  { key: "/dashboard/people/roles", label: "Roller", icon: ShieldUser },
  { key: "/dashboard/contracts", label: "Kontrakter", icon: FileSignature },
  { key: "/dashboard/people/training", label: "Trening", icon: GraduationCap },
] as const;
```

If `ShieldUser` is not exported by the installed lucide-react version, fall back to `UserCog` or `Shield` — check via `node -e "console.log(require('lucide-react').ShieldUser)"` first. If undefined, use `UserCog` (always exported).

- [ ] **Step 3: Typecheck**

`pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors. If lucide icon name was wrong, fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/_lib/people-tabs.ts
git commit -m "refactor(people): rewrite PEOPLE_TAB_DEFS to canonical 4-tab set (SM-2 phase C)

Liste · Roller · Kontrakter · Trening per spec §3. Drops Policys
cross-jump (forbidden per §3.3) and Innkalling tab (semantics moved
to Planlegging → Kalender per §5.1). Workspace-invitation state
becomes Invitert filter chip on Liste in next task.

Kontrakter still cross-jumps to /dashboard/contracts — temporary
state until SM-2-followup moves it under /people/contracts.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task C2: Add Invitert filter chip on Liste

**Files:**
- Modify: `apps/web/src/app/dashboard/people/_components/people-page-client.tsx`

Goal: surface workspace invitations as a status-filter chip with count badge. When chip is active, the data table filters to `status === "invited"` rows only.

- [ ] **Step 1: Read current people-page-client.tsx around filter chips area**

Run: `grep -n 'invitations\|statusFilter\|invited\|Invitert\|filter' apps/web/src/app/dashboard/people/_components/people-page-client.tsx | head -30`

Expected: existing invitations state + some kind of status filter. Identify the filter-chip render block (likely below the PageTabNav).

- [ ] **Step 2: Identify the chip-row primitive**

If a chip row already exists, add an "Invitert" chip following the same pattern. If not, add one inline above the data table:

```tsx
{invitations.length > 0 && (
  <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Status-filter">
    <button
      type="button"
      onClick={() => setStatusFilter(statusFilter === "invited" ? null : "invited")}
      data-active={statusFilter === "invited" ? "true" : "false"}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        statusFilter === "invited"
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
      )}
    >
      Invitert
      <span className="ml-1.5 opacity-70">{invitations.length}</span>
    </button>
  </div>
)}
```

Adjust to match the file's existing state-variable naming (`statusFilter`, `setStatusFilter`, or whatever the component uses). The chip ONLY renders when at least one invitation exists.

If `cn` is not yet imported in this file, add `import { cn } from "@smartout/ui";`.

If `statusFilter` does not yet exist as state, add `const [statusFilter, setStatusFilter] = useState<string | null>(null);` to the component's existing state block.

Filter the data table accordingly — find the `useMemo` or `.filter()` chain that derives the displayed rows and add a status-filter branch.

- [ ] **Step 3: Typecheck**

`pnpm --filter @smartout/web tsc --noEmit 2>&1 | tail -5`

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/dashboard/people/_components/people-page-client.tsx
git commit -m "feat(people): Invitert filter chip with count on Liste (SM-2 phase C)

Replaces the dropped Innkalling tab. Chip only renders when at least
one invitation exists. Filters the data table to status='invited'
rows on toggle. Matches spec §5.3 + §6 (status-as-filter principle).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If the implementer cannot identify the filter state shape in 10 minutes, report DONE_WITH_CONCERNS and surface the file's actual state structure — controller will help.

---

## Phase D — i18n

### Task D1: Append i18n keys

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

- [ ] **Step 1: Add to nb/dashboard.json**

Append (or insert alphabetically in the `people.*` block) these keys to `packages/i18n/locales/nb/dashboard.json`:

```json
"people.tab_list": "Liste",
"people.tab_roles": "Roller",
"people.tab_contracts": "Kontrakter",
"people.tab_training": "Trening",
"people.roles_coming_soon": "Roller-matrise kommer snart",
"people.training_coming_soon": "Trenings-matrise kommer snart",
"people.filter_invited": "Invitert"
```

- [ ] **Step 2: Add same keys to en/dashboard.json**

```json
"people.tab_list": "List",
"people.tab_roles": "Roles",
"people.tab_contracts": "Contracts",
"people.tab_training": "Training",
"people.roles_coming_soon": "Roles matrix coming soon",
"people.training_coming_soon": "Training matrix coming soon",
"people.filter_invited": "Invited"
```

- [ ] **Step 3: Verify JSON parses**

`node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/nb/dashboard.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('packages/i18n/locales/en/dashboard.json','utf8'))"`

Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/i18n/locales/nb/dashboard.json packages/i18n/locales/en/dashboard.json
git commit -m "i18n(people): add 7 keys for Ansatte hub tabs + filter (SM-2)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

If commitlint rejects `i18n` type, fall back to `chore(people)`.

---

## Phase E — Doc + verify

### Task E1: Mark SM-2 shipped in canonical spec

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md` (§12 migration table)

- [ ] **Step 1: Find SM-2 row**

`grep -n '| \*\*SM-2\*\*' docs/design/sitemap/web/00-CANONICAL.md`

- [ ] **Step 2: Edit row to reflect actual scope shipped**

Change from:

```markdown
| **SM-2** | Ansatte hub — add Roller / Trening / move Contracts under `/people/contracts` | M (6h) | `/people/*` |
```

To:

```markdown
| **SM-2** ✅ | Ansatte hub — Roller + Trening placeholder pages + tab rewrite (Liste · Roller · Kontrakter · Trening). Contracts URL move deferred to SM-2-followup. | M (executed ~3h) | `/people/roles`, `/people/training`, `_lib/people-tabs.ts`, `people-page-client.tsx`, i18n |
```

Then append a new row for the deferred work:

```markdown
| **SM-2-followup** | Move `/dashboard/contracts/*` → `/dashboard/people/contracts/*` with redirects. Touches 20+ existing references (API routes, drawer imports, layout deep-links, tests). | M (4h) | `/contracts/*`, `/people/contracts/*`, sidebar-config, layout.tsx |
```

- [ ] **Step 3: Commit**

```bash
git add docs/design/sitemap/web/00-CANONICAL.md
git commit -m "docs(sitemap): mark SM-2 shipped, add SM-2-followup for contracts move

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Verification Summary

Before declaring SM-2 shipped:

- [ ] `pnpm --filter @smartout/web tsc --noEmit` passes 0 errors
- [ ] Navigate `/dashboard/people` — tab strip shows: Liste · Roller · Kontrakter · Trening (4 tabs, no Policys, no Innkalling)
- [ ] Click Roller tab → lands on `/dashboard/people/roles` with "Kommer snart" body
- [ ] Click Trening tab → lands on `/dashboard/people/training` with "Kommer snart" body
- [ ] Click Kontrakter tab → cross-jumps to `/dashboard/contracts` (temporary, documented)
- [ ] On Liste tab, if invitations exist → "Invitert (N)" chip appears, toggling filters the table
- [ ] Sidebar shows Ansatte highlighted whether on Liste / Roles / Training / Contracts (composite-active already includes contracts)

Expected commit count: 7–9 commits.

---

## Out of Scope (deferred)

- **Workspace position catalog** — the hospitality job-title list (daglig-leder, restaurantsjef, kjøkkensjef, etc) currently lives inline in `ConfirmRoles.tsx` wizard step. Surfacing it elsewhere (e.g. an admin page "Definer stillinger") requires deciding whether to back it with a DB table (`workspace_position`). Tracked as SM-2-followup-positions. Not blocking SM-2.
- **Trening matrix content** — workforce readiness UI. Will reuse `protocol_assignment` + `knowledge_test` query hooks from `/dashboard/hms/training`. Tracked as SM-2-followup-training.
- **Per-role drill-in** — clicking a role on `/people/roles` could open an entity drawer or push to `/people/roles/[role]` for a filtered list. Out of SM-2 scope; the role-grouped lists rendered inline are sufficient for v1.
- **Contracts URL move** — SM-2-followup-contracts. Touches 20+ files; risk too high to bundle.
- **Contracts URL move** — SM-2-followup. Touches 20+ files; risk too high to bundle here.
- **Drill-in tab harmonization** on `/dashboard/people/[id]` — separate sortie (spec §3.3 prescribes Profil · Roller · Kontrakt · Trening · Fravær · Aktivitet; current detail page may differ).
- **Active-state highlighting on Kontrakter tab** when user is on `/dashboard/contracts` — already works via existing `compositeActive: ["/dashboard/contracts"]` on the Ansatte sidebar item; PEOPLE_TAB_DEFS pattern-match handles this if the existing `tab-nav` component already pathnames-prefix-matches.

---

## Rollback

Single revert range handles full sortie undo:

```bash
git log --oneline campaign/ui-shell ^a4da7244d -- 'apps/web/src/app/dashboard/people/' 'apps/web/src/app/dashboard/_lib/people-tabs.ts' 'packages/i18n/' | head -10
git revert <first_sha>..<last_sha>
```

New routes (`/people/roles`, `/people/training`) revert to 404. Tab strip reverts to the prior 4-tab set including Policys + Innkalling. No data lost — placeholders contain no state.
