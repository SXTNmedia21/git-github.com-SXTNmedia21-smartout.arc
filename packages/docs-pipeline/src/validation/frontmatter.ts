// ============================================
// frontmatter.ts
// Validates YAML frontmatter in documentation files.
// Plan files MUST have frontmatter (FAIL), other docs SHOULD (WARN).
// Connected to: src/commands/validate.ts (called during validation)
// Connected to: ADR-0032 (enforcement pipeline rules)
// ============================================

import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import type { ValidationResult } from "./types";

/**
 * Validates that plan files have required YAML frontmatter
 * and other docs have recommended frontmatter.
 *
 * Why: The RAG pipeline relies on frontmatter for metadata extraction.
 * Plan files without frontmatter can't be properly indexed.
 * ADR-0032 defines plan frontmatter as FAIL and others as WARN.
 *
 * @param files - Array of absolute file paths to validate
 * @returns Array of validation results
 */
export async function validateFrontmatter(files: string[]): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf-8");
    const relativePath = toRelativePath(filePath);
    const isPlan = relativePath.includes("plans/");

    // Try to parse frontmatter
    const parsed = matter(content);
    const hasFrontmatter = Object.keys(parsed.data).length > 0;

    if (!hasFrontmatter) {
      results.push({
        rule: "frontmatter",
        severity: isPlan ? "fail" : "warn",
        file: relativePath,
        message: isPlan
          ? "Plan file is missing required YAML frontmatter (title, status, created)"
          : "Document is missing YAML frontmatter (recommended for indexing)",
      });
      continue;
    }

    // For plan files, check required fields
    if (isPlan) {
      const fm = parsed.data as Record<string, unknown>;
      const requiredFields = ["title", "status", "created"];
      const missingFields = requiredFields.filter((field) => !fm[field]);

      if (missingFields.length > 0) {
        results.push({
          rule: "frontmatter",
          severity: "fail",
          file: relativePath,
          message: `Plan file missing required frontmatter fields: ${missingFields.join(", ")}`,
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
