---
title: "Journey — Wizard Onboarding State via /api/emma/session BFF"
feature: phase-f0-perimeter
status: draft
verified_at: null
e2e_test: null
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
tags: [onboarding, wizard, bff, audit-fix, F-OB-04]
---

# Journey — Wizard Onboarding State via /api/emma/session BFF

Closes audit finding F-OB-04. Phase E E2 shipped `/api/emma/session` BFF endpoint to replace client-side `getOnboardingState`, but audit found ZERO consumers in codebase. Either wire intended consumer OR document deferment.

## Journey 1: New user resumes onboarding from where they left off

**Precondition:** User Sara started onboarding wizard yesterday (got to step 3 of 6). Logged out. Returns today.

1. Sara logger inn → System redirecter til `/onboarding` (siden hun ikke har completed)
2. AnimatedWizardShell mounts → Step indicator viser steps 1-6
3. Wizard kaller `/api/emma/session` BFF endpoint → server returnerer `collected_data` fra `engine_sessions` row med Sara's onboarding mission state
4. Wizard resumer på step 3 med pre-filled data fra steg 1+2 → Sara ser "Velkommen tilbake, du var her"
5. Sara fortsetter med step 3-6 → wizard committer state via existing Server Actions
6. Sara completer wizard → workspace creation finalized → redirect til `/dashboard`

**Postcondition:** Sara fortsatte uten å miste data. `/api/emma/session` BFF konsumert. Phase E E2 endpoint serverer real consumer.

**Error paths:**
- `/api/emma/session` returnerer 404 (no row) → wizard starter fresh på step 1 (pas på pre-existing data ikke overskriver)
- BFF returnerer 500 → wizard viser "kunne ikke laste, prøv igjen" med retry-knapp
- collected_data corrupt/missing fields → wizard skipper steps som ikke kan parses, fortsetter på første mulige

## Journey 2: BFF endpoint returnerer mission status til voice-agent

**Precondition:** Wizard kjører voice mode (Lise interview). Voice-agent trenger å vite hva Sara allerede har svart på.

1. Voice-agent connecter → posts `/agent/chat` med voice context
2. Stage-engine fetcher mission state via `/api/emma/session` (server-to-server) → henter siste tilstand
3. Voice-agent constructer system prompt med "Sara har allerede svart på X, Y. Spør om Z."
4. Lise unngår å gjenta spørsmål Sara allerede har svart på

**Postcondition:** Voice + tekst wizard har felles state-source. Ingen duplikat-spørsmål.

**Error paths:**
- BFF returnerer empty state → voice-agent starter fresh interview
- Race condition: Sara svarer i tekst mens voice kjører → siste-write-wins via `engine_sessions.updated_at`
