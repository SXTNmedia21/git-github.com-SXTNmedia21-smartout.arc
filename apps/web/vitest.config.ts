/**
 * vitest.config.ts
 * Vitest configuration for the web app.
 * Uses the same path aliases as tsconfig.json so tests
 * can import with @/ just like application code.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
