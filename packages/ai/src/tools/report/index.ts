// ============================================
// report/index.ts
// Barrel export for all AI report builder tools.
// 5 tools total: list sources, preview, save, list saved, delete.
// Connected to: packages/ai/src/agents/reports.ts (agent that registers these)
// ============================================

// Types
export type {
  ReportConfig,
  ReportDataSource,
  ReportMetric,
  ReportGroupBy,
  ReportFilter,
  ReportVisualization,
  ReportToolContext,
} from "./types";

// Individual tool exports
export { listDataSources } from "./list-data-sources";
export { previewReport } from "./preview-report";
export { saveReport } from "./save-report";
export { listSavedReports } from "./list-saved-reports";
export { deleteReport } from "./delete-report";

// All tools array for agent registration
import { listDataSources } from "./list-data-sources";
import { previewReport } from "./preview-report";
import { saveReport } from "./save-report";
import { listSavedReports } from "./list-saved-reports";
import { deleteReport } from "./delete-report";

/** All 5 report builder tools. Pass to toVercelTools() with a ReportToolContext. */
export const REPORT_TOOLS = [
  listDataSources,
  previewReport,
  saveReport,
  listSavedReports,
  deleteReport,
] as const;
