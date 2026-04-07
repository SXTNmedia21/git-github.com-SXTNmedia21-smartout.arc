// ============================================
// journey.ts — Journey Definition Agent
// AI agent that guides users through a 6-phase wizard
// to define new journeys. Uses tools to search existing
// journeys, check for duplicates, and persist draft state.
// Connected to: packages/ai/src/tools/journey/ (tools)
// Connected to: apps/web/src/app/api/journey-agent/route.ts (API route)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { toVercelTools } from "../adapters/vercel-ai";
import { JOURNEY_TOOLS } from "../tools/journey";
import type { SmartoutTool } from "../types";
import type { JourneyToolContext } from "../tools/journey/types";
import type { ModelMessage } from "ai";

/**
 * System prompt for the Journey Definition Agent.
 *
 * Why structured phases: Each phase collects specific data fields.
 * The agent enforces completeness before advancing.
 * The draft_journey grows progressively through the 6 phases.
 */
const SYSTEM_PROMPT = `Du er Journey Agent for Smartout — en AI-assistent som hjelper med å definere nye brukerreiser (journeys).

DIN ROLLE:
Du guider brukeren gjennom 6 faser for å definiere en komplett journey. Vær grundig, still gode oppfølgingsspørsmål, og bruk verktøyene aktivt.

DE 6 FASENE:

1. DISCOVERY (Oppdagelse)
   Mål: Forstå HVA brukeren skal kunne gjøre.
   Spør om: Hva er målet? Hvem er brukeren? Når skjer dette? Hva trigger det?
   Resultat: title, trigger_description

2. CLASSIFICATION (Klassifisering)
   Mål: Kategorisere journeyen korrekt.
   Foreslå: module, actor, platform, priority, tags
   Bruk check_duplicates for å sjekke overlapp.
   Bruk lookup_journeys for å se relaterte journeys.
   Resultat: module, actor, platform, priority, tags

3. STEPS (Steg)
   Mål: Definere steg-for-steg hva som skjer.
   For hvert steg: title, action, expects, screen, component
   Vær spesifikk — hvert steg er EN brukerhandling.
   Resultat: steps array

4. TESTING (Testing)
   Mål: Definere testverdier.
   Foreslå: test_assertion (en-linjers E2E-sjekk), preconditions
   Resultat: test_assertion, preconditions

5. DOCUMENTATION (Dokumentasjon)
   Mål: Norske titler og utfall.
   Foreslå: doc_title (norsk), outcomes_success, outcomes_empty, outcomes_error
   Resultat: doc_title, outcomes_success, outcomes_empty, outcomes_error

6. REVIEW (Gjennomgang)
   Mål: Vis komplett oversikt, be om bekreftelse.
   Vis alle felter formatert. Bruk save_draft for å lagre.
   Vent på brukerens godkjenning før du sier du er ferdig.

REGLER:
- ALLTID kall save_draft etter hver fase for å lagre fremgangen
- ALLTID kall check_duplicates i Classification-fasen
- ALLTID kall lookup_journeys for å finne relaterte journeys
- Snakk norsk med brukeren, men bruk engelske verdier for tekniske felt
- Foreslå verdier proaktivt — brukeren skal bekrefte/justere, ikke fylle inn fra scratch
- Vis fase-progresjon tydelig: "Fase 2/6: Klassifisering"
- Slug genereres automatisk fra title (lowercase, kebab-case)
- Code (J-XXX) tildeles ved lagring, ikke under wizard

SMARTOUT KONTEKST:
- 18 moduler: core, onboarding, org, scheduling, operations, haccp, training, absence, payroll, communication, reports, settings, ai, season, governance, contracts, certifications, meta
- 6 aktørtyper: employee, trainee, manager, admin, owner, all
- 3 plattformer: mobile, desktop, both
- 4 prioriteter: P0 (Critical), P1 (Important), P2 (Nice to have), P3 (Future)
- En journey er "en aktør som oppnår et mål gjennom en sekvens av steg"`;

/**
 * Creates an OpenRouter model instance for the journey agent.
 */
function getModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }
  const openrouter = createOpenRouter({ apiKey });
  // Bumped from anthropic/claude-sonnet-4 → 4.6 on 2026-04-07 as part of
  // the Phase 5 council audit. Uses generateText({tools}), which per
  // ADR-0073's Phase 4 empirical finding is NOT affected by the
  // structured-output bug that broke intent-classifier.ts. Bump is for
  // model freshness + consistency, not bug-fix. See ADR-0073 audit addendum.
  return openrouter("anthropic/claude-sonnet-4.6");
}

export type JourneyAgentInput = {
  ctx: JourneyToolContext;
  userMessage: string;
  conversationHistory: ModelMessage[];
};

export type JourneyAgentResult = {
  text: string;
  phase: string;
  draftUpdated: boolean;
};

/**
 * Runs the Journey Agent for one turn.
 *
 * Why generateText (not streaming): The wizard UI shows
 * complete responses per turn. The agent may call multiple
 * tools before responding. Streaming complicates tool result handling.
 *
 * @param input - User message, conversation history, and tool context
 * @returns Agent response text, current phase, and whether draft was updated
 */
export async function runJourneyAgent(input: JourneyAgentInput): Promise<JourneyAgentResult> {
  const model = getModel();
  // JOURNEY_TOOLS uses `as const` with specific ZodObject schemas per tool.
  // toVercelTools expects SmartoutTool<TCtx> (schema defaults to base ZodType).
  // The cast is safe — toVercelTools only reads .schema and .execute from each tool.
  const tools = toVercelTools(
    JOURNEY_TOOLS as unknown as ReadonlyArray<SmartoutTool<JourneyToolContext>>,
    input.ctx,
  );

  const messages: ModelMessage[] = [
    ...input.conversationHistory,
    { role: "user", content: input.userMessage },
  ];

  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  // Check if save_draft was called to detect phase changes
  const draftUpdated = result.steps.some((step) =>
    step.toolCalls?.some((tc) => tc.toolName === "save_draft"),
  );

  return {
    text: result.text,
    phase: input.ctx.currentPhase,
    draftUpdated,
  };
}

// Re-export types used by API route
export type { ModelMessage } from "ai";
export type { JourneyToolContext } from "../tools/journey/types";
