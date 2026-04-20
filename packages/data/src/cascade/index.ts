export {
  type CascadeDimension,
  type MutationType,
  type EntityClassification,
  ENTITY_CLASSIFICATION,
  getEntityClassification,
  isCascadeInput,
  isGovernanceGated,
  isContentEntity,
} from "./classify.js";

export {
  type EvaluationOutcome,
  type RuleSeverity,
  type FrameworkRule,
  type EvaluationContext,
  type EvaluationResult,
  type AggregatedEvaluation,
  type EvaluationConfig,
  type Condition,
  EvaluationConfigSchema,
  evaluateFrameworkRules,
  ruleSeverityToOutcome,
} from "./evaluate-rules.js";
