// createDispatchRule pure-action contract tests.
//
// Scope (mobile-parity layer): the pure function trusts Zod validation
// at the RPC boundary, so CHECK-constraint and scope enforcement tests
// live at the Schema + pgTAP level. Here we verify the insert shape,
// default values, and error passthrough.

import { describe, expect, test } from "vitest";

import { createDispatchRule, type CreateDispatchRuleInput } from "../createDispatchRule";

type InsertCall = {
  table: string;
  row: Record<string, unknown>;
};

function createMockClient(opts: {
  data?: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  const calls: InsertCall[] = [];
  const client = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ table, row });
          return {
            select() {
              return {
                single: async () => ({
                  data: opts.data ?? null,
                  error: opts.error ?? null,
                }),
              };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

function happyRow(overrides: Record<string, unknown> = {}) {
  return {
    dispatch_rule_id: "11111111-1111-1111-1111-111111111111",
    workspace_id: null,
    company_id: null,
    channel: "email_customer",
    trigger_event: "invoice issued",
    target: { email: "faktura@example.no" },
    template_id: null,
    action: "send",
    is_enabled: true,
    created_by: null,
    created_at: "2026-05-11T00:00:00Z",
    updated_at: "2026-05-11T00:00:00Z",
    ...overrides,
  };
}

describe("createDispatchRule", () => {
  test("inserts with defaults (action=send, is_enabled=true, workspace_id=null)", async () => {
    const { client, calls } = createMockClient({ data: happyRow() });
    const input: CreateDispatchRuleInput = {
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
    };

    const result = await createDispatchRule(client, input);
    expect(result.ok).toBe(true);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("billing_dispatch_rule");
    expect(calls[0]?.row).toMatchObject({
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
      action: "send",
      is_enabled: true,
      workspace_id: null,
      company_id: null,
      template_id: null,
      created_by: null,
    });
  });

  test("workspace-scoped rule with action=suppress passes through verbatim", async () => {
    const { client, calls } = createMockClient({
      data: happyRow({
        workspace_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        action: "suppress",
      }),
    });
    const input: CreateDispatchRuleInput = {
      workspace_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "faktura@example.no" },
      action: "suppress",
    };

    const result = await createDispatchRule(client, input);
    expect(result.ok).toBe(true);

    expect(calls[0]?.row).toMatchObject({
      workspace_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      action: "suppress",
    });
  });

  test("created_by is stamped when provided", async () => {
    const { client, calls } = createMockClient({ data: happyRow() });
    await createDispatchRule(client, {
      channel: "http_api",
      trigger_event: "invoice paid",
      target: { endpoint: "https://api.example.com/hook" },
      created_by: "22222222-2222-2222-2222-222222222222",
    });
    expect(calls[0]?.row).toMatchObject({
      created_by: "22222222-2222-2222-2222-222222222222",
    });
  });

  test("supabase error surfaces as { ok: false, error }", async () => {
    const { client } = createMockClient({
      data: null,
      error: { message: "violates check constraint" },
    });

    const result = await createDispatchRule(client, {
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "a@b.c" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/check constraint/i);
    }
  });

  test("missing data (no error either) → insert_failed", async () => {
    const { client } = createMockClient({ data: null, error: null });
    const result = await createDispatchRule(client, {
      channel: "email_customer",
      trigger_event: "invoice issued",
      target: { email: "x@y.z" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("insert_failed");
  });
});
