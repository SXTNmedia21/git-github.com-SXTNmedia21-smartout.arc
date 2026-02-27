# ADR-0001: Adopt Turborepo & pnpm Workspaces

**Status:** Accepted  
**Date:** 2026-02-24  

## Context and Problem Statement
Smartout needs to share its data model types, Supabase client logic, and generic UI components across a Web Dashboard (Next.js) and Mobile App (React Native/Expo) seamlessly without code duplication.

## Considered Options
1. Mono-repo via Yarn Workspaces
2. TurboRepo with pnpm Workspaces
3. Separate repositories

## Decision Outcome
Chosen option: **TurboRepo with pnpm Workspaces**.
Pnpm offers strict, fast, and deterministic dependency resolution. Turborepo handles complex build orders and caching, especially useful for edge functions and UI compilation.

## Rules Enforced for Agents
* Never install dependencies at the root unless it's a tooling dependency (e.g., turbo, prettier).
* Always run `pnpm add <package> --filter <workspace>` to install a package into the correct place.
