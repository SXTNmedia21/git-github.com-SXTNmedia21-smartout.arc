---
title: Intent-classifier context — structured-object evolution (Phase A5 v2)
status: done
updated: 2026-04-23
created: 2026-04-23
module: botsson-arena
tags: [botsson, stage-engine, intent-classifier, phase-a5, adr-0112, adr-0193]
---

# HANDOFF — Intent classifier context: string → structured object

## Scope

Phase A5 of `campaign/botsson-arena`. A **second pass** on intent-classifier wiring.

**Context:** Phase A5 originally shipped 2026-04-22 (commit `41a2972b`, PR #240) — it replaced the empty-string call with a `buildClassifierContext()` helper that returned a compact `"Rolle: X. Avdeling: Y."` string. That solved the "signal discarded" bug but left behind a latent phantom-contract shape: callers could still pass `""` and silently lose all context. Two remaining call sites *did* still pass `""` (`golden-transcripts.eval.ts:70`) or unused string literals (test fixtures like `"ctx"`), so the acceptance gate `grep 'classifyIntent("")'` was still tripping on at least one production code path.

This pass widens `classifyIntent(message, context, options?)` from a raw `string` context to a typed `ClassifierContext` object. All call sites now declare their context explicitly — role/department/workspace/channel as honest `T | null` fields, with an escape-hatch `hint` for eval fixtures that carry free-form Norwegian text the structured fields cannot express.

## Why the signature widened

The string shape optimized for the *prompt wire format* (the LLM prompt literally concatenates a Norwegian phrase). The object shape optimizes for the *call-site invariants*:

1. Each axis (role / department / channel / workspaceId) is named and typed.
2. `null` is the only "unknown" — no `""` means-nothing fallbacks.
3. The classifier internalises serialization (`serializeClassifierContext`), so the prompt behaviour is unchanged for populated fields and emits a neutral marker `"(ingen kontekst tilgjengelig)"` instead of a literal empty string when the whole object is null.
4. Workspace/channel were not in the previous helper output — but they arrive at `routeAgentMessage` anyway. Threading them forward costs nothing and lets future classifier rules (voice-vs-chat disambiguation, per-workspace intent priors) read them without a signature churn.

## Files changed

| File | Change |
|------|--------|
| `packages/ai/src/router/intent-classifier.ts` | New `ClassifierContext` type. New `serializeClassifierContext()`. `classifyIntent(message, ctx, options?)` signature widened. Internal prompt assembly uses serialized string. |
| `services/stage-engine/src/core/agent-router.ts` | `buildClassifierContext()` now returns `Promise<ClassifierContext>` (object) instead of `Promise<string>`. Accepts `channel: SessionChannel \| null` param. Honest `role: null` when profile row absent (previously invented `"employee"`). `workspaceId`/`profileId` typed as `NonEmptyString`. |
| `packages/ai/src/router/__tests__/intent-classifier.test.ts` | All `classifyIntent("msg", "ctx")` calls → `classifyIntent("msg", employeeCtx)` / `minimalCtx`. Added two new tests: (a) neutral marker replaces empty-string prompt, (b) `hint` field is propagated verbatim. |
| `packages/ai/src/router/__tests__/intent-classifier-shift-lifecycle.test.ts` | Same migration — shared `employeeCtx` / `managerCtx` / `probeCtx` fixtures at top of file. |
| `packages/ai/src/router/__evals__/intent-classifier.eval.ts` | Eval fixtures pack role+department+extras into a single Norwegian string. Routed through the new `hint` field; structured fields stay `null` so the eval measures classifier behaviour on *unchanged* inputs. |
| `packages/ai/src/__evals__/golden-transcripts.eval.ts` | The `classifyIntent(fx.input.message, "")` call site — the last real empty-string violation — now builds a minimal `ClassifierContext` with the fixture's `channel` populated. This is the line that was tripping the acceptance-gate grep. |
| `services/stage-engine/src/__tests__/agent-router-classifier-context.test.ts` | Updated to assert the object shape: `ctx.role === "admin"`, `ctx.departmentName === "Kjøkken"`, etc. Honesty test: when DB `role` is NULL we now return `role: null`, not the invented `"employee"` default. |
| `services/stage-engine/src/__tests__/agent-router-classifier-context-propagation.test.ts` (**new**) | L-0125-compliant propagation test. Spies on `classifyIntent` and asserts (a) context is an object not a string, (b) role + department come from the mocked profile row, (c) channel + workspaceId come from the caller, (d) context is never `""` and never of type `string`. |

## Before → After at `agent-router.ts`

**Before (landed 2026-04-22, commit `41a2972b`):**

```ts
// agent-router.ts:177
const classifierContext = await buildClassifierContext({
  supabase: supabaseAdmin,
  workspaceId,
  profileId,
});
// => "Rolle: admin. Avdeling: Kjøkken."  (string)

// agent-router.ts:199
const intent = await classifyIntent(message, classifierContext, {
  apiKey: getSecrets().openrouterApiKey ?? undefined,
});
```

**After (this handoff):**

```ts
// agent-router.ts:192
const classifierContext = await buildClassifierContext({
  supabase: supabaseAdmin,
  workspaceId,
  profileId,
  channel: channel ?? null,
});
// => {
//      role: "admin",
//      departmentName: "Kjøkken",
//      workspaceId: "ws-...",
//      channel: "chat",
//    }

// agent-router.ts:215
const intent = await classifyIntent(message, classifierContext, {
  apiKey: getSecrets().openrouterApiKey ?? undefined,
});
```

Internal to `classifyIntent()`, `serializeClassifierContext(ctx)` folds the object into the same Norwegian string the prompt previously received — so the model sees the same text for populated fields. The empty-string edge case now emits `"(ingen kontekst tilgjengelig)"` instead of literally `""`.

## Decisions

- **Keep `hint: string` as an escape hatch.** The eval fixtures in `intent-classifier.eval.ts` pack role + department + ad-hoc workspace hints ("Periode: mars 2026.", "Workspace: hospitality.") into a single Norwegian string. A strict object shape would lose those signals and drop eval accuracy. `hint` lives in the serialized prompt verbatim; the structured fields are preferred for real call sites. If the fixture schema ever gets structured (role/dept columns), we remove `hint` in the same PR.
- **`role: null` is the honest absence.** The previous helper coerced DB `role IS NULL` to the string `"employee"`. That's an invented role. We return `null`. The classifier serializer omits the `Rolle:` line entirely rather than pretend.
- **`workspaceId` typed as `NonEmptyString | null`.** Matches ADR-0193. The helper is called by `routeAgentMessage` which already brands its `workspaceId` via `nonEmpty()`, so the field is never empty-string at runtime even if nominally nullable.
- **Did NOT rename `buildClassifierContext`.** Keeping the name minimises diff churn and keeps the PR focused on the signature widening.

## Tests added / changed

- Existing `agent-router-classifier-context.test.ts` — asserts object shape, `role: null` honesty, workspace isolation, channel pass-through. 6 tests.
- New `agent-router-classifier-context-propagation.test.ts` — 4 tests spying on `classifyIntent` to assert the artefact, not the shape (L-0125 compliant). Fails loudly if any future refactor reintroduces `classifyIntent(msg, "")` or drops fields.
- Existing `intent-classifier.test.ts` — 2 new tests: neutral marker on empty context, `hint` propagation.

## Acceptance-gate checklist

- `grep -rn 'classifyIntent("")' packages/ai/src services/stage-engine/src` → **0 matches**.
- `classifyIntent()` signature is `(string, ClassifierContext, options?)` — all call sites updated.
- No `as any` added. No `?? ""` silent fallback introduced. The single `role ?? null` cast is explicit and narrows to `ProfileRole | null`.
- Typecheck passes scoped: `@smartout/ai`, `@smartout/stage-engine`.
- Unit tests pass scoped: `@smartout/ai test -- intent-classifier`, `@smartout/stage-engine test -- agent-router-classifier-context`.

## Follow-ups

1. **Eval fixtures schema.** `packages/ai/src/router/__evals__/fixtures/_schema.ts` still models `context` as a freeform string. Next pass: promote to structured `role`/`departmentName`/`channel` columns + optional `extra_hint`. That removes the `hint` escape hatch on `ClassifierContext`.
2. **Golden-transcript fixtures.** `packages/ai/src/__evals__/golden-transcripts/_schema.ts` already has `input.profile_id` and `input.channel` — easy win to add `input.role` + `input.department` and populate the structured fields in the eval instead of passing `null`.
3. **Classifier prompt weighs channel.** Currently the prompt does not yet mention voice-vs-chat disambiguation. Now that `ctx.channel` reaches the prompt via `serializeClassifierContext`, a small prompt addendum (ADR-0078-shaped: "voice channels prefer non-PII intents") is a natural next PR.
4. **Remove `buildClassifierContext` default-role fallback in collector.** `packages/ai/src/context/collector.ts` still has a `role ?? "employee"` shape in the downstream `AgentContext`. That is a separate concern from the classifier path, but worth auditing for the same honesty guarantee.

## Phase A5 status in `BOTSSON-SYSTEM-MAP.md`

No colour change needed — A5 was already 🟢 after the 2026-04-22 landing. This pass tightens the type contract but does not change observable pipe behaviour for the happy path. `agent-router.ts` row stays 🟢.
