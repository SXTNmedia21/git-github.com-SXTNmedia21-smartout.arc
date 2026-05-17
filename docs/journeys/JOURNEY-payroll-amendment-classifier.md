---
title: "Journey — payroll-amendment-classifier"
status: verified
feature: amendment-classifier
updated: 2026-05-17
created: 2026-05-17
module: ai
tags: [journey, payroll, legal, amendment, aml-14-6, riksavtalen, phase-7e]
---

# Journey — payroll-amendment-classifier

> Phase 7e Track 5. Aml. §14-6 amendment-classifier replaces Phase 7f inline stub.

## Journey: Admin changes tariff binding

**Precondition:** Existing `workspace_union_binding` row, admin invokes `change_workspace_tariff` (via BFF or capability tool).

1. Tool reads prev binding from `payroll.workspace_settings.active_binding_id`
2. Tool builds `next` binding spec from input
3. Tool calls `classifyAmendmentLogic(prev, next, ctx)` — pure function, 10 rules
4. Classifier returns `{classifier, reason, aml_refs[], requires_resigning, notice_period_days}`
5. Classifier output passed to `cascade.bind_workspace_union(amendment_classifier=...)`
6. Cascade atomic switch flow OR cascade rejects with AMENDMENT_BLOCKED if ENDRINGSOPPSIGELSE
7. On success, payroll emit includes classifier output

**Postcondition:** Switch flow respects Aml. §14-6 + Riksavtalen §4 carve-out.

## Classification rules (10 cases, all paragraf-cited)

| # | Scenario | Classifier | Aml. ref | Notice |
|---|---|---|---|---|
| 1 | Same union, same law_version | UP (no-op) | — | null |
| 2 | Stilling/arbeidstid change | ENDRINGSOPPSIGELSE | §14-6 c/d + §15-7 + §15-3 | 30 |
| 3 | Lønn-floor change >15% | ENDRINGSOPPSIGELSE | §14-6 b + §15-7 + §15-3 | 30 |
| 4 | Different union, significant rate delta | ENDRINGSOPPSIGELSE | §14-6 m + §15-7 + §15-3 | 30 |
| 4b | Different union, tariff-info change only | MATERIAL | §14-6 m | null |
| 5 | Lønn-floor reduced | ENDRINGSOPPSIGELSE | §14-6 b + m + §15-7 + §15-3 | 30 |
| 6 | Tariff-bound → not-bound transition | MATERIAL | §14-6 m | null |
| 7 | Riksavtalen revision (carve-out) | UP | Riksavtalen §4 | null |
| 8 | Same union, new law_version | UP | §14-6 b | null |
| 9 | Not-bound → tariff-bound | MATERIAL | §14-6 m | null |
| 10 | Catch-all | MATERIAL | §14-6 m | null |

## Replaced inline stub

`packages/ai/src/capabilities/payroll/tariff-tools.ts:522-528` (baseline commit `ec5201394`):
```ts
// BEFORE (inline heuristic)
const classifier = oldUnionId === input.new_union_id ? "TARIFF_REVISION" : "UNION_CHANGE";
```
```ts
// AFTER
const classification = classifyAmendmentLogic(prev, next, ctx);
// classification.classifier ∈ "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE"
```

## Tests

10/10 amendment-classifier tests pass + 10/10 affected tariff-tools tests pass. Full @smartout/ai suite: 604/604 pass, 6 skipped, 0 failed.
