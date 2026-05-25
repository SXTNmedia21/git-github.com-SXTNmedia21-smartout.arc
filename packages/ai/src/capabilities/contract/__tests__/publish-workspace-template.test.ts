/**
 * publish_workspace_template capability tool — unit tests.
 *
 * Covers Gate G4 invariants:
 *   - admin role → happy path, emit fired with is_reactivation=false
 *   - deprecated → published emits is_reactivation=true and clears deprecated_at
 *   - employee role → denied, no emit
 *   - non-chat channel → channel guard
 *   - cross-workspace template → rejected
 *
 * Uses the schema-validated Supabase mock (L-0087).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { nonEmpty } from "@smartout/telemetry/server";
import type { AgentToolContext } from "../../types.js";
import { publishWorkspaceTemplate } from "../tools.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

const emitMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  nonEmpty: (v: string) => v,
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const OTHER_WORKSPACE_ID = "10000000-0000-0000-0000-000000000099";
const ADMIN_PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const EMPLOYEE_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const TEMPLATE_ID = "30000000-0000-0000-0000-000000000010";

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: nonEmpty(WORKSPACE_ID, "workspaceId"),
    profileId: nonEmpty(ADMIN_PROFILE_ID, "profileId"),
    sessionId: "session-1",
    supabaseAdmin: mockSupabase({}),
    channel: "chat",
    ...overrides,
  };
}

describe("publish_workspace_template", () => {
  beforeEach(() => {
    emitMock.mockClear();
  });

  it("publishes a fresh draft (admin happy path) and emits published event", async () => {
    // Two contract_template queries: first .select() for load, second
    // .update(...).select() for the publish. The mock advances callIndex
    // each time `.from('contract_template')` is invoked.
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: [
        {
          data: {
            template_id: TEMPLATE_ID,
            workspace_id: WORKSPACE_ID,
            is_system: false,
            published_at: null,
            deprecated_at: null,
            name: "Workspace draft",
            version: 1,
          },
          error: null,
        },
        {
          data: {
            template_id: TEMPLATE_ID,
            published_at: "2026-04-22T12:30:00Z",
            version: 1,
          },
          error: null,
        },
      ],
    });

    const result = await publishWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.template_id).toBe(TEMPLATE_ID);
    expect(parsed.published_at).toBe("2026-04-22T12:30:00Z");

    // ADR-0204 SS-4: mutateWithGate emits gate_evaluated in addition to
    // the domain event. Filter the domain event explicitly.
    const publishedCalls = emitMock.mock.calls.filter(
      (c) => (c?.[0] as { event?: string })?.event === "contract_template published",
    );
    expect(publishedCalls).toHaveLength(1);
    expect(publishedCalls[0]?.[0].properties.data.is_reactivation).toBe(false);
  });

  it("re-activates a deprecated template and emits is_reactivation=true", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: [
        {
          data: {
            template_id: TEMPLATE_ID,
            workspace_id: WORKSPACE_ID,
            is_system: false,
            published_at: "2026-01-01T00:00:00Z",
            deprecated_at: "2026-03-01T00:00:00Z",
            name: "Retired template",
            version: 2,
          },
          error: null,
        },
        {
          data: {
            template_id: TEMPLATE_ID,
            published_at: "2026-04-22T12:30:00Z",
            version: 2,
          },
          error: null,
        },
      ],
    });

    await publishWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    // ADR-0204 SS-4: filter the domain event past gate_evaluated.
    const publishedCalls = emitMock.mock.calls.filter(
      (c) => (c?.[0] as { event?: string })?.event === "contract_template published",
    );
    expect(publishedCalls).toHaveLength(1);
    expect(publishedCalls[0]?.[0].properties.data.is_reactivation).toBe(true);
  });

  it("rejects non-admin with access denied and does NOT emit", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: EMPLOYEE_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "employee",
        },
        error: null,
      },
    });

    const result = await publishWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ profileId: nonEmpty(EMPLOYEE_PROFILE_ID, "profileId"), supabaseAdmin: sb }),
    );

    expect(result).toContain("Access denied");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects voice channel", async () => {
    const result = await publishWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ channel: "voice" }),
    );
    expect(result).toContain("chat channel");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects cross-workspace template", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: {
        data: {
          template_id: TEMPLATE_ID,
          workspace_id: OTHER_WORKSPACE_ID,
          is_system: false,
          published_at: null,
          deprecated_at: null,
          name: "Foreign template",
          version: 1,
        },
        error: null,
      },
    });

    const result = await publishWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    expect(result).toContain("different workspace");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
