// packages/ai/src/capabilities/legal/tools.ts
//
// Lovsen capability tools — Norsk arbeidsrett compliance for hospitality.
// Phase 0c scaffold: tool bodies are stubs returning pass=true.
// Real Lovdata MCP integration is Phase 0c+ (separate work).
//
// What: Three tools — validate_aml_14_6, cite_law, classify_amendment.
//       validate_aml_14_6 is the mandatory gate in /api/contracts/send.
//       cite_law is read-only reference for chat + voice.
//       classify_amendment is server-only, drives amendment flow.
//
// Why:  ADR-0242 (legal as third capability sibling to contract + payroll).
//       ADR-0234 capability split. ADR-0078 per-tool channel restriction.
//       ADR-0099 gate_action enforce on classify_amendment (default_allow:false).
//       ADR-0151 workspace_id from JWT, not body.

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import { validateAml1415Logic } from "./aml-14-15.js";
import type { Aml1415ValidationResult } from "./aml-14-15.js";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

// ── Shared output shapes ─────────────────────────────────────────────────────

export type Aml146Issue = {
  severity: "error" | "warning";
  paragraph: string;
  field: string;
  /** Single bokstav letter (a–q) from Aml. §14-6. Added ADR-0308. */
  bokstav:
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g"
    | "h"
    | "i"
    | "j"
    | "k"
    | "l"
    | "m"
    | "n"
    | "o"
    | "p"
    | "q"
    | string;
  message_no: string;
  remediation: string;
  /** Evidence fields required to remediate. Added ADR-0308. */
  evidence_required: string[];
  confidence: "HØY" | "MEDIUM" | "LAV";
};

export type Aml146ValidationResult = {
  pass: boolean;
  status: "passes" | "missing_fields" | "warnings" | "skip";
  errors: Aml146Issue[];
  warnings: Aml146Issue[];
  citation: string;
  validator_version: string;
};

export type AmendmentClassification =
  | "material"
  | "admin"
  | "derived"
  | "system"
  | "blocked"
  | "review_required";

export type ClassifyAmendmentResult = {
  classification: AmendmentClassification;
  requires_resigning: boolean;
  confidence: "HØY" | "MEDIUM" | "LAV";
  reasoning_no: string;
  paragraph_references: string[];
  constructive_dismissal_risk: boolean;
  warnings: Array<{ type: string; message_no: string }>;
  blocked_reason: string | null;
  alternative_actions: string[];
};

// Re-export for capability consumers that need the result type.
export type { Aml1415ValidationResult };

// ── Tool 1: validate_aml_14_6 ────────────────────────────────────────────────
// Rule-driven validator reading framework_rule rows from the platform-level
// hospitality.no.default.v1 framework (K1a), code LIKE 'aml.14_6.%'.
// 17 bokstaver (a–q) per post-July 2024 lov-revisjon (ADR-0308).
// Channel: chat + system (system channel used by /api/contracts/send route).
//
// Body written first per L-0176 invariant. Docstring updated after body verified.
// Fail-fast on row.workspace_id mismatch per L-0177.
// Emit shape includes bokstaver_failed[], rule_count, validator_version (Q-H3).

export const validateAml146 = defineTool({
  name: "validate_aml_14_6",
  description:
    "Validate an employment contract draft against Aml. §14-6 (post-July 2024 revision, 17 bokstaver a–q). " +
    "Reads 17 framework_rule rows from platform-level K1a framework (hospitality.no.default.v1). " +
    "Returns pass/fail with per-bokstav §-references and remediation hints. " +
    "Mandatory gate before contract dispatch. Available on chat and system channels. " +
    "Validator version: aml-14-6-2024-07-rule-driven-v1 (ADR-0308).",
  capability: "legal",
  schema: z.object({
    contract_id: z
      .string()
      .uuid()
      .describe("The employment_contract row to validate (workspace resolved from JWT)."),
    validation_mode: z
      .enum(["strict", "advisory"])
      .default("strict")
      .describe("strict = block on errors; advisory = report but allow flow to continue."),
  }),
  execute: async (params, ctx: AgentToolContext): Promise<string> => {
    const VALIDATOR_VERSION = "aml-14-6-2024-07-rule-driven-v1";

    // Lovsen telemetry — skill invoked. ADR-0256: emitted at capability tool entry point.
    // Fire-and-forget; must not alter operation outcome.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "lovsen.skill.invoked",
      properties: {
        skill_name: "validate_aml_14_6",
        skill_version: VALIDATOR_VERSION,
      },
    });

    // ADR-0078 Layer 3: channel guard — validate_aml_14_6 is chat + system only.
    // "system" channel is used by /api/contracts/send server route.
    if (ctx.channel !== "chat" && ctx.channel !== undefined && ctx.channel !== "system") {
      return JSON.stringify({
        pass: false,
        status: "missing_fields",
        errors: [
          {
            severity: "error",
            paragraph: "ADR-0078",
            field: "channel",
            bokstav: "a", // placeholder — structural error, not a §14-6 bokstav failure
            message_no: "validate_aml_14_6 er kun tilgjengelig via chat- eller system-kanal.",
            remediation: "Bruk chat-grensesnittet eller system-kanalen for kontraktsvalidering.",
            evidence_required: [],
            confidence: "HØY",
          },
        ],
        warnings: [],
        citation: "ADR-0078 kanal-restriksjon",
        validator_version: VALIDATOR_VERSION,
      } satisfies Aml146ValidationResult);
    }

    // Step 1: Load contract row — fail-fast on missing or workspace mismatch (L-0177).
    const { data: contract, error: contractErr } = await ctx.supabaseAdmin
      .from("employment_contract")
      .select(
        [
          "contract_id",
          "workspace_id",
          "position_title",
          "start_date",
          "end_date",
          "employment_form",
          "monthly_salary",
          "hourly_rate",
          "agreed_weekly_hours",
          "employment_percentage",
          "notice_period_months",
          "trial_period_months",
          "location_id",
        ].join(", "),
      )
      .eq("contract_id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (contractErr || !contract) {
      return JSON.stringify({
        pass: false,
        status: "missing_fields",
        errors: [
          {
            severity: "error",
            paragraph: "L-0177",
            field: "contract_id",
            bokstav: "a", // placeholder — structural error
            message_no: `Kontrakt ${params.contract_id} ikke funnet i arbeidsområdet.`,
            remediation: "Kontroller at contract_id tilhører ditt arbeidsområde.",
            evidence_required: ["contract_id"],
            confidence: "HØY",
          },
        ],
        warnings: [],
        citation: "Aml. §14-6 (versjon juli 2024)",
        validator_version: VALIDATOR_VERSION,
      } satisfies Aml146ValidationResult);
    }

    // Step 2: Load platform-level regulatory framework (K1a — hospitality.no.default.v1).
    // workspace_framework_binding may be absent; fall back to platform framework.
    const { data: platformFramework } = await ctx.supabaseAdmin
      .from("regulatory_framework")
      .select("framework_id")
      .eq("code", "hospitality.no.default.v1")
      .single();

    if (!platformFramework) {
      return JSON.stringify({
        pass: false,
        status: "skip",
        errors: [
          {
            severity: "error",
            paragraph: "ADR-0308",
            field: "framework_id",
            bokstav: "a", // placeholder — structural error
            message_no: "Plattform-rammeverket hospitality.no.default.v1 ble ikke funnet.",
            remediation: "Kjør migrasjonen 20260424100000_seed_hospitality_framework.sql.",
            evidence_required: [],
            confidence: "HØY",
          },
        ],
        warnings: [],
        citation: "ADR-0308 K1a platform framework",
        validator_version: VALIDATOR_VERSION,
      } satisfies Aml146ValidationResult);
    }

    // Step 3: Load all AML §14-6 framework_rule rows for the platform framework.
    const { data: rules } = await ctx.supabaseAdmin
      .from("framework_rule")
      .select("rule_id, code, evaluation_config, rule_type, severity")
      .eq("framework_id", platformFramework.framework_id)
      .like("code", "aml.14_6.%")
      .order("code");

    const ruleRows = rules ?? [];
    const ruleCount = ruleRows.length;

    // Step 4: Evaluate each rule against the contract row.
    // evaluation_config fields: bokstav, field, field_alt, required, required_when
    const errors: Aml146Issue[] = [];
    const warnings: Aml146Issue[] = [];
    const bokstaverFailed: string[] = [];

    // Cast to plain object for dynamic field access — supabase row types are too specific.
    const contractRow = contract as unknown as Record<string, unknown>;

    // Helper: check if a required_when condition is met by the contract.
    // Conditions supported: employment_form, trial_period_active (derived), has_special_scheme, has_tariff, industry, schedule_type
    const meetsRequiredWhen = (requiredWhen: Record<string, unknown>): boolean => {
      for (const [key, value] of Object.entries(requiredWhen)) {
        if (key === "employment_form") {
          if (contractRow["employment_form"] !== value) return false;
        }
        if (key === "trial_period_active") {
          // Derived: trial_period_months > 0 means trial is active
          const months = contractRow["trial_period_months"];
          const isActive = months !== null && months !== undefined && Number(months) > 0;
          if (isActive !== value) return false;
        }
        // has_special_scheme, has_tariff, industry, schedule_type: not currently stored on
        // employment_contract — these require workspace context not yet in schema.
        // For hospitality+rotation (bokstav m): flag as required for all hospitality workspaces
        // per Pontus Phase 6 approval. Implementation note captured in ADR-0308.
        if (key === "industry") {
          // Platform rule: hospitality industry always applies in this context.
          // Future: read workspace.industry when column exists.
          if (value !== "hospitality") return false;
        }
        if (key === "schedule_type") {
          // Conservative: treat all rotation schedules as covered.
          // Future: read employment_contract.working_hours_scheme when available.
          if (value !== "rotation") return false;
        }
      }
      return true;
    };

    // Helper: resolve field value from contract.
    const getField = (field: string): unknown => contractRow[field];

    for (const rule of ruleRows) {
      const cfg = rule.evaluation_config as Record<string, unknown>;
      const bokstav = String(cfg["bokstav"] ?? "?");
      const field = String(cfg["field"] ?? "");
      const fieldAlt = cfg["field_alt"] ? String(cfg["field_alt"]) : null;
      const required = cfg["required"] === true;
      const requiredWhen = cfg["required_when"] as Record<string, unknown> | undefined;

      // Determine if this rule is applicable.
      let isRequired = required;
      if (!isRequired && requiredWhen && Object.keys(requiredWhen).length > 0) {
        isRequired = meetsRequiredWhen(requiredWhen);
      }

      if (!isRequired) {
        // Bokstav p (kompetanseutvikling) and conditionals not triggered: skip.
        continue;
      }

      // Evaluate field presence.
      const primaryValue = getField(field);
      const altValue = fieldAlt ? getField(fieldAlt) : undefined;

      // Field is populated when non-null and non-empty-string.
      const isPrimaryPopulated =
        primaryValue !== null && primaryValue !== undefined && String(primaryValue).trim() !== "";
      const isAltPopulated =
        altValue !== null && altValue !== undefined && String(altValue).trim() !== "";

      const isPopulated = isPrimaryPopulated || (fieldAlt !== null && isAltPopulated);

      if (!isPopulated) {
        bokstaverFailed.push(bokstav);

        const issue: Aml146Issue = {
          severity: params.validation_mode === "strict" ? "error" : "warning",
          paragraph: `Aml. §14-6 bokstav ${bokstav}`,
          field: fieldAlt && !isPrimaryPopulated ? `${field} / ${fieldAlt}` : field,
          bokstav: bokstav as Aml146Issue["bokstav"],
          message_no: `Obligatorisk felt mangler: ${String(cfg["description_no"] ?? field)}`,
          remediation: `Fyll ut felt '${field}' på kontrakten (Aml. §14-6 bokstav ${bokstav}).`,
          evidence_required: [field],
          confidence: "HØY",
        };

        if (params.validation_mode === "strict") {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }

    const pass = errors.length === 0;
    const status: Aml146ValidationResult["status"] =
      pass && warnings.length === 0
        ? "passes"
        : pass && warnings.length > 0
          ? "warnings"
          : "missing_fields";

    const result: Aml146ValidationResult = {
      pass,
      status,
      errors,
      warnings,
      citation: "Aml. §14-6 (versjon juli 2024) — 17 bokstaver a–q",
      validator_version: VALIDATOR_VERSION,
    };

    // Emit telemetry — L-0184 single canonical emit producer.
    // Q-H3: added bokstaver_failed[], rule_count, validator_version. Non-breaking.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "legal.aml_14_6.validated",
      properties: {
        entity: { entity_type: "employment_contract", entity_id: params.contract_id },
        data: {
          contract_id: params.contract_id,
          validation_mode: params.validation_mode,
          pass: result.pass,
          status: result.status,
          error_count: result.errors.length,
          warning_count: result.warnings.length,
          validator_version: result.validator_version,
          bokstaver_failed: bokstaverFailed,
          rule_count: ruleCount,
        },
      },
    });

    return JSON.stringify(result);
  },
});

// ── Tool 2: cite_law ─────────────────────────────────────────────────────────
// Phase 0c stub: returns a placeholder citation.
// Real implementation reads regulatory_framework + framework_rule (K1a) with
// version / effective_from temporal correctness (ADR-0181).
// Channel: chat + voice (paragraph refs, no PII).

export const citeLaw = defineTool({
  name: "cite_law",
  description:
    "Look up and cite a Norwegian law paragraph (Aml., ferieloven, OTP, Riksavtalen, etc.). " +
    "Returns canonical Norwegian law text with paragraph reference, version, and confidence. " +
    "Available on chat channel only (Layer 2 union ['chat','system'] per ADR-0163 §rule 4 — voice was removed when F-CL-11 closed).",
  capability: "legal",
  schema: z.object({
    query: z
      .string()
      .describe(
        "Plain-language description of what to look up, or a paragraph reference like '§14-6'.",
      ),
    lov: z
      .enum(["aml", "ferieloven", "otp", "bokforing", "skattetrekk", "riksavtalen"])
      .optional()
      .describe("Narrow the search to a specific law. Optional."),
  }),
  execute: async (params, ctx: AgentToolContext): Promise<string> => {
    // ADR-0078 Layer 3: cite_law is chat-only at the agent surface.
    // Allowed channels enforced at capability level (allowedChannels: ["chat", "system"])
    // per ADR-0163 §rule 4 — voice was removed when F-CL-11 closed (commit 47bffe635).

    // Lovsen telemetry — skill invoked. ADR-0256: emitted at capability tool entry point.
    // Fire-and-forget; must not alter operation outcome.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "lovsen.skill.invoked",
      properties: {
        skill_name: "cite_law",
        skill_version: "cite-law-stub-phase-0c",
      },
    });

    // Phase 0c stub: return placeholder.
    // TODO(Phase 0c+): query regulatory_framework + framework_rule WHERE code ILIKE query
    // AND (effective_to IS NULL OR effective_to > NOW()).
    const result = {
      paragraph: params.query,
      text: "[STUB — Lovdata MCP integration pending Phase 0c+]",
      version: "2024-07-stub",
      effective_from: "2024-07-01",
      confidence: "LAV" as const,
      source: params.lov
        ? `Stub-referanse for ${params.lov}`
        : "Stub-referanse — Lovdata MCP ikke tilkoblet",
      stub: true,
    };

    // Lovsen telemetry — confidence.degraded when stub returns LAV confidence.
    // ADR-0256: tracks quality degradation from expected HØY to LAV.
    // The stub always returns LAV; once Phase 0c+ ships this block moves to
    // the MCP-fetch-failed path. Fire-and-forget.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "lovsen.confidence.degraded",
      properties: {
        score: 0.1,
        reasons: ["cite_law is a Phase 0c stub — Lovdata MCP not yet connected"],
      },
    });

    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "legal.law_cited",
      properties: {
        data: {
          query: params.query,
          lov: params.lov ?? null,
          paragraph: result.paragraph,
          version: result.version,
          confidence: result.confidence,
          stub: true,
        },
      },
    });

    return JSON.stringify(result);
  },
});

// ── Tool 3: classify_amendment ───────────────────────────────────────────────
// Phase 0c stub: returns "admin" classification for every field.
// Real implementation reads field_classification_metadata + conditional rules
// per ADR-0235. server-only channel (drives mutation downstream).

export const classifyAmendment = defineTool({
  name: "classify_amendment",
  description:
    "Classify a contract or payroll-profile field change as MATERIAL/ADMIN/DERIVED/SYSTEM/BLOCKED. " +
    "Server-only — drives contract_amendment insertion. " +
    "gate_action: enforce, default_allow: false per ADR-0099.",
  capability: "legal",
  schema: z.object({
    contract_id: z.string().uuid().describe("The employment_contract being amended."),
    field_changes: z
      .array(
        z.object({
          column: z.string().describe("Column name being changed."),
          from: z.unknown().describe("Previous value."),
          to: z.unknown().describe("New value."),
        }),
      )
      .min(1)
      .describe("List of field changes to classify."),
    context: z
      .object({
        contract_status: z.string().optional(),
        is_within_trial_period: z.boolean().optional(),
        tariff_revision_triggered: z.boolean().optional(),
      })
      .optional(),
  }),
  execute: async (params, ctx: AgentToolContext): Promise<string> => {
    // Lovsen telemetry — skill invoked. ADR-0256: emitted at capability tool entry point.
    // Fire-and-forget; must not alter operation outcome.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "lovsen.skill.invoked",
      properties: {
        skill_name: "classify_amendment",
        skill_version: "classify-amendment-stub-phase-0c",
      },
    });

    // ADR-0078 Layer 3: classify_amendment is server-only.
    // Allowed channels checked at capability level (allowedChannels: ["system", "autonomous"]).
    if (ctx.channel !== "system" && ctx.channel !== "autonomous" && ctx.channel !== undefined) {
      return JSON.stringify({
        error: "classify_amendment er kun tilgjengelig via system-kanal (server-only).",
        adr: "ADR-0078",
      });
    }

    // ADR-0134 / ADR-0151 guard — workspace_id + profile_id must resolve.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        error: "missing_context",
        message: "classify_amendment requires resolved workspaceId + profileId (ADR-0134).",
      });
    }

    // ADR-0099 / ADR-0249 mandatory C4 gate — gate_action: enforce,
    // default_allow: false. Authority row seeded by
    // 20260520130000_legal_capability_authority_seed.sql; fail-closed if
    // the gate row is missing or the RPC errors.
    const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
      capability: "legal",
      channel: normaliseChannel(ctx.channel),
      actionType: "classify_amendment",
      entityId: params.contract_id,
    });

    if (!gate.allow) {
      return JSON.stringify({
        error: "gate_denied",
        reason: gate.reason ?? "denied",
        adr: "ADR-0099",
      });
    }

    // Phase 0c stub: classify every field change as "admin" without mutation.
    // TODO(Phase 0c+): read field_classification_metadata per ADR-0235, apply
    // conditional rules, check constructive_dismissal_risk (ADR-0236).
    const classifications: ClassifyAmendmentResult[] = params.field_changes.map((change) => ({
      classification: "admin" as AmendmentClassification,
      requires_resigning: false,
      confidence: "LAV",
      reasoning_no: `[STUB] Felt '${change.column}' klassifisert som admin. Fase 0c+ implementerer lov-regelverket.`,
      paragraph_references: ["Aml. §14-6 — klassifisering pending Lovdata MCP"],
      constructive_dismissal_risk: false,
      warnings: [
        {
          type: "stub",
          message_no: "classify_amendment er en stub. Ikke bruk i produksjon.",
        },
      ],
      blocked_reason: null,
      alternative_actions: [],
    }));

    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "legal.amendment_classified",
      properties: {
        entity: { entity_type: "employment_contract", entity_id: params.contract_id },
        data: {
          contract_id: params.contract_id,
          field_count: params.field_changes.length,
          classifications: classifications.map((c) => ({
            classification: c.classification,
            requires_resigning: c.requires_resigning,
            confidence: c.confidence,
          })),
          stub: true,
        },
      },
    });

    return JSON.stringify({ classifications });
  },
});

// ── Tool 4: validate_aml_14_15 ───────────────────────────────────────────────
//
// Validates a payroll.consent_document row against Aml. §14-15 tredje ledd nr. 1-6.
// Used by the stage-engine on the system channel to verify deduction consent before
// applying a wage-line override. The BFF route (propose-line-override) calls the
// shared utility validateAml1415Logic directly — this tool adds channel guard + emit().
//
// Channel: system ONLY — ADR-0078 Layer 3.
// allowedChannels at Layer 2 is ["chat","system"] (legal capability). "autonomous" is NOT
// exposed — if autonomous access is needed, a separate ADR must extend allowedChannels.
//
// ADR-0311: workspaceId comes from ctx (JWT-derived), never from tool params.
// ADR-0151: no workspace_id in schema — resolved server-side.
// L-0176: body written before docstring. Docstring describes the implemented body.

export const validateAml1415 = defineTool({
  name: "validate_aml_14_15",
  description:
    "Validate a payroll.consent_document against Aml. §14-15 tredje ledd nr. 1-6 (wage deduction consent). " +
    "Returns pass/fail with structured status. System channel only — not for chat or voice. " +
    "Wraps the shared validateAml1415Logic utility (same rule logic as the BFF route). " +
    "ADR-0311, ADR-0151.",
  capability: "legal",
  schema: z.object({
    consent_document_id: z
      .string()
      .uuid()
      .describe("UUID of the payroll.consent_document to validate."),
    profile_id: z
      .string()
      .uuid()
      .describe("UUID of the employee profile that should own the consent document."),
    validation_mode: z
      .enum(["strict", "advisory"])
      .default("strict")
      .describe("strict = surface hard errors; advisory = log but allow caller to decide."),
  }),
  execute: async (params, ctx: AgentToolContext): Promise<string> => {
    // Lovsen telemetry — skill invoked. ADR-0256: emitted at capability tool entry point.
    // Fire-and-forget; must not alter operation outcome.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "lovsen.skill.invoked",
      properties: {
        skill_name: "validate_aml_14_15",
        skill_version: "aml-14-15-2024-07-payroll-v1",
      },
    });

    // ADR-0078 Layer 3: validate_aml_14_15 is system-only.
    // Layer 2 (allowedChannels) already excludes autonomous — Layer 3 is defence-in-depth.
    const channel = ctx.channel ?? "system";
    if (channel !== "system") {
      return JSON.stringify({
        pass: false,
        status: "skip",
        paragraph: "Aml. §14-15 tredje ledd nr. 1-6",
        consent_document_id: params.consent_document_id,
        signed_at: null,
        expires_at: null,
        validator_version: "aml-14-15-2024-07-payroll-v1",
        error: "validate_aml_14_15 er kun tilgjengelig via system-kanal (ADR-0078).",
      } satisfies Aml1415ValidationResult & { error: string });
    }

    // ADR-0134 guard — workspace_id + profile_id must resolve.
    if (!ctx.workspaceId || !ctx.profileId) {
      return JSON.stringify({
        pass: false,
        status: "skip",
        paragraph: "Aml. §14-15 tredje ledd nr. 1-6",
        consent_document_id: params.consent_document_id,
        signed_at: null,
        expires_at: null,
        validator_version: "aml-14-15-2024-07-payroll-v1",
        error: "validate_aml_14_15 krever resolved workspaceId + profileId (ADR-0134).",
      } satisfies Aml1415ValidationResult & { error: string });
    }

    // Call shared utility — identical rule logic as the BFF route.
    // workspaceId is ctx.workspaceId (JWT-derived, ADR-0151).
    const result = await validateAml1415Logic(
      params.consent_document_id,
      params.profile_id,
      ctx.workspaceId as string,
      ctx.supabaseAdmin,
    );

    // Emit telemetry — L-0184 single canonical emit producer.
    void emit({
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      event: "legal.aml_14_15.validated",
      properties: {
        data: {
          consent_document_id: result.consent_document_id,
          profile_id: params.profile_id,
          pass: result.pass,
          status: result.status,
          validator_version: result.validator_version,
        },
      },
    });

    return JSON.stringify(result);
  },
});
