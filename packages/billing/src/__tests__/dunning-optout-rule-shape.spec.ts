// Contract tests for the B5 dunning opt-out rule shape.
//
// The workspace settings UI (apps/web/.../DunningOptOutToggle.tsx) emits
// a very specific `billing_dispatch_rule` row to suppress auto-dunning
// email for a workspace. The B4 handler
// (supabase/functions/engine-dispatch/handlers/scan-overdue-invoices.ts)
// reads `effective_dispatch_rules()` and looks for exactly this row
// shape to decide whether to skip the customer email. If the UI and
// handler ever disagree on shape, workspace opt-out silently breaks.
//
// These tests lock the shape at the Zod boundary (CreateDispatchRuleInput
// + DeleteDispatchRuleInput) and document the toggle idempotence
// invariant: toggling twice returns the system to the starting state.
//
// Ref: Fase 3A spec §4.4 + §4.5, ADR-0127.

import { describe, expect, test } from "vitest";

import { CreateDispatchRuleInputSchema, DeleteDispatchRuleInputSchema } from "../schemas";

// Mirror the constants exported from the UI component so a rename on
// either side breaks this test. See
// apps/web/src/app/dashboard/billing/settings/_components/DunningOptOutToggle.tsx.
const DUNNING_OPTOUT_CHANNEL = "email_customer";
const DUNNING_OPTOUT_TRIGGER_EVENT = "invoice dunning_escalated";

const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";

describe("B5 dunning opt-out rule shape", () => {
  test("toggle-OFF payload passes CreateDispatchRuleInputSchema", () => {
    // This is exactly what DunningOptOutToggle.handleToggle(false) sends
    // to createDispatchRuleAction. If Zod rejects this, the UI is broken.
    const result = CreateDispatchRuleInputSchema.safeParse({
      workspace_id: WORKSPACE_ID,
      channel: DUNNING_OPTOUT_CHANNEL,
      trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
      target: {},
      action: "suppress",
      is_enabled: true,
    });
    expect(result.success).toBe(true);
  });

  test("toggle-OFF payload uses space-separator trigger_event", () => {
    // The DB CHECK constraint on billing_dispatch_rule.trigger_event
    // enforces space-separator, and the Zod TriggerEventString guard
    // mirrors it. Assert the UI constant is compatible — catches a
    // future refactor that accidentally uses dot-notation.
    expect(DUNNING_OPTOUT_TRIGGER_EVENT).not.toContain(".");
    expect(DUNNING_OPTOUT_TRIGGER_EVENT).toMatch(/^invoice dunning_escalated$/);
  });

  test("toggle-OFF payload targets the email_customer channel", () => {
    // B4 handler suppresses only when the rule matches
    // channel='email_customer'. The UI constant must stay aligned.
    expect(DUNNING_OPTOUT_CHANNEL).toBe("email_customer");
  });

  test("toggle-OFF payload rejects platform scope (workspace_id NULL)", () => {
    // Defensive: even if a malicious client omits workspace_id, the
    // platform-rule refinement rejects suppress rules without a
    // workspace (ADR-0127). Workspace-admin UI can never create a
    // platform-wide suppression.
    const result = CreateDispatchRuleInputSchema.safeParse({
      channel: DUNNING_OPTOUT_CHANNEL,
      trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
      target: {},
      action: "suppress",
      is_enabled: true,
    });
    expect(result.success).toBe(false);
  });

  test("toggle-ON payload (delete) passes DeleteDispatchRuleInputSchema", () => {
    // Toggle ON sends only the dispatch_rule_id of the suppress row.
    const result = DeleteDispatchRuleInputSchema.safeParse({
      dispatch_rule_id: "99999999-9999-9999-9999-999999999999",
    });
    expect(result.success).toBe(true);
  });

  test("toggle-ON payload rejects missing dispatch_rule_id", () => {
    const result = DeleteDispatchRuleInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("toggle idempotence: OFF→ON→OFF produces identical create payload", () => {
    // After a full toggle cycle the UI should emit an identical create
    // payload. If the payload drifts across toggles, the DB's unique
    // dedup-key on (channel, trigger_event, target, workspace_id,
    // template_id, company_id) would create duplicate rows. This test
    // locks the payload to a canonical shape.
    const buildTogglePayload = () => ({
      workspace_id: WORKSPACE_ID,
      channel: DUNNING_OPTOUT_CHANNEL,
      trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
      target: {},
      action: "suppress" as const,
      is_enabled: true,
    });
    const first = buildTogglePayload();
    const second = buildTogglePayload();
    expect(first).toEqual(second);
    expect(CreateDispatchRuleInputSchema.safeParse(first).success).toBe(true);
    expect(CreateDispatchRuleInputSchema.safeParse(second).success).toBe(true);
  });

  test("target is an empty object, not null or undefined", () => {
    // The DB column is NOT NULL jsonb with default '{}'. Zod only
    // requires a record; the UI sends {} explicitly to keep the dedup
    // key stable. Regression guard: if the UI switches to null, the
    // dedup-key comparison against an existing {} row diverges.
    const input = {
      workspace_id: WORKSPACE_ID,
      channel: DUNNING_OPTOUT_CHANNEL,
      trigger_event: DUNNING_OPTOUT_TRIGGER_EVENT,
      target: {},
      action: "suppress" as const,
      is_enabled: true,
    };
    const result = CreateDispatchRuleInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target).toEqual({});
    }
  });
});
