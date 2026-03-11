# Agent Registry

> Master dictionary of all agents in Smartout.
> Each agent has a dashboard at `.claude/agent-memory/dashboards/<name>.md`
> Updated by each agent after encounters. Audited by engine-architect on boot.
> Source of truth: `docs/reference/STAGE_ENGINE_TRAINER_GUIDE.md`

---

## Voice Agents (Mission-Based)

| Agent                   | Mission ID           | Character                    | Mode    | Voice    | Service                              | SDK Status | Dashboard               |
| ----------------------- | -------------------- | ---------------------------- | ------- | -------- | ------------------------------------ | ---------- | ----------------------- |
| **Lise (Onboarding)**   | onboarding-interview | Warm, structured interviewer | mission | terrence | Stage Engine :3000                   | ❌ Ad-hoc  | [→](lise-onboarding.md) |
| **Lise (Landing Demo)** | landing-demo         | Friendly product demo guide  | mission | terrence | Stage Engine :3000                   | ❌ Ad-hoc  | [→](lise-landing.md)    |
| **Mr. Botsson**         | mr-botsson           | General AI assistant         | agent   | terrence | Stage Engine :3000                   | ❌ Ad-hoc  | [→](mr-botsson.md)      |
| **HACCP Inspector**     | haccp-inspector      | Food safety specialist       | mission | terrence | Stage Engine :3000                   | ❌ Ad-hoc  | [→](haccp-inspector.md) |
| **Shift Assistant**     | shift-assistant      | Schedule management helper   | agent   | terrence | Stage Engine :3000 + Shift MCP :3001 | ❌ Ad-hoc  | [→](shift-assistant.md) |

## Text Agents (API Route-Based)

| Agent                | Route                      | Auth          | Mode  | SDK Status | Dashboard                |
| -------------------- | -------------------------- | ------------- | ----- | ---------- | ------------------------ |
| **Onboarding Agent** | POST /api/onboarding-agent | Session       | agent | ❌ Ad-hoc  | [→](onboarding-agent.md) |
| **Contract Editor**  | POST /api/contract-agent   | Godmode       | agent | ❌ Ad-hoc  | [→](contract-editor.md)  |
| **Journey Wizard**   | POST /api/journey-agent    | Godmode       | agent | ❌ Ad-hoc  | [→](journey-wizard.md)   |
| **Reports Agent**    | POST /api/reports-agent    | Session       | agent | ❌ Ad-hoc  | [→](reports-agent.md)    |
| **Docs Search**      | POST /api/docs-agent       | None (public) | agent | ❌ Ad-hoc  | [→](docs-search.md)      |

## Support Agents

| Agent            | Location                     | Purpose                | SDK Status    | Dashboard            |
| ---------------- | ---------------------------- | ---------------------- | ------------- | -------------------- |
| **Memory Agent** | POST & GET /api/agent/memory | Persistent memory CRUD | N/A (utility) | [→](memory-agent.md) |

---

## Status Legend

| Symbol       | Meaning                                           |
| ------------ | ------------------------------------------------- |
| ✅ SDK       | Conforms to Agent SDK standard (packages/agents/) |
| 🔄 Migrating | Migration in progress                             |
| ❌ Ad-hoc    | Exists as route/config, not SDK package           |
| 🆕 New       | Just scaffolded, not yet validated                |

---

## Scoring Overview

All agents self-score per encounter using the posture-based model.
5 base dimensions from the Trainer Guide posture system + extension dimensions.

**Current scores** (agents update, engine-architect audits on boot):

| Agent | Last Scored | Posture Avg | Tool Success | Completion | Flags       |
| ----- | ----------- | ----------- | ------------ | ---------- | ----------- |
| —     | —           | —           | —            | —          | No data yet |

---

## Open Extension Points

### Backend Encounter Observer

_[TO DEFINE]_ — Backend agent/service that listens during voice calls,
independently scores encounters, cross-validates against self-score.

### KKLOF Framework

_[TO DEFINE]_ — Evaluation framework. Will extend scoring model.

### Report Delivery

_[TO DEFINE]_ — How engine-architect delivers reports to Pontus.

---

## Adding a New Agent

1. Copy template: `cp _TEMPLATE.md <agent-name>.md`
2. Fill identity section
3. Add row to this registry
4. Set initial SDK status
5. Agent begins self-scoring after first encounter

---

## Related

- `docs/reference/STAGE_ENGINE_TRAINER_GUIDE.md` — Posture, authority, missions
- `.claude/agents/engine-architect.md` — Audits dashboards on boot
- `.claude/skills/capability-development/SKILL.md` — Building tools
- `packages/ai/src/missions/registry.ts` — Mission definitions in code
