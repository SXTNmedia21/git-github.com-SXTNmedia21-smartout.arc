---
title: "Handoff — signup-invite-native-routing"
feature: signup-invite-native-routing
branch: feat/signup-invite-native-routing
closed: 2026-05-23
module: auth
tags: [handoff, auth, mobile, redirect-coherence, recon, adr-0393, adr-0390]
---

# Handoff — Redirect-coherence guard (signup/invite recon outcome)

## Summary

Originally scoped to extend ADR-0390 content-match conditional to
`confirm-sign-up` + `invite-user` templates so mobile signup/invite emails would
land native. **P0 recon disproved the premise**: mobile has no email-signup
(invite-only/login-only) and invites use a custom `invitation`-table token +
plain `/invite/<token>` Universal Link, NOT GoTrue `inviteUserByEmail`. Templates
have no mobile consumer → no conditional shipped. **Only the redirect-coherence
guard + ADR-0393 shipped** (covers the existing reset pair from ADR-0390 against
silent string drift). 2 commits on `feat/signup-invite-native-routing`:

1. `32b6ebb77` — plan + journeys (scope later collapsed in-doc).
2. `ee50e2115` — `scripts/check-redirect-coherence.mjs` + husky pre-push +
   `pnpm check:redirects` + ADR-0393 + decision-log row + scope-collapse update
   to plan + verified-status journey.

## Decisions

- **ADR-0393** — Redirect-coherence guard + signup/invite native-routing scope
  finding. Documents the guard contract (mobile `redirectTo` == template `eq`
  sentinel; husky-enforced) AND the recon finding (signup/invite OUT of scope)
  AND the trigger to revisit (if invites ever migrate to GoTrue native
  `inviteUserByEmail` with a mobile `redirectTo`).

## Learnings

- **Recon-first saves throwaway code.** Originally three tracks (template + native
  + guard) plus an ADR-0390-style conditional on two templates. T0 Explore (haiku,
  read-only) showed both templates have no mobile consumer — scope collapsed to
  the guard. Two would-be sonnet build agents and ~half a sortie's worth of code
  were never written.
- **Two parallel invite systems exist.** GoTrue's `invite-user` (`{{ .TokenHash }}`,
  `type=invite`) is effectively dead code in this repo: every invite is created
  via `createInvitation()` in `apps/web/src/lib/invitations.ts` which writes a
  custom `invitation.token` and sends a plain `/invite/<token>` link. The mobile
  app already deep-links that via Android `pathPrefix:/invite` + iOS
  `associatedDomains`.
- **PAIR-rule false-positive for scripts-only `package.json` edits.** `ci:local`
  coverage-check flags `package.json ↔ pnpm-lock.yaml mismatch` when only a
  `scripts.*` field is added (no dep change). Frozen-install does NOT fail.
  Future tooling fixup: scoped exception in the PAIR rule.

## Verification

- Guard: `node scripts/check-redirect-coherence.mjs` → ✓ exit 0.
- Drift catch: injected trailing `/` on template sentinel → ✗ exit 1 with both
  values + ADR refs. Revert → ✓ exit 0.
- Husky pre-push wires it after `check-otp-coherence`.
- Recon evidence in ADR-0393 §Recon finding.

## Known issues / debt

- **Pre-existing reds on local development (not from this sortie):**
  - `migration-lint` ❌ — `session-task-overdue-cron` (procedure-engine migration)
    missing from canonical registry `20260621201500_reregister_pg_cron_jobs.sql`
    (ADR-0388). Owner: procedure-engine stream.
  - `vitest` ❌ — `@smartout/telemetry parity.test.ts` 1 failed (procedure-engine
    `registry.ts` change). Owner: procedure-engine stream.
  - `build` ❌ — web SIGTERM = WSL2 OOM (environmental).
- **PAIR-rule false-positive** for scripts-only `package.json` edits — see Learnings.
- Guard registry today holds 1 pair (reset). Extends to any future mobile-redirect
  → template-conditional flow by one entry.

## Next steps

- If/when invites move to GoTrue native `inviteUserByEmail` with a mobile
  redirectTo → add the ADR-0390 content-match conditional to `invite-user`
  template + a new entry to the guard's PAIRS registry.
- Procedure-engine stream: fix the ADR-0388 cron registry gap before next
  promote-preview.
