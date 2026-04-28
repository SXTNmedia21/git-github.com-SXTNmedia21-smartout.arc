/**
 * help-accessibility.spec.ts
 *
 * Validates accessibility invariants on /dashboard/help:
 *   I-1: prefers-reduced-motion → zero looping animations
 *   I-3: 400% zoom (320×800 viewport) → no horizontal overflow
 *   axe-core: 0 critical violations (skipped until axe is installed — M1.5 follow-up)
 *   I-5: TtsButton present in curated article rows; NO mic/voice-input button on the page
 *
 * Auth: loginAsAdmin from seed (admin@smartout.local / password123).
 * axe-core NOT installed in apps/e2e/package.json — that test is marked skip.
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../helpers/auth";

// ---------------------------------------------------------------------------
// I-1: prefers-reduced-motion → zero infinite/looping animations
// ---------------------------------------------------------------------------
test("I-1: reduced motion disables looping animations", async ({ browser }) => {
  // Create a context that reports prefers-reduced-motion: reduce
  const context = await browser.newContext({
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  try {
    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Check that no visible element has an infinite animation-iteration-count.
    // animate-pulse-infinite and CSS spinner classes both rely on iteration-count: infinite.
    const infiniteAnimationCount = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      let count = 0;
      for (const el of all) {
        const style = window.getComputedStyle(el);
        // Skip elements that are not rendered (display:none / visibility:hidden)
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (style.animationIterationCount === "infinite") {
          count++;
        }
      }
      return count;
    });

    expect(
      infiniteAnimationCount,
      `Found ${infiniteAnimationCount} element(s) with infinite animation while prefers-reduced-motion:reduce is active`,
    ).toBe(0);
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------
// I-3: 400% zoom — no horizontal overflow
// ---------------------------------------------------------------------------
test("I-3: 400% zoom produces no horizontal overflow", async ({ browser }) => {
  // WCAG 1.4.10 Reflow: 320 CSS px wide = effectively 1280 logical px at 400% zoom
  const context = await browser.newContext({
    viewport: { width: 320, height: 800 },
  });
  const page = await context.newPage();

  try {
    await loginAsAdmin(page);
    await page.goto("/dashboard/help");
    await page.waitForLoadState("networkidle");

    // Simulate 400% browser zoom via CSS zoom property on <html>.
    // This is the most reliable cross-browser equivalent in Playwright.
    await page.evaluate(() => {
      (document.documentElement as HTMLElement).style.zoom = "4";
    });

    // Allow layout to settle after zoom
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(() => {
      // scrollWidth > innerWidth (with 16px slack for scrollbar/rounding)
      return document.body.scrollWidth - window.innerWidth;
    });

    expect(
      overflow,
      `Horizontal overflow at 400% zoom: body.scrollWidth exceeds window.innerWidth by ${overflow}px (max allowed: 16px)`,
    ).toBeLessThanOrEqual(16);
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------
// axe-core: 0 critical violations
// axe-core is NOT installed in apps/e2e/package.json.
// TODO M1.5: add @axe-core/playwright to apps/e2e, then remove the skip.
// ---------------------------------------------------------------------------
test.skip("axe-core: 0 critical violations (axe-core not installed yet — M1.5 follow-up)", async ({
  page,
}) => {
  // Once @axe-core/playwright is installed, replace this block with:
  //
  //   import AxeBuilder from "@axe-core/playwright";
  //   await loginAsAdmin(page);
  //   await page.goto("/dashboard/help");
  //   await page.waitForLoadState("networkidle");
  //   const results = await new AxeBuilder({ page }).analyze();
  //   const critical = results.violations.filter((v) => v.impact === "critical");
  //   expect(critical).toHaveLength(0);
  void page; // keep the param referenced for linter
});

// ---------------------------------------------------------------------------
// I-5: TtsButton present; voice INPUT absent
// ---------------------------------------------------------------------------
test("I-5: TTS button present in curated articles, no voice input on help page", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto("/dashboard/help");
  await page.waitForLoadState("networkidle");

  // --- TTS: at least one TtsButton must be present inside the curated-articles list ---
  // TtsButton renders as a <button> with aria-label containing "les opp"/"tts"/"play"
  // or a data-testid="tts-button". We use a broad selector set so the test doesn't
  // break if the label copy changes slightly.
  const ttsButton = page
    .locator(
      [
        '[data-testid="tts-button"]',
        'button[aria-label*="les opp" i]',
        'button[aria-label*="tts" i]',
        'button[aria-label*="play article" i]',
        'button[aria-label*="lytt" i]',
        'button[title*="tts" i]',
        'button[title*="les opp" i]',
      ].join(", "),
    )
    .first();

  await expect(
    ttsButton,
    "Expected at least one TtsButton in the CuratedArticlesList on /dashboard/help",
  ).toBeVisible({ timeout: 10_000 });

  // --- Voice INPUT: NO mic / microphone button anywhere on the page ---
  // /dashboard/help uses Runtime A (text-only). A microphone button would indicate
  // a voice-input channel is erroneously exposed here.
  const micButton = page.locator(
    [
      '[data-testid="mic-button"]',
      '[data-testid="voice-input"]',
      'button[aria-label*="mikrofon" i]',
      'button[aria-label*="microphone" i]',
      'button[aria-label*="voice input" i]',
      'button[aria-label*="stem" i]',
      'button[title*="mic" i]',
      'button[title*="microphone" i]',
    ].join(", "),
  );

  const micCount = await micButton.count();
  expect(
    micCount,
    `Found ${micCount} microphone/voice-input button(s) on /dashboard/help — Runtime A must be text-only`,
  ).toBe(0);
});
