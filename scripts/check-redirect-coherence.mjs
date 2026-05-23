#!/usr/bin/env node
/**
 * Redirect-coherence guard (ADR-0393).
 *
 * When mobile calls supabase.auth.resetPasswordForEmail (or any future
 * GoTrue method) with a `redirectTo` URL pointing to a native `/m/` route,
 * the corresponding email template contains an exact-match Go-template
 * conditional:
 *
 *   {{ if eq .RedirectTo `<url>` }} ... {{ else }} ... {{ end }}
 *
 * If these two URL strings ever diverge — even by a single trailing slash or
 * protocol casing — the Go `eq` comparison silently returns false, the mobile
 * branch is never taken, and mobile users land on the web flow with no error.
 * There is no runtime signal; the degradation is invisible.
 *
 * This script asserts that each mobile `redirectTo` literal byte-equals the
 * corresponding template `eq` sentinel. It is the sister check to
 * check-otp-coherence.mjs (ADR-0389) and lives on the same husky pre-push hook.
 *
 * Registry extension: when a NEW mobile auth flow adds an email redirectTo →
 * native `/m/` screen, add one entry to the PAIRS array below:
 *   {
 *     name: "<human-readable label for error messages>",
 *     mobileFile: "<repo-relative path to the .tsx file>",
 *     mobileRegex: /<regex capturing the URL string as group 1>/,
 *     templateFile: "<repo-relative path to the email template HTML file>",
 *     templateRegex: /<regex capturing the sentinel URL in backticks as group 1>/,
 *   }
 *
 * Scope boundary (ADR-0393): only GoTrue `redirectTo` → `{{ if eq .RedirectTo }}` pairs
 * are registered here. Invite flows that use a custom `invitation` table token
 * + plain `/invite/<token>` Universal Link do NOT belong here — they are not
 * conditional template branches. See ADR-0393 for the full recon finding.
 *
 * Exit 0 = all pairs coherent, 1 = drift or extraction failure (fails pre-push + CI).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// ─── Registry ────────────────────────────────────────────────────────────────
// One entry per (mobile redirectTo → email template eq sentinel) pair.
// Both sides must be byte-equal for the GoTrue conditional to fire correctly.

const PAIRS = [
  {
    // Password-reset flow: mobile triggers resetPasswordForEmail with a
    // Universal-Link redirectTo; the template routes to the native update-password
    // screen instead of the web callback. ADR-0390 + ADR-0393.
    name: "reset",
    mobileFile: "apps/mobile/app/(auth)/verify.tsx",
    mobileRegex: /resetPasswordForEmail\([^)]*redirectTo:\s*["'`]([^"'`]+)["'`]/s,
    templateFile: "supabase/email-templates/reset-password",
    templateRegex: /\{\{\s*if\s+eq\s+\.RedirectTo\s+`([^`]+)`/,
  },
];

// ─── Runner ───────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`\x1b[31m✗ Redirect coherence: ${msg}\x1b[0m`);
  process.exit(1);
}

let allPassed = 0;

for (const pair of PAIRS) {
  const mobileContent = readFileSync(join(root, pair.mobileFile), "utf8");
  const templateContent = readFileSync(join(root, pair.templateFile), "utf8");

  const mobileMatch = mobileContent.match(pair.mobileRegex);
  if (!mobileMatch) {
    fail(
      `[${pair.name}] could not extract redirectTo URL from ${pair.mobileFile} — ` +
        `has the call signature changed? Update mobileRegex in PAIRS (ADR-0393).`,
    );
  }

  const templateMatch = templateContent.match(pair.templateRegex);
  if (!templateMatch) {
    fail(
      `[${pair.name}] could not extract eq sentinel from ${pair.templateFile} — ` +
        `has the conditional been removed or reformatted? Update templateRegex in PAIRS (ADR-0393).`,
    );
  }

  const mobileUrl = mobileMatch[1];
  const templateUrl = templateMatch[1];

  if (mobileUrl !== templateUrl) {
    fail(
      `[${pair.name}] drift detected — mobile redirectTo and template eq sentinel differ:\n` +
        `  mobile   (${pair.mobileFile}):\n    "${mobileUrl}"\n` +
        `  template (${pair.templateFile}):\n    "${templateUrl}"\n` +
        `Both strings must be byte-equal. See ADR-0390 + ADR-0393.`,
    );
  }

  console.log(
    `\x1b[32m✓ Redirect coherence [${pair.name}]: mobile == template == "${mobileUrl}"\x1b[0m`,
  );
  allPassed++;
}

console.log(
  `\x1b[32m✓ Redirect coherence: ${allPassed}/${PAIRS.length} pair(s) coherent (ADR-0393)\x1b[0m`,
);
