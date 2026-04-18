// Billing queries — dispatch helpers.
//
// Tests exercise the thin wrapper layer around Supabase: filter
// composition for listDispatchRules and RPC invocation for
// getEffectiveDispatchRules. SQL-semantics tests (suppress, canonical
// dedup) live in the pgTAP spec; this file only ensures the JS
// plumbing forwards args correctly.

import { describe, expect, test } from "vitest";

import { getEffectiveDispatchRules, listDispatchRules } from "../queries";

type FromCall = { table: string; action: string; args?: unknown };

function buildFromChain(opts: { data?: unknown; error?: { message: string } | null }) {
  const calls: FromCall[] = [];
  const filterChain = {
    is(col: string, val: unknown) {
      calls.push({ table: "filter", action: `is:${col}`, args: val });
      return filterChain;
    },
    in(col: string, val: unknown) {
      calls.push({ table: "filter", action: `in:${col}`, args: val });
      return filterChain;
    },
    eq(col: string, val: unknown) {
      calls.push({ table: "filter", action: `eq:${col}`, args: val });
      return filterChain;
    },
    order() {
      return filterChain;
    },
    then(cb: (r: { data: unknown; error: unknown }) => void) {
      cb({ data: opts.data ?? [], error: opts.error ?? null });
    },
  };
  return { filterChain, calls };
}

describe("listDispatchRules", () => {
  test("scope=platform filters workspace_id IS NULL", async () => {
    const { filterChain, calls } = buildFromChain({ data: [] });
    const client = {
      from(table: string) {
        calls.push({ table, action: "from" });
        return {
          select() {
            return {
              order() {
                return filterChain;
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listDispatchRules(client as any, { scope: "platform" });
    expect(calls.some((c) => c.action === "is:workspace_id" && c.args === null)).toBe(true);
  });

  test("scope=workspace short-circuits when workspace_ids is empty", async () => {
    const { filterChain, calls } = buildFromChain({ data: [] });
    const client = {
      from() {
        return {
          select() {
            return {
              order() {
                return filterChain;
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await listDispatchRules(client as any, {
      scope: "workspace",
      workspace_ids: [],
    });
    expect(result).toEqual([]);
    // Did not reach filter stage
    expect(calls.length).toBe(0);
  });

  test("scope=workspace with IDs issues an IN filter", async () => {
    const { filterChain, calls } = buildFromChain({ data: [] });
    const client = {
      from() {
        return {
          select() {
            return {
              order() {
                return filterChain;
              },
            };
          },
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await listDispatchRules(client as any, {
      scope: "workspace",
      workspace_ids: ["aaa", "bbb"],
    });
    expect(
      calls.some(
        (c) =>
          c.action === "in:workspace_id" &&
          Array.isArray(c.args) &&
          (c.args as string[]).length === 2,
      ),
    ).toBe(true);
  });
});

describe("getEffectiveDispatchRules", () => {
  test("forwards args to the effective_dispatch_rules RPC", async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const client = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return Promise.resolve({
          data: [
            {
              dispatch_rule_id: "11111111-1111-1111-1111-111111111111",
              workspace_id: null,
              company_id: null,
              channel: "email_customer",
              trigger_event: "invoice issued",
              target: { email: "x@y.z" },
              template_id: null,
              action: "send",
              is_enabled: true,
              rule_source: "platform",
            },
          ],
          error: null,
        });
      },
    };

    const result = await getEffectiveDispatchRules(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "invoice issued",
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("effective_dispatch_rules");
    expect(calls[0]?.args).toEqual({
      p_invoice_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      p_trigger_event: "invoice issued",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.rule_source).toBe("platform");
  });

  test("RPC error rejects the promise", async () => {
    const client = {
      rpc() {
        return Promise.resolve({ data: null, error: { message: "boom" } });
      },
    };
    await expect(
      getEffectiveDispatchRules(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client as any,
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "invoice issued",
      ),
    ).rejects.toThrow();
  });
});
