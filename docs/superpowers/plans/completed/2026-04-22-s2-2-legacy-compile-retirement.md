---
title: "S2.2 Sub-Sortie Brief — retire legacy packages/ai/src/journey/compile.ts"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m2, migrations, adr-0171, atomicity]
---

# S2.2 — Retire legacy `packages/ai/src/journey/compile.ts`

> **Campaign:** journey-engine · **Milestone:** M2 · **Sub-sortie:** S2.2
> **Predecessor:** S2.1 MUST be merged to `campaign/journey-engine` before S2.2 opens a PR. Package cannot be retargeted to a package that doesn't exist.
> **Trust-Gate Unblock closed:** #5 (zero `packages/ai/src/journey` references post-merge).
> **Binding ADR:** 0171 (package path). This sub-sortie is what bumps 0171 to `accepted` (at M2 exit).
> **Gate B council:** Conditional-Go — atomicity wording below is council-mandated verbatim.

---

## Why atomicity matters (CVE-adjacent)

If S2.2 is split across commits, an intermediate state exists where either:
- `packages/ai/package.json` no longer exports `./journey/compile` but the consumer still imports from `@smartout/ai/journey/compile` (typecheck fails, no runtime resolution), OR
- `packages/ai/src/journey/compile.ts` is deleted but the consumer still imports from the old path (runtime ReferenceError in prod).

Turbo + pnpm lint / typecheck will fail between any two of these operations if they run mid-way. The fix is atomic: **one commit, five staged changes, no intermediate lint/typecheck/eslint invocation.**

## Scope — the five operations (one commit)

Stage all five before running any lint, typecheck, or commit.

### Operation 1 — Create `packages/journey-ir/src/compile.ts`

Byte-for-byte copy of `packages/ai/src/journey/compile.ts`. No rename of the function (`compileJourney`), no rename of types (`CompileInput`, `CompileStepInput`, `CompileOutput`). The only change permitted is updating the JSDoc file header comment if it references its old path — check the first 8 lines of the source file and adjust the path reference only if one exists.

Verify with: `diff packages/ai/src/journey/compile.ts packages/journey-ir/src/compile.ts` should show zero diff (or only the header comment change).

### Operation 2 — Re-export from `packages/journey-ir/src/index.ts`

Append to the file from S2.1:

```typescript
export { compileJourney } from "./compile";
export type {
  CompileInput,
  CompileStepInput,
  CompileOutput,
} from "./compile";
```

Do NOT remove `JOURNEY_IR_PACKAGE_VERSION` — it stays for consumers that want to discover the package version at runtime.

### Operation 3 — Repoint consumer

File: `apps/web/src/app/platform-admin/journeys/actions/compile.ts`

Change line 4-8 from:

```typescript
import {
  compileJourney,
  type CompileInput,
  type CompileStepInput,
} from "@smartout/ai/journey/compile";
```

To:

```typescript
import {
  compileJourney,
  type CompileInput,
  type CompileStepInput,
} from "@smartout/journey-ir";
```

**Do NOT touch any other line in this file.** Specifically:
- Line 127 writes `status: "ready_test"` against the OLD `journey_status` enum — pre-existing debt, will be resolved in M3 when generators retarget. Leaving it as-is is intentional. If you're tempted to "fix while you're here," stop — that's out-of-scope per Campaign Invariant.
- Function signature of `compileJourneyAction` stays identical — its component consumer (`apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx:27,551`) imports via relative path and is unaffected.

### Operation 4 — Delete export entry from `packages/ai/package.json`

Remove the `./journey/compile` block from the `exports` map. The entry looks like (near line 149-152):

```json
    "./journey/compile": {
      "types": "./dist/journey/compile.d.ts",
      "default": "./dist/journey/compile.js"
    },
```

Delete the entire 4-line block INCLUDING the trailing comma on the preceding export if it becomes the last entry. Verify the JSON is still valid after deletion: `node -e "require('./packages/ai/package.json')"` should run without error.

### Operation 5 — Delete the legacy directory

```bash
rm packages/ai/src/journey/compile.ts
rmdir packages/ai/src/journey
```

The directory only contains `compile.ts` (verified at Gate B baseline). After rm + rmdir, `packages/ai/src/journey/` no longer exists on disk.

## Commit sequencing (council-mandated verbatim)

> "S2.2 is a single atomic commit. Stage all five operations before committing: (1) write `packages/journey-ir/src/compile.ts`, (2) update the import in `apps/web/src/app/platform-admin/journeys/actions/compile.ts` from `@smartout/ai/journey/compile` to `@smartout/journey-ir`, (3) remove the `./journey/compile` entry from `packages/ai/package.json` exports, (4) delete `packages/ai/src/journey/compile.ts`, (5) delete the `packages/ai/src/journey/` directory. Do NOT run `pnpm lint`, `pnpm typecheck`, or `eslint` between steps — only after all five changes are staged. Do NOT touch any other line in `apps/web/.../actions/compile.ts` beyond the import on line 8. Do NOT rename or alter `compileJourney`'s function signature or `CompileInput`/`CompileOutput` types."

## Out of scope

- **DO NOT** add tests for `compileJourney`. If tests didn't exist before, they aren't this sub-sortie's job to add.
- **DO NOT** refactor compile.ts. Byte-for-byte move only.
- **DO NOT** touch `status: "ready_test"` on line 127 of the consumer — see Operation 3 note.
- **DO NOT** add new exports to `packages/journey-ir/src/index.ts` beyond the three types + one function named above.
- **DO NOT** modify the consumer's TanStack mutation hooks (if any), Server Action structure, or error handling.
- **DO NOT** bump `packages/ai/package.json` version number. The export map change is breaking for unknown callers but the grep confirms zero external callers beyond the one consumer we're repointing in the same commit.
- **DO NOT** touch `CLAUDE.md` to remove the grandfathering language — that happens at M2 exit, not in this sub-sortie.

## Acceptance criteria (exit gates — Trust-Gate Unblock #5 merge gate)

- [ ] **One commit.** `git log --oneline -1` on the feature branch shows exactly one commit for S2.2 (not counting the auto-generated plan stub from `new-feature.sh`).
- [ ] **Grep gate — MERGE BLOCKER:** `grep -Rn "packages/ai/src/journey\|@smartout/ai/journey" apps packages scripts services | grep -v node_modules | grep -v dist | grep -v pnpm-lock.yaml` returns **zero** results.
- [ ] `packages/ai/src/journey/` directory does not exist (verify: `test -d packages/ai/src/journey && echo FAIL || echo OK`).
- [ ] `packages/ai/package.json` `exports` map does NOT contain `./journey/compile`.
- [ ] `packages/journey-ir/src/compile.ts` is byte-identical to the deleted legacy (modulo JSDoc header path ref).
- [ ] `packages/journey-ir/src/index.ts` re-exports `compileJourney` + 3 types.
- [ ] Consumer at `apps/web/src/app/platform-admin/journeys/actions/compile.ts:4-8` imports from `@smartout/journey-ir` (NOT from `@smartout/ai/journey/compile`).
- [ ] Line 127 of the consumer still reads `status: "ready_test"` (unchanged — pre-existing debt preserved).
- [ ] `pnpm turbo typecheck` passes with 0 errors.
- [ ] `pnpm turbo build --filter=@smartout/journey-ir` succeeds.
- [ ] `pnpm turbo build --filter=web` succeeds.
- [ ] Handoff at `docs/HANDOFF-journey-s2-2-legacy-compile-retirement.md`: atomicity explanation, Gate B council citation, byte-diff confirmation of compile.ts move.
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s2-2-legacy-compile-retirement.md`: admin compiles a journey via platform-admin UI → Server Action calls compileJourneyAction → imports resolve via `@smartout/journey-ir` → engine_process upserted.
- [ ] Decision log entry: "ADR-0171 landed — `packages/ai/src/journey` retired; canonical path is `@smartout/journey-ir`. Single atomic commit per Gate B council. Trust-Gate Unblock #5 closed."

## Dispatch

Single build subagent. Brief MUST be supplied with the "Commit sequencing" block verbatim. Return handoff for verification. **Do not dispatch until S2.1 is merged to `campaign/journey-engine` and pushed.**
