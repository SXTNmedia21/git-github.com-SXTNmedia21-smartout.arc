---
title: "Board Onboarding + Communication Layer — Mission 01"
status: draft
updated: 2026-03-06
created: 2026-03-06
module: communication
tags: [board, onboarding, communication, ai, intelligence-layers]
---

# Board Onboarding + Communication Layer — Mission 01

## Mission

Build a clear, repeatable communication layer from development to board so the board gets a real Smartout AI experience, understands progress weekly, and can make decisions faster.

This mission starts from first principles:

1. What is built.
2. Why it matters.
3. What risk remains.
4. What decision is needed from board.

## What was shipped this last week (board-relevant)

### 1) Progressive onboarding intelligence

- Replaced one-shot scraping with a progressive pipeline (`search-brreg`, `identify-company`, `scrape-website`).
- Wired onboarding agent tools for staged data gathering and form assistance.
- Updated mission prompts and architecture docs for this flow.

Board value: onboarding becomes less manual and more reliable for Norwegian businesses.

### 2) Services health visibility in platform admin

- Added service registry + health dashboard for Stage Engine, Shift MCP, and Contract Service.
- Added guarded health-check API route and auto-refresh monitoring UI.

Board value: better operational control and earlier failure detection.

### 3) Dashboard and operational engine progress

- Dashboard data hooks and views moved toward real data and better structure.
- Daily close engine baseline completed (state machine, OCR/validation pipeline, reconciliation surfaces).

Board value: product is moving from concept UX to operational system behavior.

### 4) Design system continuity audit

- Completed cross-surface audit (Landing, Onboarding, Dashboard, Auth).
- Identified where onboarding can become the visual and narrative bridge into product value.

Board value: we can reduce UX fragmentation and improve adoption confidence.

## Smartout AI experience for board (three intelligence layers)

### System Intelligence (execution layer)

- Stage/state orchestration
- Runtime events and process flow
- Health monitoring and operational visibility

### Industry Intelligence (domain layer)

- Hospitality-specific onboarding defaults and relevance mapping
- Company context grounded in real business data

### Artificial Intelligence (interaction layer)

- Botsson-guided onboarding
- Progressive company research and assisted field completion
- Agent-driven communication framing for decision-ready board updates

## Communication Layer Design (development -> board)

### Cadence

- Weekly board update (email, max 8 sentences + one attached markdown report)
- Bi-weekly board walkthrough (30 min): demo + risks + asks
- Exception alert within 24h for critical blockers

### Standard update format (always the same)

1. **Status line:** What changed this week.
2. **Impact line:** Why this matters for revenue, delivery speed, or risk.
3. **Risk line:** Top unresolved risk.
4. **Ask line:** One concrete board decision needed.

### Attachments for every weekly update

- `Progress Snapshot` (done / in progress / next)
- `Risk Register` (red/yellow/green)
- `Decision Queue` (what needs board input now)

## Board onboarding flow (from scratch)

### Step 1: Product orientation (10 min)

- One-screen explanation of Smartout architecture and current maturity.

### Step 2: Live onboarding demo (10 min)

- Show Botsson-assisted onboarding flow:
  - search company
  - identify company
  - scrape website
  - materialize key facts

### Step 3: Operations trust demo (5 min)

- Show services health dashboard and one operational lifecycle path.

### Step 4: Decision board (5 min)

- Present top 3 asks:
  - priority focus
  - timeline trade-off
  - budget/effort boundary

## Alignment with master autonomy roadmap (operational)

This mission now explicitly tracks `docs/plans/2026-03-06-master-autonomy-roadmap.md` as the source sequence.

### Phase mapping

- **Phase 1 (Platform Foundation & Services):** board reporting includes service health readiness and config governance status.
- **Phase 2-3 (Agent Profile backend + UI):** board reporting includes agent identity maturity (profile, relationship, posture readiness).
- **Phase 4 (Onboarding Intelligence Pipeline):** board demo anchors on progressive company intelligence and data hydration quality.
- **Phase 5 (Event Motor & Package Gating):** board reporting highlights hard-gate enforcement and transition safety.
- **Phase 6 (Dashboard Setup Wizard):** board demo closes with compliance setup gates and operational handoff readiness.

### Board communication rule update

All weekly board updates must include a one-line status per roadmap phase:

- `P1 Services`
- `P2-3 Agent Profile`
- `P4 Intelligence`
- `P5 Gating`
- `P6 Setup Wizard`

## First 14-day execution plan

### Week 1

- Finalize board communication template files.
- Produce first weekly board update from current worklogs.
- Run first board onboarding walkthrough using the 4-step flow.
- Add phase-status line items for P1-P6 in the board snapshot.
- Prepare sandbox showcase script aligned to Phase 4 -> 5 -> 6 narrative.

### Week 2

- Add board-facing KPI snapshot (onboarding completion, failure points, service health trend).
- Add one "AI layer spotlight" section per weekly update.
- Tighten decision queue to one clear ask per message.
- Add gate-readiness indicators (journey transition eligibility + blocking reasons) for board visibility.

## Done criteria

- Board receives one concise, decision-ready weekly update.
- Board can explain the three intelligence layers in plain terms.
- Board has one stable demo flow for onboarding + operations trust.
- Communication loop is repeatable without ad-hoc rewriting each week.
- Reporting is explicitly traceable to roadmap phases P1-P6.

## Open risks

- Technical updates are still too detailed for board format unless strictly curated.
- "In progress" work can be misread as "production ready" without explicit status labels.
- If we include too many asks per update, decision velocity drops.

## Next action (immediate)

Send the first board update using the template in `docs/emails/2026-03-06-styret.md` and request a 30-minute onboarding + progress review session next week.
