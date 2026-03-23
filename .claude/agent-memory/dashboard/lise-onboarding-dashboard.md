# Lise (Onboarding Interview) — Dashboard

> Self-maintained by this agent. Audited by engine-architect.
> Scoring model: Posture (5 base dimensions) + Extensions.
> Updated per encounter.

---

## Identity

| Field          | Value                                                                                 |
| -------------- | ------------------------------------------------------------------------------------- |
| **Name**       | Lise (Onboarding Interview)                                                           |
| **Mission ID** | onboarding-interview                                                                  |
| **Character**  | Warm, structured interviewer. Guides new employees through workspace data collection. |
| **Mode**       | mission                                                                               |
| **Channel**    | voice                                                                                 |
| **Voice**      | terrence                                                                              |
| **Language**   | no (Norwegian primary)                                                                |
| **Service**    | Stage Engine :5022 via /adapters/ultravox/create-call                                 |
| **Source**     | packages/ai/src/missions/registry.ts + apps/web/src/app/api/onboarding-agent          |
| **SDK Status** | Ad-hoc                                                                                |

---

## Capabilities Inventory

| Tool                                | Type  | Authority | Status | Notes                          |
| ----------------------------------- | ----- | --------- | ------ | ------------------------------ |
| store (entity to inbox)             | write | member    | active | /sessions/:id/store            |
| fetch (context/inbox/stage/history) | read  | member    | active | /sessions/:id/fetch            |
| advance (next stage)                | write | member    | active | /sessions/:id/advance          |
| gather-workspace-intelligence       | read  | member    | active | Edge Function, 6-step pipeline |
| extract-workspace-data              | read  | member    | active | Edge Function, Scrapling proxy |

---

## Posture Score (Base 5 Dimensions)

| Dimension      | Current Avg | Trend | Last 5 |
| -------------- | ----------- | ----- | ------ |
| **Warmth**     | -           | -     | -      |
| **Directness** | -           | -     | -      |
| **Formality**  | -           | -     | -      |
| **Patience**   | -           | -     | -      |
| **Authority**  | -           | -     | -      |

**Target posture:** Warmth: 8, Directness: 6, Formality: 4, Patience: 8, Authority: 5

---

## Extension Dimensions

| Dimension           | Current Avg | Last 5 |
| ------------------- | ----------- | ------ |
| **Tool Accuracy**   | -           | -      |
| **Context Usage**   | -           | -      |
| **Goal Completion** | -           | -      |
| **Error Recovery**  | -           | -      |
| **Data Quality**    | -           | -      |
| **Stage Flow**      | -           | -      |

---

## Encounter Log

_No encounters logged yet._

---

## Performance Summary

| Metric            | Value | Target |
| ----------------- | ----- | ------ |
| Total encounters  | 0     | -      |
| Completion rate   | -     | >85%   |
| Avg posture score | -     | >7.0   |
| Tool success rate | -     | >90%   |

---

## Migration Progress

| Step                            | Status | Notes                               |
| ------------------------------- | ------ | ----------------------------------- |
| SDK package created             | [ ]    | Target: packages/agents/onboarding/ |
| Schema defined (Zod)            | [ ]    |                                     |
| Tools extracted to defineTool() | [ ]    | 5 tools                             |
| Prompts moved to prompts/       | [ ]    | Lise character + per-stage          |
| Voice config isolated           | [ ]    | Ultravox: terrence, no              |
| Authority config wired          | [ ]    | All: member                         |
| Context Service integration     | [ ]    | Replace direct queries              |
| Tests                           | [ ]    |                                     |
| Registered                      | [ ]    |                                     |
| Old route deprecated            | [ ]    | /api/onboarding-agent               |

---

## Findings and Recommendations

### Recurring Issues

_None yet._

### Behavior Tweaks

_None yet._

### Counter-Measures Applied

_None yet._

---

## Report for Pontus

_No report generated yet._

---

## Backend Observer Scores

_[TO WIRE]_

---

## Notes

- Covers onboarding-interview only. Landing demo: lise-landing.md
- Text route (/api/onboarding-agent) supports extractIntelligence mode
- Voice uses Stage Engine adapters
- Known risk: users going off-script during structured stages
