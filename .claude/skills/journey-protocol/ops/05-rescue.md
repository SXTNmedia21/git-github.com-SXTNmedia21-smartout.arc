# Op 5: Rescue (Author the agent's failure context)

> Standalone op. Can run any time after spec. Output: `RESCUE-PROMPT.md` inside the journey folder. Loaded by stage-engine when run state goes `stuck` or `failed`.
>
> Not load-bearing: a journey can complete without a rescue prompt. But every P0/P1 journey should have one.

## When this op runs

- "Write a rescue prompt for <journey>"
- "Author rescue context for <journey>"
- After `/journey-protocol approve` for any P0/P1 journey
- When telemetry shows high stuck rate on a step (operator-driven authoring)

## What this op produces

A single file at `docs/journeys/<slug>/RESCUE-PROMPT.md`. Format defined in `docs/engines/system-intelligence/10-rescue-prompt-spec.md`. Mandatory sections:

1. Frontmatter (`journey_id`, `schema_version`, `status`, `voice_safe`, `languages`)
2. **Tone** — one paragraph
3. **What you know about this journey** — context for the agent
4. **What you can do** — bullet list of allowed actions (bound to existing capabilities)
5. **What you cannot do** — explicit boundaries (PII, irreversible actions, escalation triggers)
6. **Per-step rescue lines** — one section per step that can get stuck. Verbatim agent lines, bilingual.
7. **Failure-mode rescue lines** — per `error_code` (api_error, validation_failed, timeout, etc.)
8. **Escalation paths** — table mapping situation → action

See `references/rescue-prompt-format.md` for the canonical template.

## Process

1. **Read the journey IR.** Identify which steps have `on_timeout: assist` or `on_timeout: pause` — those are the candidates needing rescue lines.
2. **Read existing telemetry (if available).** Stuck rate per step. Highlight steps where users actually get stuck.
3. **Walk user through tone first.** "How should the agent sound when something goes wrong here? Apologetic? Direct? Reassuring?"
4. **For each candidate step:**
   - "If user is stuck at <step>, what's the most likely reason? Network? Confusion? Missing data?"
   - "What should the agent say, in English?" (verbatim 1–3 sentences)
   - "Same line in Norwegian?"
   - "Suggested action — button label or follow-up prompt?"
5. **For each error_code:**
   - "What if API returns 500 here? What does the agent say?"
   - "What if validation fails? What does the agent say?"
6. **Escalation paths.** "When should the agent give up and route to a human? When stay silent?"
7. **Write `RESCUE-PROMPT.md`** with all sections filled.
8. **Validate references:** every `step_key` mentioned must exist in `journey.md` step list. No phantom step refs.
9. **Tell user:** "Rescue prompt written. Loaded by stage-engine on next stuck/failed transition. Test by simulating a stuck run via `journey.run_dev`."

## Refuse / push back if

- User says "just generate a generic rescue prompt" → refuse. "Generic rescue is not rescue. Without per-step content, the agent says nothing useful." Walk them through at least the top 3 stuck steps.
- User wants to grant new authority via rescue → refuse. "Rescue uses existing capabilities. Grant new authority via authority migration + ADR, not in rescue prompt."
- Journey has no `assist` / `pause` steps → return: "This journey has no stuck-prone steps (all `abandon` or `background`). Rescue prompt not needed. Skip this op."
- Step keys don't match journey.md → reject with line refs.

## Telemetry side effect

Authoring a rescue prompt does NOT itself fire telemetry. The runtime event `journey.rescued` (added per `10-rescue-prompt-spec.md`) fires when the agent loads + uses this content during a stuck/failed run. Make sure that event is registered in `packages/telemetry/src/registry.ts` before approve.

## See also

- `docs/engines/system-intelligence/10-rescue-prompt-spec.md` — canonical format + telemetry contract
- `references/rescue-prompt-format.md` — authoring template
- `docs/engines/system-intelligence/01-prd.md` §11 — AI guide layer
- `docs/engines/system-intelligence/01-prd.md` §7.8 — assist eligibility (rescue vs assist relationship)
