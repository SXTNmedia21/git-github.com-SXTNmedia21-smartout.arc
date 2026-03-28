import { describe, it, expect, vi } from "vitest";

vi.mock("../secrets.js", () => ({
  getSecrets: () => ({
    telegramBotToken: "test-token",
    telegramAdminChatId: "123456789",
  }),
}));

vi.mock("../core/telegram.js", () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../core/guardian-bus.js", () => ({
  emitGuardianEvent: vi.fn(),
}));

// Mock supabase — hasActiveBridge returns null (no active bridge)
vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  },
}));

const { hasActiveBridge, relayToSmartout } = await import("../core/telegram-bridge.js");

describe("Telegram bridge", () => {
  it("returns null when no active bridge exists", async () => {
    const result = await hasActiveBridge();
    expect(result).toBe(null);
  });

  it("relayToSmartout returns false when no bridge active", async () => {
    const result = await relayToSmartout("hello");
    expect(result).toBe(false);
  });
});
