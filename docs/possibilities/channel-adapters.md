---
title: Possibilities — channel adapters
status: draft
updated: 2026-05-19
created: 2026-05-19
module: channels
tags: [possibility, helpdesk, telegram, whatsapp, openwa]
---

# Possibilities

## Channel adapters (helpdesk / outbound)

Idea: add chat-channel services so workspaces can receive/send via external messengers. Sits next to ADR-0164 (kanaler-som-helpdesk) territory.

### Telegram

- Official Bot API. Free, stable, no ToS risk.
- Shape: `services/channel-telegram` (Fastify or Hono).
- Inbound: webhook → emit() → engine-dispatch.
- Outbound: capability tool `messaging.send_telegram` behind workspace-api gateway.
- Per-workspace bot token stored 1Password → workspace config.

### WhatsApp via open-wa/wa-automate (openwa)

- Unofficial WhatsApp Web automation lib.
- Pros: free, no Meta approval needed, fast to POC.
- Cons: ToS-gray, ban-risk on real numbers, session-state fragile, no SLA, breaks when WhatsApp Web changes.
- Verdict: **POC / internal only**. Not prod for paying workspaces.

### WhatsApp Business Cloud API (Meta) — prod alternative

- Official. Meta-hosted, webhook + REST.
- Cons: business verification, per-conversation pricing, approval lag.
- Verdict: production path when WhatsApp matters commercially.

## Open questions

- Scope: outbound notifications only, or full two-way helpdesk (inbound routes to engine-dispatch + Botsson)?
- Workspace-routing: how does `chat_id` ↔ `workspace_id` ↔ `profile_id` mapping work? (likely engine_authority_config + new `channel_binding` table)
- Does this merge into ADR-0164 helpdesk capability or stand alone?
- Per-workspace credentials: 1Password vault per workspace, or shared bot with workspace-scoped routing?

## Not decided

This is a possibility note. No ADR drafted. No code written. Park until helpdesk priority surfaces.
