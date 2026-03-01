// ============================================
// structure.ts
// Validates documentation structure conventions.
// Checks module spec overview sections and cross-reference integrity.
// Connected to: src/commands/validate.ts (called during validation)
// Connected to: ADR-0032 (enforcement pipeline rules)
// ============================================

import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import { resolve } from "node:path";
import { findProjectRoot } from "../utils/root";
import type { ValidationResult } from "./types";

/**
 * Validates structural conventions in documentation.
 *
 * Why: Module specs are the primary reference for business logic.
 * Missing overview sections make it harder for agents and developers
 * to understand the module's purpose. Cross-reference integrity
 * prevents broken links in the knowledge base.
 *
 * Checks:
 * 1. Module specs should have an overview section (WARN)
 * 2. Cross-references to MODULE_N should resolve (WARN)
 *
 * @param files - Array of absolute file paths to validate
 * @returns Array of validation results
 */
export async function validateStructure(files: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Check 1: Module specs should have overview section
  const moduleFiles = files.filter((f) => {
    const normalized = f.replace(/\\/g, "/");
    return normalized.includes("docs/modules/");
  });

  for (const filePath of moduleFiles) {
    const content = await readFile(filePath, "utf-8");
    const relativePath = toRelativePath(filePath);

    // Check for overview or introduction section
    const hasOverview = /^##\s+(Overview|Introduction|Purpose|Summary)/im.test(content);

    if (!hasOverview) {
      results.push({
        rule: "module-structure",
        severity: "warn",
        file: relativePath,
        message: "Module spec is missing an Overview/Introduction section",
      });
    }
  }

  // Check 2: Cross-reference integrity
  const crossRefResults = await validateCrossReferences(files);
  results.push(...crossRefResults);

  return results;
}

/**
 * Validates that cross-references to MODULE_N files resolve to existing files.
 *
 * Scans all docs for references like "MODULE_01" or "Module 1" and checks
 * that the corresponding file exists.
 *
 * @param files - Array of absolute file paths to check
 * @returns Array of validation results for broken references
 */
async function validateCrossReferences(files: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const modulesDir = resolve(findProjectRoot(), "docs/modules");

  // Find all module files that actually exist
  const existingModules = await fg("MODULE_*.md", {
    cwd: modulesDir,
    absolute: false,
  });
  const existingModuleNumbers = new Set(
    existingModules
      .map((f) => {
        const match = f.match(/MODULE_(\d+)/);
        return match?.[1] ?? "";
      })
      .filter(Boolean),
  );

  // Scan files for MODULE_N references
  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const relativePath = toRelativePath(filePath);

    // Skip module files referencing themselves
    if (relativePath.includes("docs/modules/")) continue;

    // Find MODULE_NN references
    const moduleRefs = content.matchAll(/MODULE_(\d+)/g);
    for (const ref of moduleRefs) {
      const moduleNum = ref[1];
      if (moduleNum && !existingModuleNumbers.has(moduleNum)) {
        results.push({
          rule: "cross-reference",
          severity: "warn",
          file: relativePath,
          message: `References MODULE_${moduleNum} but no matching file exists in docs/modules/`,
        });
      }
    }
  }

  return results;
}

/**
 * Converts an absolute file path to a project-relative path.
 */
function toRelativePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const docsIndex = normalized.indexOf("docs/");
  return docsIndex >= 0 ? normalized.slice(docsIndex) : normalized;
}
