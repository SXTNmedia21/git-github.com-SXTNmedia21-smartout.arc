import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    testTimeout: 10_000,
  },
});
