/**
 * admin-router.test.ts
 * Unit tests for the admin router pipeline.
 * Mocks the AI SDK and OpenRouter provider to avoid real HTTP calls.
 * Verifies: no workspace required, optional workspace context in prompt, correct response shape.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted() runs before vi.mock() factory functions, so variables declared here
// are safely accessible inside the factory closures even after hoisting.
const { mockGenerateText, mockModelFn } = vi.hoisted(() => {
  const mockModelFn = vi.fn().mockReturnValue({ id: "anthropic/claude-sonnet-4.6" });
  const mockGenerateText = vi.fn();
  return { mockGenerateText, mockModelFn };
});

// ─── Mock: secrets ────────────────────────────────────────────────────────────
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-openrouter-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
    ultravoxApiKey: null,
  }),
}));

// ─── Mock: OpenRouter provider ────────────────────────────────────────────────
// createOpenRouter returns a function that itself returns a model object.
// We capture the constructor call so tests can inspect which model was requested.
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn().mockReturnValue(mockModelFn),
}));

// ─── Mock: Vercel AI SDK ──────────────────────────────────────────────────────
// We capture the `system` and `messages` passed to generateText so we can assert
// on the prompt content without making real LLM calls.
vi.mock("ai", () => ({
  generateText: mockGenerateText,
}));

// Import AFTER all vi.mock() calls so module resolution picks up the stubs
import { routeAdminMessage } from "../core/admin-router.js";
import type { ConversationTurn } from "../types/agent.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHistory(...pairs: Array<[string, string]>): ConversationTurn[] {
  return pairs.flatMap(([user, assistant]): ConversationTurn[] => [
    { role: "user", content: user, timestamp: "2026-01-01T00:00:00Z" },
    { role: "assistant", content: assistant, timestamp: "2026-01-01T00:00:01Z" },
  ]);
}

beforeEach(() => {
  mockGenerateText.mockResolvedValue({ text: "Hei, Pontus. Alt ser bra ut." });
  mockModelFn.mockClear();
  mockGenerateText.mockClear();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("routeAdminMessage — basic pipeline", () => {
  it("returns a response without requiring workspaceId", async () => {
    const result = await routeAdminMessage({
      message: "Status?",
      sessionId: "admin-session-1",
      conversationHistory: [],
    });

    expect(result.session_id).toBe("admin-session-1");
    expect(result.response).toBe("Hei, Pontus. Alt ser bra ut.");
  });

  it("returns no intent field (admin router does not classify intent)", async () => {
    const result = await routeAdminMessage({
      message: "What workspaces are active?",
      sessionId: "admin-session-2",
      conversationHistory: [],
    });

    expect(result.intent).toBeUndefined();
  });

  it("passes the user message as the last item in messages array", async () => {
    await routeAdminMessage({
      message: "Show me everything",
      sessionId: "admin-session-3",
      conversationHistory: [],
    });

    const call = mockGenerateText.mock.calls[0][0];
    const lastMessage = call.messages.at(-1);
    expect(lastMessage).toEqual({ role: "user", content: "Show me everything" });
  });

  it("uses the correct OpenRouter model", async () => {
    await routeAdminMessage({
      message: "ping",
      sessionId: "admin-session-4",
      conversationHistory: [],
    });

    expect(mockModelFn).toHaveBeenCalledWith("anthropic/claude-sonnet-4.6");
  });
});

describe("routeAdminMessage — workspace context in prompt", () => {
  it("includes workspace ID in system prompt when workspaceId is provided", async () => {
    await routeAdminMessage({
      message: "How many employees?",
      sessionId: "admin-session-5",
      workspaceId: "ws-abc-123",
      conversationHistory: [],
    });

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.system).toContain("ws-abc-123");
  });

  it("mentions /workspace command in system prompt when workspaceId is omitted", async () => {
    await routeAdminMessage({
      message: "Give me an overview",
      sessionId: "admin-session-6",
      conversationHistory: [],
    });

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.system).toContain("/workspace");
  });

  it("does NOT mention /workspace command nudge when workspaceId is set", async () => {
    await routeAdminMessage({
      message: "List sessions",
      sessionId: "admin-session-7",
      workspaceId: "ws-xyz-999",
      conversationHistory: [],
    });

    const call = mockGenerateText.mock.calls[0][0];
    // The nudge sentence should not appear when workspace is already set
    expect(call.system).not.toContain("suggest the admin use");
  });
});

describe("routeAdminMessage — conversation history", () => {
  it("includes prior conversation turns before the current message", async () => {
    const history = makeHistory(["Who are you?", "I am Mr. Botsson."]);

    await routeAdminMessage({
      message: "Good to know.",
      sessionId: "admin-session-8",
      conversationHistory: history,
    });

    const call = mockGenerateText.mock.calls[0][0];
    const { messages } = call;

    // Prior history (2 turns) + current user message = 3 messages
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "Who are you?" });
    expect(messages[1]).toEqual({ role: "assistant", content: "I am Mr. Botsson." });
    expect(messages[2]).toEqual({ role: "user", content: "Good to know." });
  });

  it("works correctly with empty conversation history", async () => {
    await routeAdminMessage({
      message: "Fresh start",
      sessionId: "admin-session-9",
      conversationHistory: [],
    });

    const call = mockGenerateText.mock.calls[0][0];
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0]).toEqual({ role: "user", content: "Fresh start" });
  });
});
