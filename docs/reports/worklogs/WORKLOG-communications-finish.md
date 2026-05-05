---
title: "Worklog — communications-finish"
status: done
updated: 2026-03-06
created: 2026-03-02
module: comms
tags: [email, sendgrid, tiptap, ai, webhooks]
---

# Worklog — communications-finish

> Branch: `feat/communications-finish` | Worktree: wt-2 | Started: 2026-03-02

## Status: 🟢 Done

## Done

- [x] Database schema: migration for tracking columns + webhook event table
- [x] SendGrid dynamic template support in notifications package
- [x] Compose email redesign: Tiptap rich editor, template fields, collapsible sections, preview
- [x] AI text correction via OpenRouter (Norwegian + English)
- [x] Multilingual sending: locale column on recipients
- [x] SendGrid webhook receiver: Edge Function with ECDSA signature verification
- [x] Engagement report: KPI cards + per-email breakdown table
- [x] Send route: dual-path (inline + dynamic template), idempotency, audit logging
- [x] Saved template integration in compose form

## Remaining

- None

## Decisions

| Date       | Decision                                     | Reason                                          |
| ---------- | -------------------------------------------- | ----------------------------------------------- |
| 2026-03-02 | Keep SendGrid (not Resend)                   | Already integrated, dynamic templates supported |
| 2026-03-02 | Tiptap for rich text                         | Already installed (v3.20.0), used in contracts  |
| 2026-03-02 | OpenRouter for AI correction                 | Via Vault `getServiceKey('openrouter')`         |
| 2026-03-02 | Fixed structure (not drag-and-drop builder)  | Matches SendGrid template, YAGNI                |
| 2026-03-04 | ECDSA P-256 SHA-256 for webhook verification | SendGrid's signed event webhook v3 standard     |

## Log

| Date       | Time  | Event                                                                   |
| ---------- | ----- | ----------------------------------------------------------------------- |
| 2026-03-02 | 20:32 | Feature started                                                         |
| 2026-03-04 |       | Saved templates integrated into compose form                            |
| 2026-03-04 |       | ECDSA webhook signature verification implemented                        |
| 2026-03-04 |       | Recipient locale tracking for multilingual sending                      |
| 2026-03-04 |       | Engagement report with KPI cards and per-email breakdown                |
| 2026-03-06 |       | All 8 plan tasks verified complete, typecheck passes, closure initiated |
