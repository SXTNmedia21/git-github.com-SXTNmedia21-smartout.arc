// Zod schema tests for dispatch-rule CRUD inputs. Platform-rule
// refinement mirrors the DB CHECK constraint (ADR-0127) — these tests
// keep the Zod guard honest so UI-side validation catches violations
// before they hit the database.

import { describe, expect, test } from "vitest";

import { CreateDispatchRuleInputSchema, UpdateDispatchRuleInputSchema } from "../../../schemas";

describe("CreateDispatchRuleInputSchema", () => {
  test("accepts a platform rule with action=send and no company_id", () => {
    const result = CreateDispatchRuleInputSchema.safeParse({
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
      action: "send",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a workspace rule with action=suppress", () => {
    const result = CreateDispatchRuleInputSchema.safeParse({
      workspace_id: "11111111-1111-1111-1111-111111111111",
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
      action: "suppress",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a platform rule with action=suppress (ADR-0127)", () => {
    const result = CreateDispatchRuleInputSchema.safeParse({
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
      action: "suppress",
    });
    expect(result.success).toBe(false);
  });

  test("rejects a platform rule with company_id set", () => {
    const result = CreateDispatchRuleInputSchema.safeParse({
      workspace_id: null,
      company_id: "22222222-2222-2222-2222-222222222222",
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "x@y.z" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects trigger_event containing a dot (spec §11 event-name convention)", () => {
    const result = CreateDispatchRuleInputSchema.safeParse({
      workspace_id: "11111111-1111-1111-1111-111111111111",
      channel: "email_customer",
      trigger_event: "invoice.issued",
      target: { email: "x@y.z" },
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateDispatchRuleInputSchema", () => {
  test("accepts a partial patch", () => {
    const result = UpdateDispatchRuleInputSchema.safeParse({
      dispatch_rule_id: "11111111-1111-1111-1111-111111111111",
      is_enabled: false,
    });
    expect(result.success).toBe(true);
  });

  test("rejects dotted trigger_event in update", () => {
    const result = UpdateDispatchRuleInputSchema.safeParse({
      dispatch_rule_id: "11111111-1111-1111-1111-111111111111",
      trigger_event: "invoice.paid",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing dispatch_rule_id", () => {
    const result = UpdateDispatchRuleInputSchema.safeParse({
      is_enabled: true,
    });
    expect(result.success).toBe(false);
  });
});
