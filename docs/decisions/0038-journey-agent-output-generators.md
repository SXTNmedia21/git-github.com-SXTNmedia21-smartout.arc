---
title: "Journey Agent & Output Generators"
id: ADR_0038
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
depends_on:
  - ADR_0031
  - ADR_0010
---

# ADR-0038: Journey Agent & Output Generators

## Context and Problem Statement

Phase 1 of the Journey Portal (ADR-0031) delivered a tracking dashboard for all 68 journeys with a 13-status lifecycle. However, defining new journeys still requires manual data entry across many fields, and the four output tabs (E2E Test, Doc, Linear, Botsson) are placeholders. Phase 2 needs an AI-assisted definition wizard and output generators to close the loop from "idea" to "five deliverables."

## Decision Drivers

- Defining a journey requires 15+ fields and ordered steps — error-prone when done manually
- Duplicate detection is critical with 68+ journeys across 18 modules
- Four output types (E2E, doc, Linear, Botsson) must be derivable from a single journey definition
- The existing `@smartout/ai` package already has agent patterns (contract, onboarding, reports)
- Wizard conversations must persist across sessions (user may not finish in one sitting)

## Considered Options

1. **Edge Function for AI** — Run the wizard agent as a Supabase Edge Function
2. **Next.js API route with session persistence** — Agent in `@smartout/ai`, API route in `apps/web`, session in `wizard_session` table
3. **Client-side AI calls** — Direct API calls from the browser to OpenRouter

## Decision Outcome

Chosen option: **"Next.js API route with session persistence"**, because it matches the existing contract-agent and onboarding-agent patterns, keeps the OpenRouter API key server-side, and allows the agent to use admin-level Supabase queries for duplicate detection and journey lookups.

## Rules & Consequences

- **Good, because** the wizard guides users through 6 structured phases (discovery → classification → steps → testing → documentation → review), producing complete journey definitions with minimal manual effort
- **Good, because** 3 agent tools (lookup_journeys, check_duplicates, save_draft) give the AI access to existing journey data for consistency and deduplication
- **Good, because** 4 output generators are pure functions with no AI dependency — fast, deterministic, and testable
- **Good, because** wizard sessions persist in the database, allowing users to resume incomplete definitions
- **Bad, because** adds 1 new table (wizard_session) and 2 new enums to the schema
- **Bad, because** the agent uses non-streaming `generateText` — response time is 3-10s per turn
- **Agent Impact:** When creating new journeys, use the wizard at `/platform-admin/journeys/wizard`. Output generators are available on every journey detail page via the output tabs. The wizard auto-assigns journey codes (J-XXX) on completion and sets status to "defined."

### Schema

| Table            | Purpose                                                  | RLS                      |
| ---------------- | -------------------------------------------------------- | ------------------------ |
| `wizard_session` | Wizard conversation state, draft journey, phase tracking | godmode + workspace read |

### Architecture

```
User → Wizard Chat UI → POST /api/journey-agent
  → runJourneyAgent() (packages/ai/src/agents/journey.ts)
    → OpenRouter (claude-sonnet-4) + 3 tools
    → wizard_session.messages (JSONB persistence)
  → On completion: POST /api/.../complete
    → INSERT journey + journey_step
    → wizard_session.status = 'completed'

User → Detail Page → Output Tab → POST /api/.../generate
  → generateE2ETest() | generateOnboardingDoc() | generateLinearSpec() | generateBotssonScript()
  → Pure function: (journey, steps) → string
```

### Phased Implementation (updated)

- **Phase 1 (ADR-0031):** Tables, types, status machine, portal UI — DONE
- **Phase 2 (this ADR):** AI wizard, 4 output generators, output tabs — CURRENT
- **Phase 3:** Linear sync, automated test runs, auto-generation triggers on status change

---
