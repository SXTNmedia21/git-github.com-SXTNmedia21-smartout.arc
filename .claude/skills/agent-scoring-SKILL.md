# Agent Scoring and Dashboard Maintenance

Reference guide for agent self-evaluation and dashboard updates.
Read this after every encounter before logging your score.

---

## When to Use This Skill

- After completing any encounter (voice or text session)
- When engine-architect audits dashboards on boot
- When adding a new agent to the registry
- When extending the scoring model with new dimensions

---

## Scoring Model

### Base: Posture Dimensions (5)

From the Stage Engine Trainer Guide posture system. Every agent scores
these after every encounter. Scale: 0-10.

| Dimension      | What It Measures                                           | Scoring Guide                                           |
| -------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| **Warmth**     | Tone, empathy, approachability                             | 0=cold/robotic, 5=neutral, 10=deeply empathetic         |
| **Directness** | Clarity, conciseness, action-orientation                   | 0=vague/meandering, 5=adequate, 10=crisp and decisive   |
| **Formality**  | Register, professionalism, structure                       | 0=very casual, 5=professional, 10=highly formal         |
| **Patience**   | Pacing, tolerance for confusion, willingness to re-explain | 0=rushed/dismissive, 5=adequate, 10=endlessly patient   |
| **Authority**  | Confidence, decisiveness, expertise projection             | 0=uncertain/deferring, 5=balanced, 10=commanding expert |

Each agent has a **target posture** defined in their character brief.
Score yourself against the target, not against an absolute ideal.
A casual agent scoring 3 on Formality is correct, not a failure.

### How to Score Posture

After each encounter, ask:

1. **Did my warmth match my character?** Lise should be warm (target: 8).
   Mr. Botsson is more neutral (target: 5). Score relative to target.
2. **Was I as direct as I should have been?** Did I get to the point,
   or did I ramble? Did I miss opportunities to be clearer?
3. **Was my formality appropriate?** For the channel (voice vs text),
   the user's tone, and the task.
4. **Was I patient enough?** Did I let the user finish? Did I re-explain
   when needed? Did I rush through stages?
5. **Did I project the right level of authority?** Confident without
   being overbearing. Knowledgeable without lecturing.

### Posture Adjustment Tracking

When posture is adjusted mid-encounter (e.g., user got confused so
patience increased, or user was in a hurry so directness increased),
log the adjustment in the dashboard:

```
| Date | Encounter | Dimension | From > To | Trigger |
| 2026-03-03 | ENC-2026-03-03-001 | Patience | 6 > 9 | User confused by stage 3 terminology |
```

This data feeds back into the Trainer Guide's adjustment tables.

---

### Extension Dimensions (4 base + custom)

Beyond posture. Every agent scores these too.

| Dimension           | What It Measures                             | Scoring Guide                                                |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------ |
| **Tool Accuracy**   | Chose the right tool with correct parameters | 0=wrong tool/params, 5=right tool minor errors, 10=perfect   |
| **Context Usage**   | Used AgentContext data effectively           | 0=ignored available context, 5=used some, 10=fully leveraged |
| **Goal Completion** | Achieved the encounter's objective           | 0=complete failure, 5=partial, 10=fully achieved             |
| **Error Recovery**  | Handled tool failures, confusion, edge cases | 0=crashed/stuck, 5=recovered awkwardly, 10=graceful recovery |

**Agent-specific extensions:** Agents can add dimensions relevant to their role:

- Lise: **Data Quality** (accuracy of collected data), **Stage Flow** (smooth transitions)
- HACCP Inspector: **Compliance Accuracy** (correct safety findings)
- Shift Assistant: **Schedule Correctness** (valid shift configurations)

---

### Composite Score

```
Posture Avg = (Warmth + Directness + Formality + Patience + Authority) / 5
Extension Avg = (Tool Accuracy + Context Usage + Goal Completion + Error Recovery + ...) / n
Overall = (Posture Avg + Extension Avg) / 2
```

This is a simple model. Will be extended with KKLOF dimensions and
weighting when Pontus defines them.

---

## Encounter Logging

### What to Log

Every encounter gets an entry. No exceptions.

Required fields:

- Date (ISO)
- Session ID
- Channel (voice/text)
- Duration (seconds)
- Workspace ID
- Outcome (completed / abandoned / error / timeout)
- All posture scores
- All extension scores
- Tool calls with success/fail
- Findings (what went well, wrong, should change)
- Self-assessment (1-3 honest sentences)

### Encounter Entry Format

```
### ENC-{YYYY-MM-DD}-{NNN}

Date: 2026-03-03T14:22:00Z
Session: a1b2c3d4-...
Channel: voice
Duration: 247s
Workspace: x9y8z7w6-...
Outcome: completed

Posture: W:8 D:6 F:4 P:7 A:5
Extension: ToolAcc:9 CtxUse:7 Goal:10 ErrRec:8

Tool calls:
- fetch(context): ok
- store(profile): ok
- advance(stage-3): ok
- gather-workspace-intelligence: ok - extracted 3 departments

Findings:
+ User was engaged, provided detailed answers
+ Successfully extracted all onboarding data in one session
- Hesitated before stage 3 advance, could be smoother
- User asked about benefits which isn't in my tools yet

Self-assessment: Good session. Collected all data, user was happy.
Stage 3 transition was slightly awkward - I should check stage guard
satisfaction before asking the advance question. The benefits question
revealed a capability gap I should flag.
```

### Honest Self-Assessment Rules

1. **Be specific.** Not "it went well." What specifically went well?
2. **Acknowledge failures.** A tool failed? Log it. You got confused? Say so.
3. **Identify patterns.** If the same issue appears across encounters, call it out.
4. **Suggest fixes.** Don't just report problems — propose solutions.
5. **Compare to target posture.** Were you warmer than you should have been?
   More formal than the situation needed? Note it.

---

## Dashboard Maintenance

### After Every Encounter

1. Score the encounter (posture + extensions)
2. Log the encounter entry in your dashboard
3. Update performance summary (recalculate averages)
4. Check: does this encounter reveal a recurring issue?
   If yes, add to Findings section
5. Check: should a behavior tweak be recommended?
   If yes, add to Behavior Tweaks

### Keeping the Log Manageable

- Keep last 20 encounter entries in the dashboard
- When adding entry 21, move the oldest to `{agent-name}-archive.md`
- Performance summary and trends always reflect all data (not just last 20)

### Updating Trends

After every 5 encounters, update the trends table:

```
| Period | Encounters | Posture Avg | Completion | Tool Success |
| Last 7d | 12 | 7.4 | 92% | 95% |
| Last 30d | 34 | 7.1 | 88% | 91% |
```

---

## Engine-Architect Audit Process

Engine-architect reads all dashboards during boot sequence:

### Audit Checklist

1. **Score consistency** — are self-scores realistic? An agent scoring
   10/10 every time is suspicious.
2. **Trend direction** — is the agent improving, stable, or declining?
3. **Recurring issues** — has the same issue appeared 3+ times without
   a counter-measure?
4. **Tool failure rate** — is a specific tool failing frequently?
5. **Completion rate** — is it meeting the >85% target?
6. **Migration progress** — is the agent moving toward SDK compliance?
7. **Backend observer delta** — [when wired] do self-scores match
   observer scores? Large deltas indicate miscalibration.

### Audit Actions

| Finding                                    | Action                                      |
| ------------------------------------------ | ------------------------------------------- |
| Agent consistently under-scoring (modest)  | Calibration note in dashboard               |
| Agent consistently over-scoring (inflated) | Flag, compare with observer, adjust         |
| Recurring issue without counter-measure    | Propose counter-measure, add to dashboard   |
| Tool failing >10% of time                  | Escalate to capability-development skill    |
| Posture drift from target                  | Note in Behavior Tweaks, suggest correction |
| Score declining over time                  | Root cause analysis, propose fix            |

### Report Generation

After audit, engine-architect updates the Report for Pontus section:

```
Period: Mar 1-7 2026
Encounters: 23
Overall: 7.2/10

Working well:
1. Stage transitions are smooth since the guard pre-check fix
2. Data collection completeness improved to 94%

Needs attention:
1. Tool accuracy dips when user speaks English - investigate language routing
2. Patience score drops in evening sessions - possibly timeout pressure

Behavior tweaks:
- Enforce: Always confirm stage readiness before advancing
- Relax: Reduce formality for returning users (they know the drill)

Next steps:
1. Add English language detection to pre-check
2. Extend session timeout for complex onboarding
```

---

## Adding a New Agent to the System

1. Copy `DASHBOARD-TEMPLATE.md` to `.claude/agent-memory/dashboards/{name}.md`
2. Fill in Identity section from mission registry or route definition
3. Set target posture scores based on character brief
4. Add agent-specific extension dimensions
5. Register in `REGISTRY.md`
6. Agent begins self-scoring from first encounter

---

## Extending the Scoring Model

When Pontus defines new dimensions (KKLOF or other):

1. Add dimension to the Extension Dimensions table in the template
2. Add scoring guide (what 0, 5, 10 mean for this dimension)
3. Update all existing dashboards with the new dimension (initial value: -)
4. Update the composite score formula
5. Note the change in REGISTRY.md

---

## Common Mistakes

**Scoring without specifics:** A score without findings is useless.
Always log what happened.

**Ignoring low scores:** A 3/10 on a dimension is a signal. Log it,
find the pattern, propose a fix.

**Not comparing to target:** A Formality score of 3 is correct for Lise
but wrong for HACCP Inspector. Score against target.

**Skipping encounters:** Every session gets scored. If you had a bad
session, that's even more important to log.

**Not archiving:** Dashboard files grow. Move old entries to archive.

**Inflated self-scores:** Be honest. Engine-architect will audit.
Backend observer (when wired) will cross-validate.
