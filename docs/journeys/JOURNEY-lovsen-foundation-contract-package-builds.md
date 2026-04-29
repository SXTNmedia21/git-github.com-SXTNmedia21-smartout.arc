---
title: "Journey — @smartout/lovsen-contract package builds + types importable"
feature: lovsen-foundation
journey: contract-package-builds
status: draft
verified_at: null
e2e_test: null
created: 2026-04-29
updated: 2026-04-29
module: MODULE_AGENT_SDK
tags: [journey, lovsen, dev-acceptance, p1-s0]
---

# Journey: @smartout/lovsen-contract package builds + types importable

**Role:** developer (downstream P1.S1a-S4 sub-sortie author)

**Precondition:**
- `feat/lovsen-lovsen-foundation` worktree exists at `~/dev/smartout.ai-lovsen-wt-1`
- `pnpm install` runs clean from worktree root
- No `@smartout/lovsen-contract` exists yet

## Happy Path

1. Developer runs `pnpm --filter @smartout/lovsen-contract build` → tsc compiles 5 type files → `dist/` populated
2. Developer runs `pnpm --filter @smartout/lovsen-contract test` → vitest runs 5+ Zod parse tests → all pass
3. Developer adds `import { Citation, LovsenAnswer } from '@smartout/lovsen-contract'` to a downstream package → `pnpm typecheck` resolves the symbols → 0 errors
4. Developer instantiates `Citation.parse({...})` with valid object → returns parsed Citation
5. Developer instantiates `Citation.parse({...})` with missing `hash` field → throws `ZodError` with message naming the missing field

**Postcondition:**
- `packages/lovsen-contract/dist/` exists with `.d.ts` and `.js`
- 5 public types exported: `Citation`, `Confidence`, `LovsenAnswer`, `ValidationResult`, `ClassificationResult`
- Each type is a Zod schema + matching `z.infer<>` TypeScript type
- Downstream sub-sorties (P1.S1a, P1.S1b, P1.S1c, P1.S1d, P1.S2, P1.S3, P1.S4) can `import` types without rebuilding the contract package

## Error Paths

- **Scenario:** `pnpm install` does not pick up the new package → root `pnpm-workspace.yaml` is missing `packages/lovsen-contract` → fix: confirm `packages/*` glob already covers it; if not, add explicit entry
- **Scenario:** Zod schema rejects valid Norwegian paragraph IDs (e.g. `§ 14-6`) → schema regex too strict → fix: relax regex to allow `§ ?\d+(-\d+)?` and add test
- **Scenario:** `pnpm turbo typecheck` from root fails for downstream package using new types → tsconfig path mapping or pkg `exports` field misconfigured → fix: align with sibling pkg pattern (`packages/types/package.json` is the reference)

## Verification

- [ ] Implementation matches the steps above
- [ ] `pnpm --filter @smartout/lovsen-contract build` exits 0
- [ ] `pnpm --filter @smartout/lovsen-contract test` exits 0
- [ ] Smoke import from `packages/ai/src/` typechecks (then file deleted)
- [ ] Manually tested: hand-built Citation object passes parse; broken object throws ZodError

**Mark `status: verified` in frontmatter when all five boxes are checked.**
