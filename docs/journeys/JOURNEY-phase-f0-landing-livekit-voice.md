---
title: "Journey — Landing Wizard LiveKit Voice (Ultravox Removal)"
feature: phase-f0-perimeter
status: deferred
deferred_reason: "Title and body assumed LiveKit migration to landing; sortie shipped strip-only (T1, commit 6d52c6522). Landing wizard is now text-only with CTA to web wizard. Journey body describes flows that were never built. Rewrite tracked as Phase F sortie follow-up."
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
tags: [voice, landing, livekit, ultravox-removal, audit-fix, F-AC-02]
---

# Journey — Landing Wizard LiveKit Voice

Closes audit finding F-AC-02. Phase E commit `1dea96e1e` deleted `/adapters/ultravox/create-call` from stage-engine. `apps/landing/src/app/api/wizard/engine-start/route.ts:47` still POSTs to that deleted endpoint. Landing voice widget broken in prod NOW. ADR-0282 AC#1 violation.

## Journey 1: Anonymous landing visitor starts voice with Lise

**Precondition:** Anonymous visitor på `https://smartout.ai/` landing page. No auth, no profile.

1. Visitor trykker "Snakk med Lise" → System rendrer wizard CTA, voice-call-button enabled
2. Visitor trykker mic → Landing client posts `/api/wizard/engine-start` (eller new equivalent) → server minter LiveKit token via `livekit-token` Edge Function `purpose: "wizard"`, `wsId = "anon"`, `userId = "anon-<uuid>"`
3. Landing client connecter til LiveKit room `anon:wizard:anon-<uuid>` → voice-agent picker opp room navn → resolver mission `lise-interview` (per Phase E mission-aware dispatch)
4. Lise (voice=coral persona) svarer "Hei! Hva slags virksomhet driver du?" → Visitor svarer
5. Visitor svarer på 3-5 spørsmål → Lise builder up workspace draft
6. Visitor klikker "Lag konto" → wizard transitions til signup flow med pre-filled draft

**Postcondition:** Visitor har snakket med Lise via LiveKit (NOT Ultravox). Landing → wizard → signup pipeline funker.

**Error paths:**
- LiveKit token mint fails (`livekit-token` EF down) → landing viser "voice midlertidig utilgjengelig, fyll inn manuelt"
- Voice-agent ikke registered med LiveKit → 30s timeout → samme fallback
- Visitor blokkerer mic-permission → landing viser tekst-input fallback

## Journey 2: Landing wizard fallback when LiveKit blocked

**Precondition:** Visitor har firewall som blokkerer LiveKit Cloud (corporate network).

1. Visitor trykker mic → Token mint OK → Room.connect() fails after 10s timeout
2. Landing detecter timeout → viser tekst-chat fallback med samme Lise persona via `/api/wizard/engine-start` (text mode)
3. Visitor svarer i tekst → wizard fortsetter

**Postcondition:** Visitor får fortsatt onboarded selv uten voice.

**Error paths:**
- Tekst-chat backend down også → landing viser "kommer tilbake snart" + email-form
