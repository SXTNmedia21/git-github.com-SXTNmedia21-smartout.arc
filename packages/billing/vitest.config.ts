import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // server-only throws at import time outside Next.js.
    // Alias it to an empty module so server/ files can be tested in Node.
    alias: {
      "server-only": new URL("./src/__tests__/__mocks__/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.{test,spec}.ts"],
    exclude: ["node_modules", "dist", ".turbo"],
    environment: "node",
    testTimeout: 10_000,
  },
});
