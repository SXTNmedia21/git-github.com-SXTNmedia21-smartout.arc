---
title: Rescue and re-engagement are distinct problems
status: done
updated: 2026-04-06
created: 2026-04-06
module: ai-agent
tags: [journey, rescue, ux, council]
---

# Learning 0024: Rescue Is Not Re-Engagement

## Discovery

During the Agent Harness council review, a conflict emerged between push notifications (Agent Coordinator) and in-app Botsson interaction (Frontend Designer) as the rescue delivery mechanism. The resolution revealed these are two different problems:

**Rescue** = contextual help for an active user who is stuck right now.
- User is in the app, on a journey step, not progressing
- Delivery: Botsson Breath (orb pulses, contextual message on tap)
- Timing: seconds to minutes after stall detected
- Feel: the app itself is attentive

**Re-engagement** = bringing back an absent user who has disappeared.
- User has not opened the app in >48h, journey stalled
- Delivery: single consolidated push notification with deep-link
- Timing: days after last activity
- Feel: a gentle reminder, not an alarm

## Why This Matters

Conflating these produces bad UX for both:
- Using push for rescue → breaks flow, trains user to dismiss notifications
- Using in-app for re-engagement → user never sees it (they're not in the app)
- Using one system for both → either too aggressive for active users or too passive for absent users

## Correct Pattern

Two-tier delivery model:
1. **Tier 1 (Rescue):** Botsson Breath for in-session users. Spring animation, contextual, interruptible.
2. **Tier 2 (Re-engagement):** Single consolidated notification for absent users (>48h). Not per-journey spam.

## Source

Council session 2026-04-06: "Journey Inference as Agent Harness". System Steward synthesis resolved conflict between Agent Coordinator and Frontend Designer recommendations.
