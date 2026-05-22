import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTextMock = vi.fn();
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => generateTextMock(...a) }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => (model: string) => ({ model }),
}));
// heic-convert is only invoked for HEIC bytes; mock so the wasm module never loads.
vi.mock("heic-convert", () => ({ default: vi.fn() }));

// extractRoutineFromImage now downloads the image — mock fetch to return a tiny
// JPEG (magic bytes FF D8 FF) with an image/jpeg content-type.
beforeEach(() => {
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "image/jpeg" },
      arrayBuffer: async () => jpegBytes.buffer,
    }),
  );
});
// Mock secrets so supabase/config env-validation is never reached
vi.mock("../../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-openrouter-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
  }),
}));

import { extractRoutineFromImage } from "../routine-extract.js";

const DRAFT = {
  routine_name: "Åpningsrutine",
  trigger_guess: { trigger_type: "scheduled", trigger_config: { times: ["07:00"] } },
  location_hint: "Bar",
  steps: [
    { title: "Lås opp", description: "Åpne dør", is_required: true, estimated_minutes: null },
  ],
};

describe("extractRoutineFromImage", () => {
  beforeEach(() => generateTextMock.mockReset());

  it("parses plain-JSON text from the vision model into a validated draft", async () => {
    generateTextMock.mockResolvedValue({ text: JSON.stringify(DRAFT) });
    const draft = await extractRoutineFromImage("https://signed.example/img.jpg");
    expect(draft.routine_name).toBe("Åpningsrutine");
    expect(draft.steps).toHaveLength(1);
    // image content block is sent to the model
    const arg = generateTextMock.mock.calls[0]![0] as { messages: { content: unknown[] }[] };
    const hasImage = arg.messages[0]!.content.some((c) => (c as { type: string }).type === "image");
    expect(hasImage).toBe(true);
  });

  it("strips ```json fences before parsing", async () => {
    generateTextMock.mockResolvedValue({ text: "```json\n" + JSON.stringify(DRAFT) + "\n```" });
    const draft = await extractRoutineFromImage("https://signed.example/img.jpg");
    expect(draft.steps[0]!.title).toBe("Lås opp");
  });
});
