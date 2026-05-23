// =============================================================================
// bulk-import/sortie-a-parse-spreadsheet.spec.ts
//
// Sortie A capability-layer smoke. Full UI E2E lands Sortie B per spec
// out-of-scope. Flip test.skip → test() when Sortie B composer UI is live
// + authenticated session helper exists.
//
// Verifies end-to-end shape:
//   1. Admin uploads .csv via /api/botsson/imports/upload (Sortie 0 BFF)
//   2. Client sends /api/emma/chat with userMessageAttachments
//   3. Stage-engine attachment-dispatcher routes to bulk_import capability
//   4. parse_spreadsheet tool returns { sheets, excel_sha256, suggested_mapping }
//
// Sortie A unit tests (packages/ai/src/capabilities/bulk_import/tools.test.ts)
// cover the tool body; this spec adds the cross-layer wiring proof.
//
// Prerequisites (REQUIRED — test is marked test.skip until Sortie B ships):
//   1. Supabase Local running: `npx supabase start`
//   2. Next.js dev server on port 3060:
//      `op run --env-file=.env.template -- pnpm dev --filter @smartout/web`
//   3. Storage bucket "botsson-imports" exists (Sortie 0 migration applied)
//   4. Stage-engine container running:
//      `cd infra && docker compose up -d stage-engine`
//   5. apps/e2e/.env.local configured with:
//      SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, STAGE_ENGINE_API_KEY
//   6. Sortie B composer UI live + loginAsAdmin() returns authenticated session
//
// Journey: JOURNEY-bulk-import-sortie-a.md
// Flip trigger: Sortie B task 1 — remove test.skip guard after UI + auth wired
// =============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import { loginAsAdmin } from "../helpers/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Seeded test workspace from seed.sql.
 * Source: MEMORY.md "Inspect Pontus's interactions" + botsson-harness.ts.
 * Override via TEST_WORKSPACE_ID env var for non-default seeds.
 */
const WORKSPACE_ID = process.env.TEST_WORKSPACE_ID ?? "b0000000-0000-0000-0000-000000000000";

/**
 * Sortie A fixture — 5-row vaktliste covering multi-row parsing.
 * Norwegian chars (Kjøkken) verify UTF-8 round-trip through storage + tool.
 */
const FIXTURE_PATH = join(__dirname, "fixtures", "vaktliste-sortie-a.csv");

// Fail fast at module load if fixture is missing (mirrors Sortie 0 pattern).
const CSV_BUFFER: Buffer = readFileSync(FIXTURE_PATH);

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("bulk_import Sortie A — parse_spreadsheet end-to-end smoke", () => {
  /**
   * SCAFFOLD: test is skipped until Sortie B lands the composer UI.
   *
   * To flip: remove the test.skip() call below and ensure Prerequisites
   * 1-6 above are satisfied. Assertions may need accessor adjustment once
   * the /api/emma/chat response envelope is finalised in Sortie B.
   */
  test.skip("parse_spreadsheet returns parsed sheets + sha256 + suggested mapping via chat dispatch", async ({
    page,
  }) => {
    // Establish auth session (sets Supabase SSR cookies on the page context).
    await loginAsAdmin(page);

    // Step 1: upload CSV via Sortie 0 BFF endpoint.
    const uploadRes = await page.request.post("/api/botsson/imports/upload", {
      multipart: {
        workspace_id: WORKSPACE_ID,
        file: {
          name: "vaktliste-sortie-a.csv",
          mimeType: "text/csv",
          buffer: CSV_BUFFER,
        },
      },
    });
    expect(uploadRes.status(), "upload endpoint must return 200").toBe(200);

    const upload = (await uploadRes.json()) as Record<string, unknown>;

    // storage_path format: botsson-imports/<uuid>/<filename>
    expect(
      typeof upload.storage_path === "string" &&
        /^botsson-imports\/[0-9a-f-]{36}\//.test(upload.storage_path as string),
      `storage_path must match botsson-imports/<uuid>/ prefix, got: ${JSON.stringify(upload.storage_path)}`,
    ).toBe(true);

    // Step 2: dispatch chat with the attachment → MIME dispatcher → bulk_import.parse_spreadsheet.
    const chatRes = await page.request.post("/api/emma/chat", {
      data: {
        workspaceId: WORKSPACE_ID,
        userMessage: "Parse this vaktliste",
        userMessageAttachments: [
          {
            storage_path: upload.storage_path,
            filename: "vaktliste-sortie-a.csv",
            mime_type: "text/csv",
            size: CSV_BUFFER.length,
            sha256: "",
            kind: "vaktliste",
          },
        ],
      },
    });
    expect(chatRes.status(), "emma/chat with attachment must return 200").toBe(200);

    const body = (await chatRes.json()) as Record<string, unknown>;

    // Shape: tool result includes sheets[0].headers + excel_sha256 + suggested_mapping.
    // Exact response envelope: adjust accessor in Sortie B once confirmed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tool: any = (body.toolResults as any[])?.[0] ?? (body.tool_results as any[])?.[0];

    expect(
      tool?.sheets?.[0]?.headers,
      "first sheet headers must include all fixture columns",
    ).toEqual(expect.arrayContaining(["name", "start", "end", "department"]));

    expect(tool?.excel_sha256, "excel_sha256 must be a 64-char hex string").toMatch(
      /^[a-f0-9]{64}$/,
    );

    expect(
      tool?.suggested_mapping,
      "suggested_mapping must contain canonical column → fixture column pairs",
    ).toMatchObject({
      employee_name: "name",
      start_time: "start",
      end_time: "end",
      department: "department",
      location: null,
    });
  });
});

// ─── Fixture validation (no infra required) ───────────────────────────────────

test.describe("bulk_import Sortie A — fixture validation (no infra required)", () => {
  test("vaktliste-sortie-a.csv has correct format + 5 data rows", () => {
    const content = CSV_BUFFER.toString("utf-8");
    const lines = content.trim().split("\n");

    // Header + 5 data rows.
    expect(lines.length, "fixture must have header + 5 data rows").toBe(6);

    const header = lines[0] ?? "";
    expect(header, "header must contain name column").toContain("name");
    expect(header, "header must contain start column").toContain("start");
    expect(header, "header must contain end column").toContain("end");
    expect(header, "header must contain department column").toContain("department");

    // Spot-check Norwegian characters survive UTF-8 round-trip.
    const allRows = lines.slice(1).join("\n");
    expect(allRows, "fixture must contain Norwegian department name Kjøkken").toContain("Kjøkken");

    // Every data row must have 4 comma-separated fields.
    for (let i = 1; i < lines.length; i++) {
      const fields = (lines[i] ?? "").split(",");
      expect(fields.length, `row ${i} must have 4 fields (got ${fields.length}): ${lines[i]}`).toBe(
        4,
      );
    }
  });
});
