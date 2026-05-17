---
title: Architecture — Botsson Soul
status: draft
version: 0.1
created: 2026-05-15
module: agent-system
tags: [botsson, architecture, agent, soul]
---

# Architecture — Botsson Soul

## Core principle

UI uttrykker preferanser.  
Stage-engine kompilerer sjelen.

Frontend skal ikke være autoritativ prompt-kilde. Frontend sender validerbare verdier som persona, rank, blend, custom instruction og voice preferences.

Stage-engine løser disse verdiene sammen med workspace policy, role defaults, session state, channel constraints, authority og safety.

---

## System overview

```txt
UI Settings
→ BotssonProvider
→ Chat BFF / Voice Session Create
→ Stage Engine
→ Soul Resolver
→ Prompt Compiler
→ Memory Retrieval
→ Authority Reducer
→ Tool Router
→ Model Runtime
→ Response + Soul Snapshot
```

---

## Components

| Komponent | Ansvar |
|---|---|
| BotssonProvider | Holder UI-state, sender preferanser videre |
| EmmaProfile / Settings UI | Lar bruker justere personlighet, voice og instruks |
| `/api/emma/chat` | Chat BFF, proxy til stage-engine |
| Voice session-create | Oppretter voice session med kanalspesifikke preferanser |
| Stage-engine | Eier soul resolution, prompt compilation og runtime-kontrakt |
| Soul Resolver | Løser effective identity, posture, voice, model, context, memory, authority og tools |
| Prompt Compiler | Bygger endelig system-prompt fra canonical contract |
| Authority Reducer | C4-gate for hva agenten har lov til |
| Tool Selector | Velger og filtrerer tool-bundle per intent, rolle, channel og authority |
| Memory Retrieval | Henter relevante minner og relationship score |
| Soul Snapshot Logger | Logger løst runtime-snapshot for audit/debug |

---

## Channel architecture

Chat og voice kan bruke ulike modeller og verktøy, men må dele samme resolved identity, posture, context, memory og authority envelope.

```txt
Same:
- identity
- posture
- context envelope
- memory refs
- authority envelope

Different:
- model runtime
- latency policy
- tool subset
- response style constraints
- voice/audio configuration
```

---

## Runtime flow

1. User sender melding eller starter voice.
2. UI sender preferanser og channel metadata.
3. Stage-engine henter workspace profile, user preference og session state.
4. Stage-engine løser effective Soul Contract.
5. Prompt compiler bygger prompt i faste seksjoner.
6. Tool router bygger dynamisk tool-bundle.
7. Authority og channel policy filtrerer tools.
8. Modell kjøres.
9. Respons returneres.
10. Soul snapshot logges.

---

## Prompt compilation sections

```txt
SYSTEM CORE
→ AGENT IDENTITY
→ INSTRUCTION OVERLAY
→ POSTURE
→ AUTHORITY BOUNDARY
→ CONTEXT SNAPSHOT
→ RELEVANT MEMORY
→ TOOL POLICY
→ CHANNEL RULES
→ RESPONSE FORMAT
```

---

## Architecture decision

Botsson Soul skal implementeres som en shared server-side compiler.

Ingen kanal skal bygge sin egen uavhengige Botsson-prompt uten å bruke samme soul resolution contract.
