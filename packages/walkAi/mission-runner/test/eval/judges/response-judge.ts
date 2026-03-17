// Uses OpenRouter Haiku to judge response quality
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const judgmentSchema = z.object({
  scores: z.array(
    z.object({
      criterion: z.string(),
      score: z.number().min(0).max(5),
      reasoning: z.string(),
    }),
  ),
  overall: z.number().min(0).max(5),
});

export type Judgment = z.infer<typeof judgmentSchema>;

export async function judgeResponse(params: {
  message: string;
  response: string;
  criteria: string[];
}): Promise<Judgment> {
  const { object } = await generateObject({
    model: openrouter("anthropic/claude-haiku-3"),
    schema: judgmentSchema,
    system: `You are an eval judge for an AI employee assistant called Mr. Botsson.
Score each criterion 0-5: 0=completely wrong, 3=acceptable, 5=excellent.
Be strict but fair. Provide brief reasoning for each score.`,
    prompt: `User message: "${params.message}"

AI response: "${params.response}"

Score these criteria:
${params.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
  });

  return object;
}
