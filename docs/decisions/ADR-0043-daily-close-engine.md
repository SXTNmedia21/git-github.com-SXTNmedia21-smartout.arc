---
title: "DailyCloseEngine — State Machine + Reconciliation System"
id: ADR_0043
status: accepted
layer: decision
created: 2026-03-04
updated: 2026-03-04
---

# ADR-0043: DailyCloseEngine Architecture

## Context and Problem Statement

Smartout needs a daily reconciliation system where closing employees settle the day (checklist + settlement images), OCR extracts financial data, and managers approve. This requires a state machine to orchestrate the multi-step, multi-actor process with timeouts, gatekeepers, and event-driven transitions.

## Decision Drivers

- Need generic process orchestration reusable beyond daily close (onboarding, compliance)
- Two-phase flow: employee settlement then manager approval with different actors
- OCR integration for automated financial data extraction from POS/terminal receipts
- Gatekeeper pattern: block checkout until all conditions met
- Event-driven: pg_cron + Edge Functions, not a separate service

## Considered Options

1. **Generic State Machine Engine in public schema** -- 6 tables with `engine_` prefix, Edge Function dispatcher
2. **Hardcoded reconciliation flow** -- Direct DB mutations without engine abstraction
3. **Separate microservice** -- Dedicated service for process orchestration

## Decision Outcome

Chosen option: **"Generic State Machine Engine in public schema"**, because it provides reusable process orchestration while keeping infrastructure minimal (Edge Functions + pg*cron, no separate service). The engine tables follow the existing `engine*\*` naming convention in the public schema.

## Rules & Consequences

- **Good, because** the engine is reusable for future processes (onboarding_14d, compliance audits)
- **Good, because** no additional infrastructure -- runs on existing Supabase Edge Functions + pg_cron
- **Good, because** event-driven with idempotency keys prevents duplicate processing
- **Bad, because** engine_process/step/trigger tables overlap naming with existing engine_missions/stages (AI conversations)
- **Bad, because** step execution is synchronous within the dispatcher -- long chains could timeout
- **Agent Impact:** Domain process engine tables are SEPARATE from Stage Engine tables. engine_process != engine_missions. Always check which engine you are working with.

### Key Decisions

1. **Schema naming**: `engine_*` prefix in public schema (matches existing convention, not a separate schema)
2. **OCR provider**: Google Vision API for text extraction from Norwegian POS/terminal receipts
3. **Gatekeeper implementation**: As an engine step (`lock_checkout` action type), not middleware
4. **Tolerance threshold**: 1% or 50 NOK (whichever greater) for POS vs terminal mismatch

---
