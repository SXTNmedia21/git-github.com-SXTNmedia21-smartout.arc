/**
 * Unit tests for `list_mandatory_protocols_for_role` (ADR-0379a A3).
 *
 * Exercises the four resolution paths the tool promises:
 *   1. Unknown role slug → empty mandatory_protocols list (NOT an error).
 *   2. Workspace-scoped profession found → returns its required protocols.
 *   3. Platform fallback (workspace_id IS NULL) when no workspace row exists.
 *   4. DB error on profession lookup → returns error string.
 *
 * Test scope is deliberately narrow: the tool is read-only, has no gate_action
 * path, and takes no PII input. No rpc mock needed.
 */

import { describe, test, expect, vi } from "vitest";
import { listMandatoryProtocolsForRole } from "../tools";
import type { AgentToolContext } from "../../types";

const WORKSPACE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROFESSION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PROTOCOL_ID_1 = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const PROTOCOL_ID_2 = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  // Thin chainable mock — only methods invoked by the tool are wired.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin: any = {
    from: vi.fn(() => supabaseAdmin),
    select: vi.fn(() => supabaseAdmin),
    eq: vi.fn(() => supabaseAdmin),
    is: vi.fn(() => supabaseAdmin),
    maybeSingle: vi.fn(),
    // Terminal await without .maybeSingle() — used by the profession_training query.
    then: vi.fn((resolve: (r: unknown) => void) => resolve({ data: [], error: null })),
  };
  return {
    workspaceId: WORKSPACE_ID,
    profileId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    sessionId: "session-1",
    supabaseAdmin,
    channel: "chat",
    ...overrides,
  } as AgentToolContext;
}

describe("list_mandatory_protocols_for_role", () => {
  test("unknown role slug returns empty mandatory_protocols (not an error)", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    // Workspace lookup → null (not found).
    admin.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      // Platform fallback → null (not found either).
      .mockResolvedValueOnce({ data: null, error: null });

    const raw = await listMandatoryProtocolsForRole.execute({ role_slug: "nonexistent" }, ctx);
    const result = JSON.parse(String(raw));

    expect(result.role_slug).toBe("nonexistent");
    expect(result.profession_name).toBeNull();
    expect(result.mandatory_protocols).toEqual([]);
  });

  test("workspace-scoped profession → returns required protocols", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    // Workspace lookup → found.
    admin.maybeSingle.mockResolvedValueOnce({
      data: { profession_id: PROFESSION_ID, name: "Bartender" },
      error: null,
    });

    // profession_training query resolves via .then() on the chain.
    // We replace the terminal `then` to return two required training rows.
    admin.then = vi.fn((resolve: (r: unknown) => void) =>
      resolve({
        data: [
          {
            protocol_id: PROTOCOL_ID_1,
            protocol: { protocol_id: PROTOCOL_ID_1, name: "Alkoholloven grunnkurs" },
          },
          {
            protocol_id: PROTOCOL_ID_2,
            protocol: { protocol_id: PROTOCOL_ID_2, name: "Servering og ansvar" },
          },
        ],
        error: null,
      }),
    );

    const raw = await listMandatoryProtocolsForRole.execute({ role_slug: "bartender" }, ctx);
    const result = JSON.parse(String(raw));

    expect(result.role_slug).toBe("bartender");
    expect(result.profession_name).toBe("Bartender");
    expect(result.mandatory_protocols).toHaveLength(2);
    expect(result.mandatory_protocols[0]).toEqual({
      protocol_id: PROTOCOL_ID_1,
      name: "Alkoholloven grunnkurs",
    });
    expect(result.mandatory_protocols[1]).toEqual({
      protocol_id: PROTOCOL_ID_2,
      name: "Servering og ansvar",
    });
  });

  test("platform fallback used when no workspace profession row exists", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    // Workspace lookup → null.
    admin.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      // Platform fallback → found.
      .mockResolvedValueOnce({
        data: { profession_id: PROFESSION_ID, name: "Kokk (platform)" },
        error: null,
      });

    // profession_training query resolves one required row.
    admin.then = vi.fn((resolve: (r: unknown) => void) =>
      resolve({
        data: [
          {
            protocol_id: PROTOCOL_ID_1,
            protocol: { protocol_id: PROTOCOL_ID_1, name: "HACCP grunnkurs" },
          },
        ],
        error: null,
      }),
    );

    const raw = await listMandatoryProtocolsForRole.execute({ role_slug: "kokk" }, ctx);
    const result = JSON.parse(String(raw));

    expect(result.profession_name).toBe("Kokk (platform)");
    expect(result.mandatory_protocols).toHaveLength(1);
    expect(result.mandatory_protocols[0].name).toBe("HACCP grunnkurs");
  });

  test("DB error on profession lookup returns error string", async () => {
    const ctx = makeCtx();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = ctx.supabaseAdmin as any;

    // Workspace lookup → DB error.
    admin.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "connection refused" },
    });

    const result = await listMandatoryProtocolsForRole.execute({ role_slug: "bartender" }, ctx);
    expect(String(result)).toMatch(/Error resolving role/i);
    expect(String(result)).toMatch(/connection refused/i);
  });
});
