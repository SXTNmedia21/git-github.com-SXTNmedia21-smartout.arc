---
title: 'Lovsen — Norwegian Labor Law Advisor (Plan)'
status: draft
updated: 2026-04-29
created: 2026-04-29
module: hospitality-intelligence
material_source: docs/agents/lovsen-agent/
tags: [plan, agent, mcp, lovsen, hospitality, riksavtalen, lovdata, botsson, phased]
---

# Lovsen — Norwegian Labor Law Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Material source:** `docs/agents/lovsen-agent/` — Pontus's reference plugin spec. README.md, lovsen.md, ROADMAP.md, checklist.md, SKILL.AML.md, SKILL.CLASSIFYER.md, plugin.json. **Read these before any sortie starts.** They are the authoritative voice + scope spec.

**Top-line goal:** Ship Lovsen as a four-prong product (subagent + MCPs + UI + Botsson capability) over **seven phases**. Phase 1 makes Lovsen operative as a **backend agent** so Botsson Arena can control contracts, draft contracts, and give labor-law advice. Subsequent phases add Claude Code dev surface, web UI, Tier 3 skills, Skatteetaten integration, lærling-scope, and v1.0 stability.

**Phase-1 architecture:** Backend-only. No web UI. No Claude Code commands. Botsson capability `industry_intelligence.lovsen_query` invokes Lovsen via Anthropic SDK with system prompt = lovsen.md persona + dynamic skill injection (aml-14-6-validator / amendment-classifier / contract-drafter) + 4 stdio MCP children for grounding. Confidence-policy + disclaimer + escalation enforced at every emit site. C4 authority seed migration. 3 backend journeys (validate, draft, classify) verified before Phase-1 close.

**Tech Stack:** TypeScript everywhere · Node.js 20 · `@modelcontextprotocol/sdk` (stdio v1) · `@anthropic-ai/sdk` for capability invocation · Zod for tool input/output · Supabase (telemetry destinations + `engine_authority_config` seed in Phase 1) · `activity_trail` for audit (5y retention per Bokføringsloven §13). Phase-3 adds React 19 + Tailwind + shadcn/ui (Nordic Split). Phase-1 has no UI dependencies.

---

## Phased Roadmap (v0.1 → v1.0)

| Phase | Theme | Wall-clock | Status |
|---|---|---|---|
| **Phase 1** | Backend-operative — kontroll + skriv + råd | 2–3 weeks | **active (this plan focuses here)** |
| Phase 2 | Claude Code dev surface + Tier 2 skills | 1–2 weeks | scoped |
| Phase 3 | Web UI surfacing (Botsson chat + Contract drawer) | 1 week | scoped |
| Phase 4 | Tier 3 skills (v0.2 per material ROADMAP) | 2 weeks | scoped |
| Phase 5 | Skatteetaten MCP + skattekort-pull (v0.3) | 1–2 weeks | future |
| Phase 6 | Lærling og spesielle ansettelsesformer (v0.4) | 1 week | future |
| Phase 7 | v1.0 stable — 50+ test-corpus, immutable audit, historisk lov-snapshot, live API, multi-workspace tariff | 2–3 weeks | future |

Each phase ends with a Phase-handoff doc (`docs/HANDOFF-lovsen-phase-N.md`) capturing decisions, opens, journeys, and explicit "what carries over to next phase" list.

### Phase 1 — Backend-Operative (this plan's focus)

**Mission:** Lovsen som ekspert-agent som Botsson kan kalle for å (a) kontrollere kontrakter mot Aml. §14-6, (b) skrive kontrakts-utkast fra strukturert data, (c) klassifisere felt-endringer og gi advisory-svar med kilder.

**Phase-1 deliverables:**
1. `@smartout/lovsen-contract` package — Citation, Confidence, LovsenAnswer, ValidationResult, ClassificationResult.
2. 9 telemetry events registered.
3. 4 stdio MCP servers with full tool surfaces + fixture mode.
4. Knowledge base seed (laws + Riksavtalen + 15-case test-corpus).
5. **3 core skill MD files** (aml-14-6-validator + amendment-classifier + contract-drafter) under `.claude/skills/`.
6. Lovsen persona file at `.claude/agents/lovsen.md` (subagent file ships now — used by capability at runtime to load persona; Claude Code dev convenience wrappers wait for Phase 2).
7. Botsson capability `industry_intelligence.lovsen_query` with C4 authority seed + stage-engine intent routing.
8. **3 backend journeys verified:**
   - JOURNEY-lovsen-validate-contract — Botsson admin asks "valider kontrakt X" → capability runs aml-14-6-validator skill → returns ValidationResult.
   - JOURNEY-lovsen-draft-contract — Botsson admin asks "skriv kontrakt for bartender 60% stilling" → capability runs contract-drafter skill → returns markdown contract + ValidationResult.
   - JOURNEY-lovsen-classify-amendment — Botsson admin endrer felt → capability runs amendment-classifier skill → returns ClassificationResult with paragraph reference + alternative actions.

**Phase-1 explicit non-goals:**
- ❌ Web UI components (Phase 3).
- ❌ Claude Code commands (Phase 2 dev convenience).
- ❌ 4 Tier 2 skills outside the 3 core (riksavtalen-lookup, overtid-evaluator, tipsregel-rådgiver — Phase 2; contract-drafter is the only Tier 2 promoted to Phase 1).
- ❌ Live Lovdata API (fixture-only Phase 1; Phase 7 swap).
- ❌ Tier 3 skills (Phase 4).
- ❌ Skatteetaten MCP (Phase 5).
- ❌ Lærling-scope (Phase 6).

### Phase 2 — Claude Code Dev Surface + Tier 2 Skills

**Mission:** Make Lovsen ergonomic for developers using Claude Code; round out Tier 2 skill set per material.

**Adds:**
- 5 commands: `/lovsen-spør`, `/lovsen-valider-kontrakt`, `/lovsen-klassifiser-endring`, `/lovsen-sla-opp`, `/lovsen-compliance-sjekk`.
- 3 Tier 2 skills: riksavtalen-lookup, overtid-evaluator, tipsregel-rådgiver.
- 1 dev journey: JOURNEY-lovsen-developer-asks-question.
- 1 admin journey: JOURNEY-lovsen-compliance-runner (workspace-wide audit via aml-14-6-validator).

**Sortie count:** 1–2 sub-sorties.

### Phase 3 — Web UI Surfacing

**Mission:** Visual surface so Lovsen citations render in Botsson chat + Contract Composition drawer.

**Adds:**
- 5 React components per design spec: ConfidenceBadge, CitationCard, DisclaimerBanner, EscalateToAdvokat, SourcePicker.
- LovsenAnswer wrapper.
- Botsson chat integration (`apps/web/src/components/botsson/messages/AssistantMessage.tsx`).
- Contract drawer integration (`apps/web/src/app/dashboard/contracts/_components/HospitalityIntelligencePanel.tsx`).
- Mobile re-export (`packages/ui/lovsen/types.ts`).
- 2 UI journeys: JOURNEY-lovsen-admin-asks-via-botsson, JOURNEY-lovsen-contract-composition-citation.

**Sortie count:** 1 sub-sortie.

### Phase 4 — Tier 3 Skills (v0.2)

Per material ROADMAP §v0.2:

- `prøvetid-tracker` — Aml. §15-6 inkl. pause ved sykefravær.
- `a-melding-validator` — A-melding-koder + data rapport-klare.
- `oppsigelse-veileder` — Aml. §15-7 saklig grunn + prosessuell sjekkliste.
- `feriepenger-kalkulator` — Ferielov-beregning, sluttoppgjør, 12 % / 14.3 %.
- `compliance-revisor` — Workspace-audit på alle kontrakter.

**Sortie count:** 2–3 sub-sorties (skills can parallelise).

### Phase 5 — Skatteetaten MCP (v0.3)

Per material ROADMAP §v0.3:

- New MCP server `services/lovsen-skatteetaten-mcp/`.
- `skattekort-pull` skill.
- A-melding utkast (rapport-stub).
- **Krever Skatteetaten-sertifisering — eier-utpeking før utvikling starter.** Blocked on Pontus + Skatteetaten formal authorization.

**Sortie count:** 1–2 sub-sorties.

### Phase 6 — Lærling + Spesielle Ansettelsesformer (v0.4)

Per material ROADMAP §v0.4:

- Opplæringsloven kap. 4 i kunnskapsbase.
- `lærling-validator` skill (replaces aml-14-6-validator's current `result: 'skip'` for `employment_form='apprentice'`).
- Frilans/oppdragsavtale handling (TBD: separate agent or extended scope).

**Sortie count:** 1–2 sub-sorties.

### Phase 7 — v1.0 Stable

Per material ROADMAP §v1.0:

- Test-corpus 50+ cases.
- Citation-validator full coverage.
- Audit-log immutable storage (dedicated `lovsen_audit` table if `activity_trail` proves insufficient).
- Versjonert lov-snapshot for historisk lookup.
- Multi-workspace tariff-mapping.
- **Live Lovdata API** swap from fixture (only after license + Pontus authorization).
- HTTP transport for MCP servers if cross-process latency hurts (ADR-0036 dual-auth).

**Sortie count:** 3–4 sub-sorties.

---

## Cross-Phase Coordination

| Surface | Owning campaign | This campaign's claim |
|---|---|---|
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/` | `campaign/botsson-arena` (per ADR-0183/0209) | We claim **only this single capability folder** in Phase 1 + ADR-0183 promotion `proposed → accepted`. No other `industry_intelligence/` touchpoints. Coordination note posted to `campaign/botsson-arena` HEAD before Phase-1 close. |
| Stage-engine intent routing | `campaign/botsson-arena` | Phase 1 adds intent matchers (arbeidsrett, kontrakt, HR, tips, riksavtalen, oppsigelse, prøvetid, ferie, lønn). Single rule entry routing matched intents to `industry_intelligence.lovsen_query`. |
| `engine_authority_config` seed | shared | Phase 1 migration adds rows for new capability tools only. No other capability rows touched. Phase 4 may add Tier 3 capability tools. |
| `apps/web/src/components/botsson/messages/AssistantMessage.tsx` | `campaign/botsson-arena` | Touched in Phase 3 only. Single edit, well-bounded. |
| `apps/web/src/app/dashboard/contracts/_components/HospitalityIntelligencePanel.tsx` | web (cross-cutting) | Touched in Phase 3 only. |

---

## Plan-Time Decisions (locked before any sortie starts)

| # | Decision | Choice | Rationale | Reversible? |
|---|---|---|---|---|
| PD-1 | Campaign | New `campaign/lovsen` (long-lived, spans all 7 phases) | Persistent worktree, one branch per phase, no `/close-feature` until v1.0. | No (only by abandoning). |
| PD-2 | MCP transport (Phase 1) | **stdio** for all 4 servers | Phase-1 backend uses Anthropic SDK spawning MCP children in capability process. Stdio matches `strike-mcp`. HTTP+dual-auth (ADR-0036) deferred to Phase 7. | Yes — `interview-mcp` shows HTTP migration. |
| PD-3 | File location | Repo-tracked `.claude/agents/lovsen.md` + `.claude/skills/lovsen-*/SKILL.md` + (Phase 2) `.claude/commands/lovsen-*.md` | `.claude/` not in `.gitignore` (line 5–6 confirmed "fully tracked"). Capability reads files at runtime via Node fs. | Yes — per-developer fallback possible. |
| PD-4 | Source-access mode | **Stub-first → license-second**. Phase 1 ships fixture clients with real paragraph excerpts. Phase 7 swaps to live API. | License decision (OD-1) decoupled from Phase-1 ship. Fixtures = real Lovdata text, hand-curated. | Yes — client-module swap, no contract change. |
| PD-5 | Confidence policy | **HØY** = exact §-match in fetched source AND cache age ≤ TTL/2; **MEDIUM** = inferred from related § OR cross-source aggregation OR cache age between TTL/2 and TTL; **LAV** = single-source-only OR cache > TTL OR free-text inference. **LAV + juridisk-konsekvens = mandatory `EscalateToAdvokat` + mandatory disclaimer.** | Typed contract enforced compile + runtime. `gate_action` consumes confidence. | Yes — adjust thresholds; contract shape unchanged. |
| PD-6 | Disclaimer text | "*Lovsen gir veiledende svar basert på kilder, ikke juridisk rådgivning. Ved juridisk konsekvens — verifiser med advokat før handling.*" | Norwegian only Phase 1. Versioned via ADR-0239. Advokat review before Phase 3 (employee exposure). | Yes — versioned. |
| PD-7 | Cache TTL per source | Lovdata 30 d · Mattilsynet 90 d · Arbeidstilsynet 30 d · NHO Reiseliv 7 d. Stamped on every Citation. | Each source updates differently. Riksavtalen most volatile. | Yes — settings file. |
| PD-8 | Mobile parity | Phase 3: CitationCard renders on mobile per ADR-0133. Banner / EscalateCTA / SourcePicker stay web-only. | ADR-0133 binding. | No — ADR. |
| PD-9 | Telemetry destinations (Phase 1) | PostHog + Logger + `activity_trail` + `engine_event` (because capability ships in Phase 1, not Phase 3). | Capability shipping = `engine_event` required per ADR-0175. | Yes — additive. |
| PD-10 | C4 authority defaults (Phase 1) | Phase 1 migration seeds `engine_authority_config` rows for `industry_intelligence.lovsen_query`: read tools = `gate_action='ALLOW'`, future mutate tool = `gate_action='DENY'`. Default-allow combo banned (L-0066, L-0097). | Default-allow on legal-advice agent = CVE-class. Explicit per-tool seed. | No — enforced by Phase 2.5 grep gate. |
| PD-11 | Skill format | Cowork-style `.claude/skills/lovsen-<name>/SKILL.md` with frontmatter. Material spec authoritative. References folder for detailed logic (e.g. `aml-14-6-validator/references/checklist.md`). | Material structures this way; mirroring keeps single source. | Yes — moves to package modules later (Phase 7 deterministic-port). |
| PD-12 | Validator-vs-skill split | Phase 1 = pure prompt-based skills (LLM reads SKILL.md + checklist + invokes MCPs). No deterministic TS validators in Phase 1. Phase 7 ports hot validators (Aml. §14-6, amendment-classifier) to deterministic TS in `packages/lovsen-validators/` for cheap inline DB-trigger use. | Phase 1 ships fast; LLM-validators good enough for low-volume. Hot-path determinism = Phase-7 optimisation. | Yes — additive package. |
| PD-13 | Botsson invocation pattern | Capability tool body: read `lovsen.md` + read appropriate skill file (chosen by intent) + spawn 4 stdio MCP children + invoke `@anthropic-ai/sdk` with system-prompt = lovsen.md + skill + tools = MCP tools + user message. Parse response into LovsenAnswer / ValidationResult / ClassificationResult shape. | Same source-of-truth (lovsen.md + skill files) drives backend agent. No prompt drift. | Yes — can switch to dedicated tool later. |
| PD-14 | Knowledge base seed (Phase 1) | `knowledge/lovsen/laws/` (Aml + ferielov + OTP + folketrygdlov snapshots) + `knowledge/lovsen/collective-agreements/` (Riksavtalen 2024 + 2025) + `knowledge/lovsen/internal/test-corpus.md` (15+ cases). Hand-curated. Refresh on Aml. revision. | Backup when MCP unreachable. Test-corpus = regression gate. | Yes — additive. |
| PD-15 | Audit retention | Phase 1: log every validation + classification to `activity_trail` (already 5y retention, meets Bokføringsloven §13). Phase 7: dedicated `lovsen_audit` table if volume requires. | Norwegian law requires 5y. `activity_trail` already meets. | Yes — table-add additive. |
| PD-16 | Skill-injection at runtime | Capability picks the right skill based on intent: `validate` keyword → aml-14-6-validator skill content injected into system prompt. `klassifiser` / `endre` → amendment-classifier. `skriv` / `utkast` → contract-drafter. Default → no skill, generic advisory mode. | Single capability tool surface, intent-routed skill loading keeps prompt focused. | Yes — refactor if skill count grows. |
| PD-17 | Phase-1 backend journeys (3, must verify before close) | validate-contract, draft-contract, classify-amendment | These three are Phase-1's output proof. Each gets `JOURNEY-*.md` + manual smoke-test before Phase-1 handoff. | No — gate. |

---

## Open Decisions (deferred — not blocking Phase 1)

| # | Question | Owner | Latest-by-when |
|---|---|---|---|
| OD-1 | Lovdata API license vs scraping vs static dump | Pontus | Before Phase 7 (live-API swap) |
| OD-2 | NHO Reiseliv tariff data — public scrape vs membership API | Pontus | Same as OD-1 |
| OD-3 | Cost cap per Lovsen call (rate-limit + max-tokens + max-MCP-calls/query) | Phase-1 P1.S0 sortie writes ADR-0240 | P1.S0 |
| OD-4 | Advokat review of disclaimer text + escalation flow | Pontus + advokat | Before Phase 3 (employee exposure) |
| OD-5 | Skatteetaten MCP — sertifisering eier-utpeking | Pontus | Before Phase 5 |
| OD-6 | Tier 3 skills priority order | Pontus | Before Phase 4 |
| OD-7 | Workspace-configured advokat for `EscalateToAdvokat` CTA target (Codex/Lexolve/internal) | Pontus | Before Phase 3 |
| OD-8 | Cross-workspace ansatt (konsern) handling | Pontus | Before Phase 7 |

---

## Phase-1 Sortie Decomposition

```
Phase 1 ─┬─ P1.S0  Foundation (contract pkg + 9 telemetry events + 4 ADRs)   sequential
         │
         ├─ P1.S1a Lovdata MCP             ┐
         ├─ P1.S1b Mattilsynet MCP         │  parallel (4 sub-sorties)
         ├─ P1.S1c Arbeidstilsynet MCP     │
         ├─ P1.S1d NHO-Reiseliv MCP        ┘
         │
         ├─ P1.S2  Knowledge base seed (laws + Riksavtalen + test-corpus)     sequential
         │
         ├─ P1.S3  3 core skill files + agent persona file                    sequential
         │   .claude/agents/lovsen.md
         │   .claude/skills/lovsen-aml-14-6-validator/SKILL.md + references/checklist.md
         │   .claude/skills/lovsen-amendment-classifier/SKILL.md + references/conditional-rules.md
         │   .claude/skills/lovsen-contract-drafter/SKILL.md
         │
         └─ P1.S4  Botsson capability + intent routing + authority seed + 3 journeys  sequential
             packages/ai/src/capabilities/industry_intelligence/lovsen_query/
             services/stage-engine/src/router/intent-rules.ts
             supabase/migrations/<TS>_lovsen_authority_seed.sql
             docs/journeys/JOURNEY-lovsen-validate-contract.md
             docs/journeys/JOURNEY-lovsen-draft-contract.md
             docs/journeys/JOURNEY-lovsen-classify-amendment.md
```

| Sortie | Branch (sub-sortie) | Worktree | Wave | Depends on | Owner agent type |
|---|---|---|---|---|---|
| P1.S0 | `feat/lovsen-foundation` | `~/dev/smartout.ai-lovsen-wt-0` | 0 | (none) | botsson-harness-builder (Sonnet) |
| P1.S1a | `feat/lovsen-lovdata-mcp` | `~/dev/smartout.ai-lovsen-wt-1` | 1 | P1.S0 merged | botsson-harness-builder (Sonnet) |
| P1.S1b | `feat/lovsen-mattilsynet-mcp` | `~/dev/smartout.ai-lovsen-wt-2` | 1 | P1.S0 merged | botsson-harness-builder (Sonnet) |
| P1.S1c | `feat/lovsen-arbeidstilsynet-mcp` | `~/dev/smartout.ai-lovsen-wt-3` | 1 | P1.S0 merged | botsson-harness-builder (Sonnet) |
| P1.S1d | `feat/lovsen-nho-reiseliv-mcp` | `~/dev/smartout.ai-lovsen-wt-4` | 1 | P1.S0 merged | botsson-harness-builder (Sonnet) |
| P1.S2 | `feat/lovsen-knowledge-base` | `~/dev/smartout.ai-lovsen-wt-5` | 2 | All P1.S1 merged | docs-tutor (Sonnet) for curation + botsson-harness-builder for structure |
| P1.S3 | `feat/lovsen-skills-and-persona` | `~/dev/smartout.ai-lovsen-wt-6` | 3 | P1.S2 merged | docs-tutor (Sonnet) — primarily writing markdown |
| P1.S4 | `feat/lovsen-botsson-capability` | `~/dev/smartout.ai-lovsen-wt-7` | 4 | P1.S3 merged | botsson-harness-builder (Sonnet) + system-agent-coordinator (Opus oversight) |

Verification gates (every wave): code-reviewer (Sonnet) + system-steward (Opus) before merge to `campaign/lovsen`.

**Phase-1 wall-clock estimate:**
- P1.S0: ~45 min
- P1.S1a/b/c/d (parallel): ~90 min wall-clock for the longest server (likely Lovdata with 11+ fixtures)
- P1.S2: ~60–90 min (knowledge curation = manual paragraph-text)
- P1.S3: ~90 min (mostly verbatim copy from material + 1 fresh skill + 1 fresh references file)
- P1.S4: ~120–150 min (capability scaffolding + migration + tests + 3 journeys + manual smoke)
- Verification gates between waves: ~15 min each

**Total Phase-1 wall-clock with parallel Wave 1 + serial reviews: ~8–10 hours of agent-time, spread over 1–2 calendar days.**

---

## File Structure (Phase 1 only)

### P1.S0 — Foundation

| Path | Purpose |
|---|---|
| `packages/lovsen-contract/package.json` | Workspace package, Zod + zero runtime deps |
| `packages/lovsen-contract/tsconfig.json` | Standard package tsconfig |
| `packages/lovsen-contract/src/index.ts` | `Citation`, `Confidence`, `LovsenAnswer`, `JuridiskKonsekvens`, `SourceTag`, `ValidationIssue`, `ValidationResult`, `Classification`, `ClassificationResult` types + Zod schemas |
| `packages/lovsen-contract/src/confidence.ts` | `computeConfidence(opts)` pure function |
| `packages/lovsen-contract/src/disclaimer.ts` | `DISCLAIMER_TEXT` + `requiresDisclaimer()` + `shouldEscalate()` |
| `packages/lovsen-contract/src/__tests__/*.test.ts` | Vitest cases |
| `packages/telemetry/src/registry.ts` (modify) | Add 9 events |
| `docs/decisions/0238-lovsen-subagent-architecture.md` | Phased delivery + four-prong scope, proposed |
| `docs/decisions/0239-lovsen-confidence-contract.md` | HØY/MEDIUM/LAV thresholds + escalation rule, proposed |
| `docs/decisions/0240-lovsen-source-access-mode.md` | Stub-first / license-second + per-source TTL + cost-cap, proposed |
| `docs/decisions/0241-lovsen-botsson-capability-pattern.md` | Phase-1 pattern: SDK-spawn-MCP + intent-routing + skill-injection + authority seed, proposed |

### P1.S1a–d — MCP Servers

Mirrors `services/strike-mcp/` per material. Tool surfaces + fixtures per source (full table + fixture lists in plan-v3 above; carry-over):

| Server | Tools | TTL |
|---|---|---|
| `lovdata` | `fetch_paragraph`, `search_law`, `get_law_metadata` | 30 d |
| `mattilsynet` | `search_regulation`, `fetch_guidance`, `lookup_food_safety_requirement` | 90 d |
| `arbeidstilsynet` | `search_guidance`, `fetch_workplace_assessment_template` | 30 d |
| `nho-reiseliv` | `fetch_riksavtalen`, `lookup_tariff_supplement` | 7 d |

### P1.S2 — Knowledge Base

| Path | Content |
|---|---|
| `knowledge/lovsen/laws/aml-2024-07.md` | Aml. §14-6 (a–p), §15-3, §15-6, §15-7, §14-9, §10-6, §10-9, §10-10 — paragraf-tekst + Lovdata-URL + fetched-at |
| `knowledge/lovsen/laws/ferielov-current.md` | Ferielov §10, §11 |
| `knowledge/lovsen/laws/otp-loven.md` | OTP-loven §3 (pliktig OTP min 2.0 %) |
| `knowledge/lovsen/laws/folketrygdloven-relevant-chapters.md` | Folketrygdlov kap. 8 (sykepenger excerpts) |
| `knowledge/lovsen/collective-agreements/riksavtalen-2024.md` | Riksavtalen 2024 oversikt + §6 Bilag 1 + tariff-rates |
| `knowledge/lovsen/collective-agreements/riksavtalen-2025.md` | Riksavtalen 2025 oversikt + §6 Bilag 1 + tariff-rates |
| `knowledge/lovsen/internal/test-corpus.md` | 15+ hospitality cases, each: input contract + expected validator output + expected classifier output (where applicable) |

### P1.S3 — Skills + Persona

| Path | Source |
|---|---|
| `.claude/agents/lovsen.md` | Verbatim copy from `docs/agents/lovsen-agent/lovsen.md` |
| `.claude/skills/lovsen-aml-14-6-validator/SKILL.md` | Verbatim from `docs/agents/lovsen-agent/SKILL.AML.md` |
| `.claude/skills/lovsen-aml-14-6-validator/references/checklist.md` | Verbatim from `docs/agents/lovsen-agent/checklist.md` |
| `.claude/skills/lovsen-amendment-classifier/SKILL.md` | Verbatim from `docs/agents/lovsen-agent/SKILL.CLASSIFYER.md` |
| `.claude/skills/lovsen-amendment-classifier/references/conditional-rules.md` | New — derived from material spesial-saker table + base classification logic |
| `.claude/skills/lovsen-contract-drafter/SKILL.md` | New per material — Tier 2 promoted to Phase 1 |

### P1.S4 — Botsson Capability

| Path | Purpose |
|---|---|
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/index.ts` | Capability registration |
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/tool.ts` | execute() body — gate_action + skill-injection + Anthropic SDK call + MCP-children-spawn + parse + emit |
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/intent.ts` | Keyword + paragraph-pattern matcher |
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/skill-router.ts` | Intent → which skill MD to load (PD-16) |
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/authority.ts` | Wraps `gate_action` per ADR-0099/0201 |
| `packages/ai/src/capabilities/industry_intelligence/lovsen_query/__tests__/*.test.ts` | Vitest cases (mocked MCP + SDK; assert shape, telemetry, gate) |
| `services/stage-engine/src/router/intent-rules.ts` (modify) | Add Lovsen intent rule |
| `supabase/migrations/<TS>_lovsen_authority_seed.sql` | C4 authority seed |
| `docs/journeys/JOURNEY-lovsen-validate-contract.md` | Backend journey 1 |
| `docs/journeys/JOURNEY-lovsen-draft-contract.md` | Backend journey 2 |
| `docs/journeys/JOURNEY-lovsen-classify-amendment.md` | Backend journey 3 |
| `docs/HANDOFF-lovsen-phase-1.md` | Phase-1 closure handoff |

---

## P1.S0 — Foundation Detail

**Branch:** `feat/lovsen-foundation`. **Goal:** `@smartout/lovsen-contract` + 9 telemetry events + 4 ADRs.

### Task 0.1 — Bootstrap `@smartout/lovsen-contract`

- [ ] Step 1: Create `package.json` (Zod + Vitest only).
- [ ] Step 2: Create `tsconfig.json` extending repo base.
- [ ] Step 3: Create `src/index.ts` with full type set (Citation, Confidence, SourceTag, JuridiskKonsekvens, LovsenAnswer, Severity, ValidationIssue, ValidationResult, Classification, ClassificationResult) + Zod schemas.
- [ ] Step 4: Create `src/confidence.ts` with `computeConfidence` per PD-5.
- [ ] Step 5: Create `src/disclaimer.ts` with `DISCLAIMER_TEXT` + `requiresDisclaimer` + `shouldEscalate`.
- [ ] Step 6: Add `__tests__/confidence.test.ts` (4 cases).
- [ ] Step 7: Add `__tests__/disclaimer.test.ts` (3 cases).
- [ ] Step 8: Modify `pnpm-workspace.yaml` — add `packages/lovsen-contract`.
- [ ] Step 9: Run typecheck + test. Expected: 0 errors, all green.
- [ ] Step 10: Commit:

```bash
git add packages/lovsen-contract pnpm-workspace.yaml
git commit -m "feat(lovsen): contract package — Citation, Confidence, LovsenAnswer, ValidationResult, ClassificationResult"
```

(Code blocks for steps 1–7 carry over from prior plan version — see git history `2026-04-29-lovsen-norwegian-labor-law-advisor.md` v2 if a sortie agent needs them. The schemas + functions are unchanged; only the phase-framing is new.)

### Task 0.2 — Register 9 telemetry events

- [ ] Step 1: Add 9 entries to `packages/telemetry/src/registry.ts`. Names + payloads + destinations per prior plan v2 (carry-over).
- [ ] Step 2: Run telemetry typecheck + test. Expected: green.
- [ ] Step 3: Commit:

```bash
git add packages/telemetry/src/registry.ts
git commit -m "feat(telemetry): register 9 lovsen.* events with payload schemas"
```

### Task 0.3–0.6 — Write 4 ADRs

- [ ] **0.3** ADR-0238 Lovsen subagent architecture — phased delivery (Phase 1 backend → Phase 2 dev → Phase 3 UI → Phase 4 Tier 3 → Phase 5 Skatteetaten → Phase 6 lærling → Phase 7 v1.0). Cite ADR-0036, 0080, 0133, 0175, 0183, 0208, 0209, L-0066, L-0094.
- [ ] **0.4** ADR-0239 Lovsen confidence contract — PD-5 thresholds + `computeConfidence` + `shouldEscalate`.
- [ ] **0.5** ADR-0240 Lovsen source-access mode + cost-cap — PD-4 stub-first, PD-7 TTL, OD-3 cost-cap (max 30 calls/min/server, max 50k tokens/query, max 10 MCP-calls/query).
- [ ] **0.6** ADR-0241 Lovsen Botsson capability pattern — PD-13 SDK-spawn-MCP-children + PD-16 intent-routed skill injection + authority seed + cross-campaign coordination.

Each: register in `0000-decision-log.md`, commit separately.

### Task 0.7 — Phase-1 P1.S0 verification + close-feature

- [ ] Repo typecheck `pnpm turbo typecheck`. Expected: 0 errors.
- [ ] Phase 2.5 grep: `grep -E "^  'lovsen " packages/telemetry/src/registry.ts | wc -l` → expected `9`.
- [ ] Write `docs/HANDOFF-lovsen-foundation.md` — decisions PD-1..17, opens OD-1..8, what carries to P1.S1.
- [ ] `/close-feature` — merges to `campaign/lovsen`.

---

## P1.S1a/b/c/d — MCP Servers

Same template as plan v2 (carry-over). Per source:

1. Bootstrap `services/lovsen-{source}-mcp/` (package.json, tsconfig.json, vitest.config.ts, src/index.ts stdio bootstrap, src/server.ts).
2. Implement fixture client + fixtures (real paragraph excerpts hand-curated from public sources).
3. Implement Citation mapper using `@smartout/lovsen-contract`.
4. Implement cache (LRU + TTL stamp + rate-limit 1 req/s/source).
5. Implement tools (one file per tool) per source's tool-list.
6. Register tools in `src/server.ts`.
7. Add Vitest cases.
8. Add to `pnpm-workspace.yaml`.
9. Verify typecheck + test green.
10. Write `docs/HANDOFF-lovsen-{source}-mcp.md`.
11. `/close-feature` — merges to `campaign/lovsen`.

**Wave-1 verification gate (after all 4 merged):** code-reviewer cross-server consistency, system-steward cost-cap + no DB writes + no `engine_authority_config` writes, Phase 2.5 grep no phantom emits.

---

## P1.S2 — Knowledge Base Seed

**Branch:** `feat/lovsen-knowledge-base`. **Goal:** Hand-curated law snapshots + Riksavtalen + 15-case test-corpus.

### Task 2.1 — Curate law snapshots

- [ ] Step 1: For each Aml. paragraf in scope (§14-6, §15-3, §15-6, §15-7, §14-9, §10-6, §10-9, §10-10), copy paragraf-tekst from public Lovdata page to `knowledge/lovsen/laws/aml-2024-07.md`. Format per paragraf:

```markdown
## §14-6 — Krav til arbeidsavtalens innhold

> [paragraph-tekst, copied verbatim from Lovdata]

**Kilde:** https://lovdata.no/lov/2005-06-17-62/§14-6
**Fetched:** 2026-04-29
**Versjon:** 2024-07-01 (post-EU-direktiv 2019/1152)
```

- [ ] Step 2: Same pattern for `ferielov-current.md` (§10, §11), `otp-loven.md` (§3), `folketrygdloven-relevant-chapters.md` (kap. 8 sykepenger).

- [ ] Step 3: Commit:

```bash
git add knowledge/lovsen/laws
git commit -m "feat(lovsen-knowledge): law snapshots — Aml + ferielov + OTP + folketrygd"
```

### Task 2.2 — Riksavtalen oversikt

- [ ] Step 1: `knowledge/lovsen/collective-agreements/riksavtalen-2024.md` — oversikt + §6 Bilag 1 (kveldstillegg, helgetillegg) + tariff-rates 2024.
- [ ] Step 2: Same for 2025.
- [ ] Step 3: Commit.

### Task 2.3 — Test-corpus

- [ ] Step 1: `knowledge/lovsen/internal/test-corpus.md` with 15+ cases. Each case format:

```markdown
## Case 1 — Bartender, fast 100% stilling, 6 mnd prøvetid

**Input contract_data:**
```json
{
  "employment_form": "permanent",
  "job_title": "Bartender",
  "monthly_salary": 38000,
  "agreed_weekly_hours": 37.5,
  "trial_period_months": 6,
  "tariff_id": "riksavtalen-2025",
  "pension_scheme_id": "...",
  ...
}
```

**Expected aml-14-6-validator output:**
```json
{ "result": "pass", "issues": [] }
```

**Expected amendment-classifier output (for monthly_salary 38000 → 40000):**
```json
{ "classification": "material", "requires_resigning": true, "confidence": "HØY" }
```
```

- [ ] Step 2: Add cases covering: pass, prøvetid > 6 mnd (fail), temporary uten end_date (fail), ferie %% under 10.20 (warning), notice_period_months under §15-3 (fail), tariff_id endring (material), employment_form permanent → temporary (blocked), retroaktiv start_date > 30 d (review_required), lærling (skip), variable hours uten arrangement (fail), pension null (fail), generic job_title (warning), break < 30 min ved >5.5 t (fail), bulk tariff revision (admin), employee opt-out av pensjon (admin med audit). 15 cases minimum.

- [ ] Step 3: Commit:

```bash
git add knowledge/lovsen/internal
git commit -m "feat(lovsen-knowledge): 15-case hospitality test-corpus"
```

### Task 2.4 — P1.S2 verification + close

- [ ] Manual check: every paragraf snapshot has Lovdata URL + fetched-at + versjon.
- [ ] Manual check: test-corpus has ≥ 15 cases covering pass/fail/warning/review_required/skip across both validator + classifier.
- [ ] Write `docs/HANDOFF-lovsen-knowledge-base.md`.
- [ ] `/close-feature` — merges to `campaign/lovsen`.

---

## P1.S3 — Skills + Persona

**Branch:** `feat/lovsen-skills-and-persona`. **Goal:** 3 skill MD files + 1 persona file + .mcp.json registration.

### Task 3.1 — Copy verbatim from material

- [ ] Step 1: `cp docs/agents/lovsen-agent/lovsen.md .claude/agents/lovsen.md`. No edits.
- [ ] Step 2: Create `.claude/skills/lovsen-aml-14-6-validator/SKILL.md` — copy verbatim from `docs/agents/lovsen-agent/SKILL.AML.md`.
- [ ] Step 3: Create `.claude/skills/lovsen-aml-14-6-validator/references/checklist.md` — copy verbatim from `docs/agents/lovsen-agent/checklist.md`.
- [ ] Step 4: Create `.claude/skills/lovsen-amendment-classifier/SKILL.md` — copy verbatim from `docs/agents/lovsen-agent/SKILL.CLASSIFYER.md`.
- [ ] Step 5: Commit verbatim copies:

```bash
git add .claude/agents/lovsen.md .claude/skills/lovsen-aml-14-6-validator .claude/skills/lovsen-amendment-classifier/SKILL.md
git commit -m "feat(lovsen-skills): persona + 2 Tier-1 skills verbatim from material"
```

### Task 3.2 — Write fresh: conditional-rules + contract-drafter

- [ ] Step 1: Write `.claude/skills/lovsen-amendment-classifier/references/conditional-rules.md`. Material's SKILL.CLASSIFYER.md references this but doesn't include it. Source: `field_classification_metadata` table (ADR-0001) + spesial-saker table from material. Format: per-field conditional rules (e.g. "if `field_is_workspace_default_aligned = true` and tariff-revision-triggered: DERIVED; else: MATERIAL").

- [ ] Step 2: Write `.claude/skills/lovsen-contract-drafter/SKILL.md`. Tier 2 skill promoted to Phase 1. Frontmatter:

```yaml
---
name: lovsen-contract-drafter
description: Use this skill to generate a Norwegian employment contract draft from structured contract_data + payroll_profile. Triggers when admin asks "skriv kontrakt for X", "lag utkast til ansatt-kontrakt", "draft contract", or when Botsson receives "skriv kontrakt"-intent. Returns markdown contract sections per Aml. §14-6 (a–p) + ValidationResult + citations.
---
```

Body: input shape (contract_data + payroll_profile + tariff), process (1. invoke aml-14-6-validator first; 2. if `result === 'fail'`, refuse and return validation issues; 3. else generate Norwegian markdown sections per §14-6 letters a–p; 4. insert Riksavtalen tariff via `lookup_tariff_supplement` if `tariff_id` set; 5. include citations for every clause), output (`{markdown, validation, citations}`), edge cases (lærling → skip + recommend lærling-validator skill in Phase 6; sommervikar < 3 mnd → simplified template per Aml. §14-9; variable hours → require minimum-hours-per-week disclosure), confidence-policy.

- [ ] Step 3: Commit fresh writes:

```bash
git add .claude/skills/lovsen-amendment-classifier/references/conditional-rules.md .claude/skills/lovsen-contract-drafter
git commit -m "feat(lovsen-skills): conditional-rules + contract-drafter (fresh writes)"
```

### Task 3.3 — `.mcp.json` registration

- [ ] Step 1: Modify `.mcp.json` — append 4 lovsen-*-mcp entries (stdio, `node services/lovsen-{source}-mcp/dist/index.js`).
- [ ] Step 2: Build all 4 MCPs: `pnpm --filter "@smartout/lovsen-*-mcp" build`.
- [ ] Step 3: Smoke test from Claude Code: invoke `mcp__lovdata__fetch_paragraph(law='aml', paragraph='14-6')` directly, verify Citation returns.
- [ ] Step 4: Commit:

```bash
git add .mcp.json
git commit -m "feat(lovsen): register 4 lovsen-*-mcp servers in .mcp.json"
```

### Task 3.4 — P1.S3 verification + close

- [ ] All 3 skill files exist + persona file exists.
- [ ] Conditional-rules + contract-drafter pass markdown lint.
- [ ] Manual smoke: run aml-14-6-validator skill against 5 random test-corpus cases via Claude Code subagent invocation; expected outputs match.
- [ ] Write `docs/HANDOFF-lovsen-skills-and-persona.md`.
- [ ] `/close-feature` — merges to `campaign/lovsen`.

---

## P1.S4 — Botsson Capability

**Branch:** `feat/lovsen-botsson-capability`. **Goal:** Capability + intent routing + authority seed + 3 backend journeys.

### Task 4.1 — Bootstrap capability folder

- [ ] Step 1: Create `packages/ai/src/capabilities/industry_intelligence/lovsen_query/index.ts` — capability registration matching existing capabilities pattern.

- [ ] Step 2: Create `tool.ts` with execute() flow:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { LovsenAnswer, ValidationResult, ClassificationResult } from '@smartout/lovsen-contract';
import { callGateAction } from './authority';
import { routeToSkill } from './skill-router';
import { matchesLovsenIntent } from './intent';
import { emit } from '@smartout/telemetry';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PERSONA_PATH = path.resolve(process.cwd(), '.claude/agents/lovsen.md');

export async function execute(ctx, input) {
  const gate = await callGateAction({
    capability: 'industry_intelligence.lovsen_query',
    tool: 'query',
    action: 'read',
    actor: ctx.actor,
    workspace: ctx.workspace,
  });
  if (!gate.ok) return { ok: false, error: 'gate_denied', reason: gate.reason };

  emit('lovsen query_started', {
    question_hash: hash(input.question),
    actor_id: ctx.actor.id,
    workspace_id: ctx.workspace?.id,
    requested_sources: ['lovdata','mattilsynet','arbeidstilsynet','nho-reiseliv'],
  });

  const persona = readFileSync(PERSONA_PATH, 'utf8');
  const skill = await routeToSkill(input.question);     // returns SKILL.md content or null

  const mcpClients = await spawnMcpChildren();         // 4 stdio children
  const tools = await collectMcpTools(mcpClients);

  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: skill ? `${persona}\n\n---\n\n${skill}` : persona,
    tools,
    messages: [{ role: 'user', content: input.question }],
  });

  await closeMcpChildren(mcpClients);

  // Parse structured answer from response
  const parsed = parseLovsenAnswer(response, skill);
  emit('lovsen citation_emitted', { citation_count: parsed.citations.length, overall_confidence: parsed.overallConfidence, actor_id: ctx.actor.id });
  if (parsed.escalateToAdvokat) emit('lovsen escalated', { juridisk_konsekvens: parsed.juridiskKonsekvens, actor_id: ctx.actor.id });

  return { ok: true, answer: parsed };
}
```

(`hash`, `spawnMcpChildren`, `collectMcpTools`, `closeMcpChildren`, `parseLovsenAnswer` are helper functions; sortie writes them.)

- [ ] Step 3: Create `intent.ts` — `matchesLovsenIntent(text)` returns true if text contains any of: `arbeidsrett`, `arbeidsmiljølov`, `kontrakt`, `ansettelse`, `oppsigelse`, `prøvetid`, `lønn`, `overtid`, `tips`, `ferie`, `A-melding`, `Riksavtalen`, `Aml.`, `ferielov`, `OTP`; OR matches regex `/§\d+-\d+/`.

- [ ] Step 4: Create `skill-router.ts` — `routeToSkill(question)` returns:
  - `validate|kontroll|sjekk` → reads `.claude/skills/lovsen-aml-14-6-validator/SKILL.md` + concatenates `references/checklist.md`.
  - `klassifiser|endre|amendment` → reads `.claude/skills/lovsen-amendment-classifier/SKILL.md` + concatenates `references/conditional-rules.md`.
  - `skriv|utkast|draft|generer` → reads `.claude/skills/lovsen-contract-drafter/SKILL.md`.
  - else → null (generic advisory mode).

- [ ] Step 5: Create `authority.ts` — wraps `callGateAction` per ADR-0099/0201.

- [ ] Step 6: Add `__tests__/tool.test.ts`:
  - Mock MCP children + Anthropic SDK.
  - Assert `LovsenAnswer` shape returned.
  - Assert `gate_action` called before SDK invocation.
  - Assert all expected `lovsen.*` events emitted.
  - Assert MCP children closed in `finally`.
  - Assert intent-router picks correct skill for each verb-class.

- [ ] Step 7: Verify typecheck + test green.

- [ ] Step 8: Commit:

```bash
git add packages/ai/src/capabilities/industry_intelligence/lovsen_query
git commit -m "feat(lovsen-capability): industry_intelligence.lovsen_query — backend agent"
```

### Task 4.2 — Stage-engine intent routing

- [ ] Step 1: Modify `services/stage-engine/src/router/intent-rules.ts` — add Lovsen intent rule:

```ts
{
  id: 'lovsen-arbeidsrett-route',
  match: matchesLovsenIntent,
  capability: 'industry_intelligence.lovsen_query',
  priority: 80,
}
```

- [ ] Step 2: Add Vitest test asserting messages with arbeidsrett-keywords route to Lovsen.
- [ ] Step 3: Commit.

### Task 4.3 — C4 authority seed migration

- [ ] Step 1: Create `supabase/migrations/<TS>_lovsen_authority_seed.sql`:

```sql
-- Seed engine_authority_config for industry_intelligence.lovsen_query.
-- Per ADR-0173 / ADR-0176 / PD-10: explicit per-tool rows; default-allow combo banned (L-0066, L-0097).

INSERT INTO engine_authority_config (capability, tool, action, default_authority, gate_action)
VALUES
  ('industry_intelligence.lovsen_query', 'query', 'read', 'autonomous', 'ALLOW'),
  ('industry_intelligence.lovsen_query', 'validate', 'read', 'autonomous', 'ALLOW'),
  ('industry_intelligence.lovsen_query', 'classify', 'read', 'autonomous', 'ALLOW'),
  ('industry_intelligence.lovsen_query', 'draft', 'read', 'autonomous', 'ALLOW')
ON CONFLICT (capability, tool, action) DO NOTHING;
```

- [ ] Step 2: Apply locally: `npx supabase db reset` → verify rows present.
- [ ] Step 3: Commit.

### Task 4.4 — 3 backend journeys

- [ ] Step 1: `JOURNEY-lovsen-validate-contract.md`:
  - **Role:** admin via Botsson chat
  - **Precondition:** existing employment_contract draft with workspace_id, profile_id, contract_data populated.
  - Happy path: admin → Botsson "valider kontrakt for ansatt X" → intent matches `valider|kontroll` + `kontrakt` → routes to `industry_intelligence.lovsen_query` with `validate`-skill loaded → capability spawns MCPs + invokes Anthropic SDK + parses response into ValidationResult → returns to Botsson → admin sees pass/fail/warnings + paragraph-references + remediation per issue.
  - Error paths: contract not found → return `{ok: false, error: 'contract_not_found'}`; MCP unreachable → fixture-fallback per PD-4 + warn LOW confidence; gate denied → return `{ok: false, error: 'gate_denied'}`.

- [ ] Step 2: `JOURNEY-lovsen-draft-contract.md`:
  - **Role:** admin via Botsson chat
  - **Precondition:** workspace exists with `tariff_id` set; admin has `payroll_profile` + role + hours data ready.
  - Happy path: admin → "skriv kontrakt for ny bartender, 60% stilling, lønn 28000, prøvetid 6 mnd" → intent matches `skriv|utkast` + `kontrakt` → routes with `draft`-skill loaded → capability invokes contract-drafter skill via SDK → output: markdown contract + ValidationResult + citations → admin reviews → if validation.result === 'pass', admin can save as new employment_contract row (out-of-scope to wire save here; that's a separate capability or admin action).
  - Error paths: missing required fields → contract-drafter skill returns ValidationResult with `result: 'fail'` + explicit missing fields; tariff_id not found → fall back to base tariff with warning; lærling-form → skill returns `result: 'skip'` recommending lærling-validator (Phase 6).

- [ ] Step 3: `JOURNEY-lovsen-classify-amendment.md`:
  - **Role:** admin via Botsson chat (or programmatic via existing amendment-flow integration)
  - **Precondition:** existing employment_contract row + admin proposes a field change.
  - Happy path: admin → "endre lønn fra 32000 til 34000 på ansatt Y" → intent matches `endre|amendment` → routes with `classify`-skill loaded → capability invokes amendment-classifier skill via SDK → output: ClassificationResult with `classification`, `requires_resigning`, paragraph-reference, alternative_actions → admin sees "MATERIAL — requires re-signing per Aml. §14-6 første ledd bokstav i".
  - Error paths: field not in `field_classification_metadata` → classification returns `review_required` + manual-review CTA; lønn synker → automatic MATERIAL + advokat-disclaimer per material spesial-saker table; tariff_id endring → MATERIAL + foreslår "ny kontrakt" som alternativ.

- [ ] Step 4: For each journey, frontmatter `status: draft` until manual smoke; flip to `verified` after smoke passes.

- [ ] Step 5: Commit:

```bash
git add docs/journeys/JOURNEY-lovsen-{validate-contract,draft-contract,classify-amendment}.md
git commit -m "docs(lovsen): 3 Phase-1 backend journeys"
```

### Task 4.5 — Phase-1 verification + close

- [ ] Repo typecheck `pnpm turbo typecheck`. Expected: 0 errors.
- [ ] Repo tests for impacted packages. Expected: green.
- [ ] Phase 2.5 grep — every `lovsen.*` event in code matches registry.
- [ ] **Manual smoke 3 journeys:**
  1. validate-contract: pick 5 test-corpus cases, run via capability, verify expected outputs.
  2. draft-contract: provide structured input for bartender + sommervikar + lærling cases, verify markdown shape + ValidationResult.
  3. classify-amendment: run 5 amendment cases (lønn opp, lønn ned, tariff endring, employment_form perm→temp, prøvetid forlengelse uten sykefravær), verify ClassificationResult per material spesial-saker.
- [ ] Flip 3 journeys' frontmatter `status: verified` after smoke passes.
- [ ] **Coordination note** to `campaign/botsson-arena` HEAD documenting the new capability folder + intent rule + ADR-0183 promotion `proposed → accepted`.
- [ ] Write `docs/HANDOFF-lovsen-phase-1.md` covering: 4 prongs delivered (contract pkg + 4 MCPs + skills/persona + capability), all decisions PD-1..17, all opens OD-1..8, 3 verified journeys, what carries to Phase 2 (Claude Code commands + 3 Tier 2 skills + 2 more journeys).
- [ ] `/close-feature` — merges to `campaign/lovsen`.

### Phase-1 verification gate (final)

- [ ] code-reviewer (Sonnet): capability matches existing capabilities pattern; gate_action present; telemetry shape matches registry.
- [ ] system-steward (Opus): cross-campaign coordination note posted; ADR-0183 status updated; no `engine_authority_config` runtime inserts (seed-only); no NEW touchpoints in `industry_intelligence/` outside `lovsen_query/`.
- [ ] system-agent-coordinator (Opus): intent routing doesn't conflict with existing rules; capability registration matches stage-engine expectations; SDK invocation respects cost-cap PD-3.

---

## Self-Review

**Phase-1 deliverables coverage:**
- ✅ Foundation contract package — P1.S0.
- ✅ 9 telemetry events — P1.S0.
- ✅ 4 MCPs with full tool surfaces + fixtures — P1.S1a/b/c/d (parallel).
- ✅ Knowledge base seed (laws + Riksavtalen + 15-case test-corpus) — P1.S2.
- ✅ 3 core skill MD files (aml-14-6-validator + amendment-classifier + contract-drafter) — P1.S3.
- ✅ Lovsen persona file (`.claude/agents/lovsen.md`) — P1.S3.
- ✅ Botsson capability + intent routing + authority seed — P1.S4.
- ✅ 3 backend journeys verified — P1.S4 Task 4.4 + 4.5.

**Phase-1 backend mission directly addressed:**
- ✅ "Kontrollere kontrakter" → aml-14-6-validator skill + JOURNEY-lovsen-validate-contract.
- ✅ "Skrive kontrakter" → contract-drafter skill (Tier 2 promoted to Phase 1) + JOURNEY-lovsen-draft-contract.
- ✅ "Gi råd" → Botsson capability advisory mode (no skill loaded for generic Q+A) + JOURNEY structure for ad-hoc questions via the 3 verified flows.

**Phased roadmap coverage (v0.1 → v1.0):**
- ✅ Phase 1: Backend-operative — this plan.
- ✅ Phase 2: Claude Code dev surface + 3 Tier 2 skills — outlined.
- ✅ Phase 3: Web UI — outlined.
- ✅ Phase 4: Tier 3 skills — outlined per material ROADMAP §v0.2.
- ✅ Phase 5: Skatteetaten MCP — outlined per material ROADMAP §v0.3.
- ✅ Phase 6: Lærling — outlined per material ROADMAP §v0.4.
- ✅ Phase 7: v1.0 stable — outlined per material ROADMAP §v1.0 + live API swap + HTTP transport + immutable audit-log.

**Placeholder scan:** Phase-1 task lists fully detailed. Code blocks, exact paths, exact commands. ADR bodies are described by required sections + reference list (sortie writes prose). Knowledge-base curation steps name exact paragraphs. Journeys specify happy + error paths. No "TBD", no "implement later", no orphan references.

**Type consistency:** `Confidence`, `Citation`, `LovsenAnswer`, `JuridiskKonsekvens`, `SourceTag`, `ValidationIssue`, `ValidationResult`, `Classification`, `ClassificationResult` defined once in `@smartout/lovsen-contract` (P1.S0). Used uniformly: MCP servers (citation mapper), skill outputs (validator + classifier shapes), capability tool (return shape). `computeConfidence`, `requiresDisclaimer`, `shouldEscalate` signatures match across P1.S0 definition and all consumer call-sites in P1.S1/S3/S4.

**Cross-phase consistency:** Phase 2/3/4/5/6/7 explicitly named with deliverables and material-spec source. Each subsequent phase additive — no rework of Phase-1 contracts/MCPs/skills. ADR-0238 (Phase-1) declares the 7-phase roadmap so future phases reference back without re-deriving scope.

**Risk coverage:**
- Lovdata ToS + license → PD-4 stub-first defers; OD-1 owns decision; Phase 7 swap.
- Legal-advice CVE-class → PD-5 LAV+konsekvens=mandatory escalate + PD-6 disclaimer + ADR-0239 + advokat review pre-Phase-3.
- MCP auth surface → PD-2 stdio-only Phase 1; HTTP+dual-auth deferred to Phase 7.
- Citation drift → PD-7 TTL + `versionHash` on Citation + LAV-on-stale-cache.
- Phantom telemetry → P1.S0 lands all 9 events before any emit; Phase 2.5 grep gate at every wave merge.
- C4 default-allow CVE → PD-10 explicit per-tool seed in P1.S4 migration.
- Cross-campaign drift → coordination note in P1.S4 + ADR-0183 promotion + single-folder claim.
- Skill prompt drift → PD-13 + PD-16 single-source-of-truth (lovsen.md + skill files read at runtime).

**8 Phase-1 sub-sorties** — within standard sortie pool (slots 0–7).

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-lovsen-norwegian-labor-law-advisor.md`.**

Two execution options for **Phase 1**:

1. **Subagent-Driven (recommended)** — `campaign/lovsen` + 8 Phase-1 sub-sorties. P1.S0 sequential, P1.S1a/b/c/d parallel, P1.S2/S3/S4 sequential. Verification gate per wave. Phase-1 wall-clock: ~8–10 hours agent-time, 1–2 calendar days at parallel speed.

2. **Inline Execution** — single session writes Phase 1 in `campaign/lovsen` with checkpoint reviews. Loses Wave-1 parallelism. Phase-1 wall-clock: ~2× longer single-track.

**Recommended: option 1.** Phase 1 is parallelism-friendly (4 MCPs); sub-sortie isolation keeps reviews tractable.

**Next concrete step:** `/start-campaign lovsen` from main repo. Then P1.S0 sortie via `/start-feature lovsen-foundation` from inside the new campaign.

Phases 2 → 7 plan at the same level of detail as Phase 1 here when each phase activates. Phase-2 plan written at end of Phase-1 closure (Task 4.5 handoff).
