---
title: "Recovery-link distribution email template for migrated users"
status: draft
created: 2026-04-17
tags: [auth-bridge, migration, communication, template]
---

# Recovery-link distribution email template

Send one email per migrated user from the audit CSV at
`scripts/auth-bridge/.audit/bridge-audit-<timestamp>.csv`.

**Channel:** personal email (not Tripletex notifications — we want the
first-touch experience to be warm, not transactional).

**Sender:** admin (Pontus for Wrightegaarden) — NOT a no-reply system
address. Replies should land in an inbox a human reads.

**Language:** Norwegian primary. English fallback below for non-Norwegian
speakers.

---

## Template — Norwegian (primary)

**Subject:** `Din nye Smartout-konto er klar — sett passord (2 min)`

```
Hei {{first_name}},

Smartout har fått en ny versjon — bedre, raskere, og bygget for å gjøre
jobben din på Wrightegaarden enklere. Alt fra håndboken til vaktplanen
er allerede flyttet over, slik at du kan fortsette der du slapp.

Din konto ({{email}}) er opprettet og klar. Du må bare sette et nytt
passord før du logger inn første gang:

👉 {{recovery_link}}

Lenken er personlig — klikk, velg et passord du husker, og du er inne.

Noen ting å vite:
• Ditt navn, avdeling og profil er allerede på plass
• Håndboken du har lest tidligere finner du igjen
• Vaktplanen starter på det punktet du sist så

Trenger du hjelp? Bare svar på denne e-posten.

Velkommen tilbake,
Jørn
Wrightegaarden
```

---

## Template — English (fallback for non-Norwegian speakers)

**Subject:** `Your new Smartout account is ready — set a password (2 min)`

```
Hi {{first_name}},

Smartout has moved to a new version — faster, better, and built to make
your job at Wrightegaarden easier. Everything from the handbook to the
schedule has been brought along so you can pick up where you left off.

Your account ({{email}}) is created and ready. You just need to set a
new password before your first login:

👉 {{recovery_link}}

The link is personal to you — click it, pick a password you'll remember,
and you're in.

What carried over:
• Your name, department, and profile
• Handbooks and training you've already read
• Your schedule picks up where it left off

Questions? Just reply to this email.

Welcome back,
Jørn
Wrightegaarden
```

---

## Variables (pulled from audit CSV)

| Template var | CSV column | Example |
|---|---|---|
| `{{first_name}}` | Derived from `user_identity.first_name` (strike-mcp mapping) | `Anneli` |
| `{{email}}` | `email` | `anneli@sf-nett.no` |
| `{{recovery_link}}` | `recovery_link` | `http://localhost:54321/auth/v1/verify?token=...` |

**NOTE:** in production, `recovery_link` must point at the production
Supabase auth endpoint (e.g. `https://<project>.supabase.co/auth/v1/verify`
→ redirects to `https://app.smartout.ai/reset-password`). Verify the
`redirect_to` query parameter on the link points to the correct
environment before sending.

## Per-user preparation checklist

Before sending:

- [ ] Verify user is on the audit CSV with `status: created` or `already_exists`
- [ ] Check `recovery_link` has a valid token (not empty, not expired —
      Supabase recovery links expire after 1 hour by default; regenerate via
      `admin.generateLink({ type: 'recovery', email })` if stale)
- [ ] Confirm email address matches what the user expects (they may have
      changed email since Bubble — cross-check with Tripletex / HR)
- [ ] Substitute template variables
- [ ] Send from a human address (not no-reply@)

## Anti-patterns to avoid

❌ Bulk-sending all recovery links at once — Supabase rate-limits recovery
link generation; batch in groups of 20 with 5-min pause, OR generate
links on-demand as each user is contacted.

❌ Including the temp password in the email — the temp password is
discarded by design; only the recovery link works.

❌ Using a system/no-reply address — migration-anxiety is real. Replies
need to land in Pontus/Jørn/Erik's inbox.

❌ Sending before production apply — recovery links point to the Supabase
project where auth.users was created. Bridge applied against staging?
Links don't work in production until apply runs there.

## Post-send follow-up

Track in a simple spreadsheet:

| Email | Sent date | Link expires | Clicked? | Password set? | Notes |
|---|---|---|---|---|---|
| anneli@sf-nett.no | 2026-MM-DD | 2026-MM-DD+1h | - | - | — |

For users who don't click within 48h: send a reminder. If still nothing
at day 7, regenerate the link (expired) and resend.

Users can also use the standard `/reset-password` flow with their email
address at any time — the recovery link is a convenience, not a
requirement.
