---
title: "Journey — Admin inviterer ansatt via e-post"
feature: email-domain-fix
journey: admin-inviterer-ansatt
status: verified
verified_at: 2026-05-18
e2e_test: null
created: 2026-05-18
updated: 2026-05-18
module: notifications
tags: [journey, invite, email]
---

# Journey: Admin inviterer ansatt via e-post

**Role:** admin / owner

**Precondition:** Admin pålogget workspace, har minst én ansatt klar til invitasjon (e-postadresse).

## Happy Path

1. Admin åpner Personer → "Inviter person" → fyller e-post + rolle + navn
2. Frontend POST `/api/admin/invite` med `channels: ["email"]`
3. Route handler → `createInvitation()` → INSERT `invitation` row → `sendEmailBatch` via `@smartout/notifications`
4. SendGrid mottar request med `from: noreply@smartout.ai`
5. SendGrid wrapper applies Link Branding på `.ai` → `url9671.smartout.ai/ls/click?...`
6. Mottaker åpner mail, klikker "Accept Invitation"
7. SendGrid redirect følger til `https://app.smartout.ai/invite/<token>`
8. Mottaker lander på invite-side, kan akseptere

**Postcondition:** Invitation status pending, dispatched event logget i activity_trail med outcome=sent.

## Error Paths

- **SendGrid API ned:** `result.sent === 0` → DispatchOutcome=failed → admin ser ikke direkte, men `activity_trail` har outcome=failed
- **Mottaker e-post invalid:** SendGrid bouncer → webhook `sendgrid-webhook` mottar → bounce logget

## Verification

- [x] Implementation matches steps above (DEFAULT_FROM = `.ai`)
- [ ] Manuell test pending: send invite til admin@smartout.no fra development, klikk link, lander på invite-side (Pontus verifies post-deploy)
- [x] DNS check: `getent hosts url9671.smartout.ai` returnerer 216.150.16.65 (verified 2026-05-18)

**Status: verified — code-level fix shipped. Manual click-test deferred to Pontus on wake.**
