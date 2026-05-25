/**
 * fork_template capability tool — unit tests.
 *
 * Covers Gate G4 invariants:
 *   - admin role → happy path, emit fired, lineage-aware output
 *   - employee role → "Access denied", emit NOT fired
 *   - non-chat channel → channel guard returns Norwegian-leaning denial
 *   - non-system source → rejected before INSERT (Fix #2 / ADR-0191:
 *     implementation now writes directly via ctx.supabaseAdmin and pre-checks
 *     `is_system=true` on the source SELECT — the row is therefore absent for
 *     non-system inputs and the tool returns "System template not found.")
 *
 * Uses the schema-validated Supabase mock (L-0087). Per-call array is used
 * for `contract_template` so the source SELECT and the lineage INSERT each
 * resolve to a distinct shape (callIndex 0 vs 1), mirroring the established
 * pattern in publish-workspace-template.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { nonEmpty } from "@smartout/telemetry/server";
import type { AgentToolContext } from "../../types.js";
import { forkTemplate } from "../tools.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

const emitMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
  nonEmpty: (v: string) => v,
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const ADMIN_PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const EMPLOYEE_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const SYSTEM_TEMPLATE_ID = "30000000-0000-0000-0000-000000000001";
const WORKSPACE_TEMPLATE_ID = "30000000-0000-0000-0000-000000000002";

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

describe("fork_template", () => {
  beforeEach(() => {
    emitMock.mockClear();
  });

  it("forks a system template (admin happy path) and emits forked event", async () => {
    // Two `.from('contract_template')` calls happen in the implementation:
    //   1. SELECT * ... eq is_system true ... single()  → source row
    //   2. INSERT(...).select(...).single()             → newly-forked row
    // The mock advances callIndex per `.from(name)` invocation, so we provide
    // an array with one entry per call.
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
            template_id: SYSTEM_TEMPLATE_ID,
            name: "Standard ansettelseskontrakt",
            version: 3,
            is_system: true,
            description: null,
            contract_type: "employment",
            language: "nb",
            content_html: "<p>contract</p>",
            content_css: null,
            header_html: null,
            footer_html: null,
            placeholders: {},
            employment_category: null,
          },
          error: null,
        },
        {
          data: {
            template_id: WORKSPACE_TEMPLATE_ID,
            source_template_version: "3",
            forked_at: "2026-04-22T12:00:00Z",
          },
          error: null,
        },
      ],
    });

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID, name_override: "Custom fork" },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.workspace_template_id).toBe(WORKSPACE_TEMPLATE_ID);
    expect(parsed.source_version).toBe("3");
    expect(parsed.forked_at).toBe("2026-04-22T12:00:00Z");

    // ADR-0204 SS-4: mutateWithGate emits `gate_evaluated` in addition to
    // the capability's domain event. Filter the domain event explicitly
    // rather than asserting total-call-count so the test stays robust to
    // wrapper-internal emits.
    const forkedCalls = emitMock.mock.calls.filter(
      (c) => (c?.[0] as { event?: string })?.event === "contract_template forked",
    );
    expect(forkedCalls).toHaveLength(1);
    const call = forkedCalls[0];
    expect(call?.[0].properties.entity.entity_id).toBe(WORKSPACE_TEMPLATE_ID);
    expect(call?.[0].properties.data.source_scope).toBe("system");
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

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ profileId: nonEmpty(EMPLOYEE_PROFILE_ID, "profileId"), supabaseAdmin: sb }),
    );

    expect(result).toContain("Access denied");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects voice channel with template authoring denial", async () => {
    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ channel: "voice" }),
    );

    expect(result).toContain("chat channel");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects a non-system source template (would be workspace→workspace, not supported)", async () => {
    // The implementation pre-checks `is_system=true` in the SELECT filter.
    // For a non-system source, PostgREST `.single()` returns no row, so the
    // mock returns `data: null` to mirror that behaviour. The tool then
    // surfaces "System template not found." and never reaches INSERT.
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
        data: null,
        error: null,
      },
    });

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    expect(result).toContain("System template not found");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
