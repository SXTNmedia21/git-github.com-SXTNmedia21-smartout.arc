/**
 * people-perf-baseline.ts
 *
 * Why: Measure real LCP/CLS/TTI/INP cold + warm for /dashboard/people
 * using Playwright CDP — without Lighthouse CLI. Captures skeleton-flash
 * screenshots (mid-skeleton + post-load) for visual CLS verification.
 *
 * Auth: Uses admin@smartout.local / password123 (same identity as E2E suite).
 * Portal host: app.localhost:3060 — matches middleware subdomain detection.
 *
 * Output: /tmp/people-perf-baseline.json
 * Screenshots: /tmp/people-cold-skeleton.png, /tmp/people-cold-loaded.png
 *
 * Run: pnpm tsx apps/e2e/scripts/people-perf-baseline.ts
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Constants — mirror auth-invitation.ts values exactly
// ---------------------------------------------------------------------------

const CHROMIUM_PATH = path.join(
  process.env.HOME ?? "/home/sxtnl",
  ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
);

// Use 127.0.0.1 (not app.localhost) — same as auth.ts loginAsAdmin.
// 127.0.0.1 maps to "root" subdomain type in middleware, so it bypasses
// the portal /select-workspace redirect. The schedule page still loads
// because DashboardLayout reads workspace_id from session cookie.
// See comment in auth-invitation.ts PORTAL_BASE re: Q19 council verdict.
const PORTAL_BASE = "http://127.0.0.1:3060";
const PEOPLE_PATH = "/dashboard/people";
const DASHBOARD_PATH = "/dashboard";

const ADMIN_EMAIL = "admin@smartout.local";
const ADMIN_PASSWORD = "password123";

const OUTPUT_JSON = "/tmp/people-perf-baseline.json";
const SCREENSHOT_COLD_SKELETON = "/tmp/people-cold-skeleton.png";
const SCREENSHOT_COLD_LOADED = "/tmp/people-cold-loaded.png";
const SCREENSHOT_WARM_LOADED = "/tmp/people-warm-loaded.png";

// ---------------------------------------------------------------------------
// Supabase env resolution — mirrors global-setup.ts approach
// ---------------------------------------------------------------------------

function resolveSupabaseEnv(): void {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const out = execSync("npx supabase status -o env", {
      cwd: path.resolve(__dirname, "../.."),
      encoding: "utf-8",
    });
    for (const line of out.split("\n")) {
      const m = line.match(/^([A-Z_]+)="([^"]*)"$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === "API_URL") process.env.NEXT_PUBLIC_SUPABASE_URL ??= v;
      if (k === "SERVICE_ROLE_KEY") process.env.SUPABASE_SERVICE_ROLE_KEY ??= v;
      if (k === "ANON_KEY") process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= v;
    }
  } catch {
    console.warn("[perf-baseline] Could not resolve Supabase env from CLI.");
  }
}

// ---------------------------------------------------------------------------
// Auth helpers — mirrors auth.ts + auth-invitation.ts approach
// ---------------------------------------------------------------------------

async function dismissDevOverlay(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      const observer = new MutationObserver(() => {
        document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.querySelectorAll("nextjs-portal").forEach((el) => el.remove());
    })
    .catch(() => {});
}

async function loginAdmin(page: Page): Promise<void> {
  console.log("[auth] Navigating to login...");
  await page.goto(`${PORTAL_BASE}/login`, { waitUntil: "domcontentloaded" });
  await dismissDevOverlay(page);

  // Click password tab if present (Wave C7 may have changed default)
  const passwordTab = page.getByRole("button", { name: "E-post og passord", exact: true });
  if (await passwordTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await passwordTab.click().catch(() => {});
  }

  await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
  await dismissDevOverlay(page);

  let reached = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.locator('button[type="submit"]').first().click({ force: true });
    try {
      await page.waitForURL(/\/(dashboard|select-workspace|welcome|onboarding|setup)/, {
        timeout: 15_000,
      });
      reached = true;
      break;
    } catch {
      await page.waitForTimeout(1200);
    }
  }

  if (!reached) {
    throw new Error(`[auth] Login did not reach an authenticated route. URL: ${page.url()}`);
  }

  // With 127.0.0.1 base, middleware treats us as "root" subdomain —
  // no portal /select-workspace redirect. The page lands directly on
  // /dashboard or /onboarding/setup. If we somehow hit select-workspace
  // or welcome, skip them via direct navigate.
  const finalUrl = page.url();
  if (finalUrl.includes("select-workspace") || finalUrl.includes("/welcome")) {
    console.log(`[auth] Unexpected redirect to ${finalUrl}, forcing dashboard...`);
    await page.goto(`${PORTAL_BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 }).catch(() => {});
  }

  // Handle onboarding wizard if present — mirrors auth.ts skipOnboardingIfPresent
  if (page.url().includes("/setup") || page.url().includes("/onboarding")) {
    const skipBtn = page.getByRole("button", { name: "Hopp over og gå til dashboard" });
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click().catch(() => {});
      await page.waitForURL(/\/dashboard/, { timeout: 10_000 }).catch(() => {});
    } else {
      await page.goto(`${PORTAL_BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    }
  }

  console.log(`[auth] Authenticated. URL: ${page.url()}`);
}

// ---------------------------------------------------------------------------
// CDP Performance capture
// ---------------------------------------------------------------------------

type PerfMetrics = {
  lcp_ms: number | null;
  cls: number | null;
  tti_ms: number | null;
  inp_ms: number | null;
  dom_content_loaded_ms: number | null;
  load_event_end_ms: number | null;
  js_bundle_kb: number | null;
  navigation_start_epoch: number | null;
};

async function captureMetrics(page: Page, label: string): Promise<PerfMetrics> {
  console.log(`[metrics:${label}] Injecting performance observers...`);

  // Inject PerformanceObserver before navigation
  await page.addInitScript(() => {
    // Storage for observed entries
    (window as unknown as Record<string, unknown>).__perfEntries = {
      lcp: [] as PerformanceEntry[],
      cls: 0 as number,
      inp: null as number | null,
      firstInputDelay: null as number | null,
    };

    const perf = (window as unknown as Record<string, unknown>).__perfEntries as {
      lcp: PerformanceEntry[];
      cls: number;
      inp: number | null;
      firstInputDelay: number | null;
    };

    // LCP observer
    try {
      const lcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          perf.lcp.push(entry);
        }
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // LCP not supported
    }

    // CLS observer
    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!ls.hadRecentInput) {
            perf.cls = (perf.cls as number) + ls.value;
          }
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch {
      // CLS not supported
    }

    // INP / FID observer
    try {
      const inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { processingStart: number; duration: number };
          const delay = e.processingStart - e.startTime;
          if (perf.firstInputDelay === null || delay > (perf.firstInputDelay ?? 0)) {
            perf.firstInputDelay = delay;
          }
          if (perf.inp === null || e.duration > (perf.inp ?? 0)) {
            perf.inp = e.duration;
          }
        }
      });
      // Try INP first, fall back to first-input
      try {
        inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {
        inpObs.observe({ type: "first-input", buffered: true });
      }
    } catch {
      // Not supported
    }
  });

  return collectMetricsAfterLoad(page, label);
}

async function collectMetricsAfterLoad(page: Page, label: string): Promise<PerfMetrics> {
  // Wait for page to settle (network idle + a bit more for React hydration)
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    console.warn(`[metrics:${label}] networkidle timeout — using current state`);
  });
  await page.waitForTimeout(1500); // Allow LCP + CLS observers to finalize

  // Dispatch a synthetic click to trigger INP measurement
  await page
    .evaluate(() => {
      document.body.click();
    })
    .catch(() => {});
  await page.waitForTimeout(200);

  // Read Navigation Timing API
  const navTiming = await page
    .evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as
        | (PerformanceNavigationTiming & { startTime: number })
        | undefined;
      if (!nav) return null;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadEventEnd: nav.loadEventEnd - nav.startTime,
        domInteractive: nav.domInteractive - nav.startTime,
        navigationStart: nav.startTime,
      };
    })
    .catch(() => null);

  // Read observed entries
  const observed = await page
    .evaluate(() => {
      const perf = (window as unknown as Record<string, unknown>).__perfEntries as
        | {
            lcp: Array<{ startTime: number }>;
            cls: number;
            inp: number | null;
            firstInputDelay: number | null;
          }
        | undefined;
      if (!perf) return null;
      const lastLcp = perf.lcp.length > 0 ? perf.lcp[perf.lcp.length - 1] : null;
      return {
        lcp: lastLcp ? lastLcp.startTime : null,
        cls: perf.cls,
        inp: perf.inp,
        fid: perf.firstInputDelay,
      };
    })
    .catch(() => null);

  // Measure JS bundle size from resource timing
  const jsBundleKb = await page
    .evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      let totalBytes = 0;
      for (const r of resources) {
        if (r.initiatorType === "script" && r.encodedBodySize > 0) {
          totalBytes += r.encodedBodySize;
        }
      }
      return totalBytes > 0 ? Math.round(totalBytes / 1024) : null;
    })
    .catch(() => null);

  // Derive TTI from domInteractive (best available in 1-shot mode without Lighthouse)
  const ttiMs = navTiming?.domInteractive ?? null;

  // INP: prefer observed INP duration, fall back to FID, fall back to synthetic click timing
  let inpMs: number | null = observed?.inp ?? observed?.fid ?? null;

  // If no INP from observer, use synthetic click timing via CDP
  if (inpMs === null) {
    try {
      const startTime = Date.now();
      await page.evaluate(() => {
        document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      // Wait one animation frame
      await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
      inpMs = Date.now() - startTime;
    } catch {
      inpMs = null;
    }
  }

  const metrics: PerfMetrics = {
    lcp_ms: observed?.lcp ? Math.round(observed.lcp) : null,
    cls: observed ? Math.round((observed.cls ?? 0) * 1000) / 1000 : null,
    tti_ms: ttiMs ? Math.round(ttiMs) : null,
    inp_ms: inpMs ? Math.round(inpMs) : null,
    dom_content_loaded_ms: navTiming?.domContentLoaded
      ? Math.round(navTiming.domContentLoaded)
      : null,
    load_event_end_ms: navTiming?.loadEventEnd ? Math.round(navTiming.loadEventEnd) : null,
    js_bundle_kb: jsBundleKb,
    navigation_start_epoch: null, // populated by caller
  };

  console.log(`[metrics:${label}]`, JSON.stringify(metrics, null, 2));
  return metrics;
}

// ---------------------------------------------------------------------------
// Cold pass
// ---------------------------------------------------------------------------

async function runColdPass(
  browser: Browser,
): Promise<{ metrics: PerfMetrics; context: BrowserContext; page: Page }> {
  console.log("\n=== COLD PASS ===");

  // Fresh context — no stored cookies/cache
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    // Viewport matching Playwright Desktop Chrome
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Setup metrics observer before login (addInitScript applies to all pages)
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__perfEntries = {
      lcp: [],
      cls: 0,
      inp: null,
      firstInputDelay: null,
    };

    const perf = (window as unknown as Record<string, unknown>).__perfEntries as {
      lcp: PerformanceEntry[];
      cls: number;
      inp: number | null;
      firstInputDelay: number | null;
    };

    try {
      const lcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.lcp.push(entry);
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* */
    }

    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!ls.hadRecentInput) (perf.cls as number) += ls.value;
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch {
      /* */
    }

    try {
      const inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { processingStart: number; duration: number };
          const delay = e.processingStart - e.startTime;
          if (perf.firstInputDelay === null || delay > (perf.firstInputDelay ?? 0)) {
            perf.firstInputDelay = delay;
          }
          if (perf.inp === null || e.duration > (perf.inp ?? 0)) perf.inp = e.duration;
        }
      });
      try {
        inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {
        inpObs.observe({ type: "first-input", buffered: true });
      }
    } catch {
      /* */
    }
  });

  // Login
  await loginAdmin(page);

  // Navigate to schedule with cache cleared (simulate cold load)
  // Hard navigate ensures no in-memory caches
  console.log("[cold] Hard navigating to /dashboard/people...");

  // Reset observers for the schedule page load
  await page.addInitScript(() => {
    // Re-initialize on each navigation so we measure only /schedule
    window.addEventListener("beforeunload", () => {
      (window as unknown as Record<string, unknown>).__perfEntries = {
        lcp: [],
        cls: 0,
        inp: null,
        firstInputDelay: null,
      };
    });
  });

  const navStart = Date.now();
  await page.goto(`${PORTAL_BASE}${PEOPLE_PATH}`, {
    waitUntil: "commit",
  });

  // Capture skeleton screenshot (early — before content loads)
  await page.waitForTimeout(300);
  await page.screenshot({ path: SCREENSHOT_COLD_SKELETON, fullPage: false });
  console.log(`[cold] Skeleton screenshot saved → ${SCREENSHOT_COLD_SKELETON}`);

  // Wait for content to settle
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    console.warn("[cold] networkidle timeout");
  });
  await page.waitForTimeout(2000);

  // Post-load screenshot
  await page.screenshot({ path: SCREENSHOT_COLD_LOADED, fullPage: false });
  console.log(`[cold] Post-load screenshot saved → ${SCREENSHOT_COLD_LOADED}`);

  const metrics = await collectMetricsAfterLoad(page, "cold");
  metrics.navigation_start_epoch = navStart;

  return { metrics, context, page };
}

// ---------------------------------------------------------------------------
// Warm pass — reuse same context + page
// ---------------------------------------------------------------------------

async function runWarmPass(page: Page): Promise<PerfMetrics> {
  console.log("\n=== WARM PASS ===");

  // Re-inject observer for the warm navigation
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__perfEntries = {
      lcp: [],
      cls: 0,
      inp: null,
      firstInputDelay: null,
    };

    const perf = (window as unknown as Record<string, unknown>).__perfEntries as {
      lcp: PerformanceEntry[];
      cls: number;
      inp: number | null;
      firstInputDelay: number | null;
    };

    try {
      const lcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) perf.lcp.push(entry);
      });
      lcpObs.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* */
    }

    try {
      const clsObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!ls.hadRecentInput) (perf.cls as number) += ls.value;
        }
      });
      clsObs.observe({ type: "layout-shift", buffered: true });
    } catch {
      /* */
    }

    try {
      const inpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & { processingStart: number; duration: number };
          if (perf.inp === null || e.duration > (perf.inp ?? 0)) perf.inp = e.duration;
        }
      });
      try {
        inpObs.observe({ type: "event", buffered: true, durationThreshold: 16 });
      } catch {
        inpObs.observe({ type: "first-input", buffered: true });
      }
    } catch {
      /* */
    }
  });

  // Navigate away first (to /dashboard), then back to /schedule
  console.log("[warm] Navigating to /dashboard...");
  await page.goto(`${PORTAL_BASE}${DASHBOARD_PATH}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  console.log("[warm] Navigating back to /dashboard/people...");
  const navStart = Date.now();
  await page.goto(`${PORTAL_BASE}${PEOPLE_PATH}`, { waitUntil: "commit" });

  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    console.warn("[warm] networkidle timeout");
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: SCREENSHOT_WARM_LOADED, fullPage: false });
  console.log(`[warm] Post-load screenshot saved → ${SCREENSHOT_WARM_LOADED}`);

  const metrics = await collectMetricsAfterLoad(page, "warm");
  metrics.navigation_start_epoch = navStart;

  return metrics;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  resolveSupabaseEnv();

  console.log("[perf-baseline] Launching Chromium...");
  console.log(`  executablePath: ${CHROMIUM_PATH}`);

  if (!fs.existsSync(CHROMIUM_PATH)) {
    throw new Error(`Chromium not found at ${CHROMIUM_PATH}`);
  }

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let coldMetrics: PerfMetrics;
  let warmMetrics: PerfMetrics;
  let context: BrowserContext | null = null;

  try {
    const coldResult = await runColdPass(browser);
    coldMetrics = coldResult.metrics;
    context = coldResult.context;

    warmMetrics = await runWarmPass(coldResult.page);
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  const output = {
    generated_at: new Date().toISOString(),
    route: "/dashboard/people",
    portal_base: PORTAL_BASE,
    chromium_path: CHROMIUM_PATH,
    cold: coldMetrics!,
    warm: warmMetrics!,
    screenshots: {
      cold_skeleton: SCREENSHOT_COLD_SKELETON,
      cold_loaded: SCREENSHOT_COLD_LOADED,
      warm_loaded: SCREENSHOT_WARM_LOADED,
    },
    notes: [
      "LCP from PerformanceObserver largest-contentful-paint API",
      "CLS from PerformanceObserver layout-shift API (cumulative, no recent input filter)",
      "TTI derived from domInteractive (Navigation Timing API) — not Long Tasks TTI",
      "INP from PerformanceObserver event/duration (synthetic fallback: requestAnimationFrame round-trip)",
      "JS bundle KB from resource timing encodedBodySize for script initiators",
    ],
  };

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(output, null, 2));
  console.log(`\n[perf-baseline] Results written → ${OUTPUT_JSON}`);
  console.log("\n=== SUMMARY ===");
  console.log(
    "COLD:",
    JSON.stringify(
      {
        lcp: coldMetrics!.lcp_ms,
        cls: coldMetrics!.cls,
        tti: coldMetrics!.tti_ms,
        inp: coldMetrics!.inp_ms,
        jsKb: coldMetrics!.js_bundle_kb,
      },
      null,
      2,
    ),
  );
  console.log(
    "WARM:",
    JSON.stringify(
      {
        lcp: warmMetrics!.lcp_ms,
        cls: warmMetrics!.cls,
        tti: warmMetrics!.tti_ms,
        inp: warmMetrics!.inp_ms,
        jsKb: warmMetrics!.js_bundle_kb,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[perf-baseline] FATAL:", err);
  process.exit(1);
});
