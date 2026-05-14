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
  message_no: string;
  remediation: string;
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
// Phase 0c stub: always returns pass=true.
// Real implementation reads from regulatory_framework + framework_rule (K1a)
// and runs all 16 §14-6 letter checks per SKILL.AML.md checklist.
// Channel: chat only (ADR-0078 — touches oppsigelse/sykefravær context).

export const validateAml146 = defineTool({
  name: "validate_aml_14_6",
  description:
    "Validate an employment contract draft against Aml. §14-6 (post-July 2024 revision). " +
    "Returns pass/fail with per-letter §-references and remediation hints. " +
    "Mandatory gate before contract dispatch. Chat channel only.",
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
    // ADR-0078 Layer 3: channel guard — validate_aml_14_6 is chat-only.
    if (ctx.channel !== "chat" && ctx.channel !== undefined && ctx.channel !== "system") {
      return JSON.stringify({
        pass: false,
        status: "missing_fields",
        errors: [
          {
            severity: "error",
            paragraph: "ADR-0078",
            field: "channel",
            message_no: "validate_aml_14_6 er kun tilgjengelig via chat-kanal.",
            remediation: "Bruk chat-grensesnittet for kontraktsvalidering.",
            confidence: "HØY",
          },
        ],
        warnings: [],
        citation: "ADR-0078 kanal-restriksjon",
        validator_version: "aml-14-6-2024-07-stub",
      } satisfies Aml146ValidationResult);
    }

    // Phase 0c stub: return pass without hitting Lovdata or regulatory_framework.
    // TODO(Phase 0c+): fetch contract row, resolve payroll_profile, run 16-letter
    // checklist from SKILL.AML.md via regulatory_framework + framework_rule (K1a).
    const result: Aml146ValidationResult = {
      pass: true,
      status: "passes",
      errors: [],
      warnings: [],
      citation: "Aml. §14-6 (versjon juli 2024)",
      validator_version: "aml-14-6-2024-07-stub",
    };

    // Emit telemetry — L-0184 single canonical emit producer.
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
          stub: true,
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
    "Available on chat and voice channels.",
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
    // ADR-0078 Layer 3: cite_law is chat + voice (no system/autonomous from agent surface).
    // Allowed channels checked at capability level (allowedChannels: ["chat", "voice"]).

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
