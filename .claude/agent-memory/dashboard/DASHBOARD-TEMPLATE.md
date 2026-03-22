# {AGENT_NAME} — Dashboard

> Self-maintained by this agent. Audited by engine-architect.
> Scoring model: Posture (5 base dimensions) + Extensions.
> Updated per encounter.

---

## Identity

| Field          | Value                                            |
| -------------- | ------------------------------------------------ |
| **Name**       | {agent_name}                                     |
| **Mission ID** | {mission_id or N/A}                              |
| **Character**  | {one-line character description}                 |
| **Mode**       | {mission / agent}                                |
| **Channel**    | {voice / text / both}                            |
| **Voice**      | {voice ID or N/A}                                |
| **Language**   | {no / en / multi}                                |
| **Service**    | {Stage Engine / API route / MCP / Edge Function} |
| **Source**     | {file path to agent code}                        |
| **SDK Status** | {Ad-hoc / Migrating / SDK / New}                 |

---

## Capabilities Inventory

| Tool        | Type         | Authority              | Status                     | Notes |
| ----------- | ------------ | ---------------------- | -------------------------- | ----- |
| {tool_name} | {read/write} | {member/manager/admin} | {active/broken/deprecated} |       |

---

## Posture Score (Base 5 Dimensions)

Per-encounter scoring, 0-10 scale. From Trainer Guide posture system.

| Dimension      | Description                                    | Current Avg | Trend | Last 5 |
| -------------- | ---------------------------------------------- | ----------- | ----- | ------ |
| **Warmth**     | Tone, empathy, approachability                 | -           | -     | -      |
| **Directness** | Clarity, conciseness, action-orientation       | -           | -     | -      |
| **Formality**  | Register, professionalism, structure           | -           | -     | -      |
| **Patience**   | Pacing, tolerance, re-explanation willingness  | -           | -     | -      |
| **Authority**  | Confidence, decisiveness, expertise projection | -           | -     | -      |

**Posture Avg:** - / 10
**Target posture** (from character brief): {e.g. Warmth: 8, Directness: 6}

### Posture Adjustments

| Date | Encounter | Dimension | From > To | Trigger |
| ---- | --------- | --------- | --------- | ------- |
| -    | -         | -         | -         | -       |

---

## Extension Dimensions

Additional scoring beyond base posture. 0-10 scale.

| Dimension                            | Description                           | Current Avg | Last 5 |
| ------------------------------------ | ------------------------------------- | ----------- | ------ |
| **Tool Accuracy**                    | Right tool, correct parameters        | -           | -      |
| **Context Usage**                    | Used available context effectively    | -           | -      |
| **Goal Completion**                  | Achieved the encounter objective      | -           | -      |
| **Error Recovery**                   | Handled failures/confusion gracefully | -           | -      |
| _[KKLOF dimensions - to be defined]_ | -                                     | -           | -      |

---

## Encounter Log

Most recent first. Keep last 20 entries.
Archive older entries to {agent_name}-archive.md.

### Entry Format

```
### ENC-{YYYY-MM-DD}-{NNN}

Date: {ISO date}
Session: {uuid}
Channel: {voice/text}
Duration: {seconds}
Workspace: {workspace_id}
Outcome: {completed / abandoned / error / timeout}

Posture: W:{n} D:{n} F:{n} P:{n} A:{n}
Extension: ToolAcc:{n} CtxUse:{n} Goal:{n} ErrRec:{n}

Tool calls:
- {tool}: {ok/fail} - {note}

Findings:
- {what went well}
- {what went wrong}
- {what should change}

Self-assessment: {1-3 sentences}
```

### Entries

_No encounters logged yet._

---

## Performance Summary

| Metric            | Value | Target | Status |
| ----------------- | ----- | ------ | ------ |
| Total encounters  | 0     | -      | -      |
| Completion rate   | -     | >85%   | -      |
| Avg posture score | -     | >7.0   | -      |
| Tool success rate | -     | >90%   | -      |
| Avg response time | -     | <2s    | -      |
| Error rate        | -     | <5%    | -      |
| Abandonment rate  | -     | <15%   | -      |

### Trends

| Period   | Encounters | Posture Avg | Completion | Tool Success |
| -------- | ---------- | ----------- | ---------- | ------------ |
| Last 7d  | -          | -           | -          | -            |
| Last 30d | -          | -           | -          | -            |

---

## Migration Progress

| Step                                         | Status | Date | Notes                   |
| -------------------------------------------- | ------ | ---- | ----------------------- |
| SDK package created                          | [ ]    | -    | packages/agents/{name}/ |
| Schema defined (Zod)                         | [ ]    | -    |                         |
| Tools extracted to defineTool()              | [ ]    | -    |                         |
| Prompts moved to prompts/                    | [ ]    | -    |                         |
| Voice config isolated                        | [ ]    | -    |                         |
| Authority config wired                       | [ ]    | -    |                         |
| Direct queries replaced with Context Service | [ ]    | -    |                         |
| Tests: schema, tools, integration            | [ ]    | -    |                         |
| Registered in agent registry                 | [ ]    | -    |                         |
| Old route deprecated                         | [ ]    | -    |                         |
| WORKLOG updated                              | [ ]    | -    |                         |

---

## Findings and Recommendations

### Recurring Issues

| Issue | Frequency | Severity | Recommended Fix |
| ----- | --------- | -------- | --------------- |
| -     | -         | -        | -               |

### Behavior Tweaks Needed

| What | Why | Priority | Status |
| ---- | --- | -------- | ------ |
| -    | -   | -        | -      |

### Counter-Measures Applied

| Date | Issue | Action Taken | Result |
| ---- | ----- | ------------ | ------ |
| -    | -     | -            | -      |

---

## Report for Pontus

> Short, actionable. Updated after engine-architect audit.

### Latest Report

_No report generated yet._

### Report Format

```
Period: {date range}
Encounters: {n}
Overall: {avg}/10

Working well:
1. {strength}
2. {strength}

Needs attention:
1. {issue} - {action}
2. {issue} - {action}

Behavior tweaks:
- Enforce: {behavior}
- Relax: {behavior}

Next steps:
1. {item}
2. {item}
```

---

## Backend Observer Scores

> [TO WIRE] Cross-validation from backend encounter observer.

| Encounter | Self Score | Observer Score | Delta | Flag |
| --------- | ---------- | -------------- | ----- | ---- |
| -         | -          | -              | -     | -    |

---

## Notes

_Agent-specific notes, quirks, known limitations._
