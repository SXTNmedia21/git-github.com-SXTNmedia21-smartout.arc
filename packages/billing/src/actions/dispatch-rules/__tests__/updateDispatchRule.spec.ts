// updateDispatchRule / deleteDispatchRule contract tests. Verifies
// pre-load + patch semantics, and that error paths surface cleanly.

import { describe, expect, test } from "vitest";

import { deleteDispatchRule } from "../deleteDispatchRule";
import { updateDispatchRule } from "../updateDispatchRule";

type Call = { op: string; table: string; payload?: Record<string, unknown> };

function buildClient(opts: {
  loadRow?: Record<string, unknown> | null;
  updatedRow?: Record<string, unknown> | null;
  loadError?: { message: string } | null;
  updateError?: { message: string } | null;
  deleteError?: { message: string } | null;
}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  calls.push({ op: "select", table });
                  return { data: opts.loadRow ?? null, error: opts.loadError ?? null };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          calls.push({ op: "update", table, payload });
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: opts.updatedRow ?? null,
                      error: opts.updateError ?? null,
                    }),
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            eq: async () => {
              calls.push({ op: "delete", table });
              return { error: opts.deleteError ?? null };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, calls };
}

const happyRow = {
  dispatch_rule_id: "11111111-1111-1111-1111-111111111111",
  workspace_id: "22222222-2222-2222-2222-222222222222",
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
};

describe("updateDispatchRule", () => {
  test("emits correct before/after on is_enabled patch", async () => {
    const { client, calls } = buildClient({
      loadRow: happyRow,
      updatedRow: { ...happyRow, is_enabled: false },
    });
    const result = await updateDispatchRule(client, happyRow.dispatch_rule_id, {
      is_enabled: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.before.is_enabled).toBe(true);
      expect(result.rule.is_enabled).toBe(false);
    }
    // Assert we issued a SELECT + UPDATE sequence on the right table.
    expect(
      calls.filter((c) => c.op === "select" && c.table === "billing_dispatch_rule"),
    ).toHaveLength(1);
    expect(
      calls.filter((c) => c.op === "update" && c.table === "billing_dispatch_rule"),
    ).toHaveLength(1);
  });

  test("missing row → dispatch_rule_not_found", async () => {
    const { client } = buildClient({ loadRow: null });
    const result = await updateDispatchRule(client, happyRow.dispatch_rule_id, {
      is_enabled: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("dispatch_rule_not_found");
  });

  test("load error surfaces verbatim", async () => {
    const { client } = buildClient({
      loadError: { message: "connection refused" },
    });
    const result = await updateDispatchRule(client, happyRow.dispatch_rule_id, {
      is_enabled: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/connection refused/);
  });
});

describe("deleteDispatchRule", () => {
  test("returns the deleted row for audit payload", async () => {
    const { client, calls } = buildClient({ loadRow: happyRow });
    const result = await deleteDispatchRule(client, happyRow.dispatch_rule_id);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deleted.dispatch_rule_id).toBe(happyRow.dispatch_rule_id);
    }
    expect(calls.some((c) => c.op === "delete" && c.table === "billing_dispatch_rule")).toBe(true);
  });

  test("missing row → dispatch_rule_not_found", async () => {
    const { client } = buildClient({ loadRow: null });
    const result = await deleteDispatchRule(client, happyRow.dispatch_rule_id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("dispatch_rule_not_found");
  });
});
