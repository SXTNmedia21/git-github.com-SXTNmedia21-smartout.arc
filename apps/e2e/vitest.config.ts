import { defineConfig } from "vitest/config";

/**
 * Vitest config for the e2e package.
 *
 * Runs unit tests for runner utilities (speed-profile-env, etc.) AND
 * DB-level integration tests under db/**\/*.spec.ts.
 * Playwright-based tests are NOT run by vitest — they use `test:e2e` scripts.
 */
export default defineConfig({
  test: {
    include: ["runners/__tests__/**/*.test.ts", "db/**/*.spec.ts"],
    exclude: ["node_modules/**", "dist/**"],
    // DB integration tests require a running local Supabase instance and
    // SUPABASE_SERVICE_ROLE_KEY env var (op run --env-file=.env.template).
    testTimeout: 30_000,
  },
});
