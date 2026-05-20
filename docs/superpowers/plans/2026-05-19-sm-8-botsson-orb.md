---
title: SM-8 — Mr. Botsson as Persistent Orb Widget
status: in_progress
updated: 2026-05-19
created: 2026-05-19
module: ui-shell
tags: [botsson, orb, sidebar, dashboard, sm-8, canonical]
---

# SM-8 — Mr. Botsson as Persistent Orb Widget

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mount the Mr. Botsson orb widget as a persistent sidebar element — below the 11-item nav list, above the footer (Settings / Help / mode toggle) — on every dashboard page. Remove the stale autoplay reference to `/dashboard/ai` as the Botsson entry point. The orb itself (BotssonShell + BotssonOrb + BotssonProvider) already exists and is already mounted; this plan repositions and makes it also accessible from a sidebar button without adding a new route.

**Canonical spec:** `docs/design/sitemap/web/00-CANONICAL.md` §2 (sidebar wireframe), §7 (Mr. Botsson companion), §12 (migration table SM-8).

---

## Recon Summary

All recon complete. Key findings:

| Finding | Detail |
|---|---|
| `BotssonOrb.tsx` | Exists. Renders 5 statuses (idle/listening/thinking/speaking/notification). Reads from `BotssonProvider` via `useBotsson()`. Already has `data-testid="botsson-orb"` inside `BotssonShell.tsx` at line 608. |
| `BotssonShell.tsx` | Exists. Full draggable, magnetic, density-morphing float layer. Uses `position: fixed` + `z-index: 65`. Handles its own drag, resize, voice mount. ADR-0238 domain-chat passive mode already wired in (lines 611–673). |
| `EmmaOverlay.tsx` | Thin wrapper: `import { BotssonShell }` → `return <BotssonShell />`. Loaded via `dynamic({ ssr: false })` in `DashboardShell.tsx` line 63–69. |
| `BotssonHost.tsx` | Provides `BotssonProvider` scope around children. Mounted inside main content area (`<BotssonHost>{children}<EmmaOverlay /></BotssonHost>`) at DashboardShell line 1802–1805. |
| Current sidebar | Has NO Botsson entry. SM-1 correctly dropped the old `/dashboard/ai` nav item. Only stale references are: (a) autoplay step "ai" at line 879 (`selector: '[data-autoplay="nav-/dashboard/ai"]'`) and (b) `ROUTE_MISSION_MAP["/dashboard/ai"]` at line 88. |
| `/dashboard/ai` route | Still exists (`apps/web/src/app/dashboard/ai/page.tsx`). Contains AI config overview + link to `/dashboard/ai/config`. Per canonical §7 this belongs under Innstillinger → AI tab (SM-9/SM-10 scope), NOT deleted in SM-8. |
| `DomainChatOwnership.tsx` | ADR-0238 compliance complete — `useDomainChatOwnership()` consumed in `BotssonShell.tsx` line 92. Orb already suppresses to `scale(0.7) opacity(0.5) pointerEvents:none` when any page mounts `<DomainChatOwnership reason="..." />`. |
| i18n `shell.nav` | Currently has keys: `settings`, `help`, `admin_mode`, `employee_mode`. Need to add `botsson` key (orb tooltip / aria-label). |
| Voice routing | Unaffected. `BotssonOrbVoiceMount` is wired inside `BotssonShell` (line 677) and controlled by `voiceActive` state from `BotssonProvider`. Nothing changes. |

---

## What SM-8 Is (and Is Not)

**Is:**
- A sidebar button between the nav list and the footer — a **secondary tap target** that opens the BotssonShell from a predictable sidebar location.
- The orb continues to float at its current position (bottom-right by default, user-draggable). The sidebar button is a companion affordance, not a replacement for the floating orb.
- Stale autoplay step cleanup.
- i18n key addition.

**Is not:**
- A new route. No `/dashboard/botsson` page.
- A replacement for the floating BotssonShell — the shell stays fixed/floating.
- A change to `BotssonProvider` or `BotssonShell` internals.
- Moving `BotssonHost` mount point (it stays wrapping main content area per ADR-0362).
- Deleting `/dashboard/ai` or `/dashboard/ai/config` (that is SM-9/SM-10 scope).

---

## Architecture Decision

**Sidebar button → `expand()` from `useBotsson()`.**

The sidebar button needs to call `expand()` (the BotssonProvider action that transitions from `orb` to `arena` density). This requires access to `BotssonProvider` context.

**Problem:** The sidebar `<aside>` is rendered outside `<BotssonHost>` (which wraps only `{children}` + `<EmmaOverlay>` inside `<main>`). Sidebar cannot consume `useBotsson()` directly.

**Solution (two options — pick one at implementation time):**

| Option | Mechanism | Tradeoff |
|---|---|---|
| **A (preferred): `window` event bridge** | Sidebar button dispatches `window.dispatchEvent(new CustomEvent('botsson:open'))`. `BotssonShell` listens in a `useEffect` and calls `expand()`. Pattern already exists: line 118 dispatches `botsson:shift-proposal`, line 122 dispatches `botsson:schedule-view-change`. | Zero provider scope change. Consistent with existing bridge pattern. |
| **B: Hoist `BotssonHost` above `<main>`** | Move `<BotssonHost>` to wrap the entire `<div className="relative flex flex-1 overflow-hidden">` at line 1313, so sidebar is inside provider scope. | Requires moving `<EmmaOverlay>` out too — cleaner hierarchy but bigger footprint for SM-8. Better as a refactor in its own right. |

**Recommendation: Option A.** Sidebar button dispatches `botsson:open` event. `BotssonShell` listens and expands. Two-line additions in both files. Matches existing pattern; no scope hoisting risk.

---

## File Structure

| Operation | Path | Lines touched / created |
|---|---|---|
| Modify | `apps/web/src/components/dashboard/DashboardShell.tsx` | Sidebar bottom section (~1378–1433): add orb button between `</nav>` and `{/* Sidebar bottom controls */}`. Autoplay step "ai" (~879): update selector. |
| Modify | `apps/web/src/app/Botsson/_components/BotssonShell.tsx` | `useEffect` block (~433–443): add `botsson:open` listener that calls `expand()`. |
| Modify | `packages/i18n/locales/nb/dashboard.json` | `shell.nav` object: add `"botsson": "Mr. Botsson"`. |
| Modify | `packages/i18n/locales/en/dashboard.json` | Same: `"botsson": "Mr. Botsson"`. |
| Create | `apps/e2e/tests/sm-8-botsson-orb.spec.ts` | Playwright: sidebar button visible, click → BotssonShell mounts at arena density, passive mode on domain-chat page. |

No new components. No database changes. No new routes. No changes to `sidebar-config.ts`.

---

## Phase A — Orientation Read

**Files:** read-only. Verify assumptions before writing.

- [ ] **A1: Confirm BotssonShell's existing window-event listeners**

  Run: `grep -n "window\.(addEventListener\|dispatchEvent)" apps/web/src/app/Botsson/_components/BotssonShell.tsx`

  Expected: lines 217–229 (`pointerdown` on background), 248–267 (resize), 269–320 (drag), plus the two dispatch calls at 118 and 122. Confirm NO existing `botsson:open` listener — we will add it.

- [ ] **A2: Confirm sidebar bottom-controls block boundaries**

  Run: `sed -n '1377,1435p' apps/web/src/components/dashboard/DashboardShell.tsx`

  Expected: `</nav>` at ~1377, then `{/* Sidebar bottom controls */}` div at 1379, containing NavItems for Settings + Help + the admin/employee toggle. Confirm the div has `border-t` + padding classNames. This is where the orb button slot goes — between `</nav>` and the border-t div.

- [ ] **A3: Confirm autoplay step using stale selector**

  Run: `sed -n '877,884p' apps/web/src/components/dashboard/DashboardShell.tsx`

  Expected: `id: "ai"`, `label: "Open Mr. Botsson"`, `selector: '[data-autoplay="nav-/dashboard/ai"]'`, `expectedPathname: "/dashboard/ai"`. This step is stale — /dashboard/ai is no longer a nav item. The autoplay step should now target the sidebar orb button instead.

- [ ] **A4: Verify i18n shell.nav keys**

  Run: `python3 -c "import json; d=json.load(open('packages/i18n/locales/nb/dashboard.json')); print(d['shell']['nav'])"`

  Expected: `{'settings': 'Innstillinger', 'help': 'Hjelp', 'admin_mode': 'Adminmodus', 'employee_mode': 'Ansattmodus'}`. Confirms `botsson` key is missing (we add it).

- [ ] **A5: Confirm BotssonShell expand() is accessible at the call site**

  Run: `grep -n "expand\b" apps/web/src/app/Botsson/_components/BotssonShell.tsx | head -10`

  Expected: line 76 (`expand,` in useBotsson() destructure) and several call sites (click handler at ~324, ESC handler at ~438). Confirms `expand` is already in scope — event listener can call it directly.

---

## Phase B — Add Sidebar Orb Button

This phase adds the visual mount point in the sidebar, between the nav list and the footer controls.

- [ ] **B1: Add `botsson:open` event listener in BotssonShell**

  File: `apps/web/src/app/Botsson/_components/BotssonShell.tsx`

  In the existing `useEffect` block for keyboard ESC (around line 433–443), add a sibling `useEffect`:

  ```tsx
  /* ━━━ Sidebar orb button → expand ━━━ */
  useEffect(() => {
    function handleOpen() {
      if (!isOrb && !isSticky) return; // already expanded
      expand();
    }
    window.addEventListener("botsson:open" as keyof WindowEventMap, handleOpen);
    return () => window.removeEventListener("botsson:open" as keyof WindowEventMap, handleOpen);
  }, [isOrb, isSticky, expand]);
  ```

  Note: cast to `keyof WindowEventMap` is required for strict TS — matches the existing `botsson:shift-proposal` pattern. The guard `if (!isOrb && !isSticky) return` prevents re-expanding when already at arena/immersive density.

- [ ] **B2: Add sidebar orb button to DashboardShell**

  File: `apps/web/src/components/dashboard/DashboardShell.tsx`

  Insert between the closing `</nav>` tag (~line 1377) and the `{/* Sidebar bottom controls */}` div (~line 1379):

  ```tsx
  {/* Mr. Botsson — persistent orb button (SM-8, canonical §7) */}
  {/* Sits between main nav and footer controls. Dispatches botsson:open
      — BotssonShell handles expand() since it lives in BotssonProvider
      scope (ADR-0362). No route navigation. */}
  <div className={`border-t ${isSidebarCollapsed ? "px-2 py-2" : "px-2.5 py-2"} border-sidebar-border`}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="sidebar-botsson-button"
          data-autoplay="botsson-open"
          onClick={() => window.dispatchEvent(new CustomEvent("botsson:open"))}
          aria-label={t("shell.nav.botsson")}
          className={[
            "flex w-full items-center rounded-lg px-2.5 py-2 text-sm font-medium",
            "transition-colors duration-150",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            isSidebarCollapsed ? "justify-center" : "gap-2.5",
          ].join(" ")}
        >
          {/* Bot icon — Lucide, same as /dashboard/ai page */}
          <Bot className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
          {!isSidebarCollapsed && (
            <span className="truncate">{t("shell.nav.botsson")}</span>
          )}
        </button>
      </TooltipTrigger>
      {isSidebarCollapsed && (
        <TooltipContent side="right">{t("shell.nav.botsson")}</TooltipContent>
      )}
    </Tooltip>
  </div>
  ```

  **Import note:** `Bot` is already imported from `lucide-react` at the top of `DashboardShell.tsx` (confirmed — `sidebar-config.ts` uses it, and the file already imports many Lucide icons). Verify with `grep -n "^import.*lucide" apps/web/src/components/dashboard/DashboardShell.tsx`.

  If `Bot` is not already imported in DashboardShell.tsx itself (it may only be in sidebar-config.ts), add it to the existing lucide import block.

- [ ] **B3: Verify `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` are already imported**

  Run: `grep -n "TooltipProvider\|TooltipContent\|TooltipTrigger" apps/web/src/components/dashboard/DashboardShell.tsx | head -6`

  Expected: already imported — the sidebar's `<NavItem>` uses `Tooltip` for collapsed-mode labels. If missing, import from `@/components/ui/tooltip`.

- [ ] **B4: Verify `t("shell.nav.botsson")` is typed**

  The `t` function from `useTranslations("dashboard")` auto-types against the locale file. After adding the i18n key (Phase C), TypeScript will accept `t("shell.nav.botsson")`. Typecheck is the gate in Phase E.

---

## Phase C — i18n Keys

- [ ] **C1: Add `shell.nav.botsson` to Norwegian locale**

  File: `packages/i18n/locales/nb/dashboard.json`

  In the `shell.nav` object, add after `"employee_mode"`:

  ```json
  "botsson": "Mr. Botsson"
  ```

  Final `shell.nav` object:
  ```json
  "nav": {
    "settings": "Innstillinger",
    "help": "Hjelp",
    "admin_mode": "Adminmodus",
    "employee_mode": "Ansattmodus",
    "botsson": "Mr. Botsson"
  }
  ```

- [ ] **C2: Add `shell.nav.botsson` to English locale**

  File: `packages/i18n/locales/en/dashboard.json`

  Same key in `shell.nav`:
  ```json
  "botsson": "Mr. Botsson"
  ```

  Note: "Mr. Botsson" is a proper noun — no translation, identical in both locales.

---

## Phase D — Autoplay Step Cleanup

The SM-1 sortie dropped `/dashboard/ai` from the nav. The autoplay demo script still references it at line ~879. Update to target the new sidebar orb button.

- [ ] **D1: Update autoplay step `id: "ai"` in DashboardShell**

  File: `apps/web/src/components/dashboard/DashboardShell.tsx`

  Find (lines ~877–882):
  ```tsx
  {
    id: "ai",
    label: "Open Mr. Botsson",
    selector: '[data-autoplay="nav-/dashboard/ai"]',
    expectedPathname: "/dashboard/ai",
  },
  ```

  Replace with:
  ```tsx
  {
    id: "botsson",
    label: "Open Mr. Botsson",
    selector: '[data-autoplay="botsson-open"]',
    // No expectedPathname — orb opens as overlay, no route change
  },
  ```

  **Why:** The autoplay system clicks the element at `selector`, waits `waitMs` if specified, then checks `expectedPathname` if specified. The orb button dispatch causes a density change (orb → arena) but does NOT navigate. Removing `expectedPathname` tells the autoplay runner not to assert on pathname, which is correct behavior.

- [ ] **D2: Remove stale `ROUTE_MISSION_MAP["/dashboard/ai"]` entry (optional)**

  File: `apps/web/src/components/dashboard/DashboardShell.tsx`, line 88.

  ```tsx
  "/dashboard/ai": "mr-botsson",
  ```

  This entry is harmless (it still maps the `/dashboard/ai` route to `mr-botsson` mission if someone navigates there directly), but it's dead configuration since the route is scheduled for deletion in SM-10. Leave a comment instead of deleting:

  ```tsx
  "/dashboard/ai": "mr-botsson", // SM-10: delete when /ai/config moves to Innstillinger
  ```

  This is low-risk bookkeeping — implement only if the surrounding diff is clean.

---

## Phase E — Typecheck + Visual Verify

- [ ] **E1: Run typecheck**

  From campaign root:
  ```bash
  pnpm turbo typecheck --filter='@smartout/web'
  ```

  Expected: 0 errors. Common failure modes:
  - `Bot` icon not imported in `DashboardShell.tsx` → add to lucide import.
  - `t("shell.nav.botsson")` unknown key → verify `nb/dashboard.json` edit was saved correctly.
  - `CustomEvent("botsson:open")` TS strict error → cast as shown in B1.

- [ ] **E2: Local visual smoke**

  Start dev: `op run --env-file=.env.template -- pnpm --filter '@smartout/web' dev`

  Checklist:
  - [ ] Sidebar (expanded): orb button visible between nav list and Settings/Help block. Shows `Bot` icon + "Mr. Botsson" label.
  - [ ] Sidebar (collapsed): only `Bot` icon, tooltip shows "Mr. Botsson" on hover.
  - [ ] Click sidebar button → BotssonShell expands from current orb position to arena density.
  - [ ] Click button again while arena is open → no crash (guard `if (!isOrb && !isSticky) return` fires).
  - [ ] Navigate to a page with `<DomainChatOwnership>` (e.g. `/dashboard/komm/chat`) → floating orb dims to passive; sidebar button still dispatches the event but the guard in `BotssonShell` prevents re-expansion (orb is already in passive mode — this is acceptable behavior; passive mode means the page owns chat, so sidebar tap is muted).
  - [ ] Both admin and employee modes show the button (it's in the sidebar layout, not in `SIDEBAR_GROUPS_ADMIN` config — both modes share the same `<aside>` wrapper).

- [ ] **E3: Verify Nordic Split compliance**

  No hardcoded colors. Audit the new button classNames:
  - `text-sidebar-foreground` ✓ CSS variable
  - `hover:bg-sidebar-accent` ✓ CSS variable
  - `hover:text-sidebar-accent-foreground` ✓ CSS variable
  - `text-indigo-400` on the `Bot` icon — this matches the existing indigo accent used on the `/dashboard/ai` page. Per Nordic Split, brand-adjacent accent colors are allowed when consistent with the existing page they reference. No raw `oklch(...)` literal. Acceptable.
  - `focus-visible:ring-ring` ✓ CSS variable

---

## Phase F — E2E Test

- [ ] **F1: Write Playwright spec**

  File: `apps/e2e/tests/sm-8-botsson-orb.spec.ts`

  ```ts
  import { test, expect } from "@playwright/test";
  import { loginAs } from "../helpers/auth";

  test.describe("SM-8 — Botsson sidebar orb button", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "admin");
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
    });

    test("sidebar button is visible in expanded mode", async ({ page }) => {
      const btn = page.getByTestId("sidebar-botsson-button");
      await expect(btn).toBeVisible();
      await expect(btn).toHaveAttribute("aria-label", "Mr. Botsson");
    });

    test("clicking button dispatches botsson:open and expands shell", async ({ page }) => {
      const btn = page.getByTestId("sidebar-botsson-button");
      await btn.click();
      // BotssonShell renders at arena density — data-testid="botsson-orb" is
      // inside the shell; when arena is open the shell's data-testid is visible
      // at the fixed overlay position.
      const shell = page.locator('[data-testid="botsson-orb"]');
      await expect(shell).toBeVisible({ timeout: 2000 });
    });

    test("button shows icon only in collapsed sidebar", async ({ page }) => {
      // Collapse sidebar
      await page.click('[data-testid="sidebar-nav"]');  // approximate — adjust to collapse button
      // Tooltip trigger visible, text label not visible
      const btn = page.getByTestId("sidebar-botsson-button");
      await expect(btn).toBeVisible();
      const label = btn.locator("span");
      await expect(label).not.toBeVisible();
    });

    test("button appears in employee mode", async ({ page }) => {
      await page.click('[data-autoplay="admin-mode-toggle"]');
      await page.waitForTimeout(700);
      const btn = page.getByTestId("sidebar-botsson-button");
      await expect(btn).toBeVisible();
    });
  });
  ```

  Note: The collapse test (third case) may need the actual collapse button selector — confirm during implementation by checking the `<button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}>` element in the DOM.

---

## Open Decisions

| # | Question | Default if unresolved |
|---|---|---|
| **OD-1** | Should `/dashboard/ai` and `/dashboard/ai/config` survive SM-8, or get a stub redirect? | **Survive.** They are valid operator-config routes. SM-10 moves them under Innstillinger. SM-8 only drops the nav entry (already done in SM-1). |
| **OD-2** | Should the sidebar orb button show the orb's live `OrbStatus` (notification badge count)? | **No in SM-8.** Status display requires `useBotsson()` in sidebar scope, which requires Option B (scope hoist). Scope hoist is a separate refactor. The sidebar button is a nav affordance only — the floating orb shows status. |
| **OD-3** | Should clicking the sidebar button when BotssonShell is already at `arena` density collapse it (toggle)? | **No.** First click is always expand. User-expected "toggle" on a second click is a UX decision for Pontus, not part of SM-8. Guard `if (!isOrb && !isSticky) return` is correct. |
| **OD-4** | Should `indigo-400` on the `Bot` icon stay, or switch to `brand-orange` to match the orb? | **Indigo stays.** The indigo accent is the "AI/intelligence" signal established on `/dashboard/ai`. Orange is the orb's own status signal. Two different surfaces, two different accent hues — intentional. If Pontus wants orange, change is one className. |

---

## Conflicts and Non-Goals

**Potential conflict with SM-9/SM-10:**
- SM-9 moves `/dashboard/ai/config` into Innstillinger. SM-10 may delete `/dashboard/ai`. Neither touches the sidebar orb button added in SM-8. No conflict.
- If SM-10 runs first and deletes `/dashboard/ai`, the stale `ROUTE_MISSION_MAP` entry left with a comment in Phase D2 will become dead code. Clean it up at that point.

**Not in scope for SM-8:**
- Animating the sidebar button to reflect orb status (notification badge, listening pulse). Requires `useBotsson()` access in sidebar scope → Option B scope hoist.
- Adding a separate "quick chat" input in the sidebar. The orb is the chat affordance.
- Moving `BotssonHost` or `EmmaOverlay` mount points.
- Deleting `/dashboard/onboarding-assistant` (canonical §7 implies eventual deletion; that is SM-10 scope).
- Any changes to `BotssonProvider`, `BotssonArena`, `BotssonSticky`, or voice infrastructure.

---

## Sortie Checklist (close-feature gate)

Before running `close-feature.sh`:

- [ ] Typecheck passes with 0 errors (`pnpm turbo typecheck --filter='@smartout/web'`)
- [ ] Sidebar orb button visible in both expanded and collapsed states
- [ ] Click → BotssonShell opens at arena density
- [ ] ADR-0238 passive mode unaffected (domain chat ownership test page verified)
- [ ] `shell.nav.botsson` key present in `nb` and `en` locales
- [ ] Autoplay step updated to `data-autoplay="botsson-open"` with no `expectedPathname`
- [ ] E2E spec created at `apps/e2e/tests/sm-8-botsson-orb.spec.ts`
- [ ] Decision log updated if any architectural choice was made during implementation
- [ ] No hardcoded OKLCH literals or raw color values in new classNames

**Estimated effort:** S (2h per canonical §12). Two files with small edits, two i18n files, one E2E spec.
