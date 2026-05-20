---
title: "Handoff — email-domain-fix"
feature: email-domain-fix
status: done
created: 2026-05-18
updated: 2026-05-18
module: notifications
tags: [handoff, bugfix]
---

# Handoff — email-domain-fix

## Summary

Fixed dead invitation + magic-link emails. SendGrid Link Branding subdomain `url9671.smartout.io` returned NXDOMAIN; the equivalent on `.ai` (`url9671.smartout.ai`) resolves. Replaced all `smartout.io` references in code with `smartout.ai`. Forward-only migration corrects seeded contract message template URLs.

## Root Cause

Code hardcoded `from: noreply@smartout.io` across notifications package, two Edge Functions, signing form, and templates. SendGrid wraps outbound links using the Link Branding domain that matches the From address. Since `.io` wrapper subdomain doesn't resolve in DNS, every wrapped link was dead.

Confirmed via:
```
getent hosts url9671.smartout.io  → NXDOMAIN
getent hosts url9671.smartout.ai  → 216.150.16.65
```

## Files Changed

| File | Change |
|---|---|
| `packages/notifications/src/sendgrid.ts` | `DEFAULT_FROM` → `.ai` |
| `packages/notifications/src/email-service.ts` | Fallback fromEmail → `.ai` |
| `packages/notifications/src/compliance.ts` | `ALLOWED_SENDERS` allowlist → `.ai` |
| `packages/notifications/src/templates.ts` | `upgradeUrl` + `paymentUrl` fallback → `.ai` |
| `supabase/functions/create-invitation/index.ts` | Legacy EF from → `.ai` |
| `supabase/functions/send-login-code/index.ts` | Magic-link from → `.ai` |
| `apps/web/src/app/sign/[token]/signing-form.tsx` | DocuSeal logo URL → `.ai` |
| `supabase/migrations/20260620110000_fix_contract_message_template_urls.sql` | Forward-only UPDATE of seeded URLs |

## Decisions

None — straight bug fix, no new ADR required. Existing convention (use `.ai` in all surfaces) was already documented in env vars (`NEXT_PUBLIC_WEB_APP_URL = https://app.smartout.ai`).

## Learnings

- L-email-link-branding-domain-mismatch (2026-05-18) — When SendGrid Link Branding is configured for domain X, the `from:` address must also be on domain X. Mismatch produces wrapped subdomains that don't resolve. Verify with `getent hosts url<id>.<domain>` before assuming SendGrid is broken.
- DNS evidence beats log access — when EF/Vercel logs are gated behind auth, NXDOMAIN on the wrapper subdomain is a sufficient diagnostic for SendGrid link wrapping bugs.

## Known Issues

- Manual click-test not yet performed. Code change is deterministic + DNS resolves; verification deferred to Pontus post-deploy on development.
- Migration UPDATE only runs once per environment. If dev DB was already seeded, migration fixes data; if fresh, original seed (`.io` hardcoded) still runs first then UPDATE overrides. Net: end state is `.ai` either way.

## Next Steps

1. Merge to development → Vercel preview auto-redeploys
2. Pontus clicks fresh invite link to verify wrapper resolves
3. If still broken: check SendGrid Sender Authentication on `.ai` matches `noreply@smartout.ai` exactly (case-sensitive)
4. Future: consider env-driven FROM address instead of hardcoded — would let local dev use `noreply@dev.smartout.ai` separately
