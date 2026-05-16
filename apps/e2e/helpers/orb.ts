import { expect, type Page } from "@playwright/test";

/**
 * Asserts the Botsson Orb is in passive (suppressed) mode:
 * - scale(0.7), opacity 0.5, pointer-events: none, aria-hidden="true".
 * Used by tests verifying domain chat ownership declaration suppresses the Orb.
 *
 * All 4 dimensions live inside the same poll closure so the 300ms ease transition
 * cannot race the scale check (T6 review fix — separate post-poll evaluate could
 * silently pass when transform still read "none" on fast headless Chrome).
 */
export async function expectOrbPassive(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const orb = page.getByTestId("botsson-orb");
  await orb.waitFor({ state: "attached" });

  await expect
    .poll(
      async () => {
        const state = await orb.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          // Extract scaleX from transform matrix; null when transform is "none".
          let scaleX: number | null = null;
          if (computed.transform.startsWith("matrix")) {
            const match = computed.transform.match(/matrix\(([^,]+),/);
            if (match) scaleX = parseFloat(match[1]);
          }
          return {
            opacity: computed.opacity,
            pointerEvents: computed.pointerEvents,
            ariaHidden: el.getAttribute("aria-hidden"),
            scaleX,
          };
        });
        return {
          ...state,
          // Round to 1 decimal so 0.7 transition settles cleanly.
          scaleXRounded: state.scaleX === null ? null : Math.round(state.scaleX * 10) / 10,
        };
      },
      { timeout: 2000 },
    )
    .toMatchObject({
      opacity: "0.5",
      pointerEvents: "none",
      ariaHidden: "true",
      scaleXRounded: 0.7,
    });
}

/**
 * Asserts the Botsson Orb is in active (interactive) mode:
 * - scale(1) (or no scale transform), opacity 1, pointer-events not "none",
 *   aria-hidden not "true".
 *
 * All 3 dimensions inside same poll closure (T6 fix).
 */
export async function expectOrbActive(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const orb = page.getByTestId("botsson-orb");
  await orb.waitFor({ state: "attached" });

  await expect
    .poll(
      async () => {
        const state = await orb.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            opacity: computed.opacity,
            pointerEvents: computed.pointerEvents,
            ariaHidden: el.getAttribute("aria-hidden"),
          };
        });
        return {
          opacity: state.opacity,
          pointerEventsBlocked: state.pointerEvents === "none",
          ariaHiddenSet: state.ariaHidden === "true",
        };
      },
      { timeout: 2000 },
    )
    .toMatchObject({
      opacity: "1",
      pointerEventsBlocked: false,
      ariaHiddenSet: false,
    });
}
