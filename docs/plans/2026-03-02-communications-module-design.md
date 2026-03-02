---
title: "Design — Communications Module UI Redesign"
status: draft
updated: 2026-03-02
created: 2026-03-02
module: communications
tags: [email, sendgrid, ai, i18n, platform-admin]
---

# Communications Module — UI Redesign

## Context

Platform-level communications (admin → users). Not team chat (Module 9). Current implementation has basic compose modal with markdown text field and audience selector.

## New Features

### SendGrid Integration

- Connect SendGrid templates to Smartout
- API keys managed via /platform-admin/keys (already in Vault system)

### Email Builder

- Subject + **Subtitle** (preheader) + **Rich Text** message
- **Image + Title + Link** list elements (newsletter-style blocks)
- **Configurable footer** per workspace
- Template preview with real data

### AI Text Correction

- Button in editor: "AI-korriger"
- Improves grammar, tone, professional language
- Provider: OpenRouter via getServiceKey('openrouter')

### Multilingual Sending

- System iterates recipients, sends in their language preference
- AI auto-translates content per recipient
- Base language: Norwegian → auto English/other for non-Norwegian speakers

### Read Receipts

- Track email opens via SendGrid webhooks
- Show "X av Y har åpnet" in Communication History table
- Click count → see who opened / who didn't

### Webhooks

- Configurable webhook endpoints for: opened, clicked, bounced, unsubscribed
- Setup in admin panel

## Open Questions (need answers before implementation)

1. SendGrid vs Resend?
2. Rich Text editor: Tiptap, Lexical, or Slate?
3. AI correction: language only or also tone/style?
4. Languages supported: no, en, + ?
5. Footer: global per workspace or per send?
6. Webhook events: opened, clicked, bounced, unsubscribed?
7. Builder: drag-and-drop blocks or fixed structure?
8. Template preview with real data?

## Implementation Notes

This depends on:

- Keys admin UI (sma-9) for SendGrid API key registration
- getServiceKey('sendgrid') for runtime key access
- getServiceKey('openrouter') for AI text correction

Recommended approach: Phase this after keys admin UI is merged.
