// packages/ai/src/capabilities/bulk_import/tools.ts
// bulk_import Sortie A: parse_spreadsheet tool (read-only).
//
// ADRs: 0401 (capability), 0151 (server-derived workspace_id on AgentToolContext),
//       0287 (ONE emit per successful parse), 0402 (xlsx ships Sortie B — CSV-only here).
// Learnings: L-0176 (body before docstring), L-0177 (fail-fast on workspace mismatch — no
//            silent fallback), L-0133 (mobile parity: no DB write in Sortie A).
//
// Per L-0176: tool body written first, Tool Compliance Self-Check verified,
// description written last (after body passes self-check).

import { z } from "zod";
import { parseCsv, sha256Hex } from "@smartout/utils";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// ─── Header → canonical field pattern maps ────────────────────────────────────

const VAKTLISTE_HEADER_MAP: Record<string, RegExp> = {
  employee_name: /^(name|navn|ansatt|employee)$/i,
  start_time: /^(start|fra|start_time|starttid)$/i,
  end_time: /^(end|til|stop|stopp|end_time|slutttid)$/i,
  department: /^(department|avdeling|avd)$/i,
  location: /^(location|lokasjon|sted|filial)$/i,
};

const KJOREPLAN_HEADER_MAP: Record<string, RegExp> = {
  time: /^(time|tid|klokkeslett|kl)$/i,
  location: /^(location|lokasjon|sted)$/i,
  tasks: /^(tasks|oppgaver|gj[oø]remal|gjøremål)$/i,
};

function suggestMapping(
  headers: string[],
  kind: "vaktliste" | "kjoreplan" | "mixed",
): Record<string, string | null> {
  // mixed: try vaktliste map (superset of kjoreplan for display purposes in Sortie A)
  const map = kind === "kjoreplan" ? KJOREPLAN_HEADER_MAP : VAKTLISTE_HEADER_MAP;
  const result: Record<string, string | null> = {};
  for (const [canonical, pattern] of Object.entries(map)) {
    result[canonical] = headers.find((h) => pattern.test(h.trim())) ?? null;
  }
  return result;
}

// ─── Tool input schema ─────────────────────────────────────────────────────────

const parseSpreadsheetInputSchema = z.object({
  source_storage_path: z
    .string()
    .min(1)
    .describe(
      "Full object path inside the botsson-imports bucket, e.g. botsson-imports/{workspace_id}/filename.csv",
    ),
  source_kind: z
    .enum(["vaktliste", "kjoreplan", "mixed"])
    .describe("Import type: vaktliste (shift roster), kjoreplan (daily plan), or mixed"),
});

// ─── Tool body (L-0176: body written before description) ──────────────────────

export const parseSpreadsheetTool = defineTool({
  name: "parse_spreadsheet",
  description:
    "Read-only: download a previously uploaded spreadsheet from the workspace-scoped " +
    "botsson-imports storage bucket, validate extension (CSV only in Sortie A — xlsx/xls " +
    "ships Sortie B per ADR-0402), parse rows, and return parsed sheets + a suggested " +
    "header→canonical-field mapping (vaktliste or kjøreplan pattern-matched). Does NOT " +
    "write to import_run — that happens in Sortie B preview_batch. Authority: suggest, " +
    "chat-only, admin+ per ADR-0401. PII-adjacent: file contents reach this tool, but no " +
    "DB writes occur. Compliance verified: ADR-0151 server-derived workspace_id on ctx, " +
    "L-0176 body-before-docstring, L-0177 fail-fast on workspace-path mismatch, ADR-0287 " +
    "ONE emit per successful parse, ADR-0402 xlsx Sortie B gate.",
  capability: "bulk_import",
  schema: parseSpreadsheetInputSchema,
  execute: async (params, ctx: AgentToolContext): Promise<string> => {
    // ── ADR-0151 + L-0177: workspace_id + profile_id are server-derived
    //    on AgentToolContext (NonEmptyString). They are guaranteed non-empty
    //    by the type. NO fallback to user-supplied input permitted.
    const workspaceId = ctx.workspaceId;
    const profileId = ctx.profileId;

    // ── L-0177: enforce workspace-prefixed storage path — fail-fast, NO silent
    //    fallback to any other workspace.
    const expectedPrefix = `botsson-imports/${workspaceId}/`;
    if (!params.source_storage_path.startsWith(expectedPrefix)) {
      return (
        `parse_spreadsheet: storage_path does not belong to workspace ${workspaceId}. ` +
        `Expected prefix: "${expectedPrefix}". Got: "${params.source_storage_path}".`
      );
    }

    // ── ADR-0402: Sortie A is CSV-only. xlsx/xls are explicitly rejected
    //    with an ADR reference so callers understand when to expect xlsx support.
    const lower = params.source_storage_path.toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      return (
        "parse_spreadsheet: xlsx/xls parsing ships in Sortie B per ADR-0402. " +
        "Use a .csv export for Sortie A."
      );
    }
    if (!lower.endsWith(".csv")) {
      return (
        `parse_spreadsheet: unsupported file extension on "${params.source_storage_path}". ` +
        "Expected .csv (xlsx support ships Sortie B per ADR-0402)."
      );
    }

    // ── Fetch signed URL (1h TTL). Strip the "botsson-imports/" prefix — the
    //    Supabase Storage .from() call already scopes to that bucket.
    const objectPath = params.source_storage_path.slice("botsson-imports/".length);
    const { data: signed, error: signErr } = await ctx.supabaseAdmin.storage
      .from("botsson-imports")
      .createSignedUrl(objectPath, 3600);

    if (signErr || !signed?.signedUrl) {
      return (
        `parse_spreadsheet: could not generate signed URL for "${params.source_storage_path}": ` +
        (signErr?.message ?? "unknown storage error")
      );
    }

    // ── Download file bytes
    const res = await fetch(signed.signedUrl);
    if (!res.ok) {
      return `parse_spreadsheet: download failed with HTTP ${res.status} from signed URL.`;
    }
    const buf = Buffer.from(await res.arrayBuffer());

    // ── Task 8: sha256Hex for file-level idempotency (ADR-0401)
    const excelSha256 = sha256Hex(buf);

    // ── Task 7: parseCsv — throws on empty file or parse error (bubbles as string)
    let sheets;
    try {
      const text = buf.toString("utf8");
      sheets = parseCsv(text, { sheetName: params.source_kind });
    } catch (err) {
      return `parse_spreadsheet: CSV parse error — ${err instanceof Error ? err.message : String(err)}`;
    }

    // ── Pattern-match headers to canonical fields
    const headers = sheets[0]?.headers ?? [];
    const suggestedMapping = suggestMapping(headers, params.source_kind);
    const mappedCount = Object.values(suggestedMapping).filter((v) => v !== null).length;
    const totalCanonical = Object.keys(suggestedMapping).length;
    const mappingCompleteness =
      totalCanonical > 0 ? Number((mappedCount / totalCanonical).toFixed(2)) : 0;

    // ── ADR-0287: ONE emit per successful parse. NEVER on error paths above.
    await emit({
      event: "bulk_import.batch_parsed",
      workspace_id: workspaceId,
      actor_id: profileId,
      properties: {
        data: {
          workspace_id: workspaceId,
          profile_id: profileId,
          source_kind: params.source_kind,
          sheet_count: sheets.length,
          row_count: sheets.reduce((sum, s) => sum + s.rows.length, 0),
          excel_sha256: excelSha256,
          suggested_mapping_completeness: mappingCompleteness,
        },
      },
    });

    return JSON.stringify({
      sheets,
      excel_sha256: excelSha256,
      suggested_mapping: suggestedMapping,
    });
  },
});
