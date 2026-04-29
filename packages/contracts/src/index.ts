/**
 * @smartout/contracts — Server-only contract business logic.
 *
 * Exported modules:
 *   - amendment-handler: classifyChange / classifyBatch (ADR-0235)
 *   - field-classification: FIELD_CLASSIFICATION const + getFieldClassification (ADR-0235)
 *
 * NOT for browser use. These handlers are invoked via gate_action channel='system'
 * or from Next.js Server Actions.
 */

export * from "./field-classification.js";
export * from "./amendment-handler.js";
