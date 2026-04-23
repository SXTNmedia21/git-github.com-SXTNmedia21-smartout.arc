import { defineConfig } from "vitest/config";

/**
 * Two test surfaces:
 *
 *  - Unit tests (`*.test.ts`): mocked LLM, run on every CI build.
 *    No API key required. Must be fast and deterministic.
 *
 *  - Evals (`*.eval.ts`): call real LLM via OpenRouter, gated behind
 *    RUN_EVALS=1. Run nightly or on demand. Produce accuracy reports.
 *
 * The default `test` run EXCLUDES evals so CI never spends money by
 * accident. The `eval` script opts in explicitly.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo", "**/*.eval.ts", "scripts/__tests__/fixtures/**"],
    environment: "node",
    testTimeout: 10_000,
  },
});
