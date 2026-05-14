---
title: "Plan — Audit cleanup MEDIUM + LOW bundle"
feature: audit-cleanup-mediums
status: draft
created: 2026-05-14
updated: 2026-05-14
module: cross-cutting
tags: [audit, edge-function, rls, F-EF-06, F-EF-07, F-EF-08, F-DB-13, F-DB-14, F-DB-15, ADR-0029]
---

# Plan — Audit cleanup MEDIUM + LOW bundle

## Source

`docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` — 6 findings (2 MEDIUM + 4 LOW excluded F-EF-09 CORS).

## Findings

| ID | Severity | File | Fix class |
|---|---|---|---|
| F-EF-06 | MEDIUM | `supabase/functions/activate-workspace/index.ts` | Replace `error.message` in response with `"internal"`; log full via `console.error` |
| F-EF-07 | LOW | `supabase/functions/heartbeat-dispatcher/index.ts` | Same pattern (cron-only, low blast) |
| F-EF-08 | LOW | `supabase/functions/google-places-intelligence/index.ts` | Flip HTTP 200 + `{success:true, error}` to HTTP 500 + `{success:false, error:"internal"}` |
| F-DB-13 | MEDIUM | `supabase/migrations/20260603000000_overtime_cap_policy.sql` | Add `api_key_read_overtime_cap_policy` RLS via new migration |
| F-DB-14 | LOW | `supabase/migrations/20260428220006_tips_workspace_settings.sql:42` | Add WITH CHECK to UPDATE policy via new migration |
| F-DB-15 | LOW | `supabase/migrations/20260515120300_agent_session_whisper.sql:33` | Split FOR ALL into per-verb with WITH CHECK via new migration |

## S-acceptance (falsifiable)

| ID | Criterion |
|---|---|
| S1 | F-EF-06: activate-workspace 500 body has no `error.message` PG string; full error in `console.error` |
| S2 | F-EF-07: heartbeat-dispatcher same as S1 |
| S3 | F-EF-08: google-places-intelligence exception → HTTP 500 + opaque error body |
| S4 | F-DB-13: new migration adds `api_key_read_overtime_cap_policy` policy mirroring other dual-auth tables |
| S5 | F-DB-14: new migration adds `WITH CHECK` matching USING expression on tips_workspace_settings UPDATE |
| S6 | F-DB-15: agent_session_whisper FOR ALL replaced with FOR SELECT/INSERT/UPDATE/DELETE policies, each with WITH CHECK where applicable |
| S7 | Vitest/Deno: at least 1 test per EF fix asserts response shape (no PG leak) |
| S8 | All 3 migrations apply clean (no rollback needed; SQL syntax + idempotency check) |
| S9 | 6 findings marked CLOSED in `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` with commit SHA |
| S10 | Web typecheck green |
| S11 | Handoff written |

## Council escalation triggers

- F-DB-15 split: if `agent_session_whisper` has admin-only RLS, FOR ALL may be intentional (admin trust model); council before changing
- F-DB-13: if `overtime_cap_policy` is platform-level (no workspace_id), api_key_read pattern doesn't apply — different fix required; council before migration

## Non-goals

- F-EF-09 (CORS cleanup) — different class (dead-code review surface)
- Refactor _shared helpers — stay surgical

## Touched files (expected)

EF:
- `supabase/functions/activate-workspace/index.ts`
- `supabase/functions/heartbeat-dispatcher/index.ts`
- `supabase/functions/google-places-intelligence/index.ts`
- 1 vitest/deno test per

Migrations:
- `supabase/migrations/<ts>_api_key_read_overtime_cap_policy.sql`
- `supabase/migrations/<ts>_tips_workspace_settings_with_check.sql`
- `supabase/migrations/<ts>_agent_session_whisper_per_verb.sql`

Docs:
- `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` — close 6 findings
- `docs/journeys/JOURNEY-audit-cleanup-mediums-error-leaks-fixed.md`
- `docs/journeys/JOURNEY-audit-cleanup-mediums-rls-tightened.md`
- `docs/HANDOFF-audit-cleanup-mediums.md`

## Risk

LOW — all 6 are pattern-fixes with proven precedents (F-WH-01 closed error leak, A.2 closed WITH CHECK gap, ADR-0029 dual-auth pattern documented). Worst case: migration order conflict on overtime_cap_policy — caught by `supabase db reset` test.
