/**
 * Cascade Core Foundation — Pure Computation Engine
 *
 * Phase B pure functions for the cascade proposal pipeline.
 * No database dependencies — all functions take data in, return data out.
 *
 * Spec: docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md
 */

export { resolveEffectiveHours } from "./resolve-hours";
export { computeAnchoredTime } from "./compute-anchored-shift";
export { evaluateFrameworkRules } from "./evaluate-framework-rules";
export { validateProposalFreshness, computeStateHash } from "./validate-proposal-freshness";

export type {
  // Operating hours
  EffectiveHours,
  AnchorInput,
  AnchorType,
  ComputedShiftTime,
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
  // Legacy evaluation types (kept for existing consumers)
  Conflict,
  ConflictCategory,
  ConflictSeverity,
  EvaluationOutcome,
  FrameworkRule,
  WorkspaceRuleOverride,
  ProposedChange,
  // Proposal freshness
  ChangeProposalRow,
  FreshnessResult,
  // Bootstrap types
  BootstrapSourcePath,
  BootstrapStatus,
  BootstrapWarning,
  BootstrapStepName,
  // Tariff types
  TariffContext,
  TariffRateRow,
  TariffSupplement,
  TariffResolution,
  // New evaluation types (Phase B)
  EvaluationOutcomeLevel,
  RuleHit,
  EvaluationResult,
  EntityContext,
  FrameworkRuleRow,
  WorkspaceRuleOverrideRow,
} from "./types";
