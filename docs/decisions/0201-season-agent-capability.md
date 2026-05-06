---
title: "Season Agent Capability — Five Tools, Authority Seed, Intent Classifier"
status: accepted
updated: 2026-04-23
created: 2026-04-23
module: year-wheel
tags: [season, capability, agent, authority-seed, intent-classifier, year-wheel, M3]
related:
  - ADR-0173  # journey capability model — dotted-key precedent
  - ADR-0191  # agent capability tool auth-passing pattern
  - ADR-0195  # authority loader full dotted-key preservation
  - ADR-0200  # atomic season activation — M1 foundation, season.activate seeded
  - ADR-0164  # season namespace unification for telemetry
  - ADR-0099  # gate_action contract (default-allow CVE class)
  - ADR-0189  # authority seed parity CI check
  - ADR-0196  # journey engine invariants 11/12/13
---

# ADR-0201: Season Agent Capability — Five Tools, Authority Seed, Intent Classifier

## Status

Accepted (2026-04-23, campaign/year-wheel M3). Five council-adjacent open questions resolved via targeted code-trace verification pre-acceptance — see §Pre-acceptance clarifications.

## Context

The five season agent tools (`createSeason`, `setRevenue`, `getReadiness`, `learnFactors`, `savePlaybook`) live in `packages/ai/src/tools/season/` but are orphaned from the capability system:

- Accept `SeasonToolContext` (`{supabase, workspaceId, sessionId, collectedData}`) — not `AgentToolContext`. No `profileId`, no `channel`, no `gateAction` coverage.
- Not registered in any `CapabilityDefinition`. Capability registry has no `season` entry.
- `packages/ai/src/router/intent-classifier.ts:36-57` enum has no `"season"` member. Season intent is mis-classified as `general`.
- `engine_authority_config` has no `season.*` rows (except `season.activate` seeded by ADR-0200 for Server-Action use only). `gate_action` would default-allow — CVE-class per ADR-0099 §107-109, L-0066, L-0097.

M1 (ADR-0200) landed `season.activate` as a Server Action path. M3 extends the agent surface by registering the five existing tools as first-class agent capabilities with authority gates, context migration, and intent classifier routing.

## Decision

### D1 — Five dotted capability keys

Per-tool dotted keys following ADR-0195 and the journey precedent. `season.activate` (ADR-0200) stays Server-Action-only and is NOT exposed as an agent capability here.

| Capability key | Tool | Level | min_role | Channels |
|----------------|------|-------|----------|----------|
| `season.create` | createSeason | `suggest` | `admin` | chat, system |
| `season.set_revenue` | setRevenue | `suggest` | `admin` | chat, system |
| `season.save_playbook` | savePlaybook | `suggest` | `admin` | chat, system |
| `season.get_readiness` | getReadiness | `read_only` | `admin` | chat, voice, system |
| `season.learn_factors` | learnFactors | `read_only` | `admin` | chat, voice, system |

Mutation tools: chat + system (no voice — multi-turn mutation flows via voice require wizard UX deferred to M5). Read tools: chat + voice + system (safe single-shot queries).

### D2 — SeasonToolContext → AgentToolContext migration

All five tools migrated from `SeasonToolContext` to `AgentToolContext`. `SeasonToolContext` deleted after grep confirms zero consumers. Rationale: two context shapes for one capability surface violates ADR-0191. Migration is mechanical — tools already filter explicit `workspace_id` in WHERE clauses, so RLS bypass via `supabaseAdmin` is safe (Q-B verified).

### D3 — Single CapabilityDefinition with `name: "season"` umbrella (Q-A resolved)

Following journey precedent exactly. ONE `CapabilityDefinition` with `name: "season"`, registry indexes `capabilities["season"] = seasonCapability`. Authority rows use dotted keys (`season.create`, `season.set_revenue`, etc.) stored in `engine_authority_config`, retrieved per-tool via tool-selector.ts.

### D4 — gateAction only on mutations (Q-C resolved)

ADR-0196 §Invariant 13 applies ONLY to tools that write DB state. Schedule (5 read tools, 0 gateAction), helpdesk_query (2 read tools, 0 gateAction) confirm. Season calls `gateAction` in `createSeason`, `setRevenue`, `savePlaybook`. NOT in `getReadiness`, `learnFactors`.

### D5 — Voice bridges deferred (Option C)

No client-side voice bridges created in M3. Mutation flows multi-turn (type→name→dates→revenue); schedule voice bridge pattern does not fit. Read-only tools' `allowedChannels: ["chat","voice","system"]` declare voice-safety structurally — a future M4 sub-sortie can add thin voice bridges without code changes to tool bodies.

### D6 — emitPrefix `"season"`

Matches ADR-0164 `"season "` telemetry prefix. No capability collision. Forward-looking — no tool emits in M3; M4 may register `season.created`, `season.playbook_saved` events.

### D7 — Intent classifier addition

Add `"season"` to `z.enum([...])` in `intent-classifier.ts:36-57`. System prompt disambiguation block:

```
- season: Planning-cycle operations — creating seasons, setting revenue targets,
  reading workforce readiness percentages, comparing day/hour demand factors,
  saving season playbooks. Time horizon: weeks to months. Subject: budget/NOK
  targets, factor adjustments, readiness %, playbook notes. Examples:
  "lag en sommersesong" (create), "sett omsetning til 2 millioner" (set_revenue),
  "hva er beredskapen?" (get_readiness), "sammenlign faktorer med forrige sesong"
  (learn_factors), "lagre spilleboken" (save_playbook).
  Use season for budget/planning vocabulary; schedule for shift-level vocabulary.
  When temporal scope is ambiguous (e.g. "plan for oktober"), prefer schedule if
  shift vocabulary present; season if budget/NOK/factor vocabulary present.
  Ambiguous: confidence < 0.7, pick schedule as safer read-only fallback.
```

### D8 — Authority seed migration

`supabase/migrations/20260518020000_season_agent_capability_authority_seed.sql` — same CROSS JOIN idempotent pattern as `20260516000400_journey_authority_seed.sql`. Seeds 5 capability keys × workspace count. `season.activate` not touched (different key, ON CONFLICT safe).

### D9 — `collectedData` migration safe (Q-E resolved)

Zero of the 5 tools read `ctx.collectedData` today. `AgentToolContext` migration requires no substitute data path. `SeasonToolContext` deleted after grep verification.

## Pre-acceptance clarifications (code-trace answers to architect's open questions)

- **Q-A resolved:** Journey uses ONE `CapabilityDefinition{name: "journey"}`, not 5. Season follows same pattern.
- **Q-B resolved:** RLS policies exist on `season/season_budget/day_factor/hour_factor` but all tools already explicit-filter by `workspace_id`. `supabaseAdmin` migration safe.
- **Q-C resolved:** Invariant 13 applies to DB-writing tools only. Schedule + helpdesk_query precedent: read tools skip `gateAction`.
- **Q-D resolved:** `season.activate` orphan authority row is LOW RISK. Tool-selector.ts:102 returns `[]` for unregistered capabilities. Agent cannot route. No mitigation needed in M3.
- **Q-E resolved:** Zero tools read `collectedData`. Migration safe without substitute path.

## Invariants

All invariants falsifiable via the listed grep/SQL/review command.

**I1 — Five capability keys in CapabilityName union.**
verify: `grep -n "season\." packages/ai/src/capabilities/types.ts` returns at least 5 lines (one per key).

**I2 — Capability registered in registry.ts.**
verify: `grep "seasonCapability" packages/ai/src/capabilities/registry.ts` returns at least 1 line.

**I3 — emitPrefix "season" not colliding.**
verify: `pnpm turbo typecheck && node -e "require('./packages/ai/dist').getAllCapabilities()"` exits 0 (runtime assertion at registry.ts:48-60).

**I4 — Authority seed rows present for all 5 capabilities.**
verify: `SELECT DISTINCT capability FROM engine_authority_config WHERE capability LIKE 'season.%' AND capability != 'season.activate'` returns 5 rows.

**I5 — gateAction before first mutation in 3 mutating tools.**
verify: in each of `create-season.ts`, `set-revenue.ts`, `save-playbook.ts`, line number of `gateAction` call is less than line number of first `.insert(` or `.update(`.

**I6 — SeasonToolContext deleted after migration.**
verify: `grep -rn "SeasonToolContext" packages apps scripts` returns zero results.

**I7 — "season" in intent classifier enum.**
verify: `grep -n '"season"' packages/ai/src/router/intent-classifier.ts` returns at least 1 line inside the `z.enum([...])` block.

**I8 — No voice in mutation tools.**
verify: The 3 mutating tools do NOT appear in a `readOnlyTools` array. The `CapabilityDefinition.allowedChannels` is capability-level (all three channels); per-tool channel restriction enforced by gateAction + tool body check.

**I9 — Seed-before-capability ordering.**
verify: git log shows `20260518020000_season_agent_capability_authority_seed.sql` migration commit older than (before) the capability-registration commit.

**I10 — pnpm turbo typecheck passes.**
verify: `pnpm turbo typecheck` exits 0.

**I11 — season.activate NOT exposed as agent capability.**
verify: `grep -rn "season.activate" packages/ai/src/capabilities/` returns zero results.

**I12 — No phantom capability body (ADR-0196 §Invariant 11).**
verify: In each mutating tool body, the `gateAction` call and first `.insert(`/`.update(` are within 40 lines. Read tools have `.select(` within 40 lines of the first line of `execute()`.

## Consequences

### Positive

- Agent-addressable season planning via chat. "Lag en vintersesong fra november til februar" becomes routable.
- CVE-class default-allow gap closed for 5 new capabilities (ADR-0099, L-0066, L-0097).
- Intent classifier gains `season` target. Silent mis-classification eliminated.
- `SeasonToolContext` deleted — no parallel dead type inviting future gateAction omission.
- Read tools voice-safe structurally.
- `emitPrefix: "season"` reserved for M4 telemetry.

### Negative

- Voice bridges deferred for mutation tools. Multi-turn voice creation waits for M5.
- 5 new rows per workspace in `engine_authority_config`. Negligible (~2500 rows at 500 workspaces).
- `SeasonToolContext` deletion risk: any undiscovered non-agent consumer breaks. Grep-gate mitigates.
- Until ADR-0192 bootstrap trigger lands, NEW workspaces won't get these rows seeded — `gate_action` default-allows. Documented, not a blocker (admin-only capabilities; default-allow means admin-callable without seed row, not a privilege escalation).

## Related

- ADR-0173 — journey capability model (template)
- ADR-0191 — single auth-passing pattern per capability
- ADR-0195 — dotted-key preservation
- ADR-0200 — season.activate Server-Action surface
- ADR-0164 — season telemetry namespace
- ADR-0099 — gate_action default-allow CVE class
- ADR-0189 — authority seed parity CI
- ADR-0196 — invariants 11/12/13
- L-0066 — C4 defaults not free
- L-0097 — C4 defaults 2nd occurrence
