// testConnectionAction — loads integration, invokes the adapter,
// returns the 4-outcome taxonomy.
//
// Because the registry entries all resolve to the PlaceholderAdapter
// in Fase 2, every integration_type currently produces
// { status: 'ok', is_placeholder: true }. This test locks in that
// behaviour: when Fase 3 replaces the registry entries, real adapters
// must still satisfy the taxonomy shape (expand these tests).

import { describe, expect, test } from "vitest";

import { testConnectionAction } from "../testConnectionAction";

function createMockClient(opts: {
  data: Record<string, unknown> | null;
  error?: { message: string } | null;
}) {
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({
                  data: opts.data,
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
  return client as any;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    integration_id: "44444444-4444-4444-4444-444444444444",
    workspace_id: null,
    integration_type: "placeholder",
    display_name: "Test",
    config: {},
    is_enabled: true,
    is_placeholder: true,
    last_sync_at: null,
    last_sync_status: null,
    created_at: "2026-05-11T00:00:00Z",
    updated_at: "2026-05-11T00:00:00Z",
    ...overrides,
  };
}

describe("testConnectionAction", () => {
  test("returns { ok:true, result: {status:'ok', is_placeholder:true} } for placeholder row", async () => {
    const client = createMockClient({ data: row() });
    const response = await testConnectionAction(client, row().integration_id as string);

    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.result.status).toBe("ok");
      if (response.result.status === "ok") {
        expect(response.result.is_placeholder).toBe(true);
      }
    }
  });

  test("returns integration_not_found when the row is missing", async () => {
    const client = createMockClient({ data: null });
    const response = await testConnectionAction(client, row().integration_id as string);
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error).toBe("integration_not_found");
    }
  });

  test("fiken / tripletex / stripe also route through PlaceholderAdapter in Fase 2", async () => {
    for (const type of ["fiken", "tripletex", "stripe"] as const) {
      const client = createMockClient({ data: row({ integration_type: type }) });
      const response = await testConnectionAction(client, row().integration_id as string);

      expect(response.ok).toBe(true);
      if (response.ok) {
        expect(response.result.status).toBe("ok");
        if (response.result.status === "ok") {
          expect(response.result.is_placeholder).toBe(true);
        }
      }
    }
  });
});
