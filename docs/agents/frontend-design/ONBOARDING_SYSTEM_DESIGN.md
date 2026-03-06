---
title: "ONBOARDING_SYSTEM_DESIGN"
status: draft
updated: 2026-04-10
created: 2026-03-01
module: ai
tags: []
---

# Onboarding System Design & Architecture

## Overview

The Smartout Onboarding System is a fully autonomous, scroll-based, dynamic container designed to adapt its UI, aesthetic mood, and functionality in real-time based on the user's progress and the AI Agent's (Botsson) interventions. It serves as the primary implementation of the **Event Motor Framework** in a user-facing context.

## 1. Architectural Philosophy: The Autonomous Container

The onboarding page is not a static form; it is a "living room."

- **The User:** Navigates via scrolling through full-screen sections.
- **The Agent (Botsson):** Operates as a co-pilot with full DOM control. The agent can trigger scrolling, fill in form fields, extract data (via scraping), and inject key facts into the UI.
- **The Environment:** Reacts to progress. Backgrounds drift, colors shift, and the physical space of the UI changes to reflect the current section.

## 2. Aesthetic & Interaction Model

### The Ambient Background (Volumetric 3D Rendering)

The background consists of overlapping, volumetric, 3D-rendered "orbs" built using pure CSS.

- **Layering Strategy:** Each orb is composed of up to 5 overlapping div layers, starting from a massive faint aura (`opacity: 15%`, `blur: 100px+`) inward to a bright epicenter (`opacity: 90%+`, `blur: 15px`). This creates a true 3D spherical falloff.
- **Dithering Prevention:** A `bg-noise` overlay with `mix-blend-overlay` is globally applied over the orbs to prevent color banding across smooth OKLCH gradients.
- **Dynamic Context:** The `SECTION_AMBIENCE` state machine controls the colors, sizes, and positions of the orbs. As the user or the AI advances the section, the orbs fluidly transition (1.8s easing) to a new color palette that matches the mood of the task (e.g., warm orange for business details, deep purple/rose for contract signing).
- **Cinematic Motion:** The orbs execute infinite, slow CSS keyframe animations (`float-orb-1`, `float-orb-2`) that provide a "breathing" rhythm to the page.

### Layout & Spacing

- **Split-Screen Grid:** The layout relies on strict vertical splitting. Left side (approx. 38% width): Context, massive typography, and high-level progress. Right side (62% width): The active container for forms, inputs, and agent interactions.
- **Extreme Padding:** White space is utilized as a primary design element (`px-10 py-20`, `lg:px-16`).

## 3. The Agentic Tool Layer (Botsson Actions)

The UI is strictly coupled to a set of specific hooks (`useBotsson.ts`) that expose the DOM and application state directly to the Ultravox voice/text agent.

### Core Exposed Tools:

- **Navigation:** `advanceToNextSection()` allows the agent to scroll the user to the next stage once requirements are met.
- **Data Manipulation:** `updateBusiness()`, `updateSeason()`, `addDepartments()`, `addLocations()`, and `addProcedures()` allow the agent to directly write into the React state (and subsequently the UI) based on voice commands or scraped data.
- **Intelligence Gathering:** `searchCompany()`, `identifyCompany()`, and `scrapeWebsite()` allow the agent to fetch external data (from Brønnøysundregistrene or the web) and auto-populate the onboarding forms.
- **Context Injection:** `addKeyFact()` allows the agent to visually pin learned information (e.g., "Industry: Restaurant") to the left-hand context panel.
- **Memory & Finalization:** `saveMemory()` stores permanent context about the user, and `finalizeOnboarding()` triggers the backend transition that creates the workspace and routes to the dashboard.

## 4. The Event Motor Integration

The onboarding flow is governed by the `R-001: Sign Up & Create Workspace` roadmap from the Event Motor.

- **Start-Hook:** The user lands on `/onboarding`. The UI initializes, and the `useBotsson` hook opens a connection to the Stage Engine.
- **Events:** Every form fill, every section advance, and every agent tool execution is a tracked event.
- **Verification:** The flow is designed to be verifiable by Playwright E2E tests (via accessibility snapshots) and continuously monitored by the Guardian for "stalls" (e.g., user is stuck on the Locations section for > 3 minutes).
- **Stop-Hook:** `finalizeOnboarding()` fires. The workspace is spun up, the default season and agent profiles are generated, and the system transitions the user.

## 5. Extensibility & Future Scaling

To ensure the onboarding container remains highly dynamic and easy to update:

- **Component Isolation:** Each section (Welcome, Business, Season, Contract) is an isolated React component that reads from and writes to a unified `WizardContext`. Adding a new section merely requires adding it to the `ONBOARDING_SECTIONS` array and defining its `SECTION_AMBIENCE` state.
- **Agent Authority:** If a new step is added (e.g., "Hardware Setup"), developers must add a corresponding Tool to `CLIENT_TOOLS` in `useBotsson.ts` so the agent understands how to interact with the new component.

## 6. Edge Cases & Fallbacks (The "Broken Glass" Protocol)

Because this system relies heavily on voice sockets (Ultravox) and LLM tooling, the architecture must handle failures gracefully.

- **Socket Disconnects:** If the agent disconnects, the UI must immediately un-blur any agent-locked fields and reveal a "Continue Manually" button. The visual state (the glowing orbs) should transition to a calm, neutral color (e.g., deep blue) to signal the loss of the active agent.
- **Scraping Failures:** If `scrapeWebsite` returns null or times out, the `WizardContext` must instantly render the manual input fields (which are usually hidden during the scraping phase) so the user is never blocked.
- **Rage-Click / Friction Handlers:** If the local Event Bus detects > 3 validation errors on the same step, the system should trigger a localized "Help Pulse" on the Botsson microphone icon, visually prompting the user to ask the agent for help.
