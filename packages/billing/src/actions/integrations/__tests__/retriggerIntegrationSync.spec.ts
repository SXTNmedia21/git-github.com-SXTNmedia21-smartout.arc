// retriggerIntegrationSync — spawns an engine_state row for manual
// re-run of a sync. Guards verified:
//   - integration not found → error
//   - integration disabled → error
//   - platform-level (workspace_id NULL) rejected → error
//   - engine_step seed missing → error
//   - happy path: engine_state + engine_state_step both inserted with
//     the correct context/payload/entity linkage.

import { describe, expect, test } from "vitest";

import { retriggerIntegrationSync } from "../retriggerIntegrationSync";

type MaybeSingleResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type ListResult = {
  data: Array<Record<string, unknown>> | null;
  error: { message: string } | null;
};

type InsertResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

function createMockClient(opts: {
  integrationLookup: MaybeSingleResult;
  stepsLookup?: ListResult;
  stateInsert?: InsertResult;
}) {
  const recorded: Array<{ op: string; payload?: unknown; table?: string }> = [];

  const client = {
    from(table: string) {
      if (table === "billing_integration") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => {
                    recorded.push({ op: "select:integration", table });
                    return opts.integrationLookup;
                  },
                };
              },
            };
          },
        };
      }
      if (table === "engine_step") {
        return {
          select() {
            return {
              eq() {
                return {
                  order: async () => {
                    recorded.push({ op: "select:engine_step", table });
                    return opts.stepsLookup ?? { data: [], error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "engine_state") {
        return {
          insert(payload: unknown) {
            recorded.push({ op: "insert:engine_state", table, payload });
            return {
              select() {
                return {
                  single: async () => opts.stateInsert ?? { data: null, error: null },
                };
              },
            };
          },
        };
      }
      if (table === "engine_state_step") {
        return {
          insert: async (payload: unknown) => {
            recorded.push({ op: "insert:engine_state_step", table, payload });
            return { data: null, error: null };
          },
        };
      }
      throw new Error(`Unexpected table '${table}'`);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, recorded };
}

const integrationId = "55555555-5555-5555-5555-555555555555";
const entityId = "66666666-6666-6666-6666-666666666666";
const workspaceId = "77777777-7777-7777-7777-777777777777";
const engineStateId = "88888888-8888-8888-8888-888888888888";

function integrationRow(overrides: Record<string, unknown> = {}) {
  return {
    integration_id: integrationId,
    workspace_id: workspaceId,
    is_enabled: true,
    ...overrides,
  };
}

describe("retriggerIntegrationSync", () => {
  test("integration not found → integration_not_found", async () => {
    const { client } = createMockClient({
      integrationLookup: { data: null, error: null },
    });
    const result = await retriggerIntegrationSync(
      client,
      integrationId,
      "invoice",
      entityId,
      "update",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("integration_not_found");
    }
  });

  test("disabled integration → integration_disabled", async () => {
    const { client } = createMockClient({
      integrationLookup: {
        data: integrationRow({ is_enabled: false }),
        error: null,
      },
    });
    const result = await retriggerIntegrationSync(
      client,
      integrationId,
      "invoice",
      entityId,
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("integration_disabled");
    }
  });

  test("platform-level integration (workspace_id=null) → platform_level_retrigger_not_supported", async () => {
    const { client } = createMockClient({
      integrationLookup: {
        data: integrationRow({ workspace_id: null }),
        error: null,
      },
    });
    const result = await retriggerIntegrationSync(
      client,
      integrationId,
      "invoice",
      entityId,
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("platform_level_retrigger_not_supported");
    }
  });

  test("no engine_step seed → integration_sync_process_not_seeded", async () => {
    const { client } = createMockClient({
      integrationLookup: { data: integrationRow(), error: null },
      stepsLookup: { data: [], error: null },
    });

    const result = await retriggerIntegrationSync(
      client,
      integrationId,
      "invoice",
      entityId,
      "create",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("integration_sync_process_not_seeded");
    }
  });

  test("happy path inserts engine_state + engine_state_step with correct context", async () => {
    const step = {
      step_order: 1,
      action_type: "sync_integration",
      action_payload: { timeout_ms: 30000 },
    };
    const { client, recorded } = createMockClient({
      integrationLookup: { data: integrationRow(), error: null },
      stepsLookup: { data: [step], error: null },
      stateInsert: { data: { id: engineStateId }, error: null },
    });

    const result = await retriggerIntegrationSync(
      client,
      integrationId,
      "invoice",
      entityId,
      "create",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.engine_state_id).toBe(engineStateId);
    }

    const stateInsert = recorded.find((r) => r.op === "insert:engine_state");
    expect(stateInsert).toBeDefined();
    expect(stateInsert?.payload).toMatchObject({
      process_id: "integration_sync",
      workspace_id: workspaceId,
      status: "active",
      current_step: 1,
      entity_type: "billing_integration",
      entity_id: integrationId,
    });
    const ctx = (stateInsert?.payload as Record<string, unknown>).context as Record<
      string,
      unknown
    >;
    expect(ctx).toMatchObject({
      integration_id: integrationId,
      entity_type: "invoice",
      entity_id_synced: entityId,
      operation: "create",
      originating_channel: "manual_retrigger",
    });

    const stepInsert = recorded.find((r) => r.op === "insert:engine_state_step");
    expect(stepInsert).toBeDefined();
    expect(stepInsert?.payload).toMatchObject({
      state_id: engineStateId,
      step_order: 1,
      status: "active",
      action_type: "sync_integration",
    });
  });
});
