/**
 * guide-mdx.test.ts — Unit tests for the JourneyIR → USER-GUIDE MDX transform.
 *
 * Tests the pure helper `generateGuideMdx` in isolation — no DB, no Supabase,
 * no telemetry mocks needed. This is the correct level for a deterministic
 * content-generation function.
 *
 * Binding:
 *   - ADR-0217 (MDX structure contract — H1, blockquote, H2 steps, checklist)
 *   - L-0125 (test spirit: assert content, not just no-throw)
 */

import { describe, it, expect } from "vitest";
import { generateGuideMdx } from "../guide-mdx.js";
import type { JourneyIRForGuide } from "@smartout/journey-ir";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function twoStepIr(overrides?: Partial<JourneyIRForGuide>): JourneyIRForGuide {
  return {
    version: "2.0.0",
    slug: "test-journey",
    title: "Test Journey",
    module: "onboarding",
    steps: [
      {
        key: "step-one",
        title: "Open the form",
        action: "Click the New button in the toolbar",
        assertion: "A modal dialog appears with an empty form",
        description: "Navigate to the form by clicking the New button.",
      },
      {
        key: "step-two",
        title: "Submit the form",
        action: "Fill all required fields and click Submit",
        assertion: "The form closes and a success banner appears",
        description: "Complete all fields and submit to create the record.",
      },
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateGuideMdx", () => {
  it("fixture 1: valid IR with 2 steps — MDX is well-formed and contains expected sections", () => {
    const ir = twoStepIr();
    const mdx = generateGuideMdx(ir);

    // Frontmatter block exists.
    expect(mdx).toContain("---");
    expect(mdx).toContain("title: Test Journey");
    expect(mdx).toContain("module: onboarding");
    expect(mdx).toContain("slug: test-journey");

    // Document H1 header.
    expect(mdx).toContain("# Test Journey");

    // Step headings (H2).
    expect(mdx).toContain("## Step 1: Open the form");
    expect(mdx).toContain("## Step 2: Submit the form");

    // Step descriptions (prefer `description` over `action`).
    expect(mdx).toContain("Navigate to the form by clicking the New button.");
    expect(mdx).toContain("Complete all fields and submit to create the record.");

    // Completion criteria headings (H3).
    expect(mdx).toContain("### Completion criteria");

    // Assertion checklists.
    expect(mdx).toContain("- [ ] A modal dialog appears with an empty form");
    expect(mdx).toContain("- [ ] The form closes and a success banner appears");

    // No raw `undefined` strings anywhere.
    expect(mdx).not.toContain("undefined");
  });

  it("fixture 2: steps without description fall back to action — MDX still well-formed", () => {
    const ir = twoStepIr({
      steps: [
        {
          key: "step-a",
          title: "Navigate",
          action: "Click the sidebar link",
          assertion: "Page loads",
          // description omitted intentionally
        },
        {
          key: "step-b",
          title: "Confirm",
          action: "Click the confirm button",
          assertion: "Dialog closes",
          // description omitted intentionally
        },
      ],
    });

    const mdx = generateGuideMdx(ir);

    // Falls back to `action` string when description is absent.
    expect(mdx).toContain("Click the sidebar link");
    expect(mdx).toContain("Click the confirm button");

    // No raw `undefined` strings.
    expect(mdx).not.toContain("undefined");

    // Step headings still present.
    expect(mdx).toContain("## Step 1: Navigate");
    expect(mdx).toContain("## Step 2: Confirm");
  });

  it("fixture 3: empty steps array throws (structural invariant violation)", () => {
    const ir = twoStepIr({ steps: [] });

    expect(() => generateGuideMdx(ir)).toThrow(/ir\.steps must be non-empty/);
  });

  it("root description renders as blockquote when present", () => {
    const ir = twoStepIr({ description: "A journey that validates the checkout flow." });
    const mdx = generateGuideMdx(ir);

    expect(mdx).toContain("> A journey that validates the checkout flow.");
  });

  it("root description is omitted cleanly when absent (no empty blockquote)", () => {
    const ir = twoStepIr(); // no description
    const mdx = generateGuideMdx(ir);

    // No ">" line with empty content.
    const lines = mdx.split("\n");
    const emptyBlockquote = lines.find((l) => l.trim() === ">");
    expect(emptyBlockquote).toBeUndefined();
  });

  it("output ends with a single newline (no trailing whitespace)", () => {
    const ir = twoStepIr();
    const mdx = generateGuideMdx(ir);
    expect(mdx.endsWith("\n")).toBe(true);
    expect(mdx.endsWith("\n\n")).toBe(false);
  });
});
