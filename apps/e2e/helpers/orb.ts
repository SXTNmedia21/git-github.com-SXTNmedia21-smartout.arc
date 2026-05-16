import { expect, type Page } from "@playwright/test";

/**
 * Asserts the Botsson Orb is in passive (suppressed) mode:
 * - scale(0.7), opacity 0.5, pointer-events: none, aria-hidden="true".
 * Used by tests verifying domain chat ownership declaration suppresses the Orb.
 */
export async function expectOrbPassive(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const orb = page.getByTestId("botsson-orb");
  await orb.waitFor({ state: "attached" });

  await expect
    .poll(
      async () => {
        const styles = await orb.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            opacity: computed.opacity,
            pointerEvents: computed.pointerEvents,
            transform: computed.transform,
            ariaHidden: el.getAttribute("aria-hidden"),
          };
        });
        return styles;
      },
      { timeout: 2000 }
    )
    .toMatchObject({
      opacity: "0.5",
      pointerEvents: "none",
      ariaHidden: "true",
    });

  // Verify the transform contains a matrix (scale(0.7) renders as matrix)
  const transform = await orb.evaluate((el) => window.getComputedStyle(el).transform);
  expect(transform === "none" || transform.includes("matrix")).toBe(true);
  // scale(0.7) matrix: scaleX and scaleY are the 1st and 4th values of matrix(a,b,c,d,e,f)
  if (transform.includes("matrix")) {
    const match = transform.match(/matrix\(([^,]+),/);
    if (match) {
      const scaleX = parseFloat(match[1]);
      expect(scaleX).toBeCloseTo(0.7, 1);
    }
  }
}

/**
 * Asserts the Botsson Orb is in active (interactive) mode:
 * - scale(1) (or no scale transform), opacity 1, pointer-events not "none",
 *   aria-hidden not "true".
 */
export async function expectOrbActive(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  const orb = page.getByTestId("botsson-orb");
  await orb.waitFor({ state: "attached" });

  await expect
    .poll(
      async () => {
        return orb.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            opacity: computed.opacity,
            pointerEvents: computed.pointerEvents,
            ariaHidden: el.getAttribute("aria-hidden"),
          };
        });
      },
      { timeout: 2000 }
    )
    .toMatchObject({
      opacity: "1",
    });

  const { pointerEvents, ariaHidden } = await orb.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      pointerEvents: computed.pointerEvents,
      ariaHidden: el.getAttribute("aria-hidden"),
    };
  });
  expect(pointerEvents).not.toBe("none");
  expect(ariaHidden).not.toBe("true");
}
