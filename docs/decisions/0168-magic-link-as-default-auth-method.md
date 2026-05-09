---
title: "Magic Link as Default Authentication Method"
id: ADR-0168
status: accepted
layer: decision
created: 2026-04-20
updated: 2026-05-02
---

# ADR-0168: Magic Link as Default Authentication Method

## Context and Problem Statement

`/login` and `/signup` both expose a tabbed auth chooser: magic link (passwordless OTP / email link) and password. Today `/login` defaults to password, `/signup` defaults to magic link. This is inconsistent and reflects a pre-2026 assumption that returning users "know their password." With Supabase Auth rate-limiting, Bubble-migrated users carrying `force_password_reset` metadata, and the shift-based workforce demographic (many users log in weekly, not daily), magic link is now the lower-friction primary path. We need a single, explicit policy.

## Decision Drivers

- Shift-based workforce: infrequent logins ⇒ forgotten passwords are common.
- Bubble-migrated users have random passwords they never chose — forcing them to type a password on first visit guarantees failure.
- Supabase rate limits magic-link sends (per email + per IP) — abuse surface is bounded.
- Password flow has two failure modes (wrong password, forgot password); magic link has one (didn't arrive).
- Mobile auth (ADR-0132) is thin-client; typing a password on mobile is worse UX than clicking an email link.
- Industry trend: Slack, Notion, Linear all default to email-based passwordless with password as fallback.

## Considered Options

1. **Keep mixed defaults** — /login=password, /signup=magic. Current state. Inconsistent and confusing for returning users who signed up with magic.
2. **Magic link as universal default** — both /login and /signup open on magic-link tab. Password tab remains visible and fully functional as fallback.
3. **Remove password entirely** — magic-link-only, no password ever. Not viable: offline-scenario users, password-manager users, and legacy Bubble flows all depend on password.

## Decision Outcome

Chosen option: **"Magic link as universal default"** (Option 2), because it aligns with Smartout's workforce demographic, matches the mobile-first auth surface, and preserves password as a fallback for users who prefer it.

## Rules & Consequences

- **Good, because** returning users who signed up via magic link see the same flow on re-login — consistency across signup/login.
- **Good, because** Bubble-migrated users' `force_password_reset` state is less jarring — the login form doesn't assume they have a password yet.
- **Good, because** mobile auth parity becomes trivial — both surfaces default to the passwordless flow.
- **Bad, because** password-manager users (a minority, but vocal) must click the secondary tab on every login. Mitigation: the `/login` tab state is remembered per-browser via localStorage so power-users set it once.
- **Bad, because** magic-link-only failure mode (email not received) produces support tickets. Mitigation: (a) rate-limit CAPTCHA after N failed sends; (b) resend button with 30s cooldown; (c) explicit fallback "use password instead" copy in the magic tab error state.
- **Bad, because** security surface shifts — email account compromise becomes a higher-leverage attack vector than password theft. Accepted risk: email compromise already lets an attacker trigger /reset-password regardless of this decision.
- **Agent Impact:**
  - Login page default tab state: `"magic"` in `useState`.
  - Tab labels unified across /login and /signup: "Magisk lenke" and "Passord" (not "Engangskode" or "E-post og passord" — see L-0091 cross-cutting).
  - New telemetry events needed: `auth magic_link_sent`, `auth magic_link_opened`, `auth magic_link_expired` (register in `packages/telemetry/src/registry.ts` with edge-function emit-site declared per L-0083).
  - Rate-limit threshold: 5 magic-link sends per email per hour. After threshold, CAPTCHA gate. Configure via Supabase Auth settings.
  - Copy change: `apps/web/src/app/login/page.tsx` tab default + label updates. `apps/web/src/app/signup/page.tsx` no change (already magic-default).

## References

- ADR-0021 (subdomain-based workspace routing — portal subdomain scope)
- ADR-0132 (mobile AI routing — mobile auth as thin client)
- L-0083 (registered telemetry event without producer — applies to new magic-link events)
- Supabase Auth magic-link docs
- `apps/web/src/app/login/page.tsx:159` (current authMethod useState default)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
