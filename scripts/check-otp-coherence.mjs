#!/usr/bin/env node
/**
 * OTP length coherence check (ADR-0389).
 *
 * The login code field renders exactly OTP_LENGTH boxes. GoTrue mints a code of
 * `otp_length` digits. If they differ, a user can only type part of a valid code
 * and verify returns 403 — a silent prod outage (2026-05-22: GoTrue=8, form=6).
 *
 * This asserts the two CODE-side sources agree:
 *   - supabase/config.toml          [auth.email] otp_length
 *   - OtpVerificationForm.tsx        const OTP_LENGTH
 *
 * It CANNOT see the prod Supabase dashboard value — that is enforced by docs
 * (ADR-0389) + the warning in config.toml. Keep prod dashboard OTP Length = 6.
 *
 * Exit 0 = coherent, 1 = drift (fails CI).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(msg) {
  console.error(`\x1b[31m✗ OTP coherence: ${msg}\x1b[0m`);
  process.exit(1);
}

const configToml = readFileSync(join(root, "supabase/config.toml"), "utf8");
const webForm = readFileSync(
  join(root, "apps/web/src/components/auth/OtpVerificationForm.tsx"),
  "utf8",
);
const mobileVerify = readFileSync(
  join(root, "apps/mobile/app/(auth)/verify.tsx"),
  "utf8",
);

// First otp_length under [auth.email]
const cfgMatch = configToml.match(/otp_length\s*=\s*(\d+)/);
const webMatch = webForm.match(/const\s+OTP_LENGTH\s*=\s*(\d+)/);
const mobileMatch = mobileVerify.match(/const\s+OTP_LENGTH\s*=\s*(\d+)/);

if (!cfgMatch) fail("could not find otp_length in supabase/config.toml");
if (!webMatch) fail("could not find OTP_LENGTH in web OtpVerificationForm.tsx");
if (!mobileMatch) fail("could not find OTP_LENGTH in mobile app/(auth)/verify.tsx");

const sources = {
  "config.toml otp_length": Number(cfgMatch[1]),
  "web OtpVerificationForm OTP_LENGTH": Number(webMatch[1]),
  "mobile verify.tsx OTP_LENGTH": Number(mobileMatch[1]),
};

const values = [...new Set(Object.values(sources))];
if (values.length !== 1) {
  fail(
    `drift — ${Object.entries(sources)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}. All must be equal (and prod dashboard OTP Length must match too). See ADR-0389.`,
  );
}

console.log(
  `\x1b[32m✓ OTP coherence: config.toml = web = mobile OTP length = ${values[0]} (ADR-0389)\x1b[0m`,
);
