# SM-2 — Ansatte Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Ansatte hub to match the canonical tab set `Liste · Roller · Kontrakter · Trening`. Add placeholder pages for Roller + Trening. Drop the Policys cross-jump tab. Drop the Innkalling tab (semantics moved to Planlegging → Kalender per spec §5.1). Surface workspace invitations as a status-filter chip with count badge on the Liste tab. Contracts URL move is deferred to a follow-up sortie.

**Architecture:** Two new pages (`/dashboard/people/roles` + `/dashboard/people/training`) read their content from Cascade K1a industry sources, not from empty placeholders. Per Pontus 2026-05-19: "roles + trening skal komme fra Cascade — samme som velges i Wizard". The Roller page reads from a shared `ROLE_DEFINITIONS` constant extracted from the existing `ConfirmRoles.tsx` wizard step (it currently lives inline there); Wizard imports become the canonical source. The Trening page reads procedure suggestions from the same I1 source the wizard already uses (`state.procedures` upstream — needs recon by implementer to locate the seed). PEOPLE_TAB_DEFS in `_lib/people-tabs.ts` is rewritten to four entries. The Liste tab body in `people-page-client.tsx` gains an "Invitert" filter chip with count badge.

**Tech Stack:** Next.js 16 App Router, React 19 server components, TypeScript strict, Lucide icons. No new dependencies, no migrations, no API changes.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §3 (tabs map), §5.3 (Invitasjoner-as-filter), §6 (status-as-filter principle).

**Scope deferred:** Contracts URL move (`/dashboard/contracts/*` → `/dashboard/people/contracts/*`) is SM-2-followup. The Kontrakter tab in this sortie cross-jumps to `/dashboard/contracts` — a documented temporary state until the follow-up sortie lands. This preserves all 20+ existing references to `/dashboard/contracts/*` (API routes, drawer imports, layout deep-links, tests) without modification.

---

## File Structure

| Operation | Path | Responsibility |
|---|---|---|
| Create | `packages/ai/src/industry/cascade-roles.ts` | Shared `ROLE_DEFINITIONS` + types. Extracted from `ConfirmRoles.tsx`. Wizard imports from here; Roller page imports from here. K1a-aligned location (industry-level role baseline). |
| Modify | `apps/web/src/app/onboarding/steps/ConfirmRoles.tsx` | Replace inline `ROLE_DEFINITIONS` array with `import { ROLE_DEFINITIONS } from "@smartout/ai/industry/cascade-roles"`. Behaviour unchanged. |
| Modify | `packages/ai/src/industry/index.ts` | Re-export from new `cascade-roles` module. |
| Create | `apps/web/src/app/dashboard/people/roles/page.tsx` | Roller page — renders the same role list the wizard offers. Static list now (workspace-state filter pending DB-tier sortie). |
| Create | `apps/web/src/app/dashboard/people/roles/loading.tsx` | Skeleton fallback. |
| Create | `apps/web/src/app/dashboard/people/training/page.tsx` | Trening page — placeholder body that references the cascade I1 source the wizard uses (`state.procedures`). Real list rendering deferred to followup until the seed source is located (recon task within this plan). |
| Create | `apps/web/src/app/dashboard/people/training/loading.tsx` | Skeleton. |
| Modify | `apps/web/src/app/dashboard/_lib/people-tabs.ts` | Replace PEOPLE_TAB_DEFS with new four-entry array: Liste · Roller · Kontrakter · Trening. Drop Policys + Innkalling. Update icon imports. |
| Modify | `apps/web/src/app/dashboard/people/_components/people-page-client.tsx` | Add "Invitert" filter chip with count badge above the data table. Driven by `invitations.length`. Click toggles `statusFilter === "invited"`. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Append keys: `people.tab_roles`, `people.tab_training`, `people.tab_contracts`, `people.tab_list`, `people.roles_coming_soon`, `people.training_coming_soon`, `people.filter_invited` |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same keys, English values. |

No deletions. No file moves. No URL changes outside the two new pages.

---

## Phase A — Roller (Cascade-connected)

### Task A0: Extract ROLE_DEFINITIONS to shared module

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

Renders the same role list the wizard offers. Each role shown as a card with name + description + required-badge. Workspace-specific filter (which roles selected for THIS workspace) is pending the DB-tier sortie — for now the page shows the full available catalog with a banner explaining the state.

Path: `apps/web/src/app/dashboard/people/roles/page.tsx`

```tsx
import { ShieldCheck, Info } from "lucide-react";
import { ROLE_DEFINITIONS } from "@smartout/ai/industry/cascade-roles";
import { getTranslations } from "@smartout/i18n/server";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Roller
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Roller tilgjengelig fra Setup-veiviser (Cascade K1a hospitality)</span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-mono tabular-nums">{ROLE_DEFINITIONS.length} roller</span>
          </div>
        </div>
      </div>

      {/* Banner: workspace-specific filter pending */}
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Workspace-spesifikk rolle-tildeling kommer i oppfølgings-sortie. Denne siden
          viser hele katalogen som Setup-veiviseren tilbyr.
        </p>
      </div>

      {/* Body — role catalog */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ROLE_DEFINITIONS.map((role) => (
            <div
              key={role.id}
              className="bg-card border-border rounded-2xl border p-5 shadow-sm"
              data-role-id={role.id}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-muted-foreground h-4 w-4" aria-hidden />
                  <h3 className="text-foreground text-sm font-bold tracking-tight">
                    {t(role.nameKey)}
                  </h3>
                </div>
                {role.required && (
                  <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                    Påkrevd
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-xs">{t(role.descriptionKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

If `@smartout/i18n/server` does not export `getTranslations`, fall back to the helper actually exported by the package — `grep -n 'export' packages/i18n/src/server*` to find. As a last resort, render `role.nameKey` and `role.descriptionKey` as raw strings with a `// TODO i18n wire` comment and report as DONE_WITH_CONCERNS.

If the `@smartout/ai/industry/cascade-roles` import path fails to resolve in the web app (subpath imports require `@smartout/ai` to be built — known trap from L-stage-engine-subpath-imports), ensure the ai package was built in Task A0 Step 5 before this task. If still failing, fall back to a deep import: `import { ROLE_DEFINITIONS } from "@smartout/ai/dist/industry/cascade-roles"` and flag in commit message.

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

**Pre-step: locate the I1 procedure source the wizard uses.**

`ConfirmProcedures.tsx` reads `state.procedures` — that array is seeded upstream from Cascade I1. Recon to find the seed source:

```bash
grep -rn 'procedures.*\[' apps/web/src/app/onboarding --include='*.ts' --include='*.tsx' | head -10
grep -rn 'PROCEDURE_DEFINITIONS\|procedureSuggestions\|defaultProcedures' apps/web/src apps/web/src/lib packages/ai/src --include='*.ts' | head -10
```

The seed is likely in `packages/ai/src/industry/packages/hospitality.ts` (K1a baseline) or in `apps/web/src/app/onboarding/lib/`. Identify the canonical export.

If found: this task imports from the same module the wizard's state-initialization uses.

If NOT found (seed lives in mock or local fallback): ship the Trening page as a referenced placeholder citing the path the implementer searched, plus a "Kommer snart" banner with cascade context. Report as DONE_WITH_CONCERNS naming the missing seed location.

- [ ] **Step 1: Create training/page.tsx**

Path: `apps/web/src/app/dashboard/people/training/page.tsx`

```tsx
import { GraduationCap, Info } from "lucide-react";
// If procedure-seed source is found, import it:
// import { PROCEDURE_DEFINITIONS } from "@smartout/ai/industry/cascade-procedures";

export const dynamic = "force-dynamic";

export default function TrainingPage() {
  // Replace this stub array with the actual import once cascade-procedures
  // module exists. Until then this page renders an empty list with explanatory banner.
  const procedures: Array<{ id: string; name: string; description: string; recommended: boolean }> = [];

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Trening
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Prosedyrer tilgjengelig fra Setup-veiviser (Cascade I1)</span>
            <span aria-hidden className="opacity-50">·</span>
            <span className="font-mono tabular-nums">{procedures.length} prosedyrer</span>
          </div>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Cascade I1-prosedyrer kobles inn når kilde-modulen er extracted (samme mønster
          som ROLE_DEFINITIONS i SM-2 fase A0). Workforce readiness-matrise kommer i
          oppfølgings-sortie.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {procedures.length === 0 ? (
          <div className="bg-card border-border flex h-full flex-col items-center justify-center rounded-2xl border p-12 shadow-sm">
            <GraduationCap className="text-muted-foreground mb-4 h-12 w-12" aria-hidden />
            <p className="text-muted-foreground mt-2 max-w-md text-center text-sm">
              Ingen prosedyrer å vise enda — Cascade I1-kilden må extracted først.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {procedures.map((proc) => (
              <div
                key={proc.id}
                className="bg-card border-border rounded-2xl border p-5 shadow-sm"
                data-procedure-id={proc.id}
              >
                <h3 className="text-foreground text-sm font-bold tracking-tight">{proc.name}</h3>
                <p className="text-muted-foreground mt-2 text-xs">{proc.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

This page is intentionally "almost-empty" because the procedure seed source needs to be located + extracted in a parallel sortie (out of SM-2 scope). The page is consistent with the canonical shell pattern and ready to receive real data when the cascade-procedures module is built.

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

- **Roller matrix UI** — the matrix view (who has which role) ships in a follow-up sortie. This sortie shows the role *catalog* (what roles exist), not the assignment view.
- **Workspace-scoped role filter** — requires a `workspace_role` DB table that does not yet exist. SM-2-DB-tier sortie introduces it.
- **PROCEDURE_DEFINITIONS extraction + cascade-procedures module** — parallel to A0 but harder (seed source needs location). Tracked as its own sortie. Trening page degrades gracefully until then.
- **Trening matrix content** — workforce readiness UI. Will reuse `protocol_assignment` + `knowledge_test` query hooks from `/dashboard/hms/training` when ready.
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
