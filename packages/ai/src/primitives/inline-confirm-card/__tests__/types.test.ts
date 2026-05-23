/**
 * Unit tests for InlineConfirmCardDescriptor Zod schemas and helpers.
 *
 * Per T1 spec (ADR-0398): minimum 6 tests covering:
 *   1. valid descriptor parses
 *   2. invalid type discriminator rejected
 *   3. invalid proposal_id (non-UUID) rejected
 *   4. invalid surface enum value rejected
 *   5. actions array with only cancel rejects (min=2)
 *   6. isInlineConfirmCard: true for valid, false for `kind:"inline_confirm_card"` (wrong field name)
 *
 * Additional tests cover channel-guard and builder helpers.
 */

import { describe, it, expect } from "vitest";
import {
  InlineConfirmCardDescriptorSchema,
  InlineConfirmCardResultSchema,
  isInlineConfirmCard,
  buildInlineConfirmCard,
} from "../types.js";
import {
  checkInlineConfirmCardChannelGuard,
  formatInlineConfirmCardChannelRejection,
} from "../channel-guard.js";

// ── Shared fixtures ──────────────────────────────────────────────────────────

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const VALID_DESCRIPTOR = {
  type: "inline_confirm_card" as const,
  proposal_id: VALID_UUID,
  surface: "announcement" as const,
  draft: { title: "Test kunngjøring", body: "Innhold her." },
  preview: {
    title: "Publiser kunngjøring",
    body_excerpt: "Innhold her.",
    recipient_count: 12,
    metadata: [{ label: "Avdeling", value: "Kjøkken" }],
  },
  actions: [
    { id: "confirm" as const, label: "Bekreft", variant: "primary" as const },
    { id: "cancel" as const, label: "Avbryt", variant: "destructive" as const },
  ],
  channel_constraint: ["chat"] as ["chat"],
  platforms: ["web"] as ["web"],
};

// ── Test 1: valid descriptor parses ─────────────────────────────────────────

describe("InlineConfirmCardDescriptorSchema", () => {
  it("parses a fully-valid descriptor without errors", () => {
    const result = InlineConfirmCardDescriptorSchema.safeParse(VALID_DESCRIPTOR);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("inline_confirm_card");
      expect(result.data.proposal_id).toBe(VALID_UUID);
      expect(result.data.surface).toBe("announcement");
      expect(result.data.actions).toHaveLength(2);
      expect(result.data.preview.metadata).toHaveLength(1);
    }
  });

  it("applies Zod defaults: channel_constraint and platforms when omitted", () => {
    const input = { ...VALID_DESCRIPTOR };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (input as any).channel_constraint;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (input as any).platforms;
    const result = InlineConfirmCardDescriptorSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel_constraint).toEqual(["chat", "voice"]);
      expect(result.data.platforms).toEqual(["web", "mobile"]);
    }
  });

  it("applies Zod defaults: preview.metadata defaults to empty array", () => {
    const input = {
      ...VALID_DESCRIPTOR,
      preview: { title: "Tittel" }, // no metadata field
    };
    const result = InlineConfirmCardDescriptorSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preview.metadata).toEqual([]);
    }
  });

  // ── Test 2: invalid type discriminator rejected ──────────────────────────

  it("rejects when type is 'proposal' instead of 'inline_confirm_card'", () => {
    const bad = { ...VALID_DESCRIPTOR, type: "proposal" };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects when type field is missing entirely", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bad = { ...VALID_DESCRIPTOR } as any;
    delete bad.type;
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  // ── Test 3: invalid proposal_id (non-UUID) rejected ─────────────────────

  it("rejects when proposal_id is not a valid UUID", () => {
    const bad = { ...VALID_DESCRIPTOR, proposal_id: "not-a-uuid" };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects when proposal_id is an empty string", () => {
    const bad = { ...VALID_DESCRIPTOR, proposal_id: "" };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  // ── Test 4: invalid surface enum value rejected ──────────────────────────

  it("rejects when surface is an unknown enum value", () => {
    const bad = { ...VALID_DESCRIPTOR, surface: "invoice_approve" };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  // ── Test 5: actions array with only cancel rejects (min=2) ───────────────

  it("rejects when actions array has only one item (cancel-only violates min=2)", () => {
    const bad = {
      ...VALID_DESCRIPTOR,
      actions: [{ id: "cancel", label: "Avbryt", variant: "destructive" }],
    };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects when actions array has 4 items (exceeds max=3)", () => {
    const bad = {
      ...VALID_DESCRIPTOR,
      actions: [
        { id: "confirm", label: "Bekreft", variant: "primary" },
        { id: "edit", label: "Endre", variant: "ghost", editable_fields: ["body"] },
        { id: "cancel", label: "Avbryt", variant: "destructive" },
        { id: "cancel", label: "Avbryt igjen", variant: "destructive" },
      ],
    };
    const result = InlineConfirmCardDescriptorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  // ── Test 6: isInlineConfirmCard — type vs kind discriminator ─────────────

  it("isInlineConfirmCard returns true for a valid descriptor", () => {
    expect(isInlineConfirmCard(VALID_DESCRIPTOR)).toBe(true);
  });

  it("isInlineConfirmCard returns false when discriminator is `kind` instead of `type`", () => {
    const bad = {
      kind: "inline_confirm_card", // WRONG field name — must be `type`
      proposal_id: VALID_UUID,
      surface: "announcement",
      draft: {},
      preview: { title: "Test" },
      actions: [
        { id: "confirm", label: "Bekreft", variant: "primary" },
        { id: "cancel", label: "Avbryt", variant: "destructive" },
      ],
    };
    expect(isInlineConfirmCard(bad)).toBe(false);
  });

  it("isInlineConfirmCard returns false for a plain string", () => {
    expect(isInlineConfirmCard("inline_confirm_card")).toBe(false);
  });

  it("isInlineConfirmCard returns false for null", () => {
    expect(isInlineConfirmCard(null)).toBe(false);
  });
});

// ── InlineConfirmCardResultSchema ────────────────────────────────────────────

describe("InlineConfirmCardResultSchema", () => {
  it("parses a confirm result", () => {
    const result = InlineConfirmCardResultSchema.safeParse({
      proposal_id: VALID_UUID,
      action: "confirm",
    });
    expect(result.success).toBe(true);
  });

  it("parses an edit result with patch", () => {
    const result = InlineConfirmCardResultSchema.safeParse({
      proposal_id: VALID_UUID,
      action: "edit",
      patch: { body: "Updated body." },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.patch).toEqual({ body: "Updated body." });
    }
  });

  it("rejects an unknown action value", () => {
    const result = InlineConfirmCardResultSchema.safeParse({
      proposal_id: VALID_UUID,
      action: "approve", // not in enum
    });
    expect(result.success).toBe(false);
  });
});

// ── buildInlineConfirmCard builder ───────────────────────────────────────────

describe("buildInlineConfirmCard", () => {
  it("builds a valid descriptor and applies defaults", () => {
    const descriptor = buildInlineConfirmCard({
      proposal_id: VALID_UUID,
      surface: "announcement",
      draft: { title: "Test" },
      preview: { title: "Publiser" },
      actions: [
        { id: "confirm", label: "Bekreft", variant: "primary" },
        { id: "cancel", label: "Avbryt", variant: "destructive" },
      ],
    });
    expect(descriptor.type).toBe("inline_confirm_card");
    expect(descriptor.channel_constraint).toEqual(["chat", "voice"]);
    expect(descriptor.platforms).toEqual(["web", "mobile"]);
    expect(descriptor.preview.metadata).toEqual([]);
  });

  it("respects explicit channel_constraint override", () => {
    const descriptor = buildInlineConfirmCard({
      proposal_id: VALID_UUID,
      surface: "announcement",
      draft: {},
      preview: { title: "Test" },
      actions: [
        { id: "confirm", label: "Bekreft", variant: "primary" },
        { id: "cancel", label: "Avbryt", variant: "destructive" },
      ],
      channel_constraint: ["chat"],
      platforms: ["web"],
    });
    expect(descriptor.channel_constraint).toEqual(["chat"]);
    expect(descriptor.platforms).toEqual(["web"]);
  });

  it("throws when given an invalid UUID (Zod parse error surfaces at build time)", () => {
    expect(() =>
      buildInlineConfirmCard({
        proposal_id: "bad-id",
        surface: "announcement",
        draft: {},
        preview: { title: "Test" },
        actions: [
          { id: "confirm", label: "Bekreft", variant: "primary" },
          { id: "cancel", label: "Avbryt", variant: "destructive" },
        ],
      }),
    ).toThrow();
  });
});

// ── checkInlineConfirmCardChannelGuard ───────────────────────────────────────

describe("checkInlineConfirmCardChannelGuard", () => {
  const chatOnlyDescriptor: ReturnType<typeof InlineConfirmCardDescriptorSchema.parse> =
    InlineConfirmCardDescriptorSchema.parse({
      ...VALID_DESCRIPTOR,
      channel_constraint: ["chat"],
    });

  const unrestrictedDescriptor: ReturnType<typeof InlineConfirmCardDescriptorSchema.parse> =
    InlineConfirmCardDescriptorSchema.parse({
      ...VALID_DESCRIPTOR,
      channel_constraint: ["chat", "voice"],
    });

  it("allows chat when channel_constraint includes chat", () => {
    const result = checkInlineConfirmCardChannelGuard(chatOnlyDescriptor, "chat");
    expect(result.allowed).toBe(true);
  });

  it("blocks voice when channel_constraint is chat-only", () => {
    const result = checkInlineConfirmCardChannelGuard(chatOnlyDescriptor, "voice");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("voice");
      expect(result.reason).toContain("chat");
      // Should suggest chat as fallback
      expect(result.suggested_channel).toBe("chat");
    }
  });

  it("allows voice when channel_constraint includes voice", () => {
    const result = checkInlineConfirmCardChannelGuard(unrestrictedDescriptor, "voice");
    expect(result.allowed).toBe(true);
  });

  it("formats a rejection string using voice_prompt when present", () => {
    const withPrompt = InlineConfirmCardDescriptorSchema.parse({
      ...VALID_DESCRIPTOR,
      channel_constraint: ["chat"],
      voice_prompt: "Du har et forslag. Åpne chatten for å bekrefte.",
    });
    const rejection = formatInlineConfirmCardChannelRejection(withPrompt);
    expect(rejection).toContain("[inline_confirm_card_rejected]");
    expect(rejection).toContain("Du har et forslag");
  });

  it("formats a generic rejection string when voice_prompt is absent", () => {
    const rejection = formatInlineConfirmCardChannelRejection(chatOnlyDescriptor);
    expect(rejection).toContain("[inline_confirm_card_rejected]");
    expect(rejection).toContain("chat");
  });
});
