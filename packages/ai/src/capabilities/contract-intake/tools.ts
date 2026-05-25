// packages/ai/src/capabilities/contract-intake/tools.ts
//
// Tools for collecting employee PII (personal number, bank account, address)
// during contract data intake. Chat-only by design (ADR-0078) — voice and
// other channels are refused at three layers: process, capability, and tool.
//
// Every mutation (submit_field_group, decline_intake) MUST call
// `callGateAction` before touching any domain table (ADR-0099, ADR-0196
// Invariant 13). The tool-level channel guard at the top of each write
// tool is defence-in-depth only — gate_action independently enforces
// channel + min_role + four-eyes.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { validatePersonnummer, validateNorwegianBankAccount } from "@smartout/utils";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";
import {
  mutateWithGate,
  MutateWithGateDenied,
  MutateWithGateError,
} from "../_shared/mutate-with-gate.js";

// Address fields are folded into 'identity' group per Phase 1 alignment.
// Two field groups remain: identity (personnummer + address) and banking.
const fieldGroupEnum = z.enum(["identity", "banking"]);

const CAPABILITY = "contract_intake";

// Tool-level channel guard at the top of each write tool ensures the gate
// sees `channel='chat'` — belt-and-braces with ADR-0078 layer 2 (capability
// allowedChannels) and layer 1 (process allowed_channels).
const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "chat";

// Minimal discriminated-union shape, forward-compatible with ADR-0138
// (ToolGateResult<T>). We intentionally keep the legacy string-JSON
// surface so existing LLM prompts + Emma/Botsson turn transcripts keep
// parsing the `{ allowed, reason, ... }` fields they already read.
// `outcome` + `user_message` are additive — consumers that ignore them
// still work; the router and prompt templates can opt-in when ready.
type BlockOutcome = {
  allowed: false;
  outcome: "blocked";
  reason: string;
  user_message: string;
};

type FourEyesPendingOutcome = {
  allowed: false;
  outcome: "four_eyes_pending";
  reason: "four_eyes_required";
  approvers_needed: number;
  approvers_present: string[];
  user_message: string;
};

type SuggestDowngradeOutcome = {
  allowed: false;
  outcome: "confirmation_required";
  reason: "downgraded_to_suggest";
  user_message: string;
};

type AppliedSubmitOutcome = {
  allowed: true;
  outcome: "applied";
  saved: true;
  group: "identity" | "banking";
  complete: boolean;
  user_message: string;
};

type AppliedDeclineOutcome = {
  allowed: true;
  outcome: "applied";
  declined: true;
  user_message: string;
};

const toJson = (payload: unknown): string => JSON.stringify(payload);

// Fixed user-visible copy (ADR-0138 field `user_message`). Norwegian —
// the LLM may surface verbatim or as a seed. `{reason}` is interpolated
// by the tool when a gate reason is available; the LLM should not
// elaborate beyond what is returned.
const BLOCK_MESSAGE = (reason: string): string =>
  `Jeg kan ikke registrere opplysningene akkurat nå (${reason}). Ta kontakt med administrator.`;

const FOUR_EYES_MESSAGE =
  "Innsending krever godkjenning fra en annen godkjenner før den kan fullføres.";

const DOWNGRADE_MESSAGE =
  "Innsendingen må bekreftes manuelt før den lagres. Gi meg et 'ja, send inn' for å gå videre.";

// ── submit_field_group ──────────────────────────────────────────────────────

export const submitFieldGroup = defineTool({
  name: "submit_field_group",
  description:
    "Submit a group of PII fields (identity or banking) for the employee's contract intake. " +
    "Identity includes personal_number and address fields. Banking includes bank_account. " +
    "Chat-only — refuses on any other channel.",
  capability: "contract_intake",
  schema: z.object({
    group: fieldGroupEnum.describe("Which field group to submit"),
    values: z.record(z.string()).describe("Key-value pairs for the field group"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 layer 3: tool-level channel guard — only chat is allowed for PII.
    // Kept for defence-in-depth; gate_action also enforces channel independently.
    if (ctx.channel !== "chat") {
      return "Denne informasjonen kan kun sendes via chat. Vennligst bytt til chat for å oppgi personopplysninger.";
    }

    const { group, values } = params;

    // Validate Norwegian formats with Modulus 11 checksum BEFORE calling
    // the gate — gate evaluation writes a row to gate_evaluation, and we
    // don't want that audit trail polluted with trivially-invalid inputs.
    if (group === "identity" && values.personal_number) {
      if (!validatePersonnummer(values.personal_number)) {
        return "Ugyldig personnummer — sjekk at alle 11 siffer er korrekte.";
      }
    }

    if (group === "identity" && values.postal_code) {
      if (!/^\d{4}$/.test(values.postal_code)) {
        return "Ugyldig postnummer — må være nøyaktig 4 siffer.";
      }
    }

    if (group === "banking" && values.bank_account) {
      if (!validateNorwegianBankAccount(values.bank_account)) {
        return "Ugyldig kontonummer — sjekk at alle 11 siffer er korrekte.";
      }
    }

    // PII writes MUST use employee-scoped client so auth.uid() resolves
    // correctly. service role would make auth.uid() return NULL, breaking
    // submit_own_pii. Validate up-front so we don't burn a gate decision
    // on a request that can't write.
    const userClient = ctx.supabaseUser;
    if (!userClient) {
      return "Intern feil: mangler brukerautentisering for PII-lagring. Prøv igjen.";
    }

    // ADR-0204 §3: gate_action (Pathway A) + cascade_gate_write (Pathway B)
    // + submit_own_pii RPC composed in one correlated audit chain.
    // The wrapper-passed admin client runs the gate RPCs; inside exec we
    // explicitly use userClient for submit_own_pii because the RPC reads
    // auth.uid() server-side and needs the employee JWT (admin client
    // would auth.uid()=NULL → write rejected).
    //
    // The employee is the data subject, so targetId = ctx.profileId
    // (lets ADR-0101 four-eyes scope per-profile).
    const channel = normaliseChannel(ctx.channel);
    try {
      await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "submit_field_group",
        channel,
        targetId: ctx.profileId,
        exec: async () => {
          // Identity group may contain both personnummer and address fields.
          // submit_own_pii handles identity (personal_number) in one call.
          // Address fields need a separate call with field_group='address'.
          if (group === "identity") {
            if (values.personal_number) {
              const { error: idError } = await userClient.rpc("submit_own_pii", {
                p_workspace_id: ctx.workspaceId,
                p_field_group: "identity",
                p_values: { personal_number: values.personal_number },
              });
              if (idError) throw new Error(`Feil ved lagring av personnummer: ${idError.message}`);
            }
            const addressFields: Record<string, string> = {};
            for (const key of ["address_line_1", "address_line_2", "postal_code", "city"]) {
              if (values[key]) addressFields[key] = values[key];
            }
            if (Object.keys(addressFields).length > 0) {
              const { error: addrError } = await userClient.rpc("submit_own_pii", {
                p_workspace_id: ctx.workspaceId,
                p_field_group: "address",
                p_values: addressFields,
              });
              if (addrError) throw new Error(`Feil ved lagring av adresse: ${addrError.message}`);
            }
          } else {
            // Banking group — single RPC call.
            const { error } = await userClient.rpc("submit_own_pii", {
              p_workspace_id: ctx.workspaceId,
              p_field_group: group,
              p_values: values,
            });
            if (error) throw new Error(`Feil ved lagring: ${error.message}`);
          }
          return {};
        },
      });
    } catch (err) {
      // Map mutateWithGate deny outcomes to the existing typed result
      // shapes (FourEyesPendingOutcome / SuggestDowngradeOutcome /
      // BlockOutcome) so the prompt-side retry logic stays intact.
      if (err instanceof MutateWithGateDenied) {
        if (err.fourEyesRequired) {
          const result: FourEyesPendingOutcome = {
            allowed: false,
            outcome: "four_eyes_pending",
            reason: "four_eyes_required",
            approvers_needed: err.approversNeeded ?? 2,
            approvers_present: err.approversPresent ?? [ctx.profileId],
            user_message: FOUR_EYES_MESSAGE,
          };
          return toJson(result);
        }
        if (err.downgradedTo === "suggest") {
          const result: SuggestDowngradeOutcome = {
            allowed: false,
            outcome: "confirmation_required",
            reason: "downgraded_to_suggest",
            user_message: DOWNGRADE_MESSAGE,
          };
          return toJson(result);
        }
        const blockReason = err.message || "denied";
        const result: BlockOutcome = {
          allowed: false,
          outcome: "blocked",
          reason: blockReason,
          user_message: BLOCK_MESSAGE(blockReason),
        };
        return toJson(result);
      }
      if (err instanceof MutateWithGateError) {
        return `Intern feil: gate utilgjengelig (${err.code}). Prøv igjen.`;
      }
      // exec-side errors (submit_own_pii failures) — preserve the
      // Norwegian user-facing messages thrown above.
      return err instanceof Error ? err.message : "Feil ved lagring.";
    }

    void emit({
      event: "contract intake field submitted",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: ctx.profileId },
        data: { group },
      },
    });

    // Phase 3: After successful save, check if all PII is now complete
    const { data: completionResult } = await ctx.supabaseAdmin.rpc(
      "check_contract_intake_completion",
      {
        p_profile_id: ctx.profileId,
        p_workspace_id: ctx.workspaceId,
      },
    );

    const complete = completionResult?.complete === true;
    const contractId = (completionResult?.contract_id as string) ?? null;

    if (complete && contractId) {
      void emit({
        event: "contract intake completed",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "employment_contract" as const, entity_id: contractId },
          data: { contract_id: contractId, duration_hours: 0 },
        },
      });
    }

    // CRITICAL: never echo submitted values — only confirm save + completion status.
    const applied: AppliedSubmitOutcome = {
      allowed: true,
      outcome: "applied",
      saved: true,
      group,
      complete,
      user_message: complete
        ? "Takk — alle opplysningene er registrert og kontrakten er klar til signering."
        : "Opplysningene er lagret.",
    };
    return toJson(applied);
  },
});

// ── decline_intake ──────────────────────────────────────────────────────────

export const declineIntake = defineTool({
  name: "decline_intake",
  description:
    "Employee declines to provide PII for contract intake. Records the refusal and notifies the admin for follow-up.",
  capability: "contract_intake",
  schema: z.object({
    reason_code: z
      .enum(["privacy_concern", "incorrect_request", "will_do_later", "other"])
      .describe("Reason category for declining"),
    reason_text: z.string().optional().describe("Free-text reason (optional)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const { reason_code, reason_text } = params;

    // ADR-0078 layer 3 parity with submit_field_group: PII-adjacent
    // action (declining an intake) stays on chat. The capability-level
    // allowedChannels already enforces this, but the tool guard keeps
    // the three-layer defence symmetrical.
    if (ctx.channel && ctx.channel !== "chat") {
      return "Avvisning av intake må skje via chat. Bytt til chat og prøv igjen.";
    }

    // ADR-0204 §3: gate_action (Pathway A) + cascade_gate_write (Pathway B)
    // + decline_contract_intake RPC composed in one correlated audit chain.
    // Decline flips contract status + emits a signalling event — both
    // are governance-visible state transitions that deserve an audit row.
    const channel = normaliseChannel(ctx.channel);
    try {
      await mutateWithGate(ctx.supabaseAdmin, {
        workspaceId: ctx.workspaceId,
        profileId: ctx.profileId,
        capability: CAPABILITY,
        actionType: "decline_intake",
        channel,
        targetId: ctx.profileId,
        exec: async (db) => {
          const { error } = await db.rpc("decline_contract_intake", {
            p_profile_id: ctx.profileId,
            p_workspace_id: ctx.workspaceId,
            p_reason: reason_text ?? reason_code,
          });
          if (error) throw new Error(`Feil ved avvisning: ${error.message}`);
          // If running inside an engine process, mark the step as failed.
          if (ctx.engineStateId) {
            await db
              .from("engine_state_step")
              .update({
                status: "failed",
                result: { declined: true, reason_code, reason_text },
              })
              .eq("engine_state_id", ctx.engineStateId)
              .eq("status", "active");
          }
          return {};
        },
      });
    } catch (err) {
      if (err instanceof MutateWithGateDenied) {
        if (err.fourEyesRequired) {
          const result: FourEyesPendingOutcome = {
            allowed: false,
            outcome: "four_eyes_pending",
            reason: "four_eyes_required",
            approvers_needed: err.approversNeeded ?? 2,
            approvers_present: err.approversPresent ?? [ctx.profileId],
            user_message: FOUR_EYES_MESSAGE,
          };
          return toJson(result);
        }
        if (err.downgradedTo === "suggest") {
          const result: SuggestDowngradeOutcome = {
            allowed: false,
            outcome: "confirmation_required",
            reason: "downgraded_to_suggest",
            user_message: DOWNGRADE_MESSAGE,
          };
          return toJson(result);
        }
        const blockReason = err.message || "denied";
        const result: BlockOutcome = {
          allowed: false,
          outcome: "blocked",
          reason: blockReason,
          user_message: BLOCK_MESSAGE(blockReason),
        };
        return toJson(result);
      }
      if (err instanceof MutateWithGateError) {
        return `Intern feil: gate utilgjengelig (${err.code}). Prøv igjen.`;
      }
      return err instanceof Error ? err.message : "Feil ved avvisning.";
    }

    void emit({
      event: "contract intake declined",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: ctx.profileId },
        data: { group: "all", reason_code },
      },
    });

    const applied: AppliedDeclineOutcome = {
      allowed: true,
      outcome: "applied",
      declined: true,
      user_message: "Din administrator vil følge opp.",
    };
    return toJson(applied);
  },
});

// ── get_intake_progress ─────────────────────────────────────────────────────

export const getIntakeProgress = defineTool({
  name: "get_intake_progress",
  description:
    "Check which PII field groups the employee has completed vs still pending. " +
    "Returns contract_id and engine_state_id for context. Never returns actual PII values.",
  capability: "contract_intake",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("profile")
      .select("personal_number, bank_account, address_line_1, postal_code, city")
      .eq("profile_id", ctx.profileId)
      .single();

    if (error) return `Feil ved henting av status: ${error.message}`;
    if (!data) return "Profil ikke funnet.";

    // Report completion status per group — never reveal actual values
    const identity =
      data.personal_number && data.address_line_1 && data.postal_code && data.city
        ? "done"
        : "pending";
    const banking = data.bank_account ? "done" : "pending";

    // Look up contract_id and engine_state_id for the active intake
    const { data: contract } = await ctx.supabaseAdmin
      .from("employment_contract")
      .select("contract_id")
      .eq("profile_id", ctx.profileId)
      .eq("workspace_id", ctx.workspaceId)
      .eq("status", "pending_data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const contractId = contract?.contract_id ?? null;

    let engineStateId: string | null = null;
    if (contractId) {
      const { data: state } = await ctx.supabaseAdmin
        .from("engine_state")
        .select("id")
        .eq("entity_type", "employment_contract")
        .eq("entity_id", contractId)
        .eq("status", "running")
        .limit(1)
        .maybeSingle();
      engineStateId = state?.id ?? null;
    }

    return JSON.stringify({
      identity,
      banking,
      contract_id: contractId,
      engine_state_id: engineStateId,
    });
  },
});
