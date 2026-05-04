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
  testMatch: /\.(spec|test)\.ts$/,
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
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [["html"], ["github"], ["./reporters/journey-reporter.ts"]]
    : [
        ["list"],
        ["html"],
        ["./reporters/journey-reporter.ts"],
        ...(process.env.E2E_SSE ? [["./reporters/sse-reporter.ts"] as const] : []),
      ],
  /* Global timeout for each test */
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    video: "retain-on-failure",
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
      testIgnore: /landing\.spec\.ts/,
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
