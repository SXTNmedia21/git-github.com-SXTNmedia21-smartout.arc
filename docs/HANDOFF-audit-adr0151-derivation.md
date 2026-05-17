---
title: "Handoff — audit-adr0151-derivation"
feature: audit-adr0151-derivation
status: done
updated: 2026-05-14
created: 2026-05-14
module: cross-cutting
tags: [handoff, adr-0151, se-02-01, f-mo-06, identity, derivation, security]
---

# Handoff — audit-adr0151-derivation

## What was built and why

Closed two ADR-0151 violations found in audit run `2026-05-13-adr-contract-validation`:

- **SE-02-01** (HIGH): `POST /api/botsson/chat` injected `body.primeContext.profileId` into the LLM user message context prefix without server-verification. An admin could forge a different employee's profile_id to pollute LLM history / audit context.

- **F-MO-06** (HIGH): `submit_own_pii` RPC used the body-supplied `p_workspace_id` directly in the `activity_trail` INSERT. While PII writes were safe (profile locked to `auth.uid()`), audit attribution was forgeable to a foreign workspace.

ADR-0151 requires: identity (workspace_id, profile_id, user_id) MUST be derived server-side from JWT/session. Body-supplied values must never be trusted for identity.

## Changes made

### 1. `apps/web/src/app/api/botsson/chat/route.ts`

**Before:** lines 142-149 read `body.primeContext.profileId` and interpolated it directly into the LLM context string.

**After:** Route performs a second `admin.from("profile").select("profile_id").eq("profile_id", body.primeContext.profileId).eq("workspace_id", body.workspaceId).maybeSingle()` lookup before interpolating. Only the server-confirmed `profile_id` enters the LLM context. A forged or non-existent profileId causes the context line to be silently omitted — no error, no leakage.

The existing admin membership check (`profile.profile_id`) was already server-derived from `user.id` — this fix hardens the SUBJECT identity (the employee being viewed), not the caller identity.

### 2. `supabase/migrations/20260514000010_secure_submit_own_pii.sql`

Replaces `submit_own_pii` function via `CREATE OR REPLACE`:

- Added `v_workspace_id UUID` local variable
- Profile lookup now selects both `profile_id` AND `workspace_id` into locals
- Added explicit `v_workspace_id <> p_workspace_id` guard that raises exception on mismatch
- `activity_trail` INSERT now uses `v_workspace_id` (server-derived) instead of `p_workspace_id` (body-supplied)
- Function signature unchanged (backward compatible)
- Comment updated to document ADR-0151 + ADR-0077 compliance

### 3. `apps/mobile/app/(app)/(me)/contract/complete-data.tsx`

File header comment updated to document the ADR-0151 security model: `p_workspace_id` is sourced from `useMyProfile()` (authenticated session), not from user input or URL params. The RPC server-validates and rejects mismatches.

### 4. `apps/web/src/app/api/botsson/chat/__tests__/route.test.ts` (new file)

5 Vitest tests covering:
1. Forged `primeContext.profileId` (not in workspace) → context line omitted from LLM message
2. Forged ID → stage-engine `profile_id` field still uses server-derived admin profile_id
3. Valid (server-verified) `primeContext.profileId` → context line included in LLM message
4. Non-admin caller → 403 returned before any downstream calls
5. Unauthenticated caller → 401

## Decisions made

No new ADRs needed — both fixes are mechanical implementations of existing ADR-0151 requirements. The pattern of "verify body-supplied ID against workspace membership before using" follows the established L-0177 learning (fail-fast on row-not-found, no silent fallback).

## Learnings

**L-audit-adr0151-a: Subject identity requires the same server-verification as caller identity.** The botsson/chat route correctly derived the CALLER's profile from JWT. But the SUBJECT (employee being viewed) was trusted from body. Both require verification — ADR-0151's "never trust body" applies to any identity that appears in LLM context or audit logs.

**L-audit-adr0151-b: SECURITY DEFINER does not immunize audit trail insertions.** The `submit_own_pii` PII writes were safe (profile resolved via `auth.uid()`). But the `activity_trail` workspace_id came directly from `p_workspace_id`. A forged workspace_id in the audit trail is a separate attack surface from the PII write protection. Audit trail fields need the same server-derivation discipline as data writes.

## Known issues / debt

- Mobile `complete-data.tsx` still passes `p_workspace_id` to the RPC (now validated server-side). Future cleanup: if the RPC is redesigned to derive workspace from `auth.uid()` without requiring `p_workspace_id` (e.g. a user with exactly one active workspace), the parameter could be dropped. For now the signature is unchanged for backward compat.

- Pre-existing mobile typecheck error in `apps/mobile/src/components/shift/SwapRequestSheet.tsx` (`@smartout/utils` module not found). Unrelated to this sortie.

- The `activity_trail` mismatch guard in the RPC validates but does NOT currently return a structured error code — it raises a PostgreSQL exception. Mobile sees this as `error.message`. For better UX a future pass could wrap this in a JSON error response via the RPC return type.

## Next steps

- `feat/audit-adr0151-derivation` ready for close-feature
- Pontus runs `close-feature.sh 8` to merge to development
- Update `docs/audits/2026-05-13-adr-contract-validation-02/00-SUMMARY.md` with final commit SHA after merge
