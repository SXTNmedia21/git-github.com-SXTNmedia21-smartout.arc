import type { Page } from "@playwright/test";

const DEFAULT_EMAIL = "admin@smartout.local";
const DEFAULT_PASSWORD = "password123";

export async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.E2E_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}

export async function loginAsEmployee(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });
}
