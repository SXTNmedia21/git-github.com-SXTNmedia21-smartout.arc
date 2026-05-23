// =============================================================================
// bulk-import/sortie-0-attachment-routing.spec.ts
//
// Sortie 0 — integration test for the bulk_import attachment routing pipe.
//
// What this tests (API-level, no browser rendering needed):
//
//   T1. POST /api/botsson/imports/upload with a CSV fixture
//       → 200 + { signedUrl: "https://...", mime: "text/csv" }
//
//   T2. POST /api/emma/chat with userMessageAttachments: [upload]
//       → 200 (stage-engine accepted the payload with the attachment)
//
// Architecture:
//   The spec uses Playwright's `page.request` context which shares cookies
//   with the authenticated browser session established by loginAsAdmin().
//   This is the correct pattern for BFF API tests that require a Supabase
//   SSR cookie session (same as harness-adapter-chat-client-tool.spec.ts).
//
// Prerequisites (REQUIRED — tests are marked test.skip until infra is up):
//   1. Supabase Local running: `npx supabase start`
//   2. Next.js dev server on port 3060:
//      `op run --env-file=.env.template -- pnpm dev --filter @smartout/web`
//   3. Storage bucket "botsson-imports" exists (migration applied in Sortie 0):
//      apps/web/src/lib/storage/botsson-imports.ts
//   4. Stage-engine container running (for /api/emma/chat proxy):
//      `cd infra && docker compose up -d stage-engine`
//   5. apps/e2e/.env.local configured with:
//      SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, STAGE_ENGINE_API_KEY
//
// Spec path note:
//   Lives in apps/e2e/bulk-import/ (not apps/web/e2e/bulk-import/ as in the
//   plan) because apps/e2e/ is the actual Playwright root. Equivalent scope.
//
// Journey: JOURNEY-bulk-import-sortie-0.md
// ADR: ADR-bulk-import (Sortie 0 council 2026-05-23)
// =============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "../helpers/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Seeded test workspace from seed.sql.
 * Source: MEMORY.md "Inspect Pontus's interactions" + botsson-harness.ts:SEED_WORKSPACE_ID.
 * Override via TEST_WORKSPACE_ID env var for non-default seeds.
 */
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID ?? "b0000000-0000-0000-0000-000000000000";

/**
 * Path to the minimal CSV fixture used by both upload and chat tests.
 * Content: header + 1 row (name, start, end, department).
 */
const FIXTURE_PATH = join(__dirname, "fixtures", "small-vaktliste.csv");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read the fixture CSV as a Buffer.
 * Declared at module scope so it fails fast (missing fixture) before any test.
 */
const CSV_BUFFER: Buffer = readFileSync(FIXTURE_PATH);
const CSV_CONTENT = CSV_BUFFER.toString("utf-8");

// ─── Test suite ───────────────────────────────────────────────────────────────

/**
 * NOTE: Tests are wrapped in test.skip because the full flow requires
 * Supabase Local + Next.js dev server + stage-engine to be running.
 * Remove the test.skip guard once the full local infra is available.
 * See Prerequisites above.
 *
 * The spec structure (fixtures, assertions, multipart pattern) is correct
 * and verified by TypeScript — only live infra gate is missing.
 */
test.describe("Sortie 0 — bulk_import attachment routing", () => {
  /**
   * T1: Upload endpoint
   *
   * POST multipart to /api/botsson/imports/upload.
   * Expects 200 + signed URL + mime type.
   *
   * Prereqs: Supabase Local up, storage bucket "botsson-imports" exists,
   *          Next.js dev server running.
   */
  test.skip(
    true,
    "Requires live infra: Supabase Local + Next.js dev server + botsson-imports bucket",
  );

  test("T1: upload CSV fixture → 200 + signed_url + mime=text/csv", async ({ page }) => {
    // Establish auth session (sets Supabase SSR cookies on the page context).
    // page.request inherits these cookies for subsequent API calls.
    await loginAsAdmin(page);

    const uploadRes = await page.request.post("/api/botsson/imports/upload", {
      multipart: {
        workspace_id: WORKSPACE_ID,
        file: {
          name: "small-vaktliste.csv",
          mimeType: "text/csv",
          buffer: CSV_BUFFER,
        },
      },
    });

    expect(uploadRes.status(), "upload endpoint must return 200").toBe(200);

    const upload = await uploadRes.json();

    // signed_url must be an HTTPS URL (Supabase Storage signed URL format)
    expect(
      typeof upload.signedUrl === "string" && upload.signedUrl.startsWith("https://"),
      `signedUrl must be an https:// string, got: ${JSON.stringify(upload.signedUrl)}`,
    ).toBe(true);

    // mime must reflect the uploaded file type
    expect(upload.mime, "mime must equal text/csv").toBe("text/csv");
  });

  /**
   * T2: Chat endpoint with attachment
   *
   * POST /api/emma/chat with the upload result in userMessageAttachments.
   * Verifies the BFF accepts the payload and routes to stage-engine.
   *
   * Prereqs: All T1 prereqs + stage-engine container running.
   *
   * Note: We re-upload inline here (no shared state between tests) so T2
   * can be run independently of T1. The upload result is used as the
   * attachment payload.
   */
  test("T2: chat POST with CSV attachment → 200", async ({ page }) => {
    await loginAsAdmin(page);

    // Step A: upload the fixture to get a signed URL
    const uploadRes = await page.request.post("/api/botsson/imports/upload", {
      multipart: {
        workspace_id: WORKSPACE_ID,
        file: {
          name: "small-vaktliste.csv",
          mimeType: "text/csv",
          buffer: CSV_BUFFER,
        },
      },
    });

    expect(uploadRes.status(), "upload prereq must return 200").toBe(200);
    const upload = (await uploadRes.json()) as Record<string, unknown>;

    // Step B: post to /api/emma/chat with the attachment in userMessageAttachments
    // The chat BFF schema accepts userMessageAttachments: z.array(z.record(z.unknown()))
    // (see apps/web/src/app/api/emma/chat/route.ts RequestSchema).
    const chatRes = await page.request.post("/api/emma/chat", {
      data: {
        workspaceId: WORKSPACE_ID,
        userMessage: "Importer disse vaktene bitte",
        userMessageAttachments: [upload],
      },
    });

    // 200 = BFF accepted and forwarded to stage-engine.
    // We don't assert the response body here because it depends on the
    // stage-engine LLM response, which varies. The status code is the
    // deterministic gate.
    expect(chatRes.status(), "emma/chat with attachment must return 200").toBe(200);
  });
});

/**
 * Smoke-safe assertion: fixture file is present and has the expected shape.
 * This test runs without any infra and validates the fixture content.
 * It is NOT skipped.
 */
test.describe("Sortie 0 — fixture validation (no infra required)", () => {
  test("small-vaktliste.csv fixture has correct format", () => {
    // Verify the CSV content matches the expected shape:
    // header + at least one data row
    const lines = CSV_CONTENT.trim().split("\n");
    expect(lines.length, "fixture must have header + at least 1 data row").toBeGreaterThanOrEqual(
      2,
    );

    const header = lines[0];
    expect(header, "header must contain name column").toContain("name");
    expect(header, "header must contain start column").toContain("start");
    expect(header, "header must contain end column").toContain("end");
    expect(header, "header must contain department column").toContain("department");

    const firstRow = lines[1];
    expect(firstRow, "first data row must be non-empty").toBeTruthy();
    // Spot-check: first row should have 4 comma-separated fields
    const fields = (firstRow ?? "").split(",");
    expect(fields.length, "first data row must have 4 fields").toBe(4);
  });
});
