---
title: "SM-2-followup-contracts — Move /dashboard/contracts/* → /dashboard/people/contracts/*"
status: draft
created: 2026-05-19
updated: 2026-05-19
module: contracts
tags: [routing, navigation, people-hub, sortie, high-risk]
---

# SM-2-followup-contracts — Route migration plan

> **HIGHEST RISK SORTIE in the SM-2 campaign.**
> 132 hard refs across 7 distinct layers. "Kun navigation" — zero behaviour change.
> Every existing URL must survive via `redirect()`. Read this plan in full before touching a file.

---

## Executive summary

Move all 5 contract Next.js routes from `/dashboard/contracts/*` to
`/dashboard/people/contracts/*`, wiring the Kontrakter tab into the Ansatte
hub per spec §3.3 (one-hub-one-group). Install permanent `redirect()` stubs at
the old paths so every hardcoded deep-link, notification action_url, and
external bookmark continues to resolve. Update all 7 ref-layers systematically,
typecheck, then commit per phase.

Ref count by layer (from recon, 2026-05-19):

| Layer | Ref count | Note |
|---|---|---|
| `apps/web/src` in-route self-refs | 44 | Comments + href literals inside contracts dir |
| `apps/web/src` cross-refs (outside contracts) | 27 | Sidebar, layout, drawers, API routes, Botsson |
| `packages/` | 6 | `notifications/event-config.ts` (5) + `ai/mr-botsson.ts` (1) |
| `supabase/` | 17 | `_shared/event-config.ts` (5) + `contract-lifecycle/index.ts` (1) + migration SQL (6 occurrences in 1 file) + `engine_trigger` (5) |
| `apps/e2e/` | 30 | Playwright specs + protocol files |
| `apps/web/.botsson/site-map.json` | 8 | Path strings + tool descriptions |
| **Total** | **132** | |

Files to move: **40 files** across 8 route segments.

---

## Council escalation

**NOT REQUIRED.** Recon found:
- Botsson tool refs in `use-contract-detail-tools.ts`, `use-contracts-tools.ts`,
  `use-awaiting-signature-tools.ts`, `use-contract-revise-tools.ts` — these are
  **comment-only path strings** in docstrings (e.g. "navigate to
  /dashboard/contracts/[id]/revise"). The actual `router.push()` targets are
  computed from dynamic `contractId` values. After the move, docstrings update
  alongside the file (co-located); no capability boundary or ADR-0173 concern.
- `BotssonProvider.tsx` ref is a JSDoc comment explaining the event origin
  context, not a hardcoded navigation target.
- No `smartout-cascade-developer` or `smartout-agent-dev` boundary crossed.
- `packages/ai/src/prompts/mr-botsson.ts` ref is a prose description of admin
  capabilities — update the URL string, no schema change.

---

## Commit strategy

**Per-phase commits.** Each phase ends with `git commit`. Rationale: if
typecheck or a test fails mid-sortie, `git log` + `git revert HEAD~N` restores
a known-good state without unravelling everything. Do NOT squash at the end.

Convention: `refactor(contracts): <phase letter> — <one-liner>`

---

## Pre-flight checklist (run before Phase A)

```bash
cd /home/sxtnl/dev/smartout.ai-ui-shell

# 1. Verify branch
git branch --show-current
# Expected: campaign/ui-shell  (or a sub-sortie feat/contracts-move)

# 2. Working tree clean
git status --short
# Expected: clean (or only docs/ + M docs/DASHBOARD.md)

# 3. People dir exists and is writable
ls apps/web/src/app/dashboard/people/
# Expected: shows [id]/, _actions/, _components/, _hooks/, invitations/, roles/, training/

# 4. No contracts subdir already there (clean target)
ls apps/web/src/app/dashboard/people/contracts 2>/dev/null && echo "EXISTS — STOP" || echo "OK"

# 5. Baseline typecheck (must be clean before starting)
pnpm --filter @smartout/web typecheck 2>&1 | tail -5

# 6. Baseline ref count (burn this into memory)
grep -rn '/dashboard/contracts' apps/web/src --include='*.tsx' --include='*.ts' | wc -l
# Expected: 71
```

---

## Phase A — Enumerate & tag all ref categories

**Goal:** produce a working checklist so each subsequent phase can tick off
exactly its rows. This phase makes NO code changes.

```bash
# A1. Print categorised ref list
echo "=== A: CROSS-REFS (outside contracts dir) ==="
grep -rn '/dashboard/contracts' apps/web/src \
  --include='*.tsx' --include='*.ts' \
  | grep -v 'app/dashboard/contracts/' \
  | sort

echo "=== B: SELF-REFS (inside contracts dir — will move with files) ==="
grep -rn '/dashboard/contracts' apps/web/src/app/dashboard/contracts \
  --include='*.tsx' --include='*.ts' \
  | sort

echo "=== C: PACKAGES ==="
grep -rn '/dashboard/contracts' packages \
  --include='*.tsx' --include='*.ts' 2>/dev/null | sort

echo "=== D: SUPABASE ==="
grep -rn '/dashboard/contracts' supabase \
  --include='*.ts' --include='*.sql' 2>/dev/null | sort

echo "=== E: E2E ==="
grep -rn '/dashboard/contracts' apps/e2e \
  --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'reports/' | sort

echo "=== F: SITE-MAP ==="
grep -n '/dashboard/contracts' apps/web/.botsson/site-map.json | sort
```

**Deliverable:** paste the full output as a comment in the sortie Linear ticket
before writing any code. This is the audit baseline.

**Commit:** none — recon only.

---

## Phase B — `git mv` the route directory

**Goal:** physically move 40 files. No content changes.

```bash
# B1. Create destination directory scaffold
mkdir -p apps/web/src/app/dashboard/people/contracts

# B2. Move the entire contracts tree
git mv apps/web/src/app/dashboard/contracts \
       apps/web/src/app/dashboard/people/contracts

# B3. Verify
find apps/web/src/app/dashboard/people/contracts -type f | sort
# Expected: 40 files matching the old layout

# B4. Confirm old location is gone
ls apps/web/src/app/dashboard/contracts 2>/dev/null && echo "STILL EXISTS — STOP" || echo "OK"

# B5. Quick sanity — TypeScript will fail loudly here (imports broken),
#     but git status should show 40 renames, 0 deletions
git status --short | head -50
```

**Commit:**
```
refactor(contracts): B — git mv contracts → people/contracts (40 files, no content change)
```

> Do NOT run typecheck yet — Phase C fixes the imports that broke.

---

## Phase C — Fix import paths in components outside the contracts dir

Files that import FROM `@/app/dashboard/contracts/*` and now need
`@/app/dashboard/people/contracts/*`:

| File | Old import | Action |
|---|---|---|
| `apps/web/src/components/contracts/ContractDispatchDrawer.tsx` | `@/app/dashboard/contracts/_components/contract-preview-editor` | Update to `people/contracts` |
| `apps/web/src/components/contracts/CompositionDrawer.tsx` | 6 imports from `@/app/dashboard/contracts/_hooks/*` and `_components/*` | Update all 6 |
| `apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx` | `@/app/dashboard/contracts/_components/MalerTab` | Update |

**Steps:**

```bash
# C1. Bulk replace in the 3 files (sed or manual edit)
# Pattern: s|@/app/dashboard/contracts/|@/app/dashboard/people/contracts/|g

# ContractDispatchDrawer.tsx
sed -i 's|@/app/dashboard/contracts/|@/app/dashboard/people/contracts/|g' \
  apps/web/src/components/contracts/ContractDispatchDrawer.tsx

# CompositionDrawer.tsx
sed -i 's|@/app/dashboard/contracts/|@/app/dashboard/people/contracts/|g' \
  apps/web/src/components/contracts/CompositionDrawer.tsx

# settings-tabs.tsx
sed -i 's|@/app/dashboard/contracts/|@/app/dashboard/people/contracts/|g' \
  apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx

# C2. Verify — should return 0 lines
grep -n '@/app/dashboard/contracts/' \
  apps/web/src/components/contracts/ContractDispatchDrawer.tsx \
  apps/web/src/components/contracts/CompositionDrawer.tsx \
  apps/web/src/app/dashboard/settings/_components/settings-tabs.tsx
```

**Commit:**
```
refactor(contracts): C — fix component import paths after route move
```

---

## Phase D — Fix self-referencing href/push literals inside the moved files

The 40 moved files contain 44 occurrences of `/dashboard/contracts` as href
strings and `router.push/replace` targets. These are in-route references that
also need updating.

Key files and patterns:

| File (new path after B) | Pattern | Count |
|---|---|---|
| `people/contracts/page.tsx` | `router.replace('/dashboard/contracts...')`, `router.push('/dashboard/contracts/...')`, `active={pathname ?? '/dashboard/contracts'}` | 7 |
| `people/contracts/[id]/page.tsx` | `href="/dashboard/contracts"`, `href="/dashboard/contracts/[id]/revise"`, dynamic `href` with template literal | 4 |
| `people/contracts/[id]/revise/page.tsx` | `href="/dashboard/contracts/[id]"` (back link) | 1 |
| `people/contracts/new/page.tsx` | `router.replace('/dashboard/contracts?...')` | 1 |
| `people/contracts/_tools/use-contracts-tools.ts` | docstring + `router.push('/dashboard/contracts/[id]')` | ~6 |
| `people/contracts/[id]/_tools/use-contract-detail-tools.ts` | docstring + `href` template literal for revise route | ~4 |
| `people/contracts/_tools/contracts-tools-bridge.tsx` | docstring comment | 1 |
| `people/contracts/awaiting-my-signature/_tools/...` | docstring comments | ~2 |

**Steps:**

```bash
# D1. Bulk replace in ALL files under people/contracts
find apps/web/src/app/dashboard/people/contracts -type f \( -name '*.tsx' -o -name '*.ts' \) \
  -exec sed -i 's|/dashboard/contracts|/dashboard/people/contracts|g' {} +

# D2. Verify — count remaining old-path refs inside the moved dir
grep -rn '/dashboard/contracts' apps/web/src/app/dashboard/people/contracts \
  --include='*.tsx' --include='*.ts'
# Expected: 0 matches
```

> CAUTION on D1: the sed pattern is greedy — it will also hit any comment or
> string that mentions the old path inside those files, which is exactly what
> we want. Review the diff carefully: `git diff apps/web/src/app/dashboard/people/contracts/`

**Commit:**
```
refactor(contracts): D — update href/push/docstring literals inside moved route files
```

---

## Phase E — Install permanent `redirect()` stubs at the old paths

This phase keeps every external deep-link alive: notification emails,
API action_urls that haven't been updated yet in the DB, bookmarks, etc.

Create the following **5 stub files** (one per route segment):

### E1. `apps/web/src/app/dashboard/contracts/page.tsx`

```tsx
// Permanent redirect — /dashboard/contracts → /dashboard/people/contracts
// Installed as part of SM-2-followup-contracts route migration.
// Remove when all notification action_urls and external links are confirmed updated.
import { redirect } from "next/navigation";

export default function ContractsRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((s) => [k, s]) : v != null ? [[k, v]] : []
    )
  ).toString();
  redirect(qs ? `/dashboard/people/contracts?${qs}` : "/dashboard/people/contracts");
}
```

### E2. `apps/web/src/app/dashboard/contracts/[id]/page.tsx`

```tsx
// Permanent redirect — /dashboard/contracts/[id] → /dashboard/people/contracts/[id]
import { redirect } from "next/navigation";

export default function ContractDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/people/contracts/${params.id}`);
}
```

### E3. `apps/web/src/app/dashboard/contracts/[id]/revise/page.tsx`

```tsx
// Permanent redirect — /dashboard/contracts/[id]/revise → /dashboard/people/contracts/[id]/revise
import { redirect } from "next/navigation";

export default function ContractReviseRedirect({ params }: { params: { id: string } }) {
  redirect(`/dashboard/people/contracts/${params.id}/revise`);
}
```

### E4. `apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx`

```tsx
// Permanent redirect — /dashboard/contracts/awaiting-my-signature
// → /dashboard/people/contracts/awaiting-my-signature
import { redirect } from "next/navigation";

export default function AwaitingSignatureRedirect() {
  redirect("/dashboard/people/contracts/awaiting-my-signature");
}
```

### E5. `apps/web/src/app/dashboard/contracts/new/page.tsx`

```tsx
// Permanent redirect — /dashboard/contracts/new → /dashboard/people/contracts?open=compose
// Mirrors the existing in-route redirect that new/ already performed.
import { redirect } from "next/navigation";

export default function ContractsNewRedirect({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const profileId = typeof searchParams.profileId === "string" ? searchParams.profileId : undefined;
  const qs = profileId
    ? new URLSearchParams({ open: "compose", profileId }).toString()
    : "open=compose";
  redirect(`/dashboard/people/contracts?${qs}`);
}
```

**Implementation notes:**
- Each stub dir needs only `page.tsx`. Keep the existing `loading.tsx`,
  `error.tsx` co-located so partial renders don't 500 before the redirect fires.
- Do NOT remove `loading.tsx` / `error.tsx` stubs — they buffer SSR race conditions.
- These stubs do NOT need `_tools` bridges or Botsson registration.
- After writing, verify no import of anything from `people/contracts/` — stubs
  must be standalone.

**Commit:**
```
refactor(contracts): E — install redirect() stubs at old /dashboard/contracts/* paths
```

---

## Phase F — Cross-refs: sidebar-config, layout, GlobalSearchPalette, settings, people-tabs

Files outside the route tree that reference the OLD path as a string literal:

### F1. `apps/web/src/components/dashboard/sidebar-config.ts`

```ts
// BEFORE:
compositeActive: ["/dashboard/contracts"],

// AFTER:
compositeActive: ["/dashboard/people/contracts"],
```

### F2. `apps/web/src/app/dashboard/layout.tsx`

```ts
// BEFORE (line ~142):
"/dashboard/contracts",

// AFTER:
"/dashboard/people/contracts",
```

This is in the `ADMIN_ONLY_PATH_PREFIXES` array. Prefix-match logic means
`/dashboard/people/contracts` is already covered by `/dashboard/people`
which is earlier in the array — verify whether the contracts entry can be
**removed** entirely or must be kept. If `/dashboard/people` already prefix-
matches everything under people/, remove the stale contracts entry. If not,
update it.

Action: read the guard logic in `layout.tsx` before deciding:
```bash
grep -A 30 'ADMIN_ONLY_PATH_PREFIXES' apps/web/src/app/dashboard/layout.tsx | head -35
```

If the guard uses `startsWith`, and `/dashboard/people` already covers
`/dashboard/people/contracts`, **remove** the `/dashboard/contracts` entry
(cleaner, no double-match). If the array covers the old standalone path for
backwards compat (e.g. because redirect stubs live there), update it.

### F3. `apps/web/src/components/dashboard/GlobalSearchPalette.tsx`

```ts
// BEFORE:
deepLink: "/dashboard/contracts",

// AFTER:
deepLink: "/dashboard/people/contracts",
```

### F4. `apps/web/src/app/dashboard/settings/_components/employee-groups-settings.tsx`

Two occurrences — comment (line 304) and href (line 320):
```tsx
// Comment: update prose to new path
// href: update to /dashboard/people/contracts?tab=maler
```

### F5. `apps/web/src/app/dashboard/_lib/people-tabs.ts`

This is the primary goal of the whole sortie:

```ts
// BEFORE:
{ key: "/dashboard/contracts", label: "Kontrakter", icon: FileSignature },

// AFTER:
{ key: "/dashboard/people/contracts", label: "Kontrakter", icon: FileSignature },
```

Also update the JSDoc comment on line 18 to remove the "cross-jumps…until
SM-2-followup-contracts" note — replace with "points to /dashboard/people/contracts
(SM-2-followup-contracts shipped)."

### F6. `apps/web/src/components/contracts/CompositionDrawer.tsx`

One `href` pointing at the old path (line 865):
```tsx
// BEFORE:
href="/dashboard/contracts?tab=maler"

// AFTER:
href="/dashboard/people/contracts?tab=maler"
```

### F7. `apps/web/src/app/dashboard/people/[id]/page.tsx`

JSDoc comment on line 7 mentions old path — update to new path.

### F8. `apps/web/src/app/Botsson/_components/BotssonProvider.tsx`

JSDoc comment on line 929 mentions `/dashboard/contracts` — update to
`/dashboard/people/contracts`.

**Commit:**
```
refactor(contracts): F — update cross-refs in sidebar, layout, search palette, people-tabs, drawers
```

---

## Phase G — API route action_urls

Two API routes hardcode `/dashboard/contracts/awaiting-my-signature` as the
notification `action_url` for the admin-signing notification:

### G1. `apps/web/src/app/api/contracts/send/route.ts` (line 637)

```ts
// BEFORE:
action_url: "/dashboard/contracts/awaiting-my-signature",

// AFTER:
action_url: "/dashboard/people/contracts/awaiting-my-signature",
```

### G2. `apps/web/src/app/api/employment-contracts/[id]/send/route.ts` (line 389)

```ts
// BEFORE:
action_url: "/dashboard/contracts/awaiting-my-signature",

// AFTER:
action_url: "/dashboard/people/contracts/awaiting-my-signature",
```

> NOTE: the employee-facing `action_url: "/dashboard/my-contract"` in both
> files is CORRECT and must NOT be changed — that route is not moving.

**Commit:**
```
refactor(contracts): G — update API route notification action_urls to new path
```

---

## Phase H — Packages layer

### H1. `packages/notifications/src/event-config.ts` (5 occurrences)

All 5 are `action_url_template: "/dashboard/contracts"` — these are admin-
facing contract lifecycle notifications that should land on the contracts hub.
Update all 5:

```ts
// BEFORE:
action_url_template: "/dashboard/contracts",

// AFTER:
action_url_template: "/dashboard/people/contracts",
```

```bash
sed -i 's|action_url_template: "/dashboard/contracts"|action_url_template: "/dashboard/people/contracts"|g' \
  packages/notifications/src/event-config.ts

# Verify
grep -n '/dashboard/contracts' packages/notifications/src/event-config.ts
# Expected: 0 matches
```

### H2. `packages/ai/src/prompts/mr-botsson.ts` (1 occurrence, line 128)

Prose description of admin capability URLs. Update:

```ts
// BEFORE:
/dashboard/contracts (opprette)

// AFTER:
/dashboard/people/contracts (opprette)
```

**Commit:**
```
refactor(contracts): H — update packages layer (notifications event-config + mr-botsson prompt)
```

---

## Phase I — Supabase layer

> **Decision point:** The supabase layer contains hardcoded `/dashboard/contracts`
> strings in two places: a TypeScript Edge Function file and a SQL migration
> function body. See open decision OD-1 below before executing this phase.

### Recommended approach (OD-1 resolved as "update + note redirect in SQL"):

The `redirect()` stubs in Phase E mean the old URLs will resolve for any
existing DB rows. However, newly-created notifications should point to the
correct new URL. Update the TS files; for SQL, add a comment noting the redirect
covers historic rows, then add a new migration that updates the PL/pgSQL
function.

### I1. `supabase/functions/_shared/event-config.ts` (5 occurrences)

Same pattern as H1 — all `action_url_template`:

```bash
sed -i 's|action_url_template: "/dashboard/contracts"|action_url_template: "/dashboard/people/contracts"|g' \
  supabase/functions/_shared/event-config.ts

grep -n '/dashboard/contracts' supabase/functions/_shared/event-config.ts
# Expected: 0
```

### I2. `supabase/functions/contract-lifecycle/index.ts` (1 occurrence, line 148)

```ts
// BEFORE:
action_url: "/dashboard/contracts",

// AFTER:
action_url: "/dashboard/people/contracts",
```

### I3. SQL migration — new migration file for PL/pgSQL function body

The function `notify_contract_event()` in migration
`20260520120000_extend_contract_event_trigger.sql` contains 6 hardcoded
`/dashboard/contracts` strings. Since migrations are immutable, create a
**new migration** that replaces the function body with updated URLs.

New migration filename:
```
supabase/migrations/20260621000000_contract_event_trigger_url_update.sql
```

Content pattern (use `CREATE OR REPLACE FUNCTION`):
```sql
-- SM-2-followup-contracts: update notification action_urls in notify_contract_event()
-- from /dashboard/contracts to /dashboard/people/contracts.
-- The Phase E redirect() stubs in Next.js cover any historic rows in notification
-- tables that already contain the old URL.
CREATE OR REPLACE FUNCTION notify_contract_event() ...
```

Copy the full function body from `20260520120000_extend_contract_event_trigger.sql`
and replace all 6 `'/dashboard/contracts'` occurrences with
`'/dashboard/people/contracts'`. Verify the migration applies cleanly:

```bash
npx supabase db reset --local 2>&1 | tail -10
# OR for incremental:
npx supabase migration up --local 2>&1 | tail -5
```

> Do NOT edit the existing migration file — migrations are immutable once applied.

**Commit:**
```
refactor(contracts): I — update supabase EFs + new migration for PL/pgSQL function URL
```

---

## Phase J — E2E test layer (30 occurrences in 9 files)

All 30 occurrences are `page.goto('/dashboard/contracts...')` calls or
assertion URL patterns in Playwright specs. Since Phase E installs permanent
redirects, these tests will continue to PASS even without updates (redirect →
200 at new URL). However, test intent clarity demands updating to the new path.

Files to update:

| File | Refs | Action |
|---|---|---|
| `apps/e2e/tests/contracts/employee-contract-send.spec.ts` | 3 | Update goto + assertion |
| `apps/e2e/tests/contracts/employee-contract-create.spec.ts` | 2 | Update goto |
| `apps/e2e/tests/contracts/cascade-drift-observability.spec.ts` | 1 | Update goto |
| `apps/e2e/tests/e2e-contract-template-maler.spec.ts` | 1 | Update goto |
| `apps/e2e/tests/contracts/hub-redesign.spec.ts` | 3 | Update goto + URL assertions |
| `apps/e2e/tests/contracts/composition-drawer.spec.ts` | 2 | Update goto |
| `apps/e2e/tests/contracts/reverse-flow.spec.ts` | 2 | Update goto + regex |
| `apps/e2e/tests/contracts/preview-editor.spec.ts` | 2 | Update goto |
| `apps/e2e/tests/contracts/employee-contract-cancel.spec.ts` | 1 | Update goto |
| `apps/e2e/tests/contract-composition/happy-path.spec.ts` | 1 | Update goto (contracts/new → people/contracts/new) |
| `apps/e2e/protocols/p-sidebar-orphan-coverage.ts` | 6 | Update title, action, assertion, pattern strings |

```bash
# J1. Bulk replace across e2e directory
find apps/e2e -type f \( -name '*.ts' -o -name '*.tsx' \) \
  ! -path '*/reports/*' \
  -exec sed -i 's|/dashboard/contracts|/dashboard/people/contracts|g' {} +

# J2. Verify
grep -rn '/dashboard/contracts' apps/e2e \
  --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'reports/'
# Expected: 0 matches
```

> CAUTION: `reverse-flow.spec.ts` line 56 has a RegExp:
> `new RegExp('/dashboard/contracts\\?...')`. The sed pattern will update
> the string inside the RegExp correctly — verify the escaping survived:
> ```bash
> grep -n 'dashboard/people/contracts' apps/e2e/tests/contracts/reverse-flow.spec.ts
> ```

**Commit:**
```
refactor(contracts): J — update E2E test paths to new route location
```

---

## Phase K — site-map.json update

`apps/web/.botsson/site-map.json` has 8 occurrences of `/dashboard/contracts`:
4 as `"path"` values and 4 embedded in tool descriptions.

```bash
# K1. Bulk replace
sed -i 's|/dashboard/contracts|/dashboard/people/contracts|g' \
  apps/web/.botsson/site-map.json

# K2. Verify
grep -n '/dashboard/contracts' apps/web/.botsson/site-map.json
# Expected: 0 matches

# K3. Spot-check JSON validity
node -e "require('./apps/web/.botsson/site-map.json'); console.log('valid')"
```

**Commit:**
```
refactor(contracts): K — update site-map.json path strings + tool descriptions
```

---

## Phase L — Final verification sweep

```bash
# L1. Global ref count — must be 0 for non-redirect, non-docs files
echo "=== Remaining refs in web/src (excluding redirect stubs) ==="
grep -rn '/dashboard/contracts' apps/web/src \
  --include='*.tsx' --include='*.ts' \
  | grep -v 'app/dashboard/contracts/page.tsx' \
  | grep -v 'app/dashboard/contracts/\[id\]/page.tsx' \
  | grep -v 'app/dashboard/contracts/\[id\]/revise/page.tsx' \
  | grep -v 'app/dashboard/contracts/awaiting-my-signature/page.tsx' \
  | grep -v 'app/dashboard/contracts/new/page.tsx'
# Expected: 0 lines

echo "=== Redirect stubs reference new path (sanity) ==="
grep -n '/dashboard/people/contracts' \
  apps/web/src/app/dashboard/contracts/page.tsx \
  apps/web/src/app/dashboard/contracts/\[id\]/page.tsx \
  apps/web/src/app/dashboard/contracts/\[id\]/revise/page.tsx \
  apps/web/src/app/dashboard/contracts/awaiting-my-signature/page.tsx \
  apps/web/src/app/dashboard/contracts/new/page.tsx
# Expected: 1 line per file

echo "=== packages refs ==="
grep -rn '/dashboard/contracts' packages \
  --include='*.tsx' --include='*.ts' 2>/dev/null
# Expected: 0

echo "=== supabase refs ==="
grep -rn '/dashboard/contracts' supabase \
  --include='*.ts' --include='*.sql' 2>/dev/null
# Expected: 0 (old migration file immutable — may still show there but new fn replaced)

echo "=== e2e refs ==="
grep -rn '/dashboard/contracts' apps/e2e \
  --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'reports/'
# Expected: 0

echo "=== site-map refs ==="
grep -c '/dashboard/contracts' apps/web/.botsson/site-map.json
# Expected: 0
```

**L2. Typecheck:**

```bash
pnpm --filter @smartout/web typecheck 2>&1 | tail -20
# Expected: 0 errors
```

**L3. Vitest unit tests:**

```bash
pnpm --filter @smartout/web test run --reporter=verbose 2>&1 | tail -30
# Watch for: sidebar-config.test.ts + SidebarGroup.test.tsx
# These test compositeActive — they must be updated in Phase F
```

> If `sidebar-config.test.ts` fails, it means its assertion still checks
> for the old path. Update test assertions:
> ```ts
> // BEFORE:
> expect(ansatte!.compositeActive).toContain("/dashboard/contracts");
> // AFTER:
> expect(ansatte!.compositeActive).toContain("/dashboard/people/contracts");
> ```

**L4. Spot-check: unit tests in contracts dir**

```bash
pnpm --filter @smartout/web test run \
  apps/web/src/app/dashboard/people/contracts/__tests__/filters.test.ts \
  2>&1 | tail -10
# Expected: all pass (filters.test.ts has no URL refs — tests pure filter logic)
```

**Commit:**
```
refactor(contracts): L — verification green, phase complete
```

---

## Phase M — Sidebar + test consistency check (unit test update if needed)

`apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts` and
`apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx` were
identified in recon as hardcoding `/dashboard/contracts` in 6 places.

These tests are NOT in the e2e tree, so the Phase J bulk-replace did not touch
them. Update them here:

```bash
sed -i 's|/dashboard/contracts|/dashboard/people/contracts|g' \
  apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts \
  apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx

# Verify
grep -n '/dashboard/contracts' \
  apps/web/src/components/dashboard/__tests__/sidebar-config.test.ts \
  apps/web/src/components/dashboard/__tests__/SidebarGroup.test.tsx
# Expected: 0 lines

# Re-run unit tests
pnpm --filter @smartout/web test run \
  apps/web/src/components/dashboard/__tests__/ 2>&1 | tail -20
```

**Commit:**
```
refactor(contracts): M — update unit test path assertions to people/contracts
```

---

## Phase N — Mark ✅ in spec + update docs

### N1. Update canonical spec entry

Locate spec §12 ("SM-2-followup-contracts") and mark as complete:

```md
- [x] SM-2-followup-contracts | Moved /dashboard/contracts/* → /dashboard/people/contracts/* with redirects. 2026-05-19.
```

### N2. Update `apps/web/src/app/dashboard/_lib/people-tabs.ts` JSDoc

Replace the "cross-jumps…until SM-2-followup-contracts" note with:

```ts
 * - Kontrakter: /dashboard/people/contracts (SM-2-followup-contracts shipped 2026-05-19)
```

### N3. Write ADR if warranted

The route migration itself is mechanical — no new architectural decision.
However, if during Phase I you decide NOT to update the SQL migration function
(relying on redirects instead), document that as an ADR:
`ADR-0372 — Contract route redirects cover legacy DB action_urls (no SQL backfill)`.

### N4. Update DASHBOARD.md

Per `/status` discipline — update the active worktree entry for this sortie
to reflect closure state.

**Commit:**
```
docs(contracts): N — mark SM-2-followup-contracts complete in spec + update people-tabs JSDoc
```

---

## Open decisions

### OD-1 — SQL migration: update function body or rely on Phase E redirects?

**Context:** The PL/pgSQL function `notify_contract_event()` in migration
`20260520120000` hardcodes `/dashboard/contracts` in 6 places. Any notification
fired AFTER Phase E redirects are live will resolve correctly (redirect → new
URL). Any notification fired BEFORE (already in DB `notification` rows) has an
old URL — those are served via redirect too.

**Options:**

| | Option A | Option B |
|---|---|---|
| Action | Create new `CREATE OR REPLACE FUNCTION` migration | Leave SQL as-is, rely on Phase E redirect stubs |
| Pro | Forward-correct, no redirect hop for new notifications | Less code, no migration risk |
| Con | Requires DB reset + local verification; adds migration | Redirect stubs must never be removed without updating SQL |
| Recommendation | **A** — forward-correct is cleaner and the migration is low-risk boilerplate | |

**Resolution required before Phase I.**

---

### OD-2 — `/dashboard/contracts` in `ADMIN_ONLY_PATH_PREFIXES`: remove or update?

**Context:** `layout.tsx` uses prefix-matching (`startsWith`). Since
`/dashboard/people` already covers `/dashboard/people/contracts`, the
`/dashboard/contracts` entry is now only relevant for protecting the redirect
stub routes (which are still at the old path).

**Options:**

| | Option A | Option B |
|---|---|---|
| Action | Update entry to `/dashboard/people/contracts` | Remove entry (rely on `/dashboard/people` coverage) |
| Pro | Explicit | Cleaner, no duplication |
| Con | Technically redundant | Redirect stubs at old path become unprotected admin routes |

**Recommendation:** **Option B — remove** if and only if the redirect stubs
themselves are safe to be accessed by non-admins (they immediately redirect,
so no data leaks). Otherwise **Option A — update**. Confirm with a quick
check: does `ADMIN_ONLY_PATH_PREFIXES` guard these paths before redirect fires
in the middleware, or only in the layout? If in layout (client-side), removing
may be safe. If in middleware (server-side), keep the entry updated.

**Resolution required before Phase F (F2).**

---

### OD-3 — Per-phase commits or feature-branch squash at close?

**Recommendation:** keep per-phase commits on the sub-sortie branch. When
`/close-feature` runs, let `close-feature.sh` use `--no-ff` merge to
`campaign/ui-shell` — preserves phase history in campaign ancestry per ADR-0213.
Do NOT squash.

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `sed -i` bulk-replace hits a path fragment it shouldn't (e.g. `/dashboard/contracts-api`) | Low — `contracts-api` is a different path and wouldn't be in these files | Pre-verify with `grep` before sed; check diff after |
| SQL migration `CREATE OR REPLACE` breaks if function signature changed since `20260520` | Low | Copy exact signature from original migration before editing body |
| Redirect stubs removed prematurely (someone runs cleanup without reading the plan) | Medium | Add `// DO NOT REMOVE until all notification action_urls confirmed updated in DB` comment |
| E2E tests fail despite redirect (test checks exact final URL, not accepting redirect) | Low | Playwright follows redirects by default; verify with `waitForURL` assertions |
| `ADMIN_ONLY_PATH_PREFIXES` gap leaves redirect stubs unprotected | Medium | Resolve OD-2 before Phase F; add integration test for auth guard on old path |
| Notification emails sent before Phase G ship still point to old URL | Non-issue | Phase E redirects cover these for their lifetime |
| `contract-revise-tools-bridge.tsx` missing (recon shows `[id]/revise/_tools/` has it) | Check at Phase B | If it exists: moved. If not: investigate separately |

---

## File tree: what Phase B moves

```
apps/web/src/app/dashboard/contracts/          →    apps/web/src/app/dashboard/people/contracts/
├── [id]/
│   ├── _tools/
│   │   ├── contract-detail-tools-bridge.tsx
│   │   └── use-contract-detail-tools.ts
│   ├── revise/
│   │   ├── _tools/
│   │   │   ├── contract-revise-tools-bridge.tsx
│   │   │   └── use-contract-revise-tools.ts
│   │   ├── error.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── error.tsx
│   ├── loading.tsx
│   └── page.tsx
├── __tests__/
│   └── filters.test.ts
├── _components/
│   ├── AcknowledgementRing.tsx
│   ├── BindingerTab.tsx
│   ├── BlockerCounter.tsx
│   ├── BotssonAmbientChip.tsx
│   ├── ComplianceBadge.tsx
│   ├── CompositionWizard.tsx
│   ├── GhostValueCard.tsx
│   ├── KontrakterTab.tsx
│   ├── MalerTab.tsx
│   ├── ReasoningDrawer.tsx
│   ├── contract-preview-editor.tsx
│   ├── contract-send-drawer.tsx
│   ├── contracts-data-table.tsx
│   └── drift-utils.ts
├── _hooks/
│   └── use-employment-contracts.ts
├── _tools/
│   ├── contracts-tools-bridge.tsx
│   └── use-contracts-tools.ts
├── awaiting-my-signature/
│   ├── _tools/
│   │   ├── awaiting-signature-tools-bridge.tsx
│   │   └── use-awaiting-signature-tools.ts
│   ├── error.tsx
│   ├── loading.tsx
│   └── page.tsx
├── new/
│   ├── error.tsx
│   ├── loading.tsx
│   └── page.tsx
├── error.tsx
├── filters.ts
├── loading.tsx
└── page.tsx
```

After Phase E, the OLD location will contain only:
```
apps/web/src/app/dashboard/contracts/
├── [id]/
│   ├── revise/
│   │   └── page.tsx    ← redirect stub
│   └── page.tsx        ← redirect stub
├── awaiting-my-signature/
│   └── page.tsx        ← redirect stub
├── new/
│   └── page.tsx        ← redirect stub (already was a redirect)
└── page.tsx            ← redirect stub
```

Plus retained `loading.tsx` and `error.tsx` in each old-path dir (do NOT delete
these — they buffer SSR race conditions on the redirect stubs).

---

## Execution order summary

| Phase | What | Files touched | Commit |
|---|---|---|---|
| Pre-flight | Verify state | none | none |
| A | Enumerate refs | none | none |
| B | `git mv` 40 files | 40 moves | ✓ |
| C | Fix import paths in 3 external components | 3 files | ✓ |
| D | Fix href/push literals in moved files | ~8 moved files | ✓ |
| E | Install 5 redirect stubs at old paths | 5 new stubs | ✓ |
| F | Fix cross-refs in sidebar, layout, drawers, people-tabs | 8 files | ✓ |
| G | Fix API route action_urls | 2 files | ✓ |
| H | Fix packages layer | 2 files | ✓ |
| I | Fix supabase EFs + new migration | 3 files + 1 new migration | ✓ |
| J | Fix E2E tests | ~10 files | ✓ |
| K | Fix site-map.json | 1 file | ✓ |
| L | Verification sweep + typecheck | none | ✓ |
| M | Fix unit test assertions | 2 files | ✓ |
| N | Update spec + docs | 2–3 files | ✓ |

**Total commits: 13**
**Total files affected: ~120 (40 moved + 80 ref-bearing)**
**Estimated sortie duration: 3–5 hours for a careful single agent**

---

## Definition of done

- [ ] `grep -rn '/dashboard/contracts' apps/web/src packages supabase/functions` returns 0 matches outside of redirect stubs and immutable migration history
- [ ] `pnpm --filter @smartout/web typecheck` exits 0
- [ ] `pnpm --filter @smartout/web test run` exits 0 (unit tests)
- [ ] Manual smoke: navigate to `/dashboard/people` → Kontrakter tab → resolves to `/dashboard/people/contracts` without redirect flash
- [ ] Manual smoke: navigate to old `/dashboard/contracts` → redirects to `/dashboard/people/contracts`
- [ ] All 13 commits on feature branch, no squash
- [ ] OD-1 and OD-2 resolved before Phase I and Phase F respectively
- [ ] Spec §12 entry marked `[x]`
