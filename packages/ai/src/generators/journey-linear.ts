// ============================================
// journey-linear.ts — Linear Issue Generator
// Transforms a journey definition into a markdown spec
// suitable for creating a Linear issue with acceptance criteria.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Linear issue spec markdown from a journey.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Markdown for a Linear issue description
 */
export function generateLinearSpec(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  lines.push(`## ${journey.code}: ${journey.title}`);
  lines.push(``);
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Module | ${journey.module} |`);
  lines.push(`| Actor | ${journey.actor} |`);
  lines.push(`| Platform | ${journey.platform} |`);
  lines.push(`| Priority | ${journey.priority} |`);

  if (journey.tags.length > 0) {
    lines.push(`| Tags | ${journey.tags.join(", ")} |`);
  }

  lines.push(``);

  if (journey.trigger_description) {
    lines.push(`### Trigger`);
    lines.push(``);
    lines.push(journey.trigger_description);
    lines.push(``);
  }

  if (journey.preconditions.length > 0) {
    lines.push(`### Preconditions`);
    lines.push(``);
    journey.preconditions.forEach((pre) => {
      lines.push(`- [ ] ${pre}`);
    });
    lines.push(``);
  }

  lines.push(`### Steps`);
  lines.push(``);

  steps.forEach((step) => {
    lines.push(`**Step ${step.step_order}: ${step.title}**`);
    lines.push(`- Action: ${step.action}`);

    if (step.expects) {
      lines.push(`- Expects: ${step.expects}`);
    }

    if (step.screen) {
      lines.push(`- Screen: \`${step.screen}\``);
    }

    if (step.component) {
      lines.push(`- Component: \`${step.component}\``);
    }

    lines.push(``);
  });

  lines.push(`### Acceptance Criteria`);
  lines.push(``);

  if (journey.test_assertion) {
    lines.push(`- [ ] ${journey.test_assertion}`);
  }

  if (journey.outcomes_success) {
    lines.push(`- [ ] Success: ${journey.outcomes_success}`);
  }

  if (journey.outcomes_empty) {
    lines.push(`- [ ] Empty state: ${journey.outcomes_empty}`);
  }

  if (journey.outcomes_error) {
    lines.push(`- [ ] Error handling: ${journey.outcomes_error}`);
  }

  steps.forEach((step) => {
    if (step.expects) {
      lines.push(`- [ ] Step ${step.step_order}: ${step.expects}`);
    }
  });

  return lines.join("\n");
}
