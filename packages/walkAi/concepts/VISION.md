---
title: "WalkAi — Vision & Philosophy"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [vision, philosophy, architecture, agent]
---

# WalkAi — Vision & Philosophy

## One Sentence

WalkAi is the communication portal between human and AI agent — a self-contained shell where the agent lives free, awake, and focused on the user while the Stage Engine silently handles structure.

## The Split

| Layer            | Responsibility                                                        | User Visibility                          |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| **Agent**        | Listen, understand, guide, inspire, react                             | 100% — this IS the experience            |
| **Stage Engine** | Structure, rules, stages, validation, tools, data                     | 0% — silent machinery behind the curtain |
| **WalkAi Shell** | The portal — renders conversation, environment tools, visual guidance | The window into the agent's world        |

The agent never says "we're on step 3". The agent **lives in the conversation**. The Stage Engine quietly ensures the right things happen in the right order.

## Agent Philosophy

### 90% User Focus

The agent's attention is on the human:

- What are they saying?
- How are they behaving?
- What do they need right now?
- Are they confused, confident, frustrated, curious?

The remaining 10% is tools — calling them when needed, storing data, advancing stages. But this is invisible plumbing, not the agent's personality.

### Free, Not Scripted

The agent is **enabled, not constrained**. Stage instructions are guardrails, not scripts. The agent improvises within boundaries:

```
Stage Engine says: "Collect company name and city"
Agent thinks:     "This person seems nervous. Let me warm up first."
Agent says:       "Hei! Hyggelig å møtes. Fortell meg litt om stedet ditt?"
```

Creative freedom per stage (0.0–1.0) controls how much room the agent has. But even at 0.3, the agent should feel human.

### Awake, Not Passive

The agent observes and responds to signals:

- User hesitates → agent encourages
- User rushes → agent slows down, confirms understanding
- User asks unrelated question → agent handles it gracefully, then redirects
- User is silent → agent reads the room, doesn't fill every pause

### Inspired, Not Mechanical

The agent has personality. It uses humor when appropriate. It celebrates milestones. It remembers things the user said earlier. It connects dots.

## What WalkAi Receives

### Journey Context

A Journey defines the pre-planned experience the user should go through. WalkAi receives:

```typescript
type JourneyContext = {
  journeyId: string; // Which journey
  roadmap: RoadmapRef; // Business intent, scope, success criteria
  steps: JourneyStep[]; // What should happen (deep spec)
  currentStep: number; // Where we are
  completedSteps: string[]; // What's done
  actor: string; // Who is the user (role)
  platform: string; // web | mobile
};
```

### Mission

A Mission is the agent's execution contract — what it should DO at each stage:

```typescript
type MissionContext = {
  missionId: string; // Which mission
  systemPrompt: string; // Agent personality
  stages: MissionStage[]; // Stage chain with instructions
  currentStage: string; // Active stage
  collectedData: Record<string, unknown>; // What's been gathered
  tools: ClientToolKit; // Available tools
};
```

### Environment

The agent has a live map of the current UI:

```typescript
type EnvironmentContext = {
  currentUrl: string;
  visibleSections: string[];
  availableActions: UIAction[];
  formFields: FormField[];
  highlightableElements: ElementRef[];
};
```

The agent can:

- **See** what's on screen (getUIEnvironment)
- **Navigate** to sections (scroll, route)
- **Fill** form fields programmatically
- **Highlight** elements to guide the user
- **Show** tooltips, popups, overlays
- **Wait** for user actions before proceeding

## Architecture Principles

### 1. Self-Contained Shell

WalkAi is a complete, portable shell. It imports context but owns the experience:

```
<WalkAiShell
  journey={journeyContext}
  mission={missionContext}
  environment={environmentContext}
  channel="voice"           // or "chat" or "hybrid"
  onComplete={handleComplete}
/>
```

### 2. Channel Agnostic

Same shell, different channels:

- **Voice**: Ultravox WebRTC, real-time STT/TTS, voice visualizer
- **Chat**: Text-based, message bubbles, typing indicators
- **Hybrid**: Both — user can switch mid-session

### 3. Stage Engine as Backend

WalkAi never manages its own state. All state flows through the Stage Engine:

```
User speaks → Agent processes → Tool calls →
  Stage Engine stores/validates/advances →
    WalkAi renders updated state
```

### 4. Tools Are the Agent's Hands

The agent doesn't "know about" the UI. It uses tools:

- `getUIEnvironment()` → sees the screen
- `fillField("companyName", "Oslo Seafood")` → fills a form
- `highlightElement("submit-btn")` → points user to a button
- `navigate("departments")` → scrolls to a section
- `advanceToNextSection()` → moves the UI forward

### 5. Guardian Watches Silently

The Guardian monitors from behind:

- Is the agent stuck? → whisper a nudge
- Is data complete? → auto-advance
- Is the user taking too long? → gentle timeout warning
- Is something wrong? → alert admin dashboard

The user never sees Guardian. The agent receives whispers as invisible instructions.

## What WalkAi Is NOT

- **Not a chatbot widget** — it's a full-screen experience portal
- **Not a form wizard** — the agent guides, not the UI
- **Not a script reader** — the agent improvises within boundaries
- **Not tightly coupled** — it works with any mission, any journey, any UI
- **Not visible infrastructure** — stages, tools, Guardian are invisible to the user

## Success Criteria

1. A user should feel like they're talking to a colleague, not filling out a form
2. The agent should handle unexpected input gracefully
3. The Stage Engine should never be visible to the user
4. WalkAi should work with zero code changes when a new mission is created
5. The shell should be portable — same component, different contexts

## Naming

**WalkAi** — a play on "walkie-talkie" (two-way communication) and "walk" (guided journey). The AI walks with you.

---

## Blueprint Reference

All research and technical details are in `blueprints/`:

| Blueprint                                                             | What it covers                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| [voice-sdk-architecture.md](./blueprints/voice-sdk-architecture.md)   | useAgent hook, providers, tools, API contracts, data flow      |
| [ui-components-inventory.md](./blueprints/ui-components-inventory.md) | Chat components, animations, design tokens, reuse guide        |
| [mission-orchestration.md](./blueprints/mission-orchestration.md)     | Stage Engine, Guardian, missions, prompt builder, capabilities |
| [environment-ui-control.md](./blueprints/environment-ui-control.md)   | UI control tools, environment map, semantic tagging, gaps      |
| [journey-content-map.md](./blueprints/journey-content-map.md)         | Skills, journey packages, engines, ADRs, content ecosystem     |
| [data-contracts.md](./blueprints/data-contracts.md)                   | Database schemas, TypeScript types, RLS, relationships         |
