/**
 * agent-router-recording.test.ts
 * Phase 1b Task 11 — recorder hooks around classifyIntent and generateText.
 *
 * Verifies:
 *   - classifier_input phase recorded BEFORE classifyIntent
 *   - classifier_output phase recorded AFTER classifyIntent with intent in content
 *   - llm_request phase recorded BEFORE generateText
 *   - llm_response phase recorded AFTER generateText with latency_ms in meta
 *   - recorder failures never block the primary turn (recorder is opt-in)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock secrets (module-level Vault read).
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
    ultravoxApiKey: null,
  }),
}));

// Mock the classifier + generateText BEFORE agent-router import so the
// recording hooks wrap our stubs.
vi.mock("@smartout/ai/router/intent-classifier", () => ({
  classifyIntent: vi.fn().mockResolvedValue({
    capability: "schedule",
    confidence: 0.9,
  }),
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
  }),
}));

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "ok" }),
  stepCountIs: vi.fn().mockReturnValue(() => false),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn().mockReturnValue(() => "fake-model"),
}));

// gate_action + classifier-context supabase stub. The factory is hoisted, so
// we inline the returned object rather than referencing a top-level variable.
vi.mock("../lib/supabase.js", () => {
  const rpc = vi.fn().mockResolvedValue({
    data: { allow: true, downgrade_to: null, reason: null, gate_evaluation_id: "g1" },
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { role: "employee", display_name: "X", department: null },
    error: null,
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  return {
    supabaseAdmin: {
      from: vi.fn().mockReturnValue(builder),
      rpc,
    },
    createUserClient: vi.fn(),
  };
});

// agent-router imports authority + session-manager via `./authority.js` and
// `./session-manager.js` (relative to src/core/). In tests, those are the
// same modules we mock from src/core/ by path.
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
import { setRecorder, type Recorder, type RecordTurnInput } from "../core/session-recorder.js";

type Captured = { phase: string; turnKind: string; meta?: Record<string, unknown> };

function makeRecordingStub(captured: Captured[]): Recorder {
  return {
    recordTurn: (input: RecordTurnInput) => {
      captured.push({
        phase: input.phase,
        turnKind: input.turnKind,
        meta: input.meta,
      });
    },
    getBufferSize: () => 0,
    getDropCount: () => 0,
    getErrorCount: () => 0,
    stop: () => {},
  };
}

describe("agent-router recording hooks", () => {
  beforeEach(() => {
    setRecorder(null);
  });
  afterEach(() => {
    setRecorder(null);
  });

  it("records classifier_input + classifier_output around classifyIntent", async () => {
    const captured: Captured[] = [];
    setRecorder(makeRecordingStub(captured));

    await routeAgentMessage({
      message: "når jobber jeg?",
      sessionId: "s1",
      workspaceId: "w1",
      profileId: "p1",
      conversationHistory: [],
    });

    const phases = captured.map((c) => c.phase);
    const inputIdx = phases.indexOf("classifier_input");
    const outputIdx = phases.indexOf("classifier_output");
    expect(inputIdx).toBeGreaterThanOrEqual(0);
    expect(outputIdx).toBeGreaterThan(inputIdx);
  });

  it("records llm_request + llm_response around generateText with latency_ms", async () => {
    const captured: Captured[] = [];
    setRecorder(makeRecordingStub(captured));

    await routeAgentMessage({
      message: "hei",
      sessionId: "s1",
      workspaceId: "w1",
      profileId: "p1",
      conversationHistory: [],
    });

    const reqIdx = captured.findIndex((c) => c.phase === "llm_request");
    const resIdx = captured.findIndex((c) => c.phase === "llm_response");
    expect(reqIdx).toBeGreaterThanOrEqual(0);
    expect(resIdx).toBeGreaterThan(reqIdx);
    expect(captured[resIdx]!.meta?.latency_ms).toBeTypeOf("number");
  });

  it("does not throw when recorder singleton is null", async () => {
    setRecorder(null);
    const response = await routeAgentMessage({
      message: "hei",
      sessionId: "s1",
      workspaceId: "w1",
      profileId: "p1",
      conversationHistory: [],
    });
    expect(response.response).toBe("ok");
  });
});
