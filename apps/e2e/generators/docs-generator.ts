import * as fs from "fs";
import * as path from "path";
import type { JourneyIR } from "@smartout/journey-ir";
import type { ProtocolTestOutput } from "../protocols/types";

/**
 * Generates a markdown user guide from a JourneyIR and a protocol run result.
 *
 * Per ADR-0174 C.5/C.9, this is the canonical generator signature. The
 * legacy `ProtocolDefinition` authoring shape and the migration adapter
 * have been retired (ADR-0174 C.11 closed at M3.5 exit). Callers pass a
 * `JourneyIR` v2 directly.
 *
 * Takes step results (with screenshots) and the IR (with titles/descriptions)
 * and produces a step-by-step guide with images. Screenshots are referenced
 * by relative path from the output directory.
 *
 * Step correlation between IR and run output is by `step.key` ↔ `step_id`.
 */
export function generateDocsFromIR(
  ir: JourneyIR,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/guides"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [
    "---",
    `title: "Guide: ${ir.title}"`,
    `protocol_id: ${ir.slug}`,
    `generated: ${new Date().toISOString().slice(0, 10)}`,
    `status: draft`,
    "---",
    "",
    `# ${ir.title} — Steg-for-steg`,
    "",
  ];

  for (const runStep of output.steps) {
    const irStep = ir.steps.find((s) => s.key === runStep.step_id);
    if (!irStep) continue;

    lines.push(`## ${runStep.step_order}. ${runStep.title}`);
    lines.push("");

    if (runStep.screenshot_path) {
      const relPath = path.relative(outputDir, runStep.screenshot_path);
      lines.push(`![Steg ${runStep.step_order}](${relPath})`);
      lines.push("");
    }

    // JourneyStep.action carries the description + action-summary per the
    // adapter's contract. Use it directly — preserves the previous
    // "description" surface for authors.
    lines.push(irStep.action);
    lines.push("");

    if (runStep.status !== "passed") {
      lines.push(`> **Status:** ${runStep.status} — ${runStep.gate_result.error ?? "Gate failed"}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*Generert av Protocol Verification Engine ${new Date().toISOString().slice(0, 10)}*`);

  const content = lines.join("\n");
  const filePath = path.join(outputDir, `GUIDE-${ir.slug}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return filePath;
}
