import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getChannelAiPolicy, isAiAllowedInChannel } from "../policy.js";

type PolicyRow = {
  text_participation: "disabled" | "mention_only" | "proactive";
  voice_participation: "disabled" | "listen_only" | "interactive";
  auto_reminders: boolean;
  auto_shift_prep: boolean;
  auto_summarize: boolean;
};

function mockSupabase(row: PolicyRow | null, shouldError = false): SupabaseClient {
  const single = vi
    .fn()
    .mockResolvedValue(
      shouldError
        ? { data: null, error: new Error("not found") }
        : { data: row, error: row ? null : new Error("no rows") },
    );
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

const CHANNEL_ID = "00000000-0000-0000-0000-000000000001";

describe("getChannelAiPolicy", () => {
  it("returns stored policy when row exists", async () => {
    const row: PolicyRow = {
      text_participation: "proactive",
      voice_participation: "interactive",
      auto_reminders: true,
      auto_shift_prep: true,
      auto_summarize: false,
    };
    const policy = await getChannelAiPolicy(mockSupabase(row), CHANNEL_ID);
    expect(policy.text_participation).toBe("proactive");
    expect(policy.voice_participation).toBe("interactive");
    expect(policy.auto_reminders).toBe(true);
  });

  it("returns conservative defaults when no row exists", async () => {
    const policy = await getChannelAiPolicy(mockSupabase(null), CHANNEL_ID);
    expect(policy.text_participation).toBe("mention_only");
    expect(policy.voice_participation).toBe("disabled");
    expect(policy.auto_reminders).toBe(false);
  });

  it("returns conservative defaults on query error", async () => {
    const policy = await getChannelAiPolicy(mockSupabase(null, true), CHANNEL_ID);
    expect(policy.text_participation).toBe("mention_only");
  });
});

describe("isAiAllowedInChannel — text", () => {
  const baseRow = (text: PolicyRow["text_participation"]): PolicyRow => ({
    text_participation: text,
    voice_participation: "disabled",
    auto_reminders: false,
    auto_shift_prep: false,
    auto_summarize: false,
  });

  it("disabled blocks regardless of mention", async () => {
    const sb = mockSupabase(baseRow("disabled"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", true)).toBe(false);
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", false)).toBe(false);
  });

  it("mention_only allows only when directly mentioned", async () => {
    const sb = mockSupabase(baseRow("mention_only"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", true)).toBe(true);
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", false)).toBe(false);
  });

  it("proactive always allows", async () => {
    const sb = mockSupabase(baseRow("proactive"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", true)).toBe(true);
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", false)).toBe(true);
  });

  it("falls back to mention_only default when policy missing", async () => {
    const sb = mockSupabase(null);
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", true)).toBe(true);
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "text", false)).toBe(false);
  });
});

describe("isAiAllowedInChannel — voice", () => {
  const baseRow = (voice: PolicyRow["voice_participation"]): PolicyRow => ({
    text_participation: "disabled",
    voice_participation: voice,
    auto_reminders: false,
    auto_shift_prep: false,
    auto_summarize: false,
  });

  it("disabled blocks voice", async () => {
    const sb = mockSupabase(baseRow("disabled"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "voice", true)).toBe(false);
  });

  it("listen_only blocks voice output (AI cannot speak)", async () => {
    const sb = mockSupabase(baseRow("listen_only"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "voice", true)).toBe(false);
  });

  it("interactive allows voice", async () => {
    const sb = mockSupabase(baseRow("interactive"));
    expect(await isAiAllowedInChannel(sb, CHANNEL_ID, "voice", true)).toBe(true);
  });
});
