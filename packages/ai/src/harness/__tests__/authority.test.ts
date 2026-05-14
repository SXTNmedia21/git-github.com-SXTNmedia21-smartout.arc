/**
 * authority.test.ts — unit tests for AuthorityEnforcer.
 *
 * Tests cover:
 *  1. Chat channel: PII tool stays in bundle
 *  2. Voice channel: PII tool stripped (ADR-0078)
 *  3. Voice channel: financial-mutation tool stripped (ADR-0244)
 *  4. Chat channel: financial-mutation tool stays
 *  5. workspace_id always derived from userContext (ADR-0151)
 *  6. Stripping a definition also strips its implementation (key parity)
 *  7. Regex-matched PII tool name (pattern check)
 *  8. Voice channel with clean bundle: empty blockedTools
 *  9. workspace_id overwrite is recorded in blockedTools
 * 10. Multiple tools: some stripped, some kept; correct key parity
 */

import { describe, expect, it } from "vitest";
import { createAuthorityEnforcer } from "../authority.js";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ToolBundle,
  UserContext,
} from "../types.js";

/* ━━━ Test helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function makeDefinition(name: string): ClientToolDefinition {
  return {
    temporaryTool: {
      modelToolName: name,
      description: `Mock tool: ${name}`,
      dynamicParameters: [],
      client: {},
    },
  };
}

function makeImpl(name: string): ClientToolImplementation {
  return (_params: Record<string, unknown>) => `result from ${name}`;
}

function makeBundle(toolNames: string[], workspaceOverride = ""): ToolBundle {
  const definitions = toolNames.map(makeDefinition);
  const implementations: Record<string, ClientToolImplementation> = {};
  for (const name of toolNames) {
    implementations[name] = makeImpl(name);
  }
  return {
    definitions,
    implementations,
    systemPromptSlices: ["## Mock slice"],
    authority: {
      workspace_id: workspaceOverride,
      channel: "chat",
      role: "employee",
      blockedTools: [],
      gateActionMisses: [],
    },
  };
}

const WORKER: UserContext = {
  profile_id: "profile-abc",
  workspace_id: "ws-correct-123",
  role: "employee",
};

/* ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("AuthorityEnforcer", () => {
  const enforcer = createAuthorityEnforcer();

  it("1. chat channel: PII tool stays in bundle", () => {
    const bundle = makeBundle(["revealPersonnummer", "getShifts"]);
    const result = enforcer.apply(bundle, WORKER, "chat");

    const names = result.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).toContain("revealPersonnummer");
    expect(result.authority.blockedTools).toHaveLength(0);
  });

  it("2. voice channel: PII tool stripped; blockedTools records rule ADR-0078-voice-no-pii", () => {
    const bundle = makeBundle(["revealPersonnummer", "getShifts"]);
    const result = enforcer.apply(bundle, WORKER, "voice");

    const names = result.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).not.toContain("revealPersonnummer");
    expect(names).toContain("getShifts");

    const blocked = result.authority.blockedTools.find((e) => e.name === "revealPersonnummer");
    expect(blocked).toBeDefined();
    expect(blocked?.rule).toBe("ADR-0078-voice-no-pii");
  });

  it("3. voice channel: financial-mutation tool stripped; rule ADR-0244-passive-no-financial-mutation", () => {
    const bundle = makeBundle(["markPaid", "getShifts"]);
    const result = enforcer.apply(bundle, WORKER, "voice");

    const names = result.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).not.toContain("markPaid");
    expect(names).toContain("getShifts");

    const blocked = result.authority.blockedTools.find((e) => e.name === "markPaid");
    expect(blocked).toBeDefined();
    expect(blocked?.rule).toBe("ADR-0244-passive-no-financial-mutation");
  });

  it("4. chat channel: financial-mutation tool stays (chat is an active channel)", () => {
    const bundle = makeBundle(["markPaid", "payInvoice", "getShifts"]);
    const result = enforcer.apply(bundle, WORKER, "chat");

    const names = result.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).toContain("markPaid");
    expect(names).toContain("payInvoice");
    expect(result.authority.blockedTools).toHaveLength(0);
  });

  it("5. workspace_id is always derived from userContext, overwriting bundle value", () => {
    // Pre-set bundle with wrong workspace_id to simulate an untrusted body value.
    const bundle = makeBundle(["getShifts"], "ws-WRONG-body-supplied");
    expect(bundle.authority.workspace_id).toBe("ws-WRONG-body-supplied");

    const result = enforcer.apply(bundle, WORKER, "chat");

    expect(result.authority.workspace_id).toBe(WORKER.workspace_id);
    // Original bundle must not be mutated.
    expect(bundle.authority.workspace_id).toBe("ws-WRONG-body-supplied");
  });

  it("6. stripping a tool from definitions also strips its implementation (key parity)", () => {
    const bundle = makeBundle(["revealPersonnummer", "getShifts", "markPaid"]);
    const result = enforcer.apply(bundle, WORKER, "voice");

    const defNames = new Set(result.definitions.map((d) => d.temporaryTool.modelToolName));
    const implKeys = new Set(Object.keys(result.implementations));

    // Both collections must have the same key set.
    expect(defNames).toEqual(implKeys);

    // The stripped tools must be absent from both.
    expect(defNames.has("revealPersonnummer")).toBe(false);
    expect(implKeys.has("revealPersonnummer")).toBe(false);
    expect(defNames.has("markPaid")).toBe(false);
    expect(implKeys.has("markPaid")).toBe(false);

    // The clean tool must survive in both.
    expect(defNames.has("getShifts")).toBe(true);
    expect(implKeys.has("getShifts")).toBe(true);
  });

  it("7. regex-matched PII tool name is stripped from voice (pattern check)", () => {
    // These names are NOT in the exact deny-list but match the pattern.
    const patternNames = ["fetchEmployeePii", "get_ssn", "lookup_fnr"];
    const bundle = makeBundle([...patternNames, "getShifts"]);
    const result = enforcer.apply(bundle, WORKER, "voice");

    const names = result.definitions.map((d) => d.temporaryTool.modelToolName);
    for (const n of patternNames) {
      expect(names).not.toContain(n);
    }
    expect(names).toContain("getShifts");

    for (const n of patternNames) {
      const entry = result.authority.blockedTools.find((e) => e.name === n);
      expect(entry?.rule).toBe("ADR-0078-voice-no-pii");
    }
  });

  it("8. voice channel with only clean tools: blockedTools is empty", () => {
    const bundle = makeBundle(["getShifts", "querySchedule", "listDepartments"]);
    const result = enforcer.apply(bundle, WORKER, "voice");

    expect(result.definitions).toHaveLength(3);
    expect(result.authority.blockedTools).toHaveLength(0);
  });

  it("9. workspace_id overwrite is recorded in blockedTools as audit entry", () => {
    const bundle = makeBundle(["getShifts"], "ws-tampered");
    const result = enforcer.apply(bundle, WORKER, "chat");

    const overwriteEntry = result.authority.blockedTools.find(
      (e) => e.rule === "ADR-0151-workspace-id-derived-server-side",
    );
    expect(overwriteEntry).toBeDefined();
    // Workspace_id still ends up correct.
    expect(result.authority.workspace_id).toBe(WORKER.workspace_id);
  });

  it("10. mixed bundle: some stripped, some kept; definitions and implementations remain in parity", () => {
    const bundle = makeBundle([
      "revealPersonnummer", // PII — stripped
      "getShifts", // clean
      "signContract", // financial mutation — stripped
      "listDepartments", // clean
      "revealAddress", // PII — stripped
      "querySchedule", // clean
    ]);

    const result = enforcer.apply(bundle, WORKER, "voice");

    const defNames = result.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(defNames).toEqual(["getShifts", "listDepartments", "querySchedule"]);
    expect(Object.keys(result.implementations).sort()).toEqual(
      ["getShifts", "listDepartments", "querySchedule"].sort(),
    );

    const blockedNames = result.authority.blockedTools.map((e) => e.name);
    expect(blockedNames).toContain("revealPersonnummer");
    expect(blockedNames).toContain("revealAddress");
    expect(blockedNames).toContain("signContract");

    // systemPromptSlices pass through unchanged.
    expect(result.systemPromptSlices).toEqual(bundle.systemPromptSlices);
  });
});
