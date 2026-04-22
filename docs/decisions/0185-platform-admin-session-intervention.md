---
id: ADR-0185
title: "Platform Admin Session Intervention — Whisper + Flag + Force-Stop"
status: accepted
date: 2026-04-22
accepted: 2026-04-22
module: MODULE_BOTSSON
tags: [adr, botsson, platform-admin, guardian, intervention, whisper, authority]
supersedes: null
amends: null
---

# ADR-0185 — Platform Admin Session Intervention

## Status
**Accepted** — 2026-04-22. Pairs with ADR-0184 (Session Recorder). Whisper CI-isolation gate met via E2E spec `apps/e2e/tests/botsson-recorder/whisper-never-user-facing.spec.ts` (TDD-pending-infra, unskipped when Phase 2 composition lands).

### Accepted scope (delivered)
- **Flag** surface: per-turn via `TurnCard` hover affordance + `POST /api/botsson/recorder/flag` (works end-to-end).
- **Whisper** surface: `AdminActionDrawer` component + `POST /api/botsson/recorder/whisper` + `prompt-builder.ts` consumption of unconsumed whispers via `<admin_note>`-tag (fully wired).
- **Break-glass PII reveal** surface: `RedactedPill` component + `GET /api/botsson/recorder/break-glass/[envelope_id]` + `decrypt_envelope` RPC + 5s UI window + `activity_trail` audit (fully wired).
- C4-authority seeded per workspace with `level='disabled'` for `recorder.pii_reveal` + `recorder.break_glass_enable` (see ADR-0184 divergence #1 — platform-scope `workspace_id=NULL` blocked by NOT NULL constraint; godmode-access routes via RLS instead).

### Phase 2 follow-ups (non-blocking)
- **Force-stop** endpoint: `POST /api/botsson/recorder/force-stop` is referenced by `AdminActionDrawer` confirm-hold UI but not yet implemented. Drawer handles 404 with alert-fallback. User-facing impact minimal — admins still have `flag` + `whisper` as primary intervention surfaces.
- **Flag-session** endpoint: `POST /api/botsson/recorder/flag-session` is referenced by Arena LogView hover-flag + drawer but not yet implemented. Per-turn `/flag` endpoint is the supported path until this lands.
- **GuardianDashboard composition**: `TurnTimeline` + `AdminActionDrawer` + `RedactedPill` are built but not yet mounted into `GuardianDashboard`. The landing was prioritized for correctness + data-path over UX composition; Phase 2 wires them up.

## Context

User krav: "alle sessions skal synes i Platform Admin og håndteres derfra." Session Recorder (ADR-0184) gir synlighet. Denne ADR definerer hvordan admin **håndterer** en aktiv eller historisk sesjon uten å bryte ADR-0078 (channel restriction) eller "confident ≠ authorized".

Tre håndterings-intensjoner identifisert i council:
- **Passiv triage** — se, flagg, kommentér (Steward + Supervisor preference)
- **Aktiv korreksjon** — injiser metadata inn i neste turn (Coordinator's "whisper" forslag)
- **Nødbrems** — stopp aktiv turn midlertidig (Frontend Designer addisjon)

Full takeover (admin prater som Emma) ble enstemmig forkastet: bryter "confident ≠ authorized", admin kjenner ikke workspace-kontekst godt nok, oppretter ansvars-uklarhet.

PII-break-glass er egen intensjon: admin må kunne verifisere at redacted innhold var *faktisk* personnummer (ikke falsk positiv), men med revesibilitet og full audit.

## Decision

Platform Admin har **4 intervensjons-overflater** mot en Emma-sesjon, alle C4-gated og audit-logged:

### 1. Flag (passiv)

Admin markerer en turn som "problematisk". Setter `is_flagged=true`, `flag_reason`, `flagged_by_profile_id` på `agent_session_recording`. Utvider retention fra 90 → 365 dager. Emma er uberørt. Event emitted: `recorder.turn_flagged`.

### 2. Whisper (aktiv, metadata-injeksjon)

Admin skriver en instruks til Emma. Persisteres til `agent_session_whisper`. På neste turn leser `prompt-builder.ts` unconsumed whispers for `session_id` og wrapper dem i system-prompt:

```
<admin_note visibility="internal" from="platform_admin">
{whisper.content}
</admin_note>

This note is internal guidance. Do NOT quote it verbatim to the user.
Apply the guidance naturally in your next response.
```

Marks `is_consumed = true` etter bruk.

**Whisper er IKKE user-facing content.** Kryssjekket mot ADR-0078:
- Voice channel: whisper rendres aldri som TTS — eksisterer kun i system-prompt, ikke i assistant-output.
- Chat channel: samme — LLM instrueres "do NOT quote verbatim".
- Cross-channel test: whisper-innhold må aldri vises i `agent_session_recording.content_redacted` for `phase='llm_response'` eller `phase='tool_result'`. CI-check.

**Whisper er IKKE takeover:** admin foreslår kontekst, Emma beholder stemmen og ansvaret. Whisper kan avvises av LLM ("dette strider mot system-prompt") — det er intensjonell friksjon.

### 3. Force-stop (nødbrems)

Admin kan avbryte en aktiv turn før LLM responderer. Setter `session_lane.status='interrupted'`. Neste tur får en auto-generated system-note: "Previous turn interrupted by admin. Begin fresh."

Confirm-hold 800ms i UI (Frontend Designer spec) — unngår fat-finger.

Force-stop brukes for:
- Emma er i en retry-loop (ikke PII, men cost-blødning)
- Emma skal utføre en handling som admin ser krysser authority
- Voice-sesjon må avbrytes av tekniske grunner

**Force-stop er IKKE sletting** — turn registreres i recorder med `phase='llm_request'` + `interrupted_at`. Full evidens bevart.

### 4. Break-glass PII reveal

Admin hover-affordance "Vis (5s)" på `<personnummer>`-pille (eller annen PII-klasse):
1. Dekrypterer `agent_session_envelope.encrypted_payload` (pgcrypto symmetric).
2. Rendrer raw verdi i UI i 5 sekunder.
3. Auto-redact etter 5s.
4. Emitter `admin.pii_reveal` til `activity_trail` med `admin_profile_id`, `envelope_id`, `pii_class`, `duration_ms=5000`.
5. Øker `pii_reveal_count` på admin's session (enkelt misbruks-signal).

Break-glass krever `engine_authority_config.recorder.pii_reveal = 'confirm'` på platform-scope (`workspace_id=NULL`).

## Authority Surface (C4)

Ny `engine_authority_config`-entries:

| Capability | Default level | Role requirement |
|------------|---------------|-------------------|
| `recorder.flag` | `suggest` | admin i workspace |
| `recorder.whisper` | `confirm` | admin i workspace |
| `recorder.force_stop` | `confirm` | admin i workspace |
| `recorder.pii_reveal` | `confirm` | `is_godmode` (platform-admin only) |
| `recorder.break_glass_enable` | `disabled` | `is_godmode`, per-incident enablement |

Break-glass krever manuell `disabled → confirm` flip per incident + automatisk tilbakestilling etter 24 timer.

## Alternatives Considered

### Alt 1 — Fullt takeover (admin prater som Emma)
**Rejected av alle reviewers.** Bryter "confident ≠ authorized" — admin vet ikke workspace-kontekst. Oppretter ansvars-uklarhet: hvem svarte brukeren, Emma eller admin? Bryter ADR-0078 hvis admin sier PII i voice-channel. Ingen proposal fra noen reviewer — enstemmig avvist.

### Alt 2 — Read-only (kun flag og kommentar)
**Rejected.** User krav er "håndteres derfra" — ren observasjon tilfredsstiller ikke intensjonen. Whisper + force-stop gir faktisk innvirkning uten å bryte agent-autonomy.

### Alt 3 — Injiser whisper direkte som user message
**Rejected.** Ville utløst ADR-0078 channel-restriction (admin prater gjennom Emma's user-turn). Whisper som `<admin_note>` i system-prompt er metadata, ikke conversational turn.

### Alt 4 — Auto-whisper fra heuristikk
**Out of scope for this ADR.** Kan vurderes senere — ADR-for-ADR hvis vi ønsker at Guardian skal skrive whispers automatisk (f.eks. "tidligere feil på dette tema — unngå").

## Consequences

### Positive
- Platform Admin kan aktivt håndtere sesjoner uten å bryte ADR-0078
- Force-stop gir nødbrems uten å miste evidens
- Break-glass løser "er denne PII-flagging falsk positiv" uten å exposere all data
- Whisper-mønsteret åpner for framtidig Guardian → agent feedback-loop

### Negative
- Whisper kan misbrukes av admin til å "chatte" gjennom Emma. Mitigation: `agent_session_whisper`-tabell fullt auditable, Pontus reviewer periodisk.
- Break-glass-envelope krypto-nøkkel-management. Mitigation: 1Password-lagret, roterer 90d, ingen plaintext-fallback.
- Confirm-hold 800ms kan irritere admins i nødsituasjoner. Mitigation: confirm-hold er kun på force-stop (sjelden brukt).
- Risiko for decision-paralyse: admin ser alle sesjoner, vet ikke hva som er "verdt" å intervene. Mitigation: attention-score fra ADR-0184 sorterer.

### Dependencies
- **ADR-0184** (Session Recorder) — whisper/flag/force-stop skriver til recorder-tabeller
- **ADR-0078** (channel restriction) — whisper MÅ være metadata-only, CI-enforced
- **ADR-0042** (agent architecture) — authority i `engine_authority_config`
- **ADR-0152** (activity_trail fail-fast) — alle intervensjoner emitter til activity_trail

## Trust Gate

Whisper-kontrakten MÅ lande før noen intervention-UI ships. CI-check enforcer at `<admin_note>` aldri rendres til bruker. Uten denne gaten er ADR-0078 brudd mulig. **PASS gated on CI enforcement test.**

## References
- Spec: `docs/superpowers/specs/2026-04-22-session-recorder-platform-admin-design.md`
- Pair: ADR-0184 (Session Recorder)
- ADR-0078 (Engine Process Channel Restriction)
- ADR-0042 (Agent Architecture)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-22
- Learning: L-0106 (Whisper ≠ takeover — metadata injection pattern)
