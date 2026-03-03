---
title: "User Journey — Onboarding Redesign"
status: done
updated: 2026-03-11
created: 2026-03-11
module: onboarding
tags: [onboarding, scroll, voice, journey]
---

# User Journey — Onboarding Redesign

## Overview

The onboarding flow is a 6-section scroll-based wizard that guides new users through workspace setup. Users cannot scroll freely — each section advances only when the CTA button is clicked. A voice assistant (Mr. Botsson) accompanies the user throughout.

Sections: Hero (login) → Business → Season → Departments → Contract → Done (activate)

---

## Journey: New User — Full Onboarding (Happy Path)

**Precondition:** User has no existing workspace. Arrives at `/onboarding`.

1. **Hero Section** — User sees split headline "Velkommen til / Smartout"
   - User clicks "Fortsett med Google" → Google OAuth popup → returns authenticated
   - OR user expands email form → enters email + password → signs up
   - System sets `isAuthenticated = true`, `userId` populated
   - User clicks "Fortsett" → section completes, smooth scroll to Business

2. **Business Section** — User enters company info
   - User enters website URL or org number (or both)
   - Clicks "Skann bedriften" → system calls `gather-workspace-intelligence` Edge Function
   - Loading state shows while scraping
   - On success: business fields auto-populate (name, email, phone, address, industry, org number)
   - Departments auto-populate based on NACE code
   - User can manually edit any field
   - User clicks "Fortsett" → section completes, smooth scroll to Season

3. **Season Section** — User configures first season
   - System pre-suggests season name and dates based on current date
   - User can adjust name, start date, end date
   - User clicks "Bekreft sesong" → section completes, smooth scroll to Departments

4. **Departments Section** — User reviews suggested departments
   - Departments are pre-populated from industry (NACE code mapping)
   - Each department shows as a toggle chip with position count
   - User can toggle departments on/off
   - User can add custom departments via "Legg til avdeling" button
   - User clicks "Bekreft avdelinger" → section completes, smooth scroll to Contract

5. **Contract Section** — User reviews contract template
   - Shows company name, org number, address
   - Lists included contract elements (employment agreement, GDPR consent, NDA, handbook reference)
   - User clicks "Bekreft kontraktmal" → section completes, smooth scroll to Done
   - OR clicks "Tilpass senere i dashboardet" → skips, same result

6. **Done Section** — User reviews summary and activates
   - Shows summary: season name + dates, department count with positions, total positions
   - Shows "Neste steg" list (invite employees, set up schedules, configure procedures)
   - User clicks "Ga til dashboardet" → system calls `activate-workspace` Edge Function
   - On success: workspace created, session marked complete, redirect to `/dashboard`

**Postcondition:** Workspace is active. User lands on dashboard. `onboarding_session` row has `completed_at` set.

---

## Journey: Returning User — Resume Onboarding

**Precondition:** User has an incomplete `onboarding_session` (no `completed_at`).

1. User navigates to `/onboarding`
2. System checks auth → finds existing user
3. System queries `onboarding_session` for incomplete session
4. If scraped data exists: business fields restored from `scraped_data` JSON
5. Scrape status set to "done"
6. User continues from where they left off

**Postcondition:** User picks up where they stopped. No data lost.

---

## Journey: User — Reset Onboarding

**Precondition:** User is anywhere in the onboarding flow.

1. User clicks the reset button (top-right corner, RotateCcw icon)
2. System deletes the `onboarding_session` row from the database
3. All local state resets: section → hero, business → empty, season → fresh suggestion, departments → empty
4. Page scrolls back to hero section
5. `hasResumed` ref resets so session resume can fire again

**Postcondition:** Clean slate. No stale data in DB or UI.

---

## Journey: User — Skip Sections

**Precondition:** User is on Hero or Business section.

1. User clicks "Hopp over" link below the main CTA
2. Section is marked complete, next section becomes active
3. Smooth scroll to next section
4. Skipped data remains at defaults (empty business, suggested season)

**Postcondition:** User advances without completing the section. Can still finalize with defaults.

---

## Journey: User — Voice Assistant Interaction

**Precondition:** User is on any section. Mr. Botsson voice agent is connected.

1. On first click anywhere on the page, Botsson session starts (browser gesture required for audio)
2. As user scrolls between sections, system pushes context to voice agent:
   - Business section: "Brukeren er na pa bedriftsseksjonen..."
   - Season section: includes current season suggestion
   - Departments section: lists selected departments
   - Done section: full summary
3. Scrape status changes also push to voice agent ("Skanner bedriften na...", "Skanning ferdig!")
4. User can view agent details via AgentCard (shows mission config, transcript, context log)
5. User can mute/unmute microphone via BotssonAvatar controls

**Postcondition:** Voice agent is contextually aware of user's progress throughout onboarding.

---

## Error Paths

### Scraping fails

- `gather-workspace-intelligence` returns error → scrape status set to "error"
- User sees error message: "Noe gikk galt. Sjekk adressen og prov igjen."
- Voice agent notified: "Skanningen feilet..."
- User can retry or skip to enter data manually

### Workspace activation fails

- `activate-workspace` returns error → error shown below CTA button
- Button re-enables for retry
- Error logged to console

### User not authenticated

- Business section scan still works (edge function doesn't require auth for scraping)
- Session save is skipped (no userId)
- Finalization will fail (workspace creation requires auth)

### Google OAuth popup blocked

- User sees no auth state change
- Can fall back to email form (expand "Opprett konto med e-post")
