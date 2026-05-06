/**
 * Erik onboarding walkthrough — captures screenshots of the accountant journey
 * through admin.smartout.ai.
 *
 * Run:
 *   pnpm tsx apps/e2e/onboarding/erik/walkthrough.ts            # headless
 *   HEADED=1 pnpm tsx apps/e2e/onboarding/erik/walkthrough.ts   # visible browser
 *   HEADED=1 SLOWMO=800 pnpm tsx apps/e2e/onboarding/erik/walkthrough.ts
 *
 * Pre-requisites (Supabase Local):
 *   - erik@smartout.local seeded with password 'password123'
 *   - billing.accountant_company_grant rows for Erik covering invoiced companies
 *   - Admin app running on :3070 (`pnpm --filter admin dev`)
 *
 * Output: apps/e2e/onboarding/erik/screenshots/NN-step.png
 */

import { chromium, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const HEADED = process.env.HEADED === "1";
const SLOWMO = Number(process.env.SLOWMO ?? (HEADED ? 800 : 0));
const BASE = process.env.ADMIN_E2E_BASE_URL ?? "http://localhost:3070";
const ERIK_EMAIL = "erik@smartout.local";
const ERIK_PASSWORD = "password123";

const SHOTS_DIR = path.resolve(__dirname, "screenshots");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

let stepNum = 0;
const captured: Array<{ file: string; title: string }> = [];

async function shot(page: Page, slug: string, title: string) {
  stepNum += 1;
  const num = String(stepNum).padStart(2, "0");
  const file = `${num}-${slug}.png`;
  await page.screenshot({ path: path.join(SHOTS_DIR, file), fullPage: true });
  captured.push({ file, title });
  console.log(`📸 [${num}] ${title}  →  ${file}`);
}

async function settle(page: Page, ms = 800) {
  // Wait for network to be quiet, then a small grace period for animations.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function main() {
  console.log(`🚀 Erik onboarding walkthrough — ${HEADED ? "HEADED" : "headless"} mode`);
  console.log(`   Base URL: ${BASE}`);
  console.log(`   SlowMo:   ${SLOWMO}ms`);
  console.log(`   Output:   ${SHOTS_DIR}\n`);

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: SLOWMO,
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "nb-NO",
  });
  const page = await ctx.newPage();

  try {
    // ── 01 — Login form (empty) ─────────────────────────────────────────────
    await page.goto(`${BASE}/auth/login`);
    await settle(page);
    await shot(page, "login-empty", "Login-skjerm — Erik åpner admin.smartout.ai");

    // ── 02 — Login form (filled) ────────────────────────────────────────────
    await page.fill('input[type="email"]', ERIK_EMAIL);
    await page.fill('input[type="password"]', ERIK_PASSWORD);
    await page.waitForTimeout(400);
    await shot(page, "login-filled", "Login-skjerm — credentials fylt inn");

    // ── 03 — Submit + land on dashboard ─────────────────────────────────────
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
      timeout: 15_000,
    });
    await settle(page, 1500);
    await shot(page, "dashboard", "Dashboard — periode-CTA, hurtigoppgaver, forrige run");

    // ── 04 — Workspaces (Kartotek) ──────────────────────────────────────────
    await page.goto(`${BASE}/workspaces`);
    await settle(page);
    await shot(page, "kartotek", "Kartotek — alle workspaces Erik har tilgang til");

    // ── 05 — Workspace detail (first workspace) ─────────────────────────────
    const firstWorkspace = page.locator('a[href^="/workspaces/"]').first();
    if (await firstWorkspace.count()) {
      await firstWorkspace.click();
      await settle(page, 1200);
      await shot(page, "workspace-detail", "Workspace-detalje — fakturaer + ordrer");
    }

    // ── 06 — Orders list ────────────────────────────────────────────────────
    await page.goto(`${BASE}/orders`);
    await settle(page);
    await shot(page, "orders-list", "Ordrer — liste over alle fakturerbare ordre");

    // ── 07 — Order detail (first order) ─────────────────────────────────────
    const firstOrder = page.locator('a[href^="/orders/"]').first();
    if (await firstOrder.count()) {
      await firstOrder.click();
      await settle(page, 1200);
      await shot(page, "order-detail", "Ordre-detalje — linjeposter + fakturastatus");
    }

    // ── 08 — Avstemming run-form ────────────────────────────────────────────
    await page.goto(`${BASE}/avstemming/run`);
    await settle(page);
    await shot(page, "avstemming-run-form", "Avstemming — workspace-velger + Kjør-knapp");

    // ── 09 — Run-trigger SKIPPED ─────────────────────────────────────────────
    // executeSettlementRun has 1 unresolved bug: compute_period_aggregates
    // references invoice columns that don't exist (issue_date, due_date —
    // schema renamed to issued_at, due_at). Tracked as separate sortie.
    // For onboarding, the form-state screenshot (06) covers the trigger UI.
    // After bug-stack resolved, re-enable the click block here.
    console.warn("⚠ Skipping run-trigger — see HANDOFF: compute_period_aggregates schema drift");

    // ── 10 — Avstemming historikk (empty, no successful runs yet) ──────────
    await page.goto(`${BASE}/avstemming/historikk`);
    await settle(page);
    await shot(page, "avstemming-historikk", "Avstemming-historikk — tidligere månedslukkinger");

    // ── 11 — Account ────────────────────────────────────────────────────────
    await page.goto(`${BASE}/account`);
    await settle(page);
    await shot(page, "account", "Min konto — Eriks innstillinger + tilganger");

    console.log(`\n✅ ${stepNum} screenshots captured in ${SHOTS_DIR}\n`);
  } catch (err) {
    console.error("\n❌ Walkthrough failed:", err);
    await shot(page, "error-state", "ERROR — siste skjerm før feil").catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  // Emit a manifest the markdown generator can consume.
  fs.writeFileSync(
    path.join(SHOTS_DIR, "manifest.json"),
    JSON.stringify({ generated: new Date().toISOString(), captured }, null, 2),
  );
}

main();
