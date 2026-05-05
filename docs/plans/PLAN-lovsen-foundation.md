---
title: "Plan — lovsen-foundation"
feature: lovsen-foundation
spec: ../../../smartout.ai/docs/agents/lovsen-agent/README.md
status: in_progress
updated: 2026-04-29
created: 2026-04-29
module: MODULE_AGENT_SDK
tags: [plan, lovsen, phase-1, p1-s0]
---

# Plan — lovsen-foundation (P1.S0)

> Branch: `feat/lovsen-lovsen-foundation` | Worktree: `~/dev/smartout.ai-lovsen-wt-1` | Module: MODULE_AGENT_SDK
> Phase 1, sub-sortie 0 (sequential, ~45 min). Foundation for 7 downstream sub-sorties (P1.S1a-d, P1.S2-S4).

**Spec sources:**
- `~/dev/smartout.ai/docs/agents/lovsen-agent/README.md` — Lovsen agent overview (architecture, MCPs, skills tier-list)
- `~/dev/smartout.ai/docs/agents/lovsen-agent/lovsen.md` — Persona + system prompt (Tier 1+2 v0.1.0)
- `~/dev/smartout.ai/docs/agents/lovsen-agent/SKILL.AML.md` — `aml-14-6-validator` skill spec (input/output/edge cases)
- `~/dev/smartout.ai/docs/agents/lovsen-agent/SKILL.CLASSIFYER.md` — `amendment-classifier` skill spec
- `~/dev/smartout.ai/docs/agents/lovsen-agent/checklist.md` — Aml. §14-6 bokstav a–p validation rules
- `~/dev/smartout.ai/docs/agents/lovsen-agent/ROADMAP.md` — Tier 3+ deferred work
- Campaign roadmap: `docs/plans/CAMPAIGN-lovsen.md`

## Context

P1.S0 is the **foundation pre-requisite** for all of Phase 1. It builds nothing user-facing.
Output unblocks P1.S1a-d (4 stdio MCPs) + P1.S2 (knowledge base) + P1.S3 (skills+persona) + P1.S4 (Botsson capability).

Phase 1 end-state delivers 3 verifiable backend journeys:
- `validate-contract` (Aml. §14-6 — see `SKILL.AML.md`)
- `draft-contract` (Tier 2 promoted — `contract-drafter`)
- `classify-amendment` (see `SKILL.CLASSIFYER.md`)

P1.S0 cannot verify those journeys — it only verifies that the **types, telemetry, and decisions are in place** for downstream sub-sorties to build them.

## Journeys (the contract — dev-acceptance scope)

- [JOURNEY-lovsen-foundation-contract-package-builds](../journeys/JOURNEY-lovsen-foundation-contract-package-builds.md) — `@smartout/lovsen-contract` package builds + types importable from a downstream package
- [JOURNEY-lovsen-foundation-telemetry-events-registered](../journeys/JOURNEY-lovsen-foundation-telemetry-events-registered.md) — 9 Lovsen events appear in `packages/telemetry/src/registry.ts` + emit() smoke-test routes correctly
- [JOURNEY-lovsen-foundation-foundation-adrs-locked](../journeys/JOURNEY-lovsen-foundation-foundation-adrs-locked.md) — 4 foundation ADRs registered + `status: accepted` in `0000-decision-log.md`

## Goal

Ship the contract package, telemetry registrations, and 4 foundation ADRs so P1.S1a-S4 can build against a stable interface.

## Deliverables

### 1. `@smartout/lovsen-contract` package

Location: `packages/lovsen-contract/`

Public types (Zod schemas + `z.infer<>`). Field shapes derived from the Lovsen agent spec — every Lovsen answer must carry verbatim citation, confidence, and (when applicable) validation/classification result blocks.

- **`Citation`** — paragraph reference: `{ lov: string; paragraph: string; ledd?: string; bokstav?: string; verbatim_text: string; hash: string; fetched_at: string; source_url: string; law_version?: string }`
- **`Confidence`** — `{ level: 'HØY' | 'MEDIUM' | 'LAV'; score: number /* 0..1 */; reasons: string[]; stale_paragraph: boolean; missing_data: string[] }` — preserves Lovsen persona's HØY/MEDIUM/LAV labels (lovsen.md §Confidence-policy) plus numeric score for downstream gating
- **`LovsenAnswer`** — `{ answer_no: string; citations: Citation[]; confidence: Confidence; classification?: ClassificationResult; validation?: ValidationResult; disclaimer?: string; escalation_recommended: boolean }`
- **`ValidationResult`** — derived from `SKILL.AML.md` output: `{ validation_id: string; contract_id: string; validated_at: string; validator_version: string; source_url: string; source_fetched_at: string; result: 'pass' | 'fail' | 'pass_with_warnings' | 'skip' | 'review_required'; issues: ValidationIssue[]; summary_no: string }` with nested `ValidationIssue: { severity: 'error' | 'warning'; paragraph: string; field: string; message_no: string; remediation: string; confidence: 'HØY' | 'MEDIUM' | 'LAV' }`
- **`ClassificationResult`** — derived from `SKILL.CLASSIFYER.md` output: `{ classification: 'material' | 'admin' | 'derived' | 'system' | 'blocked' | 'review_required'; requires_resigning: boolean; confidence: 'HØY' | 'MEDIUM' | 'LAV'; reasoning_no: string; paragraph_references: string[]; source_urls: string[]; warnings: ClassificationWarning[]; blocked_reason: string | null; alternative_actions: string[] }`

Pkg structure:
```
packages/lovsen-contract/
├── package.json          (name:@smartout/lovsen-contract, exports:./src/index.ts, peer:zod)
├── tsconfig.json         (extends @smartout/typescript-config)
├── src/
│   ├── index.ts          (re-exports all schemas + types)
│   ├── citation.ts
│   ├── confidence.ts
│   ├── lovsen-answer.ts
│   ├── validation-result.ts
│   ├── classification-result.ts
│   └── __tests__/
│       ├── citation.test.ts
│       ├── confidence.test.ts
│       ├── lovsen-answer.test.ts
│       ├── validation-result.test.ts
│       └── classification-result.test.ts
└── README.md             (one paragraph: what+why; link to ADR-0181/0182)
```

Acceptance:
- `pnpm --filter @smartout/lovsen-contract build` → 0 errors
- `pnpm --filter @smartout/lovsen-contract test` → all parse tests pass
- Smoke import from `packages/ai/src/lovsen-import-smoke.ts` (delete after) compiles

### 2. Telemetry registrations (9 events)

File: `packages/telemetry/src/registry.ts`

Events (all `category: 'lovsen'`):
1. `lovsen.query.received` — Botsson capability invocation. Payload: `{ workspace_id, actor_id, query, channel }`
2. `lovsen.query.classified` — intent routed to skill. Payload: `{ workspace_id, actor_id, intent, skill_picked, tier }`
3. `lovsen.skill.invoked` — Tier 1/2/3 skill picked. Payload: `{ workspace_id, actor_id, skill_name, skill_version }`
4. `lovsen.mcp.fetch` — MCP call started. Payload: `{ workspace_id, actor_id, mcp_server, tool, params }`
5. `lovsen.mcp.fetch.completed` — MCP call returned. Payload: `{ workspace_id, actor_id, mcp_server, tool, latency_ms, cache_hit }`
6. `lovsen.mcp.fetch.failed` — MCP call errored. Payload: `{ workspace_id, actor_id, mcp_server, tool, error_kind, error_message }`
7. `lovsen.answer.composed` — final LovsenAnswer emitted. Payload: `{ workspace_id, actor_id, citation_count, confidence_level, escalation_recommended }`
8. `lovsen.confidence.degraded` — score below threshold. Payload: `{ workspace_id, actor_id, score, reasons }`
9. `lovsen.citation.stale` — citation older than freshness window. Payload: `{ workspace_id, actor_id, paragraph, fetched_at, age_hours }`

Per-event registry entry: `{ name, category: 'lovsen', schema (Zod), destinations: ['posthog','log','activity_trail'] }`. No `engine_event` routing in P1.S0 — capability layer adds that in P1.S4.

Use `nonEmptyString` helper from `packages/telemetry/src/non-empty-string.ts` for `workspace_id` + `actor_id` on all 9 events (ADR-0134 telemetry contract).

Acceptance:
- `pnpm --filter @smartout/telemetry test` → registry tests pass for all 9
- One smoke test that emits each event and asserts it routes to log + posthog mock + activity_trail fake

### 3. Four foundation ADRs

In `docs/decisions/`. Verify next free slots against `0000-decision-log.md` HEAD before writing.

Actual slots used (0181-0184 were taken by contract-management-redesign campaign):
- **ADR-0256 — Lovsen Citation Contract**: every Lovsen answer cites verbatim paragraph with hash + fetched_at + source_url. Reason: legal-grade provenance, no hallucinated law text. Cross-refs ADR-0004 (telemetry) + lovsen.md §Confidence-policy + §Operasjonelle-prinsipper.
- **ADR-0257 — Lovsen Confidence Model**: dual representation (HØY/MEDIUM/LAV from persona + numeric 0..1 score for gating). Reason: persona must communicate uncertainty in user-readable terms; downstream code needs comparable score for thresholds.
- **ADR-0258 — Lovsen MCP Boundary**: 4 stdio MCPs (Lovdata, Mattilsynet, Arbeidstilsynet, NHO Reiseliv) own paragraph fetch; capability layer never scrapes. Fixture-mode required for offline tests. Reason: separation-of-concerns + repeatable CI + rate-limit-respect (1 req/sec per source per README §Hvorfor MCP-servere).
- **ADR-0259 — Lovsen Capability Authority**: C4 authority seed for `industry_intelligence.lovsen_query` Botsson capability. Reason: confident ≠ authorized; legal advice requires explicit gate. References ADR-0024 (contract architecture), ADR-0078 (channel restriction — voice forbidden for legal advice).

Each ADR uses `docs/templates/decision.md`. Status: `accepted` (decided in plan-time, see PD-1..17 in faseplan).

Register in `0000-decision-log.md` index — add 4 rows in date order, update count line in **Integrity** section.

## Tasks

- [ ] **T1.** Scaffold `packages/lovsen-contract/` skeleton (package.json, tsconfig, src/index.ts placeholder, README.md). Verify `pnpm-workspace.yaml` already covers `packages/*`.
- [ ] **T2.** Implement 5 type files with Zod schemas + parse tests (one file per type, one test file per type). Use `z.infer<>` to derive TS types from each schema. Exports named (no default exports) per code-conventions.
- [ ] **T3.** Wire `index.ts` re-export. Run `pnpm install` from worktree root; verify clean.
- [ ] **T4.** Smoke-test import from `packages/ai/src/lovsen-import-smoke.ts` (compile-only — file deleted after `pnpm turbo typecheck` passes). Verifies workspace symlink + tsconfig path.
- [ ] **T5.** Register 9 Lovsen events in `packages/telemetry/src/registry.ts` with Zod schemas. Use `nonEmptyString` helper for `workspace_id` + `actor_id`.
- [ ] **T6.** Add registry test coverage in `packages/telemetry/src/__tests__/` — one test file `lovsen-events.test.ts` with: per-event schema validation, emit smoke test, empty-string-actor_id throws.
- [x] **T7.** Verify next free ADR slots — confirmed 0181-0184 taken by contract-management-redesign; used 0238-0241.
- [x] **T8.** Write ADR-0256 Citation Contract using `docs/templates/decision.md`. Reference lovsen.md §Operasjonelle-prinsipper + ADR-0004.
- [x] **T9.** Write ADR-0257 Confidence Model. Capture both HØY/MEDIUM/LAV persona terminology + numeric score gating.
- [x] **T10.** Write ADR-0258 MCP Boundary. List 4 servers + tools per `README.md` §Hvorfor MCP-servere. Lock fixture-mode requirement.
- [x] **T11.** Write ADR-0259 Capability Authority. Cross-ref ADR-0024 + ADR-0078 (voice forbidden for legal advice).
- [ ] **T12.** Register all 4 ADRs in `0000-decision-log.md` index + bump count line in Integrity section.
- [ ] **T13.** Flip 3 journey statuses: `draft` → `verified` after manual + test verification (only when all checkboxes in each journey verification block are ticked).
- [ ] **T14.** Run `pnpm turbo typecheck` from worktree root — must be 0 errors.
- [ ] **T15.** Commit per logical unit (see Commit Plan below).

## Commit Plan

Atomic commits, conventional format:

1. `feat(lovsen-contract): scaffold @smartout/lovsen-contract package` (T1, T3)
2. `feat(lovsen-contract): add Citation/Confidence/LovsenAnswer/Validation/Classification types` (T2)
3. `chore(lovsen-contract): smoke-import then drop` (T4 — single commit that adds + removes the smoke file is fine if you prefer; otherwise just delete after verifying typecheck and skip this commit)
4. `feat(telemetry): register 9 Lovsen events in registry` (T5-T6)
5. `docs(lovsen): ADR-0256 Lovsen Citation Contract` (T8)
6. `docs(lovsen): ADR-0257 Lovsen Confidence Model` (T9)
7. `docs(lovsen): ADR-0258 Lovsen MCP Boundary` (T10)
8. `docs(lovsen): ADR-0259 Lovsen Capability Authority` (T11)
9. `docs(lovsen): register foundation ADRs in 0000-decision-log` (T12)
10. `docs(lovsen): mark P1.S0 journeys verified` (T13)

Co-author every commit:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] `pnpm --filter @smartout/lovsen-contract build` succeeds
- [ ] `pnpm --filter @smartout/lovsen-contract test` all pass
- [ ] `pnpm --filter @smartout/telemetry test` registry tests for 9 Lovsen events all pass
- [ ] 4 ADRs in `docs/decisions/` with `status: accepted`
- [ ] `0000-decision-log.md` updated with 4 new rows + bumped count
- [ ] No P1.S1+ scope leaks (no MCP code, no skills, no Botsson capability runtime — only types + registrations + ADRs)
- [ ] No new dependencies beyond `zod` (already in monorepo) and existing dev deps
- [ ] No secrets, no env-var additions

## Out-of-Scope (deferred to later sub-sorties)

- Actual MCP server implementations → P1.S1a-d (`mcp-servers/lovdata`, `/mattilsynet`, `/arbeidstilsynet`, `/nho-reiseliv` per README.md)
- Knowledge base / fixture data / test-corpus → P1.S2 (`knowledge/laws/`, `knowledge/collective-agreements/`, `knowledge/internal/test-corpus.md`)
- Skill files (`aml-14-6-validator`, `amendment-classifier`, `contract-drafter`) → P1.S3
- Lovsen persona file `.claude/agents/lovsen.md` → P1.S3 (port from `~/dev/smartout.ai/docs/agents/lovsen-agent/lovsen.md`)
- `industry_intelligence.lovsen_query` capability runtime → P1.S4
- C4 authority seed migration → P1.S4
- Web UI → Phase 3
- Live Lovdata API → Phase 7

## Plan-Time Decisions Locked (PD-1..17)

Per faseplan + Lovsen spec docs. Critical ones for P1.S0:
- **PD-1**: Contract package is the type boundary; everything Lovsen-related imports from `@smartout/lovsen-contract`
- **PD-3**: Citation always carries `hash` (sha256 of verbatim_text) + `fetched_at` (ISO-8601) + `source_url` (Lovdata/Mattilsynet/etc URL)
- **PD-7**: Confidence is computed, never written — derive from `{ citations.length, classification.triggered_rules?, mcp.cache_hit, freshness_window }`. Numeric score AND HØY/MEDIUM/LAV label both required (ADR-0182).
- **PD-12**: Telemetry category is `lovsen` (not `agent` or `industry`) — own slice for downstream filtering and audit retention rules

## Open Decisions Deferred (OD-1..8)

Out of P1.S0 scope. Tracked in faseplan; will resurface in later sub-sorties.
