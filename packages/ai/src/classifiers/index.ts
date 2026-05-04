/**
 * classifiers — public surface for message-time classifiers used by the
 * soft-hold hook path (ADR-0166) and future sensitive-data gates.
 *
 * Keep exports narrow. Internal helpers (regex rules, overlap logic) stay
 * module-private. Callers only need:
 *   - `classifyPii` for the classification call itself
 *   - `PII_CLASSIFIER_VERSION` for telemetry / audit serialization
 *   - The result / match types for typed consumption
 */

export {
  classifyPii,
  PII_CLASSIFIER_VERSION,
  type PiiCategory,
  type PiiMatch,
  type PiiClassificationResult,
} from "./pii-classifier.js";
