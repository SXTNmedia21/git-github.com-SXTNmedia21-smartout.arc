---
title: Learning Log
status: in_progress
updated: 2026-03-02
created: 2026-03-01
module: landing
tags: [learnings]
---

# Learning Log — landing-optimization

module: ai
tags: [learnings]

---

# Learning Log — agent-architecture

| #   | Date       | Learning                                                                                                                                                     | Impact                                     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1   | 2026-03-02 | LazyMotion + `m` component reduces framer-motion bundle by ~60% — use `domAnimation` features for basic animations                                           | Performance                                |
| 2   | 2026-03-02 | `unstable_cache` with `revalidateTag` is the right pattern for DB-driven SSR pages — cache hit on every visit, bust on admin publish                         | Architecture                               |
| 3   | 2026-03-02 | Platform-level tables (no workspace_id) need godmode RLS + anon public-read policies — different pattern from workspace-scoped tables                        | Security                                   |
| 4   | 2026-03-02 | `next/dynamic` for variant code-splitting works at the page level — only active variant JS is loaded                                                         | Performance                                |
| #   | Date       | Learning                                                                                                                                                     | Impact                                     |
| --- | ---------- | -----------------------------------------------------------------------------------------------------------------------------------------------              | ------------------------------------------ |
| 1   | 2026-03-01 | database.types.ts must be regenerated after migration for new tables — use UntypedClient cast as temporary workaround                                        | Type safety gap until migration applied    |
| 2   | 2026-03-01 | navigator.sendBeacon requires Blob with content-type for JSON payloads                                                                                       | Affects session_end reliability            |
| 3   | 2026-03-01 | Supabase JS client `.upsert()` with `onConflict` cannot do partial updates (only full row) — use insert-then-update-on-conflict pattern instead              | Affects visitor upsert logic               |
| 4   | 2026-03-01 | sessionStorage keys work well as once-per-session event guards (scroll thresholds)                                                                           | Reusable pattern for any per-session dedup |
| 5   | 2026-03-01 | React strict mode ESLint: Date.now() in useRef initializer triggers react-hooks/purity — move to useEffect body instead                                      | Affects all hooks with impure ref init     |
| 6   | 2026-03-01 | Supabase join syntax `table!inner(fields)` works for nested joins across FKs — used for session → visitor → user_identity                                    | Enables rich admin data in single query    |
| 7   | 2026-03-02 | user_identity PK is `user_id`, NOT `id` — FK references must use `user_identity(user_id)`                                                                    | Critical: migration fails otherwise        |
| 8   | 2026-03-02 | FK constraint order matters: parent row must exist before child insert. Visitor upsert must run before landing_event insert with visitor_id FK               | Silent failures if order is wrong          |
| 9   | 2026-03-02 | close-feature.sh typecheck gate: `tail -3` misses "successful" when turbo output is short (cached). Use `grep` without tail                                  | Script bug fixed                           |
| 10  | 2026-03-02 | Vault RPCs have inconsistent param names: `upsert_secret(p_name, p_secret, p_description)` vs `delete_vault_secret(secret_name)` — check types               | Must verify RPC signatures before calling  |
| 11  | 2026-03-02 | `as const satisfies readonly T[]` makes the variable readonly — downstream functions accepting `T[]` (mutable) will reject it. Type source as `readonly T[]` | TypeScript array variance trap             |
| #   | Date       | Learning                                                                                                                                               | Impact                                     |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 1   | 2026-03-02 | LazyMotion + `m` component reduces framer-motion bundle by ~60% — use `domAnimation` features for basic animations                                     | Performance                                |
| 2   | 2026-03-02 | `unstable_cache` with `revalidateTag` is the right pattern for DB-driven SSR pages — cache hit on every visit, bust on admin publish                   | Architecture                               |
| 3   | 2026-03-02 | Platform-level tables (no workspace_id) need godmode RLS + anon public-read policies — different pattern from workspace-scoped tables                  | Security                                   |
| 4   | 2026-03-02 | `next/dynamic` for variant code-splitting works at the page level — only active variant JS is loaded                                                   | Performance                                |
| #   | Date       | Learning                                                                                                                                               | Impact                                     |
| --- | ---------- | -----------------------------------------------------------------------------------------------------------------------------------------------        | ------------------------------------------ |
| 1   | 2026-03-01 | database.types.ts must be regenerated after migration for new tables — use UntypedClient cast as temporary workaround                                  | Type safety gap until migration applied    |
| 2   | 2026-03-01 | navigator.sendBeacon requires Blob with content-type for JSON payloads                                                                                 | Affects session_end reliability            |
| 3   | 2026-03-01 | Supabase JS client `.upsert()` with `onConflict` cannot do partial updates (only full row) — use insert-then-update-on-conflict pattern instead        | Affects visitor upsert logic               |
| 4   | 2026-03-01 | sessionStorage keys work well as once-per-session event guards (scroll thresholds)                                                                     | Reusable pattern for any per-session dedup |
| 5   | 2026-03-01 | React strict mode ESLint: Date.now() in useRef initializer triggers react-hooks/purity — move to useEffect body instead                                | Affects all hooks with impure ref init     |
| 6   | 2026-03-01 | Supabase join syntax `table!inner(fields)` works for nested joins across FKs — used for session → visitor → user_identity                              | Enables rich admin data in single query    |
| 7   | 2026-03-02 | user_identity PK is `user_id`, NOT `id` — FK references must use `user_identity(user_id)`                                                              | Critical: migration fails otherwise        |
| 8   | 2026-03-02 | FK constraint order matters: parent row must exist before child insert. Visitor upsert must run before landing_event insert with visitor_id FK         | Silent failures if order is wrong          |
| 9   | 2026-03-02 | close-feature.sh typecheck gate: `tail -3` misses "successful" when turbo output is short (cached). Use `grep` without tail                            | Script bug fixed                           |
| 10  | 2026-03-02 | Supabase migrations with duplicate timestamps silently fail — `db reset` stops at first collision. Must ensure unique timestamps across all migrations | Blocks all migrations after the collision  |
| 11  | 2026-03-02 | Module-level `createOpenRouter()` with `process.env.KEY!` crashes at import time if env var missing — use lazy-init pattern instead                    | Affects any consumer of the package        |
| 12  | 2026-03-02 | Vault `get_secret()` RPC returns null (not error) when secret doesn't exist locally — secrets loading must handle both error and null gracefully       | Stage engine startup resilience            |
