---
id: "0010"
title: Vercel Turborepo monorepo — Root Directory is app dir, not monorepo root
status: canonical
date: 2026-02-28
tags: [vercel, turborepo, monorepo, deployment]
layer: learning
---

# Learning-0010: Vercel Turborepo monorepo — Root Directory is app dir, not monorepo root

## Context

Setting up two Vercel projects from a pnpm + Turborepo monorepo. Initial assumption (from Vercel's general docs) was Root Directory = `.` (monorepo root) with Build Command = `turbo run build --filter=web`.

## Discovery

Setting Root Directory to `.` caused **"No Next.js version detected"** because the root `package.json` doesn't have `next` as a dependency — only the app-level `package.json` does.

The correct pattern for Turborepo monorepos on Vercel:

| Setting          | Value                                          |
| ---------------- | ---------------------------------------------- |
| Root Directory   | `apps/web` (the app directory)                 |
| Install Command  | `cd ../.. && pnpm install`                     |
| Build Command    | `cd ../.. && npx turbo run build --filter=web` |
| Output Directory | _(default — Vercel auto-detects .next)_        |

Vercel auto-detects the pnpm monorepo from the app directory and hoists installation to the workspace root. The `cd ../..` in Install/Build commands navigates to the monorepo root for pnpm and Turbo operations.

**Important:** Without explicit Install and Build commands, Vercel's "Detected Turbo. Adjusting default settings..." would skip the build entirely (completing in ~53ms with no output).

## Impact

- Always set Root Directory to the app directory, not monorepo root
- Always set explicit Install and Build commands with `cd ../..`
- Leave Output Directory empty/default — Vercel finds `.next` automatically
- The `packageManager` field in root `package.json` controls which pnpm version Vercel uses

## References

- ADR-0020: Vercel Hosting with Dual-Project Split
- Learning-0009: .vercelignore depth matching
