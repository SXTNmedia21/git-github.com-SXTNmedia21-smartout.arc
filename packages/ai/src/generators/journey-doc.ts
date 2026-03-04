// ============================================
// journey-doc.ts — Onboarding Doc Generator
// Transforms a journey definition into a Norwegian
// markdown onboarding guide for employees.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Norwegian onboarding documentation page
 * from a journey definition.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Markdown string in Norwegian
 */
export function generateOnboardingDoc(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  const title = journey.doc_title ?? journey.title;
  lines.push(`# ${title}`);
  lines.push(``);
  lines.push(`> Denne guiden viser deg hvordan du ${journey.title.toLowerCase()}.`);
  lines.push(``);

  if (journey.trigger_description) {
    lines.push(`## Når bruker du dette?`);
    lines.push(``);
    lines.push(journey.trigger_description);
    lines.push(``);
  }

  if (journey.preconditions.length > 0) {
    lines.push(`## Før du begynner`);
    lines.push(``);
    journey.preconditions.forEach((pre) => {
      lines.push(`- ${pre}`);
    });
    lines.push(``);
  }

  lines.push(`## Steg for steg`);
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`### ${step.step_order}. ${step.title}`);
    lines.push(``);
    lines.push(step.action);
    lines.push(``);

    if (step.expects) {
      lines.push(`**Forventet resultat:** ${step.expects}`);
      lines.push(``);
    }
  });

  if (journey.outcomes_success) {
    lines.push(`## Ferdig!`);
    lines.push(``);
    lines.push(journey.outcomes_success);
    lines.push(``);
  }

  if (journey.outcomes_error) {
    lines.push(`## Problemer?`);
    lines.push(``);
    lines.push(journey.outcomes_error);
    lines.push(``);
  }

  return lines.join("\n");
}
