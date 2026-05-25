import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:3060";
const EMAIL = "admin@smartout.local";
const PASSWORD = "password123";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const findings = [];
const log = (m) => { console.log(`[verify] ${m}`); findings.push(m); };

page.on("pageerror", (e) => log(`PAGEERROR: ${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") log(`CONSOLE.error: ${msg.text().slice(0, 200)}`);
});
page.on("response", (r) => {
  const u = r.url();
  if (u.includes(BASE) && r.status() >= 500) log(`HTTP ${r.status()} ${u}`);
});

try {
  log(`goto /login`);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 15000 });
  log(`post-login URL = ${page.url()}`);

  log(`goto /dashboard/oppgaver`);
  const resp = await page.goto(`${BASE}/dashboard/oppgaver`, { waitUntil: "networkidle", timeout: 20000 });
  log(`oppgaver status = ${resp?.status()}`);
  log(`oppgaver URL    = ${page.url()}`);

  await page.screenshot({ path: "/tmp/verify-oppgaver-01-load.png", fullPage: true });
  log(`screenshot -> /tmp/verify-oppgaver-01-load.png`);

  // Probe 1: Manager Timeline region
  const region = page.getByRole("region", { name: /Manager Timeline/i });
  const regionVisible = await region.isVisible().catch(() => false);
  log(`probe.region(Manager Timeline) visible = ${regionVisible}`);

  // Probe 2: "Dagslinjen" text
  const dagslinjen = await page.getByText("Dagslinjen").isVisible().catch(() => false);
  log(`probe.text(Dagslinjen) visible = ${dagslinjen}`);

  // Probe 3: Toolbar radiogroup
  const radiogroup = await page.getByRole("radiogroup").first().isVisible().catch(() => false);
  log(`probe.radiogroup visible = ${radiogroup}`);

  // Probe 4: TopBar
  const topbarH1 = await page.locator("h1, h2").first().textContent().catch(() => null);
  log(`probe.heading.text = ${JSON.stringify(topbarH1)}`);

  // Probe 5: View-mode toggle interaction
  const radios = await page.getByRole("radio").count().catch(() => 0);
  log(`probe.radio.count = ${radios}`);
  if (radios > 1) {
    await page.getByRole("radio").nth(1).click({ force: true }).catch((e) => log(`radio.click err: ${e.message}`));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/tmp/verify-oppgaver-02-radio-switched.png", fullPage: true });
    log(`screenshot -> /tmp/verify-oppgaver-02-radio-switched.png`);
  }

  // Probe 6: TaskBlocks present
  const taskBlocks = await page.locator("[data-testid^='task-block'], [data-task-id]").count().catch(() => 0);
  log(`probe.task-blocks.count = ${taskBlocks}`);

  // Probe 7: a11y — skip-to-content / region landmarks
  const regions = await page.locator("[role='region']").count();
  const mains = await page.locator("main, [role='main']").count();
  log(`probe.a11y.regions=${regions} mains=${mains}`);

  // Probe 8: empty-state vs populated
  const emptyMarker = await page.getByText(/ingen oppgaver|no tasks|tom/i).isVisible().catch(() => false);
  log(`probe.empty-state.visible = ${emptyMarker}`);

  log(`DONE`);
} catch (e) {
  log(`FATAL: ${e.message}`);
  await page.screenshot({ path: "/tmp/verify-oppgaver-FATAL.png", fullPage: true }).catch(() => {});
} finally {
  writeFileSync("/tmp/verify-oppgaver.log", findings.join("\n") + "\n");
  await browser.close();
}
