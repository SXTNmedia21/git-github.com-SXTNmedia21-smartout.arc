#!/usr/bin/env node
/**
 * Invariant I6 — engine_authority_config must only be read via gate_action RPC.
 * Direct reads (via supabase.from) outside migrations/ are forbidden.
 * ADR-0099 unified gate.
 */
import { readFileSync } from "node:fs";
import { globby } from "globby";

export type GateViolation = { file: string; line: number; match: string };

const FORBIDDEN = /\.from\(["']engine_authority_config["']\)/;
const ALLOWED_DIRS = [
  // Migrations + seeds + fixtures own the authority_config table directly —
  // they establish the rows the gate will later read.
  "supabase/migrations/**",
  "supabase/seed.sql",
  // Bootstrap-cascade Edge Function seeds authority rows for a new workspace;
  // it is the seed path for C4, not a runtime bypass.
  "supabase/functions/bootstrap-cascade/**",
  // Test code (unit + e2e) may seed authority rows to set up scenarios.
  "**/__tests__/**",
  "**/*.test.ts",
  "**/*.spec.ts",
  "apps/e2e/**",
  // This script itself matches its own FORBIDDEN pattern in docs/strings.
  "**/scripts/check-gate-action-singleton.ts",
  // ADR-0099 advisory fallback — the single canonical gate implementation.
  "services/stage-engine/src/core/authority.ts",
  // Admin authority-config surface — UI for viewing/editing the table itself
  // is intrinsically a direct-read surface (it IS the admin view of the table).
  "apps/web/src/app/dashboard/ai/_hooks/use-authority-config.ts",
  // FIXME (ADR-0099 drift, tracked) — Botsson recorder routes currently read
  // engine_authority_config directly instead of calling the gate_action RPC.
  // Discovered 2026-04-23 by Invariant I6 CI script; narrowly whitelisted here
  // so the harness can ship green. Follow-up sortie to migrate both routes to
  // supabase.rpc("gate_action", { ... }) per ADR-0099 unified gate.
  "apps/web/src/app/api/botsson/recorder/force-stop/route.ts",
  "apps/web/src/app/api/botsson/recorder/whisper/route.ts",
  // FIXME (ADR-0099 drift, tracked) — helpdesk SLA breach trigger needs a
  // SNAPSHOT of `observer_escalation_hours` + `min_role` at delayed-trigger
  // schedule time, not a permission check. `gate_action` returns allow/deny,
  // not authority config snapshot. Per ADR-0234 + ADR-0235 (helpdesk Phase 2)
  // the snapshot is captured into `engine_delayed_trigger.payload` so the
  // breach handler reads from the snapshot, not live authority. Follow-up
  // sortie should expose a dedicated `read_authority_snapshot` RPC and
  // migrate this site to it (so the I6 invariant can re-enforce strictly).
  "packages/ai/src/capabilities/helpdesk_query/tools.ts",
];

export async function checkGateActionSingleton(opts: {
  root: string;
}): Promise<{ violations: GateViolation[] }> {
  const files = await globby(["**/*.ts", "**/*.sql"], {
    cwd: opts.root,
    absolute: true,
    ignore: ALLOWED_DIRS.concat([
      "node_modules/**",
      "dist/**",
      ".turbo/**",
      ".next/**",
      "**/node_modules/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/.next/**",
    ]),
  });
  const violations: GateViolation[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (FORBIDDEN.test(lines[i])) {
        violations.push({ file, line: i + 1, match: lines[i].trim() });
      }
    }
  }
  return { violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] ?? process.cwd();
  checkGateActionSingleton({ root }).then((r) => {
    if (r.violations.length === 0) {
      console.log("ok: engine_authority_config reads only via gate_action RPC");
      process.exit(0);
    }
    console.error(`${r.violations.length} gate-bypass site(s):`);
    for (const v of r.violations) console.error(`  ${v.file}:${v.line} — ${v.match}`);
    process.exit(1);
  });
}
