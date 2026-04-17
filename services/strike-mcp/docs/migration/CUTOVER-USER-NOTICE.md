---
title: Cutover User Notice — migration from Bubble to Smartout v3
status: draft
updated: 2026-04-16
created: 2026-04-16
module: strike-mcp
tags: [migration, cutover, communication, draft]
audience: migrated employees
---

# Cutover User Notice — Bubble → Smartout v3

> **Draft — not for sending.** Per Pontus's email policy (global CLAUDE.md):
> drafts only, never sent. HR or workspace owner sends manually post-review.
> Both Norwegian + English drafts below; pick one or send both depending on
> employee language preference.

---

## Norwegian (default — bokmål)

**Emne:** Din Smartout-konto er klar — sett nytt passord før første pålogging

Hei {first_name},

Vi har oppgradert til ny plattform — Smartout v3. Brukerkontoen din er flyttet over, men du må sette et nytt passord første gang du logger inn:

1. Gå til [https://{workspace_slug}.smartout.ai](https://{workspace_slug}.smartout.ai)
2. Klikk "Glemt passord"
3. Skriv inn e-postadressen din ({email})
4. Du får en lenke på e-post — bruk den til å sette et nytt passord

**Mobil-app:**
- Last ned Smartout-appen på nytt fra App Store / Google Play (gammel app fungerer ikke lenger)
- Logg inn med samme e-post + nytt passord
- Tillat push-varsler når appen spør (varsler er nullstilt etter migreringen — du må aktivere på nytt)

**Hva er flyttet over:**
- Profilen din, vakter, og lønnshistorikk
- Avdelinger og team-medlemskap

**Hva må gjøres på nytt:**
- Push-varsel-tilladelser på mobil
- Pågående vaktbytte-forespørsler (se separat e-post hvis dette gjelder deg)

Spørsmål? Snakk med {workspace_owner_name} eller svar på denne e-posten.

Hilsen,
{workspace_owner_name}

---

## English

**Subject:** Your Smartout account is ready — set a new password before first sign-in

Hi {first_name},

We've upgraded to the new platform — Smartout v3. Your account has been migrated, but you'll need to set a new password the first time you sign in:

1. Go to [https://{workspace_slug}.smartout.ai](https://{workspace_slug}.smartout.ai)
2. Click "Forgot password"
3. Enter your email address ({email})
4. You'll receive a link by email — use it to set a new password

**Mobile app:**
- Download the Smartout app fresh from the App Store / Google Play (the old app no longer works)
- Sign in with the same email + your new password
- Allow push notifications when the app asks (notifications are reset after migration — you'll need to re-enable)

**What was migrated:**
- Your profile, shifts, and payroll history
- Departments and team memberships

**What you need to redo:**
- Mobile push notification permissions
- Pending shift swap requests (see separate email if this applies to you)

Questions? Talk to {workspace_owner_name} or reply to this email.

Best,
{workspace_owner_name}

---

## Variables to substitute

| Placeholder | Source |
|---|---|
| `{first_name}` | `user_identity.first_name` |
| `{email}` | `user_identity.email` |
| `{workspace_slug}` | `workspace.slug` (e.g., `wrightegaarden`) |
| `{workspace_owner_name}` | from workspace owner profile |

## Send checklist (HR / workspace owner)

- [ ] Confirm migration apply succeeded for ALL 127 users (no `auth_bridge.failed.csv` rows for this workspace)
- [ ] Confirm v3 login flow's force-password-reset gate is live (`migrated_from_bubble === true && last_sign_in_at IS NULL` → must reset)
- [ ] Confirm new mobile app version is live in stores (old app must show maintenance page)
- [ ] Send Norwegian version to all migrated users
- [ ] Send English version to users with `preferred_language = 'en'` (post-Q4 enum coercion fix)
- [ ] Track open/click rates for 7 days
- [ ] Surface non-responders to manager outreach by day 7
