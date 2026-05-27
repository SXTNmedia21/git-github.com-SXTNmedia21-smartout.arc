import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load .env.local for local Supabase keys (gitignored, safe)
config({ path: ".env.local" });

const localWebPort = Number(process.env.E2E_WEB_PORT) || 3060;
const localLandingPort = Number(process.env.E2E_LANDING_PORT) || 3056;
const localMobilePort = Number(process.env.E2E_MOBILE_PORT) || 8083;
const webBaseUrl = `http://127.0.0.1:${localWebPort}`;
const landingBaseUrl = `http://127.0.0.1:${localLandingPort}`;
const mobileBaseUrl = `http://localhost:${localMobilePort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: ".",
  /* Narrow testMatch to exclude db/ and runners/__tests__/ subdirs, which
   * contain vitest specs. The prior broad /\.(spec|test)\.ts$/ caused
   * Playwright to require() those files and fail: "Vitest cannot be imported
   * in a CommonJS module" — blocking any --grep or root-glob sweep. HARNESS-1
   * (2026-05-23 journey-sweep BUGS.md); diagnosed in chair Phase 5 synthesis.
   * Negative lookahead on the absolute path prevents file discovery entirely. */
  testMatch: /^(?!.*\/(?:db|runners\/__tests__)\/)\S+\.(spec|test)\.ts$/,
  /* Runs once before any spec. Two gates: (1) L-0107 fixture provisioning
   * + self-verify, (2) recorder C4 authority re-seed for the botsson-
   * recorder suite. See global-setup.ts for why both live in one entry. */
  globalSetup: "./global-setup.ts",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* OPS-1 WSL2 OOM cliff mitigation (ADR-0408, 2026-05-24).
   * WSL2 has swap=0B; concurrent Playwright workers + chromium tabs +
   * Next.js 16 dev server together peak > 15 Gi RAM and trigger OOM kills.
   * 4x documented in 2026-05-23 journey sweep (BUGS.md OPS-1).
   * - CI: 1 worker (unchanged -- GitHub Actions runner has dedicated RAM)
   * - Local default: 1 worker to prevent concurrent chromium + next-server OOM
   * Override: E2E_WORKERS env var (e.g. E2E_WORKERS=2 for machines with swap).
   * See docs/protocols/WSL2-SWAP-CONFIG.md to add swap and safely increase. */
  workers: process.env.CI ? 1 : Number(process.env.E2E_WORKERS ?? 1),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [["html"], ["github"], ["./reporters/journey-reporter.ts"]]
    : [
        ["list"],
        ["html"],
        ["./reporters/journey-reporter.ts"],
        ...(process.env.E2E_SSE ? [["./reporters/sse-reporter.ts"] as const] : []),
      ],
  /* Global timeout for each test.
   * Bumped 30s → 60s (feat/e2e-nyheter-stabilize) to absorb Turbopack
   * cold-compile latency on first page.goto() in Journey 2 specs. */
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Capture trace on every failure (incl. first attempt) so local runs with
     * retries=0 still yield Trace Viewer artifacts. Required by Agent UI
     * Testing goal (2026-05-27) exit criterion 6. */
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    /* Remove Next.js dev overlay that intercepts pointer events in dev mode */
    ...(!process.env.CI && {
      actionTimeout: 15_000,
    }),
  },
  /* Output directory for test artifacts */
  outputDir: "./test-results",

  /* Start dev servers before running tests (skip with SKIP_WEB_SERVER=1) */
  ...(!process.env.SKIP_WEB_SERVER && {
    webServer: [
      {
        command: `bash ./scripts/start-local-next-app.sh web ${localWebPort}`,
        url: webBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
      {
        command: `bash ./scripts/start-local-next-app.sh landing ${localLandingPort}`,
        url: landingBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
      /* Mobile PWA (Expo Metro on port 8083) — always reuse existing server.
       * Metro requires manual start: `pnpm dev:mobile` in apps/mobile.
       * Auto-start is skipped because Metro startup is slow and stateful.
       * Set SKIP_WEB_SERVER=1 and start manually before running mobile tests. */
      {
        command: `echo "Mobile server expected at ${mobileBaseUrl} — start manually with 'pnpm dev:mobile'"`,
        url: mobileBaseUrl,
        reuseExistingServer: true,
        timeout: 10_000,
      },
    ],
  }),

  /* Configure projects for major browsers and different local apps */
  projects: [
    {
      name: "landing",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: landingBaseUrl,
      },
      testMatch: /landing\.spec\.ts/,
    },
    {
      name: "web",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: webBaseUrl,
      },
      /* Ignore landing-only specs, Expo PWA specs (tests/mobile, tests/mobile-pwa),
       * and mission mobile specs (missions/<id>/mobile-*.spec.ts which run on
       * web-iphone14 + web-pixel7 against webBaseUrl). */
      testIgnore: [
        /landing\.spec\.ts/,
        /tests\/mobile\//,
        /tests\/mobile-pwa\//,
        /missions\/[^/]+\/mobile-[^/]+\.spec\.ts/,
      ],
    },
    {
      name: "web-iphone14",
      use: {
        /* iPhone 14 emulation against the Next.js web dashboard (port 3060).
         * Force chromium per WSL2 webkit/libgtk-4 constraint. Only runs
         * mission mobile-* specs — author flows stay on `web` project. */
        ...devices["iPhone 14"],
        browserName: "chromium",
        baseURL: webBaseUrl,
      },
      testMatch: /missions\/[^/]+\/mobile-[^/]+\.spec\.ts/,
    },
    {
      name: "web-pixel7",
      use: {
        /* Pixel 7 emulation against the Next.js web dashboard (port 3060).
         * Same constraints as web-iphone14. */
        ...devices["Pixel 7"],
        browserName: "chromium",
        baseURL: webBaseUrl,
      },
      testMatch: /missions\/[^/]+\/mobile-[^/]+\.spec\.ts/,
    },
    {
      name: "mobile",
      use: {
        /* iPhone 13 form factor — realistic PWA viewport for Expo Web.
         * Force chromium because webkit requires libgtk-4 system deps that
         * are not installed in the current WSL2 environment. The viewport +
         * userAgent from iPhone 13 are preserved for accurate RN-Web layout
         * testing; only the browser engine changes. */
        ...devices["iPhone 13"],
        browserName: "chromium",
        baseURL: mobileBaseUrl,
      },
      testMatch: /tests\/mobile\/.+\.spec\.ts/,
    },
    {
      name: "mobile-pwa",
      use: {
        /* Pixel 5 (Android) form factor — cross-device PWA smoke suite.
         * baseURL: Expo Metro at localhost:8083. Start manually with
         * `pnpm dev:mobile` before running this project.
         * Retries/timeouts mirror the web project.
         * Force chromium — same webkit libgtk-4 constraint as mobile project. */
        ...devices["Pixel 5"],
        browserName: "chromium",
        baseURL: mobileBaseUrl,
      },
      testMatch: /tests\/mobile-pwa\/.+\.spec\.ts/,
    },
  ],
});
