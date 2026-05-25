#!/usr/bin/env node
/**
 * check-workspace-fk-cascade.mjs
 *
 * CI gate: enforces ADR-0409 — all workspace_id FK references in new migration
 * files must declare ON DELETE CASCADE.
 *
 * Reads new/modified files in supabase/migrations/ (diff vs origin/main).
 * For each new migration file, searches for workspace_id FK patterns and
 * verifies they include ON DELETE CASCADE.
 *
 * Exit 0: all clear (or no new migrations).
 * Exit 1: one or more violations found.
 *
 * Usage:
 *   node scripts/check-workspace-fk-cascade.mjs
 *   pnpm check:cascade-fk
 *
 * Refs: ADR-0409, BUG-8, chair Phase 5 synthesis 2026-05-24.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations');

// ── 1. Find new/modified migration files in the current diff ─────────────────
// If running on CI (no origin/main divergence yet), fall back to checking
// all files modified relative to origin/main. If that fails, check nothing.

let changedFiles = [];
try {
  const diffOutput = execSync(
    'git diff --name-only --diff-filter=ACM origin/main...HEAD -- supabase/migrations/',
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
  changedFiles = diffOutput.length ? diffOutput.split('\n') : [];
} catch {
  // On fresh branch with no common ancestor, check all staged files
  try {
    const stagedOutput = execSync(
      'git diff --name-only --diff-filter=ACM --cached -- supabase/migrations/',
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    changedFiles = stagedOutput.length ? stagedOutput.split('\n') : [];
  } catch {
    // Nothing to check — pass silently
    process.exit(0);
  }
}

if (changedFiles.length === 0) {
  // No new migration files — pass silently
  process.exit(0);
}

// ── 2. For each new migration file, scan for workspace FK violations ──────────

/**
 * Regex explanation:
 *   workspace_id\s+      — column name with optional whitespace
 *   (uuid|UUID)\s*       — type
 *   (?:NOT NULL\s*)?     — optional NOT NULL
 *   REFERENCES\s+        — REFERENCES keyword
 *   (?:public\.)?        — optional schema prefix
 *   workspace\(workspace_id\) — table + column
 *   (?!.*ON\s+DELETE\s+CASCADE) — negative lookahead: must NOT be followed by CASCADE
 *                                  within the same statement (up to semicolon or end)
 *
 * We use a multi-line approach: read the whole file, strip comments, then search
 * for each REFERENCES statement block (ends at ; or next CREATE/ALTER TABLE).
 */

const WORKSPACE_FK_PATTERN =
  /REFERENCES\s+(?:public\.)?workspace\s*\(\s*workspace_id\s*\)/gi;

let violations = [];

for (const relPath of changedFiles) {
  const absPath = resolve(ROOT, relPath);
  if (!existsSync(absPath)) continue;

  const content = readFileSync(absPath, 'utf8');
  const fileName = basename(absPath);

  // Skip if the entire file is a backfill sweep (contains EXCEPTION WHEN OTHERS)
  // Those are ALTER TABLE + DROP CONSTRAINT patterns — the constraint being modified
  // already exists and is being upgraded; the pattern itself is not a new FK def.
  // We still check them to verify they ADD with CASCADE.
  const isSweepMigration = content.includes('EXCEPTION WHEN OTHERS THEN');

  // Find all positions of REFERENCES workspace(workspace_id)
  let match;
  WORKSPACE_FK_PATTERN.lastIndex = 0;
  while ((match = WORKSPACE_FK_PATTERN.exec(content)) !== null) {
    const pos = match.index;
    const lineNumber = content.slice(0, pos).split('\n').length;

    // Skip if this is inside a SQL comment (-- ...) or block comment (/* ... */)
    const lineStart = content.lastIndexOf('\n', pos) + 1;
    const lineText = content.slice(lineStart, content.indexOf('\n', pos));
    if (lineText.trim().startsWith('--')) continue;

    // Also skip occurrences in block comments or string literals
    // (simplified: check if preceded by /* without matching */)
    const beforeMatch = content.slice(0, pos);
    const blockCommentDepth = (beforeMatch.match(/\/\*/g) || []).length -
                              (beforeMatch.match(/\*\//g) || []).length;
    if (blockCommentDepth > 0) continue;

    // Extract the statement context: from the match position, take up to 200 chars
    // forward to check for ON DELETE CASCADE
    const statementWindow = content.slice(pos, pos + 200);

    // Also look back up to 20 chars for multi-line declarations where CASCADE
    // appears on the next line (e.g. "ON DELETE CASCADE,")
    const lookAhead = content.slice(pos, pos + 200);

    const hasOnDeleteCascade = /ON\s+DELETE\s+CASCADE/i.test(lookAhead);
    const hasOnDeleteRestrict = /ON\s+DELETE\s+RESTRICT/i.test(lookAhead);

    // In sweep migrations (ALTER TABLE ADD CONSTRAINT), verify the ADD adds CASCADE
    if (isSweepMigration) {
      // Sweep file: look for ADD CONSTRAINT ... before this REFERENCES occurrence
      const precedingContext = content.slice(Math.max(0, pos - 300), pos);
      const isInAddConstraint = /ADD\s+CONSTRAINT/i.test(precedingContext);
      if (isInAddConstraint && hasOnDeleteCascade) continue; // correct
      if (isInAddConstraint && !hasOnDeleteCascade) {
        violations.push({
          file: fileName,
          line: lineNumber,
          issue: 'ADD CONSTRAINT in sweep migration missing ON DELETE CASCADE',
          hint: 'Add ON DELETE CASCADE to the FOREIGN KEY declaration',
        });
      }
      // Non-ADD-CONSTRAINT lines in sweep files (DROP CONSTRAINT, comments) — skip
      continue;
    }

    // Regular migration: any REFERENCES workspace without CASCADE is a violation
    if (!hasOnDeleteCascade) {
      violations.push({
        file: fileName,
        line: lineNumber,
        issue: hasOnDeleteRestrict
          ? 'workspace_id FK declares ON DELETE RESTRICT — must be CASCADE (ADR-0409)'
          : 'workspace_id FK missing ON DELETE CASCADE (ADR-0409)',
        hint: 'Add ON DELETE CASCADE to: REFERENCES workspace(workspace_id)',
      });
    }
  }
}

// ── 3. Report results ──────────────────────────────────────────────────────────

if (violations.length === 0) {
  // Silent pass
  process.exit(0);
}

console.error('');
console.error('❌  check-workspace-fk-cascade: violations found');
console.error('');
console.error('ADR-0409 requires all workspace_id FK references to declare');
console.error('ON DELETE CASCADE. New migrations must include it explicitly.');
console.error('');

for (const v of violations) {
  console.error(`  FILE:  ${v.file}:${v.line}`);
  console.error(`  ISSUE: ${v.issue}`);
  console.error(`  FIX:   ${v.hint}`);
  console.error('');
}

console.error('Example correct declaration:');
console.error('  workspace_id uuid NOT NULL');
console.error('    REFERENCES workspace(workspace_id) ON DELETE CASCADE,');
console.error('');
console.error('See: docs/decisions/0409-workspace-fk-cascade-convention.md');
console.error('');

process.exit(1);
