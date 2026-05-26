// Shared helpers for live-invoke smoke scripts.
// Pattern: each <domain>.mjs imports `client`, `assertOk`, `header`, `result`.

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || v.startsWith("op://")) {
    console.error(`[live-invoke] ENV missing or unresolved: ${name}`);
    console.error(`             Wrap with: op run --env-file=.env.template -- node ...`);
    process.exit(2);
  }
  return v;
}

export function client(role = "service") {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    role === "service"
      ? requireEnv("SUPABASE_SERVICE_ROLE_KEY")
      : requireEnv("SUPABASE_ANON_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function header(domain) {
  console.log("");
  console.log(`━━━ live-invoke: ${domain} ━━━`);
  console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log("");
}

let passed = 0;
let failed = 0;
const failures = [];

export function assertOk(label, { data, error, status }) {
  if (error) {
    failed++;
    failures.push({ label, error: error.message, code: error.code, hint: error.hint });
    console.log(`  ✗ ${label}`);
    console.log(`    error: ${error.message}`);
    if (error.code) console.log(`    code:  ${error.code}`);
    if (error.hint) console.log(`    hint:  ${error.hint}`);
    return false;
  }
  if (status && status >= 400) {
    failed++;
    failures.push({ label, status });
    console.log(`  ✗ ${label} (HTTP ${status})`);
    return false;
  }
  passed++;
  const shape = Array.isArray(data) ? `array[${data.length}]` : typeof data;
  console.log(`  ✓ ${label} → ${shape}`);
  return true;
}

export function assertShape(label, data, requiredKeys = []) {
  if (!Array.isArray(data) || data.length === 0) {
    // empty result is fine — signature already validated by absence of error
    console.log(`  · ${label} → empty (signature OK)`);
    passed++;
    return true;
  }
  const sample = data[0];
  const missing = requiredKeys.filter((k) => !(k in sample));
  if (missing.length > 0) {
    failed++;
    failures.push({ label, missing });
    console.log(`  ✗ ${label} — missing keys: ${missing.join(", ")}`);
    console.log(`    sample keys: ${Object.keys(sample).join(", ")}`);
    return false;
  }
  passed++;
  console.log(`  ✓ ${label} (shape OK; ${requiredKeys.length} keys present)`);
  return true;
}

export function result() {
  console.log("");
  console.log(`━━━ ${passed} passed · ${failed} failed ━━━`);
  if (failed > 0) {
    console.log("");
    console.log("Failures:");
    failures.forEach((f) => console.log("  -", JSON.stringify(f)));
    process.exit(1);
  }
  process.exit(0);
}
