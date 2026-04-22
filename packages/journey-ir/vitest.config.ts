import { defineConfig } from "vitest/config";

/**
 * Vitest config for @smartout/journey-ir.
 *
 * Restricts test discovery to `src/` only so compiled copies under `dist/`
 * are not double-executed when tests run after a build.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
