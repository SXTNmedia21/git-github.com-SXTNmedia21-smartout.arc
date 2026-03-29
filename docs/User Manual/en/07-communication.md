---
title: "Communication"
id: MANUAL_07_EN
version: "1.0"
status: canonical
layer: manual
created: 2026-03-24
updated: 2026-03-24
author: claude
slug_en: communication
tags:
  - manual
  - communication
  - chat
  - notifications
  - english
---

# Communication

> Chat, notifications, announcements, escalation and quiet hours — keep the team informed and coordinated.

---

## Overview

SmartOut has a built-in communication system that replaces the need for external chat apps and SMS groups. Everything happens within the platform — with full control over who sees what, and when notifications are sent.

---

## Chat

Team chat in SmartOut is organised in channels:

| Channel type   | Description                | Example                |
| -------------- | -------------------------- | ---------------------- |
| **Department** | Everyone in the department | #kitchen, #floor       |
| **Team**       | Everyone in the team       | #evening-crew          |
| **Session**    | Active session for the day | #floor-wednesday-15jan |
| **Direct**     | One-to-one conversation    | Manager <> employee    |

### Features

- **Text and images** — Send messages with attachments
- **Read receipts** — See who has read the message
- **Threads** — Reply in threads to keep conversations tidy
- **Pinning** — Pin important messages to the top of the channel
- **Search** — Full-text search across all channels you have access to

---

## Notifications

SmartOut sends notifications through multiple channels:

| Channel               | Use case                             |
| --------------------- | ------------------------------------ |
| **Push notification** | Real-time alerts in the app          |
| **SMS**               | Critical alerts (shift swap, urgent) |
| **Email**             | Summaries, reports, documents        |
| **Voice**             | Automatic call-out on escalation     |

### Notification types

- **Shift swap request** — Someone wants to swap a shift with you
- **New task** — A task has been assigned to you
- **Deviation** — A control point is outside limits
- **Announcement** — General information from management
- **Reminder** — Incomplete training or expiring certification

---

## Announcements

Managers can send announcements to an entire workspace, department or team:

1. **Write the announcement** — Title and content
2. **Choose recipients** — Workspace, department, team or individuals
3. **Choose channel** — Push, SMS, email or all
4. **Require confirmation** — Optional: recipients must confirm they have read it

> Announcements with confirmation requirements are displayed in a separate "unread" field until the employee confirms.

---

## Escalation

SmartOut has automatic escalation for unanswered notifications:

1. **First notification** — Push notification to the employee
2. **After 15 minutes** — SMS is sent
3. **After 30 minutes** — The notification is escalated to the nearest manager
4. **After 60 minutes** — The notification is escalated to admin

> Escalation times can be configured per workspace.

---

## Quiet hours

To respect employees' time off, SmartOut supports **quiet hours**:

- **Default:** 22:00-07:00 — no push notifications
- **Custom:** Each employee can set their own quiet hours
- **Exceptions:** Critical notifications (urgent shift changes) can break through quiet hours

> Quiet hours only apply to push notifications. SMS and email are sent normally, but are only displayed when quiet hours are over.

---

## Handover

During shift changes, the outgoing employee can hand over information to the incoming one:

- **Handover note** — Free text with important information
- **Unfinished tasks** — Automatically transferred to the next operational session
- **Flagged issues** — Marked events that need follow-up
