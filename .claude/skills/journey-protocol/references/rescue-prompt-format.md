# RESCUE-PROMPT.md format

Authoring template for `ops/05-rescue.md`. Mirrors `docs/engines/system-intelligence/10-rescue-prompt-spec.md`.

## Template

```markdown
---
journey_id: "<slug>"
schema_version: "1.0.0"
status: draft | active
voice_safe: true | false      # false if any pii_input step in journey
languages: ["en", "no"]       # add others as needed
---

# Rescue context for <journey title>

## Tone

<one paragraph: how should the agent sound here? formal/casual/warm/brisk?
 Should the agent apologize, or skip pleasantries? Match journey persona.>

## What you know about this journey

<one paragraph: what is the user trying to do, what stage are they likely at,
 what's the typical reason they got stuck? Write so the agent can read this
 cold and orient instantly.>

## What you can do

- <specific action 1, bound to existing capability>
- <specific action 2>
- <specific action 3>

## What you cannot do

- <PII fields, irreversible actions, things needing C4 escalation>
- <e.g. "Cannot grant manager role — escalate to admin">
- <e.g. "Cannot reset payment data — escalate to billing">

## Per-step rescue lines

### step.<namespace>.<action>

**Likely reason stuck:** <one sentence>

**What to say (en):**
> <verbatim agent line, 1–3 sentences>

**What to say (no):**
> <verbatim agent line, 1–3 sentences>

**Suggested action:** <button label or follow-up prompt>

### step.<namespace>.<next_action>

…

## Failure-mode rescue lines

### error_code: api_error

**What to say (en):**
> <verbatim line — usually "We hit a problem on our side. Try again in a moment, or I can hand you to a human.">

**Suggested action:** retry / abandon / escalate

### error_code: validation_failed

**What to say (en):**
> <verbatim line>

…

## Escalation paths

| When | Action |
|---|---|
| User explicitly says "give up" | Emit `journey.run_failed` with `error_code: abandoned_by_user`. Confirm ended. |
| User asks for human | Emit `assist.requested` with `route: human`. Stage-engine routes to human inbox. |
| Agent unsure | Stay silent. Do not fabricate. |
```

## Authoring rules

1. **Per-step, not generic.** "Try again" is not a rescue line. Specific to journey + step.
2. **Verbatim quotes.** Agent reads what's written. Don't write meta-instructions ("ask warmly") — write the line.
3. **Bilingual.** Norwegian + English required for any active journey.
4. **`voice_safe: false`** if any `pii_input: true` step in journey. Rescue loaded chat-only.
5. **No new authority.** Rescue references existing capabilities. Adding capabilities = ADR-class.
6. **No safety guard rails here.** Hallucination control is at LLM provider level, not in rescue content.

## Validation (run before save)

- All `step_key` references in "Per-step" sections exist in `journey.md` step list
- `voice_safe` matches journey's PII profile
- Both languages present for every quoted line
- All "Suggested action" values are recognized routes (button label, prompt, escalate, retry, abandon)
- No agent line exceeds 3 sentences (cognitive load + voice TTS budget)

## Telemetry

When agent loads + uses this content during a stuck/failed run, runtime emits `journey.rescued`. That event MUST be in `packages/telemetry/src/registry.ts` before approve. Add via separate ADR if missing.
