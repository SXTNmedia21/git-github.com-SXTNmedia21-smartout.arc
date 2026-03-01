// ============================================
// journey-botsson.ts — Mr. Botsson Script Generator
// Transforms a journey definition into a voice/chat
// walkthrough script for the Mr. Botsson AI assistant.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Mr. Botsson voice walkthrough script.
 * Written in Norwegian as that's the target language
 * for the AI assistant.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Botsson script as a string
 */
export function generateBotssonScript(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  const title = journey.doc_title ?? journey.title;

  lines.push(`# Mr. Botsson — ${title}`);
  lines.push(`# Journey: ${journey.code}`);
  lines.push(`# Trigger: Bruker ber om hjelp med "${journey.title.toLowerCase()}"`);
  lines.push(``);
  lines.push(`## Intro`);
  lines.push(``);
  lines.push(
    `"Hei! Jeg skal hjelpe deg med å ${journey.title.toLowerCase()}. La meg guide deg gjennom det steg for steg."`,
  );
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`## Steg ${step.step_order}: ${step.title}`);
    lines.push(``);
    lines.push(`[Instruks til Botsson: Guide brukeren gjennom dette steget]`);
    lines.push(``);
    lines.push(`"Nå skal du ${step.action.toLowerCase()}."`);
    lines.push(``);

    if (step.expects) {
      lines.push(`[Vent på bekreftelse]`);
      lines.push(`"Bra! Du bør nå se: ${step.expects}"`);
      lines.push(``);
    }
  });

  lines.push(`## Avslutning`);
  lines.push(``);

  if (journey.outcomes_success) {
    lines.push(`"Gratulerer! ${journey.outcomes_success}"`);
  } else {
    lines.push(`"Flott, du er ferdig! Er det noe annet jeg kan hjelpe deg med?"`);
  }

  return lines.join("\n");
}
