#!/usr/bin/env node
// Pre-commit guard per ADR-0396.
// Rejects staged migrations that ADD identity-class columns to public.profile.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FORBIDDEN = [
  "phone",
  "personal_email",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "date_of_birth",
];

const stagedSql = execSync('git diff --cached --name-only --diff-filter=AM', { encoding: 'utf8' })
  .split('\n')
  .filter(p => p.startsWith('supabase/migrations/') && p.endsWith('.sql'));

let violations = 0;
for (const file of stagedSql) {
  const body = readFileSync(file, 'utf8');
  // Match: ALTER TABLE …profile … ADD COLUMN … <forbidden>
  const re = new RegExp(
    `ALTER\\s+TABLE\\s+(?:public\\.)?profile\\b[\\s\\S]*?ADD\\s+COLUMN[\\s\\S]*?\\b(${FORBIDDEN.join('|')})\\b`,
    'i',
  );
  const m = body.match(re);
  if (m) {
    console.error(`✗ ${file}: ALTER profile adds identity-class column '${m[1]}' — forbidden per ADR-0396.`);
    console.error(`  Move it to user_identity, or override with an explicit ADR.`);
    violations++;
  }
}
if (violations > 0) process.exit(1);
process.exit(0);
