---
title: Implementation Plan — Botsson Soul
status: draft
version: 0.2
created: 2026-05-15
updated: 2026-05-15
module: agent-system
tags: [botsson, implementation, plan, agent]
---

> **Changelog 0.2 (2026-05-15)**: tabell-navn oppdatert til `botsson_*` prefix (se `05-data-model.md` v0.2).

# Implementation Plan — Botsson Soul

## Goal

Fix Botsson channel dissonance and establish a proper server-side Soul Contract.

Current problem:

```txt
Voice receives persona/rank/blend.
Chat does not.
```

Target:

```txt
Chat and voice share same resolved identity, posture, context, memory and authority envelope.
```

---

## P0 — Fix channel dissonance

### Problem

Chat ignores persona/rank/blend/custom instruction while voice receives them.

### Required fix

Chat must receive identity input and compile the same canonical persona layer as voice.

Do not fix by trusting raw frontend-generated prompt text.

Correct flow:

```txt
UI preference
→ identity payload
→ stage-engine validation
→ server-side soul compilation
→ shared prompt contract
→ chat/voice execution
→ soul snapshot audit
```

### Acceptance criteria

- Given user selects `Brannslukker`, chat reflects Brannslukker identity.
- Voice reflects same identity.
- Both channels log same resolved identity values.
- Frontend does not become canonical prompt source.

---

## P0.5 — Add soul debug logging

### Goal

Make it visible what Botsson actually resolved.

### Log minimum

```json
{
  "persona": "puls",
  "rank": "manager",
  "blend": 8,
  "channel": "chat",
  "model": "anthropic/claude-sonnet-4.6",
  "authority_level": "confirm",
  "tools_offered": 12,
  "tools_filtered": 7
}
```

### Acceptance criteria

- Each run has soul debug metadata.
- Developer can verify channel consistency.
- Tool filtering reasons are visible.

---

## P1 — Server persistence

### Problem

Settings live in localStorage only.

### Required fix

Move canonical preferences to DB.

Tables:

- `botsson_profile`
- `botsson_user_preference`
- `botsson_workspace_policy`
- `botsson_soul_snapshot`

localStorage can remain as optimistic UI cache.

### Acceptance criteria

- User preference survives new browser/device.
- Workspace default can be configured.
- User override is scoped by workspace policy.
- localStorage is not source of truth.

---

## P1 — Soul snapshot logging

### Goal

Every Botsson run should be explainable.

### Snapshot must include

- resolved identity
- resolved posture
- model policy
- authority summary
- offered tools
- filtered tools
- context hashes
- memory ids

### Acceptance criteria

- `soul_snapshot_id` exists for each run.
- Snapshot is append-only.
- Snapshot can be used for debugging and evals.

---

## P1 — Voice speed setting

### Problem

Voice speed is hardcoded.

### Required fix

Expose `speed` in VoiceTuning and pass it to voice-agent.

### Suggested values

```txt
0.9  = rolig
1.0  = normal
1.15 = effektiv
1.3  = rask
```

### Acceptance criteria

- User can adjust speed in UI.
- Voice-agent reads speed from session payload.
- Default is safe for Norwegian voice UX.

---

## P2 — Settings UX simplification

### Problem

Current settings UI is too heavy.

### Required fix

Flatten into one primary settings screen:

1. Hvordan skal Botsson være?
2. Hvordan skal Botsson snakke?
3. Egen instruks
4. Avansert

### Acceptance criteria

- User can change preset quickly.
- Advanced settings are optional.
- UI does not expose internal architecture by default.

---

## P3 — Dedicated settings route

### Required route

```txt
/dashboard/settings/botsson
```

### Acceptance criteria

- Route is accessible from sidebar/settings.
- Arena overlay can deep-link to route.
- Settings route works on mobile.

---

## Recommended build order

```txt
1. P0 chat identity wiring
2. P0.5 debug logging
3. P1 DB persistence
4. P1 soul snapshot table
5. P1 voice speed
6. P2 settings simplification
7. P3 dedicated route
```

---

## Agent instruction

```txt
Implement Botsson Soul in baby steps.

First fix channel dissonance: chat must receive identity input and compile the same canonical persona layer as voice. Do not trust frontend-generated persona_prompt as canonical prompt text.

Then add soul debug logging so every run exposes resolved identity, posture, authority, offered tools and filtered tools.

After that, move preferences from localStorage to server-side persistence using botsson_profile, botsson_user_preference, botsson_workspace_policy and botsson_soul_snapshot.

Authority must always override persona. Channel policy must always override tool availability. User customization may change tone, never system boundaries.
```
