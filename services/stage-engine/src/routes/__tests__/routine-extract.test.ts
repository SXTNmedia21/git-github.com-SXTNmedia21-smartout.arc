import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObjectMock = vi.fn();
vi.mock("ai", () => ({ generateObject: (...a: unknown[]) => generateObjectMock(...a) }));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: () => (model: string) => ({ model }),
}));
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

describe("extractRoutineFromImage", () => {
  beforeEach(() => generateObjectMock.mockReset());

  it("returns the validated draft from the vision model", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        routine_name: "Åpningsrutine",
        trigger_guess: { trigger_type: "scheduled", trigger_config: { times: ["07:00"] } },
        location_hint: "Bar",
        steps: [
          { title: "Lås opp", description: "Åpne dør", is_required: true, estimated_minutes: null },
        ],
      },
    });
    const draft = await extractRoutineFromImage("https://signed.example/img.jpg");
    expect(draft.routine_name).toBe("Åpningsrutine");
    expect(draft.steps).toHaveLength(1);
    const arg = generateObjectMock.mock.calls[0]![0] as { messages: { content: unknown[] }[] };
    const hasImage = arg.messages[0]!.content.some((c) => (c as { type: string }).type === "image");
    expect(hasImage).toBe(true);
  });
});
