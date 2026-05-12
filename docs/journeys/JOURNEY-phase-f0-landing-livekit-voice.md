---
title: "Journey — Landing Voice Strip + Web Wizard Redirect (Ultravox Removal)"
feature: phase-f0-perimeter
status: verified
verified_at: 2026-05-10
e2e_test: "manual: landing CTA + grep apps/landing/src for ultravox = 0 hits"
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
tags: [voice, landing, ultravox-removal, audit-fix, F-AC-02]
---

# Journey — Landing Voice Strip + Web Wizard Redirect

Closes audit finding F-AC-02. Phase E commit `1dea96e1e` deleted `/adapters/ultravox/create-call`. `apps/landing/src/app/api/wizard/engine-start/route.ts:47` still POSTed to deleted endpoint until Phase F0 commit `6d52c6522` stripped Ultravox from `apps/landing/` entirely.

**Decision shipped:** Web wizard (`apps/web/src/app/onboarding/`) is the sole voice surface. Landing wizard becomes text-only with CTA redirecting visitors to web wizard for voice.

## Journey 1: Anonymous landing visitor uses landing wizard text-only

**Precondition:** Anonymous visitor på `https://smartout.ai/` landing page. No auth, no profile.

1. Visitor scroller til wizard-seksjon → System rendrer text-only wizard interface (`voice-assistant.tsx` shows static CTA, ikke UltravoxSession-mount).
2. Visitor leser CTA: "Få voice-onboarding på smartout.ai/onboarding" → CTA-button linker til web wizard.
3. Visitor klikker CTA → redirect til `https://smartout.ai/onboarding` (web wizard surface).
4. Web wizard takeover — Lise persona + LiveKit voice-onboarding kjører der (covered separately by `JOURNEY-voice-plane-consolidation-wizard-onboarding-via-livekit.md`).

**Postcondition:** Visitor onboarded via web wizard voice. Landing forblir text-only entry-point. ADR-0282 contract verified: `grep -rn "ultravox" apps/landing/src` = 0 hits.

**Error paths:**
- Visitor klikker CTA, `smartout.ai/onboarding` nede → standard 5xx page; landing-side har ingen ansvar for web wizard uptime.
- Visitor blokkerer redirect (rare) → ser CTA-button som dead-link; faller tilbake på fyll-inn-manuelt-text-input på landing wizard.

## Journey 2: Stale client cache hits removed `/api/wizard/engine-start` voice path

**Precondition:** Visitor har gammel landing client i nettleser-cache fra før commit `6d52c6522`. Klient husker fortsatt voice-call-pattern.

1. Cached visitor klient kaller `/api/wizard/engine-start` med voice-intent payload → Server response: `410 Gone`.
2. Server-side telemetry: `logVoiceUnavailable()` skriver til `landing_event` table (workspace-uavhengig pre-auth surface) — operator kan observere landing→web redirect-rate via `landing_event` aggregation.
3. Visitor klient kan vise fallback-text eller crash gracefully — landing-side har gjort sin del (ærlig 410 + log).

**Postcondition:** Ingen 500-error. Ingen lekkasje av Ultravox-tilstand. Telemetri synlig for ops.

**Error paths:**
- `landing_event` insert fails → kun log-side effekt; 410 returneres uavhengig (fire-and-forget pattern matcher ADR-0134 mobile-telemetry-analog: pre-auth surface bruker landing_event, ikke `emit()` som krever workspace_id).

## Verification (shipped state, audit-confirmed 2026-05-10)

- `grep -rn "ultravox|UltravoxSession" apps/landing/src` = **0 hits** (slice 02 audit run-02 PASS)
- `grep -rn "ultravox" supabase/functions/` = **0 hits** (slice 02 PASS)
- `apps/landing/src/components/voice-assistant.tsx` = static CTA component, ingen voice-mount kode.
- `apps/landing/src/app/api/wizard/engine-start/route.ts` returnerer 410 Gone + `logVoiceUnavailable()` event.
- `apps/landing/package.json` har ikke `ultravox-client` dependency.
