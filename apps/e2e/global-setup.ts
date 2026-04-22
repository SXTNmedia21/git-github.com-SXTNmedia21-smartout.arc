// ============================================
// global-setup.ts
//
// Playwright globalSetup. Runs once before all specs.
//
// Current responsibilities:
//   - Ensure recorder C4 authority rows exist (migration race workaround,
//     see helpers/recorder-seed-ensure.ts for the why).
//
// Connected to: playwright.config.ts (globalSetup entry).
// ============================================

import { config as loadDotenv } from "dotenv";
import { ensureRecorderAuthoritySeed } from "./helpers/recorder-seed-ensure";

async function globalSetup(): Promise<void> {
  // Make .env.local values available to setup (matches playwright.config.ts).
  loadDotenv({ path: ".env.local" });

  // Pull Supabase env from the CLI so setup works even without a custom
  // .env.local — same pattern as scripts/start-local-next-app.sh.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { execSync } = await import("node:child_process");
    try {
      const out = execSync("npx supabase status -o env", {
        cwd: process.cwd().includes("/apps/e2e") ? "../.." : ".",
        encoding: "utf-8",
      });
      for (const line of out.split("\n")) {
        const m = line.match(/^([A-Z_]+)="([^"]*)"$/);
        if (!m) continue;
        const [, k, v] = m;
        if (k === "API_URL") process.env.NEXT_PUBLIC_SUPABASE_URL ??= v;
        if (k === "SERVICE_ROLE_KEY") process.env.SUPABASE_SERVICE_ROLE_KEY ??= v;
        if (k === "ANON_KEY") process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= v;
      }
    } catch {
      // Supabase Local not running — defer to the next step which will
      // surface a clearer error.
    }
  }

  await ensureRecorderAuthoritySeed();
}

export default globalSetup;
