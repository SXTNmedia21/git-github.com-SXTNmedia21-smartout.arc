# Op 1: Create (PreJourney)

> Status transition: `idea → wizard`. Input: nothing. Output: `<slug>.idea.md` — intent stub.
>
> Capture intent. One sentence, one actor, one trigger. No steps. No commitments. Tightest gate of the five ops.

## When this op runs

- "Let's start a journey for X"
- "I want to add a new journey"
- "Create journey for <feature>"
- New project Phase 0–2 onboarding the first batch

## What this op produces

A single file at `<slug>.idea.md`:

```markdown
---
schema_version: "2.0.0"
journey_id: "<kebab-case-slug>"
status: idea
created: <ISO date>
author: <user id or name>
---

# <Human-readable title>

**Actor:** <role | anonymous_visitor | multi>
**Goal (one sentence):** <what user is trying to accomplish>
**Trigger:** <what kicks this off — URL, button, event, schedule>
**Module (guess):** <onboarding | scheduling | comms | ...>

## One-paragraph context

<Why does this journey exist? What does the user *not* have today that this gives them?>
```

That's it. No steps, no triggers-as-events, no telemetry, no capabilities. Spec op (02) does that work.

## Refuse if

- Goal sentence contains "and" (likely two journeys — split first)
- Project is in Phase 0–2 and proposed journey is not core (defer; only must-work-on-day-one becomes a journey at first)
- Existing journey already covers this intent (point user at existing IR; offer to amend, not create new)
- User can't articulate a one-sentence goal (return: "if we can't define done, we can't track it")

## Process

1. **Greet + scope.** "I'll capture an idea stub. We'll lock just one user, one goal, one trigger. Spec phase comes next. Ready?"
2. **Ask three questions, in order:**
   - "Which user is this for?" (role / persona)
   - "What are they trying to accomplish, in one sentence?" (one-sentence goal)
   - "What kicks it off — URL, button, event, or schedule?" (trigger)
3. **Push back if needed.** Goal contains "and" → "That sounds like two journeys. Which is the load-bearing one?" Vague answer → "The specific outcome — what do they have, see, or do that means it worked?"
4. **Confirm one-line summary.** "Locked: <actor> wants to <goal>, starting from <trigger>. Module probably <module>. Save as <slug>?"
5. **Generate `<slug>.idea.md`.** Place in working dir or `journeys/drafts/`.
6. **Tell user next step.** "Idea captured. Run `/journey-protocol spec <slug>` to flesh out steps."

Stop after step 6. Do not advance to spec without explicit user request.

## Output validation

- `journey_id` is kebab-case, alphanumeric + hyphens
- `actor` is set
- One-line goal does not contain "and"
- Trigger is concrete (not "user wants to")

## See also

- `ops/02-spec.md` — what runs after this
- `references/patterns.md` — pushback scripts when scope is too big
- `docs/engines/system-intelligence/05-protocol-pipeline.md` §2.1 — canonical contract
