---
title: "Rescue Prompt — Agent Context for Stuck/Failed Runs"
id: ENGINE_SYSTEM_RESCUE_PROMPT
version: "1.0"
status: draft
layer: architecture
created: 2026-04-28
updated: 2026-04-28
owner: platform
module: journey-engine
tags:
  - rescue-prompt
  - agent
  - failure-recovery
  - journey-engine
---

# Rescue Prompt — Agent Context for Stuck / Failed Runs

> ⚠️ **STATUS: INTENT, NOT IMPLEMENTED (2026-04-28).** No stage-engine loader exists. The proposed `journey.rescued` event is **not in the registry**. A LIVE rescue path already exists: `guardian_signal → dispatch_push_notification('journey_rescue', ...)` (see `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql`). ADR-0223 (proposed) reconciles the dual-rescue trap before this spec ships. Until then, RESCUE-PROMPT.md files are forward-compatible documents only — runtime ignores them.
>
> When a journey run goes `stuck` or `failed`, the agent needs to know what to say. Rescue Prompt is the **context screen** the agent loads at that moment. Hand-authored, optional, scoped to one journey.
>
> Not load-bearing: a journey can complete without a rescue prompt. But every P0/P1 journey should have one.

---

## 1. Concept

The agent is a generalist. The journey is a specialist context. When something goes wrong **inside** a specialist context, the agent shouldn't fall back to generic helpfulness — it should say something specific to *this* journey, *this* step, *this* failure mode.

Rescue Prompt is that specificity. One markdown file per journey. Agent loads it when:

- Run state transitions `running → stuck` (timeout fired)
- Run state transitions `running → failed` (hard error)
- User dismisses `assist.requested` and stays on the same step
- User explicitly asks for help inside a known journey ("hjelp", "stuck", "what now")

---

## 2. File location + binding

```
docs/journeys/<slug>/RESCUE-PROMPT.md
```

Bound to journey by folder location. Optional file — absence = no rescue context, agent uses default fallback.

Loaded by stage-engine when:
1. Run `journey_id` is known
2. Stage Engine receives transition event (`journey.stuck` / `journey.run_failed`)
3. Or user message arrives during one of the trigger states above

Cached per run. Not reloaded mid-run.

---

## 3. Format

Markdown with structured sections. Frontmatter mandatory.

```markdown
---
journey_id: "<slug>"
schema_version: "1.0.0"
status: draft | active
languages: ["en", "no"]
# NOTE: No voice_safe flag. Channel restriction inherits from the journey's
# capability allowedChannels (ADR-0078) + process allowed_channels +
# tool ctx.channel guard. Adding a 4th boolean here would duplicate the
# 3-layer defence and rediscover the rejected human_only pattern.
---

# Rescue context for <journey title>

## Tone

<one paragraph: how should the agent sound here? formal/casual/warm/brisk?>

## What you know about this journey

<one paragraph: what is the user trying to do, what stage are they likely at,
 what's the typical reason they got stuck?>

## What you can do

<bullet list: specific actions the agent has authority to take in this rescue context.
 Bound to capabilities the journey already declares — never authorize new capabilities here.>

## What you cannot do

<bullet list: explicit boundaries. PII fields, irreversible actions, things that need C4 escalation.>

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
> <verbatim line>

**Suggested action:** <retry / abandon / escalate>

### error_code: validation_failed

…

## Escalation paths

| When | Action |
|---|---|
| User explicitly says "give up" | Emit `journey.run_failed` with `error_code: abandoned_by_user`. Confirm ended. |
| User asks for human | Emit `assist.requested` with `route: human`. Stage-engine routes to human inbox. |
| Agent unsure | Stay silent. Do not fabricate. |
```

---

## 4. Author rules

- **Per-step lines, not generic.** "Try again" is not a rescue line. Specific to the journey + step.
- **Verbatim quotes.** Agent reads what's written. Don't write meta-instructions ("ask warmly") — write the line itself.
- **Bilingual.** Norwegian + English required for any active journey. Add other locales as needed.
- **Voice safety inherits from ADR-0078.** Channel restriction is enforced at three existing layers (process `allowed_channels` + capability `allowedChannels` + tool `ctx.channel` guard). Do NOT add a `voice_safe` flag in frontmatter — that rediscovers the rejected `human_only` pattern. If the journey has `pii_input: true` steps, the journey's capability already declares `allowedChannels: ['chat']`, and rescue inherits that.
- **No new authority.** Rescue Prompt cannot grant capabilities the journey doesn't already have. Refers only to existing C4 authority.
- **No hallucination guard rails written here.** Hallucination control is at the LLM provider level. Rescue Prompt is for content, not safety.

---

## 5. Telemetry

> ⚠️ A LIVE rescue path already exists: `guardian_signal → dispatch_push_notification('journey_rescue', ...)` (since 2026-04-06, `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql`). **Before introducing `journey.rescued` as a new event, ADR-0223 must reconcile** — single source for journey rescue.

If the council reconciliation lands as "new event":

```
event_name: journey.rescued
payload:
  run_id: UUID                              # journey_run.run_id
  journey_id: text
  workspace_id: UUID                        # MANDATORY (ADR-0134, Invariant 4)
  actor_id: UUID                            # MANDATORY (ADR-0134, server-derived, not from client)
  step_key: text
  trigger: "stuck" | "failed" | "user_request"
  rescue_action: "spoke" | "escalated" | "abandoned_by_user" | "stayed_silent"
  language: text
  timestamp: timestamptz
```

`workspace_id` and `actor_id` are **non-negotiable** per ADR-0134 / Invariant 4. Server derives both from `journey_run` row; never accept from client. Empty-string fallback forbidden — fail fast.

Adds to registry `packages/telemetry/src/registry.ts`. Required destinations: `analytics`, `logger`, `audit`, `event_store` (per ADR-0175 telemetry contract — note this expands the frozen-5 to frozen-6, requiring ADR-0175 amendment via ADR-0223).

CI gate: `grep -rn 'journey.rescued' apps packages services` must match registry entry. Phantom-emit guard (ADR-0196 Invariant 11).

If the council reconciliation lands as "use existing path": this section is deleted; stage-engine reads RESCUE-PROMPT.md content but emits no new event — existing `dispatch_push_notification('journey_rescue', ...)` remains canonical.

---

## 6. ADR-required additions

This spec needs **two ADRs** before implementation:

- **ADR-0223** (proposed) — `journey.rescued` vs `guardian_signal` rescue path reconciliation. Pick one canonical rescue source. If new event wins, amend ADR-0175 (telemetry contract) to add 6th journey event.
- **ADR for stage-engine RESCUE-PROMPT.md loader** — defines load contract (where files live at runtime, when loader fires, cache lifetime, multi-tenant scope). Currently no loader exists.

Cross-references: ADR-0175 (telemetry contract — frozen-5 vs +1 event), ADR-0078 + ADR-0163 (channel restriction — `voice_safe` rejected as 4th layer), ADR-0134 (telemetry actor_id contract), ADR-0196 (phantom-emit invariants).

---

## 7. Lifecycle

| Author event | Effect |
|---|---|
| `journey-protocol rescue` | Authors or edits `RESCUE-PROMPT.md` for a journey |
| Journey approve | Validates rescue file (if present) — schema valid, all `step_key` references match `journey.md` |
| Journey edit (new version) | Old rescue file copies to new version; author may amend |
| Journey retire | Rescue file retires with journey; new runs don't load |

Edit-in-place is allowed (unlike `ir/journey.yaml` which is immutable post-approve). Rescue is content, not contract — drift is acceptable as content tuning.

---

## 8. Examples

See `packages/admin-onboarding/RESCUE-PROMPT.md` (when authored) for canonical reference. As of this spec creation, no rescue prompts exist yet — this spec defines the format before authoring begins.

---

## Changelog

| Date | Version | Change |
|---|---|---|
| 2026-04-28 | 1.0.0 | Initial spec. Format + binding + telemetry event + ADR requirements. |
