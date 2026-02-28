# Smartout Performance and Build Governance

## Purpose

This document defines the permanent system for preventing performance regressions and build quality drift across `apps/web` and `apps/landing`.

The model is:

- Measure route-level performance on every PR
- Compare against versioned budgets
- Start in warn mode
- Transition to fail mode after baseline stabilization

## Scope

- Apps: `apps/web`, `apps/landing`
- Route scope: all routes in both apps (critical routes get stricter thresholds)
- Trigger points: pull requests and pushes to `SmartOut.ai`

## Ownership

- Performance and Build Governance owner: Platform/Architecture
- Route ownership:
  - `apps/web/src/app/dashboard/**`: Operations product team
  - `apps/web/src/app/platform-admin/**`: Platform admin team
  - `apps/web/src/app/login` and auth routes: Identity/Auth team
  - `apps/landing/src/app/**`: Growth/Marketing team

## Budget Model

Budgets are tracked in:

- `apps/web/perf-budgets.json`
- `apps/landing/perf-budgets.json`

Each route has thresholds for:

- `responseTimeMs` (first byte + server response)
- `htmlSizeKb` (initial HTML payload size)

Note: these are stable CI metrics. Lighthouse/Web Vitals are still recommended for deeper analysis, but CI gating uses deterministic metrics that run reliably in GitHub Actions.

## Severity Levels

- `green`: all thresholds pass
- `yellow`: one or more thresholds exceed target but remain in warn mode
- `red`: thresholds exceed and enforcement mode is fail

## Enforcement Phases

1. Warn-only (default): PRs get report artifacts, no hard block
2. Fail mode: PRs fail if any route exceeds thresholds

Mode is controlled via CI env:

- `PERF_ENFORCEMENT=warn`
- `PERF_ENFORCEMENT=fail`

Current policy:

- Pull requests run in `warn`
- Pushes to the main integration branch run in `fail`

## Exemptions

Temporary exemptions are allowed only when:

- There is a documented business need
- Owner is assigned
- Expiry date is defined

Exemptions must be committed in the relevant `perf-budgets.json` route object with:

- `exemptionReason`
- `exemptionOwner`
- `exemptionExpiresOn`

## Regression Response SLA

- Critical route regression: triage within 1 business day
- Non-critical route regression: triage within 3 business days
- Expired exemptions: resolved before merge

## Required PR Checklist

Every PR touching `apps/web/src/app/**` or `apps/landing/src/app/**` must include:

- Performance checklist acknowledgement
- Budget diff review (if any)
- Notes for heavy UI changes (animation, DnD, charts, voice, etc.)
