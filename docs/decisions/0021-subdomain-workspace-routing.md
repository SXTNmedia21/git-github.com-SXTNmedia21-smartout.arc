---
id: "0021"
title: Subdomain-Based Workspace Routing
status: accepted
date: 2026-02-28
updated: 2026-04-20
layer: decision
---

# ADR-0021: Subdomain-Based Workspace Routing

> **Amendment 2026-04-20 (ADR-0167/0168/0169 auth council):** `app.smartout.ai` is the **canonical auth portal subdomain**. All auth routes (`/login`, `/signup`, `/join`, `/reset-password`, `/update-password`, `/invitation/[token]`, `/confirm-email`, `/select-workspace`, `/welcome`) live on the portal subdomain only — workspace subdomains (`{slug}.smartout.ai`) must redirect any auth-route request to the portal. The portal is identity-agnostic (does not know which workspace you're going to); workspace subdomains are the arbeidsflate (work surface) only. See Phase 6 of the Auth & Invitation spec for redirect rules.

## Context and Problem Statement

Smartout is multi-tenant. Users need clear URL-level workspace isolation and seamless multi-workspace navigation without re-login.

## Decision Drivers

- Professional URLs (peppes.smartout.ai vs generic paths)
- Zero DNS maintenance per customer (wildcard CNAME)
- Cross-subdomain auth sharing via cookie domain
- Industry standard (Slack, Notion, Atlassian)

## Considered Options

1. Path-based routing (`/workspace/{slug}/dashboard`)
2. Subdomain + URL rewriting (rewrite to `/workspace/[slug]/...` internal routes)
3. Subdomain + header injection (set `x-workspace-slug` header, keep existing routes)

## Decision Outcome

Option 3: Subdomain routing with header-based workspace context.

Middleware detects subdomain, sets `x-workspace-slug` header. Dashboard layout (server component) reads header, queries workspace, provides context via WorkspaceProvider. No URL rewriting, no route file changes.

## Rules & Consequences

- Middleware extracts subdomain from Host header
- Reserved subdomains stored in `reserved_slug` table (no code changes to add new ones)
- Cookie domain = `.smartout.ai` for cross-subdomain auth
- Dashboard layout split: Server Component wrapper + Client Component shell
- `useWorkspace()` hook provides workspace context to all dashboard components
- Portal at `app.smartout.ai` with workspace selector
- Local dev uses `{slug}.localhost:3050` with /etc/hosts entries
