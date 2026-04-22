---
title: Handoff — Hospitality Domain Taxonomy
status: done
updated: 2026-04-20
created: 2026-04-20
module: helpdesk-channel
tags: [handoff, helpdesk, taxonomy, phase-2, k1a]
---

# Handoff — Hospitality Domain Taxonomy

> Sub-sortie B of Progressive Channel Phase 2 prereqs. Delivers prereq #3 from the Phase 2 blocked-list in `docs/superpowers/specs/2026-04-20-progressive-channel-design.md` (§Phase 2 — BLOCKED on 4 prerequisites, item 3: "Hospitality domain taxonomy defined as platform artifact (K1a)").

## Summary

Added a platform-level (K1a) hospitality domain taxonomy so the future Phase 2 Botsson classifier can route employee questions to the right helpdesk channel. Ten hospitality-specific domains plus an `other` fallback. Each domain carries a Norwegian label, an admin-facing description, a voice-policy default, and Norwegian seed keywords.

No runtime code consumes the taxonomy yet — the Phase 2 classifier (out of scope for this sub-sortie) will consume it next.

## What shipped

### Types (`packages/types/src/industry.ts`)

- `HospitalityDomain` union type — 11 canonical IDs (`payroll`, `scheduling`, `food_safety`, `bar_operations`, `kitchen_operations`, `service_standards`, `hms_safety`, `hr_personal`, `training`, `equipment`, `other`).
- `Domain` type — five fields: `id`, `label`, `description`, `default_voice_allowed`, `keywords`.
- `IndustryPackage.domains` — optional field (existing packages without domains do not break).

Re-exported through `@smartout/types` index via the existing `industry.js` barrel.

### Data (`packages/ai/src/industry/packages/hospitality.ts`)

- `HOSPITALITY_DOMAINS: Domain[]` — top-level constant (exported) with all 11 entries.
- `hospitalityPackage.domains` — set to `HOSPITALITY_DOMAINS`.

### Data (`packages/ai/src/industry/packages/default.ts`)

- `defaultPackage.domains: []` — empty array. Classifier treats this as "no domain routing configured" and falls back to capability-level routing.

### Tests (`packages/ai/src/industry/__tests__/domains.test.ts`)

- 28 tests, all passing.
- Guards: shape (required fields + primitive types), unique IDs, voice-policy invariants for PII-adjacent domains, non-empty keywords on non-fallback domains, lowercase keyword contract, `other` presence, non-hospitality empty-array contract.

## Decisions made

### D1 — Voice-policy defaults (PII-sensitive domains)

**Decision:** `payroll`, `hr_personal`, `hms_safety`, and `other` all default to `default_voice_allowed: false`.

- `payroll` and `hr_personal` are obvious PII per ADR-0078 / ADR-0163 (lønn = lønnsopplysninger; HR = personlige forhold).
- `hms_safety` is a judgment call: it bundles skade/brann/evakuering (safety-critical, arguably voice-OK) AND sykemelding (helseopplysning, PII). Chose the conservative default (voice-forbidden) because the taxonomy cannot distinguish sub-intents. Admins who want voice for fire/evacuation on a given channel override via `channel_ai_policy.voice_participation`.
- `other` defaults to voice-forbidden because it is the "I don't know what this is" bucket — the safest default when uncertain is to refuse voice and fall through to the clarifying-question flow (Phase 2 proper).

No ADR written — defaults are spec-derived and reversible without schema changes. If the Phase 2 classifier surfaces a real need to split `hms_safety` into `hms_incident` (voice-OK) vs `hr_sick_leave` (voice-forbidden), that is an additive ADR at Phase 2 proper time.

### D2 — `domains` is optional on `IndustryPackage`

**Decision:** `domains?: Domain[]` — not required.

- Non-hospitality verticals (default, future retail) may not have a domain taxonomy defined yet.
- Keeps the type change additive — no call site that touches `IndustryPackage` today needs to change.
- `defaultPackage` still declares `domains: []` explicitly for clarity and to keep the test contract tight.

### D3 — `other` is part of the canonical list, not synthesized

**Decision:** `other` appears as a regular entry in `HOSPITALITY_DOMAINS` rather than being injected by the classifier.

- Gives the classifier a stable, well-typed fallback that carries the same shape as every other domain.
- Makes the voice-policy default for "unknown" explicit and testable (`default_voice_allowed: false`).
- Keeps the "every domain has a description" invariant intact — `other`'s description documents its fallback semantics.

### D4 — Keywords are seed terms, not regex rules

**Decision:** Keywords are documented as a lowercase, non-exhaustive seed list for classifier prompt context; the classifier remains LLM-based, not keyword-matching.

- Keywords serve three purposes: (a) inject into the classifier prompt so the LLM grounds its decision, (b) interpretability anchor for admins reading the taxonomy in docs/UI, (c) cold-start fallback if a future offline classifier needs deterministic bootstrap.
- Lowercase contract enforced by test so future additions stay consistent.

## Learnings

- The hospitality package already uses `as const` heavily for tariff / shift templates, but `Domain` objects need real mutable array typing for `Domain[]`. Mixing `as const` with a typed array-of-object declaration created no friction here because we declared `HOSPITALITY_DOMAINS: Domain[]` directly and accepted the wider mutable type.
- The Phase 2 spec explicitly rejects `channel.domain_tags text[]` on the channel table (ADR-0165 §What is explicitly rejected). Storage model for per-channel domain selection is deferred to Phase 2 proper — likely `channel_ai_policy` extension or a sibling table. This sub-sortie defines *what domains exist*, not *how channels opt into them*.

## Known issues / debt

- **No consumer yet.** The taxonomy ships without a runtime consumer. This is intentional — the Phase 2 classifier (prereq #4) is the next sub-sortie and will consume this. If the Phase 2 classifier slips, the taxonomy sits dormant but does no harm.
- **`hms_safety` is ambiguous.** Bundles safety incidents (voice-OK) and sick leave (PII). Documented as voice-forbidden by default with admin override path. Revisit if real-world routing shows this is too coarse.
- **No i18n extraction.** Labels and descriptions are Norwegian literals. Smartout is Norwegian-only today so this is acceptable, but a future i18n migration will need to extract these strings.
- **No per-channel tagging UI.** Journey docs describe the admin flow, but Phase 2 proper ships the actual UI and storage.
- **Retail vertical has no taxonomy.** Only `hospitality` defines domains; `default` declares empty. When retail lands, a separate sub-sortie will need to add `RETAIL_DOMAINS` following this same pattern.

## Next steps (Phase 2 proper — different sub-sortie)

1. Extend `packages/ai/src/router/intent-classifier.ts` to consume `domains` from the workspace industry package.
2. Add domain + confidence fields to the classifier output schema.
3. Build the clarifying-question flow for below-threshold matches.
4. Build the channel-tagging UI + storage (probably extends `channel_ai_policy`).
5. Wire the `text_participation='proactive'` listener (per ADR-0165 §5 + L-0086) to the classifier.

## Verification

- `pnpm --filter @smartout/types build` — passes.
- `pnpm --filter @smartout/ai typecheck` — passes.
- `pnpm --filter @smartout/ai test -- domains.test` — 28/28 passing.

## References

- Spec: `docs/superpowers/specs/2026-04-20-progressive-channel-design.md`
- ADR: `docs/decisions/0165-progressive-channel-discriminator.md`
- ADR: `docs/decisions/0078-engine-process-channel-restriction.md`
- ADR: `docs/decisions/0163-adr-0078-amendment-pii-allowedchannels-mandatory.md`
- Learning: `docs/learnings/0086-channel-ai-policy-half-wired.md`
