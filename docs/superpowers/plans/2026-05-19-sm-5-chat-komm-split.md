---
title: SM-5 — Chat + Kommunikasjon Split
status: in_progress
created: 2026-05-19
updated: 2026-05-19
module: komm
tags: [navigation, sitemap, chat, kommunikasjon, kanaler, skranke, nyheter, varsler]
---

# SM-5 — Chat + Kommunikasjon Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote Chat to a standalone top-level route (`/dashboard/chat`). Restructure `/dashboard/komm` as a four-tab Kommunikasjon umbrella: `Kanaler · Skranke · Nyheter · Varsler`. Flip the Chat sidebar item from `disabled: true` to enabled. Mark SM-5 done in canonical spec.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §2 (11-flat sidebar), §3 (page-tabs map — Chat = single view, Kommunikasjon = four tabs), §5.2 (Varsler dual-surface), §12.

**Scope tag:** "Kun navigation" — no new data queries, no schema changes, no new DB tables. Every page in this plan shells into existing components. The only new code is routing glue, tab definitions, and i18n keys.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, `<PageTabNav variant="route">` (SM-7), `next/navigation`, Tailwind v4, shadcn/ui, `@smartout/i18n`.

**Dependency on SM-7:** This plan uses `<PageTabNav variant="route">` to render the four Kommunikasjon tabs. SM-7 adds the `variant` + `basePath` props. If SM-7 has not landed when this sortie starts, Phase E must inline a temporary route-tab strip using `<Link>` + `usePathname()` and note it for removal when SM-7 merges.

---

## Recon Findings

| Item | Finding |
|---|---|
| `/dashboard/chat` | Does **not** exist. Must be created. |
| `/dashboard/komm/chat/page.tsx` | Exists. Server component shell → `<ChatPageClient>` → `<ChatClient>`. Uses `DomainChatOwnership reason="komm-chat"` (ADR-0238). |
| `/dashboard/komm/page.tsx` | Kanaler landing. Server shell → `<KommPageClient>` → `<KanalerClient>`. |
| `/dashboard/komm/nyheter/page.tsx` | Client component, `NyheterClient`. |
| `/dashboard/komm/desks/page.tsx` | Server component (auth-gated, admin-only). Renders `<DesksClient>`. |
| `/dashboard/komm/oversikt/page.tsx` | Client component, `OversiktClient`. **Orphan** — no tab in spec. Keep as-is; do not add to tab nav. |
| `/dashboard/komm/thread/[channelId]/page.tsx` | Drill-in ticket thread. Keep as-is — it is a deep-link target from Skranke. |
| `/dashboard/notifications/page.tsx` | Full client component, 200+ LOC, uses `useNotifications` hooks, i18n via `notifications` namespace. Tools bridge at `_tools/notifications-tools-bridge`. |
| `sidebar-config.ts` line 257 | `href: "/dashboard/chat"`, `disabled: true`. The slot is already wired — only the flag changes. |
| `sidebar-config.ts` line 270 | `href: "/dashboard/komm"`, `labelKey: "sidebar.item_kommunikasjon_root"`. Unchanged by this plan. |
| `NotificationBell` in `DashboardShell.tsx` | Dynamically imported at line 71. Renders inside topbar at line 1230. Produces a sheet overlay. `<VarslerFeed>` refactor is **deferred** — bell keeps its current implementation. |
| `site-map.json` (botsson) | `/dashboard/komm` entry at line 333. `/dashboard/notifications` at line 462. Both need updates post-implementation. |
| `_components/` in komm | 38 components. `SkrankeTab.tsx` exists — its name already matches the Norwegian label. |
| SM-7 plan | `<PageTabNav>` gains `variant="route"` + `basePath` prop. This plan depends on it. |

---

## Open Decisions — Resolved

| Decision | Resolution | Rationale |
|---|---|---|
| Chat content: duplicate `/komm/chat` or redirect? | **Duplicate** — new `page.tsx` at `/dashboard/chat` wraps the same `<ChatPageClient>` component. | Spec §3 states Chat is a standalone page, not a Kommunikasjon sub-route. A redirect would send the user to `/dashboard/komm/chat`, which is wrong IA — the URL contradicts the sidebar label. |
| `DomainChatOwnership` at `/dashboard/chat` | New `page.tsx` MUST declare `<DomainChatOwnership reason="chat-standalone" />` (ADR-0238). The existing `komm/chat/page.tsx` keeps its own ownership declaration independently. | Two routes, two ownership declarations. Orb suppresses on either. |
| Skranke rename: route alias or full rename? | **Path alias via `Next.js` redirect** — keep `desks/` folder intact, add `/komm/skranke` route that redirects `307 → /dashboard/komm/desks`. The Skranke tab href = `/dashboard/komm/skranke`. | Breaking rename of `desks/` would invalidate existing deep-links, Botsson tool references in `site-map.json`, and any saved ticket URLs. Alias is zero-risk. |
| Varsler: stay at `/dashboard/notifications` or move to `/komm/varsler`? | **New `/komm/varsler/page.tsx` that mounts the same component**, plus a redirect `307` from `/dashboard/notifications` → `/dashboard/komm/varsler`. | IA consistency (all four tabs live under `/komm/`). Existing bookmarks and bell overlay `"Se alle →"` links are preserved via redirect. `site-map.json` entry updated to new canonical path. |
| Oversikt orphan (`/komm/oversikt`) | **Keep as-is, no tab.** Not in spec. Not linked from any sidebar tab. Accessed only if someone navigates directly. Defer cleanup to SM-9 orphan sweep. | SM-5 is "Kun navigation". Touching oversikt is out of scope. |
| Thread drill-in (`/komm/thread/[channelId]`) | **Keep unchanged.** Deep-link target from Skranke. Its URL is correct and matches ticket notification `action_url` values in DB. | Zero touchpoints needed. |

---

## File Structure

| Operation | Path | Responsibility |
|---|---|---|
| Create | `apps/web/src/app/dashboard/chat/page.tsx` | New top-level Chat route. Server component shell → `<ChatPageClient>` + `<DomainChatOwnership reason="chat-standalone">`. Mirrors `komm/chat/page.tsx` structure. |
| Create | `apps/web/src/app/dashboard/chat/loading.tsx` | Skeleton fallback. Mirrors `komm/chat/loading.tsx`. |
| Create | `apps/web/src/app/dashboard/komm/skranke/page.tsx` | Alias: `redirect("/dashboard/komm/desks", 307)`. One-liner. |
| Create | `apps/web/src/app/dashboard/komm/varsler/page.tsx` | Tab host. Server shell → `<Suspense>` → `<NotificationsPageClient>` (extracted from current `notifications/page.tsx`). |
| Create | `apps/web/src/app/dashboard/komm/varsler/loading.tsx` | Skeleton fallback. |
| Modify | `apps/web/src/app/dashboard/notifications/page.tsx` | Replace full component body with: `redirect("/dashboard/komm/varsler", 307)`. |
| Create | `apps/web/src/app/dashboard/komm/_lib/komm-tabs.ts` | `KOMM_TAB_DEFS` constant — four `PageTab` entries: `kanaler · skranke · nyheter · varsler`. Base path = `/dashboard/komm`. |
| Create | `apps/web/src/app/dashboard/komm/layout.tsx` | Kommunikasjon layout shell. Renders `<PageTabNav variant="route" tabs={KOMM_TAB_DEFS} basePath="/dashboard/komm">` above `{children}`. Wraps in `<main>` with page-level padding. |
| Modify | `apps/web/src/components/dashboard/sidebar-config.ts` | Flip `disabled: true` → `disabled: false` on the Chat sidebar item (line ~260 in all role variants). |
| Modify | `packages/i18n/locales/nb/dashboard.json` | Add keys: `komm.tab_kanaler`, `komm.tab_skranke`, `komm.tab_nyheter`, `komm.tab_varsler`, `sidebar.item_chat_standalone` (if missing), `chat.page_title`. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same keys, English values. |
| Modify | `apps/web/.botsson/site-map.json` | Update `/dashboard/komm` entry + add `/dashboard/chat` entry. Update `/dashboard/notifications` path to `/dashboard/komm/varsler` (or add redirect note). |

Total: 7 creates + 4 modifies. No deletions. No file moves. No URL breakage on existing routes.

---

## Phase A — New Top-Level Chat Route

**Goal:** `/dashboard/chat` exists, renders the DM + groups surface, Orb suppresses to passive (ADR-0238).

**Files:**
- Create: `apps/web/src/app/dashboard/chat/page.tsx`
- Create: `apps/web/src/app/dashboard/chat/loading.tsx`

### Task A1: Orientation read

- [ ] **Step 1: Read current komm/chat page**

Run: `cat apps/web/src/app/dashboard/komm/chat/page.tsx`

Expected: 15 LOC. Server component. `<Suspense fallback={<ChatLoading />}><ChatPageClient /></Suspense>`.

- [ ] **Step 2: Read ChatPageClient**

Run: `cat apps/web/src/app/dashboard/komm/_components/chat-page-client.tsx`

Expected: `DomainChatOwnership reason="komm-chat"` + `<ChatClient profileId={profileId} />`. Note the import path — `ChatClient` lives in `_components/`.

- [ ] **Step 3: Read komm/chat/loading**

Run: `cat apps/web/src/app/dashboard/komm/chat/loading.tsx`

Expected: skeleton or spinner. Copy pattern verbatim.

### Task A2: Create `/dashboard/chat/page.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/chat/page.tsx`

- [ ] **Step 1: Write the file**

The file content:

```tsx
import { Suspense } from "react";
import { ChatPageClient } from "@/app/dashboard/komm/_components/chat-page-client";
import ChatLoading from "./loading";

/**
 * /dashboard/chat — Standalone top-level Chat route (SM-5).
 *
 * DM + group messaging surface. Promoted from /dashboard/komm/chat to
 * a top-level sidebar slot per canonical spec §2 + §3.
 *
 * Delegates to the same <ChatPageClient> used by /dashboard/komm/chat so
 * the DM surface is identical on both routes. <DomainChatOwnership> is
 * declared inside ChatPageClient — each route that mounts it gets its
 * own ownership declaration (ADR-0238), which is correct: both routes
 * independently suppress the Botsson Orb to passive mode.
 *
 * The /dashboard/komm/chat route is kept alive for backward compatibility —
 * any saved bookmarks or notification action_url values pointing there
 * continue to work. No redirect needed.
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPageClient />
    </Suspense>
  );
}
```

Note on `DomainChatOwnership`: `ChatPageClient` already declares `<DomainChatOwnership reason="komm-chat" />`. The new route inherits this. If the reason string must differ per route, edit `chat-page-client.tsx` to accept a `reason` prop — but this is cosmetic and can be deferred. The functional requirement (Orb suppresses) is satisfied either way.

- [ ] **Step 2: Verify import path resolves**

Run: `ls apps/web/src/app/dashboard/komm/_components/chat-page-client.tsx`

Expected: file exists.

### Task A3: Create `/dashboard/chat/loading.tsx`

**Files:**
- Create: `apps/web/src/app/dashboard/chat/loading.tsx`

- [ ] **Step 1: Read source skeleton**

Run: `cat apps/web/src/app/dashboard/komm/chat/loading.tsx`

- [ ] **Step 2: Copy pattern**

Create `apps/web/src/app/dashboard/chat/loading.tsx` with the same skeleton/spinner as the source. Change any comment references from `komm/chat` to `/dashboard/chat`.

---

## Phase B — KOMM_TAB_DEFS

**Goal:** Single source of truth for the four Kommunikasjon tabs, typed with the `PageTab` generic from SM-7's `PageTabNav`.

**Files:**
- Create: `apps/web/src/app/dashboard/komm/_lib/komm-tabs.ts`

### Task B1: Write KOMM_TAB_DEFS

- [ ] **Step 1: Check if SM-7 has landed**

Run: `grep -n 'variant.*route\|basePath' apps/web/src/components/dashboard/PageTabNav.tsx | head -5`

Expected outcome A: lines found → SM-7 landed, proceed with `PageTab` import.
Expected outcome B: no output → SM-7 not yet landed. Use the inline type defined below.

- [ ] **Step 2: Write the file**

If SM-7 landed (outcome A):

```ts
/**
 * komm-tabs.ts — Kommunikasjon tab definitions (SM-5).
 *
 * Single source of truth for the four tabs in /dashboard/komm.
 * Tab order follows spec §3: workflow frequency highest → lowest.
 * Keys are URL segments: /dashboard/komm/<key>.
 */

import type { PageTab } from "@/components/dashboard/PageTabNav";
import { MessageSquare, LifeBuoy, Newspaper, Bell } from "lucide-react";

export type KommTabKey = "kanaler" | "skranke" | "nyheter" | "varsler";

/**
 * The base path that the Kommunikasjon layout appends tab keys to.
 * /dashboard/komm + "/" + key = full tab href.
 */
export const KOMM_BASE_PATH = "/dashboard/komm" as const;

export const KOMM_TAB_DEFS: PageTab<KommTabKey>[] = [
  {
    key: "kanaler",
    labelKey: "komm.tab_kanaler",
    icon: MessageSquare,
  },
  {
    key: "skranke",
    labelKey: "komm.tab_skranke",
    icon: LifeBuoy,
  },
  {
    key: "nyheter",
    labelKey: "komm.tab_nyheter",
    icon: Newspaper,
  },
  {
    key: "varsler",
    labelKey: "komm.tab_varsler",
    icon: Bell,
  },
];
```

If SM-7 NOT landed (outcome B), use an inline type and skip the import from `PageTabNav`:

```ts
/**
 * komm-tabs.ts — Kommunikasjon tab definitions (SM-5).
 * TEMP: inline PageTab type until SM-7 lands.
 */

import { MessageSquare, LifeBuoy, Newspaper, Bell } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

export type KommTabKey = "kanaler" | "skranke" | "nyheter" | "varsler";
export const KOMM_BASE_PATH = "/dashboard/komm" as const;

type PageTabInline = {
  key: KommTabKey;
  labelKey: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export const KOMM_TAB_DEFS: PageTabInline[] = [
  { key: "kanaler", labelKey: "komm.tab_kanaler", icon: MessageSquare },
  { key: "skranke", labelKey: "komm.tab_skranke", icon: LifeBuoy },
  { key: "nyheter", labelKey: "komm.tab_nyheter", icon: Newspaper },
  { key: "varsler", labelKey: "komm.tab_varsler", icon: Bell },
];
```

Icon choices are provisional — align with Nordic Split icon review before final merge.

---

## Phase C — Skranke Alias Route

**Goal:** `/dashboard/komm/skranke` works as the Skranke tab destination without breaking existing `/komm/desks` URLs.

**Files:**
- Create: `apps/web/src/app/dashboard/komm/skranke/page.tsx`

### Task C1: Write the alias

- [ ] **Step 1: Write the redirect page**

```tsx
import { redirect } from "next/navigation";

/**
 * /dashboard/komm/skranke — Norwegian-name alias for /dashboard/komm/desks (SM-5).
 *
 * "Skranke" (reception desk / front desk) is the canonical Norwegian label per
 * spec §3 + Pontus decision 2026-05-19. The /desks route is kept intact to
 * preserve all existing deep-links (notification action_url values, ticket
 * thread back-navigation, Botsson tool references). This redirect is a
 * zero-breakage alias.
 *
 * 307 Temporary redirect — signals this is a routing alias, not a permanent
 * canonical URL move. A future sortie can rename the folder and flip to 301.
 */
export default function SkrankeAlias() {
  redirect("/dashboard/komm/desks");
}
```

Note: `redirect()` in a Next.js Server Component throws `NEXT_REDIRECT`, so the function body is the entire component. No JSX needed.

- [ ] **Step 2: Verify desks route still renders**

Sanity check: `ls apps/web/src/app/dashboard/komm/desks/page.tsx` — must exist.

---

## Phase D — Varsler Tab Route + Notifications Redirect

**Goal:** Varsler tab lives at `/dashboard/komm/varsler`. Existing `/dashboard/notifications` redirects there. The bell overlay in `DashboardShell.tsx` continues working (its "Se alle →" link is the only URL that must be updated).

**Files:**
- Create: `apps/web/src/app/dashboard/komm/varsler/page.tsx`
- Create: `apps/web/src/app/dashboard/komm/varsler/loading.tsx`
- Modify: `apps/web/src/app/dashboard/notifications/page.tsx`

### Task D1: Orientation read

- [ ] **Step 1: Read existing notifications page**

Run: `head -30 apps/web/src/app/dashboard/notifications/page.tsx`

Confirm: `"use client"` directive, imports `useNotifications`, `useMarkAsRead`, etc.

- [ ] **Step 2: Find "Se alle" link in DashboardShell**

Run: `grep -n 'Se alle\|see_all\|seeAll\|notifications.*href\|href.*notifications' apps/web/src/components/dashboard/DashboardShell.tsx | head -10`

Note the line number. This link must be updated to `/dashboard/komm/varsler` in Task D3.

- [ ] **Step 3: Find "Se alle" link in NotificationBell**

Run: `grep -n 'Se alle\|see_all\|href.*notifications\|notifications.*href' apps/web/src/components/dashboard/NotificationBell.tsx 2>/dev/null | head -10`

Note the line number. Must update same link there.

### Task D2: Create `/dashboard/komm/varsler/page.tsx`

The existing `notifications/page.tsx` is a large `"use client"` component (200+ LOC). Rather than moving it, we mount it by extracting the default export into a shared client component. The canonical pattern (ADR-0115) is: server shell → Suspense → client boundary.

Strategy:

1. The existing `notifications/page.tsx` stays largely intact but its default export is renamed and re-exported from a new path. This avoids a large copy.
2. The new `/komm/varsler/page.tsx` is a server shell wrapping it.

Concretely:

- [ ] **Step 1: Rename the export in notifications/page.tsx**

The current file has `export default function NotificationsPage()`. Add a named export alias so both `notifications/page.tsx` and `komm/varsler/page.tsx` can import it:

In `apps/web/src/app/dashboard/notifications/page.tsx`, find the default export declaration. Add this line after the closing `}` of the function (or convert to named + default):

```tsx
// Named re-export for use by /komm/varsler/page.tsx (SM-5).
export { NotificationsPage as VarslerPageContent };
```

This keeps the existing default export intact (for the redirect in the next step).

- [ ] **Step 2: Write `/dashboard/komm/varsler/page.tsx`**

```tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";
import VarslerLoading from "./loading";

/**
 * /dashboard/komm/varsler — Varsler tab in Kommunikasjon (SM-5).
 *
 * Mounts the same notification feed previously at /dashboard/notifications.
 * The old route now redirects here. Bell overlay's "Se alle →" link has
 * been updated to point here.
 *
 * Client component loaded via next/dynamic with SSR disabled — mirrors the
 * "use client" boundary of NotificationsPage (it uses hooks + browser APIs).
 */

const NotificationsPageContent = dynamic(
  () =>
    import("@/app/dashboard/notifications/page").then((m) => ({
      default: m.VarslerPageContent ?? m.default,
    })),
  { ssr: false, loading: () => <VarslerLoading /> },
);

export default function VarslerPage() {
  return (
    <Suspense fallback={<VarslerLoading />}>
      <NotificationsPageContent />
    </Suspense>
  );
}
```

Alternative (simpler, if `notifications/page.tsx` can be edited freely): copy the entire component to `komm/varsler/_components/VarslerClient.tsx` and mount it. The dynamic import approach avoids duplication but adds indirection. Choose based on TypeScript strictness — if `m.VarslerPageContent` is `undefined` (named export not added correctly), the fallback to `m.default` catches it.

- [ ] **Step 3: Write `/dashboard/komm/varsler/loading.tsx`**

Mirror `apps/web/src/app/dashboard/notifications/loading.tsx` if it exists. If not, use a simple Bell skeleton:

```tsx
import { Bell } from "lucide-react";

export default function VarslerLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse p-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="text-muted-foreground/30 h-6 w-6" />
        <div className="bg-muted h-7 w-32 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

### Task D3: Replace notifications/page.tsx with redirect

- [ ] **Step 1: Replace the file body**

`apps/web/src/app/dashboard/notifications/page.tsx` must be replaced. Current content: 200+ LOC client component. New content:

```tsx
import { redirect } from "next/navigation";

/**
 * /dashboard/notifications — Redirects to canonical Varsler tab (SM-5).
 *
 * The notification feed moved to /dashboard/komm/varsler to live inside
 * the Kommunikasjon umbrella per canonical spec §3 + §5.2. This redirect
 * preserves any saved bookmarks, push-notification action_url values, and
 * bell-overlay "Se alle →" links that pre-date SM-5.
 *
 * 307 Temporary: signals routing alias. A future cleanup sortie can
 * permanently delete this file once all notification action_url rows in DB
 * have been migrated to the new path.
 */
export default function NotificationsRedirect() {
  redirect("/dashboard/komm/varsler");
}
```

IMPORTANT: Before replacing, ensure `VarslerPageContent` has been exported from the original file OR the full component has been copied to `komm/varsler/_components/VarslerClient.tsx`. Do NOT replace this file before the varsler route is functional.

- [ ] **Step 2: Update the NotificationsToolsBridge import path**

The `NotificationsToolsBridge` component is at `apps/web/src/app/dashboard/notifications/_tools/notifications-tools-bridge.tsx`. The new varsler page imports it. Check the import in the component:

Run: `grep -n 'NotificationsToolsBridge\|_tools' apps/web/src/app/dashboard/notifications/page.tsx | head -5`

The bridge import must be updated in `VarslerClient.tsx` / `VarslerPage` to use the correct path relative to the new file location.

- [ ] **Step 3: Update "Se alle →" link in NotificationBell**

Run: `grep -n 'notifications\|Se alle' apps/web/src/components/dashboard/NotificationBell.tsx | head -10`

Update any `href="/dashboard/notifications"` to `href="/dashboard/komm/varsler"`.

- [ ] **Step 4: Update "Se alle →" link in DashboardShell**

Same update: any `href="/dashboard/notifications"` → `href="/dashboard/komm/varsler"`.

---

## Phase E — Kommunikasjon Layout with Tab Nav

**Goal:** All four `/dashboard/komm/*` tab routes share a single layout that renders `<PageTabNav variant="route">` above `{children}`.

**Files:**
- Create: `apps/web/src/app/dashboard/komm/layout.tsx`

### Task E1: Check SM-7 availability

- [ ] **Step 1: Confirm PageTabNav variant prop**

Run: `grep -n 'variant\|basePath\|route' apps/web/src/components/dashboard/PageTabNav.tsx | head -10`

If lines found: SM-7 landed. Use `<PageTabNav variant="route" basePath={KOMM_BASE_PATH} tabs={KOMM_TAB_DEFS}>`.

If no lines: SM-7 pending. Use the fallback tab strip defined below.

### Task E2: Write the layout

**When SM-7 is available:**

```tsx
import { KOMM_TAB_DEFS, KOMM_BASE_PATH } from "./_lib/komm-tabs";
import { PageTabNav } from "@/components/dashboard/PageTabNav";

/**
 * /dashboard/komm layout — Kommunikasjon umbrella shell (SM-5).
 *
 * Renders the four-tab nav (Kanaler · Skranke · Nyheter · Varsler) above
 * every /dashboard/komm/* child route. Active tab is derived from pathname
 * inside PageTabNav (variant="route" mode). No client boundary here —
 * PageTabNav handles its own "use client" for usePathname().
 */
export default function KommLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-6 pt-4">
        <PageTabNav
          variant="route"
          tabs={KOMM_TAB_DEFS}
          basePath={KOMM_BASE_PATH}
          namespace="komm"
        />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

**When SM-7 is NOT available (fallback — mark with TODO comment for cleanup):**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { cn } from "@smartout/ui";
import { KOMM_TAB_DEFS, KOMM_BASE_PATH, type KommTabKey } from "./_lib/komm-tabs";

// TODO(SM-7): Replace this inline tab strip with <PageTabNav variant="route"> once SM-7 lands.
function KommTabStrip() {
  const pathname = usePathname();
  const { t } = useTranslation("komm");

  // Determine active tab from pathname.
  // /dashboard/komm → "kanaler" (default)
  // /dashboard/komm/skranke → "skranke" etc.
  const activeKey = ((): KommTabKey => {
    const segment = pathname.split("/").pop() as KommTabKey;
    const keys = KOMM_TAB_DEFS.map((t) => t.key);
    return keys.includes(segment) ? segment : "kanaler";
  })();

  return (
    <div className="border-border flex gap-1 border-b px-6 pt-4">
      {KOMM_TAB_DEFS.map((tab) => {
        const isActive = tab.key === activeKey;
        const href =
          tab.key === "kanaler" ? KOMM_BASE_PATH : `${KOMM_BASE_PATH}/${tab.key}`;
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}

export default function KommLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <KommTabStrip />
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

### Task E3: Verify layout does not double-render with existing komm structure

The existing `page.tsx` is `KommPage` (Kanaler). The layout wraps it. When the user lands on `/dashboard/komm`, the layout renders the tab strip + `KommPage` content. Verify there is no existing layout file in `komm/` that would conflict:

Run: `ls apps/web/src/app/dashboard/komm/layout.tsx 2>&1`

Expected: `No such file or directory`. If it exists, read it and merge — do not overwrite blindly.

### Task E4: Map the Kanaler tab key to the root

The Kanaler tab key is `"kanaler"` but its route is `/dashboard/komm` (not `/dashboard/komm/kanaler`). The route `/dashboard/komm/page.tsx` remains the Kanaler surface; no new route is created. The tab strip must therefore emit `href="/dashboard/komm"` for the Kanaler tab, not `/dashboard/komm/kanaler`.

In the SM-7 `<PageTabNav variant="route">` implementation, the `basePath + "/" + key` formula would produce `/dashboard/komm/kanaler` which does NOT exist. Two options:

**Option A (recommended):** Add an optional `href` override to `PageTab` type in SM-7. KOMM_TAB_DEFS sets `href: "/dashboard/komm"` on the Kanaler entry. The route variant uses `href` if present, otherwise `basePath + "/" + key`.

**Option B (fallback):** Create a `apps/web/src/app/dashboard/komm/kanaler/page.tsx` that redirects to `/dashboard/komm`. This makes the URL pattern consistent (`/komm/kanaler`) but changes the canonical Kanaler URL, which is a breaking change for bookmarks.

**Decision: Option A.** The `href` override is a minimal addition to `PageTab` type (already in SM-7's scope as `PageTab` is generic). If SM-7 has already locked the type, use Option B redirect instead. Document which was chosen in the commit message.

For the fallback tab strip (SM-7 not available): `href = tab.key === "kanaler" ? KOMM_BASE_PATH : KOMM_BASE_PATH + "/" + tab.key` — already handled in the code above.

---

## Phase F — Sidebar Config: Flip Chat Disabled Flag

**Goal:** The Chat sidebar item shows as enabled and navigates to `/dashboard/chat`.

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar-config.ts`

### Task F1: Flip the disabled flag

- [ ] **Step 1: Read the chat item context**

Run: `grep -n 'chat_standalone\|/dashboard/chat\|item_chat_standalone\|disabled.*true' apps/web/src/components/dashboard/sidebar-config.ts | head -20`

Note all lines where `disabled: true` appears adjacent to `href: "/dashboard/chat"`.

- [ ] **Step 2: Flip disabled flag on all role variants**

There are three role variant arrays in `sidebar-config.ts` (employee, manager, admin/owner). Each has a Chat entry. Find all three occurrences of the chat item with `disabled: true` and set `disabled: false`.

Pattern to find:

```ts
{
  labelKey: "sidebar.item_chat_standalone",
  href: "/dashboard/chat",
  ...
  disabled: true,
},
```

Change to `disabled: false` (or remove the `disabled` property entirely — the type definition marks it optional with implicit `false`).

- [ ] **Step 3: Verify Kommunikasjon item is unchanged**

Run: `grep -n 'item_kommunikasjon_root\|/dashboard/komm' apps/web/src/components/dashboard/sidebar-config.ts | head -10`

Expected: still present, `disabled` not set (or `false`). The Kommunikasjon entry is unaffected by SM-5.

---

## Phase G — i18n Keys

**Goal:** All new tab labels + page titles have keys in both `nb` and `en` `dashboard.json`.

**Files:**
- Modify: `packages/i18n/locales/nb/dashboard.json`
- Modify: `packages/i18n/locales/en/dashboard.json`

### Task G1: Audit existing keys

- [ ] **Step 1: Check existing komm namespace keys**

Run: `grep -n '"komm\.' packages/i18n/locales/nb/dashboard.json | head -30`

Note which keys exist. The recon found `"komm": "Kanaler"` at line 1104 in `nb/dashboard.json` — this likely maps `sidebar.item_kommunikasjon_root` or similar. Verify.

- [ ] **Step 2: Check sidebar.item_chat_standalone**

Run: `grep -n 'item_chat_standalone\|item_chat' packages/i18n/locales/nb/dashboard.json | head -5`

Expected: found at lines 680 (`item_chat`) and 721 (`item_chat_standalone`). Verify current values.

### Task G2: Add missing keys to nb/dashboard.json

Find the `"komm"` object in the file and append the tab label keys:

```json
"tab_kanaler": "Kanaler",
"tab_skranke": "Skranke",
"tab_nyheter": "Nyheter",
"tab_varsler": "Varsler"
```

Also add to the `"chat"` namespace (or `"sidebar"`) if missing:
```json
"page_title": "Chat"
```

The exact JSON path depends on the file structure. Read the file's `"komm"` key block before editing — do not guess nesting.

### Task G3: Add matching keys to en/dashboard.json

```json
"tab_kanaler": "Channels",
"tab_skranke": "Reception",
"tab_nyheter": "News",
"tab_varsler": "Notifications"
```

And `"chat": { "page_title": "Chat" }` if needed.

### Task G4: Verify no keys are missing

Run: `grep -n 'komm.tab_' packages/i18n/locales/nb/dashboard.json | head -10`

Expected: all four tab keys present.

---

## Phase H — Botsson Site-Map Update

**Goal:** `apps/web/.botsson/site-map.json` reflects the new Chat route and updated Kommunikasjon tab structure.

**Files:**
- Modify: `apps/web/.botsson/site-map.json`

### Task H1: Orientation

- [ ] **Step 1: Read the komm entry**

Run: `sed -n '330,400p' apps/web/.botsson/site-map.json`

Note the existing structure. The `/dashboard/komm` entry at line 333 needs a `tabs` array or similar indication of its four sub-routes.

- [ ] **Step 2: Read the notifications entry**

Run: `sed -n '460,490p' apps/web/.botsson/site-map.json`

Note the `"path": "/dashboard/notifications"` entry.

### Task H2: Add `/dashboard/chat` entry

Add a new site-map entry for the Chat page. Model it after `/dashboard/komm` entry structure. Key fields:

```json
{
  "path": "/dashboard/chat",
  "purpose": "Direkte meldinger og gruppechat med kolleger — uformell 1:1 og gruppekommunikasjon.",
  "owns_chat_surface": true,
  "domain_chat_endpoint": null,
  "tools": [
    {
      "name": "create_dm_channel",
      "description": "Create a 1:1 direct-message channel with another workspace member by profile_id. If the DM already exists, it returns the existing channel_id. Use when the user says 'start chat med NN', 'send DM til NN'. The caller must look up the profile_id first via the people directory."
    }
  ],
  "suggested_prompts": [
    "Start en DM med [navn]",
    "Hvem kan jeg chatte med?",
    "Åpne chat med teamet"
  ]
}
```

Note: `owns_chat_surface: true` suppresses the Botsson Orb on this page (ADR-0238). The DM surface IS the chat surface.

### Task H3: Update `/dashboard/notifications` path

Change the `"path": "/dashboard/notifications"` entry to `"path": "/dashboard/komm/varsler"`. Add a comment field noting the old path redirects.

Alternatively, add a second entry for the new path and mark the old one as `"deprecated": true` + `"redirects_to": "/dashboard/komm/varsler"`.

### Task H4: Update `/dashboard/komm` entry

Add `"tabs": ["kanaler", "skranke", "nyheter", "varsler"]` to the entry (or update the `purpose` field to mention all four tabs).

---

## Phase I — Mark SM-5 Done

**Goal:** The canonical spec marks SM-5 complete.

**Files:**
- Modify: `docs/design/sitemap/web/00-CANONICAL.md`

### Task I1: Find and update SM-5 entry

- [ ] **Step 1: Find SM-5 line**

Run: `grep -n 'SM-5\|Chat.*Kommunikasjon\|Kommunikasjon.*split' docs/design/sitemap/web/00-CANONICAL.md | head -5`

Expected: line 478 area with `| **SM-5** | Chat + Kommunikasjon split | M (4h) | ...`.

- [ ] **Step 2: Update status**

Change the status cell from pending → done (or add a `| done |` column / checkmark per the table's convention).

---

## Verification Checklist

After all phases, run these checks before declaring done:

- [ ] **TypeScript:** `pnpm turbo typecheck --filter=@smartout/web` — 0 errors.
- [ ] **Chat route exists:** `curl -s -o /dev/null -w "%{http_code}" http://localhost:3060/dashboard/chat` (after local dev start) — expect 200 or 307 (auth redirect to login is fine).
- [ ] **Kanaler still loads:** navigate to `/dashboard/komm` → Kanaler tab content visible.
- [ ] **Skranke alias:** navigate to `/dashboard/komm/skranke` → redirects to `/dashboard/komm/desks` content (307, then desks page loads).
- [ ] **Varsler tab:** navigate to `/dashboard/komm/varsler` → notification feed renders.
- [ ] **Old notifications redirect:** navigate to `/dashboard/notifications` → redirects to `/dashboard/komm/varsler`.
- [ ] **Bell overlay:** open bell in topbar → "Se alle →" links to `/dashboard/komm/varsler`.
- [ ] **Sidebar Chat enabled:** Chat item in sidebar is clickable, navigates to `/dashboard/chat`.
- [ ] **Orb suppresses on `/dashboard/chat`:** `DomainChatOwnership` is declared, Orb enters passive mode.
- [ ] **i18n:** no hardcoded Norwegian strings in new `.tsx` files — all labels use `t("komm.tab_*")`.
- [ ] **No TypeScript `any`:** new files use `unknown` + type guards where needed.

---

## Conflict Map

| Risk | Conflicting work | Mitigation |
|---|---|---|
| SM-7 not landed when SM-5 executes | Phase E + Phase B need `PageTabNav variant="route"`. | Use fallback tab strip with `TODO(SM-7)` comment. Codemod to `<PageTabNav>` when SM-7 merges. |
| SM-2-followup (Contracts URL move) | If `people/contracts` route exists, its import structure may touch sidebar-config. | SM-2-followup has zero komm touchpoints. No conflict. |
| H4 i18n merge (prior sortie: `DashboardShell` + login + `WebDayControl`) | Already merged. i18n keys under `sidebar.*` are stable. | Verify `item_chat_standalone` key exists before adding — do not duplicate. |
| HANDSOFF-ui-shell-hms-collision-fix | Known tool-name collisions include `komm/notifications`. | SM-5 creates `/komm/varsler` which moves the `NotificationsToolsBridge` — update bridge path. The `known-tool-name-collisions.json` may need updating. |
| `notifications` i18n namespace | `notifications/page.tsx` uses `useTranslation("notifications")`. When mounted under `/komm/varsler`, the same namespace is used — no change needed. | Confirm namespace string is identical in the VarslerPage mounting. |
| `desks` → `skranke` branding in `HelpDesk.tsx` and `DesksClient.tsx` | Internal component labels may still say "Helpdesk" or "Desks". | SM-5 is "Kun navigation" — no component label changes. A follow-up sortie can rename UI strings inside the components. |

---

## What This Plan Does NOT Do

These are explicitly out of scope for SM-5:

- Renaming the `desks/` folder to `skranke/` (breaking change, deferred)
- Renaming UI labels inside `DesksClient`, `HelpDesk.tsx` from "Helpdesk" to "Skranke" (follow-up sortie)
- Refactoring `<NotificationBell>` to use a shared `<VarslerFeed>` component (per spec §5.2 — deferred to a dedicated sortie)
- Creating a `/dashboard/komm/kanaler` route (spec says Kanaler = root `/komm`, no sub-path)
- Adding Botsson tool bridges to new routes — the existing tools are inherited
- Moving `/komm/oversikt` (orphan — SM-9 scope)
- Any schema changes or new DB queries
- Changing `notification.action_url` values in the database to point to `/komm/varsler` (DB migration, separate sortie)

---

## Commit Convention

All commits in this sortie follow `feat(komm): <description>`. Example:

```
feat(komm): promote /dashboard/chat top-level route (SM-5 Phase A)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Phase per commit preferred — atomic and reviewable.
