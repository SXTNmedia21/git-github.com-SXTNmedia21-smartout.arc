import { defineConfig } from "vitest/config";

/**
 * Vitest config for the e2e package.
 *
 * Runs unit tests for runner utilities (speed-profile-env, etc.).
 * Playwright-based tests are NOT run by vitest — they use `test:e2e` scripts.
 */
export default defineConfig({
  test: {
    include: ["runners/__tests__/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
