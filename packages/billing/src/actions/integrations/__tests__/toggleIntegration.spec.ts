// toggleIntegration — flips is_enabled. Tests the no-op short-circuit
// (no UPDATE emitted when the new value equals the current one) plus
// the standard flip.

import { describe, expect, test } from "vitest";

import { toggleIntegration } from "../toggleIntegration";

type LoadResult = { data: Record<string, unknown> | null; error: { message: string } | null };
type UpdateResult = { data: Record<string, unknown> | null; error: { message: string } | null };

function createMockClient(opts: { load: LoadResult; update?: UpdateResult }) {
  const calls: Array<{ op: "select" | "update"; payload?: unknown }> = [];
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  calls.push({ op: "select" });
                  return opts.load;
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          calls.push({ op: "update", payload });
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => opts.update ?? { data: null, error: null },
                  };
                },
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

function row(overrides: Record<string, unknown> = {}) {
  return {
    integration_id: "33333333-3333-3333-3333-333333333333",
    workspace_id: null,
    integration_type: "placeholder",
    display_name: "Toggle test",
    config: {},
    is_enabled: true,
    is_placeholder: false,
    last_sync_at: null,
    last_sync_status: null,
    created_at: "2026-05-11T00:00:00Z",
    updated_at: "2026-05-11T00:00:00Z",
    ...overrides,
  };
}

describe("toggleIntegration", () => {
  test("no-op when state already matches desired value", async () => {
    const { client, calls } = createMockClient({
      load: { data: row({ is_enabled: true }), error: null },
    });

    const result = await toggleIntegration(client, row().integration_id as string, true);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changed).toBe(false);
    }
    // Only the SELECT happened — no UPDATE.
    expect(calls.find((c) => c.op === "update")).toBeUndefined();
  });

  test("flips is_enabled false → true", async () => {
    const before = row({ is_enabled: false });
    const after = row({ is_enabled: true });
    const { client, calls } = createMockClient({
      load: { data: before, error: null },
      update: { data: after, error: null },
    });

    const result = await toggleIntegration(client, before.integration_id as string, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changed).toBe(true);
      expect(result.integration.is_enabled).toBe(true);
    }
    const updateCall = calls.find((c) => c.op === "update");
    expect(updateCall?.payload).toEqual({ is_enabled: true });
  });

  test("integration not found → integration_not_found", async () => {
    const { client } = createMockClient({ load: { data: null, error: null } });
    const result = await toggleIntegration(client, row().integration_id as string, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("integration_not_found");
    }
  });
});
