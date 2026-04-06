import * as fs from "fs";
import * as path from "path";
import type { ProtocolTestOutput } from "../protocols/types";
import type { ProtocolDefinition } from "../protocols/schema";

/**
 * Generates a markdown user guide from protocol run results.
 *
 * Takes the step results (with screenshots) and the protocol definition
 * (with descriptions) and produces a step-by-step guide with images.
 * Screenshots are referenced by relative path from the output directory.
 */
export function generateDocs(
  protocol: ProtocolDefinition,
  output: ProtocolTestOutput,
  outputDir: string = path.resolve(process.cwd(), "../../docs/guides"),
): string {
  fs.mkdirSync(outputDir, { recursive: true });

  const lines: string[] = [
    "---",
    `title: "Guide: ${protocol.name}"`,
    `protocol_id: ${protocol.id}`,
    `generated: ${new Date().toISOString().slice(0, 10)}`,
    `status: draft`,
    "---",
    "",
    `# ${protocol.name} — Steg-for-steg`,
    "",
  ];

  for (const step of output.steps) {
    const def = protocol.steps.find((s) => s.id === step.step_id);
    if (!def) continue;

    lines.push(`## ${step.step_order}. ${step.title}`);
    lines.push("");

    if (step.screenshot_path) {
      const relPath = path.relative(outputDir, step.screenshot_path);
      lines.push(`![Steg ${step.step_order}](${relPath})`);
      lines.push("");
    }

    lines.push(def.description);
    lines.push("");

    if (step.status !== "passed") {
      lines.push(`> **Status:** ${step.status} — ${step.gate_result.error ?? "Gate failed"}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`*Generert av Protocol Verification Engine ${new Date().toISOString().slice(0, 10)}*`);

  const content = lines.join("\n");
  const filePath = path.join(outputDir, `GUIDE-${protocol.id}.md`);
  fs.writeFileSync(filePath, content, "utf-8");

  return filePath;
}
