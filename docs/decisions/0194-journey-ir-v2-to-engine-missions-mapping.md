---
title: "JourneyIR v2.1 → engine_missions mapping"
id: ADR-0194
status: proposed
layer: decision
created: 2026-04-23
updated: 2026-04-23
module: journey-engine
tags: [journey-ir, engine_missions, engine_stages, cascade, ontology, capability, publish-mission]
---

# ADR-0194: JourneyIR v2.1 → engine_missions mapping

## Context and Problem Statement

`journey.publish_mission` capability (tools.ts:299–344) is a phantom skeleton — returns `ok:true` and emits `journey.run_started` without writing to `engine_missions`. The gap is not effort — it is **ontological**.

JourneyIR (packages/journey-ir/src/types.ts v2.0.0) describes executable Playwright steps: `action`, `assertion`, `timeoutMs`, per-step `gate`/`screenshot`/`description`. `engine_missions` + `engine_stages` (supabase/migrations/20260301200000_engine_tables.sql:19–85) describes agent-conversational coaching: `mode` ∈ {sequential, free, hybrid}, `system_prompt`, per-stage `goal`/`instructions`/`success_criteria` (all NOT NULL), `creative_freedom` 0–1. **IR has no `system_prompt`. IR has no `goal`/`instructions`/`success_criteria`.** A naïve `publish_mission` body cannot bridge these without a deliberate mapping contract.

## Decision Drivers

- L-0126 (ontology-gap-as-ADR-not-effort): two divergent data models require a contract decision, not an implementation ticket.
- Campaign Invariant 11 (this ADR introduces): no phantom capabilities.
- `engine_stages.goal|instructions|success_criteria NOT NULL` — a faithful insert requires real content, not derived placeholders.
- `engine_missions.system_prompt` — drives agent personality; IR has no equivalent concept.
- ADR-0171 (packages/journey-ir canonical) — changes to IR are additive-only per v2 compat guard (L-0117 reinforcement).

## Considered Options

1. **Option A — Extend JourneyIR v2.1 additively.** Add optional `system_prompt?`, `mode? ∈ {sequential,free,hybrid}` at IR root, and per-step `goal?`/`instructions?`/`success_criteria?`/`creative_freedom?`. `publish_mission` body reads these when present, errors when absent, requires author to fill them.
2. **Option B — Deterministic derivation rule.** Derive `goal := step.title`, `instructions := step.action`, `success_criteria := step.assertion`, `mode := 'sequential'` default, `system_prompt := <static fallback>`. No IR change. Quality-loss: `action`/`assertion` are Playwright-step summaries, not agent-coaching language.
3. **Option C — Hybrid.** Require `system_prompt` + `mode` on IR v2.1 (additive fields); derive per-stage text from per-step fields, but require author-supplied `goal`/`instructions`/`success_criteria` overrides before `is_active=true`. Gates "live" state on author enrichment.

## Decision Outcome

Chosen option: **"Option C — Hybrid"**, because:
- Option A pushes all authoring effort onto the IR author in one step — high friction for dev-run-first workflow.
- Option B produces low-quality coaching content that cannot be fixed without breaking IR compat.
- Option C lets `publish_mission` produce a `is_active=false` row immediately (unblocks downstream flows like mission resolution + N-C worker), and gates `is_active=true` on author-supplied content. Matches journey_version lifecycle (draft → ready_test → active).

## Rules & Consequences

### Rules

1. **IR v2.1 additions (proposed for 2.1.0 bump):**
   - IR root: `system_prompt: string` (required in v2.1), `mode: 'sequential' | 'free' | 'hybrid'` (default `'sequential'`).
   - Per-step: `goal?: string`, `instructions?: string`, `success_criteria?: string`, `creative_freedom?: number` (0–1). All optional; when absent, derivation fallback applies.
2. **`publish_mission` body behavior:**
   - Resolve IR → produce `engine_missions` row with `mode`, `system_prompt` from IR root. `workspace_id := ctx.workspaceId`. `id := 'journey_' + slug + '_v' + version`.
   - For each step, produce `engine_stages` row: `goal := step.goal ?? step.title`, `instructions := step.instructions ?? step.action`, `success_criteria := step.success_criteria ?? step.assertion`, `creative_freedom := step.creative_freedom ?? 0.2`.
   - `engine_missions.is_active := false` if any stage used derivation fallback (no author-supplied text); `true` only when every stage has author content.
   - Emit `journey.run_started` ONLY after the row is committed. No emit on rollback.
3. **Backward compat:** v2.0.0 IRs continue to parse; `publish_mission` on v2.0.0 IR produces `is_active=false` rows with all-derived content + explicit marker `{ derived: true }` in `engine_missions.context_source`.
4. **CI gate:** `packages/journey-ir/src/compile.ts` `assertCurrentIrVersion()` accepts `"2.0.0"` and `"2.1.0"` during transition; drops `"2.0.0"` in a follow-up ADR when all stored IRs are upgraded.

### Consequences

- **Good, because:** publish_mission can ship today writing `is_active=false` rows; authors enrich via UI before mission goes live.
- **Good, because:** N-C worker and mission resolution can proceed against inactive missions for dev-run purposes.
- **Good, because:** Additive v2.1 doesn't break existing IR consumers (run_dev, run_guided, Playwright runner).
- **Bad, because:** Two-stage authoring (publish → enrich → activate) is more friction than one-shot publish.
- **Bad, because:** Introduces a semantic distinction between "mission exists" and "mission is active" that UI must surface explicitly (see ADR-0196 invariant 12 — status claims falsifiable).
- **Agent Impact:** Any agent writing a new journey must now supply `system_prompt` + `mode` at IR root. Tools that auto-generate IR from protocols (per ADR-0174) must pick sensible defaults. Authoring UI at `/platform-admin/journeys/versions` gains an "enrich mission" step before the mission goes live.

## References

- ADR-0171 (packages/journey-ir canonical)
- ADR-0173 (four journey capabilities)
- ADR-0178 (JourneyIR v2 schema expansion)
- L-0094 (phantom emit contracts — 5th occurrence context)
- L-0126 (ontology-gap-as-ADR-not-effort)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23
- `packages/ai/src/capabilities/journey/tools.ts:299-344`
- `supabase/migrations/20260301200000_engine_tables.sql:19-85`
- `supabase/migrations/20260318120000_engine_tuning_notes_and_mission_prompt.sql`

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
