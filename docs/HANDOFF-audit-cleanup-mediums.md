---
title: "Handoff — Audit cleanup MEDIUM + LOW bundle"
feature: audit-cleanup-mediums
status: done
created: 2026-05-14
updated: 2026-05-14
module: cross-cutting
tags: [audit, edge-function, rls, F-EF-06, F-EF-07, F-EF-08, F-DB-13, F-DB-14, F-DB-15]
---

# Handoff — Audit cleanup MEDIUM + LOW bundle

## Summary

6 findings from `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md` closed in single sortie. All mechanical pattern-fixes following proven precedents (F-WH-01 error-leak, A.2 WITH CHECK sister-sweep, ADR-0029 dual-auth).

## Findings closed

| ID | Severity | File | Fix |
|---|---|---|---|
| F-EF-06 | MEDIUM | `supabase/functions/activate-workspace/index.ts` | catch → `console.error` + `{error:"internal"}` 500 |
| F-EF-07 | LOW | `supabase/functions/heartbeat-dispatcher/index.ts` | same pattern |
| F-EF-08 | LOW | `supabase/functions/google-places-intelligence/index.ts` | flip HTTP 200 envelope → 500 + opaque body |
| F-DB-13 | MEDIUM | new migration `20260616100000_api_key_read_overtime_cap_policy.sql` | add `api_key_read_overtime_cap_policy` policy mirroring staff_event template |
| F-DB-14 | LOW | new migration `20260616100100_tips_workspace_settings_with_check.sql` | DROP + recreate UPDATE policy with WITH CHECK matching USING |
| F-DB-15 | LOW | new migration `20260616100200_agent_session_whisper_per_verb.sql` | DROP FOR ALL → 4 per-verb policies with WITH CHECK on INSERT/UPDATE; godmode_rw_whisper preserved per ADR-0185 |

## Decisions

1. **F-EF-09 (CORS cleanup) deferred** — different class, dead-code review surface; separate sortie when CORS audit prioritized.
2. **godmode_rw_whisper preserved** (F-DB-15) — ADR-0185 explicitly grants platform-admin cross-workspace visibility. Per-verb split applied only to workspace-admin path.
3. **Migration timestamps `20260616*`** — sequential after most recent migration on dev (`20260614120000_session_task_insert_with_check.sql` draft + landed contracts cluster).

## Learnings

- **Error-leak pattern is now proven 4×** — F-WH-01 (docuseal), F-WH-02 (livekit env), F-EF-06/07/08 in this sortie. Same shape: `console.error(err)` server-side, return opaque `{ error: "internal" }` to caller, status 500. Ready to be promoted to ESLint rule or `_shared/error-response.ts` helper if 1 more instance surfaces.
- **WITH CHECK sister-sweep audit gap** — A.2 + A.3 closed D6 sister tables (department_session, staff_event, etc) but did NOT extend to `tips_workspace_settings` (non-D6 governance) or `agent_session_whisper` (admin metadata). ADR-0303 sister-sweep scope was D6-only; this sortie shows the gap class exists outside D6 too. Consider extending ADR-0303 or shipping `scripts/check-rls-with-check.ts` to cover all workspace-scoped UPDATE/ALL policies, not just D6.

## Known issues / debt

- No pgTAP test for F-DB-14/15 forge attempt — relies on migration apply + manual review. Could add follow-up sortie if RLS regression risk rises.
- F-DB-13 verified via SQL inspection only; smoke pgTAP test would harden.

## Next steps

- Smoke audit re-run (`/audit smoke`) to verify all 6 findings CLOSED post-merge.
- Consider extending ADR-0303 scope to all workspace-scoped tables (not just D6).
- F-EF-09 CORS sortie at next batch.

## References

- Plan: `docs/plans/PLAN-audit-cleanup-mediums.md`
- Journeys: `JOURNEY-audit-cleanup-mediums-error-leaks-fixed.md`, `JOURNEY-audit-cleanup-mediums-rls-tightened.md`
- Audit source: `docs/audits/2026-05-14-adr-contract-validation/00-SUMMARY.md`
- Precedents: F-WH-01 (`23538c2ec`), A.2 D6 sister-sweep (`20a573288`), ADR-0029 dual-auth, ADR-0185 godmode whisper
