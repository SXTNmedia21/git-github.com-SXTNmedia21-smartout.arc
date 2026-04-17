import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Mapping, DiffResult, FieldMapEntry } from "./mapping.js";

function formatFieldRow(key: string, entry: FieldMapEntry): string {
  const flag = entry.needs_review ? " **⚠ needs review**" : "";
  const target = entry.target ?? "_(unmapped)_";
  const types = entry.source_value_types.join(" | ") || "_(unknown)_";
  const samples = entry.sample_values.slice(0, 3).map((v) => JSON.stringify(v)).join(", ");
  return [
    `### \`${key}\`${flag}`,
    ``,
    `- **Target:** \`${target}\``,
    `- **Types:** ${types}`,
    `- **Occurrences:** ${entry.occurrence_count}`,
    `- **Samples:** ${samples || "_(none)_"}`,
    ``,
  ].join("\n");
}

export async function writeNarrative(
  destinationDir: string,
  mapping: Mapping,
  diff: DiffResult,
): Promise<void> {
  await mkdir(destinationDir, { recursive: true });

  const frontmatter = [
    "---",
    `title: Bubble shape — ${mapping.entity}`,
    `entity: ${mapping.entity}`,
    `bubble_type: ${mapping.bubble_type}`,
    `target_table: ${mapping.target_table ?? "null"}`,
    `updated: ${mapping.last_verified}`,
    `sample_record_count: ${mapping.sample_record_count}`,
    `total_record_count: ${mapping.total_record_count ?? "unknown"}`,
    "type: bubble-shape",
    "---",
    "",
  ].join("\n");

  const unreviewed = Object.entries(mapping.field_map).filter(([, e]) => e.needs_review);
  const headerNote = unreviewed.length > 0
    ? `> ⚠ **${unreviewed.length} field(s) need review** before this mapping can be used for migration.\n\n`
    : `> ✅ All fields in this mapping have been reviewed.\n\n`;

  const summary = [
    `# ${mapping.entity}`,
    "",
    headerNote,
    `Bubble type: \`${mapping.bubble_type}\` → v3 table: \`${mapping.target_table ?? "(not set)"}\``,
    "",
    `Last verified: **${mapping.last_verified}** from a sample of **${mapping.sample_record_count}** records`,
    mapping.total_record_count !== null ? ` out of **${mapping.total_record_count}** total.` : ".",
    "",
  ].join("");

  const fields = [
    "## Fields",
    "",
    ...Object.entries(mapping.field_map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => formatFieldRow(key, entry)),
  ].join("\n");

  const quirks = mapping.known_quirks.length > 0
    ? [
        "## Known quirks",
        "",
        ...mapping.known_quirks.map((q) => `- ${q}`),
        "",
      ].join("\n")
    : "";

  const changes = [
    "## Changes since last run",
    "",
    diff.newFields.length > 0
      ? `**New fields (${diff.newFields.length}):** ${diff.newFields.join(", ")}`
      : "No new fields.",
    "",
    diff.disappearedFields.length > 0
      ? `**Disappeared fields (${diff.disappearedFields.length}):** ${diff.disappearedFields.join(", ")}`
      : "No disappeared fields.",
    "",
    diff.typeChanges.length > 0
      ? `**Type changes (${diff.typeChanges.length}):**\n${diff.typeChanges.map((c) => `- \`${c.field}\`: ${c.before.join("|")} → ${c.after.join("|")}`).join("\n")}`
      : "No type changes.",
    "",
  ].join("\n");

  const content = frontmatter + summary + fields + "\n" + quirks + changes;

  const path = join(destinationDir, `${mapping.entity}.md`);
  await writeFile(path, content, "utf-8");
}
