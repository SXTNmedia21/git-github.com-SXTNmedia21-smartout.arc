/**
 * guide-mdx.ts — Pure-function JourneyIR → USER-GUIDE MDX transform.
 *
 * ADR-0217: the MDX body is generated mechanically from the JourneyIR.
 * No LLM call in this sortie — a pure-function transform is predictable,
 * testable in isolation, and fast (no async, no DB, no network).
 *
 * Exported as a separate module so unit tests can import it without
 * mocking Supabase or the telemetry stack.
 *
 * Contract:
 *   - Input: `JourneyIRForGuide` (validated upstream by `validateIRForGuide()`).
 *   - Output: MDX string — valid Markdown + JSX-compatible frontmatter block.
 *   - No `undefined` strings in output — any missing optional field falls back
 *     to a deterministic placeholder.
 *   - Throws `Error` if `steps` is empty (should never reach here after
 *     `validateIRForGuide` but acts as defense-in-depth).
 *
 * MDX structure:
 *   ---
 *   title: "<journey title>"
 *   module: "<module>"
 *   ---
 *
 *   # <title>
 *   > <description if present>
 *
 *   ## Step N: <step title>
 *   <step description or action summary>
 *
 *   ### Completion criteria
 *   - [ ] <assertion>
 *
 * Binding:
 *   - ADR-0217 (storage + write path spec)
 *   - ADR-0217 §Detailed Specification / Write Path step 4
 *   - L-0125 (unit tests must assert MDX content, not just ok:true)
 */

import type { JourneyIRForGuide } from "@smartout/journey-ir";

/**
 * Generate a USER-GUIDE MDX document from a validated `JourneyIRForGuide`.
 *
 * @param ir - The validated IR (caller MUST have run `validateIRForGuide()`).
 * @returns MDX string ready for storage in `journey_guide.mdx_content`.
 * @throws Error when `ir.steps` is empty (structural invariant violation).
 */
export function generateGuideMdx(ir: JourneyIRForGuide): string {
  if (ir.steps.length === 0) {
    throw new Error(
      "generateGuideMdx: ir.steps must be non-empty (validateIRForGuide gate missed)",
    );
  }

  const lines: string[] = [];

  // ── YAML frontmatter ─────────────────────────────────────────────────────
  lines.push("---");
  lines.push(`title: ${yamlStr(ir.title)}`);
  lines.push(`module: ${yamlStr(ir.module)}`);
  lines.push(`slug: ${yamlStr(ir.slug)}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push("---");
  lines.push("");

  // ── Document header ───────────────────────────────────────────────────────
  lines.push(`# ${ir.title}`);

  // Optional top-level description — falls back to empty string (no blockquote
  // rendered when description is absent to avoid ">" with empty content).
  const rootDescription = ir.description;
  if (rootDescription && rootDescription.trim().length > 0) {
    lines.push("");
    lines.push(`> ${rootDescription.trim()}`);
  }

  lines.push("");

  // ── Steps ─────────────────────────────────────────────────────────────────
  ir.steps.forEach((step, idx) => {
    const stepNumber = idx + 1;

    // H2: step heading.
    lines.push(`## Step ${stepNumber}: ${step.title}`);
    lines.push("");

    // Step description — prefer `description`, fall back to `action` summary.
    // `action` is a v1 base field and always non-empty after validation.
    const bodyText =
      step.description && step.description.trim().length > 0
        ? step.description.trim()
        : step.action.trim();
    lines.push(bodyText);
    lines.push("");

    // Completion criteria — renders as a checklist (MDX/GFM checkbox list).
    if (step.assertion && step.assertion.trim().length > 0) {
      lines.push("### Completion criteria");
      lines.push("");
      lines.push(`- [ ] ${step.assertion.trim()}`);
      lines.push("");
    }
  });

  return lines.join("\n").trimEnd() + "\n";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wrap a string for YAML output. Single-quotes if the value contains
 * double-quote characters; double-quotes if it contains single-quotes;
 * unquoted otherwise (simple scalar). Falls back to empty string for
 * null/undefined inputs so YAML frontmatter is always well-formed.
 */
function yamlStr(value: string | undefined | null): string {
  if (!value) return '""';
  if (value.includes('"') && !value.includes("'")) return `'${value}'`;
  if (value.includes('"') || value.includes(":") || value.includes("#"))
    return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}
