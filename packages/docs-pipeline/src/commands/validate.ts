// ============================================
// validate.ts
// Validation command for the docs pipeline.
// Runs all or specific rule groups and reports results.
// Exits non-zero on FAIL (or WARN in strict mode).
// Connected to: src/validation/*.ts (individual rule implementations)
// Connected to: ADR-0032 (enforcement pipeline decision)
// ============================================

import fg from "fast-glob";
import { resolve } from "node:path";
import { findProjectRoot } from "../utils/root";
import { validateFrontmatter } from "../validation/frontmatter";
import { validateAdrCompliance } from "../validation/adr-compliance";
import { validateStructure } from "../validation/structure";
import type { ValidationResult, Severity } from "../validation/types";

/**
 * Options for the validate command.
 */
export type ValidateOptions = {
  /** Treat warnings as failures */
  strict: boolean;
  /** Run a specific rule group only */
  rule?: string;
};

/** Available rule groups */
const RULE_GROUPS = ["frontmatter", "adr", "structure"] as const;
type RuleGroup = (typeof RULE_GROUPS)[number];

/**
 * Runs documentation validation checks.
 *
 * Why: Automated validation catches structural drift, missing
 * frontmatter, and ADR log inconsistencies before they compound.
 * ADR-0032 defines which checks are FAIL vs WARN severity.
 *
 * @param options - Validation configuration options
 */
export async function runValidate(options: ValidateOptions): Promise<void> {
  const { strict, rule } = options;

  console.log(`\n📋 Documentation Validation`);
  console.log(`   Strict: ${strict} | Rule: ${rule ?? "all"}\n`);

  // Determine which rules to run
  const rulesToRun: RuleGroup[] = rule ? RULE_GROUPS.filter((r) => r === rule) : [...RULE_GROUPS];

  if (rulesToRun.length === 0) {
    console.log(`   Unknown rule group: "${rule}"`);
    console.log(`   Available: ${RULE_GROUPS.join(", ")}\n`);
    process.exitCode = 1;
    return;
  }

  // Discover all docs files
  const docsDir = resolve(findProjectRoot(), "docs");
  const files = await fg("**/*.md", {
    cwd: docsDir,
    absolute: true,
    ignore: ["**/archive/**", "**/templates/**", "**/node_modules/**"],
  });

  console.log(`   Found ${files.length} documentation files\n`);

  // Run selected rules
  const allResults: ValidationResult[] = [];

  for (const ruleGroup of rulesToRun) {
    console.log(`   Running: ${ruleGroup}...`);

    let results: ValidationResult[] = [];

    switch (ruleGroup) {
      case "frontmatter":
        results = await validateFrontmatter(files);
        break;
      case "adr":
        results = await validateAdrCompliance();
        break;
      case "structure":
        results = await validateStructure(files);
        break;
    }

    allResults.push(...results);
    console.log(`   ${ruleGroup}: ${results.length} issues found`);
  }

  // Print results
  console.log("\n   --- Results ---\n");

  if (allResults.length === 0) {
    console.log("   All checks passed! No issues found.\n");
    return;
  }

  // Group by severity
  const fails = allResults.filter((r) => r.severity === "fail");
  const warns = allResults.filter((r) => r.severity === "warn");

  // Print failures first
  for (const result of fails) {
    console.log(`   ${severityIcon("fail")} [FAIL] ${result.file}`);
    console.log(`          ${result.rule}: ${result.message}`);
  }

  // Then warnings
  for (const result of warns) {
    console.log(`   ${severityIcon("warn")} [WARN] ${result.file}`);
    console.log(`          ${result.rule}: ${result.message}`);
  }

  console.log(`\n   Summary: ${fails.length} failures, ${warns.length} warnings\n`);

  // Exit code: non-zero on FAIL, or WARN in strict mode
  if (fails.length > 0 || (strict && warns.length > 0)) {
    process.exitCode = 1;
  }
}

/**
 * Returns an icon for the severity level.
 */
function severityIcon(severity: Severity): string {
  return severity === "fail" ? "X" : "!";
}
