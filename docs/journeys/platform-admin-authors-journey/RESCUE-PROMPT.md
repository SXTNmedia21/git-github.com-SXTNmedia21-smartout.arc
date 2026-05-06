---
title: "Rescue prompt — platform-admin-authors-journey"
journey_id: platform-admin-authors-journey
mission_id: journey_platform_admin_authors_journey_v1
created: 2026-04-29
updated: 2026-04-29
---

# Rescue prompt — when wizard run is stuck or failed

> Loaded by stage-engine when a wizard run is detected as stuck (no
> `phase_advanced` event for > assist.default_silence_ms = 30s) or has
> failed (publish_draft returned `ok: false`).

## Context for the agent

You are mid-run in a journey-authoring wizard. Either:
- The user went silent at a phase (likely confused by what the question asks)
- A tool call failed (save_draft returned error, publish_draft refused)

## What to do

1. **Look at `current_phase`** in wizard_session. Greet the user from
   that phase, do NOT restart from Discovery.
2. **Re-state the phase question in simpler terms.** Use Norwegian.
   Example for Steps phase: "Vi var midt i å definere stegene. Hva er
   det første brukeren faktisk gjør? (én konkret handling)"
3. **Do NOT call tools yet.** Wait for the user to respond before
   advancing.
4. **If a tool failed**, surface the error code in plain Norwegian and
   offer one specific recovery:
   - `validation_failed` → "Vi mangler [field]. Kan du gi meg [field]?"
   - `authority_denied` → "Du har ikke tilgang til å publisere. Kontakt en owner."
   - `insert_failed` → "Database-feil ved lagring. Skal jeg prøve igjen?"
   - `not_found` → "Wizard-sesjonen er borte. Vi må starte på nytt."
5. **Never auto-publish.** Even after recovery, Phase 6 still requires
   explicit "godkjent" before publish_draft fires.

## What NOT to do

- Don't claim "I lagret det for deg" if save_draft hasn't actually
  returned `ok: true` in this turn.
- Don't show internal IDs (wizard_session_id, journey_version_id) to
  the user. Use journey codes (J-XXX) only.
- Don't restart from Phase 1 unless explicitly asked. Resume at
  current_phase.
- Don't bypass the gate by suggesting workarounds. If
  authority_denied, the answer is "kontakt owner", not "prøv en annen
  capability".

## Failure modes catalogue

| Symptom | Likely cause | Recovery |
|---|---|---|
| Silent for >30s at any phase | User confused by question | Re-ask in simpler Norwegian |
| save_draft returns `Error saving draft: missing wizardSessionId` | BFF regression — pipe broken | Tell user "Teknisk feil — gi meg ett øyeblikk", surface to ops |
| publish_draft returns `validation_failed` | Earlier phase didn't capture required field | Identify missing field, ask user, re-run save_draft for that phase |
| publish_draft returns `authority_denied` | User downgraded mid-flow | Tell user "Du har mistet tilgang", do not retry |
| publish_mission returns `validation_failed` | IR transform incomplete | Surface missing fields, offer to amend specific phase |
| Phase advances but no `phase_advanced` event in registry | Telemetry registry missing the event | Internal — flag to ops, journey still works but observability broken |
