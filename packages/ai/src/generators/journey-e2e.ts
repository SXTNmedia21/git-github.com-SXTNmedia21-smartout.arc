// ============================================
// journey-e2e.ts — E2E Test Generator
// Transforms a journey definition into a Playwright test
// skeleton with describe blocks, test cases, and assertions
// derived from the journey steps and test_assertion field.
// Connected to: JourneyWithSteps type
// ============================================

import type { Journey, JourneyStep } from "@smartout/types";

/**
 * Generates a Playwright E2E test skeleton from a journey definition.
 *
 * Why a skeleton: Full test implementation needs app-specific selectors
 * and seed data. The skeleton provides structure, setup/teardown,
 * and assertion comments that developers fill in.
 *
 * @param journey - The journey record
 * @param steps - Ordered journey steps
 * @returns Playwright test code as a string
 */
export function generateE2ETest(journey: Journey, steps: JourneyStep[]): string {
  const lines: string[] = [];

  lines.push(`import { test, expect } from "@playwright/test";`);
  lines.push(``);
  lines.push(`test.describe("${journey.code}: ${journey.title}", () => {`);
  lines.push(`  test.beforeEach(async ({ page }) => {`);
  lines.push(`    // Seed: ${journey.actor} with active profile`);

  if (journey.preconditions.length > 0) {
    journey.preconditions.forEach((pre) => {
      lines.push(`    // Precondition: ${pre}`);
    });
  }

  lines.push(`    // Login as ${journey.actor}`);
  lines.push(`  });`);
  lines.push(``);

  // Main happy path test
  lines.push(`  test("completes full journey", async ({ page }) => {`);

  steps.forEach((step) => {
    lines.push(`    // Step ${step.step_order}: ${step.title}`);
    lines.push(`    // Action: ${step.action}`);

    if (step.screen) {
      lines.push(`    // Screen: ${step.screen}`);
    }

    if (step.expects) {
      lines.push(`    // Expects: ${step.expects}`);
    }

    lines.push(``);
  });

  if (journey.test_assertion) {
    lines.push(`    // Final assertion: ${journey.test_assertion}`);
  }

  lines.push(`  });`);
  lines.push(`});`);

  return lines.join("\n");
}
