// packages/ai/src/capabilities/bulk_import/tools.test.ts
// Unit tests for the parse_spreadsheet tool (Sortie A — read-only).
//
// Key contracts verified:
//   - L-0177: workspace-path mismatch → fail-fast error string (no silent fallback)
//   - ADR-0402: xlsx/xls → explicit rejection citing ADR-0402
//   - ADR-0287: exactly ONE emit per successful parse
//   - ADR-0151: workspace_id comes from ctx (not input)
//   - Sortie A is read-only — no DB inserts or updates occur

import { describe, expect, it, vi, beforeEach } from "vitest";
import { emit } from "@smartout/telemetry";
import { nonEmpty } from "@smartout/telemetry/server";
import type { AgentToolContext } from "../types.js";
import { parseSpreadsheetTool } from "./tools.js";

// ─── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("@smartout/telemetry", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  nonEmpty: (v: string) => v,
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const PROFILE_ID = "20000000-0000-0000-0000-000000000001";

const CSV_CONTENT = "name,start,end\nKnut,08:00,16:00\nMaria,09:00,17:00\n";
const csvBytes = Buffer.from(CSV_CONTENT, "utf8");

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty(WORKSPACE_ID, "workspaceId"),
    profileId: nonEmpty(PROFILE_ID, "profileId"),
    sessionId: "session-test-1",
    supabaseAdmin: {
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: "https://storage.example.test/file.csv" },
            error: null,
          }),
        }),
      },
    } as unknown as AgentToolContext["supabaseAdmin"],
    channel: "chat",
    ...overrides,
  };
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Provide a fetch mock that returns the CSV bytes.
  // IMPORTANT: use `new Uint8Array(csvBytes).buffer` — NOT `csvBytes.buffer.slice(0)`.
  // Node.js Buffer.buffer is the SHARED 8192-byte backing store; slicing from 0 includes
  // garbage before the actual data (the buffer is allocated with byteOffset > 0 when the
  // original Buffer was created from a string). Wrapping in Uint8Array gives the correctly
  // sized, zero-offset ArrayBuffer.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new Uint8Array(csvBytes).buffer),
  }) as unknown as typeof fetch;
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("parseSpreadsheetTool", () => {
  describe("L-0177: workspace-path enforcement (fail-fast, no silent fallback)", () => {
    it("rejects path prefixed with a different workspace_id", async () => {
      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: "botsson-imports/OTHER-WORKSPACE/roster.csv",
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(result).toMatch(/does not belong to workspace/);
      expect(result).toContain(WORKSPACE_ID);
    });

    it("rejects path with no workspace prefix at all", async () => {
      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: "botsson-imports/roster.csv",
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(result).toMatch(/does not belong to workspace/);
    });
  });

  describe("ADR-0402: xlsx/xls rejection (Sortie A is CSV-only)", () => {
    it("rejects .xlsx with ADR-0402 reference", async () => {
      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.xlsx`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(result).toMatch(/ADR-0402/);
      expect(result).toMatch(/Sortie B/);
    });

    it("rejects .xls with ADR-0402 reference", async () => {
      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.xls`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(result).toMatch(/ADR-0402/);
    });

    it("rejects unsupported extension (not .csv)", async () => {
      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.txt`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(result).toMatch(/unsupported file extension/i);
      expect(result).toMatch(/ADR-0402/);
    });
  });

  describe("happy path: CSV parse + emit + return", () => {
    it("parses CSV and returns sheets + sha256 + suggested_mapping", async () => {
      const raw = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );

      const result = JSON.parse(raw) as {
        sheets: { name: string; headers: string[]; rows: unknown[] }[];
        excel_sha256: string;
        suggested_mapping: Record<string, string | null>;
      };

      // CSV has 2 data rows
      expect(result.sheets).toHaveLength(1);
      expect(result.sheets[0]!.name).toBe("vaktliste");
      expect(result.sheets[0]!.headers).toEqual(["name", "start", "end"]);
      expect(result.sheets[0]!.rows).toHaveLength(2);

      // SHA-256 is a 64-char hex string
      expect(result.excel_sha256).toMatch(/^[a-f0-9]{64}$/);

      // suggested_mapping: "name" header matches employee_name
      expect(result.suggested_mapping.employee_name).toBe("name");
    });

    it("emits bulk_import.batch_parsed EXACTLY ONCE per successful parse (ADR-0287)", async () => {
      await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );

      expect(emit).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "bulk_import.batch_parsed",
          workspace_id: WORKSPACE_ID,
          actor_id: PROFILE_ID,
          properties: expect.objectContaining({
            data: expect.objectContaining({
              workspace_id: WORKSPACE_ID,
              profile_id: PROFILE_ID,
              source_kind: "vaktliste",
              sheet_count: 1,
              row_count: 2,
            }),
          }),
        }),
      );
    });

    it("sha256 is deterministic for the same bytes", async () => {
      const run1 = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      const run2 = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );
      expect(JSON.parse(run1).excel_sha256).toBe(JSON.parse(run2).excel_sha256);
    });
  });

  describe("storage / download error paths", () => {
    it("returns error string on signed URL failure (no emit)", async () => {
      const ctx = makeCtx();
      (
        ctx.supabaseAdmin as unknown as { storage: { from: ReturnType<typeof vi.fn> } }
      ).storage.from = vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Bucket not found" },
        }),
      });

      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        ctx,
      );

      expect(result).toMatch(/could not generate signed URL/i);
      expect(result).toMatch(/Bucket not found/);
      expect(emit).not.toHaveBeenCalled();
    });

    it("returns error string on HTTP download failure (no emit)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      }) as unknown as typeof fetch;

      const result = await parseSpreadsheetTool.execute(
        {
          source_storage_path: `botsson-imports/${WORKSPACE_ID}/roster.csv`,
          source_kind: "vaktliste",
        },
        makeCtx(),
      );

      expect(result).toMatch(/download failed with HTTP 403/i);
      expect(emit).not.toHaveBeenCalled();
    });
  });
});
