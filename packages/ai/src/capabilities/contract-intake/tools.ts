// packages/ai/src/capabilities/contract-intake/tools.ts
//
// Tools for collecting employee PII (personal number, bank account, address)
// during contract data intake. Chat-only by design (ADR-0078) — voice and
// other channels are refused at three layers: process, capability, and tool.
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

const fieldGroupEnum = z.enum(["identity", "banking", "address"]);

// ── submit_field_group ──────────────────────────────────────────────────────

export const submitFieldGroup = defineTool({
  name: "submit_field_group",
  description:
    "Submit a group of PII fields (identity, banking, or address) for the employee's contract intake. Chat-only — refuses on any other channel.",
  schema: z.object({
    group: fieldGroupEnum.describe("Which field group to submit"),
    values: z.record(z.string()).describe("Key-value pairs for the field group"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 layer 3: tool-level channel guard — only chat is allowed for PII
    if (ctx.channel !== "chat") {
      return "Denne informasjonen kan kun sendes via chat. Vennligst bytt til chat for å oppgi personopplysninger.";
    }

    // Validate Norwegian formats per field group
    const { group, values } = params;

    if (group === "identity" && values.personal_number) {
      if (!/^\d{11}$/.test(values.personal_number)) {
        return "Ugyldig personnummer — må være nøyaktig 11 siffer.";
      }
    }

    if (group === "banking" && values.bank_account) {
      if (!/^\d{11}$/.test(values.bank_account)) {
        return "Ugyldig kontonummer — må være nøyaktig 11 siffer.";
      }
    }

    if (group === "address" && values.postal_code) {
      if (!/^\d{4}$/.test(values.postal_code)) {
        return "Ugyldig postnummer — må være nøyaktig 4 siffer.";
      }
    }

    // Persist via the admin_submit_employee_pii RPC (handles encryption + audit)
    const { error } = await ctx.supabaseAdmin.rpc("admin_submit_employee_pii", {
      p_profile_id: ctx.profileId,
      p_field_group: group,
      p_values: values,
      p_reason: "Self-service intake via contract_data_intake process",
    });

    if (error) return `Feil ved lagring: ${error.message}`;

    void emit({
      event: "contract intake field submitted",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "profile" as const, entity_id: ctx.profileId },
        data: { group },
      },
    });

    // CRITICAL: never echo submitted values — only confirm save
    return JSON.stringify({ saved: true, group });
  },
});

// ── decline_intake ──────────────────────────────────────────────────────────

export const declineIntake = defineTool({
  name: "decline_intake",
  description:
    "Employee declines to provide a PII field group. Records the refusal and notifies the admin for follow-up.",
  schema: z.object({
    group: fieldGroupEnum.describe("Which field group is being declined"),
    reason_code: z
      .enum(["privacy_concern", "incorrect_request", "will_do_later", "other"])
      .describe("Reason category for declining"),
    reason_text: z.string().optional().describe("Free-text reason (optional)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const { group, reason_code, reason_text } = params;

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
        data: { group, reason_code },
      },
    });

    return JSON.stringify({
      declined: true,
      group,
      message: "Din administrator vil følge opp.",
    });
  },
});

// ── get_intake_progress ─────────────────────────────────────────────────────

export const getIntakeProgress = defineTool({
  name: "get_intake_progress",
  description:
    "Check which PII field groups the employee has completed vs still pending. Never returns actual values.",
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
    const identity = data.personal_number ? "done" : "pending";
    const banking = data.bank_account ? "done" : "pending";
    const address = data.address_line_1 && data.postal_code && data.city ? "done" : "pending";

    return JSON.stringify({
      identity,
      banking,
      address,
    });
  },
});
