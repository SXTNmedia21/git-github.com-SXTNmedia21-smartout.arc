---
title: "Subdomain & Workspace Routing Architecture"
id: SUBDOMAIN_ARCH
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-28
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - routing
  - subdomain
  - multi-tenant
  - middleware
tables:
  - workspace
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Subdomain & Workspace Routing Architecture

> **Status:** Directional (v1.0)
> **Updated:** February 28, 2026
> **Depends on:** Core Architecture v2 (Workspace entity), Module 13 (Multi-tenant)
> **Cross-reference:** `SMARTOUT_DOCS_ARCHITECTURE.md`

---

## 1. Overview

Every Smartout workspace gets its own subdomain: `{slug}.smartout.ai`. This provides customer-owned URLs, logical data isolation visible in the browser, and cross-subdomain authentication via shared cookies.

### Domain Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        DOMAIN STRUCTURE                          │
│                                                                  │
│  smartout.ai                → Landing page (Vercel, separate)    │
│                                                                  │
│  app.smartout.ai            → Workspace-velger + Super Admin     │
│  {slug}.smartout.ai         → Workspace dashboard (wildcard)     │
│  api.smartout.ai            → Edge Functions / API gateway       │
│  docs.smartout.ai           → Documentation (Nextra)             │
│                                                                  │
│  *.smartout.ai              → Caught by wildcard CNAME            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser: peppes.smartout.ai/dashboard
    │
    ▼
DNS: *.smartout.ai → CNAME → cname.vercel-dns.com
    │
    ▼
Vercel: Routes to apps/web project
    │
    ▼
Next.js Middleware:
    ├── Extract subdomain: "peppes"
    ├── Check: reserved? → No
    ├── Rewrite: /workspace/peppes/dashboard
    ├── Set header: x-workspace-slug: peppes
    └── Refresh Supabase auth session
    │
    ▼
Workspace Layout:
    ├── Query workspace by slug
    ├── Verify user has profile in workspace
    └── Wrap children in WorkspaceProvider
    │
    ▼
Dashboard page renders with workspace context
```

---

## 2. DNS Configuration

All DNS records managed at GoDaddy for `smartout.ai`.

| Type    | Name   | Value                  | Purpose              |
| ------- | ------ | ---------------------- | -------------------- |
| `A`     | `@`    | `76.76.21.21`          | Root domain → Vercel |
| `CNAME` | `app`  | `cname.vercel-dns.com` | Portal app           |
| `CNAME` | `*`    | `cname.vercel-dns.com` | Wildcard workspaces  |
| `CNAME` | `docs` | `cname.vercel-dns.com` | Documentation        |

**Wildcard behavior:** Any subdomain without an explicit record falls through to `*`. This means `peppes.smartout.ai`, `starbucks.smartout.ai`, and any future workspace slug resolves automatically without DNS changes.

**Reserved subdomains** have explicit records and are routed to their own Vercel projects or handled specially by the middleware.

---

## 3. Database: Workspace Slug

### 3.1 Schema Extension

The `workspace` table gains a `slug` column — the URL-safe identifier that maps to subdomains.

```
workspace
├── workspace_id    UUID PRIMARY KEY
├── company_id      UUID REFERENCES company
├── name            TEXT NOT NULL
├── slug            TEXT UNIQUE NOT NULL        ← NEW
├── ...existing columns...
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

CONSTRAINT: slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'
INDEX: idx_workspace_slug ON workspace(slug)
```

### 3.2 Slug Generation

Slugs are auto-generated from workspace name via database trigger:

```
"Peppes Pizza Majorstua"  →  "peppes-pizza-majorstua"
"Café Christiania"        →  "cafe-christiania"
"Starbucks Oslo S"        →  "starbucks-oslo-s"
```

**Rules:**

- Lowercase, alphanumeric + hyphens only
- 3–50 characters
- Auto-increment suffix on collision: `peppes`, `peppes-1`, `peppes-2`
- Validated against reserved slug table before assignment

### 3.3 Reserved Slugs

A dedicated `reserved_slug` table prevents workspaces from claiming infrastructure subdomains.

```
reserved_slug
└── slug    TEXT PRIMARY KEY

Values: app, api, docs, www, admin, status, voice, staging, dev,
        mail, smtp, ftp, cdn, assets, static, media, blog, help, support
```

### 3.4 Type Definition

```typescript
// packages/types/src/core.ts
export type Workspace = {
  workspace_id: string;
  company_id: string;
  name: string;
  slug: string; // ← NEW: URL-safe identifier
  // ...existing fields
  created_at: string;
  updated_at: string;
};
```

---

## 4. Middleware: Subdomain Routing

### 4.1 Detection Logic

The Next.js middleware (`apps/web/middleware.ts`) runs on every request and determines routing based on the `Host` header.

```
Host header                    → Subdomain    → Action
─────────────────────────────────────────────────────────
smartout.ai                    → (none)       → Next (landing)
www.smartout.ai                → www          → Next (landing)
app.smartout.ai                → app          → Next (portal)
docs.smartout.ai               → docs         → Separate Vercel project
peppes.smartout.ai             → peppes       → Rewrite to /workspace/peppes/
unknown-slug.smartout.ai       → unknown-slug → Rewrite (layout returns 404)
peppes.localhost:3000          → peppes       → Rewrite (dev mode)
```

### 4.2 Reserved Subdomains

```typescript
const RESERVED_SUBDOMAINS = new Set(["app", "api", "docs", "www", "status", "voice"]);
```

Reserved subdomains are never rewritten to `/workspace/[slug]`. They either serve their own app or are handled by separate Vercel projects.

### 4.3 Local Development

Subdomains work locally via `/etc/hosts` entries:

```
127.0.0.1  app.localhost
127.0.0.1  peppes.localhost
127.0.0.1  starbucks.localhost
```

The middleware detects `localhost` and applies the same subdomain extraction logic.

---

## 5. Authentication: Cross-Subdomain Sessions

### 5.1 Cookie Domain

Supabase auth cookies must be shared across all `*.smartout.ai` subdomains. This is achieved by setting the cookie domain to `.smartout.ai` (with leading dot).

```
Cookie: sb-access-token=...
Domain: .smartout.ai           ← Shared across ALL subdomains
Path: /
Secure: true
HttpOnly: true
SameSite: Lax
```

**Effect:** A user who logs in at `app.smartout.ai` is automatically authenticated at `peppes.smartout.ai`, `starbucks.smartout.ai`, and any other workspace subdomain.

### 5.2 Session Flow

```
1. User logs in at app.smartout.ai
2. Supabase sets cookie with domain=.smartout.ai
3. User clicks "Peppes" in workspace selector
4. Browser redirects to peppes.smartout.ai
5. Cookie is sent automatically (same domain scope)
6. Middleware refreshes session
7. Workspace layout verifies profile access
8. User lands in Peppes dashboard — no re-login needed
```

### 5.3 Access Control

Authentication (who you are) and authorization (what you can see) are separate:

```
Authentication:  Supabase Auth → cookie → shared across subdomains
Authorization:   Profile table → workspace_id + user_id → RLS enforced
```

A user visiting `peppes.smartout.ai` without a Profile in that workspace sees an access denied page with a link back to `app.smartout.ai`.

---

## 6. Workspace Context

### 6.1 Provider Pattern

A React context provider wraps all workspace routes, making workspace data available to any component.

```
/workspace/[slug]/layout.tsx
    │
    ├── Server: Query workspace by slug
    ├── Server: Verify user has profile
    └── Client: <WorkspaceProvider slug={slug}>
                    └── useWorkspace() → { workspace, slug, isLoading }
```

### 6.2 Data Flow

```
URL: peppes.smartout.ai/dashboard
                │
Middleware:      │  Rewrite → /workspace/peppes/dashboard
                │  Set x-workspace-slug: peppes
                ▼
Layout:         Query workspace WHERE slug = 'peppes'
                Query profile WHERE user_id = current AND workspace_id = result
                │
                ▼
Provider:       WorkspaceContext = { workspace, slug: 'peppes' }
                │
                ▼
Components:     const { workspace } = useWorkspace()
                → workspace.workspace_id used in all Supabase queries
                → RLS ensures data isolation at database level
```

---

## 7. App Portal (app.smartout.ai)

### 7.1 Purpose

The portal at `app.smartout.ai` serves as the entry point for users with access to multiple workspaces, and as the super admin interface.

### 7.2 User View

```
┌─────────────────────────────────────────────┐
│  Smartout — Mine workspaces                  │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 🍕 Peppes    │  │ ☕ Starbucks │         │
│  │ Majorstua    │  │ Oslo S       │         │
│  │ 12 ansatte   │  │ 8 ansatte    │         │
│  │              │  │              │         │
│  │  [Åpne →]    │  │  [Åpne →]    │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  + Opprett ny workspace                      │
└─────────────────────────────────────────────┘
```

### 7.3 Super Admin View

Available only to users with `is_godmode = true` on `user_identity`. Shows all workspaces across all companies with operational metrics.

---

## 8. Monorepo Impact

### 8.1 Files Added

| File                                               | Purpose                                |
| -------------------------------------------------- | -------------------------------------- |
| `apps/web/middleware.ts`                           | Subdomain detection and routing        |
| `apps/web/src/lib/workspace-context.tsx`           | React context provider                 |
| `apps/web/src/app/workspace/[slug]/layout.tsx`     | Workspace shell with auth check        |
| `apps/web/src/app/workspace/[slug]/page.tsx`       | Workspace dashboard                    |
| `apps/web/src/app/(portal)/page.tsx`               | Workspace selector                     |
| `apps/web/src/app/(portal)/admin/page.tsx`         | Super admin                            |
| `supabase/migrations/NNNNN_add_workspace_slug.sql` | Slug column + trigger + reserved slugs |

### 8.2 Files Modified

| File                                  | Change                              |
| ------------------------------------- | ----------------------------------- |
| `packages/types/src/core.ts`          | Add `slug` to Workspace type        |
| `apps/web/src/lib/supabase/client.ts` | Set cookie domain to `.smartout.ai` |
| `supabase/seed.sql`                   | Add slugs to seed workspaces        |
| `CLAUDE.md`                           | Add subdomain conventions           |
| `BUILD_ORDER.md`                      | Add Phase 0.11 (subdomain)          |

---

## 9. Agent Team Dispatch

Four agent teams execute this architecture. Each team has a defined scope, file list, and acceptance criteria.

### Team 1: Infrastructure — Auth & Environment

|                |                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| **Scope**      | Supabase cookie domain, environment variables, local dev setup                     |
| **Files**      | `client.ts`, `server.ts`, `middleware.ts` (Supabase), `.env.*`                     |
| **Depends on** | Nothing — can start immediately                                                    |
| **Criteria**   | Cookie domain=.smartout.ai in prod; auth shared across subdomains; local dev works |

### Team 2: Database — Workspace Slug

|                |                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ |
| **Scope**      | Migration, reserved slugs, slug generation trigger, types update                     |
| **Files**      | `NNNNN_add_workspace_slug.sql`, `core.ts`, `seed.sql`                                |
| **Depends on** | Nothing — can start immediately                                                      |
| **Criteria**   | Slug column with UNIQUE; auto-generation from name; reserved slugs blocked; backfill |

### Team 3: Middleware — Subdomain Routing

|                |                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Scope**      | Next.js middleware, subdomain detection, URL rewriting                                               |
| **Files**      | `middleware.ts`, `next.config.ts`                                                                    |
| **Depends on** | Team 2 (needs slug column to exist)                                                                  |
| **Criteria**   | {slug}.smartout.ai rewrites to /workspace/{slug}; reserved subdomains pass through; local dev parity |

### Team 4: Workspace UI — Context & Portal

|                |                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Scope**      | WorkspaceProvider, layout, workspace selector, super admin                                            |
| **Files**      | `workspace-context.tsx`, `[slug]/layout.tsx`, `(portal)/*.tsx`                                        |
| **Depends on** | Team 2 + Team 3 (needs slug + routing)                                                                |
| **Criteria**   | useWorkspace() returns data; access denied without profile; portal lists workspaces; super admin view |

### Execution Order

```
Phase 1 (parallel):  Team 1 (Infrastructure) + Team 2 (Database)
Phase 2 (after DB):  Team 3 (Middleware)
Phase 3 (after MW):  Team 4 (Workspace UI)
Phase 4:             Integration test — full E2E flow
```

---

## 10. Design Decisions

| Decision                        | Choice                         | Rationale                                                                          |
| ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- |
| Wildcard vs per-workspace DNS   | Wildcard                       | Zero DNS maintenance per customer. Industry standard (Slack, Notion, Atlassian).   |
| Subdomain vs path-based routing | Subdomain                      | Professional appearance, clear workspace isolation, cookie scoping.                |
| Slug generation                 | Database trigger               | Guaranteed uniqueness, no race conditions, backfill support.                       |
| Reserved slug table             | Separate table                 | Easily extensible, queryable, no code changes needed to add new reserved slugs.    |
| Cookie domain                   | `.smartout.ai`                 | Shares auth across all subdomains. Only alternative is re-login per workspace.     |
| Workspace context               | React context + TanStack Query | Consistent with existing data fetching patterns. 5-min stale time for performance. |
| Portal location                 | `app.smartout.ai`              | Neutral subdomain, not tied to any workspace. Clean separation.                    |
