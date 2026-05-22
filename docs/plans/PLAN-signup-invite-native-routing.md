---
title: "Plan — signup-invite-native-routing + redirect-coherence guard"
status: done
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [plan, auth, mobile, signup, invite, universal-link, token_hash, adr-0390, adr-0393, adr-0368, adr-0389]
---

> **SCOPE COLLAPSED by P0 recon (2026-05-22) — see ADR-0393.** Template work
> (P1/P2/P4 confirm-sign-up + invite-user conditionals + native screens) was
> DROPPED: mobile has no email-signup (invite-only/login-only) and invites use a
> custom `invitation`-table token + plain `/invite/<token>` Universal Link, not
> GoTrue `inviteUserByEmail` — so those templates have no mobile consumer. Only
> **P3 (the redirect-coherence guard) + ADR-0393** shipped. Trigger to revisit
> templates: if invites ever migrate to GoTrue native invite with a mobile
> redirectTo.

# Plan — Signup/invite emails land native on mobile + drift guard

> Branch: `feat/signup-invite-native-routing` | Worktree: /home/sxtnl/dev/smartout.ai-wt-6 | Base: `development` | Module: auth | Started: 2026-05-22

## Problem

ADR-0390 fixed the **reset-password** email to route mobile → native
`/m/update-password` (web → callback) via a content-match conditional
`{{ if eq .RedirectTo "<bridge-url>" }}`. The **same defect remains** in two other
GoTrue templates:

- `confirm-sign-up` (Confirm signup) — link `…/api/auth/callback?type=signup&next=/dashboard`
- `invite-user` (Invite user) — link `…/api/auth/callback?type=invite&next=/join`

A mobile user who signs up or accepts an invite via email lands in the **web**
browser, not the native app — same UX break ADR-0390 closed for reset.

Second gap: the bridge URL is a **hardcoded string in two places** — `apps/mobile`
(`redirectTo`) and the email template (`eq` sentinel). Drift between them silently
degrades the mobile branch to web with no test catching it.

## Goal

1. Mobile signup + invite emails land native (Universal-Link `/m/<route>`,
   token_hash verified) via the ADR-0390 content-match pattern — web unchanged.
2. A coherence guard (husky pre-push, like `check-otp-coherence.mjs`) that asserts
   every mobile `redirectTo` string == the matching template `eq` sentinel. Drift = fail.

## Constraints / facts

- Pattern proven (ADR-0390): `{{ if eq .RedirectTo `<exact-url>` }}…{{ else }}…{{ end }}`,
  Go backtick literal, exact-match (NOT truthiness — `.RedirectTo` defaults to site_url).
- Each `/m/<route>` destination must be allow-listed by EXACT path in prod Redirect
  URLs + local `config.toml additional_redirect_urls` (host-glob excludes paths).
- Web callback + open-redirect guard stay untouched (else-branch identical).
- One-mechanism-per-email (ADR-0389): keep current link/code shape; only the link
  href gets the conditional.

## Tasks

- [ ] **P0 Recon + brainstorm** (superpowers:brainstorming) — DOES mobile send
      `redirectTo` for signup/invite? Inspect `apps/mobile` signup + invite-accept
      flows. If mobile is invite-only (no email signup), or invites route differently,
      scope shrinks. Identify each native `/m/<route>` destination + whether a native
      screen exists (mirror `apps/mobile/app/(auth)/m/auth/callback.tsx`). Falsifiable:
      each in-scope template has a known mobile redirectTo + a native landing route.
- [ ] **P1 Templates** — content-match conditional on in-scope templates
      (`confirm-sign-up`, `invite-user`); else-branch = current web link unchanged.
- [ ] **P2 Native routes + web fallback** — per new `/m/<route>`: native screen
      (`verifyOtp({token_hash, type})` in-app) + web fallback server-verify (mirror
      `apps/web/src/app/m/update-password/page.tsx`). Only if P0 confirms the flow.
- [ ] **P3 Coherence guard** — `scripts/check-redirect-coherence.mjs`: parse mobile
      `redirectTo` literals + template `eq` sentinels, assert pairwise equality;
      wire husky pre-push + `pnpm check:redirects`. Covers reset (ADR-0390) + new ones.
- [ ] **P4 Allow-list + ADR** — add each exact `/m/<route>` to local `config.toml`;
      document prod Redirect URL operator step; extend ADR-0390 or new ADR.
- [ ] **P5 Verify** — `generate_link` (data) + Go `html/template` render (both branches)
      per template; web regression; `pnpm check:redirects` + `ci:local`.

## Out of scope

- reset-password (done, ADR-0390).
- OTP login / magic link (intentionally code-only, ADR-0389).
- Publishing the mobile app (native E2E gated on store publish).

## Acceptance Criteria

- [ ] Each in-scope template: mobile branch → `/m/<route>`, web branch byte-identical.
- [ ] `check-redirect-coherence` passes; fails on injected drift.
- [ ] Web signup/invite still land on existing web routes with live session.
- [ ] No open-redirect regression; callback untouched.
- [ ] Typecheck passes; decision log updated; journeys verified.

## Refs

- ADR-0390 (conditional recovery template — pattern this generalizes)
- ADR-0368 (mobile Universal-Link bridge), ADR-0389 (token_hash + one-mechanism-per-email)
- `scripts/check-otp-coherence.mjs` (guard pattern to mirror)
- `supabase/email-templates/{confirm-sign-up,invite-user}` (targets)
- `apps/web/src/app/m/update-password/page.tsx` (web-fallback reference)
- `apps/mobile/app/(auth)/m/*` (native route references)
