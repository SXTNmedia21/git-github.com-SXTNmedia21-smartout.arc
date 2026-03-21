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
  EffectiveHours,
  AnchorInput,
  AnchorType,
  ComputedShiftTime,
  Conflict,
  ConflictCategory,
  ConflictSeverity,
  EvaluationOutcome,
  FrameworkRule,
  WorkspaceRuleOverride,
  ProposedChange,
  ChangeProposalRow,
  FreshnessResult,
  DepartmentOperatingHoursRow,
  DepartmentHoursOverrideRow,
} from "./types";
