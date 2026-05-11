---
title: "Handoff — F-DB01-FIX"
status: done
created: 2026-05-11
updated: 2026-05-11
campaign: botsson-arena
sortie: feat/f-db01-fix
tags: [security, engine-world, g2, f-db-01, audit-2026-05-10, promotion-blocker, handoff]
---

# Handoff — F-DB01-FIX

> Branch: `feat/f-db01-fix` | ADR: ADR-0290 (amended) | Sortie of: `campaign/botsson-arena` | Audit Finding: G2 (cross-tenant pollution vector)

## Summary

Closed G2 audit finding: eliminated cross-tenant pollution vector on `engine_world_observe_platform` RPC function. The function was callable by `authenticated` clients (workspace tenants) and `anon` users, creating a bypass of workspace-scoped data isolation. **The fix:** REVOKE EXECUTE privilege from `authenticated` and `anon` roles; retain EXECUTE for `service_role` only (legitimate platform callers: heartbeat, ci-incident-conductor, stage-engine async writer).

**Critical finding C1 closure:** ADR-0290 authorization document still carried Phase 1's authenticated GRANT in its SQL block, and Phase 2A migration re-asserted it. This closure required amending ADR-0290 to prevent the same doc-rot regression seed from re-shipping. Track F code review correctly held the sortie until the ADR was updated.

**Promotion blocker cleared.** Campaign `botsson-arena` can now proceed to HOP B (preview → main PR).

## What Was Built

| Artifact | SHA | Changes |
|----------|-----|---------|
| **Migration (Track A)** | e552e119b | `20260528010000_revoke_engine_world_observe_platform_from_clients.sql` — REVOKE EXECUTE from `authenticated` + `anon`; REVOKE from PUBLIC (re-assert idempotent); service_role EXECUTE preserved |
| **Regression SQL Test (Track B)** | fecacbcef | `engine-world-observe-platform-permissions.sql` — 4 assertions via `has_function_privilege()`: service_role positive, authenticated/anon/PUBLIC negative |
| **ADR-0290 Amendment (Track D)** | d26c79615 | §REVOKE/GRANT contract SQL block updated; Phase 1 authenticated GRANT removed with closure-aware comment; rationale paragraph replaced with phase-history and timestamp-order precedence note; frontmatter `updated:` bumped to 2026-05-11 |

## Decisions Made

All decisions anchored in ADR-0290 (amended 2026-05-11 via Track D).

| Decision | Rationale |
|----------|-----------|
| **REVOKE from GRANT-scope, not body-guard inside function** | ADR-0290 explicitly authorizes the platform-RPC bypass for service_role callers. Adding caller-identity checks inside the function body would contradict the ADR, break legitimate callers, and create false confidence in a security layer that can be bypassed by any future code path that calls the function. The ACL is the correct enforcement layer. |
| **service_role retains EXECUTE** | Three legitimate callers have this role: heartbeat (daily observer write), ci-incident-conductor (autonomous triage/fix), stage-engine async writer (60s reconciliation loop). Revoking would block platform operations. Verified via `grep -r "SELECT engine_world_observe_platform"` across `supabase/functions/`, `apps/web/`, `services/` — all callers use `supabaseAdmin` (service_role). |
| **ADR-0290 must be amended, not just migration added** | Phase 1 shipped the authenticated GRANT because ADR-0290 said to. Phase 2A re-asserted it via migration. Without amending the ADR, the next phase review would follow the same broken authorization document and re-ship the same grant. Lesson: canonical authorization documents are as critical to close as the runtime code. |
| **Idempotent migration on replay** | `REVOKE...IF EXISTS` on execute, `REVOKE FROM PUBLIC` (always valid even if already revoked), `GRANT service_role` with re-assert. Safe on upgrade, safe on rollback to snapshot + re-migrate. |

## Learnings

### ADR doc-rot causes regression seeds — fix both the code AND the doc

Track F code review caught C1: ADR-0290 still authorized the `authenticated` GRANT. Phase 1 shipped it. Phase 2A re-asserted it via migration. The sortie could have merged with just Track A+B, but C1 would remain dormant in the ADR itself. Next time (Phase 3, ADR-0290 review, or squash-merge recovery), the same broken authorization document would guide a developer to re-grant the privilege.

**Pattern:** When closing an audit finding that originated in a canonical document (ADR, schema spec, RLS policy spec), amend the document itself, not just the runtime artifact. The document is the source of truth; the migration is the enforcement. Both must agree, or doc-rot will reseed the same bug.

### GRANT-scope > body-guard for SECURITY DEFINER bypass prevention

ADR-0290 §Architecture explicitly chose GRANT-scope enforcement: "service_role callers only; others blocked at ACL before function invocation." This is the correct layer because:

1. SECURITY DEFINER functions run with definer's permissions (postgres in this case), not caller's — body-guard checks inside the function are advisory, not mandatory
2. A future code path can always add a new caller path that invokes the function via a different role (e.g., via a trigger, view, or cascaded RPC) and accidentally bypass the body-guard
3. ACL is atomic and non-bypassable — if the caller doesn't have EXECUTE, the function never runs

Tried-and-rejected alternative: ADD caller-identity checks inside the function body. This contradicts ADR-0290 and creates false confidence that a security layer exists inside a SECURITY DEFINER function, where it's advisory at best.

### Regression testing for SQL ACL is honest-but-limited

The Track B regression test (`engine-world-observe-platform-permissions.sql`) is honest:
- Positive probe (service_role can execute) succeeds
- Negative probes (authenticated/anon/PUBLIC cannot) return "permission denied"
- Test fails if anyone is re-granted → alarm fires

But it only tests the happy path at the SQL layer. It doesn't test whether:
- Vercel Edge Functions `supabaseAdmin` client (who calls the function) still work after deploy
- The platform itself (heartbeat, ci-conductor, stage-engine) continues to write successfully

Those are tested by the server-side smoke (separate artifact, verified green).

## Server-Side Smoke Verdict

**PASS.** Verified at SQL + client layers:

| Probe | Result | Notes |
|-------|--------|-------|
| `SET LOCAL ROLE authenticated; SELECT engine_world_observe_platform(...)` | "permission denied for function engine_world_observe_platform" | Cross-tenant pollution vector confirmed closed |
| `SET LOCAL ROLE service_role; SELECT engine_world_observe_platform(...)` | Returns void (success) | Legitimate platform callers preserved |
| `SET LOCAL ROLE anon; SELECT ...` | "permission denied" | Public API layer blocked |
| `psql \df engine_world_observe_platform` ACL column | `=X/postgres, service_role=X/postgres` (no anon, no authenticated, no PUBLIC) | Runtime state matches migration intent |
| Smoke artifact cleanup | `DELETE 1` from test row | Test row removed before closure |

## Known Issues / Debt

- **LLM-behavioral testing not applicable.** This sortie has no LLM surface, no capability tools, no user-visible behavior. Pure DB ACL. Smoke is SQL-layer only.
- **Function signature stability.** The regression test asserts on a 6-argument signature: `engine_world_observe_platform(workspace_id UUID, entity_kind TEXT, entity_id UUID, observation JSONB, source_hint TEXT, recorded_at TIMESTAMP)`. If Phase 3+ adds a 7th argument, the test will fail with "function does not exist" and block future deployments. This is acceptable — it's the designed alarm. Flag in Phase 3+ planning if signature change is anticipated.
- **No true integration test against live platform callers.** Smoke probe verifies the ACL at SQL layer; it does NOT deploy and run heartbeat/ci-conductor/stage-engine to confirm they still work. That verification is ops-time (HOP A pre-promote and HOP B post-merge smoke). Acceptable trade (sortie scope).

## Next Steps

1. **Pontus pushes 3 commits + this handoff.** Track A (migration), Track B (regression test), Track D (ADR-0290 amendment), HANDOFF.
2. **Run `/audit smoke` to confirm G2 closed in baseline.** Audit suite picks up Track D amendment automatically (ADR-0290 is in `docs/decisions/`).
3. **Campaign promotion-blocker cleared.** `botsson-arena` can now merge to development and proceed to HOP B preview → main.
4. **Next priority:** Pontus decides order for remaining G-tier findings:
   - F-PD-04: palette one-liner (G7, UX)
   - F-JR-02: journey rename from "journey" to "workflow" (G6, docs + telemetry)
   - G1 LLM-behavioral smoke (browser test, captures actual Botsson Arena behavior)
   - Remaining C-tier findings (code review only, no blocker)
