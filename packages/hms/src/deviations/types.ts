import type { DeviationDomain, DeviationSeverity } from "./schema";

export type DeviationStatus = "open" | "acknowledged" | "resolved" | "escalated";

export type DeviationRow = {
  deviationId: string;
  workspaceId: string;
  departmentId: string | null;
  departmentName: string | null;
  sessionId: string | null;
  sourceTaskId: string | null;
  procedureId: string | null;
  protocolId: string | null;
  domain: DeviationDomain;
  severity: DeviationSeverity;
  status: DeviationStatus;
  title: string;
  description: string | null;
  reportedBy: string | null;
  reporterName: string | null;
  resolvedBy: string | null;
  resolverName: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  attachments: unknown;
  blocksDayApproval: boolean;
  requiresAction: boolean;
  createdAt: string;
  updatedAt: string;
};
