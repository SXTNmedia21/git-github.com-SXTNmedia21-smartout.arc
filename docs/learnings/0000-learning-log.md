---
title: Learning Log
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: landing
tags: [learnings]
---

# Learning Log — landing-optimization

| #   | Date       | Learning                                                                                                                              | Impact       |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | 2026-03-02 | LazyMotion + `m` component reduces framer-motion bundle by ~60% — use `domAnimation` features for basic animations                    | Performance  |
| 2   | 2026-03-02 | `unstable_cache` with `revalidateTag` is the right pattern for DB-driven SSR pages — cache hit on every visit, bust on admin publish  | Architecture |
| 3   | 2026-03-02 | Platform-level tables (no workspace_id) need godmode RLS + anon public-read policies — different pattern from workspace-scoped tables | Security     |
| 4   | 2026-03-02 | `next/dynamic` for variant code-splitting works at the page level — only active variant JS is loaded                                  | Performance  |
