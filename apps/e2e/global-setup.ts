// ============================================
// global-setup.ts
//
// Provisions the local Playwright fixture AND ensures recorder C4
// authority rows exist before any test worker spins up.
//
// Two gates run in sequence:
//   1. ensure-local-e2e-runtime-fixture.mjs — provisions + self-verifies
//      the general fixture (L-0107). Without this, `npx playwright test`
//      invoked directly (bypassing the playwright-with-libs.sh wrapper)
//      used to let silent fixture-drops cascade into 10/14 false login
//      failures.
//   2. ensureRecorderAuthoritySeed() — re-seeds the 5 recorder C4 rows
//      the botsson-recorder suite requires. Migration
//      20260515120400_recorder_authority_seed.sql selects from
//      workspace+profile tables that may be empty on fresh boots, so we
//      re-run the idempotent upsert via service-role here.
//
// A non-zero exit from either gate fails the whole Playwright run with
// captured stderr — no worker is spawned. Fix the gate before re-running.
// ============================================

import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { config as loadDotenv } from "dotenv";
import type { FullConfig } from "@playwright/test";

import { ensurePayrollLockedPeriodSeed } from "./helpers/payroll-locked-period-seed";
import { ensureRecorderAuthoritySeed } from "./helpers/recorder-seed-ensure";

// Why: Playwright loads .ts config files via tsx, which transpiles them to CJS.
// `import.meta.url` is unavailable in CJS scope. Anchor on process.cwd() instead
// — Playwright sets cwd to the directory holding playwright.config.ts (apps/e2e),
// which is CJS-safe and independent of how tsx loads this file. See L-0107.
const fixtureScriptRelative = "scripts/ensure-local-e2e-runtime-fixture.mjs";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Gate 1 — general fixture (L-0107).
  const fixtureScript = resolve(process.cwd(), fixtureScriptRelative);
  try {
    execSync(`node ${fixtureScript}`, {
      stdio: "inherit",
      env: process.env,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[playwright global-setup] fixture provisioning FAILED.\n` +
        `Script: ${fixtureScript}\n` +
        `Reason: ${message}\n` +
        `No test workers will start. Fix the fixture before re-running.`,
    );
  }

  // Gate 2 — recorder C4 authority rows.
  // Make .env.local values available to the admin client.
  loadDotenv({ path: ".env.local" });

  // Pull Supabase env from the CLI so setup works even without a custom
  // .env.local — same pattern as scripts/start-local-next-app.sh.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
      // Supabase Local not running — recorder seed will throw a clearer error.
    }
  }

  await ensureRecorderAuthoritySeed();

  // Gate 3 — payroll locked period seed (unblocks Group B export round-trip
  // specs in apps/e2e/tests/payroll-phase-{3,4}-*.spec.ts).
  await ensurePayrollLockedPeriodSeed();
}
