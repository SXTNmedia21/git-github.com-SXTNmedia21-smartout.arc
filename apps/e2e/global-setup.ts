// ============================================
// global-setup.ts
// Provisions (and self-verifies) the local Playwright fixture
// before any test worker spins up.
//
// Why: `npx playwright test` invoked directly (without the
// playwright-with-libs.sh wrapper) used to bypass fixture
// provisioning entirely, which let silent fixture-drops cascade
// into 10/14 false failures at login. L-0107 makes provisioning
// part of the Playwright run itself, not just the wrapper.
// ============================================

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { FullConfig } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureScript = resolve(here, "scripts/ensure-local-e2e-runtime-fixture.mjs");

/**
 * Runs the runtime fixture provisioner before any worker starts.
 * Why: fixture provisioning + self-verifier (L-0107) must succeed before
 * the first test attempts to log in. A non-zero exit here fails the
 * whole Playwright run with the captured stderr — no worker is spawned.
 *
 * @param _config — the resolved Playwright config (unused; we only need to gate the run).
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
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
}
