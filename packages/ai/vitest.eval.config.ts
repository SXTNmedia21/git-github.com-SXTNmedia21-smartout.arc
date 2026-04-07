import { defineConfig } from "vitest/config";

/**
 * Eval config — calls real LLM via OpenRouter, gated behind RUN_EVALS=1.
 *
 * Run with: `RUN_EVALS=1 OPENROUTER_API_KEY=... pnpm --filter @smartout/ai eval`
 *
 * Evals are NOT unit tests. They measure prompt+model quality against
 * labeled fixtures. Failures surface as per-capability accuracy drops,
 * not assertion errors.
 */
export default defineConfig({
  // Run evals sequentially in a single fork so rate limits and cost are
  // predictable. In Vitest 4 pool options are top-level, not nested.
  pool: "forks",
  forks: { singleFork: true },
  test: {
    include: ["src/**/*.eval.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    // Eval runs hit the network and are inherently slower than unit tests.
    // Sonnet-4.6 averages ~5s/call; 11 fixtures sequential ≈ 60s, leave
    // generous headroom for jitter and growing fixture sets.
    testTimeout: 300_000,
  },
});
