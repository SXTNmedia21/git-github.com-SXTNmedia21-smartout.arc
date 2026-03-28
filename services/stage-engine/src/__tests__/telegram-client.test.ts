/**
 * telegram-client.test.ts
 * Unit tests for the Telegram Bot API client.
 * Mocks fetch globally and stubs getSecrets to isolate all HTTP calls.
 */
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

// Mock secrets before importing the module under test
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    telegramBotToken: "test-bot-token",
    telegramAdminChatId: "123456789",
    telegramWebhookSecret: "test-webhook-secret",
    ultravoxApiKey: null,
    openrouterApiKey: null,
  }),
}));

import {
  escapeMarkdownV2,
  sendTelegramMessage,
  sendTelegramPoll,
  answerCallbackQuery,
  editMessageText,
  registerWebhook,
  sendTelegramEscalation,
} from "../core/telegram.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful Telegram API response */
function okResponse(result: unknown = true) {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a failed Telegram API response */
function errResponse(description = "Bad Request", error_code = 400) {
  return new Response(JSON.stringify({ ok: false, error_code, description }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let fetchMock: MockInstance;

beforeEach(() => {
  // Re-create the spy each test and clear all recorded calls.
  // vi.spyOn returns the same mock object when the property is already spied on,
  // so we must explicitly clear it to prevent call history leaking between tests.
  // We use mockImplementation (not mockResolvedValue) so each call gets a fresh
  // Response object — a single Response body can only be consumed once.
  fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(okResponse()));
  fetchMock.mockClear();
});

// ---------------------------------------------------------------------------
// escapeMarkdownV2
// ---------------------------------------------------------------------------

describe("escapeMarkdownV2", () => {
  it("escapes all MarkdownV2 special characters", () => {
    const special = "_*[]()~`>#+\\-=|{}.!";
    const escaped = escapeMarkdownV2(special);
    // Every special char should be preceded by a backslash
    for (const ch of special) {
      expect(escaped).toContain(`\\${ch}`);
    }
  });

  it("leaves ordinary alphanumeric text unchanged", () => {
    expect(escapeMarkdownV2("Hello World 123")).toBe("Hello World 123");
  });

  it("escapes backslash itself", () => {
    expect(escapeMarkdownV2("a\\b")).toBe("a\\\\b");
  });
});

// ---------------------------------------------------------------------------
// sendTelegramMessage
// ---------------------------------------------------------------------------

describe("sendTelegramMessage", () => {
  it("sends to the correct Telegram API URL", async () => {
    await sendTelegramMessage("Hello");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
  });

  it("sends to the admin chat ID from secrets", async () => {
    await sendTelegramMessage("Hello");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe("123456789");
  });

  it("includes the message text in the request body", async () => {
    await sendTelegramMessage("Test message");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe("Test message");
  });

  it("returns the API response with ok: true", async () => {
    const result = await sendTelegramMessage("Hi");
    expect(result.ok).toBe(true);
  });

  it("auto-chunks messages longer than 4096 characters into multiple calls", async () => {
    const longText = "x".repeat(4097);
    await sendTelegramMessage(longText);

    // Two fetch calls: one for each chunk
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends exactly two chunks when text is 8192 characters", async () => {
    const longText = "a".repeat(8192);
    await sendTelegramMessage(longText);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes parse_mode when provided via options", async () => {
    await sendTelegramMessage("bold", { parse_mode: "MarkdownV2" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.parse_mode).toBe("MarkdownV2");
  });

  it("returns an error response when Telegram rejects the call", async () => {
    fetchMock.mockResolvedValueOnce(errResponse("Bad Request"));

    const result = await sendTelegramMessage("fail");
    expect(result.ok).toBe(false);
    expect(result.description).toBe("Bad Request");
  });
});

// ---------------------------------------------------------------------------
// sendTelegramPoll
// ---------------------------------------------------------------------------

describe("sendTelegramPoll", () => {
  it("calls the sendPoll endpoint", async () => {
    await sendTelegramPoll("Which option?", ["A", "B", "C"]);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendPoll");
  });

  it("sends the correct options array format", async () => {
    await sendTelegramPoll("Pick one", ["Yes", "No"]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.options).toEqual(["Yes", "No"]);
  });

  it("includes the question in the request body", async () => {
    await sendTelegramPoll("What now?", ["Option 1"]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.question).toBe("What now?");
  });

  it("sets allows_multiple_answers when the flag is true", async () => {
    await sendTelegramPoll("Multi?", ["A", "B"], true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.allows_multiple_answers).toBe(true);
  });

  it("defaults allows_multiple_answers to false", async () => {
    await sendTelegramPoll("Single?", ["X", "Y"]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.allows_multiple_answers).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// answerCallbackQuery
// ---------------------------------------------------------------------------

describe("answerCallbackQuery", () => {
  it("calls the answerCallbackQuery endpoint", async () => {
    await answerCallbackQuery("callback-id-123");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/answerCallbackQuery");
  });

  it("sends the callback_query_id in the request body", async () => {
    await answerCallbackQuery("cb-456");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.callback_query_id).toBe("cb-456");
  });

  it("includes optional text when provided", async () => {
    await answerCallbackQuery("cb-789", "Action confirmed");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.text).toBe("Action confirmed");
  });

  it("omits text property when not provided", async () => {
    await answerCallbackQuery("cb-000");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.text).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// editMessageText
// ---------------------------------------------------------------------------

describe("editMessageText", () => {
  it("calls the editMessageText endpoint", async () => {
    await editMessageText(42, "Updated text");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/editMessageText");
  });

  it("sends message_id and new text in the request body", async () => {
    await editMessageText(99, "New content");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.message_id).toBe(99);
    expect(body.text).toBe("New content");
  });

  it("includes parse_mode when provided", async () => {
    await editMessageText(1, "text", "MarkdownV2");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.parse_mode).toBe("MarkdownV2");
  });
});

// ---------------------------------------------------------------------------
// registerWebhook
// ---------------------------------------------------------------------------

describe("registerWebhook", () => {
  it("calls the setWebhook endpoint", async () => {
    await registerWebhook("https://example.com/hook");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/setWebhook");
  });

  it("sends the webhook url in the request body", async () => {
    await registerWebhook("https://example.com/hook");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.url).toBe("https://example.com/hook");
  });
});

// ---------------------------------------------------------------------------
// sendTelegramEscalation
// ---------------------------------------------------------------------------

describe("sendTelegramEscalation", () => {
  it("sends a message via the sendMessage endpoint", async () => {
    await sendTelegramEscalation("Title", "Body text", "high", [
      { label: "Approve", callbackData: "approve" },
    ]);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.telegram.org/bottest-bot-token/sendMessage");
  });

  it("includes the title and body in the message text", async () => {
    await sendTelegramEscalation("Alert", "Something happened", "critical", []);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain("Alert");
    expect(body.text).toContain("Something happened");
  });

  it("attaches inline keyboard buttons for each action", async () => {
    await sendTelegramEscalation("Q", "body", "low", [
      { label: "Yes", callbackData: "yes" },
      { label: "No", callbackData: "no" },
    ]);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const buttons: Array<{ text: string; callback_data: string }> =
      body.reply_markup.inline_keyboard.flat();
    expect(buttons).toHaveLength(2);
    expect(buttons[0].callback_data).toBe("yes");
    expect(buttons[1].callback_data).toBe("no");
  });
});
