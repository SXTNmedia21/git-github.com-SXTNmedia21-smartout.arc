---
title: "Redirect-coherence guard + signup/invite native-routing scope finding"
id: ADR-0393
status: accepted
layer: decision
created: 2026-05-22
updated: 2026-05-22
relates_to: [ADR-0390, ADR-0389, ADR-0368]
tags: [auth, mobile, email-templates, coherence-guard, husky]
---

# ADR-0393: Redirect-coherence guard + signup/invite native-routing scope finding

## Context and Problem Statement

ADR-0390 introduced a Go-template conditional in the GoTrue "Reset Password" email
template that routes the button link to the native `/m/update-password` Universal-Link
bridge when `resetPasswordForEmail` is called with the mobile `redirectTo` URL.
The conditional is a byte-exact string comparison:

```html
{{ if eq .RedirectTo `https://app.smartout.ai/m/update-password` }}
```

If the mobile call-site URL and the template sentinel ever diverge — even a single
trailing slash, casing change, or domain rename — `eq` silently returns false, the
native branch is never taken, and mobile users receive the web reset flow with no
error, no log, and no test failure. The ADR-0389 pattern (check-otp-coherence.mjs,
husky-enforced) proved that exactly this class of silent drift is worth a mechanical
guard. This ADR formalises the equivalent guard for mobile auth redirect pairs.

A secondary question was whether `confirm-sign-up` and `invite-user` GoTrue templates
also needed mobile `{{ if eq .RedirectTo }}` conditionals and corresponding registry
entries. Recon was performed before implementation to answer this.

## Decision Drivers

- Byte-level divergence between `redirectTo` literal and template `eq` sentinel is
  silent — no runtime error, no 4xx, no observable degradation until a mobile user
  hits the broken flow.
- ADR-0389 established the enforcement pattern: a small ESM script + husky pre-push +
  `pnpm check:*` script. Reusing the pattern is zero-friction.
- Pre-implementation recon found that only one pair currently exists, but the pattern
  will recur whenever a new mobile auth flow adds a GoTrue email with a native redirect.
  The guard must be a registry so future pairs are one-line additions.

## Recon Finding — signup and invite are out of scope

Before building the guard, the following GoTrue templates were audited for mobile
`redirectTo` usage:

**`confirm-sign-up`**
Mobile has no email-signup flow. Workspace access is invite-only; login is via
password or OTP, not signup email confirmation. GoTrue's `confirm-sign-up` template
is never triggered by mobile because `supabase.auth.signUp` is never called from
`apps/mobile/`. No `{{ if eq .RedirectTo }}` conditional is needed, and no registry
entry exists.

**`invite-user`**
Smartout uses a custom `invitation` table token flow, not GoTrue's native
`inviteUserByEmail`. The invitation edge function generates a short UUID token
and writes it to the `invitation` table. The invite email link resolves to
`/invite/<token>` — a plain HTTPS URL that iOS/Android already intercepts as a
Universal Link (ADR-0368) without any Go-template conditional. GoTrue's `invite-user`
template is not used for workspace invitations. No `{{ if eq .RedirectTo }}` conditional
is needed, and no registry entry exists.

**Trigger for revisiting:**
If invites ever migrate to GoTrue native `inviteUserByEmail` with a mobile `redirectTo`
parameter, add a `{{ if eq .RedirectTo `<url>` }}` conditional to the `invite-user`
template AND add the matching entry to the `PAIRS` registry in
`scripts/check-redirect-coherence.mjs`.

## Considered Options

1. **Registry-based coherence script (this ADR)** — ESM script with a `PAIRS` array;
   each entry names the mobile file + regex and the template file + regex; runs on
   pre-push and via `pnpm check:redirects`.
2. **Manual doc-only rule** — Document in CLAUDE.md that the two strings must stay in
   sync; rely on code-review to catch drift.
3. **Single hardcoded assertion** — Script with the URLs inlined (no registry), fails
   if either changes.

## Decision Outcome

Chosen option: **Option 1 (registry-based coherence script)**, because it is mechanical
(no review dependency), extensible (one array entry per new pair), and consistent with
the ADR-0389 enforcement pattern the team already trusts.

Option 2 is insufficient — ADR-0389 was written because doc-only rules do not catch
byte-level drift. Option 3 is technically equivalent for today's single pair but
provides no extension path and would need replacement the moment a second pair exists.

## Rules & Consequences

- **Guard contract:** For every mobile auth flow that calls a GoTrue method with
  `redirectTo: "<url>"` and whose email template contains `{{ if eq .RedirectTo \`<url>\` }}`,
  the URL string must be byte-identical in both places.
- **Registry:** `scripts/check-redirect-coherence.mjs` `PAIRS` array is the canonical
  registry. Adding a new pair = one array entry. Removing a mobile flow = remove its
  entry or the check fails on the missing source.
- **Enforcement:** `pnpm check:redirects` (package.json) + husky pre-push after
  `check-otp-coherence.mjs`. Runs on every push; blocks on exit 1.
- **Scope boundary:** Only GoTrue `redirectTo` → `{{ if eq .RedirectTo }}` pairs belong
  in this registry. Custom-token invite flows (`/invite/<token>` Universal Links) are
  not Go-template conditionals and are not registered here.
- **Good, because** drift is caught at commit time, before it reaches a mobile user's
  inbox.
- **Bad, because** the regex for `mobileRegex` must be maintained if the mobile call
  site is refactored (e.g. extracted to a helper). The script prints a clear message
  naming the file when extraction fails.
- **Agent Impact:** When adding a new mobile auth email with a `redirectTo` → native
  `/m/` conditional, agents must: (1) add the template conditional, (2) add the PAIRS
  entry in `check-redirect-coherence.mjs`. ADR-0393 is the reference.

## Relates To

- ADR-0390 — Mobile password-reset conditional recovery template (the pair guarded here)
- ADR-0389 — OTP length contract (the enforcement pattern this replicates)
- ADR-0368 — Universal-Link bridge architecture (`/m/*` routes)
