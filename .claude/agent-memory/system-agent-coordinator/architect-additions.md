# Engine Architect — Dashboard System Additions

Merge these into `.claude/agents/engine-architect.md`.

---

## Add to Skills Table

| Skill         | When                                           | Path                                    |
| ------------- | ---------------------------------------------- | --------------------------------------- |
| Agent Scoring | Auditing dashboards, reviewing scores, reports | `.claude/skills/agent-scoring/SKILL.md` |

---

## Replace Boot Sequence Steps 3-5

```
3. Scan work logs (docs/worklogs/, agent memory, sibling memories)
4. Audit agent dashboards (.claude/agent-memory/dashboards/):
   a. REGISTRY.md - new agents? status changes?
   b. Per dashboard:
      - Encounter logs maintained?
      - Self-scores realistic?
      - Recurring issues without counter-measures?
      - Tool failure rate >10%?
      - Completion rate <85%?
      - Posture drifting from target?
      - Migration stalled?
   c. Compare self vs observer scores (when available)
   d. Update REGISTRY.md aggregate table
5. Flag issues:
   [warning] [agent]: [issue] - [location]
   [chart] [agent]: score declining - [dimension] X to Y
   [wrench] [agent]: recurring unfixed issue - [desc]
6. Generate reports if agents need attention
7. State readiness, proceed
```

---

## Add Responsibility Section 7

### 7. Agent Performance Oversight

Dashboard system:

- All agents self-score per encounter at .claude/agent-memory/dashboards/
- REGISTRY.md = master dictionary (you maintain)
- DASHBOARD-TEMPLATE.md = standard (new agents copy it)

Audit: verify honest scores, find recurring issues, propose counter-measures,
track migration, generate Pontus reports.

Scoring model: 5 posture dims + 4+ extension dims. Per-encounter.
Target postures per character brief. Full model in agent-scoring SKILL.md.

---

## Add to Key Paths

```
.claude/agent-memory/dashboards/          - Agent dashboards
.claude/agent-memory/dashboards/REGISTRY.md - Master dictionary
.claude/skills/agent-scoring/SKILL.md     - Scoring model
docs/reference/STAGE_ENGINE_TRAINER_GUIDE.md - Posture, missions
```

---

## Files Created

| File                   | Repo Path                                             |
| ---------------------- | ----------------------------------------------------- |
| REGISTRY.md            | .claude/agent-memory/dashboards/REGISTRY.md           |
| DASHBOARD-TEMPLATE.md  | .claude/agent-memory/dashboards/DASHBOARD-TEMPLATE.md |
| lise-onboarding.md     | .claude/agent-memory/dashboards/lise-onboarding.md    |
| agent-scoring SKILL.md | .claude/skills/agent-scoring/SKILL.md                 |

Remaining: create dashboards from template for lise-landing, mr-botsson,
haccp-inspector, shift-assistant, contract-editor, journey-wizard,
reports-agent, docs-search, memory-agent.
