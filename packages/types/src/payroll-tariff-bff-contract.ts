/**
 * Payroll Tariff BFF Contract — Phase 7e
 *
 * Shared Zod schemas for the 3 BFF routes that wrap Phase 7f payroll capability
 * tools (setup_workspace_tariff / change_workspace_tariff / add_supplement_override).
 *
 * Owner: Phase 7e Track 1 (BFF agent).
 * Consumers: Track 2 (onboarding), Track 3 (admin page), Track 4 (mobile read).
 *
 * Versioning rule: NEVER widen response shapes once consumers ship. Add new fields
 * as optional with default values, or add a new endpoint.
 *
 * ADR references:
 * - ADR-0152 — Structured error envelope (response.error shape)
 * - ADR-0356 — Cascade-namespace delegation (audit-symmetry in response audit block)
 * - ADR-0151 — Server-side workspace_id derivation (workspace_id NOT in request body
 *              for derive-from-JWT paths; explicit only when caller is platform-admin)
 * - ADR-0078 — Channel guard (BFF enforces chat channel for capability invocation)
 */
import { z } from "zod";

// =============================================================================
// Domain vocabulary enums — single source of truth for consumers
// =============================================================================

/**
 * Union binding identifiers — matches workspace_union_binding.union_id CHECK constraint
 * and tools/DB taxonomy (ADR-0355). Phase 7g: changed from z.string().uuid() to enum
 * so callers never need UUID→taro-ID translation layers.
 */
export const unionIdSchema = z.enum(["taro-79", "taro-226", "non-bound"]);
export type UnionId = z.infer<typeof unionIdSchema>;

// =============================================================================
// Common — error envelope (ADR-0152)
// =============================================================================

export const payrollTariffErrorCodeSchema = z.enum([
  // Pass-through from cascade
  "INVALID_WORKSPACE",
  "MISSING_PROFILE_CONTEXT",
  "AMENDMENT_BLOCKED",
  "SUPPLEMENT_BELOW_TARIFF_FLOOR",
  "CROSS_WORKSPACE_BLOCKED",
  // Payroll-layer
  "TARIFF_ALREADY_BOUND",
  "NO_EXISTING_BINDING",
  // BFF-layer
  "UNAUTHORIZED",
  "INVALID_CHANNEL",
  "RATE_LIMITED",
  "BFF_INTERNAL_ERROR",
]);

export type PayrollTariffErrorCode = z.infer<typeof payrollTariffErrorCodeSchema>;

export const payrollTariffErrorSchema = z.object({
  code: payrollTariffErrorCodeSchema,
  message: z.string(),
  // Optional ADR-0152 envelope extensions
  aml_ref: z.string().optional(),
  floor: z.number().optional(),
  proposed: z.number().optional(),
  retry_after_seconds: z.number().optional(),
});

export type PayrollTariffError = z.infer<typeof payrollTariffErrorSchema>;

// =============================================================================
// Audit block — both layers' emit IDs returned for client-side trace
// =============================================================================

export const payrollTariffAuditSchema = z.object({
  payroll_emit_id: z.string().uuid(),
  cascade_emit_id: z.string().uuid(),
  actor_capability: z.literal("payroll"),
  delegated_via: z.literal("cascade"),
});

export type PayrollTariffAudit = z.infer<typeof payrollTariffAuditSchema>;

// =============================================================================
// POST /api/payroll/tariff/setup
// =============================================================================

export const setupTariffRequestSchema = z.object({
  union_id: unionIdSchema,
  law_version: z.string().min(1), // "2024" / "2025" / "2026"
  official_effective_date: z.string().date(), // ISO YYYY-MM-DD
  effective_from: z.string().date().optional(), // defaults to today server-side
});

export const setupTariffResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.object({
      workspace_union_binding_id: z.string().uuid(),
      effective_from: z.string().date(),
      union_id: unionIdSchema,
      law_version: z.string(),
    }),
    audit: payrollTariffAuditSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: payrollTariffErrorSchema,
  }),
]);

export type SetupTariffRequest = z.infer<typeof setupTariffRequestSchema>;
export type SetupTariffResponse = z.infer<typeof setupTariffResponseSchema>;

// =============================================================================
// POST /api/payroll/tariff/change
// =============================================================================

export const changeTariffRequestSchema = z.object({
  new_union_id: unionIdSchema,
  new_law_version: z.string().min(1),
  official_effective_date: z.string().date(),
  effective_from: z.string().date().optional(),
  reason: z.string().max(500).optional(),
});

export const changeTariffResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.object({
      old_workspace_union_binding_id: z.string().uuid(),
      new_workspace_union_binding_id: z.string().uuid(),
      effective_from: z.string().date(),
      amendment_classifier: z.enum(["UP", "MATERIAL", "ENDRINGSOPPSIGELSE"]),
      old_law_version: z.string(),
      new_law_version: z.string(),
    }),
    audit: payrollTariffAuditSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: payrollTariffErrorSchema,
  }),
]);

export type ChangeTariffRequest = z.infer<typeof changeTariffRequestSchema>;
export type ChangeTariffResponse = z.infer<typeof changeTariffResponseSchema>;

// =============================================================================
// POST /api/payroll/tariff/supplement
// =============================================================================

/**
 * Supplement type — DB taxonomy per CHECK constraint on public.supplement_rule.
 * Phase 7g: changed from UX labels (evening/night/…) to DB taxonomy
 * (normal/week_based/…). Consumers submit DB values directly; no BFF translation layer.
 */
export const supplementTypeSchema = z.enum([
  "normal",
  "week_based",
  "day_based",
  "manual",
  "holiday",
  "contract_rule",
]);
export type SupplementType = z.infer<typeof supplementTypeSchema>;

/**
 * Rate type — matches rate_type column on public.supplement_rule.
 * Phase 7g: changed from UX labels (fixed_amount/hourly_rate) to DB values
 * (fixed_per_hour/fixed_per_shift). Callers pass DB values directly.
 */
export const rateTypeSchema = z.enum(["fixed_per_hour", "percentage", "fixed_per_shift"]);
export type RateType = z.infer<typeof rateTypeSchema>;

export const addSupplementRequestSchema = z.object({
  supplement_type: supplementTypeSchema,
  rate_value: z.number().positive(),
  rate_type: rateTypeSchema,
  paragraf_ref: z.string().optional(), // e.g. "Riksavtalen §6"
  match_predicate: z.record(z.unknown()), // JSONB shape — agent-authored
  name: z.string().min(1).max(200),
  tariff_rate_table_id: z.string().uuid().optional(),
});

export const addSupplementResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.object({
      supplement_rule_id: z.string().uuid(),
      name: z.string(),
      rate_value: z.number(),
      rate_type: rateTypeSchema,
    }),
    audit: payrollTariffAuditSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: payrollTariffErrorSchema,
  }),
]);

export type AddSupplementRequest = z.infer<typeof addSupplementRequestSchema>;
export type AddSupplementResponse = z.infer<typeof addSupplementResponseSchema>;

// =============================================================================
// GET /api/payroll/tariff/current — read endpoint (mobile + admin page)
// =============================================================================

export const currentTariffResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    data: z.object({
      workspace_union_binding_id: z.string().uuid().nullable(),
      union_id: unionIdSchema.nullable(),
      union_name: z.string().nullable(),
      law_version: z.string().nullable(),
      effective_from: z.string().date().nullable(),
      is_bound: z.boolean(),
      paragraf_references: z
        .array(
          z.object({
            paragraf: z.string(),
            description: z.string(),
            rate_value: z.number().optional(),
            rate_type: rateTypeSchema.optional(),
          }),
        )
        .default([]),
    }),
  }),
  z.object({
    ok: z.literal(false),
    error: payrollTariffErrorSchema,
  }),
]);

export type CurrentTariffResponse = z.infer<typeof currentTariffResponseSchema>;

// =============================================================================
// BFF route paths — single source of truth
// =============================================================================

export const PAYROLL_TARIFF_BFF_ROUTES = {
  setup: "/api/payroll/tariff/setup",
  change: "/api/payroll/tariff/change",
  supplement: "/api/payroll/tariff/supplement",
  current: "/api/payroll/tariff/current",
} as const;

export type PayrollTariffRoute =
  (typeof PAYROLL_TARIFF_BFF_ROUTES)[keyof typeof PAYROLL_TARIFF_BFF_ROUTES];
