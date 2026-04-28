# Op 2: Spec (SpecEther)

> Status transition: `wizard → defined`. Input: a `<slug>.idea.md` from op 1, OR a fresh start. Output: `<slug>.spec.yaml` — full IR draft, schema-valid + semantic-valid.
>
> This is the longest op. Eight phases. Authors a complete IR through structured conversation.

## When this op runs

Trigger on:

- "Let's create a journey for X"
- "Add a new journey"
- "/journey-protocol"
- New project starting (Phase 0–2 of roadmap) and core journeys not yet authored
- New core feature shipping that needs runtime tracking + dev-tests + AI guide

## When NOT to run this op

Do NOT trigger on:

- "Add a step to journey X" → that's an edit, use the editor directly
- "Track this metric" → that's analytics, not a journey
- Edge cases or peripheral flows in early project phase → defer; only core features become journeys at first
- UI tweaks, copy changes, layout adjustments → not journey work

## Core principles

1. **Core features only.** Early in a project, only journeys that represent must-work flows. Onboarding, primary daily action, primary admin action, payment, login. Not settings tweaks, not edge cases. If user proposes 15 journeys for MVP, push back hard.
    
2. **Conversation, not form.** Real journey-creation requires pushback on scope, validation that the journey is one journey not three, and confirmation. Never just dump a template and ask user to fill it.
    
3. **One journey at a time.** Do not batch-create. Each conversation produces one IR. User confirms before next.
    
4. **Spec before code.** Output is `draft` IR. Author transitions to `validated` after review. Engine validates schema. No code is written from this op — this is planning only.
    
5. **No TBDs.** Every required field must be locked before generating output. If unsure, ask. If still unsure, mark journey as `priority: P3` and limit scope.
    

## Process

```
INTRODUCE → INTENT → SCOPE → SHAPE → STEPS → METADATA → CONFIRM → GENERATE
```

Each phase has a gate. Do not advance without an explicit lock from the user.

### Phase 1: Introduce

Tell user what you're about to do. Set expectations.

> "I'll help you create a journey. We'll talk through what the user does, what the system does in response, what 'done' looks like, and how the engine should track it. At the end you'll get a draft IR file. We'll cover: intent, scope, shape, steps, metadata. About 6–10 questions. Sound good?"

Wait for go-ahead.

### Phase 2: Intent

Goal: lock the **one user, one goal, one path** statement.

Ask:

1. "Which user is this for?" (role / persona)
2. "What are they trying to accomplish?" (goal in one sentence)
3. "What kicks this off — what makes them start?" (trigger / entry point)

Push back if:

- Goal contains "and" → likely two journeys
- User answer is vague ("manage stuff") → ask for the specific outcome
- Multiple actors mentioned without clear handoff → ask if it's multi-actor

Lock with:

> "Locked: <actor> wants to <goal>, starting from <trigger>. Moving on."

### Phase 3: Scope

Goal: confirm this is **one journey**, not several.

Ask:

1. "Where does this end? What does success look like for the user?"
2. "Is there a moment in this flow where a _different_ user picks up — like an employee accepting an admin's invite?"
3. "Does this happen once per user, repeatedly with a pattern, or as part of daily work?"

Decisions made here:

- **Mode:** sequential / free / hybrid / recurring
- **Repeat policy:** first_time_only / always / anomaly_based
- **Multi-actor:** yes / no

Push back if:

- User wants `mode: free` for what sounds linear → suggest sequential
- User wants `recurring` mode for what sounds like a one-shot → ask why
- User wants `repeat_policy: always` for an obvious onboarding flow → suggest first_time_only

Lock with:

> "Locked: mode=<X>, repeat=<Y>, actors=<single|multi>. Moving on."

### Phase 4: Shape

Goal: lock module + classification + relevance.

Ask:

1. "Which module does this belong to?" (onboarding, scheduling, comms, settings, admin, etc.)
2. "Is this part of new-user onboarding?"
3. "Is this something users do daily, weekly, or rarely?"
4. "Priority — is this a P0 must-have, or P1 important, or further out?"

If priority is P2 or P3 and project is in Phase 0–2: stop. Tell user this isn't a core journey yet. Defer.

Lock with:

> "Locked: module=<X>, relevance=<Y>, priority=<Z>. Moving on."

### Phase 5: Steps

Goal: lock the step list. This is the longest phase.

For each step the user describes, capture:

- What does the user do? (action)
- What does the system do in response? (system response)
- How does the engine _see_ this happened? (trigger type)
- What must be true for it to count? (assertion idea)
- How long should this step take before we worry? (next_step_window_ms)

Walk the user through their flow chronologically. After each step, ask:

> "Got it. Step N: <action> → <system> via <trigger>. Next?"

Push back if:

- A "step" is actually three sub-actions → split it or compress it
- User describes UI rendering as a step → that's a system response, not a user step (unless user explicitly waits for it)
- User describes background system work that user doesn't witness → it's a server_event step, but verify user is aware of its outcome
- Steps go beyond 12 → suggest splitting into prerequisite + this journey

Special prompt for step that might be stuck-prone:

> "If user pauses on this step, should we (a) abandon the run, (b) pause and resume on return, (c) move to background and reactivate later, or (d) offer help via AI guide?"

Lock when user says "that's the flow."

> "Locked: <N> steps. Moving on."

### Phase 6: Metadata

Goal: fill remaining required fields.

Ask:

1. "Where does the user start? (URL or route)"
2. "What must be true before this journey can begin?" (preconditions)
3. "Is there another journey that must complete first?" (prerequisites)
4. "Does completing this terminate any other journey?" (terminates)
5. "Should the AI guide have a particular voice or tone for this journey?" (system_prompt)

Lock all metadata.

### Phase 7: Confirm

Show user a plain-language recap of the journey. NOT YAML. NOT IR. A human summary.

> "Here's what I have. Let me read it back to you:
> 
> Journey: <title> Who: <actor> Module: <module>, priority <P> Mode: <mode>, repeats: <repeat_policy>
> 
> The user starts at <entry_url>, with <preconditions>.
> 
> They go through <N> steps:
> 
> 1. <step description>
> 2. <step description>
> 
> ...
> 
> They're done when <success_gate description>.
> 
> If they get stuck at any step, the engine will <on_timeout summary>.
> 
> Does this match what you have in mind?"

If user wants changes, return to relevant phase. Otherwise:

### Phase 8: Generate

Generate the IR YAML file. Validate it locally before presenting.

File location: `journeys/<id>.journey.yaml`

Run validations:

- [ ] Schema valid (Zod)
- [ ] Every step has trigger + assertion + on_timeout
- [ ] Confidence weights sensible (sum approximates 1.0 across high-contribution steps)
- [ ] No TBDs in any field
- [ ] References to other journeys exist OR are flagged as "to be created"

Present file. Tell user:

> "Draft IR generated at journeys/<id>.journey.yaml.
> 
> Status: draft. To validate: run `journey-cli validate <id>`. To publish (after review): transition to validated → published → active.
> 
> This will produce 5 artefacts: dev-test, user guide, mission, inference pattern, state card."

Stop. Do not edit further unless user requests.

## Pushback patterns

When users propose too many journeys early:

> "I hear you — but this is a project in Phase <X>. We should ship the engine with maybe 5–10 core journeys, prove it works end-to-end, then expand. Which 5 are absolutely-must-work? The rest are <project>'s phase 2 backlog."

When users propose a journey that's actually a bug-fix or UI change:

> "That sounds like a code change inside an existing journey, not a new journey. A new journey is a new user goal. Is there a goal here, or is it that an existing flow has a problem?"

When users describe a journey with no clear "done":

> "What does success look like for the user — what do they see, do, or have when this is over? If we can't define done, we can't track it."

When users describe a free-form flow but call it sequential:

> "If steps 3 and 4 can happen in either order, that's `hybrid` or `free` mode. Sequential means the engine should fail step 4 if step 3 didn't happen first. Which do you mean?"

## What this skill does NOT do

- Does not write code
- Does not generate the 5 artefacts (that's the publish action)
- Does not run dev-tests
- Does not edit existing IRs (use the editor)
- Does not validate authority configs
- Does not start runs

This is purely planning. Output is one validated draft IR file.

## References

- IR template: see `references/template.md`
- Example journeys: see `references/examples/`
- Common patterns and pushback scripts: see `references/patterns.md`