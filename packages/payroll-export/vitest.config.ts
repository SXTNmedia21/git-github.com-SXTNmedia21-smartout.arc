import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    testTimeout: 30_000,
  },
});
