---
title: "Plan — audit-fef03-intelligence-ef-auth"
feature: audit-fef03-intelligence-ef-auth
spec: ../audits/2026-05-13-adr-contract-validation/03-edge-functions.md
status: draft
updated: 2026-05-13
created: 2026-05-13
module: edge-functions
tags: [plan, audit, edge-functions, auth, security, f-ef-03]
---

# Plan — audit-fef03-intelligence-ef-auth

> Branch: `feat/audit-fef03-intelligence-ef-auth` | Worktree: `~/dev/smartout.ai-wt-11` | Module: edge-functions

**Spec:** [Slice 03 — edge-functions audit](../audits/2026-05-13-adr-contract-validation/03-edge-functions.md) + [synthesis F-EF-03](../audits/2026-05-13-adr-contract-validation/00-SYNTHESIS.md)

## Background

Audit 2026-05-13 F-EF-03 (HIGH/ops-critical money vector): Five intelligence Edge Functions have `verify_jwt = false` AND zero internal auth check AND no signature verification:
- `gather-workspace-intelligence`
- `google-places-intelligence`
- `web-search-intelligence`
- `scrape-website`
- `search-brreg`

Each proxies a paid external API (Scrapling, Serper, Google Places, Brreg). Open-internet POST endpoint burns Smartout's quotas. Active money/abuse vector — not theoretical.

## Journeys (the contract)

- [JOURNEY-audit-fef03-unauthenticated-post-rejected](../journeys/JOURNEY-audit-fef03-unauthenticated-post-rejected.md) — Anonymous POST to any of 5 EFs → 401/403, no external API call made
- [JOURNEY-audit-fef03-authenticated-bff-request-accepted](../journeys/JOURNEY-audit-fef03-authenticated-bff-request-accepted.md) — Authenticated request from web BFF or wizard route → succeeds, external API call proceeds
- [JOURNEY-audit-fef03-quota-burn-vector-closed](../journeys/JOURNEY-audit-fef03-quota-burn-vector-closed.md) — Audit synthesis F-EF-03 row marked CLOSED, telemetry shows auth-failure metric

## Goal

Add auth perimeter to 5 intelligence Edge Functions. Close F-EF-03. Stop quota burn vector. Match auth model to existing precedent in codebase (workspace-api gateway pattern, ADR-0123 pre-workspace exception, internal-call pattern).

## Tasks

- [ ] T1 Design surface audit — map existing auth precedents in supabase/functions/*. Identify pattern used by similar callers (BFF-from-web vs cron vs webhook). Output: design brief + council recommendation OR ship-decision.
- [ ] T2 If T1 says ship-decision: apply auth pattern to 5 EFs. Each: shared HMAC OR internal-bearer OR JWT-from-web verification — whichever the design brief lands on.
- [ ] T3 Update audit synthesis + ADR if pattern is new. Reference ADR-0179 (browser→EF rule) + ADR-0029 (EF security).
- [ ] T5 Verify: anon POST returns 401 + authenticated BFF request still works + caller code paths updated.

## Acceptance Criteria (falsifiable)

- [ ] **S1** All 5 EFs reject unauthenticated POST with 401 (curl test)
- [ ] **S2** Web BFF callers (Vercel route handlers calling these EFs) still succeed after auth wrap
- [ ] **S3** No browser code invokes these EFs directly (search `apps/web/`, `apps/landing/` for `supabase.functions.invoke("<each-ef-name>")` — should be 0 hits OR migrated through BFF)
- [ ] **S4** ADR-0179 / ADR-0029 not violated by chosen pattern
- [ ] **S5** Telemetry event `edge_function.auth_failure` emitted on rejection (for ops visibility)
- [ ] **S6** Audit synthesis F-EF-03 marked CLOSED with branch ref
- [ ] **S7** `pnpm turbo typecheck` 0 errors
- [ ] **S8** All 3 declared journeys `status: verified`
- [ ] **S9** Locally tested: dummy unauth POST returns 401 + dummy auth POST returns 200

## Council escalation triggers (HIGH probability)

This sortie WILL need council on T1 output. Auth model has multiple valid options:
1. **HMAC shared secret** — caller signs request body with shared secret + timestamp
2. **Internal-bearer** — call passes service-account JWT in Authorization header, EF verifies
3. **Signed-from-web-BFF** — only callable from Vercel BFF via signed proxy header
4. **Workspace-api gateway** — route through existing gateway with ADR-0039 dual-auth

Council brief required if T1 cannot find clear precedent. Council question framed: "Which auth model for intelligence EFs?"

## Out of scope

- Rate-limiting on these EFs (follow-up sortie)
- Migrating callers from EF→BFF (per F-EF-04 — separate sortie)
- Sentry instrumentation
- Cost dashboard for external API quotas
- Other unauthed EFs not in F-EF-03 scope
