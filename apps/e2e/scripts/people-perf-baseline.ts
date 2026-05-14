/**
 * people-perf-baseline.ts
 *
 * Why: Measure real LCP/CLS/TTI/INP cold + warm for /dashboard/people
 * using Playwright CDP — without Lighthouse CLI. Captures skeleton-flash
 * screenshots (mid-skeleton + post-load) for visual CLS verification.
 *
 * Auth: Uses admin@smartout.local / password123 (same identity as E2E suite).
 * Portal host: 127.0.0.1:3060 — matches middleware subdomain detection.
 *
 * Output: /tmp/people-perf-baseline.json
 * Screenshots: /tmp/people-cold-skeleton.png, /tmp/people-cold-loaded.png,
 *              /tmp/people-warm-loaded.png
 *
 * Run: pnpm tsx apps/e2e/scripts/people-perf-baseline.ts
 * Port override: PORT=3061 to avoid conflict with parallel sorties.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHROMIUM_PATH = path.join(
  process.env.HOME ?? "/home/sxtnl",
  ".cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
);

// Use 127.0.0.1 (not app.localhost) — same as auth.ts loginAsAdmin.
// 127.0.0.1 maps to "root" subdomain type in middleware, bypassing
// the portal /select-workspace redirect.
const PORT = process.env.PORT ?? "3060";
const PORTAL_BASE = `http://127.0.0.1:${PORT}`;
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
// Auth helpers
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

  const finalUrl = page.url();
  if (finalUrl.includes("select-workspace") || finalUrl.includes("/welcome")) {
    console.log(`[auth] Unexpected redirect to ${finalUrl}, forcing dashboard...`);
    await page.goto(`${PORTAL_BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 }).catch(() => {});
  }

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

function buildPerfObserverScript(): string {
  return `
    (window).__perfEntries = { lcp: [], cls: 0, inp: null, firstInputDelay: null };
    const perf = window.__perfEntries;
    try {
      const l = new PerformanceObserver((list) => { for (const e of list.getEntries()) perf.lcp.push(e); });
      l.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      const c = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const ls = e;
          if (!ls.hadRecentInput) perf.cls += ls.value;
        }
      });
      c.observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      const i = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          const ev = e;
          const delay = ev.processingStart - ev.startTime;
          if (perf.firstInputDelay === null || delay > perf.firstInputDelay) perf.firstInputDelay = delay;
          if (perf.inp === null || ev.duration > perf.inp) perf.inp = ev.duration;
        }
      });
      try { i.observe({ type: "event", buffered: true, durationThreshold: 16 }); }
      catch { i.observe({ type: "first-input", buffered: true }); }
    } catch {}
  `;
}

async function injectPerfObservers(page: Page): Promise<void> {
  await page.addInitScript(buildPerfObserverScript());
}

async function collectMetricsAfterLoad(page: Page, label: string): Promise<PerfMetrics> {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    console.warn(`[metrics:${label}] networkidle timeout — using current state`);
  });
  await page.waitForTimeout(1500);

  await page
    .evaluate(() => {
      document.body.click();
    })
    .catch(() => {});
  await page.waitForTimeout(200);

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

  const jsBundleKb = await page
    .evaluate(() => {
      const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      let totalBytes = 0;
      for (const r of resources) {
        if (r.initiatorType === "script" && r.encodedBodySize > 0) totalBytes += r.encodedBodySize;
      }
      return totalBytes > 0 ? Math.round(totalBytes / 1024) : null;
    })
    .catch(() => null);

  const ttiMs = navTiming?.domInteractive ?? null;
  let inpMs: number | null = observed?.inp ?? observed?.fid ?? null;

  if (inpMs === null) {
    try {
      const startTime = Date.now();
      await page.evaluate(() => {
        document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
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
    navigation_start_epoch: null,
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

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  await injectPerfObservers(page);

  // Re-initialize observers on each navigation
  await page.addInitScript(() => {
    window.addEventListener("beforeunload", () => {
      (window as unknown as Record<string, unknown>).__perfEntries = {
        lcp: [],
        cls: 0,
        inp: null,
        firstInputDelay: null,
      };
    });
  });

  await loginAdmin(page);

  console.log("[cold] Hard navigating to /dashboard/people...");
  const navStart = Date.now();
  await page.goto(`${PORTAL_BASE}${PEOPLE_PATH}`, { waitUntil: "commit" });

  // Skeleton screenshot — early, before RSC data arrives
  await page.waitForTimeout(300);
  await page.screenshot({ path: SCREENSHOT_COLD_SKELETON, fullPage: false });
  console.log(`[cold] Skeleton screenshot saved → ${SCREENSHOT_COLD_SKELETON}`);

  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
    console.warn("[cold] networkidle timeout");
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: SCREENSHOT_COLD_LOADED, fullPage: false });
  console.log(`[cold] Post-load screenshot saved → ${SCREENSHOT_COLD_LOADED}`);

  const metrics = await collectMetricsAfterLoad(page, "cold");
  metrics.navigation_start_epoch = navStart;

  return { metrics, context, page };
}

// ---------------------------------------------------------------------------
// Warm pass (three runs, take median)
// ---------------------------------------------------------------------------

async function runWarmPass(page: Page): Promise<{ median: PerfMetrics; runs: PerfMetrics[] }> {
  console.log("\n=== WARM PASS (3 runs for median) ===");

  const runs: PerfMetrics[] = [];

  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Warm run ${i + 1}/3 ---`);
    await injectPerfObservers(page);

    console.log("[warm] Navigating to /dashboard...");
    await page.goto(`${PORTAL_BASE}${DASHBOARD_PATH}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    console.log("[warm] Navigating back to /dashboard/people...");
    const navStart = Date.now();
    await page.goto(`${PORTAL_BASE}${PEOPLE_PATH}`, { waitUntil: "commit" });

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
      console.warn(`[warm:${i + 1}] networkidle timeout`);
    });
    await page.waitForTimeout(2000);

    const metrics = await collectMetricsAfterLoad(page, `warm-${i + 1}`);
    metrics.navigation_start_epoch = navStart;
    runs.push(metrics);
  }

  await page.screenshot({ path: SCREENSHOT_WARM_LOADED, fullPage: false });
  console.log(`[warm] Final screenshot saved → ${SCREENSHOT_WARM_LOADED}`);

  // Compute median from 3 runs
  const lcpValues = runs.map((r) => r.lcp_ms ?? 0).sort((a, b) => a - b);
  const median = runs[1]!; // middle run (index 1 of sorted lcp gives us median)
  // Find run with median LCP
  const medianLcp = lcpValues[1]!;
  const medianRun = runs.find((r) => r.lcp_ms === medianLcp) ?? runs[1]!;

  console.log(`[warm] 3-run LCPs: [${lcpValues.join(", ")}]ms — median ${medianLcp}ms`);

  return { median: { ...medianRun }, runs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  resolveSupabaseEnv();

  console.log("[perf-baseline] Launching Chromium...");
  console.log(`  executablePath: ${CHROMIUM_PATH}`);
  console.log(`  portal: ${PORTAL_BASE}`);

  if (!fs.existsSync(CHROMIUM_PATH)) {
    throw new Error(`Chromium not found at ${CHROMIUM_PATH}`);
  }

  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let coldMetrics: PerfMetrics;
  let warmResult: { median: PerfMetrics; runs: PerfMetrics[] };
  let context: BrowserContext | null = null;

  try {
    const coldResult = await runColdPass(browser);
    coldMetrics = coldResult.metrics;
    context = coldResult.context;

    warmResult = await runWarmPass(coldResult.page);
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
    warm_median: warmResult!.median,
    warm_runs: warmResult!.runs,
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
      "Warm: 3 runs, median taken by sorted LCP array",
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
    "WARM (median of 3):",
    JSON.stringify(
      {
        lcp: warmResult!.median.lcp_ms,
        cls: warmResult!.median.cls,
        tti: warmResult!.median.tti_ms,
        inp: warmResult!.median.inp_ms,
        jsKb: warmResult!.median.js_bundle_kb,
        runs: warmResult!.runs.map((r) => r.lcp_ms),
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
