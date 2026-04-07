// ============================================
// reports.ts
// AI agent for building custom workspace reports.
// Mr. Botsson guides users through a step-by-step wizard:
// choose data source → pick metrics → set grouping → add filters →
// choose visualization → preview → save.
// Connected to: packages/ai/src/tools/report/ (5 report tools)
// Connected to: apps/web/src/app/api/reports-agent/route.ts (API endpoint)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { REPORT_TOOLS } from "../tools/report";
import type { SmartoutTool } from "../types";
import type { ReportToolContext } from "../tools/report/types";
import type { ModelMessage } from "ai";

/**
 * System prompt for the report builder assistant.
 * Norwegian language, Mr. Botsson personality.
 * Embeds the step-by-step wizard flow.
 */
const SYSTEM_PROMPT = `Du er rapportassistenten i Smartout — en norsk SaaS-plattform for
serveringsbransjen. Du hjelper administratorer og ledere å bygge
tilpassede rapporter basert på workspace-data.

PERSONLIGHET:
- Vennlig og strukturert
- Guider steg for steg — aldri overveldende
- Forklarer hva hvert valg betyr
- Bruker verktøyene aktivt — ikke bare foreslå, GJØR det

RAPPORTVEIVISEREN (følg disse stegene i rekkefølge):

1. DATAKILDE — Spør hva brukeren vil rapportere på.
   Bruk list_data_sources for å vise alternativene.
   Eksempler: "Medarbeidere", "Protokoll-tildelinger", "Avdelinger"

2. METRIKKER — Spør hvilke tall/nøkkeltall som er viktige.
   Foreslå basert på datakilden (f.eks. "Antall ansatte per rolle").
   Støttede aggregeringer: count, count_distinct, percentage, avg, sum, min, max

3. GRUPPERING — Spør hvordan data skal grupperes.
   Eksempler: "Per avdeling", "Per rolle", "Per status"
   Kan hoppes over for enkle tellinger.

4. FILTRE — Spør om data skal avgrenses.
   Eksempler: "Kun aktive ansatte", "Bare en bestemt avdeling"
   Kan hoppes over.

5. VISUALISERING — Spør hvordan rapporten skal vises.
   Alternativer: tabell, stolpediagram, kakediagram, KPI-kort
   Foreslå basert på datatype.

6. FORHÅNDSVISNING — Kjør preview_report og vis resultatene.
   La brukeren vurdere om dataen ser riktig ut.

7. LAGRING — Spør om et navn og lagre med save_report.
   Bekreft at rapporten er lagret.

REGLER:
- Alltid bruk list_data_sources først når brukeren starter en ny rapport
- Alltid kjør preview_report FØR save_report
- Ikke hopp over steg uten å spørre brukeren
- Hvis brukeren ber om å se eksisterende rapporter, bruk list_saved_reports
- Hvis brukeren ber om å slette en rapport, bekreft FØR du bruker delete_report
- Hold svarene korte og strukturerte — bruk punktlister
- Svar alltid på norsk`;

/**
 * Creates the OpenRouter model instance for the reports agent.
 * Uses Claude Sonnet via OpenRouter.
 */
function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local (runtime/server, development env).",
    );
  }
  const openrouter = createOpenRouter({ apiKey });
  // Bumped from anthropic/claude-sonnet-4 → 4.6 on 2026-04-07 as part of
  // the Phase 5 council audit. Uses generateText({tools}), which per
  // ADR-0073's Phase 4 empirical finding is NOT affected by the
  // structured-output bug that broke intent-classifier.ts. Bump is for
  // model freshness + consistency, not bug-fix. See ADR-0073 audit addendum.
  return openrouter("anthropic/claude-sonnet-4.6");
}

export type ReportsAgentInput = {
  ctx: ReportToolContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type ReportsAgentResult = {
  text: string;
  reportData: unknown | null;
  savedReport: unknown | null;
};

/**
 * Run the reports AI agent.
 * Takes a user message, conversation history, and workspace context.
 * Returns text response plus any report data or saved report info.
 */
export async function runReportsAgent({
  ctx,
  userMessage,
  conversationHistory,
}: ReportsAgentInput): Promise<ReportsAgentResult> {
  // REPORT_TOOLS uses `as const` — same cast pattern as contract agent
  const tools = toVercelTools(
    REPORT_TOOLS as unknown as ReadonlyArray<SmartoutTool<ReportToolContext>>,
    ctx,
  );

  const messages: ModelMessage[] = [...conversationHistory, { role: "user", content: userMessage }];

  const result = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(10),
  });

  // Extract report data and saved report from tool results
  let reportData: unknown | null = null;
  let savedReport: unknown | null = null;

  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      try {
        const resultObj = toolResult as unknown as Record<string, unknown>;
        const resultStr = (resultObj.result ?? resultObj.output ?? "") as string;
        if (typeof resultStr === "string" && resultStr.startsWith("{")) {
          const parsed = JSON.parse(resultStr) as Record<string, unknown>;
          // preview_report returns summary + totals
          if (parsed.summary !== undefined) {
            reportData = parsed;
          }
          // save_report returns saved: true
          if (parsed.saved === true) {
            savedReport = parsed;
          }
        }
      } catch {
        // Not all tool results are JSON
      }
    }
  }

  return {
    text: result.text,
    reportData,
    savedReport,
  };
}

/** Re-export for convenience */
export type { ModelMessage };
export type { ReportToolContext } from "../tools/report/types";
