import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelMessage } from "ai";
export type { ModelMessage };

export type DocsKnowledgeDoc = {
  title: string;
  href: string;
  content: string;
};

export type DocsAgentInput = {
  question: string;
  conversationHistory?: ModelMessage[];
  knowledge: DocsKnowledgeDoc[];
};

export type DocsAgentResult = {
  answer: string;
};

const SYSTEM_PROMPT = `You are LISA, Smartout Documentation Agent.
You answer questions ONLY from the provided Smartout documentation context.

Rules:
1) Be concise, practical, and operational.
2) If context is missing, say exactly what is missing.
3) Prefer step-by-step guidance for setup/operations questions.
4) End every response with "Sources:" and list relevant documentation paths from context.
5) Never invent features not present in the provided context.
`;

function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  const openrouter = createOpenRouter({ apiKey });
  return openrouter("anthropic/claude-sonnet-4");
}

function buildKnowledgeBlock(knowledge: DocsKnowledgeDoc[]) {
  if (knowledge.length === 0) return "No documentation context provided.";
  return knowledge
    .map((doc) => `# ${doc.title}\nPath: ${doc.href}\n\n${doc.content}`)
    .join("\n\n---\n\n");
}

export async function runDocsAgent({
  question,
  conversationHistory = [],
  knowledge,
}: DocsAgentInput): Promise<DocsAgentResult> {
  const knowledgeContext = buildKnowledgeBlock(knowledge);

  const messages: ModelMessage[] = [
    ...conversationHistory,
    {
      role: "user",
      content: `Question: ${question}\n\nDocumentation context:\n${knowledgeContext}`,
    },
  ];

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
  });

  return { answer: result.text };
}
