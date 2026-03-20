---
title: Learning Log
status: done
updated: 2026-03-20
created: 2026-03-20
module: contracts
tags: [learnings]
---

# Learning Log — contract-enhancements

| #   | Date       | Learning                                                                                                                                                                        | Impact                                              |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | 2026-03-20 | `company.contact_name` doesn't exist on the company table — the actual column is `daglig_leder`. The placeholder `kunde_daglig_leder` has never worked in production.           | Bug fix shipped in this branch                      |
| 2   | 2026-03-20 | `Record<string, string>` indexing returns `string \| undefined` under strict TS — truthiness check in `if` doesn't narrow for assignment. Fix: extract to local variable first. | Pattern for all strict-mode Record access           |
| 3   | 2026-03-20 | `npx supabase gen types` captures npm warnings in stdout. Must redirect stderr: `2>/dev/null >` to get clean output.                                                            | Prevents lint-staged failures on generated files    |
| 4   | 2026-03-20 | Next.js web app needs explicit `@smartout/utils` workspace dependency even when only used via dynamic `import()` — TypeScript still needs the types at compile time.            | Always add workspace deps to consuming package.json |
