---
title: "WalkAi — Package Index"
status: draft
updated: 2026-03-10
created: 2026-03-10
module: walkAi
tags: [index, walkAi]
---

# WalkAi — Package Index

> Communication portal between human and AI agent.

## Vision

- [concepts/VISION.md](./concepts/VISION.md) — Philosophy, architecture principles, what WalkAi is and isn't

## Blueprints (Research & Reference)

10 comprehensive reference documents (~6440 lines) covering every aspect of the system:

| # | Blueprint | Lines | Focus |
|---|-----------|------:|-------|
| 1 | [voice-sdk-architecture](./blueprints/voice-sdk-architecture.md) | 833 | useAgent, useAgentChat, providers, tools, Stage Engine API, data flow |
| 2 | [ui-components-inventory](./blueprints/ui-components-inventory.md) | 616 | Voice/chat components, animations, design tokens, shadcn, reuse guide |
| 3 | [mission-orchestration](./blueprints/mission-orchestration.md) | 895 | Stage Engine core, Guardian, missions registry, prompt builder, AI router |
| 4 | [environment-ui-control](./blueprints/environment-ui-control.md) | 555 | UI control tools, environment map, semantic tagging, gaps analysis |
| 5 | [journey-content-map](./blueprints/journey-content-map.md) | 570 | Skills, journey packages, engines, ADRs, content ecosystem |
| 6 | [data-contracts](./blueprints/data-contracts.md) | 923 | Database schemas, TypeScript types, RLS, enums, relationships |
| 7 | [floating-panel-patterns](./blueprints/floating-panel-patterns.md) | 242 | 5 panel modes, drag/resize, mode transitions, z-index, keyboard shortcuts |
| 8 | [existing-components](./blueprints/existing-components.md) | 333 | 16+ reusable components, BotssonAvatar, VoiceAssistant, MissionControlPanel |
| 9 | [api-surface](./blueprints/api-surface.md) | 908 | Stage Engine HTTP/WS endpoints, Interview MCP, Edge Functions, auth |
| 10 | [database-spread](./blueprints/database-spread.md) | 565 | 25 tables across 6 systems, RLS, FK tree, spread matrix |

## Directory Structure

```
packages/walkAi/
├── INDEX.md                          # This file
├── concepts/
│   └── VISION.md                     # Philosophy & architecture principles
├── blueprints/                       # Research & reference (read-only)
│   ├── voice-sdk-architecture.md     # Hook API, providers, tools, backend
│   ├── ui-components-inventory.md    # Components, animations, tokens
│   ├── mission-orchestration.md      # Stage Engine, Guardian, missions
│   ├── environment-ui-control.md     # UI control, environment awareness
│   ├── journey-content-map.md        # Journeys, skills, content
│   ├── data-contracts.md             # Database, types, RLS
│   ├── floating-panel-patterns.md    # Panel modes, drag, resize, transitions
│   ├── existing-components.md        # Reusable components inventory
│   ├── api-surface.md                # Stage Engine + MCP + Edge Function APIs
│   └── database-spread.md            # Table spread across systems
├── components/                       # (future) WalkAi shell components
├── docs/                             # (future) Implementation docs
└── inspiration/                      # (future) Design references
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | Free, awake, 90% focused on user — personality, not script |
| **Stage Engine** | Silent backend — stages, rules, validation, tools |
| **Mission** | Agent execution contract — stages with instructions |
| **Journey** | Pre-planned user experience — steps, UI, data, events |
| **Roadmap** | Business intent — what and why, before how |
| **Guardian** | Session watchdog — nudges, auto-advance, timing |
| **Environment Map** | Live UI state — what's visible, interactive, fillable |
| **WalkAi Shell** | The portal component — self-contained, channel-agnostic |

## Integration Points

```
Journey + Mission + Environment → WalkAi Shell → Stage Engine Backend
                                      ↕
                                 User Experience
```
