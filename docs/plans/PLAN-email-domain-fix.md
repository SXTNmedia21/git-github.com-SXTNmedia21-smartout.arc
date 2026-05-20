---
title: "Plan — email-domain-fix"
feature: email-domain-fix
spec: null
status: in_progress
updated: 2026-05-18
created: 2026-05-18
module: notifications
tags: [plan, bugfix]
---

# Plan — email-domain-fix

> Branch: `feat/email-domain-fix` | Worktree: `/home/sxtnl/dev/smartout.ai-wt-3` | Base: `development` | Module: notifications

## Goal

Fix dead invitation links. SendGrid Link Branding wrapper subdomain `url9671.smartout.io` returns NXDOMAIN. Wrapper exists on `.ai` (`url9671.smartout.ai` resolves). Code hardcodes `noreply@smartout.io` as From → SendGrid wraps with `.io` subdomain → links break.

## Root Cause

Seven files hardcode `smartout.io`. SendGrid Sender Authentication + Link Branding configured on `.ai`. Mismatch between code and SendGrid config.

## Journeys (the contract)

- [JOURNEY-email-domain-fix-admin-inviterer-ansatt](../journeys/JOURNEY-email-domain-fix-admin-inviterer-ansatt.md) — Admin sender invitasjon på e-post, mottaker mottar mail, link åpner riktig domene
- [JOURNEY-email-domain-fix-magic-link-login](../journeys/JOURNEY-email-domain-fix-magic-link-login.md) — Bruker ber om login-kode, mottar mail med fungerende lenke

## Tasks

- [x] Replace `smartout.io` → `smartout.ai` in `packages/notifications/src/sendgrid.ts:15` (DEFAULT_FROM)
- [x] Replace in `packages/notifications/src/email-service.ts:31` (fromEmail default)
- [x] Replace in `packages/notifications/src/compliance.ts:22-24` (sender allowlist)
- [x] Replace in `packages/notifications/src/templates.ts:71,82` (upgradeUrl + paymentUrl fallbacks)
- [x] Replace in `supabase/functions/create-invitation/index.ts:301` (legacy EF from)
- [x] Replace in `supabase/functions/send-login-code/index.ts:185` (magic-link from)
- [x] Replace in `apps/web/src/app/sign/[token]/signing-form.tsx:28` (logo URL)
- [x] Build notifications package
- [x] Typecheck pass

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Zero remaining `smartout.io` references in code (allow in docs/learnings/historical context)
- [ ] Merged to development → Vercel preview redeploys → fresh invite has live link

## Out of Scope

- Reconfiguring SendGrid Sender Authentication (assumed correct on .ai given url9671.smartout.ai resolves)
- DNS changes (.ai records already live)
- E2E test (manual verification only)
