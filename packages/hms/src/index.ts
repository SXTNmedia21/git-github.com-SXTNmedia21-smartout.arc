/**
 * @smartout/hms — shared HMS hooks and utilities.
 * Hooks that depend on web-app-specific imports live in apps/web/src/app/dashboard/hms/_hooks/.
 * This package contains shared types, schemas, and utilities for web + mobile.
 */

export {
  DeviationPayloadSchema,
  deviationDomainValues,
  deviationSeverityValues,
  type DeviationPayload,
  type DeviationDomain,
  type DeviationSeverity,
} from "./deviations/schema";

export { type DeviationRow, type DeviationStatus } from "./deviations/types";
