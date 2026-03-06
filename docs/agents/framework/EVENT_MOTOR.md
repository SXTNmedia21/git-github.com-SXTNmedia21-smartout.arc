# The Event Motor Framework (Smartout)

## Core Concept: The Universal Architecture

Everything in Smartout—from Onboarding to Daily Operations to System Health—is structured around a single, universal framework called **The Event Motor**. This framework ensures predictability, automated testing, continuous scoring, and intelligent evolution.

It is built upon **Journeys** (the overarching user flows) and **Roadmaps** (the backend blueprints).

### The Three Pillars

1. **The Definition (Roadmap):** The blueprint. Steps, hooks, requirements, and expected data.
2. **The Experience (Journey):** The live instance. "I'm doing this." Guided by AI (Botsson), tracked by the system.
3. **The Oversight (Protocol):** "How's it going?" Insight, observation, and control for leaders.

## Event Motor Lifecycle

Every process follows this exact timeline:

1. **Start-Hook:** The triggering event. (e.g., User opens `/onboarding`, or pg_cron creates a daily session at 06:00).
2. **Event Execution:** The actions within the session. (e.g., User fills a form, completes a checklist, or AI scrapes a website).
3. **Verification/Gate:** Automated checks (E2E Playwright tests) and Manual UX tests ensure the event was completed correctly.
4. **Stop-Hook:** The concluding action. Data is persisted, metrics are calculated, and the next sequence is optionally triggered.

## The Continuous Scoring & Evolution Loop (The Vector Store)

Smartout does not just execute journeys; it _learns_ from them.

1. **Event Tracking & Listening Tables:** Every action (`step_started`, `step_completed`, `data_saved`, `test_failed`, `deviation_flagged`) is logged into a structured event table.
2. **The Scoring Mechanism:**
   - **Functional Score:** Did the automated E2E tests pass?
   - **UX/Engagement Score:** Did the user stall? Did the Guardian have to send a whisper? Did they complete the journey quickly?
3. **Vector/Factor Analysis:** (Future state) This event data is vectorized and mapped against weights (factors and multipliers) to understand _impact_. For example, if users consistently fail at step 3 of the allergen protocol, the system identifies this cluster.
4. **Agent-Driven Enhancement:** The AI agents (like the Frontend Architect or Botsson) read the scoring data. If the UI score drops or stalls occur, the system automatically _suggests_ or _drafts_ a UI enhancement or process change.

## Framework Components & File Structure

To implement this framework consistently, the following structure is maintained:

- **`/docs/journeys/`**: Contains the markdown definitions of every journey (e.g., `JOURNEY-onboarding-flow.md`). These act as the source of truth for the tests.
- **`/docs/modules/MODULE_0_ROADMAP.md`**: The master index of the Event Motor and all active roadmaps.
- **`/docs/engines/system-inteligence/`**: The canonical global machinery package (state engine, contracts, agent runtime, sensory loop, journey package compiler).
- **`/docs/engines/system-inteligence/08-event-envelope-spec.md`**: Canonical event envelope contract for all event producers and listeners.
- **`/docs/engines/system-inteligence/09-gold-package-admin-onboarding.md`**: Reference implementation package (`Roadmap + Journey + Mission + License + tests`) for `R-001`.
- **`/docs/engines/industri-inteligence/hospitalety/`**: The canonical industry engine package for event-layer specialization (personas, policies, templates, testing, niche, role capability, environment, handbook).
- **`/docs/designprofiler/`**: The aesthetic and interaction rules that the Frontend UI Agent uses to implement the visual layer of the journeys.
- **`journey_test_run` (DB Table):** Stores the results of the automated and manual test gates.
- **`journey_event` (DB Table):** The listening table that tracks every state change and interaction, feeding the scoring loop.

## The Agentic Pipeline

How the AI agents interact with the Framework:

1. **The Orchestrator:** Reads the Roadmap/Journey definition and assigns tasks.
2. **The Frontend UI Architect:** Builds the visual component according to the `docs/designprofiler` rules, ensuring sensory feedback and cinematic pacing.
3. **The Test/QA Agent (Playwright MCP):** Reads the expected outcomes in the Journey doc and runs headless E2E tests against the new UI.
4. **The Guardian / Analyst:** Monitors the live `journey_event` table, scores the performance, and feeds enhancements back to the Orchestrator.
