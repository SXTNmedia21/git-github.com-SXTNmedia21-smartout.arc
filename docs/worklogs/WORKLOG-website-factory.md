---
title: "Worklog — website-factory"
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: website-factory
tags: []
---

# Worklog — website-factory

> Branch: `feat/website-factory` | Worktree: wt-6 | Started: 2026-03-22

## Status: 🟡 In Progress

## Done

- [x] Plan A: Create `websites` schema — 12 tables, triggers, indexes
- [x] Plan A: RLS policies — 41 admin-only policies
- [x] Plan A: RPC functions, storage bucket, feature flag, types regen
- [x] Plan A: `@smartout/website` shared package — 27 files, 16 Zod schemas, registry, templates
- [x] Plan A: Middleware extension for `*.smartout.info` routing
- [x] Plan A: Site public repository — service-role isolated
- [x] Plan A: Public site renderers — 30 files, 16 section components, ISR
- [x] Plan A: Publish pipeline — 3 server actions (publish, rollback, unpublish)
- [x] Plan A: Telemetry — 8 website events registered
- [x] Plan A: Seed data — "Sjøboden" test site
- [x] Plan B design: Template gallery — 20 templates, 3 tiers (Basic/Pro/Premium)
- [x] Plan B design: Full-page template preview with ← → navigation
- [x] Plan B design: Section editor — 2-column (sidebar + form), preview as separate tab
- [x] Plan B design: Section picker dialog — system-connected sections marked
- [x] Plan B design: 6 section editors (Menu, Chef, Hours, CTA, Footer, Gallery)
- [x] Plan B design: Spokesperson approval flow (admin → push → approve/decline)
- [x] Plan B design: Mobile app — approval, content tasks, AI writing help
- [x] Plan B design: Recurring content tasks with AI assist
- [x] Plan B design: Telemetry event map — 24 events, 5 destinations

## Remaining

- [ ] Write Plan B spec document (save all designs + 20 page-type prompts)
- [ ] Run spec review loop
- [ ] Write Plan B implementation plan
- [ ] Implement Plan B (Builder UI)
- [ ] Update WORKLOG status to done when complete

## Decisions

| Date       | Decision                                          | Reason                                                 |
| ---------- | ------------------------------------------------- | ------------------------------------------------------ |
| 2026-03-22 | Dedicated `websites` PostgreSQL schema            | Bounded context isolation per cascade model            |
| 2026-03-22 | Bug fix: website_section trigger via page lookup  | Section has website_page_id not website_id             |
| 2026-03-22 | PostgREST config needs `--schema websites`        | Type gen and RPC calls need explicit schema exposure   |
| 2026-03-22 | 2-column editor, preview as separate tab          | Cleaner UX, more editing space                         |
| 2026-03-22 | 20 templates with 3 tiers (Basic/Pro/Premium)     | Revenue opportunity, clear differentiation             |
| 2026-03-22 | System-connected sections (menu, hours, chef)     | Bridge pattern — website views live system data        |
| 2026-03-22 | Spokesperson approval flow with push notification | GDPR/consent — person must approve public visibility   |
| 2026-03-22 | Recurring content tasks created on approval       | Engine handles scheduling, AI assists content creation |

## Log

| Date       | Time  | Event                                                              |
| ---------- | ----- | ------------------------------------------------------------------ |
| 2026-03-22 | 00:49 | Feature started                                                    |
| 2026-03-22 | 01:00 | Plan A execution started — 3 agents (schema, package, middleware)  |
| 2026-03-22 | 01:05 | Task 1 done: 12 tables created                                     |
| 2026-03-22 | 01:05 | Task 5 done: middleware extended                                   |
| 2026-03-22 | 01:14 | Task 2 done: 41 RLS policies                                       |
| 2026-03-22 | 01:15 | Task 3 done: RPC, storage, flag, types                             |
| 2026-03-22 | 01:15 | Task 4 done: 27-file shared package                                |
| 2026-03-22 | 01:16 | Task 9 done: telemetry events                                      |
| 2026-03-22 | 01:17 | Task 6 done: public repository                                     |
| 2026-03-22 | 01:20 | Task 8 done: publish pipeline                                      |
| 2026-03-22 | 01:21 | Task 7 done: 30-file public site renderers                         |
| 2026-03-22 | 01:22 | Typecheck: 21/22 pass (1 pre-existing mobile error)                |
| 2026-03-22 | 01:25 | Task 10 done: seed data                                            |
| 2026-03-22 | 01:26 | All 10 Plan A commits created                                      |
| 2026-03-22 | 01:30 | Plan B brainstorming started — template gallery design             |
| 2026-03-22 | 02:00 | UX research: Squarespace, Wix, Framer, Duda, BentoBox patterns     |
| 2026-03-22 | 02:30 | 20 template designs with stock photography and tier badges         |
| 2026-03-22 | 03:00 | Section editors designed: picker, menu bridge, chef, hours, footer |
| 2026-03-22 | 03:15 | Spokesperson approval flow + mobile app UX                         |
| 2026-03-22 | 03:30 | Recurring content tasks + AI writing assist designed               |
| 2026-03-22 | 03:30 | 24 telemetry events mapped                                         |
| 2026-03-22 | 03:45 | Session ended — spec writing is next step                          |
