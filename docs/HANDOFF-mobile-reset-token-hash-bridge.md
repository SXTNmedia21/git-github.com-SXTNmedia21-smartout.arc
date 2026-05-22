---
title: "Handoff — mobile-reset-token-hash-bridge"
status: done
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [handoff, auth, mobile, reset-password, token_hash, adr-0390, adr-0368, adr-0389]
---

# Handoff — Mobile password-reset lands native (/m/ bridge)

## Summary

Mobile password-reset now lands in the native app via the `/m/update-password`
Universal-Link bridge, verified by `token_hash`, served from the SINGLE GoTrue
"Reset Password" template — without changing the working web reset. Extends
ADR-0368 (Universal-Link bridge) + ADR-0389 (token_hash email auth).

Shipped on `feat/mobile-reset-token-hash-bridge` (5 commits):

1. `b2e9d1afb` — web `/m/update-password` fallback: server-side `verifyOtp(token_hash, recovery)` + set-password form (app-not-installed / desktop).
2. `47f507a87` — native `apps/mobile/app/(auth)/m/update-password.tsx`: in-app `verifyOtp` → set-password → `updateUser`.
3. `1d4bc5653` — conditional recovery template (first cut) + ADR-0390 + README + decision-log.
4. `8f1ca11f9` — **fix**: conditional branches on exact `RedirectTo` match, not truthiness (see Learnings); docs corrected.
5. (`8f96afbb0` — plan + journey, committed at sortie setup.)

## Decisions

- **ADR-0390** — Mobile password-reset lands native via conditional recovery
  template. Strategy A (one template, Go-template `{{ if eq .RedirectTo
  "<bridge-url>" }}`) over Strategy D (callback dispatch) — keeps the audited
  `/api/auth/callback` + open-redirect guard untouched; mobile gets its own link.

## Learnings

- **`{{ .RedirectTo }}` is never empty.** GoTrue defaults it to `site_url` when no
  `redirectTo` is passed (verified via `admin/generate_link`: `redirect_to=site_url`).
  A `{{ if .RedirectTo }}` truthiness test is therefore ALWAYS true and would route
  the web track to `site_url?token_hash=…` — broken. Branch on EXACT equality to
  the bridge URL instead. Caught by `/verify` before merge; the broken first cut
  (`1d4bc5653`) never reached development.
- **Host-glob allow-list excludes paths.** `https://*.smartout.ai` matches the host
  only, NOT `…/m/update-password`. A blocked `redirectTo` silently defaults
  `.RedirectTo` to `site_url`. The exact path must be allow-listed (local
  `config.toml` done; prod dashboard = operator step). With exact-match the failure
  mode is safe: degrades to a working web reset, never a broken link.
- **GoTrue email body engine = Go `html/template`.** Backtick raw-string literal for
  the `eq` argument (a `"` would close the HTML `href="…"`). Both branches rendered
  correctly via a throwaway `html/template` run.

## Verification

- Web `/m/update-password` route driven on an isolated wt-6 dev server (:3061):
  invalid token → `307 /login?error=Invalid_link`; forged `type=email` → bridge
  (recovery-only guard holds); no-params → bridge.
- Template: data side via `generate_link`; logic side via Go `html/template` render.
  Web branch output byte-identical to the ADR-0389 working link.
- Mobile native screen: typecheck 0, eslint 0. Not runtime-driven (no RN harness
  in this env).

## Known issues / debt

- **Operator gate (prod):** paste the conditional `reset-password` template to the
  Supabase dashboard AND add `https://app.smartout.ai/m/update-password` to prod
  Redirect URLs. Until then, mobile reset degrades to the (working) web track.
- Native mobile screen not runtime-verified end-to-end — final gate is a real reset
  email from the device after the operator step.
- Template render under GoTrue specifically (vs the equivalent `html/template` proof)
  confirmed only by the operator real-email test.

## Next steps

1. Operator: apply template + Redirect URL to prod, send a real mobile reset, confirm
   the link opens the app at `/m/update-password`.
2. Optional: keep `verify.tsx` redirectTo string and the template `eq` literal in sync
   (single source / shared const) to avoid silent drift to the web branch.
