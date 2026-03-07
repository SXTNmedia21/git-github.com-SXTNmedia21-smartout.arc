---
title: "Plan — intelligence-pipeline-v2"
status: in_progress
updated: 2026-03-14
created: 2026-03-03
module: onboarding
tags: [plan, intelligence, pipeline, onboarding]
---

# Plan — intelligence-pipeline-v2

> Branch: `feat/intelligence-pipeline-v2` | Module: onboarding

## Goal

Rewrite the intelligence pipeline to support early workspace creation during onboarding. Instead of collecting all data client-side and creating a workspace at the end, the new pipeline provisions a minimal workspace as soon as the company name is known (from scraping or Brreg). This gives intelligence data a permanent database home from step 1, adds Google Places integration, and supports direct org number input alongside URL-based scraping.

## Scope

### In scope

- **Database migration** — New workspace columns for Google Places data (lat/lng, rating, place_id, etc.) + two new RPCs: `provision_onboarding_workspace` (minimal workspace) and `finalize_onboarding_workspace` (promote to full workspace)
- **gather-workspace-intelligence** Edge Function rewrite — 4-phase pipeline: (A) parallel scrape + Brreg, (B) provision workspace, (C) parallel Places + web search, (D) store results. Supports both URL and org number input.
- **google-places-intelligence** Edge Function — New function using Google Places API (v1 Text Search) with graceful degradation when no API key is configured
- **finalize-workspace** Edge Function — Rewritten to call the `finalize_onboarding_workspace` RPC with full workspace data
- **Client refactor** — `useOnboardingState` hook, `data-merger`, `BusinessSection`, and types updated to work with early workspace creation and org number input
- **Middleware** — Updated to handle onboarding workspace routing

### Out of scope

- AI-powered summary generation from intelligence data
- Google Places photo storage in Supabase Storage
- Web search intelligence Edge Function (called but assumed to exist separately)
- E2E tests and user journey documentation (closure gate deliverables)

## Tasks

| #   | Task                                                             | Status      |
| --- | ---------------------------------------------------------------- | ----------- |
| 1   | Design migration: workspace columns, provision RPC, finalize RPC | Done        |
| 2   | Implement `google-places-intelligence` Edge Function             | Done        |
| 3   | Rewrite `gather-workspace-intelligence` with 4-phase pipeline    | Done        |
| 4   | Rewrite `finalize-workspace` Edge Function                       | Done        |
| 5   | Refactor client hooks and types for early workspace + org number | Done        |
| 6   | Update `BusinessSection` UI for org number input                 | Done        |
| 7   | Update `data-merger` to merge new intelligence data shape        | Done        |
| 8   | Update middleware for onboarding workspace routing               | Done        |
| 9   | Review migration SQL for correctness                             | Done        |
| 10  | Review Edge Functions for bugs                                   | In progress |
| 11  | Review client code for bugs                                      | In progress |
| 12  | Update documentation (plan, worklog, decision log, learning log) | Done        |
| 13  | Type generation (`database.types.ts`)                            | Done        |
| 14  | Typecheck passes                                                 | Pending     |
| 15  | Feature closure gates (journeys, tests, final commit)            | Pending     |

## Acceptance Criteria

- [ ] `provision_onboarding_workspace` creates workspace with `contract_status = 'onboarding'`
- [ ] `finalize_onboarding_workspace` promotes workspace with departments, teams, season, policies
- [ ] Google Places data stored in dedicated workspace columns
- [ ] Pipeline works with URL input only, org number only, or both
- [ ] Graceful degradation when Google Places API key is not configured
- [ ] Client onboarding wizard supports org number input field
- [ ] `pnpm turbo typecheck` passes with 0 errors
- [ ] All intelligence data persisted to `workspace.intelligence_data` JSONB column
