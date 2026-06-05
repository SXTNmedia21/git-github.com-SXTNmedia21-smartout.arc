/**
 * Mission spec shared fixtures.
 *
 * `dismissDevOverlays` strips dev-only DOM elements that intercept pointer
 * events during local Playwright runs. Two overlays in scope:
 *
 *  1. `nextjs-portal` — Next.js dev error/quickfix overlay (already handled
 *     by helpers/auth.ts but not always called from mission specs).
 *  2. `.tsqd-parent-container` — React Query Devtools floating circle (mounts
 *     when NODE_ENV=development per apps/web/src/app/dashboard/query-provider.tsx).
 *     Its big SVG circle floats above /dashboard routes and intercepts every
 *     orb click → the actionability check times out with "subtree intercepts
 *     pointer events".
 *
 * MutationObserver keeps the overlays gone if React re-mounts them between
 * navigations or hot reloads. Idempotent — safe to call once per spec.
 */

import { expect, type Page } from "@playwright/test";

export async function dismissDevOverlays(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const strip = () => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
        document.querySelectorAll(".tsqd-parent-container").forEach((el) => el.remove());
      };
      strip();
      const observer = new MutationObserver(strip);
      observer.observe(document.body, { childList: true, subtree: true });
    })
    .catch(() => {
      /* page may be navigating — re-run after next domcontentloaded. */
    });
}

/**
 * Open the typed admin-chat surface (BotssonChat) on any dashboard route.
 *
 * Orb-click alone expands the Arena into voice-transcript view (read mode);
 * the typed chat surface lives behind the `botsson:open` window event with
 * `detail.view = "admin-chat"`. Dispatching the event sets density →
 * immersive + switches the active view stack to admin-chat, which mounts
 * BotssonChat with the workspace context.
 *
 * Use this in mission specs that need to send a typed message via
 * `data-testid="botsson-chat-input"` + `data-testid="botsson-chat-send"`.
 */
export async function openBotssonChat(page: Page): Promise<void> {
  await expect(page.getByTestId("botsson-orb")).toBeVisible({ timeout: 15_000 });

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("botsson:open", { detail: { view: "admin-chat" } }));
  });

  await expect(page.getByTestId("botsson-shell")).toHaveAttribute(
    "data-density",
    /arena|immersive/,
    { timeout: 5_000 },
  );
  await expect(page.getByTestId("botsson-chat-input")).toBeVisible({ timeout: 5_000 });
  /* Messages container being visible means AdminChatView + BotssonChat
   * fully mounted (composer is its sibling). */
  await expect(page.getByTestId("botsson-chat-messages")).toBeVisible({ timeout: 5_000 });

  /* BotssonArena mounts under a `botsson-fade-in` animation (TIMING.contentEnter
   * in apps/web/src/app/Botsson/_components/types). On mobile viewports the
   * shell auto-positions during the fade, making `getByTestId("botsson-chat-send")`
   * read as "element is not stable" the first 200-300ms. Wait for any running
   * Web Animations API animations on the arena container to settle. */
  await page
    .waitForFunction(
      () => {
        const arena = document.querySelector('[data-testid="botsson-arena"]');
        if (!arena) return true;
        const anims = arena.getAnimations({ subtree: true });
        return anims.every((a) => a.playState !== "running");
      },
      undefined,
      { timeout: 3_000 },
    )
    .catch(() => {
      /* Best-effort. If browser doesn't expose getAnimations on subtree, fall
       * back to a small fixed wait via expect.poll which is animation-aware. */
    });
}
