---
title: "Foundation Architecture — Technical Stack"
id: FOUND_ARCH
version: "1.0"
status: canonical
layer: architecture
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
tags:
  - foundation
  - tech-stack
  - infrastructure
tables: []
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Smartout — Technical Architecture & Stack

> **Smartout.io** — Foundation documentation
> Version 1.0 | February 2026
> **Source:** SMARTOUT_COMPLETE_DOCUMENTATION.md, Sections 1, 6, 7
> **See also:** SMARTOUT_CORE_ARCHITECTURE_v2.md (detailed), SMARTOUT_UI_ARCHITECTURE.md (UI screens)

---

## 1. Technical Stack

| Layer         | Technology                                                          | Purpose                                         |
| ------------- | ------------------------------------------------------------------- | ----------------------------------------------- |
| Web Dashboard | Next.js 14+ (App Router, TypeScript)                                | Admin + employee desktop experience             |
| Mobile App    | React Native + Expo (TypeScript)                                    | Runtime restaurant operations                   |
| Backend       | Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)      | All backend services                            |
| Automation    | n8n (complex workflows) + Supabase Edge Functions (simple triggers) | Business logic orchestration                    |
| Hosting       | Vercel (web), Supabase Cloud (backend), DigitalOcean (n8n)          | Infrastructure                                  |
| Language      | TypeScript                                                          | Everywhere — no exceptions                      |
| Monorepo      | pnpm workspaces + Turborepo                                         | Package management                              |
| CSS           | Tailwind CSS                                                        | Styling                                         |
| Components    | shadcn/ui                                                           | Component library                               |
| Data Fetching | TanStack Query (React Query)                                        | Client-side caching & fetching                  |
| Real-time     | Supabase Realtime                                                   | Live updates (chat, session status, task board) |
| SMS           | Twilio                                                              | SMS notifications, OTP, voice                   |
| Email         | Resend                                                              | Transactional email                             |
| Voice AI      | Ultravox + Twilio                                                   | AI voice conversations                          |
| Payments      | Stripe                                                              | Subscription billing                            |
| Vector Search | pgvector (Supabase)                                                 | RAG / Knowledge Engine embeddings               |

## 2. Authentication

- Email + password (Supabase Auth)
- Magic link (passwordless email)
- SMS OTP via Twilio
- Google / Microsoft SSO
- Session management via Next.js middleware

## 3. Multi-Tenant Model

- All data scoped via `workspace_id` on every table
- Enforced through Supabase Row Level Security (RLS) at the database level
- Users can have Profiles in multiple Workspaces (even across Companies)
- Even if application code has a bug, data cannot leak between workspaces

## 4. ID Strategy

- **Primary keys:** UUIDs (Supabase default)
- **Display codes:** Human-readable identifiers generated per workspace (EMP-001, SHF-4521)

## 5. Environments

Production, Staging, Development — Supabase project branching for environment isolation.

## 6. Voice Infrastructure (Existing)

| Component               | Status                                   |
| ----------------------- | ---------------------------------------- |
| Voice MCP server        | Production on Vercel                     |
| Journey/mission system  | Working with missions/stages in Supabase |
| Ultravox WebRTC client  | Full implementation                      |
| Call creation API       | Working                                  |
| Stage prompt builder    | Generic, works for any mission           |
| Norwegian voice config  | Configured (languageHint: "no")          |
| Mute/unmute/transcripts | Built into BrowserCall                   |
| Tool proxy pattern      | Exists for advance_stage                 |
| Session persistence     | Supabase with JSONB collected_data       |

## 7. Design System

| Decision          | Choice                                 |
| ----------------- | -------------------------------------- |
| CSS Framework     | Tailwind CSS                           |
| Component Library | shadcn/ui                              |
| Responsive        | Desktop and mobile equally prioritized |
| Typography        | System defaults via Tailwind           |

Desktop and mobile are separate applications sharing TypeScript types and Supabase queries.

## 8. Platform Strategy

**Desktop = employee CV/growth platform + admin control center.**
**Mobile = runtime restaurant operations.**

Two modes on desktop: Employee Mode (personal workspace) and Admin/Manager Mode (operational control).

---

_For complete screen specifications see SMARTOUT_UI_ARCHITECTURE.md._
_For detailed data architecture see SMARTOUT_CORE_ARCHITECTURE_v2.md._
