// createIntegration pure-action contract tests.
//
// Covers:
//   - Happy-path insert with all defaults applied
//   - Explicit is_placeholder=true pass-through (ADR-0129 — the action
//     itself does not auto-infer this from integration_type)
//   - Supabase error surfaces as { ok: false, error }
//
// Emit testing lives at the Server Action layer (web wrapper) — this
// pure function does not emit per the mobile-parity contract.

import { describe, expect, test } from "vitest";

import { createIntegration, type CreateIntegrationInput } from "../createIntegration";

// ─── Minimal Supabase client mock ──────────────────────────────
// The tests only need .from("billing_integration").insert(...).select("*").single().
// We build a chain that captures the insert payload + returns a
// configurable data / error pair.

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
    integration_id: "22222222-2222-2222-2222-222222222222",
    workspace_id: null,
    integration_type: "placeholder",
    display_name: "Test",
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

describe("createIntegration", () => {
  test("inserts with defaults (is_enabled=true, is_placeholder=false, config={})", async () => {
    const { client, calls } = createMockClient({ data: happyRow() });
    const input: CreateIntegrationInput = {
      integration_type: "placeholder",
      display_name: "New integration",
    };

    const result = await createIntegration(client, input);
    expect(result.ok).toBe(true);

    // One insert landed on billing_integration with the right shape.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("billing_integration");
    expect(calls[0]?.row).toMatchObject({
      integration_type: "placeholder",
      display_name: "New integration",
      is_enabled: true,
      is_placeholder: false,
      config: {},
      workspace_id: null,
    });
  });

  test("explicit is_placeholder=true is passed through verbatim (ADR-0129)", async () => {
    const { client, calls } = createMockClient({
      data: happyRow({ is_placeholder: true }),
    });

    const input: CreateIntegrationInput = {
      integration_type: "fiken",
      display_name: "Fiken rehearsal",
      is_placeholder: true,
    };

    const result = await createIntegration(client, input);
    expect(result.ok).toBe(true);
    expect(calls[0]?.row).toMatchObject({ is_placeholder: true });
  });

  test("workspace_id defaults to null (platform-level)", async () => {
    const { client, calls } = createMockClient({ data: happyRow() });

    await createIntegration(client, {
      integration_type: "placeholder",
      display_name: "Ingen workspace",
    });

    expect(calls[0]?.row).toMatchObject({ workspace_id: null });
  });

  test("supabase error → { ok: false, error }", async () => {
    const { client } = createMockClient({
      data: null,
      error: { message: "duplicate key value violates unique constraint" },
    });

    const result = await createIntegration(client, {
      integration_type: "placeholder",
      display_name: "Duplicate",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/duplicate key/i);
    }
  });

  test("missing data (no error either) → insert_failed", async () => {
    const { client } = createMockClient({ data: null, error: null });

    const result = await createIntegration(client, {
      integration_type: "placeholder",
      display_name: "Ghost row",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insert_failed");
    }
  });
});
