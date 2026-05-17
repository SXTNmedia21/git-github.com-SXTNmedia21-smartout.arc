/**
 * packages/ai/src/capabilities/payroll/tariff-tools.ts
 *
 * Phase 7f payroll tariff tools (ADR-0356 delegation + ADR-0355 table contract).
 *
 * Three tools — all delegates to cascade capability tools per ADR-0356 §"Pattern definition":
 *   - setup_workspace_tariff    first-time tariff binding (BOOTSTRAP)
 *   - change_workspace_tariff   switch flow when union or law_version changes
 *   - add_supplement_override   workspace-specific supplement above tariff floor
 *
 * Delegation chain (audit-symmetry per ADR-0356 §"Audit trail symmetry"):
 *   payroll tool gates → calls cascade tool with caller_capability='payroll'
 *   → cascade tool gates independently → writes DB → emits cascade.* event
 *     with actor_capability=input.caller_capability, delegated_via='cascade'
 *   ← cascade returns structured result
 *   → payroll tool emits payroll.* event
 *     with actor_capability='payroll', delegated_via='cascade'
 *
 * Both layers emit. Auditors can query:
 *   activity_trail WHERE delegated_via IS NOT NULL → full cross-namespace chain.
 *
 * Gate convention (ADR-0356 §"Gate convention"):
 *   Payroll gate fires FIRST (this file), then cascade gate fires inside the cascade tool.
 *   BOTH must approve. The cascade gate is NOT a rubber stamp of the payroll gate.
 *
 * Hard rules:
 *   L-0177 fail-fast: workspaceId + profileId MUST be non-empty from ctx.
 *   L-0176: bodies written first; docstrings do not claim ADR compliance until body satisfies it.
 *   ADR-0204: gatedMutation via mutateWithGate before any cascade tool call.
 *   ADR-0152: structured error envelopes (code + message + optional aml_ref).
 *   ADR-0151: cross-workspace block — body workspace_id MUST match ctx.workspaceId.
 *   ADR-0078: chat channel only (payroll Høy-PII restriction).
 *
 * Payroll-side errors (not passed through from cascade):
 *   TARIFF_ALREADY_BOUND — setup called when binding already exists (use change)
 *   NO_EXISTING_BINDING  — change called with no active binding (use setup)
 *
 * Pass-through errors from cascade (returned verbatim):
 *   MISSING_PROFILE_CONTEXT, INVALID_WORKSPACE, AMENDMENT_BLOCKED,
 *   SUPPLEMENT_BELOW_TARIFF_FLOOR, AUTHORITY_DENIED, CASCADE_GATE_ERROR,
 *   CASCADE_INSERT_FAILED
 *
 * References:
 *   ADR-0078   — chat-only channel restriction (Høy-PII payroll surface).
 *   ADR-0099   — unified authority gate (gate_action RPC contract).
 *   ADR-0134   — actor_id non-null, workspace_id non-null telemetry contract.
 *   ADR-0151   — workspace_id server-derived, never body-supplied.
 *   ADR-0152   — structured error envelope (code + message).
 *   ADR-0173   — frozen-4 capability boundaries (payroll IS a frozen-4 delegator).
 *   ADR-0204   — gatedMutation per-tool authority.
 *   ADR-0240   — cross-namespace delegation precedent (generalized by ADR-0356).
 *   ADR-0252   — Riksavtalen versjonering; §F amendment-classifier.
 *   ADR-0287   — gate_action mandatory on mutation capability tools.
 *   ADR-0355   — workspace_union_binding table contract + APPEND-ONLY semantics.
 *   ADR-0356   — cascade-namespace delegation pattern + audit symmetry.
 *   L-0176     — docstring-vs-body anti-pattern.
 *   L-0177     — fail-fast on missing workspace_id / profile_id.
 */

import { z } from "zod";
import { randomUUID } from "crypto";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";
import { bindWorkspaceUnionTool, addSupplementRuleTool } from "../cascade/tools.js";
import {
  classifyAmendmentLogic,
  type AmendmentPrevState,
  type AmendmentNextState,
} from "../legal/index.js";

// ─── Shared constants ────────────────────────────────────────────────────────

const CAPABILITY = "payroll" as const;
const CASCADE_CAPABILITY = "cascade" as const;
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

/** Guard: payroll tariff tools are chat-only (ADR-0078 Høy-PII). */
function assertChatChannel(
  channel: SessionChannel,
): { denied: false } | { denied: true; msg: string } {
  if (channel !== "chat") {
    return {
      denied: true,
      msg: "Tariff-konfigurasjon er kun tilgjengelig via chat. Bytt til chat-kanalen. (ADR-0078 Høy-PII)",
    };
  }
  return { denied: false };
}

// ─── Shared exec result types ─────────────────────────────────────────────────
// Explicit discriminated unions for exec callbacks so TypeScript can narrow
// `result` after the `if (!result.ok)` guard without property errors.

type SetupExecOk = {
  ok: true;
  workspace_union_binding_id: string;
  effective_from: string;
  cascade_emit_id: string | null;
};
type SetupExecFail = {
  ok: false;
  code: string;
  existing_binding_id?: string;
  message?: string;
};
type SetupExecResult = SetupExecOk | SetupExecFail;

type ChangeExecOk = {
  ok: true;
  old_workspace_union_binding_id: string;
  new_workspace_union_binding_id: string;
  effective_from: string;
  amendment_classifier: string;
  old_law_version: string;
  cascade_emit_id: string | null;
};
type ChangeExecFail = {
  ok: false;
  code: string;
  message?: string;
  [key: string]: unknown;
};
type ChangeExecResult = ChangeExecOk | ChangeExecFail;

type SupplementExecOk = {
  ok: true;
  supplement_rule_id: string;
  cascade_emit_id: string | null;
};
type SupplementExecFail = {
  ok: false;
  code: string;
  message?: string;
  aml_ref?: string;
  floor?: number | null;
  proposed?: number;
  [key: string]: unknown;
};
type SupplementExecResult = SupplementExecOk | SupplementExecFail;

// ─── setup_workspace_tariff ──────────────────────────────────────────────────

const setupWorkspaceTariffSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe("Workspace to bind. MUST match authenticated ctx.workspaceId (ADR-0151 + L-0177)."),
  union_id: z
    .enum(["taro-79", "taro-226", "non-bound"])
    .describe(
      "Union binding: 'taro-79' = Fellesforbundet Riksavtalen, " +
        "'taro-226' = Parat overenskomst, 'non-bound' = workspace not tariff-bound.",
    ),
  law_version: z
    .string()
    .describe("Tariff law version e.g. '2024-2026', '2025-mellomoppgjor', 'n/a' for non-bound."),
  official_effective_date: z
    .string()
    .describe(
      "ISO date (YYYY-MM-DD) — official Aml. §14-6 effective date (written to binding row).",
    ),
  effective_from: z
    .string()
    .optional()
    .describe(
      "ISO date (YYYY-MM-DD) from which this binding is active. Defaults to official_effective_date.",
    ),
  derivation_snapshot_id: z
    .string()
    .uuid()
    .nullable()
    .default(null)
    .describe(
      "Optional tariff_snapshot.id this binding derives from. NULL for non-bound or manual bootstrap.",
    ),
});

/**
 * setup_workspace_tariff — first-time tariff binding for a workspace.
 *
 * Body: L-0177 fail-fast → chat-channel guard → cross-workspace block →
 *   payroll gate (mutateWithGate) → check no existing binding (TARIFF_ALREADY_BOUND) →
 *   call cascade.bind_workspace_union(caller_capability='payroll', amendment_classifier='BOOTSTRAP') →
 *   emit payroll.workspace_tariff_setup (actor_capability='payroll', delegated_via='cascade') →
 *   return { workspace_union_binding_id, effective_from }.
 *
 * Satisfies ADR-0204 (gatedMutation), ADR-0356 (delegation + audit symmetry), L-0177.
 * Docstring written AFTER body confirmed — per L-0176 discipline.
 */
export const setupWorkspaceTariffTool = defineTool({
  name: "setup_workspace_tariff",
  description:
    "Payroll tool — first-time tariff binding for a workspace (onboarding 'Tariff' step or admin bootstrap). " +
    "Delegates to cascade.bind_workspace_union(amendment_classifier='BOOTSTRAP') per ADR-0356. " +
    "Fails with TARIFF_ALREADY_BOUND if an active binding exists — use change_workspace_tariff instead. " +
    "Admin only. Chat channel only (ADR-0078 Høy-PII). " +
    "Both payroll gate AND cascade gate fire independently per ADR-0356 §'Gate convention'. " +
    "Both layers emit with audit-symmetry per ADR-0356 §'Audit trail symmetry'. " +
    "Returns { workspace_union_binding_id, effective_from }.",
  capability: CAPABILITY,
  schema: setupWorkspaceTariffSchema,
  execute: async (input, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // ── 1. L-0177 fail-fast ──────────────────────────────────────────────────
    // workspaceId + profileId MUST resolve non-empty from ctx BEFORE any DB
    // call. Silent fallback to JWT-default is the bug class in L-0177 + ADR-0151.
    if (!ctx.workspaceId || (ctx.workspaceId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "setup_workspace_tariff requires resolved workspaceId (ADR-0134 + L-0177)",
      });
    }
    if (!ctx.profileId || (ctx.profileId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "setup_workspace_tariff requires resolved profileId (ADR-0134 + L-0177)",
      });
    }

    // ── 2. Channel guard ─────────────────────────────────────────────────────
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({
        ok: false as const,
        code: "CHANNEL_DENIED" as const,
        message: channelCheck.msg,
      });
    }

    // ── 3. Cross-workspace block (ADR-0151) ──────────────────────────────────
    if (input.workspace_id !== (ctx.workspaceId as string)) {
      return JSON.stringify({
        ok: false as const,
        code: "INVALID_WORKSPACE" as const,
        message: "workspace_id in body must match authenticated workspace (ADR-0151)",
      });
    }

    // ── 4. gatedMutation — payroll authority gate ────────────────────────────
    // Per ADR-0204 + ADR-0287: payroll gate fires FIRST. The cascade gate fires
    // inside the cascade tool call below (step 4b). Both must approve.
    try {
      const { result } = await mutateWithGate<SetupExecResult>(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId as string,
        profileId: ctx.profileId as string,
        capability: CAPABILITY,
        actionType: "setup_workspace_tariff",
        channel,
        exec: async (_db): Promise<SetupExecResult> => {
          // ── 4a. Check existing binding ────────────────────────────────────
          // APPEND-ONLY semantics (ADR-0355): an active binding exists if any
          // row with workspace_id AND effective_to IS NULL exists.
          const { data: existingRows, error: existingErr } = await ctx.supabaseAdmin
            .from("workspace_union_binding")
            .select("workspace_union_binding_id")
            .eq("workspace_id", ctx.workspaceId as string)
            .is("effective_to", null)
            .limit(1);

          if (existingErr) {
            throw new Error(`existing_binding_check_failed: ${existingErr.message}`);
          }

          if (existingRows && existingRows.length > 0) {
            // Existing active binding — caller must use change_workspace_tariff.
            return {
              ok: false,
              code: "TARIFF_ALREADY_BOUND",
              existing_binding_id: existingRows[0]?.workspace_union_binding_id as string,
              message:
                "workspace already has an active tariff binding — use change_workspace_tariff to switch",
            };
          }

          // ── 4b. Call cascade delegation tool ─────────────────────────────
          // caller_capability literal 'payroll' is required per ADR-0356 §"Audit trail symmetry".
          // amendment_classifier 'BOOTSTRAP' = first-time binding, no prior row to close.
          const cascadeResult = await bindWorkspaceUnionTool.execute(
            {
              workspace_id: input.workspace_id,
              union_id: input.union_id,
              law_version: input.law_version,
              effective_from: input.effective_from ?? input.official_effective_date,
              amendment_classifier: "BOOTSTRAP" as const,
              derivation_snapshot_id: input.derivation_snapshot_id,
              caller_capability: CAPABILITY,
            },
            ctx,
          );

          const cascadeParsed = JSON.parse(cascadeResult) as {
            ok: boolean;
            workspace_union_binding_id?: string;
            effective_from?: string;
            cascade_emit_id?: string;
            code?: string;
            message?: string;
          };

          if (!cascadeParsed.ok) {
            // Pass cascade errors through verbatim — caller sees the cascade error code.
            return {
              ok: false,
              code: cascadeParsed.code ?? "CASCADE_ERROR",
              message: cascadeParsed.message,
            };
          }

          return {
            ok: true,
            workspace_union_binding_id: cascadeParsed.workspace_union_binding_id!,
            effective_from: cascadeParsed.effective_from!,
            // Phase 7h: read TRUE cascade emit id from cascade tool result instead of
            // pre-generating an unrelated UUID. The cascade tool now pre-generates its
            // own cascadeEmitId and returns it — this is the real correlation_id that
            // maps to the cascade activity_trail row.
            cascade_emit_id: cascadeParsed.cascade_emit_id ?? null,
          };
        },
      });

      // ── 5. Branch on exec result ─────────────────────────────────────────
      if (!result.ok) {
        return JSON.stringify(result);
      }

      // ── 6. Emit payroll-layer telemetry (uuid-before-emit pattern) ──────────
      // ADR-0356 §"Audit trail symmetry": payroll layer emits AFTER cascade
      // layer emitted. Both use actor_capability='payroll' + delegated_via='cascade'.
      // emit() returns void — IDs are pre-assigned via randomUUID().
      //   payroll_emit_id: used as correlation_id on the payroll emit → maps 1:1
      //     to the activity_trail row searchable by correlation_id.
      //   cascade_emit_id: read from cascade tool result (Phase 7h) — this is the
      //     TRUE emit id that the cascade layer used as its own correlation_id.
      //     Full audit chain: query activity_trail WHERE correlation_id = payroll_emit_id
      //     (payroll row) AND WHERE correlation_id = cascade_emit_id (cascade row).
      const payrollEmitId = randomUUID();
      const cascadeEmitId = result.cascade_emit_id;
      await emit({
        event: "payroll.workspace_tariff_setup",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        correlation_id: payrollEmitId,
        properties: {
          entity: {
            entity_type: "workspace_union_binding",
            entity_id: result.workspace_union_binding_id,
          },
          data: {
            workspace_union_binding_id: result.workspace_union_binding_id,
            workspace_id: input.workspace_id,
            union_id: input.union_id,
            law_version: input.law_version,
            effective_from: result.effective_from,
            amendment_classifier: "BOOTSTRAP",
            actor_capability: CAPABILITY,
            delegated_via: CASCADE_CAPABILITY,
            actor_id: ctx.profileId as string,
          },
        },
      });

      // ── 7. Return (includes emit IDs for BFF audit block) ───────────────
      return JSON.stringify({
        ok: true as const,
        workspace_union_binding_id: result.workspace_union_binding_id,
        effective_from: result.effective_from,
        payroll_emit_id: payrollEmitId,
        cascade_emit_id: cascadeEmitId,
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({
          ok: false as const,
          code: "AUTHORITY_DENIED" as const,
          message: err.message,
        });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({
          ok: false as const,
          code: "PAYROLL_GATE_ERROR" as const,
          message: err.message,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        code: "SETUP_TARIFF_FAILED" as const,
        message: msg,
      });
    }
  },
});

// ─── change_workspace_tariff ─────────────────────────────────────────────────

const changeWorkspaceTariffSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe("Workspace to update. MUST match authenticated ctx.workspaceId (ADR-0151 + L-0177)."),
  new_union_id: z
    .enum(["taro-79", "taro-226", "non-bound"])
    .describe(
      "New union binding: 'taro-79' = Fellesforbundet Riksavtalen, " +
        "'taro-226' = Parat overenskomst, 'non-bound' = not tariff-bound.",
    ),
  new_law_version: z
    .string()
    .describe("New tariff law version e.g. '2025-mellomoppgjor', '2026-2028'."),
  official_effective_date: z
    .string()
    .describe("ISO date (YYYY-MM-DD) — official Aml. §14-6 effective date for the new binding."),
  effective_from: z
    .string()
    .optional()
    .describe(
      "ISO date (YYYY-MM-DD) from which this binding is active. Defaults to official_effective_date.",
    ),
  derivation_snapshot_id: z
    .string()
    .uuid()
    .nullable()
    .default(null)
    .describe(
      "Optional tariff_snapshot.id this new binding derives from. NULL for manual admin switch.",
    ),
  reason: z
    .string()
    .optional()
    .describe(
      "Optional human-readable reason for the change (logged in telemetry, not written to DB row).",
    ),
});

/**
 * change_workspace_tariff — switch flow when new law_version lands or union changes.
 *
 * Body: L-0177 fail-fast → chat-channel guard → cross-workspace block →
 *   payroll gate (mutateWithGate) → fetch prev binding (NO_EXISTING_BINDING) →
 *   call legal.classifyAmendmentLogic(prev, next) to derive Aml. §14-6 classifier →
 *   call cascade.bind_workspace_union(amendment_classifier=classifier.classifier) →
 *   (cascade BLOCKS MATERIAL/ENDRINGSOPPSIGELSE per §14-6(m); UP proceeds) →
 *   emit payroll.workspace_tariff_changed (with classification payload) →
 *   return { old_*, new_*, effective_from, amendment_classifier, classification }.
 *
 * Classification source: packages/ai/src/capabilities/legal/amendment-classifier.ts
 * (Lovsen-owned rule matrix per Aml. §14-6 + §15-7 + Riksavtalen §4 carve-out).
 * Replaces previous inline TARIFF_REVISION/UNION_CHANGE heuristic. Phase 7d Track 5.
 *
 * When classifier returns MATERIAL or ENDRINGSOPPSIGELSE the cascade layer
 * blocks with AMENDMENT_BLOCKED + aml_ref §14-6(m). The blocked payload is
 * returned to caller with the classifier's aml_refs + reason for surfacing
 * in UI. Phase 7f amendment-handler owns the signering path for those flows.
 *
 * Satisfies ADR-0173 (legal owns rule matrix), ADR-0204, ADR-0252 §F, ADR-0356, L-0177.
 */
export const changeWorkspaceTariffTool = defineTool({
  name: "change_workspace_tariff",
  description:
    "Payroll tool — switch tariff binding when new law_version lands or workspace changes union affiliation. " +
    "Calls legal.classifyAmendmentLogic (Lovsen rule matrix per Aml. §14-6 + Riksavtalen §4 carve-out) " +
    "to derive amendment_classifier. UP proceeds to cascade write. MATERIAL/ENDRINGSOPPSIGELSE BLOCK at " +
    "cascade with aml_ref §14-6(m) — Phase 7f amendment-handler owns the signering path. " +
    "Fails with NO_EXISTING_BINDING if no active binding exists — use setup_workspace_tariff instead. " +
    "Admin only. Chat channel only (ADR-0078 Høy-PII). " +
    "Delegates to cascade.bind_workspace_union per ADR-0356. Both layers emit audit-symmetry. " +
    "Returns { old_workspace_union_binding_id, new_workspace_union_binding_id, effective_from, amendment_classifier }.",
  capability: CAPABILITY,
  schema: changeWorkspaceTariffSchema,
  execute: async (input, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // ── 1. L-0177 fail-fast ──────────────────────────────────────────────────
    if (!ctx.workspaceId || (ctx.workspaceId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "change_workspace_tariff requires resolved workspaceId (ADR-0134 + L-0177)",
      });
    }
    if (!ctx.profileId || (ctx.profileId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "change_workspace_tariff requires resolved profileId (ADR-0134 + L-0177)",
      });
    }

    // ── 2. Channel guard ─────────────────────────────────────────────────────
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({
        ok: false as const,
        code: "CHANNEL_DENIED" as const,
        message: channelCheck.msg,
      });
    }

    // ── 3. Cross-workspace block (ADR-0151) ──────────────────────────────────
    if (input.workspace_id !== (ctx.workspaceId as string)) {
      return JSON.stringify({
        ok: false as const,
        code: "INVALID_WORKSPACE" as const,
        message: "workspace_id in body must match authenticated workspace (ADR-0151)",
      });
    }

    // ── 4. gatedMutation — payroll authority gate ────────────────────────────
    try {
      const { result } = await mutateWithGate<ChangeExecResult>(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId as string,
        profileId: ctx.profileId as string,
        capability: CAPABILITY,
        actionType: "change_workspace_tariff",
        channel,
        exec: async (_db): Promise<ChangeExecResult> => {
          // ── 4a. Fetch existing active binding ─────────────────────────────
          // Per spec: prev binding MUST be read from workspace_union_binding
          // BEFORE calling cascade. The active binding is the row with
          // effective_to IS NULL (APPEND-ONLY semantics per ADR-0355).
          const { data: existingRows, error: existingErr } = await ctx.supabaseAdmin
            .from("workspace_union_binding")
            .select("workspace_union_binding_id, union_id, law_version")
            .eq("workspace_id", ctx.workspaceId as string)
            .is("effective_to", null)
            .limit(1);

          if (existingErr) {
            throw new Error(`existing_binding_check_failed: ${existingErr.message}`);
          }

          if (!existingRows || existingRows.length === 0) {
            // No active binding — caller must use setup_workspace_tariff.
            return {
              ok: false,
              code: "NO_EXISTING_BINDING",
              message:
                "no active tariff binding found — use setup_workspace_tariff to create first binding",
            };
          }

          const existing = existingRows[0]!;
          const oldBindingId = existing.workspace_union_binding_id as string;
          const oldUnionId = existing.union_id as string;
          const oldLawVersion = existing.law_version as string;

          // ── 4b. Classify amendment via Lovsen-owned rule matrix ──────────
          // Replaces previous inline TARIFF_REVISION/UNION_CHANGE heuristic.
          // Single source of truth for Aml. §14-6 + Riksavtalen §4 classification
          // lives in packages/ai/src/capabilities/legal/amendment-classifier.ts.
          // ADR-0173 frozen-4: legal owns the rule matrix, payroll calls it.
          // Output drives the cascade amendment_classifier enum:
          //   UP                 → cascade accepts, writes new binding
          //   MATERIAL           → cascade BLOCKS (AMENDMENT_BLOCKED §14-6(m)),
          //                        admin must route via amendment-handler with signering
          //   ENDRINGSOPPSIGELSE → cascade BLOCKS (AMENDMENT_BLOCKED §14-6(m)),
          //                        requires ansatt-signering + §15-3 oppsigelsesfrist
          const prevState: AmendmentPrevState = {
            union_id: oldUnionId,
            law_version: oldLawVersion,
            is_tariff_bound: oldUnionId !== "non-bound",
          };
          const nextState: AmendmentNextState = {
            union_id: input.new_union_id,
            law_version: input.new_law_version,
            is_tariff_bound: input.new_union_id !== "non-bound",
          };
          const classification = classifyAmendmentLogic(prevState, nextState, {
            workspace_id: input.workspace_id,
            // Same-union + new law_version triggers Riksavtalen §4 carve-out
            // explicitly via the classifier's Rule 7; no extra flag needed.
          });

          // ── 4c. Call cascade delegation tool ─────────────────────────────
          // caller_capability literal 'payroll' required per ADR-0356 §"Audit trail symmetry".
          // amendment_classifier passed verbatim from Lovsen classification:
          // MATERIAL / ENDRINGSOPPSIGELSE will hit cascade's AMENDMENT_BLOCKED guard
          // (cascade tools.ts lines 158-170), surface §14-6(m), and Phase 7f
          // amendment-handler owns the signering path. UP proceeds to write.
          const cascadeResult = await bindWorkspaceUnionTool.execute(
            {
              workspace_id: input.workspace_id,
              union_id: input.new_union_id,
              law_version: input.new_law_version,
              effective_from: input.effective_from ?? input.official_effective_date,
              amendment_classifier: classification.classifier,
              derivation_snapshot_id: input.derivation_snapshot_id,
              caller_capability: CAPABILITY,
            },
            ctx,
          );

          const cascadeParsed = JSON.parse(cascadeResult) as {
            ok: boolean;
            workspace_union_binding_id?: string;
            effective_from?: string;
            cascade_emit_id?: string;
            code?: string;
            message?: string;
          };

          if (!cascadeParsed.ok) {
            return {
              ok: false,
              code: cascadeParsed.code ?? "CASCADE_ERROR",
              message: cascadeParsed.message,
              aml_refs: classification.aml_refs,
              classification_reason: classification.reason,
              requires_resigning: classification.requires_resigning,
            };
          }

          return {
            ok: true,
            old_workspace_union_binding_id: oldBindingId,
            new_workspace_union_binding_id: cascadeParsed.workspace_union_binding_id!,
            effective_from: cascadeParsed.effective_from!,
            amendment_classifier: classification.classifier,
            old_law_version: oldLawVersion,
            // Phase 7h: read TRUE cascade emit id from cascade result.
            cascade_emit_id: cascadeParsed.cascade_emit_id ?? null,
          };
        },
      });

      // ── 5. Branch on exec result ─────────────────────────────────────────
      if (!result.ok) {
        return JSON.stringify(result);
      }

      // result is narrowed to ChangeExecOk after !result.ok guard.
      const okResult = result;

      // ── 6. Emit payroll-layer telemetry (uuid-before-emit pattern) ──────────
      const payrollEmitId = randomUUID();
      // cascade_emit_id: read from cascade result (Phase 7h — true round-trip).
      const cascadeEmitId = okResult.cascade_emit_id;
      await emit({
        event: "payroll.workspace_tariff_changed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        correlation_id: payrollEmitId,
        properties: {
          entity: {
            entity_type: "workspace_union_binding",
            entity_id: okResult.new_workspace_union_binding_id,
          },
          data: {
            old_workspace_union_binding_id: okResult.old_workspace_union_binding_id,
            new_workspace_union_binding_id: okResult.new_workspace_union_binding_id,
            workspace_id: input.workspace_id,
            new_union_id: input.new_union_id,
            new_law_version: input.new_law_version,
            effective_from: okResult.effective_from,
            amendment_classifier: okResult.amendment_classifier,
            reason: input.reason ?? null,
            actor_capability: CAPABILITY,
            delegated_via: CASCADE_CAPABILITY,
            actor_id: ctx.profileId as string,
          },
        },
      });

      // ── 7. Return (includes emit IDs + old_law_version for BFF audit block) ─
      return JSON.stringify({
        ok: true as const,
        old_workspace_union_binding_id: okResult.old_workspace_union_binding_id,
        new_workspace_union_binding_id: okResult.new_workspace_union_binding_id,
        effective_from: okResult.effective_from,
        amendment_classifier: okResult.amendment_classifier,
        old_law_version: okResult.old_law_version,
        payroll_emit_id: payrollEmitId,
        cascade_emit_id: cascadeEmitId,
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({
          ok: false as const,
          code: "AUTHORITY_DENIED" as const,
          message: err.message,
        });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({
          ok: false as const,
          code: "PAYROLL_GATE_ERROR" as const,
          message: err.message,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        code: "CHANGE_TARIFF_FAILED" as const,
        message: msg,
      });
    }
  },
});

// ─── add_supplement_override ─────────────────────────────────────────────────

const addSupplementOverrideSchema = z.object({
  workspace_id: z
    .string()
    .uuid()
    .describe(
      "Workspace to write to. MUST match authenticated ctx.workspaceId (ADR-0151 + L-0177).",
    ),
  name: z.string().describe("Human-readable name for this supplement rule."),
  supplement_type: z
    .enum(["normal", "week_based", "day_based", "manual", "holiday", "contract_rule"])
    .describe("Supplement type per CHECK constraint on public.supplement_rule."),
  rate_value: z
    .number()
    .min(0)
    .describe(
      "Rate value (ore per hour, percentage, or fixed ore per shift). " +
        "Must be >= tariff floor for tariff-bound workspaces (enforced by DB trigger).",
    ),
  rate_type: z
    .enum(["fixed_per_hour", "percentage", "fixed_per_shift"])
    .default("fixed_per_hour")
    .describe("Rate calculation method. Default: fixed_per_hour."),
  tariff_rate_table_id: z
    .string()
    .uuid()
    .nullable()
    .default(null)
    .describe(
      "Optional FK to public.tariff_rate_table. NULL = workspace override not linked to tariff table.",
    ),
  paragraf_ref: z
    .string()
    .nullable()
    .default(null)
    .describe("Optional law paragraph reference e.g. '§14-7 (3)'. Surfaced in audit trail."),
  match_predicate: z
    .record(z.unknown())
    .default({})
    .describe(
      "JSON predicate evaluated by calc engine to decide when this rule applies. " +
        "Empty object = matches all shifts (unconditional supplement).",
    ),
  valid_from: z
    .string()
    .nullable()
    .default(null)
    .describe("ISO date from which this rule is active. NULL = immediately active."),
  valid_until: z
    .string()
    .nullable()
    .default(null)
    .describe("ISO date until which this rule is active. NULL = no expiry."),
});

/**
 * add_supplement_override — workspace-specific supplement above tariff floor.
 *
 * Body: L-0177 fail-fast → chat-channel guard → cross-workspace block →
 *   payroll gate (mutateWithGate) →
 *   call cascade.add_supplement_rule(caller_capability='payroll') →
 *   emit payroll.supplement_override_added (actor_capability='payroll', delegated_via='cascade') →
 *   return { supplement_rule_id }.
 *
 * Tariff-floor enforcement is in the PostgreSQL BEFORE INSERT trigger (Sortie 2 Part G).
 * If rate_value is below the tariff minimum, cascade returns SUPPLEMENT_BELOW_TARIFF_FLOOR
 * with aml_ref §14-15 — passed through verbatim.
 *
 * Admin or manager can call this tool (authority config seeded at 'confirm'/'manager'
 * per 20260619100000_payroll_tariff_tools_authority_seed.sql).
 *
 * Satisfies ADR-0204, ADR-0356, ADR-0351 (tariff floor trigger), L-0177.
 */
export const addSupplementOverrideTool = defineTool({
  name: "add_supplement_override",
  description:
    "Payroll tool — add a workspace-specific supplement rule (tillegg) above the tariff floor per ADR-0250. " +
    "Delegates to cascade.add_supplement_rule(caller_capability='payroll') per ADR-0356. " +
    "PostgreSQL BEFORE INSERT trigger (Sortie 2) enforces tariff floor; returns SUPPLEMENT_BELOW_TARIFF_FLOOR " +
    "(aml_ref §14-15) if rate_value is below minimum for tariff-bound workspace. " +
    "Admin or manager role. Chat channel only (ADR-0078 Høy-PII). " +
    "Both payroll gate AND cascade gate fire independently per ADR-0356 §'Gate convention'. " +
    "Both layers emit with audit-symmetry per ADR-0356 §'Audit trail symmetry'. " +
    "Returns { supplement_rule_id }.",
  capability: CAPABILITY,
  schema: addSupplementOverrideSchema,
  execute: async (input, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // ── 1. L-0177 fail-fast ──────────────────────────────────────────────────
    if (!ctx.workspaceId || (ctx.workspaceId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "add_supplement_override requires resolved workspaceId (ADR-0134 + L-0177)",
      });
    }
    if (!ctx.profileId || (ctx.profileId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message: "add_supplement_override requires resolved profileId (ADR-0134 + L-0177)",
      });
    }

    // ── 2. Channel guard ─────────────────────────────────────────────────────
    const channelCheck = assertChatChannel(channel);
    if (channelCheck.denied) {
      return JSON.stringify({
        ok: false as const,
        code: "CHANNEL_DENIED" as const,
        message: channelCheck.msg,
      });
    }

    // ── 3. Cross-workspace block (ADR-0151) ──────────────────────────────────
    if (input.workspace_id !== (ctx.workspaceId as string)) {
      return JSON.stringify({
        ok: false as const,
        code: "INVALID_WORKSPACE" as const,
        message: "workspace_id in body must match authenticated workspace (ADR-0151)",
      });
    }

    // ── 4. gatedMutation — payroll authority gate ────────────────────────────
    try {
      const { result } = await mutateWithGate<SupplementExecResult>(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId as string,
        profileId: ctx.profileId as string,
        capability: CAPABILITY,
        actionType: "add_supplement_override",
        channel,
        exec: async (_db): Promise<SupplementExecResult> => {
          // ── 4a. Call cascade delegation tool ─────────────────────────────
          // caller_capability literal 'payroll' required per ADR-0356 §"Audit trail symmetry".
          const cascadeResult = await addSupplementRuleTool.execute(
            {
              workspace_id: input.workspace_id,
              name: input.name,
              supplement_type: input.supplement_type,
              rate_value: input.rate_value,
              rate_type: input.rate_type,
              tariff_rate_table_id: input.tariff_rate_table_id,
              paragraf_ref: input.paragraf_ref,
              match_predicate: input.match_predicate,
              valid_from: input.valid_from,
              valid_until: input.valid_until,
              caller_capability: CAPABILITY,
            },
            ctx,
          );

          const cascadeParsed = JSON.parse(cascadeResult) as {
            ok: boolean;
            supplement_rule_id?: string;
            cascade_emit_id?: string;
            code?: string;
            message?: string;
            aml_ref?: string;
            floor?: number | null;
            proposed?: number;
          };

          if (!cascadeParsed.ok) {
            // Pass through cascade errors verbatim (includes SUPPLEMENT_BELOW_TARIFF_FLOOR).
            return {
              ok: false,
              code: cascadeParsed.code ?? "CASCADE_ERROR",
              message: cascadeParsed.message,
              aml_ref: cascadeParsed.aml_ref,
              floor: cascadeParsed.floor,
              proposed: cascadeParsed.proposed,
            };
          }

          return {
            ok: true,
            supplement_rule_id: cascadeParsed.supplement_rule_id!,
            // Phase 7h: read TRUE cascade emit id from cascade result.
            cascade_emit_id: cascadeParsed.cascade_emit_id ?? null,
          };
        },
      });

      // ── 5. Branch on exec result ─────────────────────────────────────────
      if (!result.ok) {
        // Pass through cascade errors (including SUPPLEMENT_BELOW_TARIFF_FLOOR).
        return JSON.stringify(result);
      }

      // result is narrowed to SupplementExecOk after !result.ok guard.
      const okResult = result;

      // ── 6. Emit payroll-layer telemetry (uuid-before-emit pattern) ──────────
      const payrollEmitId = randomUUID();
      // cascade_emit_id: read from cascade result (Phase 7h — true round-trip).
      const cascadeEmitId = okResult.cascade_emit_id;
      await emit({
        event: "payroll.supplement_override_added",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        correlation_id: payrollEmitId,
        properties: {
          entity: {
            entity_type: "supplement_rule",
            entity_id: okResult.supplement_rule_id,
          },
          data: {
            supplement_rule_id: okResult.supplement_rule_id,
            workspace_id: input.workspace_id,
            supplement_type: input.supplement_type,
            rate_value: input.rate_value,
            rate_type: input.rate_type,
            paragraf_ref: input.paragraf_ref ?? null,
            actor_capability: CAPABILITY,
            delegated_via: CASCADE_CAPABILITY,
            actor_id: ctx.profileId as string,
          },
        },
      });

      // ── 7. Return (includes emit IDs for BFF audit block) ───────────────
      return JSON.stringify({
        ok: true as const,
        supplement_rule_id: okResult.supplement_rule_id,
        payroll_emit_id: payrollEmitId,
        cascade_emit_id: cascadeEmitId,
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        return JSON.stringify({
          ok: false as const,
          code: "AUTHORITY_DENIED" as const,
          message: err.message,
        });
      }
      if (err instanceof MutateWithGateError) {
        return JSON.stringify({
          ok: false as const,
          code: "PAYROLL_GATE_ERROR" as const,
          message: err.message,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        code: "ADD_SUPPLEMENT_FAILED" as const,
        message: msg,
      });
    }
  },
});
