// apps/journey-control/src/lib/__tests__/journey-compiler.test.ts
import { describe, it, expect, vi } from "vitest";
import { compileMarkdownToIR } from "../journey-compiler";

// Mock openai — OpenRouter provider uses OpenAI SDK.
// L-0202: system field must be messages[0] role:system on OpenRouter compat.
// Vitest v4 requires class-based constructor mocks (arrow functions are not constructors).
const mockCreate = vi.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          version: "2.0.0",
          slug: "P-MOCK",
          title: "Mock Journey",
          module: "test",
          steps: [
            {
              key: "1_navigate",
              order: 1,
              title: "Navigate",
              action: "Open root",
              assertion: "URL is /",
              actions: [{ type: "navigate", url: "/" }],
              gate: { type: "url_match", pattern: "/" },
            },
          ],
        }),
      },
    },
  ],
});

vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
  }
  return { default: MockOpenAI };
});

describe("compileMarkdownToIR", () => {
  it("returns valid JourneyIR from mock LLM response", async () => {
    const result = await compileMarkdownToIR({
      markdown: "# Test Journey\n\nNavigate to root.",
      apiKey: "sk-mock",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ir.version).toBe("2.0.0");
      expect(result.ir.slug).toBe("P-MOCK");
      expect(result.ir.steps.length).toBe(1);
    }
  });
});
