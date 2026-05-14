/**
 * capabilities-source.test.ts — unit tests for CapabilitiesSource.
 *
 * Tests cover:
 *  1. Returns definitions for a sample capability when user role is authorized
 *  2. Excludes a capability when user role is insufficient (minRoleConfig gate)
 *  3. Empty result returned (not exception) when no capabilities are accessible
 *  4. Channel does not affect what comes back — chat and voice return the same set
 *  5. Definitions and implementations are in parity (same key set)
 *  6. Each definition has correct shape: modelToolName, description, dynamicParameters, client
 *  7. Tools with no parameters (z.object({})) produce empty dynamicParameters
 *  8. Tools with parameters produce correct dynamicParameters entries
 *
 * Test approach:
 *  - Uses the real registry via `createCapabilitiesSource()` for integration-style
 *    coverage (tests 1, 4, 5, 6, 7, 8).
 *  - Uses `vi.doMock` to inject synthetic capabilities for role-gate tests
 *    (tests 2, 3) so the test suite is not coupled to specific registry state.
 *
 * Why real registry:
 *  The registry exports are stable — any capability removal triggers a failing
 *  invariant check elsewhere (registry-uniqueness.test.ts, emitPrefix collision).
 *  Using the real registry here validates that the source can actually read
 *  and convert the live capability set without crashing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { UserContext } from "../types.js";

const ADMIN_USER: UserContext = {
  profile_id: "profile-admin-001",
  workspace_id: "ws-test-001",
  role: "admin",
};

const EMPLOYEE_USER: UserContext = {
  profile_id: "profile-emp-001",
  workspace_id: "ws-test-001",
  role: "employee",
};

const MANAGER_USER: UserContext = {
  profile_id: "profile-mgr-001",
  workspace_id: "ws-test-001",
  role: "manager",
};

/* ━━━ Test 1: definitions returned when role authorized ━━━━━━━━━━━━━━━━━━━━ */

describe("CapabilitiesSource — real registry", () => {
  it("1. returns at least one definition for an admin user with empty minRoleConfig", async () => {
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();
    const result = await source.getToolsFor("chat", ADMIN_USER);

    expect(result.definitions.length).toBeGreaterThan(0);
    // Every definition must have the required shape.
    for (const def of result.definitions) {
      expect(def.temporaryTool).toBeDefined();
      expect(typeof def.temporaryTool.modelToolName).toBe("string");
      expect(def.temporaryTool.modelToolName.length).toBeGreaterThan(0);
    }
  });

  it("4. channel='chat' and channel='voice' return the same definition set", async () => {
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();

    const chatResult = await source.getToolsFor("chat", EMPLOYEE_USER);
    const voiceResult = await source.getToolsFor("voice", EMPLOYEE_USER);

    const chatNames = chatResult.definitions.map((d) => d.temporaryTool.modelToolName).sort();
    const voiceNames = voiceResult.definitions.map((d) => d.temporaryTool.modelToolName).sort();

    // Channel is not a filter at this source layer — results must be identical.
    expect(chatNames).toEqual(voiceNames);
  });

  it("5. definitions and implementations are in parity (same key set)", async () => {
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();
    const result = await source.getToolsFor("chat", ADMIN_USER);

    const defNames = new Set(result.definitions.map((d) => d.temporaryTool.modelToolName));
    const implKeys = new Set(Object.keys(result.implementations));

    expect(defNames).toEqual(implKeys);
  });

  it("6. each definition has correct shape (modelToolName, description, dynamicParameters, client)", async () => {
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();
    const result = await source.getToolsFor("chat", ADMIN_USER);

    for (const def of result.definitions) {
      const t = def.temporaryTool;
      expect(typeof t.modelToolName).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(Array.isArray(t.dynamicParameters)).toBe(true);
      // client must be empty object (LiveKit requirement)
      expect(t.client).toEqual({});
    }
  });

  it("7. a tool with no parameters (z.object({})) produces empty dynamicParameters", async () => {
    // The 'profile' capability's `get_profile` tool uses z.object({}) — no params.
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();
    const result = await source.getToolsFor("chat", ADMIN_USER);

    const noParamTool = result.definitions.find(
      (d) => d.temporaryTool.modelToolName === "get_profile",
    );

    // get_profile is in the real registry — it has no required parameters.
    expect(noParamTool).toBeDefined();
    expect(noParamTool?.temporaryTool.dynamicParameters).toHaveLength(0);
  });

  it("8. a tool with parameters produces dynamicParameters with correct entries", async () => {
    // `search_profiles_by_name` in the profile capability has a `query` parameter.
    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");
    const source = createCapabilitiesSource();
    const result = await source.getToolsFor("chat", ADMIN_USER);

    const searchTool = result.definitions.find(
      (d) => d.temporaryTool.modelToolName === "search_profiles_by_name",
    );

    expect(searchTool).toBeDefined();
    const params = searchTool?.temporaryTool.dynamicParameters ?? [];
    expect(params.length).toBeGreaterThan(0);

    const queryParam = params.find((p) => p.name === "query");
    expect(queryParam).toBeDefined();
    expect(queryParam?.schema.type).toBe("string");
    expect(queryParam?.required).toBe(true);
  });
});

/* ━━━ Tests 2 + 3: role gate via minRoleConfig — isolated mocks ━━━━━━━━━━━━ */

describe("CapabilitiesSource — role gate (minRoleConfig)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("2. excludes a capability when user role is below minRoleConfig threshold", async () => {
    // Inject a synthetic registry with two capabilities:
    //   - "schedule" available to all (no min role)
    //   - "payroll"  restricted to admin+ in our config
    vi.doMock("../../capabilities/registry.js", () => ({
      getAllCapabilities: () => [
        {
          name: "schedule",
          description: "Schedule tools",
          tools: [
            {
              name: "list_shifts",
              description: "List shifts",
              schema: z.object({}),
              execute: async () => "[]",
            },
          ],
          readOnlyTools: [],
          allowedChannels: ["chat", "voice"],
          toolAuthPattern: "direct_admin",
          emitPrefix: "schedule",
        },
        {
          name: "payroll",
          description: "Payroll tools",
          tools: [
            {
              name: "view_payroll",
              description: "View payroll",
              schema: z.object({}),
              execute: async () => "{}",
            },
          ],
          readOnlyTools: [],
          allowedChannels: ["chat"],
          toolAuthPattern: "direct_admin",
          emitPrefix: "payroll",
        },
      ],
    }));

    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");

    // minRoleConfig restricts "payroll" to admin+
    const source = createCapabilitiesSource({ payroll: "admin" });

    // Employee should see schedule but NOT payroll.
    const empResult = await source.getToolsFor("chat", EMPLOYEE_USER);
    const empToolNames = empResult.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(empToolNames).toContain("list_shifts");
    expect(empToolNames).not.toContain("view_payroll");

    // Manager (below admin) should also be excluded from payroll.
    const mgrResult = await source.getToolsFor("chat", MANAGER_USER);
    const mgrToolNames = mgrResult.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(mgrToolNames).toContain("list_shifts");
    expect(mgrToolNames).not.toContain("view_payroll");

    // Admin should see both.
    const adminResult = await source.getToolsFor("chat", ADMIN_USER);
    const adminToolNames = adminResult.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(adminToolNames).toContain("list_shifts");
    expect(adminToolNames).toContain("view_payroll");
  });

  it("3. empty result returned (not exception) when all capabilities are role-gated away", async () => {
    vi.doMock("../../capabilities/registry.js", () => ({
      getAllCapabilities: () => [
        {
          name: "admin_only",
          description: "Admin-only surface",
          tools: [
            {
              name: "manage_workspace",
              description: "Manage workspace settings",
              schema: z.object({}),
              execute: async () => "ok",
            },
          ],
          readOnlyTools: [],
          allowedChannels: ["chat"],
          toolAuthPattern: "direct_admin",
          emitPrefix: null,
        },
      ],
    }));

    const { createCapabilitiesSource } = await import("../sources/capabilities-source.js");

    // All capabilities gated to owner — employee gets nothing.
    const source = createCapabilitiesSource({ admin_only: "owner" });
    const result = await source.getToolsFor("chat", EMPLOYEE_USER);

    expect(result.definitions).toHaveLength(0);
    expect(Object.keys(result.implementations)).toHaveLength(0);
  });
});
