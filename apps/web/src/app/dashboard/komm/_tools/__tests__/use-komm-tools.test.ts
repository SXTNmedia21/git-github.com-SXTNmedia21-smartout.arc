/**
 * use-komm-tools.test.ts
 *
 * Unit tests for the pure executor builder `buildKommImplementations`.
 * Vitest runs in node — no DOM / no @testing-library/react. The hook
 * itself is a thin ref + memo wrapper; all branchable logic lives in
 * the builder, which is exported specifically so tests can stay in
 * the fast node lane.
 *
 * Coverage focus:
 *   - createChat (1-1 DM): voice guard, missing-profile guard, delegate
 *     called with the right shape, success path returns ok=true with
 *     channel_id.
 *   - sendMessage: voice guard, empty-content guard, no-active-channel
 *     guard, delegate shape.
 *   - joinCall: missing-channel guard, delegate-called.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildKommImplementations,
  type KommActionResult,
  type KommToolInput,
} from "../use-komm-tools";

function makeInput(overrides: Partial<KommToolInput> = {}): KommToolInput {
  return {
    surface: "channels",
    channelGroups: [],
    activeChannelId: null,
    activeChannelMessages: [],
    unreadCounts: [],
    myHelpdeskCount: 0,
    sessionChannel: "chat",
    onSendMessage: vi.fn(async (): Promise<KommActionResult> => ({ ok: true, message_id: "m-1" })),
    onCreateChat: vi.fn(
      async (): Promise<KommActionResult> => ({
        ok: true,
        channel_id: "ch-new",
        created: true,
      }),
    ),
    onJoinCall: vi.fn(async (): Promise<KommActionResult> => ({ ok: true })),
    ...overrides,
  };
}

describe("buildKommImplementations — createChat (1-1 DM)", () => {
  let input: KommToolInput;
  let impl: ReturnType<typeof buildKommImplementations>;

  beforeEach(() => {
    input = makeInput();
    impl = buildKommImplementations(() => input);
  });

  it("rejects on voice session before delegating (ADR-0078)", async () => {
    input = makeInput({ sessionChannel: "voice" });
    impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.createChat!({ otherProfileId: "prof-2" })) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("voice");
    expect(input.onCreateChat).not.toHaveBeenCalled();
  });

  it("rejects when otherProfileId is missing", async () => {
    const out = JSON.parse((await impl.createChat!({})) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("otherProfileId");
    expect(input.onCreateChat).not.toHaveBeenCalled();
  });

  it("rejects when otherProfileId is empty after trim", async () => {
    const out = JSON.parse((await impl.createChat!({ otherProfileId: "  " })) as string);

    expect(out.ok).toBe(false);
    expect(input.onCreateChat).not.toHaveBeenCalled();
  });

  it("delegates with trimmed otherProfileId + optional name", async () => {
    await impl.createChat!({ otherProfileId: "  prof-2  ", name: "Anna" });

    expect(input.onCreateChat).toHaveBeenCalledWith({
      otherProfileId: "prof-2",
      name: "Anna",
    });
  });

  it("returns ok=true with channel_id from delegate on success (DM created)", async () => {
    const out = JSON.parse((await impl.createChat!({ otherProfileId: "prof-2" })) as string);

    expect(out.ok).toBe(true);
    expect(out.channel_id).toBe("ch-new");
    expect(out.created).toBe(true);
  });

  it("returns existing channel when delegate signals dedupe (created=false)", async () => {
    input = makeInput({
      onCreateChat: vi.fn(
        async (): Promise<KommActionResult> => ({
          ok: true,
          channel_id: "ch-existing",
          created: false,
        }),
      ),
    });
    impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.createChat!({ otherProfileId: "prof-2" })) as string);

    expect(out.ok).toBe(true);
    expect(out.channel_id).toBe("ch-existing");
    expect(out.created).toBe(false);
  });

  it("propagates delegate failure as ok=false with reason", async () => {
    input = makeInput({
      onCreateChat: vi.fn(
        async (): Promise<KommActionResult> => ({
          ok: false,
          reason: "Ikke autorisert",
        }),
      ),
    });
    impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.createChat!({ otherProfileId: "prof-2" })) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toBe("Ikke autorisert");
  });
});

describe("buildKommImplementations — sendMessage", () => {
  let input: KommToolInput;
  let impl: ReturnType<typeof buildKommImplementations>;

  beforeEach(() => {
    input = makeInput({ activeChannelId: "ch-1" });
    impl = buildKommImplementations(() => input);
  });

  it("rejects on voice session before delegating (ADR-0078)", async () => {
    input = makeInput({ sessionChannel: "voice", activeChannelId: "ch-1" });
    impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.sendMessage!({ content: "hei" })) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("voice");
    expect(input.onSendMessage).not.toHaveBeenCalled();
  });

  it("rejects on empty content", async () => {
    const out = JSON.parse((await impl.sendMessage!({ content: "  " })) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Tom melding");
    expect(input.onSendMessage).not.toHaveBeenCalled();
  });

  it("rejects when no active channel", async () => {
    input = makeInput({ activeChannelId: null });
    impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.sendMessage!({ content: "hei" })) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Ingen kanal");
    expect(input.onSendMessage).not.toHaveBeenCalled();
  });

  it("delegates with trimmed content + optional replyToId", async () => {
    await impl.sendMessage!({ content: "  hei  ", replyToId: "m-99" });

    expect(input.onSendMessage).toHaveBeenCalledWith({
      content: "hei",
      replyToId: "m-99",
    });
  });

  it("returns ok=true with message_id on success", async () => {
    const out = JSON.parse((await impl.sendMessage!({ content: "hei" })) as string);

    expect(out.ok).toBe(true);
    expect(out.message_id).toBe("m-1");
  });
});

describe("buildKommImplementations — joinCall", () => {
  it("rejects when no channelId and no active channel", async () => {
    const input = makeInput();
    const impl = buildKommImplementations(() => input);

    const out = JSON.parse((await impl.joinCall!({})) as string);

    expect(out.ok).toBe(false);
    expect(out.reason).toContain("Ingen kanal");
    expect(input.onJoinCall).not.toHaveBeenCalled();
  });

  it("uses explicit channelId when provided", async () => {
    const input = makeInput();
    const impl = buildKommImplementations(() => input);

    await impl.joinCall!({ channelId: "ch-99", withVideo: true });

    expect(input.onJoinCall).toHaveBeenCalledWith({
      channelId: "ch-99",
      withVideo: true,
    });
  });

  it("falls back to activeChannelId when channelId omitted", async () => {
    const input = makeInput({ activeChannelId: "ch-active" });
    const impl = buildKommImplementations(() => input);

    await impl.joinCall!({});

    expect(input.onJoinCall).toHaveBeenCalledWith({
      channelId: "ch-active",
      withVideo: false,
    });
  });
});
