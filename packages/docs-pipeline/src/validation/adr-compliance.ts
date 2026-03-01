// ============================================
// adr-compliance.ts
// Validates ADR files against the decision log and required fields.
// Ensures every ADR on disk is in the log and vice versa.
// Connected to: src/commands/validate.ts (called during validation)
// Connected to: ADR-0032 (enforcement pipeline rules)
// ============================================

import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import { resolve } from "node:path";
import { findProjectRoot } from "../utils/root";
import matter from "gray-matter";
import type { ValidationResult } from "./types";

/** Files to exclude from ADR validation */
const EXCLUDED_FILES = new Set(["0000-decision-log.md"]);

/**
 * Validates ADR compliance: log consistency and required fields.
 *
 * Why: The ADR decision log is the central index. If it drifts from
 * actual files on disk, agents and developers can't trust it.
 * ADR-0032 classifies these as FAIL severity.
 *
 * Checks:
 * 1. Every ADR file on disk is referenced in the decision log
 * 2. Every entry in the decision log has a corresponding file
 * 3. Every ADR has required fields (Status, Date, Context, Decision)
 *
 * @returns Array of validation results
 */
export async function validateAdrCompliance(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const decisionsDir = resolve(findProjectRoot(), "docs/decisions");

  // Find all ADR files on disk
  const adrFiles = await fg("*.md", {
    cwd: decisionsDir,
    absolute: false,
  });

  // Filter out excluded files and templates
  const adrFilesOnDisk = adrFiles.filter((f) => !EXCLUDED_FILES.has(f) && !f.includes("template"));

  // Parse the decision log
  const logPath = resolve(decisionsDir, "0000-decision-log.md");
  const logContent = await readFile(logPath, "utf-8");
  const logEntries = parseDecisionLog(logContent);

  // Check 1: Every file on disk is in the log
  for (const fileName of adrFilesOnDisk) {
    const isInLog = logEntries.some((entry) => entry.fileName === fileName);
    if (!isInLog) {
      results.push({
        rule: "adr-log-consistency",
        severity: "fail",
        file: `docs/decisions/${fileName}`,
        message: `ADR file exists on disk but is NOT in the decision log`,
      });
    }
  }

  // Check 2: Every log entry has a corresponding file
  for (const entry of logEntries) {
    const existsOnDisk = adrFilesOnDisk.includes(entry.fileName);
    if (!existsOnDisk) {
      results.push({
        rule: "adr-log-consistency",
        severity: "fail",
        file: `docs/decisions/0000-decision-log.md`,
        message: `Decision log references "${entry.fileName}" but file does not exist`,
      });
    }
  }

  // Check 3: Required fields in each ADR file
  for (const fileName of adrFilesOnDisk) {
    const filePath = resolve(decisionsDir, fileName);
    const content = await readFile(filePath, "utf-8");
    const fieldResults = validateAdrRequiredFields(content, `docs/decisions/${fileName}`);
    results.push(...fieldResults);
  }

  return results;
}

/**
 * Parses the decision log table to extract ADR entries.
 *
 * @param content - Raw content of the decision log
 * @returns Array of parsed log entries with ID and file name
 */
function parseDecisionLog(content: string): Array<{ id: string; fileName: string }> {
  const entries: Array<{ id: string; fileName: string }> = [];

  // Match table rows: | ADR-XXXX | date | [title](./filename.md) | status |
  const rowRegex = /\|\s*(ADR-\d+)\s*\|[^|]+\|\s*\[.+?\]\(\.\/(.+?\.md)\)\s*\|/g;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(content)) !== null) {
    if (match[1] && match[2]) {
      entries.push({
        id: match[1],
        fileName: match[2],
      });
    }
  }

  return entries;
}

/**
 * Validates required fields in a single ADR file.
 *
 * Required: Status (frontmatter or inline), Date, Context section, Decision section.
 *
 * @param content - Raw ADR file content
 * @param relativePath - Relative path for error reporting
 * @returns Array of validation results for missing fields
 */
function validateAdrRequiredFields(content: string, relativePath: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const parsed = matter(content);
  const fm = parsed.data as Record<string, unknown>;
  const body = parsed.content;

  // Check status (frontmatter or inline)
  const hasStatus =
    fm["status"] != null || /\*\*Status:\*\*/i.test(body) || /^##\s+Status/im.test(body);
  if (!hasStatus) {
    results.push({
      rule: "adr-required-fields",
      severity: "fail",
      file: relativePath,
      message: "ADR is missing Status field (frontmatter or section)",
    });
  }

  // Check date (frontmatter or inline)
  const hasDate = fm["created"] != null || fm["date"] != null || /\*\*Date:\*\*/i.test(body);
  if (!hasDate) {
    results.push({
      rule: "adr-required-fields",
      severity: "fail",
      file: relativePath,
      message: "ADR is missing Date field (frontmatter 'created' or 'date')",
    });
  }

  // Check Context section
  const hasContext = /^##\s+Context/im.test(body);
  if (!hasContext) {
    results.push({
      rule: "adr-required-fields",
      severity: "fail",
      file: relativePath,
      message: "ADR is missing 'Context' section (## Context...)",
    });
  }

  // Check Decision section
  const hasDecision = /^##\s+Decision/im.test(body);
  if (!hasDecision) {
    results.push({
      rule: "adr-required-fields",
      severity: "fail",
      file: relativePath,
      message: "ADR is missing 'Decision' section (## Decision...)",
    });
  }

  return results;
}
