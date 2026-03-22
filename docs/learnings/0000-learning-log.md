---
title: Learning Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: [learnings]
---

# Learning Log — website-factory

| #   | Date       | Learning                                                                                       | Impact                                               |
| --- | ---------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | 2026-03-22 | `@smartout/website` package must be in apps/web dependencies for TypeScript resolution         | Fixed 20+ module-not-found errors                    |
| 2   | 2026-03-22 | `.schema("websites")` requires `as any` cast — websites not in generated types                 | Pattern: eslint-disable + cast                       |
| 3   | 2026-03-22 | `company_opening_hours.day_of_week` is 0-indexed (0=Mon, 6=Sun)                                | Caught in plan review, prevented data mismatch       |
| 4   | 2026-03-22 | eslint-disable-next-line only covers the NEXT line — multi-line `as any` needs restructuring   | Use intermediate variable pattern                    |
| 5   | 2026-03-22 | `react-hooks/exhaustive-deps` rule does NOT exist in this project's ESLint config              | Don't add disable comments for non-existent rules    |
| 6   | 2026-03-22 | `@next/next/no-img-element` rule doesn't exist either — agents add phantom rules               | Verify ESLint config before adding disable comments  |
| 7   | 2026-03-22 | React 19 `useRef()` requires explicit `undefined` argument (`useRef<T>(undefined)`)            | Type error without it                                |
| 8   | 2026-03-22 | Barrel import `@smartout/ui` works but `@/components/ui/x` is dominant pattern (94 vs 5 files) | Use `@/components/ui/x` for consistency              |
| 9   | 2026-03-22 | Parallel agent execution (TeamCreate) with 3-4 agents cuts implementation time ~4x             | File boundary isolation is key to avoiding conflicts |
