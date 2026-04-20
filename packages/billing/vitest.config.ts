import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    testTimeout: 10_000,
  },
});
