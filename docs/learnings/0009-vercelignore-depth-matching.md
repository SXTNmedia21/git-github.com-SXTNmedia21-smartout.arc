---
id: "0009"
title: .vercelignore patterns without leading / match at any depth
date: 2026-02-28
tags: [vercel, gitignore, build, monorepo]
---

# Learning-0009: .vercelignore patterns without leading / match at any depth

## Context

After setting up Vercel projects, builds failed with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`. The workspace package list was empty despite all files being in the repo.

## Discovery

`.vercelignore` uses gitignore syntax. Without a leading `/`, patterns match at **any depth** in the file tree:

| Pattern    | Excludes                                                                |
| ---------- | ----------------------------------------------------------------------- |
| `docs/`    | `docs/` AND `apps/landing/src/app/docs/` AND any other `docs/` anywhere |
| `/docs/`   | Only root `docs/`                                                       |
| `agents/`  | `agents/` AND `packages/ai/src/agents/`                                 |
| `/agents/` | Only root `agents/`                                                     |

Our `.vercelignore` had `docs/` and `agents/` without anchors. This silently deleted:

- `apps/landing/src/app/docs/` — breaking the landing page build
- `packages/ai/src/agents/` — breaking the `@smartout/ai` package build

The pnpm workspace error was a cascading failure from missing source files.

## Impact

- **Always anchor `.vercelignore` patterns with leading `/`** when targeting root-level directories
- The error message (`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`) gave no hint about missing source files — debugging required understanding gitignore semantics
- Same rule applies to `.dockerignore` and any gitignore-syntax file

## References

- File: `.vercelignore`
- ADR-0020: Vercel Hosting with Dual-Project Split
