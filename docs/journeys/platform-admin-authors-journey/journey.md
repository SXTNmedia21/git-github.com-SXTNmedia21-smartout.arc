---
schema_version: "2.0.0"
journey_version: "v1"
id: "platform-admin-authors-journey"
title: "Platform admin authors a new journey via the wizard"
status: defined
created: 2026-04-29
updated: 2026-04-29
author: pontus
description: >
  A platform admin uses the journey-authoring wizard to define, classify, and
  publish a new Smartout journey end-to-end through 6 phases.

mode: sequential
repeat_policy: always

actor: admin
platform: web
auth_profile: authenticated

module: meta
relevance:
  onboarding: false
  daily_use: false
  rare_event: true
priority: P0

entry_url: "/platform-admin/journeys/wizard/[sessionId]"
preconditions:
  - "User is authenticated with godmode (super_admin) JWT claim"
  - "wizard_session row exists in workspace_id with status='active'"
  - "Stage-engine is reachable (mission='journey_authoring' wired in /api/emma/chat)"
  - "Capability journey_authoring is seeded in engine_authority_config"

success_gate:
  description: >
    Mission published to engine_missions; engine_stages rows created;
    journey row inserted with status='ready_test'.
  predicate: >
    engine_missions[id='journey_<slug>_v1'].is_active = false
    AND count(engine_stages WHERE mission_id='journey_<slug>_v1') >= 1
    AND journey[slug='<slug>', workspace_id=<ctx>].status = 'ready_test'

prerequisites: []
terminates: []
exclusive_with: []

assist:
  threshold: 0.85
  default_silence_ms: 30000
  cooldown_ms: 3600000

tags: [meta, wizard, authoring, platform-admin, journey-protocol]

system_prompt: |
  Du er Smartouts journey-authoring wizard. Din oppgave er å guide en platform-admin
  gjennom 6 faser for å definere en komplett ny journey. Vær grundig, still gode
  oppfølgingsspørsmål, og foreslå verdier proaktivt.

  DIN ROLLE: Guide brukeren gjennom 6 faser for å definere en komplett journey.
  Lagre draft etter hver fase via save_draft. Snakk norsk i all dialog, men bruk
  engelske verdier for tekniske felt (module, actor, platform, priority, tags).
  Vis fase-progresjon i hver respons: "Fase X/6: <Navn>".

  FASE 1 — DISCOVERY: Forstå HVA brukeren skal kunne gjøre. Spør om mål, hvem,
  når, og trigger. Resultat: title (kort, tydelig), trigger_description (én
  setning som beskriver hva som starter journeyen).

  FASE 2 — CLASSIFICATION: Kategoriser journeyen. Foreslå module, actor,
  platform, priority, tags. Sjekk duplikater (check_duplicates) og relaterte
  journeys (lookup_journeys) før du fortsetter. Resultat: module, actor,
  platform, priority, tags.

  FASE 3 — STEPS: Definer steg-for-steg. Hvert steg har: title, action
  (handling), expects (assertion), screen (rute), component (data-journey
  attributt). Ett steg = én brukerhandling. Resultat: steps array (1..N).

  FASE 4 — TESTING: Definer testverdier. Foreslå test_assertion (en-linjers
  E2E-sjekk som kan kjøres av Playwright), preconditions (hva må være sant før
  start). Resultat: test_assertion, preconditions.

  FASE 5 — DOCUMENTATION: Norske titler og utfall. Foreslå doc_title (norsk,
  for journey-katalogen), outcomes_success (hva ser bruker når det går bra),
  outcomes_empty (når det ikke er data ennå), outcomes_error (når noe feiler).
  Resultat: doc_title, outcomes_success, outcomes_empty, outcomes_error.

  FASE 6 — REVIEW: Vis komplett oversikt formatert (tabell + steps-liste).
  Lagre utkast med save_draft (next_phase="review"). Vent på brukerens
  eksplisitte godkjenning ("godkjent" / "publish" / "kjør"). Når godkjent →
  invoke publish_mission med journey_version_id. Aldri publish uten klart "ja".

  REGLER:
  - Aldri PII i tale (ADR-0078) — wizard er chat-only.
  - Hver mutasjon går gjennom save_draft → gatedMutation (ADR-0204).
  - Slug auto-genereres fra title ved publish; code (J-XXX) tildeles ved første
    save_draft.
  - 18 moduler: core, onboarding, org, scheduling, operations, haccp, training,
    absence, payroll, communication, reports, settings, ai, season, governance,
    contracts, certifications, meta.
  - 6 actor-typer: employee, trainee, manager, admin, owner, all (+
    platform_admin for godmode-journeys).
  - 3 plattformer: mobile, desktop, both. 4 prioriteter: P0, P1, P2, P3.

i18n:
  en:
    title: "Platform admin authors a new journey via the wizard"
    description: "Define, classify, and publish a new Smartout journey through 6 wizard phases."
  no:
    title: "Plattform-admin definerer ny journey via wizarden"
    description: "Definer, kategoriser og publiser en ny Smartout-journey gjennom 6 wizard-faser."

steps:
  - key: "step.wizard.discovery"
    title: "Discovery — capture intent"
    description: >
      Admin describes what the new journey should accomplish. Wizard asks for
      title, trigger, and one-sentence goal. Saves draft with phase=discovery.
    order: 1
    trigger:
      type: server_event
      event_name: "journey_authoring phase_advanced_discovery"
      filter: "session_id == ctx.sessionId"
    assertion: >
      wizard_session[wizard_session_id=ctx.sessionId].draft_journey
      contains keys 'title' AND 'trigger_description'
    next_step_window_ms: 600000
    on_timeout: pause
    weight: 0.1
    confidence_contribution: low
    actor: admin
    pii_input: false
    instructions: >
      Be the admin name the journey in one sentence. If it contains "and",
      push back — likely two journeys. Lock title + trigger_description before
      advancing. Call save_draft(next_phase="classification") to advance.

  - key: "step.wizard.classification"
    title: "Classification — module + actor + platform"
    description: >
      Wizard helps admin classify the journey. Calls lookup_journeys +
      check_duplicates. Locks module, actor, platform, priority, tags.
    order: 2
    trigger:
      type: server_event
      event_name: "journey_authoring phase_advanced_classification"
      filter: "session_id == ctx.sessionId"
    assertion: >
      wizard_session.draft_journey contains keys
      'module' AND 'actor' AND 'platform' AND 'priority' AND 'tags'
    next_step_window_ms: 600000
    on_timeout: pause
    weight: 0.15
    confidence_contribution: medium
    actor: admin
    pii_input: false
    instructions: >
      Run check_duplicates(title, module, actor) before advancing. If matches
      found, surface them and ask admin to confirm new journey is distinct.
      Validate: module ∈ 18 known modules, actor ∈ 6 known actors, priority ∈
      {P0,P1,P2,P3}.

  - key: "step.wizard.steps"
    title: "Steps — define 1..N step list"
    description: >
      Admin walks the wizard through the user flow chronologically. Each step
      captures title, action, expects, screen, component (data-journey).
    order: 3
    trigger:
      type: server_event
      event_name: "journey_authoring phase_advanced_steps"
      filter: "session_id == ctx.sessionId"
    assertion: >
      wizard_session.draft_journey.steps is array AND length(steps) >= 1
    next_step_window_ms: 1800000
    on_timeout: pause
    weight: 0.25
    confidence_contribution: high
    actor: admin
    pii_input: false
    instructions: >
      Push back on (1) "step" that is actually 3 sub-actions, (2) UI rendering
      as a step (system response, not user step), (3) >12 steps (suggest
      splitting). Each step needs a unique key, a deterministic assertion, and
      next_step_window_ms.

  - key: "step.wizard.testing"
    title: "Testing — test assertion + preconditions"
    description: >
      Wizard locks the one-line E2E test assertion + preconditions array that
      must hold before the journey can run.
    order: 4
    trigger:
      type: server_event
      event_name: "journey_authoring phase_advanced_testing"
      filter: "session_id == ctx.sessionId"
    assertion: >
      wizard_session.draft_journey contains key 'test_assertion'
      AND wizard_session.draft_journey.preconditions is array
    next_step_window_ms: 600000
    on_timeout: pause
    weight: 0.1
    confidence_contribution: medium
    actor: admin
    pii_input: false
    instructions: >
      The test_assertion must be deterministic and Playwright-runnable. Reject
      assertions that reference Date.now(), Math.random(), or LLM calls.

  - key: "step.wizard.documentation"
    title: "Documentation — Norwegian doc + outcomes"
    description: >
      Wizard captures Norwegian doc_title and the three outcomes
      (success / empty / error) that drive the journey-catalogue UI.
    order: 5
    trigger:
      type: server_event
      event_name: "journey_authoring phase_advanced_documentation"
      filter: "session_id == ctx.sessionId"
    assertion: >
      wizard_session.draft_journey contains keys 'doc_title' AND
      'outcomes_success' AND 'outcomes_empty' AND 'outcomes_error'
    next_step_window_ms: 600000
    on_timeout: pause
    weight: 0.1
    confidence_contribution: medium
    actor: admin
    pii_input: false
    instructions: >
      doc_title MUST be Norwegian. Outcomes are end-user-facing copy — short,
      concrete, no jargon. "Empty" = before first run, "Error" = recoverable
      failure (not crash).

  - key: "step.wizard.review"
    title: "Review — confirm and publish"
    description: >
      Wizard shows full spec summary, awaits explicit admin approval, then
      invokes publish_mission to materialize engine_missions + engine_stages
      rows and flip journey.status to ready_test.
    order: 6
    trigger:
      type: server_event
      event_name: "journey_authoring journey_published"
      filter: "session_id == ctx.sessionId"
    assertion: >
      engine_missions[id='journey_<slug>_v1'].journey_id IS NOT NULL
      AND count(engine_stages WHERE mission_id='journey_<slug>_v1') >= 1
      AND journey[slug='<slug>'].status = 'ready_test'
    next_step_window_ms: 120000
    on_timeout: assist
    assist_silence_ms: 30000
    weight: 0.3
    confidence_contribution: terminal
    actor: admin
    pii_input: false
    instructions: >
      Format the spec summary as a table + steps list. Wait for explicit
      "godkjent" / "publish" / "kjør". Never auto-publish. On approval call
      publish_mission(journey_version_id). On any error from publish_mission,
      surface the error code and offer to amend instead of retry.
