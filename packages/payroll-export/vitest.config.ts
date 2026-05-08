import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    testTimeout: 15_000,
  },
});
