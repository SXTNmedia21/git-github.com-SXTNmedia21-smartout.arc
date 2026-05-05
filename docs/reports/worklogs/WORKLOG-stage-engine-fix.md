---
title: "Worklog — stage-engine-fix"
status: in_progress
updated: 2026-03-20
created: 2026-03-03
module: ai
tags: [stage-engine, esm, seed]
---

# Worklog — stage-engine-fix

> Branch: `feat/stage-engine-fix` | Worktree: wt-3 | Started: 2026-03-03

## Status: 🟢 Done

## Done

- [x] pnpm install in worktree (node_modules was missing)
- [x] Build packages/types + packages/ai (dist/ was missing)
- [x] Add "type": "module" to packages/types + packages/ai package.json
- [x] Add .js extensions to all 16 relative imports in packages/types/src
- [x] Change stage-engine tsconfig from NodeNext to bundler moduleResolution
- [x] Create .env.local for stage-engine with local Supabase credentials
- [x] Verify Stage Engine starts (port 3010)
- [x] Seed Lise system_prompt on onboarding-interview mission (1056 chars)
- [x] Seed tuning_notes on all 6 stages
- [x] Delete stale onboarding-main stage (order 0)
- [x] Verify stage ordering: 1-6, next_stage chain intact

## Remaining

- [ ] Verify web app still builds with "type": "module" on packages
- [ ] Full typecheck (pnpm turbo typecheck)

## Decisions

| Date       | Decision                                                       | Reason                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-20 | Changed stage-engine moduleResolution from NodeNext to bundler | packages/ai has 169+ imports without .js extensions — changing to bundler avoids requiring .js in all source files while tsx handles runtime resolution transparently             |
| 2026-03-20 | Added "type": "module" to packages/types + packages/ai         | dist/ files use ESM syntax (export/import) — without this, Node.js treats them as CJS and named imports fail at runtime                                                           |
| 2026-03-20 | Added .js extensions to packages/types source imports          | With "type": "module", dist .d.ts re-exports need .js for NodeNext consumers. packages/types only has 16 imports so this was feasible. packages/ai (169+ imports) was left as-is. |

## Log

| Date       | Time  | Event                                                                         |
| ---------- | ----- | ----------------------------------------------------------------------------- |
| 2026-03-03 | 21:12 | Feature started                                                               |
| 2026-03-20 | -     | pnpm install + build resolved initial typecheck errors                        |
| 2026-03-20 | -     | Identified runtime ESM error: "type": "module" missing in packages            |
| 2026-03-20 | -     | Added .js extensions to packages/types, changed stage-engine to bundler       |
| 2026-03-20 | -     | Stage Engine boots on port 3010, secrets loaded from Vault                    |
| 2026-03-20 | -     | Seed SQL executed: system_prompt set, stages updated, onboarding-main deleted |
