import { defineConfig, devices } from "@playwright/test";

const localWebPort = 3061;
const localLandingPort = 3056;
const webBaseUrl = `http://127.0.0.1:${localWebPort}`;
const landingBaseUrl = `http://127.0.0.1:${localLandingPort}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
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
    : [["list"], ["html"], ["./reporters/journey-reporter.ts"]],
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
  },
  /* Output directory for test artifacts */
  outputDir: "./test-results",

  /* Start dev servers before running tests (skip with SKIP_WEB_SERVER=1) */
  ...(!process.env.SKIP_WEB_SERVER && {
    webServer: [
      {
        command: "bash ./scripts/start-local-next-app.sh web 3061",
        url: webBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
      {
        command: "bash ./scripts/start-local-next-app.sh landing 3056",
        url: landingBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
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
  ],
});
