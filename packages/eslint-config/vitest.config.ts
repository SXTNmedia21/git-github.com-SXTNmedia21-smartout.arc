import { defineConfig } from "vitest/config";

/**
 * Vitest config for @smartout/eslint-config.
 *
 * Scope: tests for the custom `smartout/*` ESLint rules under `plugins/smartout/`.
 * Uses ESLint v9's built-in RuleTester inside `describe`/`it` blocks — no extra
 * runtime needed.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.{mjs,ts}"],
    exclude: ["node_modules", ".turbo"],
    environment: "node",
    testTimeout: 10_000,
  },
});
