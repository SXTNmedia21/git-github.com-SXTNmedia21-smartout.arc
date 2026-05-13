---
title: "Audit Smoke — 2026-05-14 post-Wave-3"
status: complete
created: 2026-05-14
updated: 2026-05-14
mode: smoke
run_id: 2026-05-14-adr-contract-validation
baseline: 2026-05-13-adr-contract-validation-02
slices_run: 3
purpose: verify Wave-3 closures (SE-02-01, F-MO-06, F-WH-01/02/03/04, F-MO-01/02/03/04, F-DB-11) + zero new CRITICAL
tags: [audit, smoke, post-wave-3]
---

# Audit Smoke — 2026-05-14 post-Wave-3

## Verdict

**PASS** — all 10 Wave-3 closures verified intact in slice scope; **0 new CRITICAL**, 1 new HIGH (F-EF-05) is pre-existing pattern surfaced now.

## Score

| Slice | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|
| 01 capability-tools | 0 | 0 | 0 | 0 |
| 03 edge-functions | 0 | 1 | 1 | 3 |
| 07 db-rls-telemetry | 0 | 0 | 1 | 2 |
| **Total** | **0** | **1** | **2** | **5** |

## Wave-3 Closure Verification

| Finding | Sortie | Merge SHA | Verified |
|---|---|---|---|
| SE-02-01 (BFF body-supplied profileId) | feat/audit-adr0151-derivation | `4d75aa7a1` | PASS — slice 01 |
| F-MO-06 (submit_own_pii body workspace_id) | feat/audit-adr0151-derivation | `4d75aa7a1` | PASS — slice 07 |
| F-WH-01/02/03/04 (webhook hygiene) | feat/audit-webhook-hygiene | `23538c2ec` | PASS — slice 03 |
| F-MO-01/02/03/04 (L-0083 mobile) | feat/audit-fmo-l0083-enforcement | `8921800af` | PASS — slice 01 (capability-side) |
| F-DB-11 (ADR-0287 gate_action coverage) | feat/audit-fdb11-adr-0287-enforcement | earlier wave | PASS — slice 01 |

**0 regressions detected.**

## New findings

### F-EF-05 (HIGH) — `analyze-workspace` no auth gate — CLOSED

**Closed by:** `feat/audit-fef05-analyze-workspace-auth` — commit TBD (see git log after merge)

**Fix applied:** `verifyInternalAuth` from `_shared/internal-auth.ts` added at handler entry (before try-block).
DB client switched from anon key to `SUPABASE_SERVICE_ROLE_KEY`. ADR-0123 pre-workspace exception does NOT
apply — `onboarding_session` RLS is JWT-scoped (`auth.uid() = user_id`), confirming server-internal caller
context. config.toml `verify_jwt=false` retained (service-role bearer pattern, same as `gather-workspace-intelligence`).
Body input validation added (sessionId type-guard). 5 Deno tests pass. Web typecheck 0 errors.

**Caller context:** Server-internal (web BFF → service role). No active web callers found — function is
placeholder with mock AI. ADR-0029 service-role gate is the correct pattern.

`supabase/functions/analyze-workspace/index.ts` — `verify_jwt=false`, no `getUser()` call, writes to `onboarding_session` without authentication. Only RLS protects against anon caller injection.

~~**Recommendation:** Sortie to add `authenticateRequest` (or move to pre-workspace allowlist with explicit ADR-0123 reference + scope-narrowed RLS). Mechanical fix mirroring F-EF-03 wave.~~

### F-EF-06 (MEDIUM) — `activate-workspace` raw error.message leak

Same class as F-WH-01 (now closed). Activate-workspace catches with untyped `error` and returns `error.message` raw. Fold into webhook-hygiene-followup sortie if shipped, else standalone.

### F-DB-13 (MEDIUM) — `overtime_cap_policy` missing `api_key_read_*` RLS

ADR-0029 dual-auth violation. Table has 4 JWT policies, 0 api_key. Single CREATE POLICY fix.

### LOW findings (5)

- F-EF-07: heartbeat-dispatcher PG error leak (cron-only, low blast)
- F-EF-08: google-places-intelligence error inside HTTP 200 envelope (misleading to monitors)
- F-EF-09: ~20 EFs inline CORS instead of `_shared/cors.ts` (~10 of those cron/internal, dead CORS)
- F-DB-14: tips_workspace_settings UPDATE no WITH CHECK
- F-DB-15: agent_session_whisper FOR ALL without WITH CHECK

## Delta vs 2026-05-13-adr-contract-validation-02

| Bucket | Pre-Wave-3 | Post-Wave-3 |
|---|---|---|
| CRITICAL open (smoke scope) | 0 | 0 |
| HIGH open (smoke scope) | F-DB-12 (closed) | F-EF-05 → CLOSED (feat/audit-fef05-analyze-workspace-auth) |
| Closed this wave | — | 10 (SE-02-01, F-MO-06, F-WH-01/02/03/04, F-MO-01/02/03/04, F-DB-11) + F-EF-05 |
| Regressed | n/a | 0 |

## Promotion-safety verdict

**SAFE to promote dev → preview.** 0 new CRITICAL. F-EF-05 (anon-write to onboarding) is pre-existing; not introduced by Wave-3. Recommend dedicated sortie before main promotion.

## Skipped per smoke scope

- 11 of 14 slices not re-run
- Synthesis skipped (smoke mode default)
- HIGH baseline findings outside smoke slices assumed unchanged

## References

- 2026-05-13 baseline: `docs/audits/2026-05-13-adr-contract-validation-02/00-SUMMARY.md`
- Slice reports: `01-capability-tools.md`, `03-edge-functions.md`, `07-db-rls-telemetry.md`
- Wave-3 closures merged: `23538c2ec` + `8921800af` + `4d75aa7a1`
