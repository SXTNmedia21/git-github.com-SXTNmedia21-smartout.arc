import type { Mapping } from "../research/mapping.js";
import type { BubbleRecord } from "../bubble/types.js";

export interface MigrationContext {
  workspaceId: string;
  workspaceSlug: string;
  mapping: Mapping;
  companyId: string | null;
}

export interface EmittedRow {
  table: string;
  values: Record<string, unknown>;
}

export interface RecordSkip {
  recordId: string;
  reason: string;
}

export interface MigrationResult {
  rows: EmittedRow[];
  skipped: RecordSkip[];
  warnings: string[];
}

export interface MigrationReport {
  entity: string;
  workspaceId: string;
  workspaceSlug: string;
  recordsProcessed: number;
  recordsEmitted: number;
  recordsSkipped: number;
  warnings: string[];
  generatedAt: string;
  sqlFilePath: string;
  reportFilePath: string;
}

// Re-export for callers
export type { Mapping, BubbleRecord };
