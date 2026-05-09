---
title: "Page-Takeover Capability — Default-Deny + Granular Per-Target Authority"
id: ADR-0228
status: proposed
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0228: Page-Takeover Capability — Default-Deny + Granular Per-Target Authority

## Context and Problem Statement

M3.2 introduces page-takeover (Botsson can perform DOM actions on user's behalf via `ui.simulate_click` / `ui.submit_form` / `ui.wait_for_state`). This is materially different from M2.2 same-page tour: M2.2 was read-only DOM (scroll + outline overlay). M3.2 mutates state through the user's authenticated session.

The trust contract changes:
- M2.2 worst case: user sees a highlight they didn't ask for. Trivially recoverable.
- M3.2 worst case: Botsson clicks "delete" on a wrong target due to allow-list bug or compromised intent classifier. Unrecoverable in some flows.

Without explicit governance, every workspace would inherit a powerful new ability the moment the code lands. That fails the "100% trygghet" intent (Pontus's North Star for /help). It also conflicts with ADR-0091/0099 (gate_action mandatory): if takeover is gateable, default level matters.

## Decision Drivers

- ADR-0091/0099 — gate_action is the single source of truth for who can do what.
- ADR-0078 — channel restriction: voice forbidden for PII / mutation flows.
- ADR-0193 — NonEmptyString brand: telemetry payloads must be uncorrupted.
- L-0094 / L-0124 / L-0146 — phantom contract anti-patterns: never make a UI promise the runtime cannot keep safely.
- 100% trygghet (Pontus): users must feel safe. AI mutation without explicit opt-in violates this.
- Future-proofing: each new takeover target (form, button) is a new trust surface. Coarse capability ("page_takeover.*") would be a footgun.

## Considered Options

1. **Coarse capability** — single `page_takeover` capability, allow-list of targets in code. Pros: simple. Cons: enabling one target enables all future targets. No per-target opt-in. Workspace cannot choose "let Botsson click panic-bar but never submit-form."
2. **Granular per-target capability** — capability slug per target_id (`page_takeover.help.panic_bar_human_button`). Pros: precise opt-in, audit log clarity, per-target authority config. Cons: more rows in `engine_authority_config` (one per target per workspace), more surface area.
3. **Capability per surface** — `page_takeover.help`, `page_takeover.schedule`, etc. Middle ground. Pros: less granular than (2). Cons: still allows surprise targets — adding a new help target gives existing opt-ins access without explicit decision.

## Decision Outcome

Chosen: **Option 2 — granular per-target capability**, with default-deny seed.

### Capability slug pattern

`page_takeover.<page_slug>.<target_id>`

- `page_takeover.help.panic_bar_human_button` (v1 only target)
- Future: `page_takeover.help.kb_search_clear`, `page_takeover.schedule.shift_create`, etc.

### Authority seed

For every workspace, every page_takeover.* capability gets a row in `engine_authority_config`:
- `level = 'disabled'`
- `min_role = 'admin'`

Admin must explicitly UPDATE the row to `level = 'read_write'` (or future intermediate levels) before Botsson can ever invoke that target. No silent activation.

Migration adds the seed row. Future targets add their own seed migration.

### Channel restriction

Tool kit checks `ctx.channel === 'chat'` at invocation. Voice channel returns:
```
{ ok: false, reason: 'voice_forbidden_for_takeover', message: 'Bytt til chat for å gjøre dette.' }
```

Extends ADR-0078 to mutation-class tools. Voice never invokes mutation under any circumstance, regardless of authority opt-in.

### Mandatory preview

Independent of authority: even when allow=true, preview UI is mandatory. No silent execution. Confirm chip enabled only after ≥3000ms (prevents reflexive confirm). ESC cancels.

### Audit trail

Every invocation produces a 3-row sequence in activity_trail:
1. `page_takeover.action_proposed` (after gate allow)
2. `page_takeover.action_confirmed` (user clicked confirm) OR `page_takeover.action_cancelled` (ESC / off-target)
3. `page_takeover.action_executed` (tool fired) — only if confirmed reached.

G-AUDIT merge-blocker: action_executed with no preceding proposed + confirmed = phantom. Caught by sub-sortie audit.

## Rules & Consequences

- **Good, because** every page_takeover target is opt-in. Workspaces inherit safe defaults.
- **Good, because** granular slugs let admin enable/disable per target. "Yes Botsson can click panic-bar but never touch forms."
- **Good, because** audit trail is mandatory and verifiable.
- **Good, because** voice forbidden eliminates one entire attack/error surface.
- **Bad, because** more `engine_authority_config` rows per workspace (1 per future target). Acceptable cost.
- **Bad, because** seed migration must be added per future target — slows down adding new takeover targets but that's the point: each new target requires explicit decision.
- **Agent Impact:**
  - `agent-router` MUST NOT pre-select page_takeover tools without confirming registered + bound.
  - `system-agent-coordinator` reviews any new takeover target request: requires its own ADR + seed migration.
  - `botsson-harness-builder` registers tool with channel-restriction check at invocation, not registration.

## References

- M3.2 spec — `docs/superpowers/specs/2026-04-29-page-takeover-harness.md`
- M3.2 plan — `docs/plans/PLAN-m3-page-takeover.md`
- ADR-0091 / ADR-0099 — gate_action mandatory
- ADR-0078 — channel restriction (extended here for mutation tools)
- ADR-0193 — NonEmptyString brand
- ADR-0220 — Botsson conversational front door
- L-0094 / L-0124 / L-0146 — phantom contracts
- 100% trygghet intent — `apps/web/src/app/dashboard/help/_data/curated-articles.ts` headers
