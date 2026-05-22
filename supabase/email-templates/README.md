---
title: Auth email templates
status: done
updated: 2026-05-22
created: 2026-05-22
module: auth
tags: [auth, email-templates, gotrue, supabase, otp, token_hash, mobile, universal-link]
---

# Auth email templates

Source-of-truth HTML for the Supabase (GoTrue) auth emails. Design = Nordic
Split (warm palette, Instrument Serif headings, `Smart`+orange`out` wordmark,
hidden preheader, mobile `@media`, bulletproof `<td>`-bg buttons).

> ⚠️ These are **files**. Editing them does NOT change production. Apply to the
> live project via **Supabase dashboard → Authentication → Email Templates**
> (paste) or `config.toml` `content_path` + `supabase config push`.

## Files → GoTrue template

| File               | GoTrue template      | Sent by                     | Link / code                                                                                                                                                                              |
| ------------------ | -------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `confirm-sign-up`  | Confirm signup       | signup                      | token_hash link (`type=signup`, next `/dashboard`) + code                                                                                                                                |
| `invite-user`      | Invite user          | admin invite                | token_hash link (`type=invite`, next `/join`) + code                                                                                                                                     |
| `magiclink-or-otp` | Magic Link           | `signInWithOtp` (OTP login) | **code only** — see contract below                                                                                                                                                       |
| `reset-password`   | Reset Password       | `resetPasswordForEmail`     | token_hash link only (`type=recovery`) — web: `{{ .SiteURL }}/api/auth/callback?…&next=/update-password`; mobile: `{{ .RedirectTo }}?token_hash=…&type=recovery` (conditional, ADR-0390) |
| `change-email`     | Change Email Address | email change                | `{{ .ConfirmationURL }}` (dual-token flow)                                                                                                                                               |
| `reautentication`  | Reauthentication     | reauth                      | code only                                                                                                                                                                                |

## Link format (ADR-0389, ADR-0390)

### Web (default — `{{ .RedirectTo }}` is empty)

Email links point at our server-side callback, which verifies `token_hash`
(robust, cross-device — no PKCE `code_verifier` cookie):

```
{{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=<T>&next=<PATH>
```

`{{ .SiteURL }}` must be `https://app.smartout.ai` (dashboard → Auth → URL
Configuration → Site URL).

### Mobile (when `{{ .RedirectTo }}` is set)

When `resetPasswordForEmail` is called with
`redirectTo: "https://app.smartout.ai/m/update-password"`, GoTrue populates
`{{ .RedirectTo }}`. The `reset-password` template then links to:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
```

This is the Universal-Link bridge path defined in ADR-0368. On a device with the
app installed, iOS / Android intercepts the `https://app.smartout.ai/m/…` URL
before the browser opens it; the native screen reads `token_hash` from the URL
and calls `verifyOtp` in-app. On a device without the app (or on desktop), the
web route `apps/web/src/app/m/update-password/page.tsx` renders, reads the query
params, and verifies server-side — same mechanism as the web track.

**Operator requirement (ADR-0390):** The Supabase dashboard
→ Authentication → URL Configuration → Redirect URLs allow-list MUST include
`https://app.smartout.ai/m/**` (or the exact path
`https://app.smartout.ai/m/update-password`). GoTrue rejects any `redirectTo`
that is not in the allow-list; the email will fall through to the web-path `{{ else }}`
branch if `redirectTo` is blocked or absent.

## Two hard contracts (do not break)

1. **One mechanism per email.** A `{{ .Token }}` code and a `{{ .TokenHash }}`
   link in the SAME email share ONE one-time GoTrue token — a mail-client /
   scanner prefetch of the link (invisible to the user) consumes it and the
   code then reads "expired". So `magiclink-or-otp` is **code-only**;
   `reset-password` is **link-only**.

2. **OTP length = 6 everywhere (ADR-0389).** The login code field renders
   exactly 6 boxes (`OTP_LENGTH` in `OtpVerificationForm.tsx`). GoTrue
   `otp_length` (local `config.toml` + prod dashboard) MUST be 6. An 8-digit
   GoTrue code into a 6-box field = 403 on a valid code (prod outage
   2026-05-22). `scripts/check-otp-coherence.mjs` (husky pre-push) guards the
   code side; the prod dashboard value is your responsibility — keep it 6.

## Preview locally

Render any template with sample placeholder values in a browser to eyeball it
(replace `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .Email }}`, `{{ .SiteURL }}`).
