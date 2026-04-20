// packages/ai/src/capabilities/contract-intake/tools.ts
//
// Tools for collecting employee PII (personal number, bank account, address)
// during contract data intake. Chat-only by design (ADR-0078) — voice and
// other channels are refused at three layers: process, capability, and tool.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { validatePersonnummer, validateNorwegianBankAccount } from "@smartout/utils";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// Address fields are folded into 'identity' group per Phase 1 alignment.
// Two field groups remain: identity (personnummer + address) and banking.
const fieldGroupEnum = z.enum(["identity", "banking"]);

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
    // ADR-0078 layer 3: tool-level channel guard — only chat is allowed for PII
    if (ctx.channel !== "chat") {
      return "Denne informasjonen kan kun sendes via chat. Vennligst bytt til chat for å oppgi personopplysninger.";
    }

    const { group, values } = params;

    // Validate Norwegian formats with Modulus 11 checksum
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

    // PII writes MUST use employee-scoped client so auth.uid() resolves correctly.
    // Using service role would make auth.uid() return NULL, breaking submit_own_pii.
    const userClient = ctx.supabaseUser;
    if (!userClient) {
      return "Intern feil: mangler brukerautentisering for PII-lagring. Prøv igjen.";
    }

    // Identity group may contain both personnummer and address fields.
    // submit_own_pii handles identity fields (personal_number) in one call.
    // Address fields need a separate call with field_group='address'.
    if (group === "identity") {
      // Submit personal_number if present
      if (values.personal_number) {
        const { error: idError } = await userClient.rpc("submit_own_pii", {
          p_workspace_id: ctx.workspaceId,
          p_field_group: "identity",
          p_values: { personal_number: values.personal_number },
        });
        if (idError) return `Feil ved lagring av personnummer: ${idError.message}`;
      }

      // Submit address fields if present
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
        if (addrError) return `Feil ved lagring av adresse: ${addrError.message}`;
      }
    } else {
      // Banking group — single RPC call
      const { error } = await userClient.rpc("submit_own_pii", {
        p_workspace_id: ctx.workspaceId,
        p_field_group: group,
        p_values: values,
      });
      if (error) return `Feil ved lagring: ${error.message}`;
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

    // CRITICAL: never echo submitted values — only confirm save + completion status
    return JSON.stringify({ saved: true, group, complete });
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

    // Call decline_contract_intake RPC to update contract status + insert event
    const { error } = await ctx.supabaseAdmin.rpc("decline_contract_intake", {
      p_profile_id: ctx.profileId,
      p_workspace_id: ctx.workspaceId,
      p_reason: reason_text ?? reason_code,
    });

    if (error) return `Feil ved avvisning: ${error.message}`;

    // If running inside an engine process, mark the step as failed
    if (ctx.engineStateId) {
      await ctx.supabaseAdmin
        .from("engine_state_step")
        .update({
          status: "failed",
          result: { declined: true, reason_code, reason_text },
        })
        .eq("engine_state_id", ctx.engineStateId)
        .eq("status", "active");
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

    return JSON.stringify({
      declined: true,
      message: "Din administrator vil følge opp.",
    });
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
