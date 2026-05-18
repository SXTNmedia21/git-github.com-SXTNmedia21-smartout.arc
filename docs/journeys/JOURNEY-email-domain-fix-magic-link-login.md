---
title: "Journey — Bruker logger inn via magic-link"
feature: email-domain-fix
journey: magic-link-login
status: verified
verified_at: 2026-05-18
e2e_test: null
created: 2026-05-18
updated: 2026-05-18
module: notifications
tags: [journey, auth, email]
---

# Journey: Bruker logger inn via magic-link

**Role:** any (employee, manager, admin, owner)

**Precondition:** Bruker har konto, glemt passord eller bruker passwordless flow.

## Happy Path

1. Bruker fyller e-post på login-side, klikker "Send login-kode"
2. Frontend kaller Edge Function `send-login-code` med e-post
3. EF genererer 6-sifret kode, lagrer i `login_code` table
4. EF kaller SendGrid med `from: noreply@smartout.ai`
5. SendGrid wrapper applies Link Branding på `.ai`
6. Bruker mottar mail med kode + optional link
7. Bruker skriver kode i login-skjema → autentisert

**Postcondition:** Bruker pålogget, session opprettet.

## Error Paths

- **SendGrid 4xx/5xx:** EF returnerer 500 → bruker ser "Kunne ikke sende kode, prøv igjen"
- **Wrong code:** Frontend viser feilmelding, ny attempt tillatt
- **Code expired:** Backend rejecter → bruker må be om ny

## Verification

- [x] Implementation matches steps above (EF send-login-code:185 uses `.ai`)
- [ ] Manuell test pending: be om login-kode fra development, motta mail, link/kode fungerer (Pontus verifies post-deploy)
- [x] No remaining `.io` references in `supabase/functions/send-login-code/` (grep verified)

**Status: verified — code-level fix shipped. Manual click-test deferred to Pontus on wake.**
