// ============================================
// playwright.payroll.config.ts
//
// Payroll-only config: inherits everything from playwright.config.ts but
// strips the landing + mobile webServer entries so the run reuses the
// already-running web dev server on 3060 without trying to spawn a fresh
// landing on 3056 (which fails with EADDRINUSE when dev landing is up
// with a 500 response).
//
// Usage:
//   pnpm exec playwright test --config=playwright.payroll.config.ts \
//     --project=web tests/payroll-*.spec.ts
// ============================================

import { defineConfig, type Project } from "@playwright/test";
import baseConfig from "./playwright.config";

const localWebPort = Number(process.env.E2E_WEB_PORT) || 3060;
const webBaseUrl = `http://127.0.0.1:${localWebPort}`;

// Strip landing + mobile webServers — only payroll web specs run here.
const projects: Project[] = baseConfig.projects?.filter((p) => p.name === "web") ?? [];

export default defineConfig({
  ...baseConfig,
  webServer: [
    {
      command: `bash ./scripts/start-local-next-app.sh web ${localWebPort}`,
      url: webBaseUrl,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects,
});
