// settlement/types.ts — input/output shapes for the avstemming server-side pipeline.
//
// Re-exports the core settlement DB shapes from the root types module for
// convenient single-import in settlement/run.ts and the server action.
// Application-level I/O types (not stored in DB) are defined here.

export type {
  SettlementPeriod,
  SettlementPeriodInsert,
  SettlementPeriodUpdate,
  SettlementRun,
  SettlementRunInsert,
  SettlementArtifact,
  SettlementArtifactInsert,
  SettlementStatus,
  SettlementRunStatus,
  SettlementArtifactType,
  SettlementScope,
  SettlementSummary,
  SettlementDiscrepancy,
  SettlementWorkspaceSummary,
  SettlementTotals,
} from "../../types";

/** Input to executeSettlementRun — caller provides period + workspace scope. */
export type RunSettlementInput = {
  period_start: Date | string;
  period_end: Date | string;
  workspace_ids: string[];
  scope: import("../../types").SettlementScope;
};

/** Returned by executeSettlementRun. */
export type RunSettlementResult = {
  run_id: string;
  status: "succeeded" | "failed";
  artifacts_url: string;
  error?: string;
};

/**
 * An in-memory artifact ready for upload to Supabase Storage.
 * `content` is a Buffer (for PDFs) or string (for CSV).
 */
export type RenderedArtifact = {
  type: import("../../types").SettlementArtifactType;
  content: Buffer | string;
  contentType: string;
  filename: string;
};
