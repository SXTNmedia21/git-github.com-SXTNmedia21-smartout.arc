// packages/ai/src/router/attachment-dispatch.ts
/**
 * MIME-type deterministic capability dispatch.
 *
 * When the user attaches a file (.xlsx/.xls/.csv), route directly to bulk_import
 * capability — skip LLM intent classifier roundtrip.
 *
 * Spec: docs/superpowers/specs/2026-05-23-bulk-import-design.md (Sortie 0)
 * Council 2026-05-23: Agent-Coordinator recommended deterministic routing.
 */

import type { CapabilityName } from "../capabilities/types.js";

export type AttachmentMetadata = {
  storage_path: string;
  signed_url: string;
  mime: string;
  size_bytes: number;
  filename: string;
  expires_at: string;
};

export type AttachmentDispatchResult = {
  capability: CapabilityName;
  source: "deterministic_attachment";
  filename: string;
};

const SPREADSHEET_MIMES = new Set<string>([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
]);

export function resolveCapabilityFromAttachments(
  attachments: ReadonlyArray<AttachmentMetadata> | undefined,
): AttachmentDispatchResult | null {
  if (!attachments || attachments.length === 0) return null;

  const spreadsheet = attachments.find((a) => SPREADSHEET_MIMES.has(a.mime));
  if (spreadsheet) {
    return {
      capability: "bulk_import",
      source: "deterministic_attachment",
      filename: spreadsheet.filename,
    };
  }
  return null;
}
