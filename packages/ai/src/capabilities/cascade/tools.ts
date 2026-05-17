/**
 * packages/ai/src/capabilities/cascade/tools.ts
 *
 * Cascade capability delegation tools (ADR-0356 + ADR-0173 frozen-4).
 *
 * Two tools — both are delegation tools per ADR-0356 §"Pattern definition":
 *   - bind_workspace_union    writes public.workspace_union_binding (ADR-0355)
 *   - add_supplement_rule     writes public.supplement_rule
 *
 * These tools MUST be called by payroll capability tools (Phase 7f) instead of
 * writing directly to the cascade-namespace tables. Direct writes from payroll
 * tools would violate ADR-0173 frozen-4 capability boundaries. ADR-0240 set
 * the precedent (journey_authoring delegates to journey.publish_mission);
 * ADR-0356 generalizes that pattern across all capability domains.
 *
 * Gate convention (ADR-0356 §"Gate convention"):
 *   Both the CALLER gate and THIS delegation tool gate must approve for the
 *   write to proceed. The cascade gate is independent — it is NOT a rubber
 *   stamp of the caller's authority check.
 *
 * L-0177 fail-fast: workspaceId + profileId MUST resolve non-empty from ctx
 * BEFORE any DB read or write. Silent fallback to JWT-default workspace_id is
 * a documented bug class (L-0177 + ADR-0151). Hard-error here.
 *
 * L-0176 defense: tool docstrings match the body. Gate is in body, not just
 * in comments. All mutations go through gatedMutation (ADR-0204).
 *
 * ADR-0152: structured error envelope on PG-level exceptions (tariff-floor
 * trigger, AMENDMENT_BLOCKED, cross-workspace mismatch).
 *
 * References:
 *   ADR-0099 — unified authority gate (gate_action RPC contract).
 *   ADR-0134 — actor_id non-null, workspace_id non-null telemetry contract.
 *   ADR-0151 — workspace_id server-derived, never body-supplied.
 *   ADR-0152 — structured error envelope (code + aml_ref + message).
 *   ADR-0173 — frozen-4 capability boundaries (cross-namespace write defense).
 *   ADR-0204 — gatedMutation per-tool authority.
 *   ADR-0240 — journey delegation precedent (generalized by ADR-0356).
 *   ADR-0252 — Riksavtalen versjonering; §F amendment-classifier.
 *   ADR-0287 — gate_action mandatory on mutation capability tools.
 *   ADR-0355 — workspace_union_binding table contract + APPEND-ONLY semantics.
 *   ADR-0356 — cascade-namespace delegation pattern.
 *   L-0176   — docstring-vs-body anti-pattern (body written first here).
 *   L-0177   — fail-fast on missing workspace_id / profile_id.
 */

import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";

// ─── Shared constants ────────────────────────────────────────────────────────

const CAPABILITY = "cascade" as const;
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// ─── bind_workspace_union ────────────────────────────────────────────────────

const bindWorkspaceUnionSchema = z.object({
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
  effective_from: z.string().describe("ISO date (YYYY-MM-DD) from which this binding is active."),
  amendment_classifier: z
    .enum(["BOOTSTRAP", "UP", "MATERIAL", "ENDRINGSOPPSIGELSE", "BOOTSTRAP-BACKFILL"])
    .describe(
      "Lifecycle classifier per ADR-0252 §F. MATERIAL and ENDRINGSOPPSIGELSE are BLOCKED " +
        "here — they require employee signering per ADR-0252 §F + §14-6(m).",
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

export const bindWorkspaceUnionTool = defineTool({
  name: "bind_workspace_union",
  description:
    "Cascade delegation tool — writes public.workspace_union_binding per ADR-0355 + ADR-0356. " +
    "Called by payroll capability tools (setup_workspace_tariff, change_workspace_tariff); " +
    "NEVER called directly by users. Enforces: L-0177 ctx fail-fast, cross-workspace block, " +
    "AMENDMENT_BLOCKED for MATERIAL/ENDRINGSOPPSIGELSE (requires employee signering per ADR-0252 §F). " +
    "BOOTSTRAP + UP + BOOTSTRAP-BACKFILL classifiers proceed. " +
    "Cache trigger (trg_sync_workspace_settings_union_cache) fires automatically on INSERT. " +
    "Returns { workspace_union_binding_id, effective_from }.",
  capability: CAPABILITY,
  schema: bindWorkspaceUnionSchema,
  execute: async (input, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // ── 1. L-0177 fail-fast ──────────────────────────────────────────────────
    // workspaceId + profileId MUST resolve non-empty from ctx BEFORE any DB
    // call. Silent fallback to JWT-default is the bug class documented in
    // L-0177 + ADR-0151. Hard-error; caller must fix context resolution.
    if (!ctx.workspaceId || (ctx.workspaceId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message:
          "bind_workspace_union requires resolved workspaceId + profileId (ADR-0134 + L-0177)",
      });
    }
    if (!ctx.profileId || (ctx.profileId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message:
          "bind_workspace_union requires resolved workspaceId + profileId (ADR-0134 + L-0177)",
      });
    }

    // ── 2. Cross-workspace block ─────────────────────────────────────────────
    // body-supplied workspace_id MUST match authenticated ctx.workspaceId.
    // Mismatch = forged cross-workspace write attempt (ADR-0151, L-0177 class).
    if (input.workspace_id !== (ctx.workspaceId as string)) {
      return JSON.stringify({
        ok: false as const,
        code: "INVALID_WORKSPACE" as const,
        message: "workspace_id in body must match authenticated workspace (ADR-0151)",
      });
    }

    // ── 3. AMENDMENT block ───────────────────────────────────────────────────
    // MATERIAL and ENDRINGSOPPSIGELSE amendments require employee signering
    // per ADR-0252 §F + §14-6(m). The Phase 7f amendment-handler capability
    // owns this path. This delegation tool blocks those classifiers so payroll
    // tools cannot bypass the signering requirement.
    if (
      input.amendment_classifier === "MATERIAL" ||
      input.amendment_classifier === "ENDRINGSOPPSIGELSE"
    ) {
      return JSON.stringify({
        ok: false as const,
        code: "AMENDMENT_BLOCKED" as const,
        aml_ref: "§14-6(m)" as const,
        message:
          "tariff switch requires ansatt-signering per ADR-0252 §F — " +
          "out of scope for this delegation tool. Phase 7f amendment-handler owns this path.",
      });
    }

    // ── 4. gatedMutation — gate + DB writes ──────────────────────────────────
    // Per ADR-0204 + ADR-0287: ALL persistence in a capability mutation must
    // run inside gatedMutation. The gate fires independently of the caller's
    // gate (ADR-0356 §"Gate convention"). Both gates must approve.
    try {
      const { result } = await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId as string,
        profileId: ctx.profileId as string,
        capability: CAPABILITY,
        actionType: "bind_workspace_union",
        channel,
        exec: async (db) => {
          // Step A: Close any currently active binding for this workspace.
          // APPEND-ONLY invariant (ADR-0355 §B): the only allowed UPDATE on
          // workspace_union_binding is setting effective_to. The BEFORE UPDATE
          // trigger (trg_workspace_union_binding_immutability) enforces this
          // at the DB level and survives service-role RLS bypass.
          //
          // Compute effective_to = effective_from - 1 day.
          const effectiveTo = (() => {
            const d = new Date(input.effective_from);
            d.setDate(d.getDate() - 1);
            return d.toISOString().split("T")[0];
          })();

          const { data: existingRow } = await db
            .from("workspace_union_binding")
            .select("workspace_union_binding_id")
            .eq("workspace_id", input.workspace_id)
            .is("effective_to", null)
            .limit(1)
            .maybeSingle();

          if (existingRow?.workspace_union_binding_id) {
            const { error: closeErr } = await db
              .from("workspace_union_binding")
              .update({ effective_to: effectiveTo })
              .eq("workspace_union_binding_id", existingRow.workspace_union_binding_id)
              .eq("workspace_id", input.workspace_id); // belt-and-suspenders scope check
            if (closeErr) {
              throw new Error(`close_previous_binding_failed: ${closeErr.message}`);
            }
          }

          // Step B: INSERT new binding row.
          // Cache trigger (trg_sync_workspace_settings_union_cache) fires
          // AFTER INSERT automatically — updates payroll.workspace_settings
          // (is_tariff_bound + active_union_id). No manual cache sync needed.
          const { data: inserted, error: insertErr } = await db
            .from("workspace_union_binding")
            .insert({
              workspace_id: input.workspace_id,
              union_id: input.union_id,
              law_version: input.law_version,
              official_effective_date: input.effective_from,
              effective_from: input.effective_from,
              effective_to: null,
              created_by: ctx.profileId as string,
              amendment_classifier: input.amendment_classifier,
              derivation_snapshot_id: input.derivation_snapshot_id,
            })
            .select("workspace_union_binding_id, effective_from")
            .single();

          if (insertErr || !inserted) {
            throw new Error(
              `workspace_union_binding_insert_failed: ${insertErr?.message ?? "no data returned"}`,
            );
          }

          return {
            workspace_union_binding_id: inserted.workspace_union_binding_id as string,
            effective_from: inserted.effective_from as string,
          };
        },
      });

      // ── 5. Emit telemetry ────────────────────────────────────────────────
      // ADR-0356 §"Audit trail symmetry": delegated_via field is load-bearing.
      // Auditors query activity_trail WHERE delegated_via IS NOT NULL to find
      // all cross-namespace writes and trace both initiator + delegate.
      await emit({
        event: "cascade.workspace_union_binding_created",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "workspace",
            entity_id: input.workspace_id,
          },
          data: {
            workspace_union_binding_id: result.workspace_union_binding_id,
            workspace_id: input.workspace_id,
            union_id: input.union_id,
            law_version: input.law_version,
            amendment_classifier: input.amendment_classifier,
            delegated_via: CAPABILITY,
            actor_id: ctx.profileId as string,
          },
        },
      });

      // ── 6. Return typed result ────────────────────────────────────────────
      return JSON.stringify({
        ok: true as const,
        workspace_union_binding_id: result.workspace_union_binding_id,
        effective_from: result.effective_from,
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
          code: "CASCADE_GATE_ERROR" as const,
          message: err.message,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        code: "CASCADE_INSERT_FAILED" as const,
        message: msg,
      });
    }
  },
});

// ─── add_supplement_rule ─────────────────────────────────────────────────────

const addSupplementRuleSchema = z.object({
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
    .describe("Rate value (ore per hour, percentage, or fixed ore per shift)."),
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

export const addSupplementRuleTool = defineTool({
  name: "add_supplement_rule",
  description:
    "Cascade delegation tool — writes workspace-scoped row to public.supplement_rule per ADR-0356. " +
    "Called by payroll capability (add_supplement_override); NEVER called directly by users. " +
    "Enforces: L-0177 ctx fail-fast, cross-workspace block, workspace_id IS NOT NULL " +
    "(workspace capability writes NEVER target platform template rows per ADR-0356). " +
    "Tariff-floor BEFORE INSERT trigger (Sortie 2) raises EXCEPTION if rate_value is below " +
    "the tariff minimum for a tariff-bound workspace — caught and re-thrown as structured " +
    "ADR-0152 envelope (code: SUPPLEMENT_BELOW_TARIFF_FLOOR, aml_ref: §14-15). " +
    "Returns { supplement_rule_id }.",
  capability: CAPABILITY,
  schema: addSupplementRuleSchema,
  execute: async (input, ctx: AgentToolContext) => {
    const channel = normaliseChannel(ctx.channel);

    // ── 1. L-0177 fail-fast ──────────────────────────────────────────────────
    if (!ctx.workspaceId || (ctx.workspaceId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message:
          "add_supplement_rule requires resolved workspaceId + profileId (ADR-0134 + L-0177)",
      });
    }
    if (!ctx.profileId || (ctx.profileId as string).trim() === "") {
      return JSON.stringify({
        ok: false as const,
        code: "MISSING_PROFILE_CONTEXT" as const,
        message:
          "add_supplement_rule requires resolved workspaceId + profileId (ADR-0134 + L-0177)",
      });
    }

    // ── 2. Cross-workspace block ─────────────────────────────────────────────
    if (input.workspace_id !== (ctx.workspaceId as string)) {
      return JSON.stringify({
        ok: false as const,
        code: "INVALID_WORKSPACE" as const,
        message: "workspace_id in body must match authenticated workspace (ADR-0151)",
      });
    }

    // ── 3. gatedMutation — gate + DB write ───────────────────────────────────
    // Per ADR-0356: delegation tool enforces workspace_id IS NOT NULL at its
    // own gate level even though the schema allows NULL (NULL = platform template
    // row; workspace capability writes ALWAYS target workspace-scoped rows only).
    //
    // Tariff-floor error handling note:
    //   The BEFORE INSERT trigger raises EXCEPTION when rate_value is below the
    //   tariff floor for this workspace. mutateWithGate catches thrown errors from
    //   exec and re-throws them as MutateWithGateError('execute_failed', message).
    //   We therefore detect tariff-floor errors by inspecting the execute_failed
    //   message rather than a custom code property — pattern-matching the PG
    //   exception message is the correct intercept point here.
    type ExecResult =
      | { ok: true; supplement_rule_id: string }
      | {
          ok: false;
          code: "SUPPLEMENT_BELOW_TARIFF_FLOOR";
          floor: number | null;
          proposed: number;
        };

    let execResult: ExecResult | null = null;

    try {
      const { result } = await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId as string,
        profileId: ctx.profileId as string,
        capability: CAPABILITY,
        actionType: "add_supplement_rule",
        channel,
        exec: async (db) => {
          // Server-side enforce workspace_id from ctx (NOT body) as the final
          // value written to the DB. The body's workspace_id is only used for
          // the cross-workspace block above — the actual INSERT always uses
          // ctx.workspaceId to prevent any residual forgery risk.
          const { data: inserted, error: insertErr } = await db
            .from("supplement_rule")
            .insert({
              workspace_id: ctx.workspaceId as string, // server-derived, not body
              name: input.name,
              supplement_type: input.supplement_type,
              rate_value: input.rate_value,
              rate_type: input.rate_type,
              tariff_rate_table_id: input.tariff_rate_table_id,
              paragraf_ref: input.paragraf_ref,
              match_predicate: input.match_predicate,
              valid_from: input.valid_from,
              valid_until: input.valid_until,
            })
            .select("supplement_rule_id")
            .single();

          if (insertErr) {
            // The tariff-floor BEFORE INSERT trigger (Sortie 2 Part G) raises
            // EXCEPTION with message matching 'supplement_rate_below_tariff_floor'
            // when the proposed rate is below the tariff minimum for this workspace.
            // Capture structured result and throw to signal exec failure to wrapper.
            // The outer catch re-reads execResult to surface the ADR-0152 envelope.
            if (/supplement_rate_below_tariff_floor/i.test(insertErr.message)) {
              const floorMatch = insertErr.message.match(/floor=(\d+(?:\.\d+)?)/);
              const proposedMatch = insertErr.message.match(/proposed=(\d+(?:\.\d+)?)/);
              execResult = {
                ok: false,
                code: "SUPPLEMENT_BELOW_TARIFF_FLOOR",
                floor: floorMatch ? Number(floorMatch[1]) : null,
                proposed: proposedMatch ? Number(proposedMatch[1]) : input.rate_value,
              };
              throw new Error(`supplement_rate_below_tariff_floor: ${insertErr.message}`);
            }
            throw new Error(`supplement_rule_insert_failed: ${insertErr.message}`);
          }

          if (!inserted) {
            throw new Error("supplement_rule_insert_failed: no data returned");
          }

          return { supplement_rule_id: inserted.supplement_rule_id as string };
        },
      });

      // ── 4. Emit telemetry ────────────────────────────────────────────────
      // delegated_via field per ADR-0356 §"Audit trail symmetry".
      await emit({
        event: "cascade.supplement_rule_added",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: {
            entity_type: "workspace",
            entity_id: input.workspace_id,
          },
          data: {
            supplement_rule_id: result.supplement_rule_id,
            workspace_id: input.workspace_id,
            supplement_type: input.supplement_type,
            rate_value: input.rate_value,
            paragraf_ref: input.paragraf_ref,
            delegated_via: CAPABILITY,
            actor_id: ctx.profileId as string,
          },
        },
      });

      // ── 5. Return typed result ────────────────────────────────────────────
      return JSON.stringify({
        ok: true as const,
        supplement_rule_id: result.supplement_rule_id,
      });
    } catch (err) {
      // ── Structured error envelope (ADR-0152) ──────────────────────────────
      // Tariff-floor: exec captured the structured result before throwing.
      // Check execResult FIRST — it is set only when the PG trigger fires.
      if (
        execResult !== null &&
        (execResult as ExecResult & { code?: string }).code === "SUPPLEMENT_BELOW_TARIFF_FLOOR"
      ) {
        const belowFloor = execResult as Extract<ExecResult, { ok: false }>;
        return JSON.stringify({
          ok: false as const,
          code: "SUPPLEMENT_BELOW_TARIFF_FLOOR" as const,
          aml_ref: "§14-15" as const,
          floor: belowFloor.floor,
          proposed: belowFloor.proposed,
          message: "supplement rate below tariff minimum for tariff-bound workspace",
        });
      }
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
          code: "CASCADE_GATE_ERROR" as const,
          message: err.message,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        ok: false as const,
        code: "CASCADE_INSERT_FAILED" as const,
        message: msg,
      });
    }
  },
});
