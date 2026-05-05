#!/usr/bin/env node
/**
 * Invariant — every capability registered in `capabilities/registry.ts` MUST
 * appear as a value in the `intentSchema.capability` enum in
 * `router/intent-classifier.ts`, and every non-`general` enum value MUST
 * either be registered in the registry or documented in the intentional
 * fall-through allow-list below.
 *
 * ADR-0112 — Intent Classifier Coverage Invariant.
 *
 * Why this exists: the two surfaces (registry + intent enum) drift silently.
 * A capability registered without an enum value is unreachable from the agent
 * because OpenRouter structured-output cannot emit a value outside the enum.
 * Typecheck passes, unit tests pass, the user still hits a dead-end.
 *
 * Phase A4 of campaign/botsson-arena closes this gap.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Intents in `intentSchema.capability` that intentionally have no registered
 * capability. These are answered narratively by the agent from the system
 * prompt; they do not require a tool surface.
 *
 * When you add an entry here, ALSO add a matching comment in
 * `router/tool-selector.ts` explaining the intent (ADR-0112 §Decision Outcome).
 *
 * Current allow-list (source: tool-selector.ts comment block):
 *   - knowledge  → policy/FAQ lookup, answered from system prompt context
 *   - payroll    → salary questions, deliberately tool-less (no payroll tools)
 *   - general    → sentinel for greetings / small talk / unclear intent
 *   - inquiry    → TRANSITIONAL — Welcome Mission V0 spec sortie 2026-05-04
 *                  declared the enum value via H4-fix per PLAN-welcome-mission-rework,
 *                  but the `inquiry` capability registration lands in the
 *                  implementation-phase sortie (ADR-0274). Until then, `inquiry`
 *                  intent routes to general fallback. Remove from this list when
 *                  packages/ai/src/capabilities/inquiry/ + registry entry land.
 *   - outreach   → TRANSITIONAL — intent enum added 2026-05-05 by commit
 *                  8e94fd92a ahead of the outreach capability landing. The
 *                  `outreach` capability + tools register in a follow-up
 *                  sortie (packages/ai/src/capabilities/outreach/). Until then,
 *                  `outreach` intent routes to general fallback. Remove from
 *                  this list when the registry entry lands.
 *
 * Historic note: `memory` was in this list until Phase A3 (2026-04-22) when
 * it became a real capability; `training` was never here (registered from
 * the start). ADR-0112's original wording pre-dated both landings.
 */
export const DOCUMENTED_TOOLLESS: ReadonlySet<string> = new Set([
  "knowledge",
  "payroll",
  "general",
  "inquiry",
  "outreach",
]);

export type IntentCoverageReport = {
  registered: string[];
  enumValues: string[];
  missingInEnum: string[];
  orphanInEnum: string[];
  ok: boolean;
};

type PackageRoots = {
  /** Directory containing the two source files. Defaults to this package's src/. */
  srcRoot: string;
};

const REGISTRY_RELATIVE = "capabilities/registry.ts";
const CLASSIFIER_RELATIVE = "router/intent-classifier.ts";

/**
 * Extract the string keys of the `capabilities` record literal inside
 * `capabilities/registry.ts`.
 *
 * The record shape is stable (ADR-0198 + I1):
 *   const capabilities: Record<string, CapabilityDefinition> = {
 *     profile: profileCapability,
 *     ...
 *   };
 *
 * We parse the keys textually rather than importing the module to avoid
 * dragging the whole `@smartout/ai` build graph (supabase, openrouter, zod)
 * into a CI lint step.
 */
export function extractRegisteredCapabilities(registrySource: string): string[] {
  // Find `const capabilities: Record<string, CapabilityDefinition> = { ... };`
  // We match the opening brace and walk forward to its matching closing brace.
  const declMatch = registrySource.match(/const\s+capabilities\s*:\s*Record<[^>]+>\s*=\s*\{/);
  if (!declMatch) {
    throw new Error(
      `check-intent-coverage: could not locate \`const capabilities\` declaration in ${REGISTRY_RELATIVE}. ` +
        `ADR-0198 requires this exact shape; if the registry layout changed, update this parser.`,
    );
  }
  const openIdx = registrySource.indexOf("{", declMatch.index!);
  if (openIdx < 0) {
    throw new Error(
      "check-intent-coverage: opening brace not found after capabilities declaration",
    );
  }
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < registrySource.length; i++) {
    const ch = registrySource[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) {
    throw new Error(
      "check-intent-coverage: could not find matching closing brace for capabilities literal",
    );
  }
  const body = registrySource.slice(openIdx + 1, closeIdx);
  // Strip line + block comments so we don't parse commented-out keys.
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const keys: string[] = [];
  // Match `identifier:` and `"identifier":` at the start of each entry.
  // JS/TS object keys without quotes must match /^[A-Za-z_$][\w$]*$/.
  const keyRegex = /(?:^|,)\s*(?:"([a-z_][a-z0-9_]*)"|([a-z_][a-z0-9_]*))\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = keyRegex.exec(stripped)) !== null) {
    keys.push(m[1] ?? m[2]);
  }
  if (keys.length === 0) {
    throw new Error(
      "check-intent-coverage: no capability keys parsed from registry — parser is broken",
    );
  }
  return keys;
}

/**
 * Extract the enum string literals from `z.enum([...])` in the intentSchema.
 *
 * The schema shape (ADR-0073 addendum):
 *   export const intentSchema = z.object({
 *     ...
 *     capability: z.enum([
 *       "knowledge",
 *       ...
 *     ] as const),
 *   });
 *
 * We locate `capability: z.enum([` and capture every single- or double-quoted
 * string literal until the matching `]`.
 */
export function extractIntentEnumValues(classifierSource: string): string[] {
  const start = classifierSource.search(/capability\s*:\s*z\.enum\s*\(\s*\[/);
  if (start < 0) {
    throw new Error(
      `check-intent-coverage: could not locate \`capability: z.enum([\` in ${CLASSIFIER_RELATIVE}. ` +
        `If the classifier schema shape changed, update this parser.`,
    );
  }
  const openBracket = classifierSource.indexOf("[", start);
  if (openBracket < 0) {
    throw new Error("check-intent-coverage: opening bracket not found for z.enum([");
  }
  let depth = 0;
  let closeBracket = -1;
  for (let i = openBracket; i < classifierSource.length; i++) {
    const ch = classifierSource[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        closeBracket = i;
        break;
      }
    }
  }
  if (closeBracket < 0) {
    throw new Error("check-intent-coverage: could not find matching closing bracket for z.enum");
  }
  const body = classifierSource.slice(openBracket + 1, closeBracket);
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const values: string[] = [];
  const strRegex = /["']([a-z_][a-z0-9_]*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = strRegex.exec(stripped)) !== null) {
    values.push(m[1]);
  }
  if (values.length === 0) {
    throw new Error(
      "check-intent-coverage: no enum values parsed from intentSchema — parser is broken",
    );
  }
  return values;
}

export function computeCoverageReport(
  registered: string[],
  enumValues: string[],
  toolless: ReadonlySet<string> = DOCUMENTED_TOOLLESS,
): IntentCoverageReport {
  const registeredSet = new Set(registered);
  const enumSet = new Set(enumValues);

  // Every registered capability must have a matching enum entry — otherwise
  // the LLM cannot route to it (structured-output validator rejects).
  const missingInEnum = registered.filter((c) => !enumSet.has(c)).sort();

  // Every enum value that is neither registered nor documented tool-less is
  // an orphan — it routes to selectTools() which returns [] silently.
  const orphanInEnum = enumValues.filter((v) => !registeredSet.has(v) && !toolless.has(v)).sort();

  return {
    registered: [...registered].sort(),
    enumValues: [...enumValues].sort(),
    missingInEnum,
    orphanInEnum,
    ok: missingInEnum.length === 0 && orphanInEnum.length === 0,
  };
}

export function checkIntentCoverage(opts: PackageRoots): IntentCoverageReport {
  const registrySource = readFileSync(join(opts.srcRoot, REGISTRY_RELATIVE), "utf8");
  const classifierSource = readFileSync(join(opts.srcRoot, CLASSIFIER_RELATIVE), "utf8");
  const registered = extractRegisteredCapabilities(registrySource);
  const enumValues = extractIntentEnumValues(classifierSource);
  return computeCoverageReport(registered, enumValues);
}

function defaultSrcRoot(): string {
  // When invoked as `tsx scripts/check-intent-coverage.ts` from packages/ai/,
  // the script file is at packages/ai/scripts/check-intent-coverage.ts; the
  // src/ directory lives one level up.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "src");
}

function formatReport(report: IntentCoverageReport): string {
  const lines: string[] = [];
  lines.push("ADR-0112 — Intent Classifier Coverage Invariant");
  lines.push("");
  if (report.ok) {
    lines.push(
      `ok: ${report.registered.length} capability names ↔ ${report.enumValues.length} enum values — all in sync.`,
    );
    lines.push(`     fall-through allow-list: ${[...DOCUMENTED_TOOLLESS].sort().join(", ")}`);
    return lines.join("\n");
  }
  lines.push("drift detected:");
  lines.push("");
  if (report.missingInEnum.length > 0) {
    lines.push(
      `  [missingInEnum] ${report.missingInEnum.length} capability/capabilities are registered in`,
    );
    lines.push(
      `  packages/ai/src/capabilities/registry.ts but are NOT in the intentSchema enum in`,
    );
    lines.push(
      `  packages/ai/src/router/intent-classifier.ts. OpenRouter's structured-output cannot emit`,
    );
    lines.push(`  these values — the classifier will never route to them. Silent dead-end.`);
    for (const name of report.missingInEnum) {
      lines.push(`    - ${name}`);
    }
    lines.push("");
    lines.push(
      `  fix: add the missing names to the z.enum([...]) in intent-classifier.ts AND to the`,
    );
    lines.push(`       "Capabilities:" list in the system prompt.`);
    lines.push("");
  }
  if (report.orphanInEnum.length > 0) {
    lines.push(
      `  [orphanInEnum] ${report.orphanInEnum.length} intent enum value(s) have no matching registered capability`,
    );
    lines.push(
      `  and are not documented in the tool-less allow-list. The classifier can pick them, but`,
    );
    lines.push(
      `  selectTools() will return [] — the agent will claim it can help and then do nothing.`,
    );
    for (const name of report.orphanInEnum) {
      lines.push(`    - ${name}`);
    }
    lines.push("");
    lines.push(`  fix options:`);
    lines.push(`    1. register the capability in capabilities/registry.ts, OR`);
    lines.push(`    2. remove the value from the intent enum, OR`);
    lines.push(
      `    3. if it is intentionally tool-less, add it to DOCUMENTED_TOOLLESS in this script AND`,
    );
    lines.push(`       add a matching comment in router/tool-selector.ts explaining why.`);
    lines.push("");
  }
  lines.push(`registered (${report.registered.length}): ${report.registered.join(", ")}`);
  lines.push(`enum values (${report.enumValues.length}): ${report.enumValues.join(", ")}`);
  lines.push(
    `tool-less allow-list (${DOCUMENTED_TOOLLESS.size}): ${[...DOCUMENTED_TOOLLESS].sort().join(", ")}`,
  );
  return lines.join("\n");
}

// CLI entry.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const srcRoot = process.argv[2] ?? defaultSrcRoot();
    const report = checkIntentCoverage({ srcRoot });
    if (report.ok) {
      console.log(formatReport(report));
      process.exit(0);
    }
    console.error(formatReport(report));
    process.exit(1);
  } catch (err) {
    console.error(`check-intent-coverage: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
}
