/**
 * agent-router-classifier-context-propagation.test.ts
 * Phase A5 (Botsson harness) + ADR-0112 propagation proof.
 *
 * Asserts the ARTEFACT (not just the shape): when `routeAgentMessage` calls
 * `classifyIntent`, the structured `ClassifierContext` object that arrives at
 * the classifier mock has non-null role/department/channel/workspaceId drawn
 * from the profile lookup + caller inputs — not `""`, not missing fields,
 * not `"employee"` invented out of thin air.
 *
 * L-0125: asserting `ok:true` is not asserting the artefact. Here we pin the
 * observable contract (what the classifier sees) so a regression that drops
 * back to `classifyIntent(msg, "")` or `{role: null, ...}` on a populated
 * profile fails this test loudly.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { nonEmpty } from "@smartout/telemetry/server";

// Module-level secrets stub.
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
  }),
}));

// Spy we can assert against. Default: returns a generic schedule intent.
// `vi.hoisted` places the spy declaration where the hoisted `vi.mock` factory
// needs it — direct references from the factory would hit the temporal dead
// zone because vitest lifts `vi.mock` above all top-level statements.
const { classifyIntentSpy } = vi.hoisted(() => ({
  classifyIntentSpy: vi.fn().mockResolvedValue({
    intent: "schedule.query",
    capability: "schedule",
    confidence: 0.9,
    reasoning: "stub",
  }),
}));

vi.mock("@smartout/ai/router/intent-classifier", () => ({
  classifyIntent: classifyIntentSpy,
}));

vi.mock("@smartout/ai/router/tool-selector", () => ({
  selectTools: vi.fn().mockReturnValue([]),
}));

vi.mock("@smartout/ai/prompts/mr-botsson", () => ({
  buildBotssonPromptFromContext: vi.fn().mockReturnValue("system prompt"),
}));

vi.mock("@smartout/ai/adapters/vercel-ai", () => ({
  toVercelTools: vi.fn().mockReturnValue({}),
}));

vi.mock("@smartout/ai/context/collector", () => ({
  collectContext: vi.fn().mockResolvedValue({
    profile: { role: "employee" },
    relevantMemories: [],
    personalTasks: [],
  }),
}));

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "ok" }),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn().mockReturnValue(() => "fake-model"),
}));

/**
 * Supabase stub — returns a realistic admin profile with a department so the
 * classifier receives populated structured fields. Also satisfies the
 * `gate_action` RPC call.
 *
 * The spies are hoisted (like `classifyIntentSpy`) so `beforeEach` can reset
 * call counts between cases. Without this, `builder.eq` / `supabaseAdmin.from`
 * / `supabaseAdmin.rpc` leaked state across tests — a latent footgun for any
 * future assertion that counts invocations.
 */
const { rpcSpy, maybeSingleSpy, builderSelectSpy, builderEqSpy, fromSpy, createUserClientSpy } =
  vi.hoisted(() => ({
    rpcSpy: vi.fn().mockResolvedValue({
      data: { allow: true, downgrade_to: null, reason: null, gate_evaluation_id: "g1" },
      error: null,
    }),
    maybeSingleSpy: vi.fn().mockResolvedValue({
      data: {
        role: "admin",
        display_name: "Pontus",
        department: { name: "Kjøkken" },
      },
      error: null,
    }),
    builderSelectSpy: vi.fn(),
    builderEqSpy: vi.fn(),
    fromSpy: vi.fn(),
    createUserClientSpy: vi.fn(),
  }));

vi.mock("../lib/supabase.js", () => {
  const builder = {
    select: builderSelectSpy.mockReturnThis(),
    eq: builderEqSpy.mockReturnThis(),
    maybeSingle: maybeSingleSpy,
  };
  return {
    supabaseAdmin: {
      from: fromSpy.mockReturnValue(builder),
      rpc: rpcSpy,
    },
    createUserClient: createUserClientSpy,
  };
});

vi.mock("../core/authority.js", () => ({
  loadAuthorityConfig: vi.fn().mockResolvedValue({ levels: {}, minRoles: {} }),
}));

vi.mock("../core/session-manager.js", () => ({
  loadOnboardingContext: vi.fn().mockResolvedValue(null),
}));

vi.mock("../ws/connection-manager.js", () => ({
  broadcastToSession: vi.fn(),
}));

vi.mock("../routes/ws.js", () => ({
  getBufferedActions: vi.fn().mockReturnValue([]),
}));

// Import AFTER mocks.
import { routeAgentMessage } from "../core/agent-router.js";

describe("agent-router classifier-context propagation (Phase A5)", () => {
  beforeEach(() => {
    // Clear every spy that persists across cases. `mockClear()` preserves the
    // `mockReturnThis()` / `mockResolvedValue(...)` implementations set up at
    // hoist time — we only reset call history.
    classifyIntentSpy.mockClear();
    fromSpy.mockClear();
    rpcSpy.mockClear();
    builderSelectSpy.mockClear();
    builderEqSpy.mockClear();
    maybeSingleSpy.mockClear();
    createUserClientSpy.mockClear();
  });

  afterEach(() => {
    classifyIntentSpy.mockClear();
    fromSpy.mockClear();
    rpcSpy.mockClear();
    builderSelectSpy.mockClear();
    builderEqSpy.mockClear();
    maybeSingleSpy.mockClear();
    createUserClientSpy.mockClear();
  });

  it("passes a structured ClassifierContext object (not a string) to classifyIntent", async () => {
    await routeAgentMessage({
      message: "når jobber jeg?",
      sessionId: "s1",
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-1", "profileId"),
      conversationHistory: [],
      channel: "chat",
    });

    expect(classifyIntentSpy).toHaveBeenCalledTimes(1);
    const [messageArg, contextArg] = classifyIntentSpy.mock.calls[0]!;

    // Message is forwarded unchanged.
    expect(messageArg).toBe("når jobber jeg?");

    // Context is an OBJECT, not a string. A regression to a string (or to "")
    // would make this property-access check fail at runtime.
    expect(typeof contextArg).toBe("object");
    expect(contextArg).not.toBeNull();
  });

  it("propagates role + department from the profile row into the classifier context", async () => {
    await routeAgentMessage({
      message: "hva er reglene?",
      sessionId: "s1",
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-1", "profileId"),
      conversationHistory: [],
      channel: "chat",
    });

    const [, contextArg] = classifyIntentSpy.mock.calls[0]!;

    // Structured fields reflect the mocked profile row (admin + Kjøkken).
    expect(contextArg).toMatchObject({
      role: "admin",
      departmentName: "Kjøkken",
    });
  });

  it("propagates channel and workspaceId into the classifier context", async () => {
    await routeAgentMessage({
      message: "åpne vaktskjermen",
      sessionId: "s1",
      workspaceId: nonEmpty("ws-42", "workspaceId"),
      profileId: nonEmpty("profile-1", "profileId"),
      conversationHistory: [],
      channel: "voice",
    });

    const [, contextArg] = classifyIntentSpy.mock.calls[0]!;

    expect(contextArg).toMatchObject({
      channel: "voice",
      workspaceId: "ws-42",
    });
  });

  it("never passes an empty-string context (L-0094 phantom-contract guard)", async () => {
    await routeAgentMessage({
      message: "hei",
      sessionId: "s1",
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-1", "profileId"),
      conversationHistory: [],
      channel: "chat",
    });

    const [, contextArg] = classifyIntentSpy.mock.calls[0]!;

    // The old bug was literally `classifyIntent(message, "")`. If any future
    // refactor reintroduces a string context, this assertion fails.
    expect(contextArg).not.toBe("");
    expect(typeof contextArg).not.toBe("string");
  });
});
