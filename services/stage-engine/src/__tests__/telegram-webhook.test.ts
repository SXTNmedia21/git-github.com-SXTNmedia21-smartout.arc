/**
 * telegram-webhook.test.ts
 * Unit tests for the Telegram webhook handler.
 *
 * Tests:
 *   - verifyWebhookSecret: rejects missing/wrong token, accepts correct token
 *   - isDuplicate: deduplicates update_ids correctly
 *
 * All external dependencies (secrets, supabase, telegram client, admin-router,
 * guardian-bus) are mocked so no real I/O occurs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted: variables accessible inside vi.mock() factory closures
// ---------------------------------------------------------------------------
const {
  mockGetSecrets,
  mockSecretsDefault,
  mockSupabaseFrom,
  mockSupabaseRpc,
  mockRouteAdminMessage,
  mockEmitGuardian,
} = vi.hoisted(() => {
  const mockSecretsDefault = {
    telegramBotToken: "test-bot-token",
    telegramAdminChatId: "100200300",
    telegramWebhookSecret: "super-secret-webhook-token",
    openrouterApiKey: "test-openrouter-key",
    ultravoxApiKey: null,
  };

  // Build a chainable Supabase query builder stub
  const chainable: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = ["select", "eq", "is", "order", "limit", "single", "insert", "update"];
  for (const method of methods) {
    chainable[method] = vi.fn();
  }
  // Every method returns the same chainable object so calls can be fluently chained
  for (const method of methods) {
    chainable[method].mockReturnValue(chainable);
  }
  // Terminal method resolves with empty data by default
  chainable.single.mockResolvedValue({ data: null, error: null });

  const mockSupabaseFrom = vi.fn().mockReturnValue(chainable);
  const mockSupabaseRpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const mockGetSecrets = vi.fn().mockReturnValue(mockSecretsDefault);

  const mockRouteAdminMessage = vi.fn().mockResolvedValue({
    session_id: "admin-session-123",
    response: "Hello from Mr. Botsson",
  });

  const mockEmitGuardian = vi.fn();

  return {
    mockGetSecrets,
    mockSecretsDefault,
    mockSupabaseFrom,
    mockSupabaseRpc,
    mockRouteAdminMessage,
    mockEmitGuardian,
  };
});

// ---------------------------------------------------------------------------
// Module mocks (must appear before the module under test is imported)
// ---------------------------------------------------------------------------

vi.mock("../secrets.js", () => ({
  getSecrets: mockGetSecrets,
}));

vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  },
}));

vi.mock("../core/telegram.js", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
  answerCallbackQuery: vi.fn().mockResolvedValue({ ok: true }),
  editMessageText: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../core/admin-router.js", () => ({
  routeAdminMessage: mockRouteAdminMessage,
}));

vi.mock("../core/guardian-bus.js", () => ({
  emitGuardianEvent: mockEmitGuardian,
}));

// Import AFTER all vi.mock() declarations so the stubs are in place
import { verifyWebhookSecret, isDuplicate } from "../routes/adapters/telegram.js";

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Restore default secrets after clearAllMocks() wipes the return value
  mockGetSecrets.mockReturnValue(mockSecretsDefault);
});

// ---------------------------------------------------------------------------
// verifyWebhookSecret
// ---------------------------------------------------------------------------

describe("verifyWebhookSecret", () => {
  it("rejects when header token is undefined", () => {
    expect(verifyWebhookSecret(undefined)).toBe(false);
  });

  it("rejects when header token is empty string", () => {
    expect(verifyWebhookSecret("")).toBe(false);
  });

  it("rejects when header token does not match the configured secret", () => {
    expect(verifyWebhookSecret("wrong-token")).toBe(false);
  });

  it("accepts when header token exactly matches the configured secret", () => {
    expect(verifyWebhookSecret("super-secret-webhook-token")).toBe(true);
  });

  it("rejects when no webhook secret is configured", () => {
    mockGetSecrets.mockReturnValueOnce({ ...mockSecretsDefault, telegramWebhookSecret: null });
    expect(verifyWebhookSecret("super-secret-webhook-token")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDuplicate (deduplication)
// ---------------------------------------------------------------------------

describe("isDuplicate", () => {
  it("returns false for a freshly seen update_id", () => {
    // Large IDs to avoid collision with IDs used in other tests in the same run
    const freshId = 9_000_001 + Math.floor(Math.random() * 100_000);
    expect(isDuplicate(freshId)).toBe(false);
  });

  it("returns true when the same update_id is submitted twice", () => {
    const id = 8_000_001 + Math.floor(Math.random() * 100_000);
    isDuplicate(id); // First call — marks as seen
    expect(isDuplicate(id)).toBe(true); // Second call — should be detected as duplicate
  });

  it("treats two different update_ids as independent", () => {
    const id1 = 7_000_001 + Math.floor(Math.random() * 100_000);
    const id2 = id1 + 1;
    isDuplicate(id1);
    expect(isDuplicate(id2)).toBe(false);
  });
});
